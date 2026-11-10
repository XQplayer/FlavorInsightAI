"""Local-only synthetic hosted-coordinator integration with the actual R engine.

Run with ANALYSIS_RSCRIPT and R_LIBS_USER. This test does not touch Supabase.
"""

import os
import time
import unittest

from services.ai_tools import Principal
from services.analysis.hosted import HostedPca
from services.analysis.server import AnalysisService
from services.analysis.tests.test_hosted import FakeStore, payload


@unittest.skipUnless(os.environ.get('ANALYSIS_RSCRIPT'), 'Local Rscript is required')
class HostedRealRTest(unittest.TestCase):
    def test_synthetic_confirmed_pca_is_persisted_with_real_r_result(self):
        broker = AnalysisService(rscript=os.environ['ANALYSIS_RSCRIPT'], rlibs=os.environ.get('R_LIBS_USER'),
                                 max_running=1, max_queued=2, timeout=30)
        try:
            self.assertTrue(broker.capabilities['runtimeReady'])
            store = FakeStore()
            hosted = HostedPca(store, broker)
            principal = Principal('user-a', token='synthetic-jwt')
            request = payload()
            created = hosted.submit(principal, request)
            for _ in range(200):
                current = hosted.get(principal, created['id'])
                if current['status'] in {'completed', 'failed', 'cancelled', 'interrupted'}: break
                time.sleep(.05)
            self.assertEqual(current['status'], 'completed', current)
            self.assertEqual(current['result_json']['method'], 'pca')
            self.assertEqual(current['result_json']['provenance']['datasetId'], 'public-synthetic')
            self.assertEqual(len(current['result_json']['data']['scores']), 6)
            self.assertEqual(len(current['result_json']['data']['loadings']), 2)
            self.assertEqual(len(current['result_json']['data']['explained']), 2)
            self.assertEqual(hosted.submit(principal, request)['id'], created['id'])
            self.assertIsNone(hosted.get(Principal('user-b', token='other-synthetic-jwt'), created['id']))
        finally:
            broker.close()
