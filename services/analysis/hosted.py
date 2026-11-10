"""Prospective authenticated, persisted PCA coordinator; disabled until approved deployment.

The existing loopback broker remains unchanged. This module never accepts model
generated code and never trusts a browser-supplied user id for authorization.
"""

from collections import defaultdict, deque
from datetime import datetime, timezone
import hashlib
import json
import re
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import uuid

from services.analysis.server import validate_request


MAX_REQUEST_BYTES = 1_048_576
MAX_RESULT_BYTES = 2_097_152
TERMINAL = frozenset({'completed', 'failed', 'cancelled', 'interrupted'})
PUBLIC_COLUMNS = 'id,user_id,idempotency_key,dataset_id,dataset_sha256,request_sha256,status,result_json,error_code,engine_version,r_version,logs,created_at,updated_at,started_at,completed_at,expires_at'


class HostedPcaError(ValueError):
    def __init__(self, code, status=400):
        super().__init__(code)
        self.code, self.status = code, status


def _hash(value):
    return hashlib.sha256(value).hexdigest()


class SupabasePcaStore:
    """User-JWT reads obey RLS; server-secret writes occur only after auth."""

    def __init__(self, url, anon_key, secret_key, open_url=urlopen):
        if not isinstance(url, str) or not url.startswith('https://') or not anon_key or not secret_key:
            raise HostedPcaError('STORE_NOT_CONFIGURED', 503)
        self.base = url.rstrip('/') + '/rest/v1/'
        self.anon_key, self.secret_key, self.open_url = anon_key, secret_key, open_url

    def _request(self, path, credential, method='GET', body=None, prefer=None, admin=False):
        headers = {'apikey': self.secret_key if admin else self.anon_key,
                   'Authorization': f'Bearer {credential}', 'Accept': 'application/json'}
        if body is not None:
            headers['Content-Type'] = 'application/json'
        if prefer:
            headers['Prefer'] = prefer
        data = None if body is None else json.dumps(body, ensure_ascii=False, allow_nan=False).encode('utf-8')
        try:
            with self.open_url(Request(self.base + path, headers=headers, data=data, method=method), timeout=10) as response:
                raw = response.read(2_500_000)
                return json.loads(raw) if raw else None
        except HTTPError as exc:
            if exc.code == 409:
                raise HostedPcaError('STORE_CONFLICT', 409) from None
            raise HostedPcaError('STORE_UNAVAILABLE', 503) from None
        except (URLError, TimeoutError, OSError, ValueError) as exc:
            raise HostedPcaError('STORE_UNAVAILABLE', 503) from exc

    def approved(self, principal):
        if principal.guest or not principal.token:
            return False
        query = urlencode({'id': f'eq.{principal.user_id}', 'select': 'id,approval_status'})
        rows = self._request('profiles?' + query, principal.token)
        return isinstance(rows, list) and len(rows) == 1 and rows[0].get('id') == principal.user_id and rows[0].get('approval_status') == 'approved'

    def find(self, principal, key):
        query = urlencode({'user_id': f'eq.{principal.user_id}', 'idempotency_key': f'eq.{key}', 'select': PUBLIC_COLUMNS})
        rows = self._request('ai_pca_jobs?' + query, principal.token)
        return rows[0] if isinstance(rows, list) and len(rows) == 1 else None

    def get(self, principal, job_id):
        query = urlencode({'id': f'eq.{job_id}', 'user_id': f'eq.{principal.user_id}', 'select': PUBLIC_COLUMNS})
        rows = self._request('ai_pca_jobs?' + query, principal.token)
        return rows[0] if isinstance(rows, list) and len(rows) == 1 else None

    def count_since(self, principal, since_iso, limit=20):
        query = urlencode({'user_id': f'eq.{principal.user_id}', 'created_at': f'gte.{since_iso}',
                           'select': 'id', 'limit': str(limit)})
        rows = self._request('ai_pca_jobs?' + query, principal.token)
        if not isinstance(rows, list):
            raise HostedPcaError('STORE_UNAVAILABLE', 503)
        return len(rows)

    def insert(self, row):
        rows = self._request('ai_pca_jobs', self.secret_key, 'POST', row, 'return=representation', admin=True)
        if not isinstance(rows, list) or len(rows) != 1 or rows[0].get('id') != row['id']:
            raise HostedPcaError('STORE_UNAVAILABLE', 503)
        return rows[0]

    def update(self, job_id, changes):
        query = urlencode({'id': f'eq.{job_id}'})
        self._request('ai_pca_jobs?' + query, self.secret_key, 'PATCH', changes, 'return=minimal', admin=True)


class HostedPca:
    def __init__(self, store, broker, now=time.time, allowed_users=None):
        self.store, self.broker, self.now = store, broker, now
        self.allowed_users = None if allowed_users is None else frozenset(allowed_users)
        self.lock = threading.RLock()
        self.active = {}
        self.recent = defaultdict(deque)

    def _authorize(self, principal):
        if self.allowed_users is not None and principal.user_id not in self.allowed_users:
            raise HostedPcaError('PCA_ACCESS_DENIED', 403)
        if principal.guest or not principal.token or not self.store.approved(principal):
            raise HostedPcaError('AUTH_REQUIRED', 401)

    @staticmethod
    def _public(row):
        return {key: value for key, value in row.items() if key not in {'request_json', 'idempotency_key'}}

    def _recover_if_orphaned(self, principal, row):
        """A single-instance restart cannot resume its lost in-memory R worker."""
        if row and row.get('status') in {'queued', 'running'}:
            with self.lock:
                if row['id'] not in self.active:
                    self.store.update(row['id'], {
                        'status': 'interrupted', 'error_code': 'JOB_LOST',
                        'completed_at': datetime.now(timezone.utc).isoformat(),
                    })
                    return self.store.get(principal, row['id'])
        return row

    def submit(self, principal, payload):
        self._authorize(principal)
        if not isinstance(payload, dict) or set(payload) != {'datasetJson', 'recipe', 'analysis', 'planReceipt', 'idempotencyKey'}:
            raise HostedPcaError('INVALID_REQUEST')
        dataset_json, receipt, key = payload['datasetJson'], payload['planReceipt'], payload['idempotencyKey']
        if not isinstance(dataset_json, str) or len(dataset_json.encode('utf-8')) > MAX_REQUEST_BYTES:
            raise HostedPcaError('PAYLOAD_LIMIT', 413)
        try:
            dataset = json.loads(dataset_json, parse_constant=lambda _value: (_ for _ in ()).throw(ValueError()))
        except (ValueError, TypeError, RecursionError):
            raise HostedPcaError('INVALID_DATASET') from None
        request = {'dataset': dataset, 'recipe': payload['recipe'], 'analysis': payload['analysis']}
        try:
            key = str(uuid.UUID(key))
        except (TypeError, ValueError, AttributeError):
            raise HostedPcaError('INVALID_IDEMPOTENCY_KEY') from None
        if not isinstance(receipt, dict):
            raise HostedPcaError('PLAN_MISMATCH')
        analysis = request.get('analysis')
        if not isinstance(analysis, dict) or analysis.get('method') != 'pca':
            raise HostedPcaError('PCA_ONLY')
        if (not isinstance(dataset, dict) or receipt.get('datasetId') != dataset.get('id') or
                receipt.get('analysis') != analysis or receipt.get('recipe') != request.get('recipe') or
                receipt.get('datasetHash') != _hash(dataset_json.encode('utf-8')) or
                not isinstance(receipt.get('confirmationHash'), str) or not re.fullmatch('[0-9a-f]{64}', receipt['confirmationHash'])):
            raise HostedPcaError('PLAN_MISMATCH')
        try:
            validate_request(request)
            canonical = json.dumps(request, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode('utf-8')
        except (TypeError, ValueError, OverflowError) as exc:
            code = str(exc) if isinstance(exc, ValueError) and re.fullmatch('[A-Z][A-Z0-9_]+', str(exc)) else 'INVALID_REQUEST'
            raise HostedPcaError(code) from None
        if len(canonical) > MAX_REQUEST_BYTES:
            raise HostedPcaError('PAYLOAD_LIMIT', 413)
        if len(request['dataset']['samples']) > 1000 or len(request['dataset']['features']) > 200:
            raise HostedPcaError('MATRIX_LIMIT', 413)
        if not self.broker.capabilities.get('runtimeReady') or 'pca' not in self.broker.capabilities.get('methods', []):
            raise HostedPcaError('ENGINE_NOT_AVAILABLE', 503)
        request_hash = _hash(canonical)
        existing = self.store.find(principal, key)
        if existing:
            if existing.get('request_sha256') != request_hash:
                raise HostedPcaError('IDEMPOTENCY_CONFLICT', 409)
            return self._public(self._recover_if_orphaned(principal, existing))
        since = datetime.fromtimestamp(self.now() - 86400, timezone.utc).isoformat()
        if self.store.count_since(principal, since) >= 20:
            raise HostedPcaError('DAILY_LIMIT', 429)
        with self.lock:
            recent = self.recent[principal.user_id]
            while recent and self.now() - recent[0] > 60:
                recent.popleft()
            if len(recent) >= 2 or any(owner == principal.user_id for owner, _ in self.active.values()):
                raise HostedPcaError('RATE_LIMIT', 429)
            recent.append(self.now())
            job_id = str(uuid.uuid4())
            row = {'id': job_id, 'user_id': principal.user_id, 'idempotency_key': key,
                   'dataset_id': request['dataset']['id'], 'dataset_sha256': receipt['datasetHash'],
                   'request_sha256': request_hash, 'request_json': request, 'status': 'queued',
                   'logs': [{'code': 'USER_CONFIRMED_PLAN', 'confirmationHash': receipt['confirmationHash']}]}
            try:
                inserted = self.store.insert(row)
            except HostedPcaError as exc:
                if exc.code != 'STORE_CONFLICT':
                    raise
                previous = self.store.find(principal, key)
                if previous and previous.get('request_sha256') == request_hash:
                    return self._public(self._recover_if_orphaned(principal, previous))
                raise HostedPcaError('IDEMPOTENCY_CONFLICT', 409) from None
            try:
                local = self.broker.submit(request)
            except ValueError as exc:
                code = str(exc) if re.fullmatch('[A-Z][A-Z0-9_]+', str(exc)) else 'ENGINE_FAILED'
                self.store.update(job_id, {'status': 'failed', 'error_code': code, 'completed_at': datetime.now(timezone.utc).isoformat()})
                raise HostedPcaError(code, 503) from None
            self.active[job_id] = (principal.user_id, local['id'])
            threading.Thread(target=self._monitor, args=(job_id, local['id'], receipt['confirmationHash']), daemon=True).start()
            return self._public(inserted)

    def _monitor(self, job_id, local_id, confirmation_hash):
        previous = None
        try:
            while True:
                job = self.broker.get(local_id)
                if not job:
                    self.store.update(job_id, {'status': 'interrupted', 'error_code': 'JOB_LOST', 'completed_at': datetime.now(timezone.utc).isoformat()})
                    return
                status = job['status']
                if status != previous:
                    update = {'status': status, 'updated_at': datetime.now(timezone.utc).isoformat()}
                    if status == 'running':
                        update['started_at'] = job.get('startedAt')
                    if status in TERMINAL:
                        update['completed_at'] = job.get('finishedAt') or datetime.now(timezone.utc).isoformat()
                        update['logs'] = [{'code': 'USER_CONFIRMED_PLAN', 'confirmationHash': confirmation_hash}] + (job.get('logs') or [])
                        if status == 'completed':
                            result = job.get('result')
                            if not isinstance(result, dict) or result.get('method') != 'pca':
                                update.update(status='failed', error_code='INVALID_ENGINE_RESULT')
                            elif len(json.dumps(result, ensure_ascii=False, allow_nan=False).encode('utf-8')) > MAX_RESULT_BYTES:
                                update.update(status='failed', error_code='RESULT_LIMIT')
                            else:
                                update['result_json'] = result
                        else:
                            update['error_code'] = (job.get('error') or {}).get('code') or 'ENGINE_FAILED'
                    self.store.update(job_id, update)
                    previous = status
                if status in TERMINAL:
                    return
                time.sleep(.2)
        except Exception:
            # A failed persistence write must never be reported as success.
            try:
                self.store.update(job_id, {'status': 'interrupted', 'error_code': 'PERSISTENCE_FAILED', 'completed_at': datetime.now(timezone.utc).isoformat()})
            except HostedPcaError:
                pass
        finally:
            with self.lock:
                self.active.pop(job_id, None)

    def get(self, principal, job_id):
        self._authorize(principal)
        try:
            uuid.UUID(job_id)
        except (TypeError, ValueError, AttributeError):
            raise HostedPcaError('INVALID_JOB_ID') from None
        row = self.store.get(principal, job_id)
        row = self._recover_if_orphaned(principal, row)
        return self._public(row) if row else None

    def cancel(self, principal, job_id):
        row = self.get(principal, job_id)
        if row is None:
            raise HostedPcaError('NOT_FOUND', 404)
        if row.get('status') in TERMINAL:
            return row
        with self.lock:
            owned = self.active.get(job_id)
        if not owned or owned[0] != principal.user_id:
            raise HostedPcaError('JOB_NOT_ACTIVE_HERE', 409)
        self.broker.cancel(owned[1])
        after = self.broker.get(owned[1])
        if after and after.get('status') == 'completed':
            # Completion won the race; the monitor persists its real result.
            return self.get(principal, job_id)
        self.store.update(job_id, {'status': 'cancelled', 'error_code': 'CANCELLED', 'completed_at': datetime.now(timezone.utc).isoformat()})
        return self.get(principal, job_id)
