import test from 'node:test';
import assert from 'node:assert/strict';
import reference from './browserPca.reference.json' with { type: 'json' };
import { runBrowserPca } from './browserPca.mjs';

const near = (actual, expected, tol = 1e-8) => assert.ok(Math.abs(actual - expected) <= tol, `${actual} differs from ${expected}`);
const copy = () => structuredClone(reference.dataset);

test('browser SVD agrees with independent base::prcomp for center, UV and Pareto', () => {
  for (const mode of ['none', 'uv', 'pareto', 'none_uncentered']) {
    const scale = mode === 'none_uncentered' ? 'none' : mode;
    const result = runBrowserPca({ dataset: copy(), options: { scale, center: mode !== 'none_uncentered', components: 3 } });
    const expected = reference.expected[mode];
    assert.equal(result.provenance.algorithm, 'svd');
    assert.equal(result.data.scores.length, 6);
    assert.equal(result.data.loadings.length, 3);
    for (const key of ['eigenvalues', 'explained', 'cumulative']) expected[key].forEach((value, i) => near(result.data[key][i], value));
    expected.means.forEach((v, i) => near(result.preprocessing.means[i], v));
    expected.divisors.forEach((v, i) => near(result.preprocessing.divisors[i], v));
    for (let j = 0; j < 3; j++) {
      const sign = Math.sign(result.data.loadings[0][j] * expected.loadings[0][j]) || 1;
      for (let i = 0; i < 6; i++) near(result.data.scores[i][j] * sign, expected.scores[i][j]);
      for (let i = 0; i < 3; i++) near(result.data.loadings[i][j] * sign, expected.loadings[i][j]);
    }
  }
});

test('source stays immutable and missing policies are explicit with lineage', () => {
  const dataset = copy();
  dataset.matrix[1][0] = null;
  const before = structuredClone(dataset);
  assert.throws(() => runBrowserPca({ dataset }), /MISSING_VALUES/);
  const filled = runBrowserPca({ dataset, options: { missing: 'mean' } });
  assert.deepEqual(dataset, before);
  assert.deepEqual(filled.preprocessing.imputed, [{ sampleId: 'synthetic-s2', featureId: 'synthetic-f1', method: 'mean', value: 6.4 }]);
  const dropped = runBrowserPca({ dataset, options: { missing: 'drop-samples' } });
  assert.deepEqual(dropped.preprocessing.droppedSamples, ['synthetic-s2']);
  assert.equal(dropped.data.scores.length, 5);
  const droppedFeature = runBrowserPca({ dataset, options: { missing: 'drop-features' } });
  assert.deepEqual(droppedFeature.preprocessing.droppedFeatures, ['synthetic-f1']);
  assert.equal(droppedFeature.data.loadings.length, 2);
});

test('constant features and QC-filtered values cannot silently enter PCA', () => {
  const dataset = copy();
  dataset.matrix.forEach(row => row[2] = 7);
  assert.throws(() => runBrowserPca({ dataset }), /CONSTANT_FEATURE/);
  const dropped = runBrowserPca({ dataset, options: { constant: 'drop' } });
  assert.deepEqual(dropped.preprocessing.droppedFeatures, ['synthetic-f3']);
  dataset.quality = { cellStates: dataset.matrix.map(row => row.map(() => 'observed')) };
  dataset.quality.cellStates[0][0] = 'qc-filtered';
  assert.throws(() => runBrowserPca({ dataset, options: { constant: 'drop', missing: 'mean' } }), /QC_FILTERED/);
});

test('rank, component and matrix limits fail explicitly', () => {
  const dataset = copy();
  assert.throws(() => runBrowserPca({ dataset, options: { components: 4 } }), /PCA_COMPONENTS/);
  assert.throws(() => runBrowserPca({ dataset, options: { scale: 'invalid' } }), /PCA_OPTIONS/);
  dataset.matrix = dataset.matrix.map((_, i) => [i + 1, 2 * (i + 1), 3 * (i + 1)]);
  const rankOne = runBrowserPca({ dataset });
  assert.equal(rankOne.data.rank, 1);
  assert.equal(rankOne.data.scores[0].length, 1);
  assert.throws(() => runBrowserPca({ dataset, options: { components: 2 } }), /PCA_COMPONENTS/);
  assert.throws(() => runBrowserPca({ dataset: copy(), limits: { maxSamples: 5 } }), /MATRIX_LIMIT/);
});

test('input shape, nonfinite and all-missing features fail safely', () => {
  const dataset = copy();
  dataset.matrix[0].pop();
  assert.throws(() => runBrowserPca({ dataset }), /MATRIX_DIMENSIONS/);
  const invalid = copy(); invalid.matrix[1][1] = Infinity;
  assert.throws(() => runBrowserPca({ dataset: invalid }), /MATRIX_VALUE/);
  const allMissing = copy(); allMissing.matrix.forEach(row => row[0] = null);
  assert.throws(() => runBrowserPca({ dataset: allMissing, options: { missing: 'mean' } }), /ALL_MISSING_FEATURE/);
});
