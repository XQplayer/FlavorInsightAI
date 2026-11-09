"""Portable broker contracts for CI runners without the local Windows R runtime.

Real R execution remains covered by test_service.py on the configured local host.
"""

import unittest

from services.analysis.server import AnalysisService, validate_request
from services.analysis.tests.test_service import fixture


class PortableBrokerContractTest(unittest.TestCase):
    def test_rejects_invalid_matrix_and_method(self):
        request = {'dataset': fixture(), 'recipe': {}, 'analysis': {'method': 'pca'}}
        request['dataset']['matrix'][0][0] = 'not-a-number'
        with self.assertRaisesRegex(ValueError, 'MATRIX_VALUE'):
            validate_request(request)
        request['dataset'] = fixture()
        request['analysis']['method'] = 'eval'
        with self.assertRaisesRegex(ValueError, 'UNSUPPORTED_METHOD'):
            validate_request(request)

    def test_unavailable_r_runtime_fails_closed(self):
        service = AnalysisService(rscript='/nonexistent/flavor-rscript', max_running=0)
        try:
            self.assertFalse(service.capabilities['runtimeReady'])
            with self.assertRaisesRegex(ValueError, 'ENGINE_NOT_AVAILABLE'):
                service.submit({'dataset': fixture(), 'recipe': {}, 'analysis': {'method': 'pca'}})
        finally:
            service.close()

    def test_session_token_is_bound_to_origin(self):
        service = AnalysisService(rscript='/nonexistent/flavor-rscript', max_running=0)
        try:
            origin = 'http://127.0.0.1:5180'
            token = service.session(origin)
            self.assertTrue(service.authorized(token, origin))
            self.assertFalse(service.authorized(token, 'http://localhost:5180'))
        finally:
            service.close()


if __name__ == '__main__':
    unittest.main()
