const safeId = value => String(value ?? '');
const lookup = (items, id) => items.find(item => item.id === id) ?? { id, name: id };
const csvCell = value => {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  let text = safeId(value);
  if (/^[\s\t]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
const csv = rows => rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';

export function pcaPlotData(result, dataset, view) {
  if (result?.method !== 'pca' || result.provenance?.datasetId !== dataset?.id) throw new Error('DATASET_MISMATCH');
  const data = result.data;
  const common = { view, datasetId: dataset.id, runVersion: result.provenance.algorithmVersion, oneDimensional: data.scores[0]?.length < 2 };
  if (view === 'scores' || view === 'biplot') {
    const points = data.sampleIds.map((id, i) => {
      const sample = lookup(dataset.samples, id);
      return { id, label: sample.name, group: sample.group || 'Ungrouped', x: data.scores[i][0], y: data.scores[i][1] ?? 0 };
    });
    if (view === 'scores') return { ...common, points, arrows: [] };
    if (common.oneDimensional) return { ...common, points, arrows: [] };
    const maxScore = Math.max(...points.flatMap(p => [Math.abs(p.x), Math.abs(p.y)]));
    const maxLoading = Math.max(...data.loadings.flatMap(row => [Math.abs(row[0]), Math.abs(row[1])]));
    const displayFactor = maxLoading ? 0.7 * maxScore / maxLoading : 1;
    const arrows = data.featureIds.map((id, i) => ({ id, label: lookup(dataset.features, id).name,
      x: data.loadings[i][0] * displayFactor, y: data.loadings[i][1] * displayFactor,
      loadingX: data.loadings[i][0], loadingY: data.loadings[i][1] }));
    return { ...common, points, arrows, displayFactor };
  }
  if (view === 'loadings') return { ...common, points: data.featureIds.map((id, i) => ({ id, label: lookup(dataset.features, id).name,
    group: 'Variables', x: data.loadings[i][0], y: data.loadings[i][1] ?? 0 })), arrows: [] };
  if (view === 'scree') return { ...common, points: data.explained.map((fraction, i) => ({ id: `PC${i + 1}`, label: `PC${i + 1}`, x: i + 1, y: fraction * 100, cumulative: data.cumulative[i] * 100 })), arrows: [] };
  throw new Error('PCA_PLOT_VIEW');
}

export function pcaCsv(result, dataset) {
  if (result?.provenance?.datasetId !== dataset?.id) throw new Error('DATASET_MISMATCH');
  const data = result.data;
  return {
    scores: csv([['sample_id', 'sample_name', 'group', ...data.scores[0].map((_, i) => `PC${i + 1}`)],
      ...data.sampleIds.map((id, i) => { const sample = lookup(dataset.samples, id); return [id, sample.name, sample.group, ...data.scores[i]]; })]),
    loadings: csv([['feature_id', 'feature_name', 'unit', ...data.loadings[0].map((_, i) => `PC${i + 1}`)],
      ...data.featureIds.map((id, i) => { const feature = lookup(dataset.features, id); return [id, feature.name, feature.unit, ...data.loadings[i]]; })]),
    variance: csv([['component', 'eigenvalue', 'explained_percent', 'cumulative_percent'],
      ...data.eigenvalues.map((value, i) => [`PC${i + 1}`, value, data.explained[i] * 100, data.cumulative[i] * 100])])
  };
}
