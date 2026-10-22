"""Short-lived HTTP integration tests; public fixture and real R/ropls only."""
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
import subprocess
import urllib.request
import urllib.error

BASE = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('supervised_server', BASE / 'server.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)
R = 'D:/R-4.6.0/bin/Rscript.exe'
LIBS = 'E:/codex/Projects/FlavorThresholdDB/_local/analysis-r-library'

def request(permutations=1):
    data = json.loads((BASE / 'tests/fixtures/synthetic-3groups.json').read_text(encoding='utf-8'))
    return {'dataset': data, 'recipe': {'scale': {'method': 'uv'}},
            'analysis': {'method': 'plsda', 'outerFolds': 4, 'innerFolds': 3,
                         'predictiveComponents': [1], 'permutations': permutations, 'seed': 25}}

class SupervisedServiceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.service = server.AnalysisService(rscript=R, rlibs=LIBS, timeout=60)
        cls.http = server.create_server(cls.service, port=0)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.http.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown(); cls.http.server_close(); cls.service.close()

    def call(self, path, body=None, token=None, method=None):
        headers = {'Origin': 'http://127.0.0.1:5180', 'Content-Type': 'application/json'}
        if token: headers['Authorization'] = 'Bearer ' + token
        req = urllib.request.Request(self.url + path, data=None if body is None else json.dumps(body).encode(), headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            return error.code, json.load(error)

    def test_capabilities_are_probed_and_cached(self):
        _, health = self.call('/health')
        self.assertTrue(health['capabilities']['supervised'])
        self.assertIn('plsda', health['capabilities']['methods'])
        self.assertEqual(health['capabilities']['packages']['ropls'], '1.44.0')
        self.assertTrue(health['capabilities']['runtimeReady'])
        self.assertEqual(health['capabilities']['packages']['jsonlite'], '2.0.0')
        self.assertTrue(server.probe_runtime(R, LIBS)['supervised'])
        self.assertGreater(server.probe_runtime.cache_info().hits, 0)

    def test_unavailable_package_not_advertised_or_accepted(self):
        with tempfile.TemporaryDirectory(prefix='analysis-empty-r-library-') as empty:
            unavailable = server.AnalysisService(rscript=R, rlibs=empty, max_running=0)
            try:
                self.assertFalse(unavailable.capabilities['supervised'])
                self.assertFalse(unavailable.capabilities['runtimeReady'])
                self.assertNotIn('oplsda', unavailable.capabilities['methods'])
                with self.assertRaisesRegex(ValueError, 'ENGINE_NOT_AVAILABLE'):
                    unavailable.submit(request())
            finally: unavailable.close()

    def test_base_runtime_without_ropls_accepts_only_basic_jobs(self):
        # A capability-probe boundary double avoids uninstalling installed
        # packages. Scientific fitting/prediction/permutation tests are all real.
        output = subprocess.CompletedProcess([], 0, 'R:4.6.0\nJSONLITE:2.0.0\n', '')
        with patch.object(server.subprocess, 'run', return_value=output):
            basic = server.AnalysisService(rscript='public-test-base-only-runtime', max_running=0)
        try:
            self.assertTrue(basic.capabilities['runtimeReady'])
            self.assertFalse(basic.capabilities['supervised'])
            self.assertEqual(basic.capabilities['methods'], list(server.BASIC_METHODS))
            with self.assertRaisesRegex(ValueError, 'SUPERVISED_NOT_AVAILABLE'): basic.submit(request())
            req = request(); req['analysis'] = {'method': 'pca'}
            job = basic.submit(req)
            self.assertEqual(job['status'], 'queued')
        finally: basic.close()

    def test_missing_r_path_has_honest_health_and_rejects_jobs(self):
        unavailable = server.AnalysisService(rscript=str(BASE / 'nonexistent-public-test-Rscript.exe'), max_running=0)
        http = server.create_server(unavailable, port=0)
        thread = threading.Thread(target=http.serve_forever, daemon=True); thread.start()
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{http.server_port}/health', timeout=5) as response:
                health = json.load(response)
            self.assertFalse(health['capabilities']['runtimeReady'])
            self.assertEqual(health['capabilities']['methods'], [])
            req = request(); req['analysis'] = {'method': 'pca'}
            with self.assertRaisesRegex(ValueError, 'ENGINE_NOT_AVAILABLE'):
                unavailable.submit(req)
        finally:
            http.shutdown(); http.server_close(); unavailable.close(); thread.join(timeout=5)

    def test_real_pls_job_and_singleton_response_arrays(self):
        _, session = self.call('/session', {})
        token = session['token']
        req = request()
        req['analysis']['groups'] = ['control', 'treatment-A']
        # Select the actual first two class names rather than assume fixture labels.
        req['analysis']['groups'] = list(dict.fromkeys(s['group'] for s in req['dataset']['samples']))[:2]
        code, job = self.call('/jobs', req, token)
        self.assertEqual(code, 202, job)
        deadline = time.monotonic() + 50
        while time.monotonic() < deadline:
            _, job = self.call('/jobs/' + job['id'], token=token)
            if job['status'] in server.TERMINAL: break
            time.sleep(.05)
        self.assertEqual(job['status'], 'completed', job)
        result = job['result']
        self.assertEqual(result['method'], 'plsda')
        self.assertEqual(result['provenance']['packages']['ropls'], '1.44.0')
        prediction = result['data']['validation']['predictions'][0]
        for key in ('response', 'trueResponse', 'trainingPrevalence'):
            self.assertIsInstance(prediction[key], list)
            self.assertEqual(len(prediction[key]), 1)
        for key in ('distribution', 'seeds'):
            self.assertIsInstance(result['data']['permutation'][key], list)
        self.assertIsInstance(result['data']['fullFit']['scores'][0], list)
        self.assertIsInstance(result['data']['responseClassOrder'], list)
        self.assertEqual(result['preprocessing']['state']['recipe']['impute']['value'], 0)

    def test_cancel_real_supervised_owned_process(self):
        _, session = self.call('/session', {}); token = session['token']
        code, job = self.call('/jobs', request(1000), token)
        self.assertEqual(code, 202, job)
        process = None
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            process = self.service.processes.get(job['id'])
            if process: break
            time.sleep(.02)
        self.assertIsNotNone(process, 'owned R process never launched')
        _, cancelled = self.call('/jobs/' + job['id'], token=token, method='DELETE')
        self.assertEqual(cancelled['status'], 'cancelled')
        deadline = time.monotonic() + 10
        while job['id'] in self.service.active and time.monotonic() < deadline: time.sleep(.02)
        self.assertIsNotNone(process.poll())
        self.assertNotIn(job['id'], self.service.processes)

if __name__ == '__main__': unittest.main()
