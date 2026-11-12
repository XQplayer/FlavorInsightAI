import test from 'node:test';
import assert from 'node:assert/strict';
import reference from './browserPca.reference.json' with { type: 'json' };
import { runBrowserPca } from './browserPca.mjs';
import { pcaPlotData, pcaCsv } from './browserPcaPresentation.mjs';

test('all four plot models bind to actual PCA IDs and numerical results', () => {
  const dataset = reference.dataset;
  const result = runBrowserPca({ dataset, options: { components: 2 } });
  for (const view of ['scores', 'loadings', 'biplot', 'scree']) {
    const model = pcaPlotData(result, dataset, view);
    assert.equal(model.view, view);
    assert.equal(model.datasetId, dataset.id);
    assert.ok(model.points.length);
  }
  assert.equal(pcaPlotData(result, dataset, 'scores').points[0].id, dataset.samples[0].id);
  assert.equal(pcaPlotData(result, dataset, 'loadings').points[0].id, dataset.features[0].id);
  assert.equal(pcaPlotData(result, dataset, 'biplot').arrows.length, 3);
  assert.equal(pcaPlotData(result, dataset, 'scree').points[0].y, result.data.explained[0] * 100);
  assert.throws(() => pcaPlotData(result, { ...dataset, id: 'other' }, 'scores'), /DATASET_MISMATCH/);
});

test('CSV exports scores/loadings/variance and neutralizes formula-like labels', () => {
  const dataset = structuredClone(reference.dataset);
  dataset.samples[0].name = '=cmd';
  const result = runBrowserPca({ dataset, options: { components: 2 } });
  const csv = pcaCsv(result, dataset);
  assert.match(csv.scores, /'=cmd/);
  assert.match(csv.scores, /PC1/);
  assert.match(csv.loadings, /synthetic-f1/);
  assert.match(csv.variance, /explained_percent/);
});
