"""Explicit default-200 end-to-end check, not part of every unit-test run."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time
import urllib.request

BASE = Path(__file__).resolve().parents[1]
data = json.loads((BASE / 'tests/fixtures/synthetic-3groups.json').read_text(encoding='utf-8'))
request = {'dataset': data, 'recipe': {'scale': {'method': 'uv'}}, 'analysis': {'method': 'plsda'}}
env = os.environ.copy()
env['R_LIBS_USER'] = 'E:/codex/Projects/FlavorThresholdDB/_local/analysis-r-library'
env['LC_ALL'] = 'C'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--http', action='store_true', help='also include ephemeral authenticated HTTP broker startup and polling')
args = parser.parse_args()

def run_engine():
    with tempfile.TemporaryDirectory(prefix='analysis-public-benchmark-') as folder:
        folder = Path(folder)
        source, target = folder / 'input.json', folder / 'output.json'
        source.write_text(json.dumps(request), encoding='utf-8')
        started = time.monotonic()
        result = subprocess.run(['D:/R-4.6.0/bin/Rscript.exe', '--vanilla', str(BASE / 'engine.R'), str(source), str(target)],
                                env=env, capture_output=True, text=True, timeout=180)
        elapsed = time.monotonic() - started
        assert result.returncode == 0, result.stderr
        return json.loads(target.read_text(encoding='utf-8')), elapsed, target.stat().st_size

def run_http():
    spec = importlib.util.spec_from_file_location('benchmark_server', BASE / 'server.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    started = time.monotonic()
    service = module.AnalysisService(rscript='D:/R-4.6.0/bin/Rscript.exe', rlibs=env['R_LIBS_USER'])
    http = module.create_server(service, port=0)
    thread = threading.Thread(target=http.serve_forever, daemon=True); thread.start()
    def call(path, body=None, token=None):
        headers = {'Origin': 'http://127.0.0.1:5180', 'Content-Type': 'application/json'}
        if token: headers['Authorization'] = 'Bearer ' + token
        req = urllib.request.Request(f'http://127.0.0.1:{http.server_port}' + path,
              data=None if body is None else json.dumps(body).encode(), headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response: return json.load(response)
    try:
        token = call('/session', {})['token']
        job = call('/jobs', request, token)
        deadline = time.monotonic() + 190
        while time.monotonic() < deadline:
            job = call('/jobs/' + job['id'], token=token)
            if job['status'] in module.TERMINAL: break
            time.sleep(.1)
        assert job['status'] == 'completed', job
        return job['result'], time.monotonic() - started, len(json.dumps(job['result']).encode())
    finally:
        http.shutdown(); http.server_close(); service.close(); thread.join(timeout=5)

output, elapsed, size = run_http() if args.http else run_engine()
permutation = output['data']['permutation']
assert permutation['requested'] == permutation['completed'] == 200, permutation
assert permutation['failed'] == 0 and len(permutation['distribution']) == 200
assert permutation['p'] == (1 + permutation['exceedances']) / 201
print(json.dumps({'mode': 'http' if args.http else 'engine', 'elapsedSeconds': round(elapsed, 3),
                  'resultBytes': size, 'estimatedFits': output['data']['options']['estimatedFits'],
                  'permutationsCompleted': permutation['completed'], 'p': permutation['p'],
                  'balancedAccuracy': output['data']['validation']['balancedAccuracy'],
                  'Q2_trainingPrevalence': output['data']['validation']['Q2_trainingPrevalence']}))
