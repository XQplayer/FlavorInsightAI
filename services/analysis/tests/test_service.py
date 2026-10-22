"""Public synthetic fixtures, real HTTP and R subprocesses (no scientific mocks)."""
import importlib.util
import http.client
import json
import os
from pathlib import Path
import threading
import time
import unittest
import urllib.request
import urllib.error

BASE = Path(__file__).resolve().parents[1]
def fixture():
    matrix = [[1, 2], [2, 4], [3, 5], [5, 8], [6, 10], [8, 12]]
    return dict(schemaVersion=1, id='public-synthetic', samples=[dict(id=f's{i}', group='C' if i < 3 else 'T', biologicalUnitId=f'u{i}', include=True) for i in range(6)], features=[dict(id='f1', unit='mg/L'), dict(id='f2', unit='mg/L')], matrix=matrix, quality=dict(cellStates=[['observed'] * 2 for _ in matrix]), provenance=dict(independenceConfirmed=True))

class ServiceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not (BASE / 'server.py').exists():
            raise AssertionError('local service implementation is missing')
        spec = importlib.util.spec_from_file_location('analysis_server', BASE / 'server.py')
        cls.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.module)
        cls.service = cls.module.AnalysisService(rscript='D:/R-4.6.0/bin/Rscript.exe', rlibs='E:/codex/Projects/FlavorThresholdDB/_local/analysis-r-library', max_running=1, max_queued=2, timeout=20)
        cls.http = cls.module.create_server(cls.service, port=0)
        cls.port = cls.http.server_address[1]
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown(); cls.http.server_close(); cls.service.close()
    def call(self, path, data=None, method=None, origin='http://127.0.0.1:5180', token=None, host=None):
        headers = {'Origin': origin}
        if data is not None: headers['Content-Type'] = 'application/json'
        if token: headers['Authorization'] = 'Bearer ' + token
        if host: headers['Host'] = host
        request = urllib.request.Request(f'http://127.0.0.1:{self.port}{path}', data=None if data is None else json.dumps(data).encode(), headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=25) as response: return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            return error.code, json.load(error)
    def token(self):
        status, value = self.call('/session', {}, 'POST'); self.assertEqual(status, 200); return value['token']
    def test_health_nonsecret(self):
        status, body = self.call('/health'); self.assertEqual(status, 200); self.assertNotIn('token', body); self.assertFalse(body['capabilities']['supervised'])
    def test_origin_and_host_exact(self):
        for origin in ['https://evil.example', 'http://127.0.0.1:5180.evil.example', 'null']:
            self.assertEqual(self.call('/session', {}, 'POST', origin=origin)[0], 403)
        self.assertEqual(self.call('/health', host='evil.example')[0], 403)
        self.assertEqual(self.call('/health', host=f'127.0.0.1:{self.port + 1}')[0], 403)
    def test_token_and_method(self):
        self.assertEqual(self.call('/jobs', {}, 'POST')[0], 401)
        token = self.token()
        self.assertEqual(self.call('/jobs', {'dataset': fixture(), 'analysis': {'method': 'eval'}, 'recipe': {}}, 'POST', token=token)[0], 400)
    def test_real_job(self):
        token = self.token(); request = {'dataset': fixture(), 'recipe': {'scale': {'method': 'uv'}}, 'analysis': {'method': 'pca'}}
        status, job = self.call('/jobs', request, 'POST', token=token); self.assertEqual(status, 202)
        for _ in range(200):
            status, job = self.call('/jobs/' + job['id'], token=token)
            if job['status'] in ['completed', 'failed', 'cancelled']: break
            time.sleep(.05)
        self.assertEqual(job['status'], 'completed', job)
        self.assertEqual(job['result']['method'], 'pca'); self.assertEqual(len(job['requestHash']), 64)
        self.assertEqual(job['result']['provenance']['datasetId'], 'public-synthetic')
        self.assertEqual(job['result']['provenance']['recipeSchemaVersion'], 1)
    def test_single_feature_json_stays_array(self):
        token = self.token(); data = fixture(); data['features'] = data['features'][:1]
        data['matrix'] = [row[:1] for row in data['matrix']]; data['quality']['cellStates'] = [row[:1] for row in data['quality']['cellStates']]
        _, job = self.call('/jobs', {'dataset': data, 'recipe': {}, 'analysis': {'method': 'pca'}}, 'POST', token=token)
        for _ in range(200):
            _, job = self.call('/jobs/' + job['id'], token=token)
            if job['status'] in ['completed', 'failed']: break
            time.sleep(.03)
        self.assertEqual(job['status'], 'completed', job)
        self.assertIsInstance(job['result']['data']['featureIds'], list)
        self.assertIsInstance(job['result']['data']['eigenvalues'], list)
    def test_queued_cancellation_and_limit(self):
        service = self.module.AnalysisService(rscript='D:/R-4.6.0/bin/Rscript.exe', max_running=0, max_queued=1)
        try:
            req = {'dataset': fixture(), 'recipe': {}, 'analysis': {'method': 'pca'}}
            job = service.submit(req)
            with self.assertRaisesRegex(ValueError, 'QUEUE_FULL'): service.submit(req)
            self.assertTrue(service.cancel(job['id'])); self.assertEqual(service.get(job['id'])['status'], 'cancelled')
        finally: service.close()
    def test_request_numeric_and_cells(self):
        token = self.token(); data = fixture(); data['matrix'][0][0] = 'not-number'
        self.assertEqual(self.call('/jobs', {'dataset': data, 'recipe': {}, 'analysis': {'method': 'pca'}}, 'POST', token=token)[0], 400)
    def test_http_body_limits_and_nonfinite(self):
        token = self.token()
        cases = [({'Content-Length': str(32 * 1024 * 1024 + 1)}, b'', 413), ({'Content-Type': 'text/plain'}, b'{}', 400), ({}, b'{"bad":NaN}', 400), ({'Transfer-Encoding': 'chunked'}, b'{}', 400)]
        for extra, body, expected in cases:
            connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
            headers = {'Origin': 'http://127.0.0.1:5180', 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': str(len(body))}; headers.update(extra)
            connection.request('POST', '/jobs', body, headers); response = connection.getresponse()
            self.assertEqual(response.status, expected, response.read()); connection.close()
    def test_token_bound_to_origin(self):
        token = self.token()
        self.assertEqual(self.call('/jobs/' + '0'*32, token=token, origin='http://localhost:5180')[0], 401)
    def test_cell_limit(self):
        data = fixture(); data['samples'] = [dict(id=f's{i}') for i in range(2001)]; data['features'] = [dict(id=f'f{i}') for i in range(1000)]
        with self.assertRaisesRegex(ValueError, 'CELL_LIMIT'): self.module.validate_request({'dataset': data, 'analysis': {'method': 'pca'}})
    def test_running_cancel_and_timeout(self):
        for timeout, cancel in [(20, True), (.001, False)]:
            service = self.module.AnalysisService(rscript='D:/R-4.6.0/bin/Rscript.exe', rlibs='E:/codex/Projects/FlavorThresholdDB/_local/analysis-r-library', timeout=timeout)
            try:
                job = service.submit({'dataset': fixture(), 'recipe': {}, 'analysis': {'method': 'pca'}})
                for _ in range(1000):
                    current = service.get(job['id'])
                    if current['status'] != 'queued': break
                    time.sleep(.002)
                if cancel: service.cancel(job['id'])
                for _ in range(1000):
                    current = service.get(job['id'])
                    if current['status'] in self.module.TERMINAL and job['id'] not in service.processes: break
                    time.sleep(.005)
                self.assertEqual(current['status'], 'cancelled' if cancel else 'failed', current)
                if not cancel: self.assertEqual(current['error']['code'], 'TIMEOUT')
                self.assertNotIn(job['id'], service.processes)
            finally: service.close()
    def test_launcher_exists_and_is_hidden(self):
        launcher = BASE.parents[1] / 'scripts' / 'start_analysis_service.ps1'
        self.assertTrue(launcher.exists(), 'dedicated hidden launcher missing')
        self.assertIn('-WindowStyle Hidden', launcher.read_text(encoding='utf-8'))

if __name__ == '__main__': unittest.main()
