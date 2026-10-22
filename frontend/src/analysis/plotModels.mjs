// Presentation only: no hypothesis testing, FDR adjustment, or recipe mutation.
export const finite = value => typeof value === 'number' && Number.isFinite(value);
export const PALETTE = ['#0072B2', '#D55E00', '#009E73', '#CC79A7', '#000000'];
const MARKERS = ['circle', 'square', 'triangle', 'diamond', 'plus', 'down', 'hexagon', 'star', 'ring', 'hollow-square', 'cross', 'left'];
export function markerEncoding(index, palette = 'color') {
  const colors = palette === 'mono' ? ['#111111', '#444444', '#777777'] : PALETTE;
  return {
    shape: MARKERS[index % MARKERS.length],
    color: colors[index % colors.length]
  };
}
export function valueLimits(values) {
  let lo = Infinity,
    hi = -Infinity;
  for (const value of values) if (finite(value)) {
    lo = Math.min(lo, value);
    hi = Math.max(hi, value);
  }
  return lo === Infinity ? [0, 1] : [lo, hi];
}
export function matrixScaleLabel(run) {
  const data = run.result.data,
    display = data.displayScale;
  if (display === 'feature-z') return {
    en: 'Feature z-score (display only; center 0)',
    zh: '特征 z 分数（仅显示；中心 0）'
  };
  if (display === 'sample-z') return {
    en: 'Sample z-score (display only; center 0)',
    zh: '样品 z 分数（仅显示；中心 0）'
  };
  const operations = ['normalize', 'transform', 'scale'].map(key => ({
    key,
    method: run.request.recipe?.[key]?.method
  })).filter(x => x.method && x.method !== 'none');
  if (operations.length) {
    const text = operations.map(x => `${x.key}=${x.method}`).join(', ');
    return {
      en: `Processed value (${text}); no display scaling`,
      zh: `处理后数值（${text}）；无额外显示缩放`
    };
  }
  const units = data.featureIds.map(id => run.request.dataset.features.find(f => f.id === id)?.unit);
  const unit = units.length && units.every(value => typeof value === 'string' && value && value === units[0]) ? ` (${units[0]})` : '';
  return {
    en: `Value${unit} · no display scaling`,
    zh: `数值${unit} · 无额外显示缩放`
  };
}
export function plotBinding(run) {
  return {
    runId: run.id,
    datasetId: run.request.dataset.id,
    datasetName: run.request.dataset.name,
    recipe: run.request.recipe,
    analysis: run.request.analysis,
    inferenceTransform: run.result.data?.transform,
    provenance: run.result.provenance,
    source: run.request.dataset.provenance
  };
}
export function identity(run, id, kind = 'feature') {
  const dataset = run.request.dataset;
  let item = (kind === 'feature' ? dataset.features : dataset.samples).find(row => row.id === id);
  if (!item && kind === 'sample') {
    const aggregate = run.result?.data?.samples?.find(row => row.id === id);
    const sources = (aggregate?.sourceSampleIds || []).map(source => dataset.samples.find(row => row.id === source)).filter(Boolean);
    item = {
      ...aggregate,
      name: sources.map(row => row.name).join(' / ') || aggregate?.name
    };
  }
  return {
    ...item,
    id,
    label: `${id}${item?.name ? ' · ' + item.name : ''}`
  };
}
export function boundedPoints(points, limit = 500) {
  const valid = points.filter(p => finite(p.x) && finite(p.y));
  return {
    points: valid.slice(0, limit),
    total: points.length,
    finite: valid.length,
    missing: points.length - valid.length,
    limit
  };
}
function orderIndices(order, size) {
  const values = order ?? Array.from({
    length: size
  }, (_, i) => i + 1);
  if (values.length !== size || new Set(values).size !== size || values.some(v => !Number.isInteger(v) || v < 1 || v > size)) throw new Error('Invalid one-based R order');
  return values.map(v => v - 1);
}
export function orderedMatrix(data, limit = 40) {
  const ri = orderIndices(data.rowOrder, data.sampleIds.length),
    ci = orderIndices(data.columnOrder, data.featureIds.length);
  return {
    rows: ri.slice(0, limit).map(i => data.sampleIds[i]),
    columns: ci.slice(0, limit).map(j => data.featureIds[j]),
    values: ri.slice(0, limit).map(i => ci.slice(0, limit).map(j => data.matrix[i]?.[j] ?? null)),
    rowIndices: ri,
    columnIndices: ci,
    totalRows: ri.length,
    totalColumns: ci.length,
    scale: data.displayScale || 'analysis matrix',
    limit
  };
}
/** Coordinates are leaf position and actual hclust height. No fabricated branches. */
export function treeSegments(tree, leafOrder) {
  if (tree === null || tree === undefined) return [];
  const invalid = () => { throw new Error('Invalid hclust tree'); };
  if (!Array.isArray(leafOrder) || leafOrder.length < 1) invalid();
  const leafCount = leafOrder.length;
  // Reject oversized/malformed imported trees before any drawable allocation.
  if (!Array.isArray(tree.merge) || !Array.isArray(tree.height) ||
      tree.merge.length !== leafCount - 1 || tree.height.length !== leafCount - 1) invalid();
  if (new Set(leafOrder).size !== leafCount ||
      leafOrder.some(leaf => !Number.isInteger(leaf) || leaf < 0 || leaf >= leafCount)) invalid();
  const consumed = new Set(), sizes = [];
  for (let i = 0; i < tree.merge.length; i++) {
    const merge = tree.merge[i], height = tree.height[i];
    if (!Array.isArray(merge) || merge.length !== 2 || !finite(height) || height < 0 ||
        (i > 0 && height < tree.height[i - 1])) invalid();
    let size = 0;
    for (const ref of merge) {
      if (!Number.isInteger(ref) || ref === 0 || ref < -leafCount || ref > i || consumed.has(ref)) invalid();
      consumed.add(ref);
      size += ref < 0 ? 1 : sizes[ref - 1];
    }
    sizes.push(size);
  }
  if (leafCount > 1 && (sizes.at(-1) !== leafCount ||
      leafOrder.some(leaf => !consumed.has(-leaf - 1)) ||
      sizes.slice(0, -1).some((_, i) => !consumed.has(i + 1)))) invalid();
  const nodes = [],
    segments = [],
    positions = new Map(leafOrder.map((leaf, i) => [leaf, i + .5]));
  for (let i = 0; i < tree.merge.length; i++) {
    const children = tree.merge[i].map(ref => ref < 0 ? {
      x: positions.get(-ref - 1),
      y: 0
    } : nodes[ref - 1]);
    if (children.some(n => !n || !finite(n.x)) || !finite(tree.height[i])) throw new Error('Invalid hclust tree');
    const [a, b] = children,
      h = tree.height[i];
    segments.push({
      x1: a.x,
      y1: a.y,
      x2: a.x,
      y2: h
    }, {
      x1: b.x,
      y1: b.y,
      x2: b.x,
      y2: h
    }, {
      x1: a.x,
      y1: h,
      x2: b.x,
      y2: h
    });
    nodes.push({
      x: (a.x + b.x) / 2,
      y: h
    });
  }
  return segments;
}
export function screeModel(data) {
  if (!Number.isInteger(data.rank) || data.rank < 1 || !Array.isArray(data.explained) || data.rank > data.explained.length) {
    throw new Error('Invalid PCA numerical rank or explained spectrum');
  }
  return {
    rank: data.rank,
    totalSpectrum: data.explained.length,
    points: data.explained.slice(0, data.rank).map((value, index) => ({
      id: `PC${index + 1}`,
      label: `PC${index + 1}`,
      x: index + 1,
      y: value,
      raw: { explained: value, cumulative: data.cumulative?.[index], eigenvalue: data.eigenvalues?.[index] },
    })),
  };
}
export function componentAxes(fit, method) {
  if (fit.rank !== undefined && (!Number.isInteger(fit.rank) || fit.rank < 1)) throw new Error('Invalid component rank');
  if (fit.scores !== undefined && (!Array.isArray(fit.scores) || !fit.scores.every(Array.isArray))) throw new Error('Invalid score matrix');
  const width = fit.scores?.[0]?.length || 0;
  const n = method === 'pca' ? Math.min(fit.rank ?? width, width) : Math.min(fit.components?.predictive ?? width, width);
  const axes = Array.from({
    length: n
  }, (_, i) => ({
    key: `p${i}`,
    index: i,
    orthogonal: false,
    label: `${method === 'pca' ? 'PC' : 'Predictive '}${i + 1}`
  }));
  if (method === 'oplsda') for (let i = 0; i < Math.min(fit.components?.orthogonal || 0, fit.orthogonalScores?.[0]?.length || 0); i++) axes.push({
    key: `o${i}`,
    index: i,
    orthogonal: true,
    label: `Orthogonal ${i + 1}`
  });
  return axes;
}
export function volcanoModel(rows, comparison, metric = 'padj', fc = 1, cutoff = .05) {
  const selected = rows.filter(r => r.comparison === comparison);
  const points = selected.map(raw => {
    const p = raw[metric];
    return {
      id: raw.featureId,
      x: raw.log2FoldChange,
      y: finite(p) && p >= 0 && p <= 1 ? Math.min(300, p === 0 ? 300 : -Math.log10(p)) : null,
      raw,
      capped: p === 0 || finite(p) && p > 0 && -Math.log10(p) > 300,
      group: finite(p) && p <= cutoff && finite(raw.log2FoldChange) && Math.abs(raw.log2FoldChange) >= fc ? 'Within display cutoffs' : 'Other'
    };
  });
  return {
    ...boundedPoints(points),
    allPoints: points,
    familySize: rows.length,
    comparison,
    metric,
    fc,
    cutoff,
    cap: 300
  };
}
function quantile(sorted, p) {
  const v = (sorted.length - 1) * p,
    i = Math.floor(v);
  return sorted[i] + (sorted[Math.min(i + 1, sorted.length - 1)] - sorted[i]) * (v - i);
}
export function boxSummary(values) {
  const v = values.filter(finite).sort((a, b) => a - b);
  if (!v.length) return {
    n: 0,
    missing: values.length,
    quartiles: [],
    whiskers: []
  };
  const quartiles = [.25, .5, .75].map(p => quantile(v, p)),
    iqr = quartiles[2] - quartiles[0];
  const inside = v.filter(x => x >= quartiles[0] - 1.5 * iqr && x <= quartiles[2] + 1.5 * iqr);
  return {
    n: v.length,
    missing: values.length - v.length,
    quartiles,
    whiskers: [inside[0], inside.at(-1)],
    min: v[0],
    max: v.at(-1)
  };
}
export function densityModel(values) {
  const v = values.filter(finite),
    b = boxSummary(v);
  if (v.length < 3) return {
    points: [],
    reason: 'SMALL_N'
  };
  if (b.min === b.max) return {
    points: [],
    reason: 'CONSTANT'
  };
  const mean = v.reduce((a, b) => a + b, 0) / v.length,
    sd = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / (v.length - 1));
  const bandwidth = 1.06 * sd * v.length ** -.2; // Scott normal-reference Gaussian KDE.
  const points = Array.from({
    length: 64
  }, (_, i) => {
    const x = b.min + (b.max - b.min) * i / 63;
    return {
      x,
      y: v.reduce((s, z) => s + Math.exp(-.5 * ((x - z) / bandwidth) ** 2), 0) / (v.length * bandwidth * Math.sqrt(2 * Math.PI))
    };
  });
  return {
    points,
    bandwidth,
    method: 'Gaussian KDE; Scott 1.06 × sample SD × n^(-1/5); 64 grid points; truncated to observed range'
  };
}
export function correlationModel(results, limit = 30) {
  const ids = [...new Set(results.flatMap(r => [r.featureId, r.otherFeatureId]))],
    rows = ids.slice(0, limit),
    map = new Map();
  for (const r of results) {
    map.set(JSON.stringify([r.featureId, r.otherFeatureId]), r);
    if (!map.has(JSON.stringify([r.otherFeatureId, r.featureId]))) map.set(JSON.stringify([r.otherFeatureId, r.featureId]), r);
  }
  return {
    rows,
    columns: rows,
    values: rows.map(a => rows.map(b => map.get(JSON.stringify([a, b]))?.r ?? null)),
    details: map,
    total: ids.length,
    totalRows: ids.length,
    totalColumns: ids.length,
    limit,
    scale: 'r (center 0)'
  };
}
export function permutationModel(data = {}) {
  const points = (data.distribution || []).map((value, index) => ({
    id: String(index + 1),
    x: index + 1,
    y: value
  }));
  const invalid = data.requested === 0 || data.failed > 0 || data.completed < data.requested;
  return {
    ...data,
    ...boundedPoints(points),
    p: invalid ? null : data.p ?? null,
    rawP: data.p ?? null,
    pNaReason: data.pNaReason || (invalid ? 'PERMUTATION_NOT_COMPLETE' : null),
    observed: data.observed ?? null
  };
}
