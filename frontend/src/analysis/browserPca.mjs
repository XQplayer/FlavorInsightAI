import { Matrix, SingularValueDecomposition } from 'ml-matrix';

export const BROWSER_PCA_VERSION = '1.0.0';
export const BROWSER_PCA_LIMITS = Object.freeze({ maxSamples: 2000, maxFeatures: 256, maxCells: 200000 });
const fail = code => { throw new Error(code); };
const finite = value => typeof value === 'number' && Number.isFinite(value);

/** Pure, synchronous scientific core. Execute in browserPca.worker.mjs, never on the UI thread. */
export function runBrowserPca({ dataset, options = {}, limits = BROWSER_PCA_LIMITS }) {
  const settings = { missing: 'error', constant: 'error', center: true, scale: 'none', components: null, includeInternalStandards: false, ...options };
  if (!['error', 'mean', 'median', 'drop-samples', 'drop-features'].includes(settings.missing)
    || !['error', 'drop'].includes(settings.constant)
    || !['none', 'uv', 'pareto'].includes(settings.scale)
    || typeof settings.center !== 'boolean'
    || typeof settings.includeInternalStandards !== 'boolean'
    || (!settings.center && settings.scale !== 'none')
    || (settings.components !== null && (!Number.isInteger(settings.components) || settings.components < 1))) fail('PCA_OPTIONS');
  if (!dataset || !Array.isArray(dataset.samples) || !Array.isArray(dataset.features)
    || !Array.isArray(dataset.matrix) || dataset.matrix.length !== dataset.samples.length
    || dataset.matrix.some(row => !Array.isArray(row) || row.length !== dataset.features.length)) fail('MATRIX_DIMENSIONS');
  for (const items of [dataset.samples, dataset.features]) {
    const ids = items.map(item => item?.id);
    if (ids.some(id => typeof id !== 'string' || !id.trim()) || new Set(ids).size !== ids.length) fail('DUPLICATE_OR_MISSING_ID');
  }
  if (dataset.matrix.some(row => row.some(v => v !== null && !finite(v)))) fail('MATRIX_VALUE');
  const selectedRows = dataset.samples.map((sample, index) => sample.include === false ? -1 : index).filter(index => index >= 0);
  const selectedColumns = dataset.features.map((feature, index) => feature.isInternalStandard && !settings.includeInternalStandards ? -1 : index).filter(index => index >= 0);
  if (selectedRows.length < 2 || selectedColumns.length < 1) fail('PCA_DIMENSIONS');
  if (selectedRows.length > limits.maxSamples || selectedColumns.length > limits.maxFeatures || selectedRows.length * selectedColumns.length > limits.maxCells) fail('MATRIX_LIMIT');
  const inputCellStates = {};
  for (const i of selectedRows) for (const j of selectedColumns) {
    const state = dataset.quality?.cellStates?.[i]?.[j] ?? 'unspecified';
    if (!['observed', 'original-imputed', 'qc-filtered', 'missing', 'unknown', 'unspecified'].includes(state)) fail('QUALITY_VALUE');
    inputCellStates[state] = (inputCellStates[state] ?? 0) + 1;
  }
  for (const i of selectedRows) for (const j of selectedColumns) if (dataset.quality?.cellStates?.[i]?.[j] === 'qc-filtered' || dataset.quality?.qcFilteredMask?.[i]?.[j] === true) fail('QC_FILTERED');
  let rowIndices = [...selectedRows], columnIndices = [...selectedColumns];
  const droppedSamples = [], droppedFeatures = [], imputed = [];
  if (settings.missing === 'drop-samples') {
    rowIndices = selectedRows.filter(i => {
      if (selectedColumns.some(j => dataset.matrix[i][j] === null)) { droppedSamples.push(dataset.samples[i].id); return false; }
      return true;
    });
  } else if (settings.missing === 'drop-features') {
    columnIndices = selectedColumns.filter(j => {
      if (selectedRows.some(i => dataset.matrix[i][j] === null)) { droppedFeatures.push(dataset.features[j].id); return false; }
      return true;
    });
  }
  if (rowIndices.length < 2 || columnIndices.length < 1) fail('PCA_DIMENSIONS');
  const matrix = rowIndices.map(i => columnIndices.map(j => dataset.matrix[i][j]));
  if (matrix.some(row => row.includes(null))) {
    if (settings.missing === 'error') fail('MISSING_VALUES');
    if (!['mean', 'median'].includes(settings.missing)) fail('MISSING_VALUES');
    for (let j = 0; j < columnIndices.length; j++) {
      const observed = matrix.map(row => row[j]).filter(finite).sort((a, b) => a - b);
      if (!observed.length) fail('ALL_MISSING_FEATURE');
      const fill = settings.missing === 'mean'
        ? observed.reduce((sum, value) => sum + value, 0) / observed.length
        : observed.length % 2 ? observed[(observed.length - 1) / 2] : (observed[observed.length / 2 - 1] + observed[observed.length / 2]) / 2;
      if (!finite(fill)) fail('NONFINITE_PREPROCESSING');
      matrix.forEach((row, i) => { if (row[j] === null) { row[j] = fill; imputed.push({ sampleId: dataset.samples[rowIndices[i]].id, featureId: dataset.features[columnIndices[j]].id, method: settings.missing, value: fill }); } });
    }
  }
  const stats = () => columnIndices.map((_, j) => {
    const values = matrix.map(row => row[j]);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const sd = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
    if (!finite(mean) || !finite(sd)) fail('NONFINITE_PREPROCESSING');
    return { mean, sd, largest: Math.max(...values.map(Math.abs)) };
  });
  let columns = stats();
  const constant = columns.map((s, j) => s.sd <= Number.EPSILON * Math.max(1, rowIndices.length, columnIndices.length) * s.largest ? j : -1).filter(j => j >= 0);
  if (constant.length) {
    if (settings.constant === 'error') fail('CONSTANT_FEATURE');
    for (const j of constant) droppedFeatures.push(dataset.features[columnIndices[j]].id);
    const keep = columnIndices.map((_, j) => j).filter(j => !constant.includes(j));
    columnIndices = keep.map(j => columnIndices[j]);
    for (const row of matrix) { const kept = keep.map(j => row[j]); row.splice(0, row.length, ...kept); }
    if (!columnIndices.length) fail('PCA_ZERO_RANK');
    columns = stats();
  }
  const means = columns.map(s => s.mean), sampleSd = columns.map(s => s.sd);
  const divisors = columns.map(s => settings.scale === 'uv' ? s.sd : settings.scale === 'pareto' ? Math.sqrt(s.sd) : 1);
  const processed = matrix.map(row => row.map((value, j) => (value - (settings.center ? means[j] : 0)) / divisors[j]));
  if (processed.some(row => row.some(v => !finite(v)))) fail('NONFINITE_PREPROCESSING');
  const svd = new SingularValueDecomposition(new Matrix(processed), { autoTranspose: true });
  const singular = svd.diagonal.slice(0, Math.min(rowIndices.length, columnIndices.length));
  const tolerance = Math.max(rowIndices.length, columnIndices.length) * Number.EPSILON * singular[0];
  const rank = singular.filter(value => value > tolerance).length;
  if (!rank) fail('PCA_ZERO_RANK');
  if (settings.components !== null && settings.components > rank) fail('PCA_COMPONENTS');
  const count = settings.components ?? rank;
  const eigenvalues = singular.map(value => value ** 2 / (rowIndices.length - 1));
  const total = eigenvalues.reduce((sum, value) => sum + value, 0);
  if (!finite(total) || total <= 0) fail('PCA_ZERO_RANK');
  const explained = eigenvalues.map(value => value / total);
  let running = 0;
  const cumulative = explained.map(value => (running += value));
  const loadings = columnIndices.map((_, j) => Array.from({ length: count }, (_, k) => svd.rightSingularVectors.get(j, k)));
  const scores = processed.map(row => Array.from({ length: count }, (_, k) => row.reduce((sum, value, j) => sum + value * loadings[j][k], 0)));
  return {
    schemaVersion: 1, method: 'pca', engine: 'browser-pca',
    data: { scores, loadings, eigenvalues, explained, cumulative, rank, sampleIds: rowIndices.map(i => dataset.samples[i].id), featureIds: columnIndices.map(i => dataset.features[i].id) },
    preprocessing: { ...settings, means, sampleSd, divisors, droppedSamples, droppedFeatures, imputed, inputCellStates,
      excludedSamples: dataset.samples.filter(s => s.include === false).map(s => s.id),
      excludedInternalStandards: dataset.features.filter(f => f.isInternalStandard && !settings.includeInternalStandards).map(f => f.id) },
    provenance: { algorithm: 'svd', algorithmVersion: BROWSER_PCA_VERSION, library: 'ml-matrix@6.15.1', datasetId: dataset.id,
      source: dataset.provenance ?? {}, matrixOrientation: 'samples x features', sampleCount: rowIndices.length, featureCount: columnIndices.length,
      exploratoryOnly: true }
  };
}
