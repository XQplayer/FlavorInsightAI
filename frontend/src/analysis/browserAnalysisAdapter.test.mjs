import test from 'node:test';
import assert from 'node:assert/strict';
import reference from './browserPca.reference.json' with { type: 'json' };
import { runBrowserPca } from './browserPca.mjs';
import { createBrowserAnalysisAdapter } from './browserAnalysisAdapter.mjs';

const dataset = () => structuredClone(reference.dataset);
const make = (engine = { run: async request => runBrowserPca(request) }) => createBrowserAnalysisAdapter({
  engine, uuid: () => 'test-id', now: () => '2026-11-10T00:00:00.000Z'
});
const plan = data => ({ schema_version: 'flavor-pca-plan/1', algorithm: 'pca', dataset_id: data.id,
  options: { missing: 'error', constant: 'error', center: true, scale: 'uv', components: 2, includeInternalStandards: false } });

test('inspection and recommendation disclose metadata and warnings but no PCA result or raw matrix', () => {
  const adapter = make();
  const source = dataset(); source.matrix[0][0] = null;
  const inspection = adapter.inspect_dataset(source);
  assert.equal(inspection.samples, 6);
  assert.equal(inspection.features, 3);
  assert.equal(inspection.missing_cells, 1);
  assert.equal(inspection.qc_filtered_cells, 0);
  assert.equal(JSON.stringify(inspection).includes('matrix'), false);
  const recommendation = adapter.recommend_analysis(source);
  assert.equal(recommendation.candidate, 'pca');
  assert.equal(recommendation.requires_gateway_plan, true);
  assert.equal(recommendation.requires_user_confirmation, true);
  assert.ok(recommendation.warning_codes.includes('MISSING_VALUES_PRESENT'));
});

test('inspection flags constant and QC-filtered data before suggesting a run', () => {
  const adapter = make();
  const source = dataset();
  source.matrix.forEach(row => { row[1] = 9; });
  source.quality = { cellStates: source.matrix.map(row => row.map(() => 'observed')) };
  source.quality.cellStates[0][0] = 'qc-filtered';
  const inspection = adapter.inspect_dataset(source);
  assert.equal(inspection.constant_variables, 1);
  assert.equal(inspection.qc_filtered_cells, 1);
  assert.ok(inspection.warning_codes.includes('CONSTANT_VARIABLES_PRESENT'));
  assert.ok(inspection.warning_codes.includes('QC_FILTERED_VALUES'));
  assert.equal(adapter.recommend_analysis(source).candidate, null);
});

test('model plan cannot run a Worker before an explicit UI confirmation', async () => {
  let calls = 0;
  const adapter = make({ run: async request => { calls++; return runBrowserPca(request); } });
  const source = dataset();
  const prepared = adapter.prepare_pca(source, plan(source));
  assert.equal(prepared.requires_user_confirmation, true);
  await assert.rejects(adapter.run_browser_pca({ plan_id: prepared.plan_id }), /PCA_CONFIRMATION_REQUIRED/);
  assert.equal(calls, 0);
  assert.throws(() => adapter.prepare_pca(source, { ...plan(source), approved: true }), /PCA_PLAN_INVALID/);
  assert.throws(() => adapter.prepare_pca(source, { ...plan(source), dataset_id: 'other' }), /DATASET_MISMATCH/);
  adapter.confirm_pca(prepared.plan_id);
  const completed = await adapter.run_browser_pca({ plan_id: prepared.plan_id });
  assert.equal(calls, 1);
  assert.equal(completed.engine, 'browser-pca');
  assert.equal(completed.scores.values.length, 6);
  assert.equal(completed.provenance.run_id, 'test-id');
  await assert.rejects(adapter.run_browser_pca({ plan_id: prepared.plan_id }), /PCA_ALREADY_RUN/);
  assert.deepEqual(adapter.get_browser_pca_result('test-id'), completed);
  assert.throws(() => adapter.explain_pca_result('test-id', { share_with_gateway: true }), /PCA_SHARE_CONFIRMATION_REQUIRED/);
  adapter.confirm_explanation('test-id');
  const facts = adapter.explain_pca_result('test-id');
  assert.equal(facts.source, 'verified-browser-pca-result');
  assert.equal(facts.explained_variance.length, 2);
  assert.equal('scores' in facts, false);
  assert.throws(() => adapter.explain_pca_result('test-id'), /PCA_SHARE_CONFIRMATION_REQUIRED/);
});

test('cancellation produces no success result; replacement invalidates a prepared plan', async () => {
  const controller = new AbortController();
  const adapter = make({ run: async (_request, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('PCA_CANCELLED')), { once: true });
  }) });
  const source = dataset();
  const prepared = adapter.prepare_pca(source, plan(source));
  adapter.confirm_pca(prepared.plan_id);
  const pending = adapter.run_browser_pca({ plan_id: prepared.plan_id, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, /PCA_CANCELLED/);
  assert.throws(() => adapter.get_browser_pca_result('test-id'), /PCA_RESULT_NOT_FOUND/);
  const next = adapter.prepare_pca(source, plan(source));
  adapter.prepare_pca(source, plan(source));
  assert.throws(() => adapter.confirm_pca(next.plan_id), /PCA_PLAN_NOT_FOUND/);
});
