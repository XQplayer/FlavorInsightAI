import test from 'node:test';
import assert from 'node:assert/strict';
import reference from './browserPca.reference.json' with { type: 'json' };
import { runBrowserPca } from './browserPca.mjs';
import { createBrowserPcaArchive, validateBrowserPcaArchive } from './browserPcaArchive.mjs';

const fixture = () => {
  const dataset = structuredClone(reference.dataset);
  const result = runBrowserPca({ dataset, options: { scale: 'uv', components: 2 } });
  result.provenance.runId = crypto.randomUUID();
  result.provenance.completedAt = new Date().toISOString();
  return { dataset, result };
};

test('archive preserves a synthetic snapshot, source lineage, options, plot and validated result', async () => {
  const { dataset, result } = fixture();
  const archive = await createBrowserPcaArchive({ dataset, result, options: { scale: 'uv', components: 2 }, plot: { view: 'scores' } });
  assert.equal(archive.archive_version, 'flavor-browser-pca-archive/1');
  assert.equal(archive.dataset.matrix.length, dataset.matrix.length);
  assert.equal(archive.result.schema_version, 'flavor-pca-result/1');
  assert.equal(archive.result.provenance.run_id, result.provenance.runId);
  assert.equal(archive.result.engine_version, result.provenance.algorithmVersion);
  assert.deepEqual((await validateBrowserPcaArchive(JSON.parse(JSON.stringify(archive)))).dataset.matrix, dataset.matrix);
  const tampered = structuredClone(archive);
  tampered.dataset.matrix[0][0] += 1;
  await assert.rejects(validateBrowserPcaArchive(tampered), /PCA_ARCHIVE_HASH_MISMATCH/);
  const wrongVersion = { ...archive, archive_version: 'future/2' };
  await assert.rejects(validateBrowserPcaArchive(wrongVersion), /PCA_ARCHIVE_VERSION/);
});

test('invalid numeric result cannot be archived or restored', async () => {
  const { dataset, result } = fixture();
  result.data.scores[0][0] = Number.NaN;
  await assert.rejects(createBrowserPcaArchive({ dataset, result, options: {}, plot: {} }), /PCA_RESULT_INVALID/);
});
