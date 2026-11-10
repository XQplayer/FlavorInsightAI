"""Synthetic contract tests for the prospective hosted PCA coordinator."""

import copy
import hashlib
import json
import threading
import unittest
import uuid
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from services.ai_tools import Principal
from services.analysis.tests.test_service import fixture
from services.analysis.hosted import HostedPca, HostedPcaError, SupabasePcaStore
from services.analysis.hosted_http import create_server


class FakeStore:
    def __init__(self):
        self.rows = {}
        self.approved_users = {'user-a', 'user-b'}

    def approved(self, principal):
        return principal.user_id in self.approved_users and bool(principal.token)

    def find(self, principal, key):
        return next((copy.deepcopy(row) for row in self.rows.values() if row['user_id'] == principal.user_id and row['idempotency_key'] == key), None)

    def insert(self, row):
        self.rows[row['id']] = copy.deepcopy(row)
        return copy.deepcopy(row)

    def get(self, principal, job_id):
        row = self.rows.get(job_id)
        return copy.deepcopy(row) if row and row['user_id'] == principal.user_id else None

    def update(self, job_id, changes):
        self.rows[job_id].update(copy.deepcopy(changes))


class FakeBroker:
    capabilities = {'runtimeReady': True, 'methods': ['pca']}

    def __init__(self):
        self.calls = []

    def submit(self, request):
        self.calls.append(copy.deepcopy(request))
        return {'id': 'a' * 32, 'status': 'queued'}

    def get(self, _job_id):
        return {'status': 'completed', 'result': {'method': 'pca', 'data': {'explained': [.8, .2]}}, 'logs': []}

    def cancel(self, _job_id):
        return True


def payload():
    request = {'dataset': fixture(), 'recipe': {}, 'analysis': {'method': 'pca', 'components': 2, 'center': True}}
    dataset_json = json.dumps(request['dataset'], ensure_ascii=False, separators=(',', ':'))
    return {'datasetJson': dataset_json, 'recipe': request['recipe'], 'analysis': request['analysis'],
            'planReceipt': {'datasetId': 'public-synthetic', 'datasetHash': hashlib.sha256(dataset_json.encode()).hexdigest(),
            'recipe': {}, 'analysis': request['analysis'], 'confirmationHash': 'c' * 64},
            'idempotencyKey': str(uuid.uuid4())}


class HostedPcaTest(unittest.TestCase):
    def setUp(self):
        self.store, self.broker = FakeStore(), FakeBroker()
        self.hosted = HostedPca(self.store, self.broker)
        self.a = Principal('user-a', token='jwt-a')
        self.b = Principal('user-b', token='jwt-b')

    def test_requires_verified_approved_user_and_confirmed_plan(self):
        with self.assertRaisesRegex(HostedPcaError, 'AUTH_REQUIRED'):
            self.hosted.submit(Principal('guest', guest=True), payload())
        bad = payload(); bad['planReceipt']['datasetId'] = 'different'
        with self.assertRaisesRegex(HostedPcaError, 'PLAN_MISMATCH'):
            self.hosted.submit(self.a, bad)
        bad = payload(); bad['planReceipt']['datasetHash'] = 'a' * 64
        with self.assertRaisesRegex(HostedPcaError, 'PLAN_MISMATCH'):
            self.hosted.submit(self.a, bad)
        self.assertFalse(self.broker.calls)

    def test_owner_only_and_idempotent_submission(self):
        item = payload()
        created = self.hosted.submit(self.a, item)
        repeated = self.hosted.submit(self.a, item)
        self.assertEqual(created['id'], repeated['id'])
        self.assertEqual(len(self.broker.calls), 1)
        self.assertIsNone(self.hosted.get(self.b, created['id']))
        self.assertEqual(self.hosted.get(self.a, created['id'])['user_id'], 'user-a')
        changed = payload(); changed['idempotencyKey'] = item['idempotencyKey']
        changed['datasetJson'] = changed['datasetJson'].replace('[[1,2]', '[[99,2]')
        changed['planReceipt']['datasetHash'] = hashlib.sha256(changed['datasetJson'].encode()).hexdigest()
        with self.assertRaisesRegex(HostedPcaError, 'IDEMPOTENCY_CONFLICT'):
            self.hosted.submit(self.a, changed)

    def test_rejects_unbounded_or_non_pca_request(self):
        bad = payload(); bad['analysis']['method'] = 'oplsda'; bad['planReceipt']['analysis'] = bad['analysis']
        with self.assertRaisesRegex(HostedPcaError, 'PCA_ONLY'):
            self.hosted.submit(self.a, bad)
        bad = payload(); bad['datasetJson'] = bad['datasetJson'].replace('[[1,2]', '[["bad",2]')
        bad['planReceipt']['datasetHash'] = hashlib.sha256(bad['datasetJson'].encode()).hexdigest()
        with self.assertRaisesRegex(HostedPcaError, 'MATRIX_VALUE'):
            self.hosted.submit(self.a, bad)

    def test_completed_result_keeps_confirmation_and_owner_context(self):
        import time
        created = self.hosted.submit(self.a, payload())
        for _ in range(30):
            row = self.hosted.get(self.a, created['id'])
            if row['status'] == 'completed': break
            time.sleep(.01)
        self.assertEqual(row['status'], 'completed')
        self.assertEqual(row['result_json']['method'], 'pca')
        self.assertEqual(row['logs'][0]['code'], 'USER_CONFIRMED_PLAN')
        self.assertIsNone(self.hosted.get(self.b, created['id']))

    def test_restart_marks_stranded_job_interrupted_without_reexecution(self):
        job_id = str(uuid.uuid4())
        self.store.insert({'id': job_id, 'user_id': 'user-a', 'status': 'running',
                           'idempotency_key': str(uuid.uuid4()), 'request_sha256': 'a' * 64})
        restarted = HostedPca(self.store, self.broker)
        recovered = restarted.get(self.a, job_id)
        self.assertEqual(recovered['status'], 'interrupted')
        self.assertEqual(recovered['error_code'], 'JOB_LOST')
        self.assertIsNone(restarted.get(self.b, job_id))
        self.assertEqual(len(self.broker.calls), 0)


class SupabaseStoreHeaderTest(unittest.TestCase):
    def test_user_reads_use_anon_key_and_jwt_while_writes_use_secret(self):
        calls = []

        class Response:
            def __init__(self, data): self.data = data
            def __enter__(self): return self
            def __exit__(self, *_args): pass
            def read(self, _limit): return json.dumps(self.data).encode()

        def open_url(request, timeout):
            calls.append((request.get_method(), dict(request.header_items())))
            return Response([{'id': 'user-a', 'approval_status': 'approved'}] if request.get_method() == 'GET' else [{'id': 'job-a'}])

        store = SupabasePcaStore('https://staging.example.supabase.co', 'anon-key', 'server-secret', open_url)
        self.assertTrue(store.approved(Principal('user-a', token='jwt-user-a')))
        store.insert({'id': 'job-a'})
        self.assertEqual(calls[0][1]['Apikey'], 'anon-key')
        self.assertEqual(calls[0][1]['Authorization'], 'Bearer jwt-user-a')
        self.assertEqual(calls[1][1]['Apikey'], 'server-secret')
        self.assertEqual(calls[1][1]['Authorization'], 'Bearer server-secret')


class HostedHttpTest(unittest.TestCase):
    def test_real_http_requires_bearer_and_hides_foreign_task(self):
        store, broker = FakeStore(), FakeBroker()
        hosted = HostedPca(store, broker)

        class Gateway:
            allowed_origins = {'http://127.0.0.1:5180'}
            def principal(self, authorization, *_args):
                return Principal('user-a' if authorization == 'Bearer jwt-a' else 'user-b', token=authorization)

        server = create_server(hosted, Gateway(), port=0)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f'http://127.0.0.1:{server.server_port}'
        try:
            def call(path, method='GET', body=None, token=None):
                headers = {'Origin': 'http://127.0.0.1:5180'}
                if token: headers['Authorization'] = 'Bearer ' + token
                if body is not None: headers['Content-Type'] = 'application/json'
                request = Request(base + path, method=method, headers=headers,
                                  data=json.dumps(body).encode() if body is not None else None)
                try:
                    with urlopen(request, timeout=3) as response:
                        return response.status, json.load(response)
                except HTTPError as exc:
                    return exc.code, json.load(exc)
            self.assertEqual(call('/jobs', 'POST', payload())[0], 401)
            status, job = call('/jobs', 'POST', payload(), 'jwt-a')
            self.assertEqual(status, 202)
            self.assertNotIn('request_json', job)
            self.assertEqual(call('/jobs/' + job['id'], token='jwt-b')[0], 404)
            self.assertEqual(call('/jobs/' + job['id'], token='jwt-a')[0], 200)
        finally:
            server.shutdown(); server.server_close(); thread.join(timeout=2)
