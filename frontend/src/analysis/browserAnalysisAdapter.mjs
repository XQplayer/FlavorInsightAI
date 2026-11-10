import { createDataset } from './dataset.mjs';
import { BROWSER_PCA_LIMITS } from './browserPca.mjs';
import { createBrowserPcaEngine } from './browserPcaEngine.mjs';
import { toUnifiedPcaResult } from './pcaResult.mjs';

export const BROWSER_PCA_PLAN_SCHEMA = 'flavor-pca-plan/1';
const DEFAULT_OPTIONS = Object.freeze({ missing: 'error', constant: 'error', center: true, scale: 'none', components: null, includeInternalStandards: false });
const fail = code => { throw new Error(code); };

function checkedPlan(plan, dataset) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)
    || Object.keys(plan).some(key => !['schema_version', 'algorithm', 'dataset_id', 'options'].includes(key))
    || plan.schema_version !== BROWSER_PCA_PLAN_SCHEMA || plan.algorithm !== 'pca'
    || !plan.options || typeof plan.options !== 'object' || Array.isArray(plan.options)) fail('PCA_PLAN_INVALID');
  if (plan.dataset_id !== dataset.id) fail('DATASET_MISMATCH');
  if (Object.keys(plan.options).some(key => !Object.hasOwn(DEFAULT_OPTIONS, key))) fail('PCA_PLAN_INVALID');
  const options = { ...DEFAULT_OPTIONS, ...plan.options };
  if (!['error', 'mean', 'median', 'drop-samples', 'drop-features'].includes(options.missing)
    || !['error', 'drop'].includes(options.constant) || !['none', 'uv', 'pareto'].includes(options.scale)
    || typeof options.center !== 'boolean' || typeof options.includeInternalStandards !== 'boolean'
    || !options.center && options.scale !== 'none'
    || !(options.components === null || Number.isInteger(options.components) && options.components >= 1)) fail('PCA_PLAN_INVALID');
  return options;
}

/** Browser-only execution adapter. Gateway plans are data; only UI code calls confirm_pca. */
export function createBrowserAnalysisAdapter({ engine = createBrowserPcaEngine(), uuid = () => crypto.randomUUID(), now = () => new Date().toISOString() } = {}) {
  let prepared = null, running = false;
  const results = new Map();
  const coreResults = new Map();
  const shareAuthorized = new Set();
  const inspect_dataset = input => {
    const data = createDataset(input);
    const selected = data.samples.filter(item => item.include !== false);
    const columns = data.features.map((item, index) => item.isInternalStandard ? -1 : index).filter(index => index >= 0);
    const rows = data.samples.map((item, index) => item.include === false ? -1 : index).filter(index => index >= 0);
    const missing = rows.reduce((count, i) => count + columns.filter(j => data.matrix[i][j] === null).length, 0);
    const qcFiltered = rows.reduce((count, i) => count + columns.filter(j => data.quality.cellStates?.[i]?.[j] === 'qc-filtered' || data.quality.qcFilteredMask?.[i]?.[j] === true).length, 0);
    const constant = columns.filter(j => {
      const observed = rows.map(i => data.matrix[i][j]).filter(value => value !== null);
      if (!observed.length) return false;
      if (observed.length < 2) return true;
      const mean = observed.reduce((sum, value) => sum + value, 0) / observed.length;
      const sd = Math.sqrt(observed.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (observed.length - 1));
      return sd <= Number.EPSILON * Math.max(1, rows.length, columns.length) * Math.max(...observed.map(Math.abs));
    }).length;
    const allMissing = columns.filter(j => rows.every(i => data.matrix[i][j] === null)).length;
    const units = columns.map(j => data.features[j].unit || '');
    const warnings = [];
    if (missing) warnings.push('MISSING_VALUES_PRESENT');
    if (allMissing) warnings.push('ALL_MISSING_FEATURE');
    if (constant) warnings.push('CONSTANT_VARIABLES_PRESENT');
    if (qcFiltered) warnings.push('QC_FILTERED_VALUES');
    if (units.some(unit => !unit) || new Set(units).size > 1) warnings.push('UNITS_MIXED_OR_UNKNOWN');
    if (selected.length < 2 || columns.length < 1) warnings.push('PCA_DIMENSIONS');
    if (selected.length > BROWSER_PCA_LIMITS.maxSamples || columns.length > BROWSER_PCA_LIMITS.maxFeatures || selected.length * columns.length > BROWSER_PCA_LIMITS.maxCells) warnings.push('MATRIX_LIMIT');
    return { dataset_id: data.id, samples: selected.length, features: columns.length, missing_cells: missing,
      constant_variables: constant, all_missing_variables: allMissing, qc_filtered_cells: qcFiltered,
      source_sha256: data.provenance.sourceSha256 ?? null, synthetic: data.provenance.source === 'synthetic', warning_codes: warnings };
  };
  return {
    inspect_dataset,
    recommend_analysis(input) {
      const inspection = inspect_dataset(input);
      return { candidate: ['PCA_DIMENSIONS', 'MATRIX_LIMIT', 'QC_FILTERED_VALUES'].some(code => inspection.warning_codes.includes(code)) ? null : 'pca',
        dataset_id: inspection.dataset_id, warning_codes: inspection.warning_codes,
        requires_gateway_plan: true, requires_user_confirmation: true, numeric_result: null };
    },
    prepare_pca(input, gatewayPlan) {
      if (running) fail('PCA_BUSY');
      const dataset = createDataset(input);
      const options = checkedPlan(gatewayPlan, dataset);
      const inspection = inspect_dataset(dataset);
      if (['PCA_DIMENSIONS', 'MATRIX_LIMIT', 'QC_FILTERED_VALUES'].some(code => inspection.warning_codes.includes(code))) fail('PCA_INPUT_INVALID');
      prepared = { plan_id: crypto.randomUUID(), dataset, options, confirmed: false, used: false };
      return { plan_id: prepared.plan_id, dataset_id: dataset.id, options: structuredClone(options),
        inspection, requires_user_confirmation: true, execution: 'browser-web-worker' };
    },
    /** This method belongs to the local UI confirmation handler and is never exposed as a model tool. */
    confirm_pca(planId) {
      if (!prepared || prepared.plan_id !== planId) fail('PCA_PLAN_NOT_FOUND');
      if (prepared.used) fail('PCA_ALREADY_RUN');
      prepared.confirmed = true;
    },
    async run_browser_pca({ plan_id: planId, signal } = {}) {
      if (!prepared || prepared.plan_id !== planId) fail('PCA_PLAN_NOT_FOUND');
      if (prepared.used) fail('PCA_ALREADY_RUN');
      if (!prepared.confirmed) fail('PCA_CONFIRMATION_REQUIRED');
      if (running) fail('PCA_BUSY');
      const bound = prepared;
      bound.used = true; running = true;
      try {
        const output = await engine.run({ dataset: bound.dataset, options: bound.options }, { signal });
        if (signal?.aborted) fail('PCA_CANCELLED');
        if (prepared !== bound) fail('PCA_PLAN_STALE');
        const result = toUnifiedPcaResult({ ...output, provenance: { ...output.provenance,
          runId: uuid(), completedAt: now() } }, bound.dataset);
        results.set(result.provenance.run_id, result);
        coreResults.set(result.provenance.run_id, { ...output, provenance: { ...output.provenance, runId: result.provenance.run_id, completedAt: result.provenance.completed_at } });
        while (results.size > 10) { const oldest = results.keys().next().value; results.delete(oldest); coreResults.delete(oldest); shareAuthorized.delete(oldest); }
        return structuredClone(result);
      } finally { running = false; }
    },
    get_browser_pca_result(runId) {
      if (typeof runId !== 'string' || !results.has(runId)) fail('PCA_RESULT_NOT_FOUND');
      return structuredClone(results.get(runId));
    },
    /** UI-only projection for existing scientific charts; never exposed to the Gateway. */
    get_browser_pca_core_result(runId) {
      if (typeof runId !== 'string' || !coreResults.has(runId)) fail('PCA_RESULT_NOT_FOUND');
      return structuredClone(coreResults.get(runId));
    },
    /** Rehydrate a previously integrity-checked local archive for charting and optional sharing. */
    restore_browser_pca_result(core, dataset) {
      const envelope = toUnifiedPcaResult(core, createDataset(dataset));
      results.set(envelope.provenance.run_id, envelope);
      coreResults.set(envelope.provenance.run_id, structuredClone(core));
      return envelope.provenance.run_id;
    },
    /** UI-only action after showing the bounded fields that would be shared. */
    confirm_explanation(runId) {
      if (typeof runId !== 'string' || !results.has(runId)) fail('PCA_RESULT_NOT_FOUND');
      shareAuthorized.add(runId);
    },
    /** Bounded facts for a later Gateway request; approval is single-use and no upload occurs here. */
    explain_pca_result(runId) {
      if (!shareAuthorized.has(runId)) fail('PCA_SHARE_CONFIRMATION_REQUIRED');
      shareAuthorized.delete(runId);
      const result = results.get(runId);
      const count = result.scores.components.length;
      return { source: 'verified-browser-pca-result', schema_version: result.schema_version,
        run_id: runId, dataset_id: result.dataset_metadata.id, samples: result.dataset_metadata.sample_ids.length,
        features: result.dataset_metadata.feature_ids.length, parameters: structuredClone(result.parameters),
        explained_variance: result.explained_variance.slice(0, count), warning_codes: [...result.diagnostics.warning_codes],
        exploratory_only: true, note: 'No significance test, OAV or causal inference was computed.' };
    }
  };
}
