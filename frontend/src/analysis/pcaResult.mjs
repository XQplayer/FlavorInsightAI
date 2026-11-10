/** Shared wire format for browser and future hosted PCA. Values remain fractions, not percentages. */
export const PCA_RESULT_SCHEMA = 'flavor-pca-result/1';
const invalid = () => { throw new Error('PCA_RESULT_INVALID'); };
const finite = value => typeof value === 'number' && Number.isFinite(value);
const nonempty = value => typeof value === 'string' && value.length > 0;
const numericVector = (value, length) => Array.isArray(value) && value.length === length && value.every(finite);
const matrix = (value, rows, columns) => Array.isArray(value) && value.length === rows && value.every(row => numericVector(row, columns));

export function validateUnifiedPcaResult(value) {
  if (!value || value.schema_version !== PCA_RESULT_SCHEMA || !['browser-pca', 'hosted-pca'].includes(value.engine)
    || value.algorithm !== 'pca-svd' || !nonempty(value.engine_version)) invalid();
  const dataset = value.dataset_metadata, scores = value.scores, loadings = value.loadings;
  const pre = value.preprocessing, params = value.parameters, diag = value.diagnostics, provenance = value.provenance;
  if (!dataset || !nonempty(dataset.id) || !nonempty(dataset.name) || !Array.isArray(dataset.sample_ids)
    || !Array.isArray(dataset.feature_ids) || !Array.isArray(dataset.groups) || !Array.isArray(dataset.feature_units)
    || dataset.sample_ids.length < 2 || dataset.feature_ids.length < 1
    || dataset.groups.length !== dataset.sample_ids.length || dataset.feature_units.length !== dataset.feature_ids.length
    || !dataset.sample_ids.every(nonempty) || !dataset.feature_ids.every(nonempty)
    || new Set(dataset.sample_ids).size !== dataset.sample_ids.length
    || new Set(dataset.feature_ids).size !== dataset.feature_ids.length
    || !dataset.groups.every(item => typeof item === 'string') || !dataset.feature_units.every(item => typeof item === 'string')
    || typeof dataset.synthetic !== 'boolean'
    || !(dataset.source_sha256 === null || typeof dataset.source_sha256 === 'string' && /^[a-f\d]{64}$/i.test(dataset.source_sha256))) invalid();
  const n = dataset.sample_ids.length, p = dataset.feature_ids.length;
  const k = scores?.components?.length;
  const eigenTotal = Array.isArray(value.eigenvalues) ? value.eigenvalues.reduce((sum, item) => sum + item, 0) : Number.NaN;
  if (!Number.isInteger(k) || k < 1 || k > Math.min(n, p)
    || !scores.components.every((id, i) => id === `PC${i + 1}`)
    || !matrix(scores.values, n, k) || !matrix(loadings?.values, p, k)
    || !Array.isArray(loadings.components) || loadings.components.length !== k
    || loadings.components.some((id, i) => id !== scores.components[i])
    || scores.coordinate_unit !== 'preprocessed-coordinate'
    || !numericVector(value.eigenvalues, Math.min(n, p))
    || !numericVector(value.explained_variance, value.eigenvalues.length)
    || !numericVector(value.cumulative_variance, value.eigenvalues.length)
    || !finite(eigenTotal) || eigenTotal <= 0
    || value.eigenvalues.some(number => number < 0)
    || value.explained_variance.some(number => number < 0 || number > 1 + 1e-8)
    || value.explained_variance.some((number, i) => Math.abs(number - value.eigenvalues[i] / eigenTotal) > 1e-8)
    || Math.abs(value.cumulative_variance.at(-1) - 1) > 1e-8
    || value.cumulative_variance.some((number, i) => Math.abs(number - value.explained_variance.slice(0, i + 1).reduce((a, b) => a + b, 0)) > 1e-8)) invalid();
  // A schema-valid array can still be a forged PCA result. Check SVD identities without
  // fixing arbitrary component signs; this validates internal consistency, not source truth.
  for (let component = 0; component < k; component++) {
    const scoreEnergy = scores.values.reduce((sum, row) => sum + row[component] ** 2, 0) / (n - 1);
    const loadingNorm = loadings.values.reduce((sum, row) => sum + row[component] ** 2, 0);
    if (Math.abs(scoreEnergy - value.eigenvalues[component]) > 1e-5 * Math.max(1, value.eigenvalues[component])
      || Math.abs(loadingNorm - 1) > 1e-5) invalid();
    for (let other = 0; other < component; other++) {
      const dot = loadings.values.reduce((sum, row) => sum + row[component] * row[other], 0);
      if (Math.abs(dot) > 1e-5) invalid();
    }
  }
  if (!pre || !numericVector(pre.means, p) || !numericVector(pre.sample_sd, p) || !numericVector(pre.divisors, p)
    || pre.sample_sd.some(number => number < 0) || pre.divisors.some(number => number <= 0)
    || !Array.isArray(pre.imputed) || !Array.isArray(pre.dropped_samples) || !Array.isArray(pre.dropped_features)
    || pre.imputed.some(item => !item || !nonempty(item.sampleId) || !nonempty(item.featureId)
      || !['mean', 'median'].includes(item.method) || !finite(item.value))
    || !pre.dropped_samples.every(nonempty) || !pre.dropped_features.every(nonempty)
    || !Array.isArray(pre.excluded_samples) || !pre.excluded_samples.every(nonempty)
    || !Array.isArray(pre.excluded_internal_standards) || !pre.excluded_internal_standards.every(nonempty)
    || !params || !['error', 'mean', 'median', 'drop-samples', 'drop-features'].includes(params.missing)
    || !['error', 'drop'].includes(params.constant) || !['none', 'uv', 'pareto'].includes(params.scale)
    || typeof params.center !== 'boolean' || typeof params.include_internal_standards !== 'boolean'
    || !(params.components === null || params.components === k)) invalid();
  if (!diag || !Number.isInteger(diag.numerical_rank) || diag.numerical_rank < k
    || !Array.isArray(diag.warning_codes) || !diag.warning_codes.every(nonempty)
    || !provenance || provenance.dataset_id !== dataset.id || !nonempty(provenance.run_id)
    || !nonempty(provenance.completed_at) || Number.isNaN(Date.parse(provenance.completed_at))
    || !['web-worker', 'remote-service'].includes(provenance.execution_environment)
    || (value.engine === 'browser-pca' && provenance.execution_environment !== 'web-worker')
    || (value.engine === 'hosted-pca' && provenance.execution_environment !== 'remote-service')) invalid();
  return value;
}

/** Convert the immutable Browser PCA core result at the export/adapter boundary. */
export function toUnifiedPcaResult(result, dataset) {
  if (result?.provenance?.datasetId !== dataset?.id) throw new Error('DATASET_MISMATCH');
  if (result.method !== 'pca' || result.engine !== 'browser-pca') invalid();
  const { data, preprocessing: pre, provenance: source } = result;
  if (!data || !pre || !source) invalid();
  const samples = data.sampleIds.map(id => dataset.samples.find(item => item.id === id));
  const features = data.featureIds.map(id => dataset.features.find(item => item.id === id));
  if (samples.some(item => !item) || features.some(item => !item)) invalid();
  const warnings = [];
  const units = features.map(item => item.unit ?? '');
  if (units.some(unit => !unit) || new Set(units).size > 1) warnings.push('UNITS_MIXED_OR_UNKNOWN');
  if (pre.inputCellStates?.unknown || pre.inputCellStates?.unspecified || pre.inputCellStates?.['original-imputed']) warnings.push('SOURCE_CELL_LINEAGE_UNCERTAIN');
  if (pre.imputed?.length) warnings.push('MISSING_VALUES_IMPUTED');
  if (pre.droppedSamples?.length || pre.droppedFeatures?.length) warnings.push('INPUTS_DROPPED');
  const envelope = {
    schema_version: PCA_RESULT_SCHEMA,
    engine: 'browser-pca', algorithm: 'pca-svd', engine_version: source.algorithmVersion,
    dataset_metadata: { id: dataset.id, name: dataset.name, sample_ids: [...data.sampleIds], feature_ids: [...data.featureIds],
      groups: samples.map(item => item.group ?? ''), feature_units: units,
      source_sha256: dataset.provenance?.sourceSha256 ?? null,
      synthetic: dataset.provenance?.source === 'synthetic' },
    parameters: { missing: pre.missing, constant: pre.constant, center: pre.center, scale: pre.scale,
      components: pre.components, include_internal_standards: pre.includeInternalStandards },
    preprocessing: { means: [...pre.means], sample_sd: [...pre.sampleSd], divisors: [...pre.divisors],
      imputed: structuredClone(pre.imputed), dropped_samples: [...pre.droppedSamples], dropped_features: [...pre.droppedFeatures],
      excluded_samples: [...pre.excludedSamples], excluded_internal_standards: [...pre.excludedInternalStandards],
      input_cell_states: { ...pre.inputCellStates } },
    scores: { components: data.scores[0]?.map((_, i) => `PC${i + 1}`) ?? [], coordinate_unit: 'preprocessed-coordinate', values: data.scores.map(row => [...row]) },
    loadings: { components: data.loadings[0]?.map((_, i) => `PC${i + 1}`) ?? [], values: data.loadings.map(row => [...row]) },
    eigenvalues: [...data.eigenvalues], explained_variance: [...data.explained], cumulative_variance: [...data.cumulative],
    diagnostics: { numerical_rank: data.rank, warning_codes: warnings, exploratory_only: true },
    provenance: { dataset_id: dataset.id, run_id: source.runId, completed_at: source.completedAt,
      execution_environment: 'web-worker', source_file_name: dataset.provenance?.sourceFileName ?? null,
      source_sheet: dataset.provenance?.sourceSheet ?? null, matrix_orientation: 'samples x features',
      numeric_library: source.library }
  };
  return validateUnifiedPcaResult(envelope);
}
