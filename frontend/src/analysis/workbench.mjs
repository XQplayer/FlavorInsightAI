import { createDataset, deriveDataset } from './dataset.mjs';
import { parseDelimited } from './imports.mjs';
export const METHODS = ['preprocess', 'pca', 'heatmap', 'compare', 'correlation', 'distribution', 'plsda', 'oplsda'];
export const defaultRecipe = () => ({
  schemaVersion: 1,
  filter: {
    includeInternalStandards: false,
    maxMissing: null,
    missingScope: 'global',
    allMissing: 'error',
    zeroVariance: 'keep',
    allowMixedUnits: false,
    allowMixedMatrixTypes: false
  },
  impute: {
    method: 'none',
    value: 0,
    k: 3
  },
  normalize: {
    method: 'none',
    target: 1,
    featureId: null,
    acknowledgeDoubleNormalization: false
  },
  transform: {
    method: 'none',
    pseudocount: 0
  },
  scale: {
    method: 'none',
    axis: 'feature'
  }
});
export function defaultAnalysis(method = 'pca') {
  if (method === 'heatmap') return {
    method,
    displayScale: 'none',
    clusterRows: true,
    clusterColumns: true,
    rowDistance: 'euclidean',
    columnDistance: 'euclidean',
    rowLinkage: 'average',
    columnLinkage: 'average'
  };
  if (method === 'compare') return {
    method,
    test: 'welch',
    comparisons: [],
    groups: [],
    alternative: 'two.sided',
    adjust: 'BH',
    adjustScope: 'comparison',
    transform: {
      method: 'none',
      pseudocount: 0
    },
    includeInternalStandards: false,
    allowMixedMatrixTypes: false,
    mixedMatrixTypesReason: ''
  };
  if (method === 'correlation' || method === 'distribution') return {
    method,
    ...(method === 'correlation' ? {
      correlation: 'pearson',
      adjust: 'BH'
    } : {}),
    includeInternalStandards: false,
    allowMixedMatrixTypes: false,
    mixedMatrixTypesReason: ''
  };
  if (method === 'plsda' || method === 'oplsda') return {
    method,
    groups: [],
    classOrder: [],
    outerFolds: 5,
    innerFolds: 3,
    repeats: 1,
    seed: 20261023,
    predictiveComponents: method === 'plsda' ? [1, 2] : [1],
    orthogonalComponents: method === 'plsda' ? [0] : [1],
    permutations: 200,
    acknowledgeExploratory: false,
    allowMixedMatrixTypes: false,
    mixedMatrixTypesReason: ''
  };
  return {
    method
  };
}
export function effectiveState(d, i, j) {
  const q = d.quality;
  return q.cellStates[i][j] === 'qc-filtered' || q.qcFilteredMask?.[i]?.[j] ? 'qc-filtered' : q.unknownSourceMask?.[i]?.[j] ? 'unknown' : q.originalImputedMask?.[i]?.[j] ? 'original-imputed' : q.cellStates[i][j];
}
export function qualitySummary(d) {
  const counts = {};
  d.matrix.forEach((row, i) => row.forEach((_, j) => {
    const state = effectiveState(d, i, j);
    counts[state] = (counts[state] || 0) + 1;
  }));
  return counts;
}
export function confirmMeasured(d) {
  if (d.provenance.source !== 'table-import') throw new Error('TABLE_IMPORT_ONLY');
  const quality = structuredClone(d.quality);
  quality.cellStates = d.matrix.map((row, i) => row.map((v, j) => Number.isFinite(v) && quality.cellStates[i][j] === 'unknown' && effectiveState(d, i, j) === 'unknown' && !quality.originalImputedMask?.[i]?.[j] && !quality.qcFilteredMask?.[i]?.[j] ? 'observed' : quality.cellStates[i][j]));
  if (quality.unknownSourceMask) quality.unknownSourceMask = quality.unknownSourceMask.map((row, i) => row.map((v, j) => quality.cellStates[i][j] === 'observed' ? false : v));
  return deriveDataset(d, {
    quality,
    provenance: {
      measuredValuesConfirmed: true
    }
  }, 'confirm-table-measured');
}
const metadataFields = ['name', 'group', 'biologicalUnitId', 'subjectId', 'batch', 'include'];
export function metadataPreview(d, text, delimiter = ',') {
  const rows = parseDelimited(text, delimiter),
    header = rows.shift() || [],
    errors = [],
    samples = structuredClone(d.samples),
    seen = new Set();
  const key = header.includes('id') ? 'id' : header.includes('name') ? 'name' : null;
  if (!key) errors.push('ID_OR_NAME_REQUIRED');
  if (new Set(header).size !== header.length || header.some(k => !['id', ...metadataFields].includes(k))) errors.push('UNKNOWN_OR_DUPLICATE_COLUMN');
  rows.filter(r => r.some(v => v !== '')).forEach((row, index) => {
    const matches = key ? samples.filter(s => s[key] === row[header.indexOf(key)]) : [];
    if (matches.length !== 1) {
      errors.push(`ROW_${index + 2}_AMBIGUOUS_OR_UNKNOWN_SAMPLE`);
      return;
    }
    const sample = matches[0];
    if (seen.has(sample.id)) {
      errors.push(`ROW_${index + 2}_DUPLICATE_SAMPLE`);
      return;
    }
    seen.add(sample.id);
    header.forEach((field, c) => {
      if (metadataFields.includes(field)) {
        if (field === 'include') {
          if (!['true', 'false'].includes(row[c])) errors.push(`ROW_${index + 2}_INVALID_INCLUDE`);else sample.include = row[c] === 'true';
        } else sample[field] = row[c] ?? '';
      }
    });
  });
  return {
    samples,
    errors,
    matched: seen.size
  };
}
export function applyMetadata(d, samples, confirmed) {
  if (samples.length !== d.samples.length || samples.some((s, i) => s.id !== d.samples[i].id)) throw new Error('SAMPLE_ID_MISMATCH');
  if (confirmed && samples.some(s => s.include !== false && (!s.group.trim() || !s.biologicalUnitId.trim()))) throw new Error('GROUP_AND_UNIT_REQUIRED');
  return deriveDataset(d, {
    samples,
    provenance: {
      independenceConfirmed: confirmed === true,
      groupedIndependenceConfirmed: confirmed === true
    }
  }, 'sample-metadata');
}
function knownObject(value, allowed, code = 'SETTINGS') {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k))) throw new Error(code);
}
function primitives(value, depth = 0) {
  if (depth > 30) throw new Error('SETTINGS');
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    value.forEach(v => primitives(v, depth + 1));
    return;
  }
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [k, v] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype', 'token', 'url'].includes(k)) throw new Error('SETTINGS');
      primitives(v, depth + 1);
    }
    return;
  }
  throw new Error('SETTINGS');
}
export function validateRecipe(recipe) {
  const defaults = defaultRecipe();
  knownObject(recipe, Object.keys(defaults));
  for (const key of Object.keys(recipe)) {
    if (key === 'schemaVersion') {
      if (recipe[key] !== 1) throw new Error('SETTINGS');
      continue;
    }
    knownObject(recipe[key], [...Object.keys(defaults[key]), ...(key === 'filter' ? ['featureIds'] : [])]);
    for (const [field, value] of Object.entries(recipe[key])) {
      const expected = defaults[key][field];
      if (field === 'featureIds') {
        if (!Array.isArray(value) || value.some(v => typeof v !== 'string')) throw new Error('SETTINGS');
      } else if (expected !== null && typeof value !== typeof expected) throw new Error('SETTINGS');
    }
  }
  if (recipe.filter?.maxMissing !== undefined && recipe.filter.maxMissing !== null && (typeof recipe.filter.maxMissing !== 'number' || recipe.filter.maxMissing < 0 || recipe.filter.maxMissing > 1)) throw new Error('SETTINGS');
  if (recipe.normalize?.featureId !== undefined && recipe.normalize.featureId !== null && typeof recipe.normalize.featureId !== 'string') throw new Error('SETTINGS');
  const enums = {
    filter: {
      missingScope: ['global', 'group'],
      allMissing: ['error', 'drop'],
      zeroVariance: ['keep', 'drop']
    },
    impute: {
      method: ['none', 'constant', 'median', 'half-minimum', 'knn']
    },
    normalize: {
      method: ['none', 'sum', 'median', 'pqn', 'internal-standard']
    },
    transform: {
      method: ['none', 'log2', 'log10', 'ln', 'sqrt']
    },
    scale: {
      method: ['none', 'center', 'uv', 'pareto', 'minmax', 'robust'],
      axis: ['feature', 'sample']
    }
  };
  for (const [section, fields] of Object.entries(enums)) for (const [key, values] of Object.entries(fields)) if (recipe[section]?.[key] !== undefined && !values.includes(recipe[section][key])) throw new Error('SETTINGS');
  primitives(recipe);
  return Object.fromEntries(Object.entries(defaults).map(([k, v]) => [k, k === 'schemaVersion' ? 1 : {
    ...v,
    ...recipe[k]
  }]));
}
export function validateAnalysis(analysis) {
  if (!METHODS.includes(analysis?.method)) throw new Error('SETTINGS');
  const defaults = defaultAnalysis(analysis.method);
  knownObject(analysis, [...Object.keys(defaults), ...(analysis.method === 'pca' ? ['components', 'center'] : [])]);
  for (const [key, value] of Object.entries(analysis)) {
    if (['groups', 'classOrder'].includes(key)) {
      if (!Array.isArray(value) || value.some(v => typeof v !== 'string')) throw new Error('SETTINGS');
    } else if (['predictiveComponents', 'orthogonalComponents'].includes(key)) {
      if (!Array.isArray(value) || value.some(v => !Number.isInteger(v))) throw new Error('SETTINGS');
    } else if (key === 'comparisons') {
      if (!Array.isArray(value)) throw new Error('SETTINGS');
      value.forEach(c => {
        knownObject(c, ['control', 'treatment']);
        if (typeof c.control !== 'string' || typeof c.treatment !== 'string') throw new Error('SETTINGS');
      });
    } else if (key === 'transform') {
      knownObject(value, ['method', 'pseudocount']);
      if (value.method !== undefined && typeof value.method !== 'string' || value.pseudocount !== undefined && typeof value.pseudocount !== 'number') throw new Error('SETTINGS');
    } else if (key === 'center') {
      if (typeof value !== 'boolean') throw new Error('SETTINGS');
    } else if (key === 'components') {
      if (!Number.isInteger(value) || value < 1) throw new Error('SETTINGS');
    } else if (typeof value !== typeof defaults[key]) throw new Error('SETTINGS');
  }
  const enums = {
    test: ['welch', 'student', 'paired-t', 'wilcoxon', 'paired-wilcoxon', 'anova', 'welch-anova', 'kruskal'],
    alternative: ['two.sided', 'less', 'greater'],
    adjust: ['BH', 'holm', 'bonferroni', 'none'],
    adjustScope: ['comparison', 'all'],
    correlation: ['pearson', 'spearman'],
    displayScale: ['none', 'feature-z', 'sample-z'],
    rowDistance: ['euclidean', 'manhattan', 'pearson', 'spearman'],
    columnDistance: ['euclidean', 'manhattan', 'pearson', 'spearman'],
    rowLinkage: ['average', 'complete', 'single', 'ward.D2'],
    columnLinkage: ['average', 'complete', 'single', 'ward.D2']
  };
  for (const [key, values] of Object.entries(enums)) if (analysis[key] !== undefined && !values.includes(analysis[key])) throw new Error('SETTINGS');
  if (analysis.transform) validateRecipe({
    transform: analysis.transform
  });
  primitives(analysis);
  return {
    ...defaults,
    ...structuredClone(analysis),
    ...(defaults.transform ? {
      transform: {
        ...defaults.transform,
        ...analysis.transform
      }
    } : {})
  };
}
export function restoreSettings(settings = {}) {
  knownObject(settings, ['schemaVersion', 'recipe', 'analysis', 'runs']);
  primitives(settings);
  if (settings.schemaVersion !== undefined && settings.schemaVersion !== 1) throw new Error('SETTINGS');
  const recipe = validateRecipe(settings.recipe || defaultRecipe()),
    analysis = validateAnalysis(settings.analysis || defaultAnalysis());
  if (settings.runs !== undefined && !Array.isArray(settings.runs)) throw new Error('RUN');
  const runs = (settings.runs || []).map(run => {
    knownObject(run, ['id', 'status', 'request', 'requestHash', 'createdAt', 'startedAt', 'finishedAt', 'result', 'error', 'logs'], 'RUN');
    if (typeof run.id !== 'string' || !['queued', 'running', 'completed', 'failed', 'cancelled', 'interrupted'].includes(run.status) || !run.request) throw new Error('RUN');
    for (const key of ['requestHash', 'createdAt', 'startedAt', 'finishedAt']) if (run[key] !== undefined && run[key] !== null && typeof run[key] !== 'string') throw new Error('RUN');
    if (run.error !== undefined && run.error !== null) {
      knownObject(run.error, ['code'], 'RUN');
      if (typeof run.error.code !== 'string') throw new Error('RUN');
    }
    if (run.logs !== undefined && (!Array.isArray(run.logs) || run.logs.some(value => typeof value !== 'string'))) throw new Error('RUN');
    knownObject(run.request, ['dataset', 'recipe', 'analysis'], 'RUN');
    createDataset(run.request.dataset);
    validateRecipe(run.request.recipe);
    validateAnalysis(run.request.analysis);
    if (run.status === 'completed' && (!run.result || run.result.schemaVersion !== 1 || run.result.method !== run.request.analysis.method || run.result.provenance?.datasetId !== run.request.dataset.id || !run.result.data || typeof run.result.data !== 'object' || Array.isArray(run.result.data))) throw new Error('RUN');
    return {
      ...structuredClone(run),
      status: ['queued', 'running'].includes(run.status) ? 'interrupted' : run.status
    };
  });
  return {
    schemaVersion: 1,
    recipe,
    analysis,
    runs
  };
}
export function isRunStale(run, d, recipe, analysis) {
  return run.request.dataset.id !== d.id || JSON.stringify(run.request.recipe) !== JSON.stringify(recipe) || JSON.stringify(run.request.analysis) !== JSON.stringify(analysis);
}
