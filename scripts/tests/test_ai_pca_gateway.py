import io
import json
import unittest

from services.ai_gateway import AIGateway, GatewayError
from services.ai_conversation_store import ConversationStoreError
from services.ai_tools import Principal


OWNER = Principal('11111111-1111-4111-8111-111111111111', token='test')
INSPECTION = {'dataset_id': 'synthetic-r-prcomp-6x3-v1', 'samples': 6, 'features': 3,
              'missing_cells': 0, 'constant_variables': 0, 'all_missing_variables': 0,
              'qc_filtered_cells': 0, 'source_sha256': None, 'synthetic': True, 'warning_codes': []}


class BrowserPcaGatewayTests(unittest.TestCase):
    def test_mock_plan_is_labelled_and_contains_no_calculation(self):
        gateway = AIGateway(mode='mock')
        response = gateway.analysis_plan(OWNER, {'goal': 'explore groups', 'inspection': INSPECTION})
        self.assertEqual(response['mode'], 'mock')
        self.assertEqual(response['plan']['schema_version'], 'flavor-pca-plan/1')
        self.assertEqual(response['plan']['dataset_id'], INSPECTION['dataset_id'])
        self.assertNotIn('scores', response)
        self.assertTrue(response['requires_user_confirmation'])

    def test_raw_matrix_and_identity_override_are_rejected(self):
        gateway = AIGateway(mode='mock')
        with self.assertRaises(GatewayError):
            gateway.analysis_plan(OWNER, {'goal': 'x', 'inspection': {**INSPECTION, 'matrix': [[1, 2]]}})
        with self.assertRaises(GatewayError):
            gateway.analysis_plan(OWNER, {'goal': 'x', 'inspection': INSPECTION, 'user_id': 'other'})

    def test_live_plan_uses_server_key_and_rejects_mismatched_model_plan(self):
        calls = []
        def open_url(request, timeout):
            calls.append(json.loads(request.data))
            output = json.dumps({'schema_version': 'flavor-pca-plan/1', 'algorithm': 'pca', 'dataset_id': 'other',
                                 'options': {'missing': 'error', 'constant': 'error', 'center': True, 'scale': 'none',
                                             'components': None, 'includeInternalStandards': False}})
            return io.BytesIO(json.dumps({'status': 'completed', 'output': [{'type': 'message', 'content': [{'type': 'output_text', 'text': output}]}],
                                           'usage': {'input_tokens': 10, 'output_tokens': 15}}).encode())
        gateway = AIGateway(mode='openai', model='test-model', api_key='server-secret', open_url=open_url)
        with self.assertRaises(GatewayError) as error:
            gateway.analysis_plan(OWNER, {'goal': 'explore', 'inspection': INSPECTION})
        self.assertEqual(error.exception.code, 'PCA_PLAN_INVALID')
        self.assertEqual(calls[0]['store'], False)
        self.assertEqual(calls[0]['text']['format']['type'], 'json_schema')
        self.assertNotIn('server-secret', json.dumps(calls))

    def test_explanation_rejects_forged_extra_values(self):
        gateway = AIGateway(mode='mock')
        facts = {'source': 'client-validated-browser-pca-result', 'schema_version': 'flavor-pca-result/1',
                 'run_id': 'run-1', 'dataset_id': 'dataset-1', 'samples': 6, 'features': 3,
                 'parameters': {'missing': 'error', 'constant': 'error', 'center': True, 'scale': 'none',
                                'components': 2, 'include_internal_standards': False},
                 'explained_variance': [0.7, 0.3], 'warning_codes': [], 'exploratory_only': True,
                 'note': 'No significance test, OAV or causal inference was computed.'}
        with self.assertRaises(GatewayError):
            gateway.analysis_explain(OWNER, {'facts': {**facts, 'matrix': [[1]]}, 'language': 'zh'})
        with self.assertRaises(GatewayError):
            gateway.analysis_explain(OWNER, {'facts': {**facts, 'source': 'verified-browser-pca-result'}, 'language': 'zh'})
        result = gateway.analysis_explain(OWNER, {'facts': facts, 'language': 'zh'})
        self.assertEqual(result['mode'], 'mock')
        self.assertIn('非 GPT', result['explanation'])
        english = gateway.analysis_explain(OWNER, {'facts': facts, 'language': 'en'})
        self.assertIn('not GPT', english['explanation'])

    def test_analysis_link_requires_store_and_verified_owner(self):
        facts = {'source': 'client-validated-browser-pca-result', 'schema_version': 'flavor-pca-result/1',
                 'run_id': 'run-1', 'dataset_id': 'dataset-1', 'samples': 6, 'features': 3,
                 'parameters': {'missing': 'error', 'constant': 'error', 'center': True, 'scale': 'none',
                                'components': 2, 'include_internal_standards': False},
                 'explained_variance': [0.7, 0.3], 'warning_codes': [], 'exploratory_only': True,
                 'note': 'No significance test, OAV or causal inference was computed.'}
        with self.assertRaises(GatewayError) as unavailable:
            AIGateway(mode='mock').link_analysis(OWNER, 'session-1', facts)
        self.assertEqual(unavailable.exception.code, 'HISTORY_UNAVAILABLE')
        called = []
        class Store:
            def link_analysis(self, owner, session, summary):
                called.append((owner, session, summary))
                if session != 'owned-session':
                    raise ConversationStoreError('NOT_FOUND', 404)
                return {'analysis_id': summary['dataset_id'], 'result_id': summary['run_id']}
        gateway = AIGateway(mode='mock', conversation_store=Store())
        with self.assertRaises(GatewayError) as invalid:
            gateway.link_analysis(OWNER, 'owned-session', {**facts, 'matrix': [[1]]})
        self.assertEqual(invalid.exception.code, 'PCA_FACTS_INVALID')
        self.assertEqual(called, [])
        with self.assertRaises(GatewayError) as denied:
            gateway.link_analysis(OWNER, 'foreign-session', facts)
        self.assertEqual(denied.exception.status, 404)
        result = gateway.link_analysis(OWNER, 'owned-session', facts)
        self.assertEqual(result, {'analysis_id': 'dataset-1', 'result_id': 'run-1'})
        self.assertEqual(called[-1][0], OWNER.user_id)

    def test_followup_model_receives_only_bounded_linked_result_summary(self):
        facts = {'source': 'client-validated-browser-pca-result', 'schema_version': 'flavor-pca-result/1',
                 'run_id': 'run-1', 'dataset_id': 'dataset-1', 'samples': 6, 'features': 3,
                 'parameters': {'missing': 'error', 'constant': 'error', 'center': True, 'scale': 'none',
                                'components': 2, 'include_internal_standards': False},
                 'explained_variance': [0.7, 0.3], 'warning_codes': [], 'exploratory_only': True,
                 'note': 'No significance test, OAV or causal inference was computed.'}
        class Store:
            def get(self, owner, session):
                return {'id': session, 'user_id': owner, 'messages': [], 'context_summary': '',
                        'analysis_links': [{'analysis_id': 'dataset-1', 'result_id': 'run-1',
                                            'provenance': 'client-validated-browser-pca-summary', 'summary': facts}]}
            def begin_turn(self, *args): return 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
            def finish_turn(self, *args, **kwargs): pass
            def interrupt_turn(self, *args): pass
        captured = []
        def fake_open(request, timeout):
            captured.append(json.loads(request.data))
            payload = [{'type': 'response.output_text.delta', 'delta': 'PC1 explains 70% of client-reported variance.'},
                       {'type': 'response.completed', 'response': {'output': [], 'usage': {'input_tokens': 50, 'output_tokens': 8}}}]
            return io.BytesIO(''.join('data: ' + json.dumps(item) + '\n\n' for item in payload).encode())
        gateway = AIGateway(mode='openai', model='synthetic-model', api_key='synthetic-key',
                            conversation_store=Store(), open_url=fake_open)
        list(gateway.chat(OWNER, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Explain PC1'))
        content = json.dumps(captured[0]['input'])
        self.assertIn('run-1', content)
        self.assertIn('client validated, not server recomputed', content)
        self.assertNotIn('matrix', content)


if __name__ == '__main__':
    unittest.main()
