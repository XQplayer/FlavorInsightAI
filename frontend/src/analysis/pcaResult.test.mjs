import test from 'node:test';
import assert from 'node:assert/strict';
import reference from './browserPca.reference.json' with { type: 'json' };
import { runBrowserPca } from './browserPca.mjs';
import { toUnifiedPcaResult, validateUnifiedPcaResult } from './pcaResult.mjs';

const fixture = () => {
  const dataset = structuredClone(reference.dataset);
  const result = runBrowserPca({ dataset, options: { scale: 'uv', components: 2 } });
  result.provenance.runId = 'synthetic-run-1';
  result.provenance.completedAt = '2026-11-10T00:00:00.000Z';
  return { dataset, result };
};

test('unified PCA envelope retains scientific numbers, settings and source metadata without a raw matrix', () => {
  const { dataset, result } = fixture();
  dataset.provenance.sourceSha256 = 'a'.repeat(64);
  dataset.provenance.sourceFileName = 'synthetic.csv';
  const envelope = toUnifiedPcaResult(result, dataset);
  assert.equal(envelope.schema_version, 'flavor-pca-result/1');
  assert.equal(envelope.engine, 'browser-pca');
  assert.equal(envelope.algorithm, 'pca-svd');
  assert.equal(envelope.engine_version, '1.0.0');
  assert.equal(envelope.dataset_metadata.source_sha256, 'a'.repeat(64));
  assert.deepEqual(envelope.scores.values, result.data.scores);
  assert.deepEqual(envelope.loadings.values, result.data.loadings);
  assert.deepEqual(envelope.eigenvalues, result.data.eigenvalues);
  assert.deepEqual(envelope.explained_variance, result.data.explained);
  assert.deepEqual(envelope.preprocessing.divisors, result.preprocessing.divisors);
  assert.equal(envelope.parameters.scale, 'uv');
  assert.equal(envelope.provenance.run_id, 'synthetic-run-1');
  assert.equal(envelope.provenance.execution_environment, 'web-worker');
  assert.equal(envelope.dataset_metadata.synthetic, true);
  assert.equal('matrix' in envelope.dataset_metadata, false);
  assert.equal(JSON.stringify(envelope).includes('undefined'), false);
  assert.deepEqual(validateUnifiedPcaResult(JSON.parse(JSON.stringify(envelope))), envelope);
});

test('unknown source hash stays null and malformed numerical output fails', () => {
  const { dataset, result } = fixture();
  const envelope = toUnifiedPcaResult(result, dataset);
  assert.equal(envelope.dataset_metadata.source_sha256, null);
  const bad = structuredClone(envelope);
  bad.scores.values[0][0] = Number.NaN;
  assert.throws(() => validateUnifiedPcaResult(bad), /PCA_RESULT_INVALID/);
  bad.scores.values[0][0] = 1;
  bad.loadings.values.pop();
  assert.throws(() => validateUnifiedPcaResult(bad), /PCA_RESULT_INVALID/);
  const nested = structuredClone(envelope);
  nested.preprocessing.imputed.push({ sampleId: 'synthetic-s1', featureId: 'synthetic-f1', method: 'mean', value: Number.NaN });
  assert.throws(() => validateUnifiedPcaResult(nested), /PCA_RESULT_INVALID/);
  const inconsistent = structuredClone(envelope);
  inconsistent.explained_variance[0] -= 0.1;
  inconsistent.explained_variance[1] += 0.1;
  inconsistent.cumulative_variance[0] = inconsistent.explained_variance[0];
  assert.throws(() => validateUnifiedPcaResult(inconsistent), /PCA_RESULT_INVALID/);
  const mismatch = structuredClone(result);
  mismatch.provenance.datasetId = 'other';
  assert.throws(() => toUnifiedPcaResult(mismatch, dataset), /DATASET_MISMATCH/);
});

test('hosted envelope may use the same structure while retaining its own runtime provenance', () => {
  const { dataset, result } = fixture();
  const hosted = toUnifiedPcaResult(result, dataset);
  hosted.engine = 'hosted-pca';
  hosted.engine_version = 'future-hosted-1';
  hosted.provenance.execution_environment = 'remote-service';
  assert.deepEqual(validateUnifiedPcaResult(hosted), hosted);
});
