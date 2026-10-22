"""Loopback-only in-memory R job broker. No client code, paths, or credentials."""
from collections import deque
from datetime import datetime, timezone
from functools import lru_cache
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

BASE = Path(__file__).resolve().parent
ORIGINS = frozenset(f'http://{host}:{port}' for host in ('127.0.0.1', 'localhost') for port in (5180, 5174, 5175))
BASIC_METHODS = ('preprocess', 'pca', 'heatmap', 'compare', 'correlation', 'distribution')
SUPERVISED_METHODS = ('plsda', 'oplsda')
METHODS = BASIC_METHODS + SUPERVISED_METHODS
MAX_BYTES = 32 * 1024 * 1024
MAX_CELLS = 2_000_000
TERMINAL = frozenset(('completed', 'failed', 'cancelled'))

def now():
    return datetime.now(timezone.utc).isoformat()

@lru_cache(maxsize=8)
def probe_runtime(rscript, rlibs):
    """Cached startup probe: only fixed trusted R code, never client expressions."""
    capabilities = {'methods': [], 'runtimeReady': False, 'supervised': False, 'packages': {}}
    env = os.environ.copy()
    env['LC_ALL'] = 'C'
    if rlibs is not None: env['R_LIBS_USER'] = rlibs
    code = ('if(requireNamespace("jsonlite",quietly=TRUE)) {'
            'cat("R:",as.character(getRversion()),"\\nJSONLITE:",'
            'as.character(packageVersion("jsonlite")),"\\n",sep="");'
            'if(requireNamespace("ropls",quietly=TRUE)) '
            'cat("ROPLS:",as.character(packageVersion("ropls")),"\\n",sep="")}')
    kwargs = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}
    try:
        result = subprocess.run([rscript, '--vanilla', '-e', code], env=env,
                                capture_output=True, text=True, timeout=20, check=False, **kwargs)
        versions = re.fullmatch(r'R:([0-9]+(?:\.[0-9]+)+)\nJSONLITE:([0-9]+(?:\.[0-9]+)+)(?:\nROPLS:([0-9]+(?:\.[0-9]+)+))?', result.stdout.strip())
        if result.returncode == 0 and versions:
            capabilities.update(methods=list(BASIC_METHODS), runtimeReady=True,
                                rVersion=versions[1], packages={'jsonlite': versions[2]})
            if versions[3]:
                capabilities.update(methods=list(METHODS), supervised=True)
                capabilities['packages']['ropls'] = versions[3]
    except (OSError, subprocess.SubprocessError):
        pass  # Health must not claim a runtime/package that could not be loaded.
    return capabilities

def validate_request(request):
    if not isinstance(request, dict) or set(request) - {'dataset', 'recipe', 'analysis'}:
        raise ValueError('INVALID_REQUEST')
    analysis = request.get('analysis')
    if not isinstance(analysis, dict) or analysis.get('method') not in METHODS:
        raise ValueError('UNSUPPORTED_METHOD')
    if not isinstance(request.get('recipe', {}), dict): raise ValueError('INVALID_RECIPE')
    data = request.get('dataset')
    if not isinstance(data, dict) or data.get('schemaVersion') != 1: raise ValueError('SCHEMA_VERSION')
    samples, features, matrix = (data.get(k) for k in ('samples', 'features', 'matrix'))
    if not all(isinstance(v, list) and v for v in (samples, features, matrix)): raise ValueError('EMPTY_DATASET')
    if len(samples) * len(features) > MAX_CELLS: raise ValueError('CELL_LIMIT')
    for items in (samples, features):
        ids = [item.get('id') if isinstance(item, dict) else None for item in items]
        if any(not isinstance(i, str) or not i.strip() for i in ids) or len(set(ids)) != len(ids): raise ValueError('INVALID_OR_DUPLICATE_ID')
    if len(matrix) != len(samples) or any(not isinstance(row, list) or len(row) != len(features) for row in matrix): raise ValueError('MATRIX_DIMENSIONS')
    for row in matrix:
        for value in row:
            if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value)): raise ValueError('MATRIX_VALUE')
    quality = data.get('quality', {})
    if not isinstance(quality, dict): raise ValueError('QUALITY_VALUE')
    for key in ('cellStates', 'originalImputedMask', 'qcFilteredMask', 'unknownSourceMask'):
        if key not in quality: continue
        value = quality[key]
        if not isinstance(value, list) or len(value) != len(samples) or any(not isinstance(row, list) or len(row) != len(features) for row in value): raise ValueError('QUALITY_DIMENSIONS')
        for row in value:
            for cell in row:
                if (cell not in ('observed', 'missing', 'original-imputed', 'qc-filtered', 'unknown')) if key == 'cellStates' else not isinstance(cell, bool): raise ValueError('QUALITY_VALUE')

class AnalysisService:
    def __init__(self, rscript=None, rlibs=None, max_running=1, max_queued=8, timeout=180, max_history=32):
        self.rscript = str(rscript or os.environ.get('ANALYSIS_RSCRIPT', 'D:/R-4.6.0/bin/Rscript.exe'))
        self.rlibs = rlibs or os.environ.get('R_LIBS_USER')
        if not 0 < timeout <= 3600: raise ValueError('INVALID_TIMEOUT')
        self.capabilities = probe_runtime(self.rscript, self.rlibs)
        self.max_running, self.max_queued, self.timeout, self.max_history = max_running, max_queued, timeout, max_history
        self.jobs, self.pending, self.processes = {}, deque(), {}
        self.active = set()  # worker ownership outlives an immediately cancelled status
        self.lock = threading.RLock()
        self.stopped = threading.Event()
        self.workers = [threading.Thread(target=self._worker, daemon=True) for _ in range(max_running)]
        self.tokens = {}  # tokens bound to exact origin, expire after eight hours
        for thread in self.workers: thread.start()
    def session(self, origin):
        with self.lock:
            self.tokens = {k: v for k, v in self.tokens.items() if v[1] > time.monotonic()}
            if len(self.tokens) >= 64: self.tokens.pop(next(iter(self.tokens)))
            token = secrets.token_urlsafe(32); self.tokens[token] = (origin, time.monotonic() + 8 * 3600)
            return token
    def authorized(self, token, origin):
        with self.lock:
            stored = self.tokens.get(token)
            return bool(stored and stored[0] == origin and stored[1] > time.monotonic())
    def submit(self, request):
        validate_request(request)
        if not self.capabilities['runtimeReady']:
            raise ValueError('ENGINE_NOT_AVAILABLE')
        if request['analysis']['method'] in SUPERVISED_METHODS and not self.capabilities['supervised']:
            raise ValueError('SUPERVISED_NOT_AVAILABLE')
        canonical = json.dumps(request, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode('utf-8')
        if len(canonical) > MAX_BYTES: raise ValueError('PAYLOAD_LIMIT')
        with self.lock:
            if len(self.pending) >= self.max_queued: raise ValueError('QUEUE_FULL')
            for key in list(self.jobs):
                if len(self.jobs) < self.max_history: break
                if self.jobs[key]['status'] in TERMINAL and key not in self.active: del self.jobs[key]
            if len(self.jobs) >= self.max_history: raise ValueError('HISTORY_FULL')
            identifier = secrets.token_hex(16)
            self.jobs[identifier] = dict(id=identifier, status='queued', createdAt=now(), startedAt=None, finishedAt=None, requestHash=hashlib.sha256(canonical).hexdigest(), result=None, error=None, logs=[], _input=canonical)
            self.pending.append(identifier)
            return self.get(identifier)
    def get(self, identifier):
        with self.lock:
            job = self.jobs.get(identifier)
            return None if job is None else {k: v for k, v in job.items() if not k.startswith('_')}
    def _kill(self, process):
        if process.poll() is not None: return
        if os.name == 'nt':
            subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW, timeout=10, check=False)
        else:
            import signal
            try: os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError: pass
        if process.poll() is None: process.kill()
    def cancel(self, identifier):
        with self.lock:
            job = self.jobs.get(identifier)
            if job is None: return False
            if job['status'] in TERMINAL: return True
            job.update(status='cancelled', finishedAt=now(), error={'code': 'CANCELLED'})
            if identifier in self.pending: self.pending.remove(identifier)
            process = self.processes.get(identifier)
        if process: self._kill(process)
        return True
    def _worker(self):
        while not self.stopped.wait(.03):
            with self.lock:
                if not self.pending: continue
                identifier = self.pending.popleft(); job = self.jobs[identifier]
                if job['status'] != 'queued': continue
                self.active.add(identifier)
                job.update(status='running', startedAt=now())
            try:
                self._run(identifier)
            except Exception:
                # A single infrastructure/cleanup exception must not kill the queue.
                with self.lock:
                    job = self.jobs.get(identifier)
                    if job is not None and job['status'] not in TERMINAL:
                        job.update(status='failed', error={'code': 'SERVICE_EXECUTION_FAILED'}, finishedAt=now())
            finally:
                with self.lock:
                    self.active.discard(identifier)
    def _run(self, identifier):
        directory = None
        process = None
        try:
            directory = tempfile.mkdtemp(prefix='flavor-analysis-')
            input_path = Path(directory) / 'request.json'; output_path = Path(directory) / 'result.json'
            with self.lock: payload = self.jobs[identifier].pop('_input')
            input_path.write_bytes(payload)
            env = os.environ.copy(); env['LC_ALL'] = 'C'
            if self.rlibs: env['R_LIBS_USER'] = str(self.rlibs)
            kwargs = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {'start_new_session': True}
            with self.lock:
                if self.jobs[identifier]['status'] == 'cancelled': return
                process = subprocess.Popen([self.rscript, '--vanilla', str(BASE / 'engine.R'), str(input_path), str(output_path)], cwd=directory, env=env, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, **kwargs)
                self.processes[identifier] = process
            try: process.wait(timeout=self.timeout)
            except subprocess.TimeoutExpired:
                self._kill(process)
                raise ValueError('TIMEOUT')
            if not output_path.exists(): raise ValueError('ENGINE_FAILED')
            if output_path.stat().st_size > MAX_BYTES * 4: raise ValueError('RESULT_LIMIT')
            result = json.loads(output_path.read_text(encoding='utf-8'))
            with self.lock:
                job = self.jobs[identifier]
                if job['status'] == 'cancelled': return
                if process.returncode or result.get('error'):
                    message = str(result.get('error', {}).get('code', 'ENGINE_FAILED'))
                    # Expose only explicit engine codes, never runtime paths or raw stderr.
                    code = message if re.fullmatch(r'[A-Z][A-Z0-9_]{1,100}', message) else 'ENGINE_VALIDATION_FAILED'
                    job.update(status='failed', error={'code': code}, finishedAt=now())
                else: job.update(status='completed', result=result, finishedAt=now())
        except Exception as error:
            code = str(error) if isinstance(error, ValueError) and re.fullmatch(r'[A-Z][A-Z0-9_]+', str(error)) else 'SERVICE_EXECUTION_FAILED'
            with self.lock:
                if self.jobs[identifier]['status'] != 'cancelled': self.jobs[identifier].update(status='failed', error={'code': code}, finishedAt=now())
        finally:
            try:
                if process and process.poll() is None: self._kill(process)
            finally:
                with self.lock: self.processes.pop(identifier, None)
                if directory is not None:
                    for attempt in range(3):
                        try:
                            shutil.rmtree(directory)
                            break
                        except FileNotFoundError:
                            break
                        except OSError:
                            if attempt < 2:
                                time.sleep(.03)
                            else:
                                with self.lock:
                                    job = self.jobs.get(identifier)
                                    if job is not None:
                                        job['logs'].append({'code': 'TEMP_CLEANUP_FAILED'})
    def close(self):
        self.stopped.set()
        with self.lock: identifiers = list(self.jobs)
        for identifier in identifiers: self.cancel(identifier)
        for thread in self.workers: thread.join(timeout=12)

def create_server(service, port=8890):
    class Handler(BaseHTTPRequestHandler):
        server_version = 'LocalAnalysis/1.0'
        def log_message(self, *_args): pass
        def setup(self):
            super().setup(); self.connection.settimeout(10)
        def respond(self, status, body):
            content = json.dumps(body, ensure_ascii=False, allow_nan=False).encode('utf-8')
            self.send_response(status)
            origin = self.headers.get('Origin')
            if origin in ORIGINS:
                self.send_header('Access-Control-Allow-Origin', origin); self.send_header('Vary', 'Origin')
            self.send_header('Cache-Control', 'no-store'); self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Type', 'application/json; charset=utf-8'); self.send_header('Content-Length', str(len(content)))
            self.end_headers(); self.wfile.write(content)
        def guard(self, token=False, origin_required=True):
            expected = {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}
            if self.headers.get_all('Host', []) not in [[h] for h in expected]: self.respond(403, {'error': {'code': 'HOST_FORBIDDEN'}}); return False
            origin = self.headers.get('Origin')
            if (origin_required or origin is not None) and (len(self.headers.get_all('Origin', [])) != 1 or origin not in ORIGINS): self.respond(403, {'error': {'code': 'ORIGIN_FORBIDDEN'}}); return False
            if token:
                auth = self.headers.get('Authorization', '')
                if not auth.startswith('Bearer ') or not service.authorized(auth[7:], origin): self.respond(401, {'error': {'code': 'TOKEN_REQUIRED'}}); return False
            return True
        def body(self):
            if self.headers.get('Transfer-Encoding'): raise ValueError('TRANSFER_ENCODING_FORBIDDEN')
            if len(self.headers.get_all('Content-Length', [])) != 1: raise ValueError('CONTENT_LENGTH_REQUIRED')
            try: length = int(self.headers['Content-Length'])
            except ValueError: raise ValueError('CONTENT_LENGTH_REQUIRED') from None
            if length < 0 or length > MAX_BYTES: raise ValueError('PAYLOAD_LIMIT')
            if self.headers.get('Content-Type', '').split(';')[0].strip().lower() != 'application/json': raise ValueError('CONTENT_TYPE')
            content = self.rfile.read(length)
            if len(content) != length: raise ValueError('INCOMPLETE_BODY')
            try:
                return json.loads(content, parse_constant=lambda _value: (_ for _ in ()).throw(ValueError('NONFINITE_JSON')))
            except (json.JSONDecodeError, UnicodeDecodeError, RecursionError): raise ValueError('INVALID_JSON') from None
        def do_OPTIONS(self):
            if not self.guard(): return
            self.send_response(204); self.send_header('Access-Control-Allow-Origin', self.headers['Origin']); self.send_header('Vary', 'Origin'); self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS'); self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type'); self.send_header('Content-Length', '0'); self.end_headers()
        def do_GET(self):
            if self.path == '/health':
                if self.guard(origin_required=False): self.respond(200, {'status': 'ok', 'serviceVersion': '1.0.0', 'capabilities': service.capabilities, 'limits': {'maxBytes': MAX_BYTES, 'maxCells': MAX_CELLS, 'maxQueued': service.max_queued, 'maxRunning': service.max_running, 'timeoutSeconds': service.timeout, 'maxTimeoutSeconds': 3600, 'supervisedMaxFits': 200000, 'supervisedMaxCellFits': 2000000000, 'correlationMaxPairs': 250000, 'clusterMaxDistancePairsPerAxis': 1000000}, 'persistence': 'memory-only'})
                return
            if not self.guard(token=True): return
            match = re.fullmatch(r'/jobs/([a-f0-9]{32})', self.path)
            job = service.get(match[1]) if match else None
            self.respond(200 if job else 404, job or {'error': {'code': 'NOT_FOUND'}})
        def do_POST(self):
            if not self.guard(token=self.path != '/session'): return
            try:
                body = self.body()
                if self.path == '/session':
                    if body != {}: raise ValueError('INVALID_SESSION_REQUEST')
                    self.respond(200, {'token': service.session(self.headers['Origin']), 'expiresIn': 28800})
                elif self.path == '/jobs': self.respond(202, service.submit(body))
                else: self.respond(404, {'error': {'code': 'NOT_FOUND'}})
            except (ValueError, TypeError, OverflowError, RecursionError) as error:
                code = str(error) if isinstance(error, ValueError) and re.fullmatch(r'[A-Z][A-Z0-9_]+', str(error)) else 'INVALID_REQUEST'
                self.respond(413 if code in ('PAYLOAD_LIMIT', 'CELL_LIMIT') else 429 if code in ('QUEUE_FULL', 'HISTORY_FULL') else 400, {'error': {'code': code}})
        def do_DELETE(self):
            if not self.guard(token=True): return
            match = re.fullmatch(r'/jobs/([a-f0-9]{32})', self.path)
            if match and service.cancel(match[1]): self.respond(200, service.get(match[1]))
            else: self.respond(404, {'error': {'code': 'NOT_FOUND'}})
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    server.daemon_threads = True
    return server

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8890); parser.add_argument('--rscript'); parser.add_argument('--rlibs'); parser.add_argument('--timeout', type=int, default=180)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535 or not 1 <= args.timeout <= 3600: parser.error('invalid port or timeout')
    service = AnalysisService(rscript=args.rscript, rlibs=args.rlibs, timeout=args.timeout)
    server = create_server(service, args.port)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close(); service.close()

if __name__ == '__main__': main()
