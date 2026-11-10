import test from 'node:test'
import assert from 'node:assert/strict'
import { pcaExplanationExcerpt } from './pcaExplanation.mjs'

const run = {
  status: 'completed', requestHash: 'a'.repeat(64),
  planReceipt: { datasetHash: 'b'.repeat(64) },
  request: { dataset: { id: 'test', name: 'SYNTHETIC test', provenance: { source: 'synthetic' }, samples: [
    { id: 's1', group: 'A' }, { id: 's2', group: 'B' }, { id: 's3', group: 'B' },
  ], features: [{ id: 'f1', name: 'Synthetic feature 1', unit: 'a.u.' }, { id: 'f2', name: 'Synthetic feature 2', unit: 'a.u.' }] },
  recipe: { scale: { method: 'none' }, impute: { method: 'none' } }, analysis: { method: 'pca', center: true, components: 2 } },
  result: { method: 'pca', provenance: { datasetId: 'test', rVersion: '4.6.0', engineVersion: '1.0.0' }, data: {
    sampleIds: ['s1', 's2', 's3'], featureIds: ['f1', 'f2'], explained: [0.8, 0.2],
    scores: [[1, 0], [-1, 1], [0, -1]], loadings: [[0.9, 0.2], [0.1, -0.8]],
  } },
}

test('only completed, bound R PCA output yields a bounded, source-labelled excerpt', () => {
  const excerpt = pcaExplanationExcerpt(run)
  assert.equal(excerpt.method, 'pca')
  assert.deepEqual(excerpt.explained, [0.8, 0.2])
  assert.equal(excerpt.topLoadings[0].featureId, 'f1')
  assert.equal(excerpt.sampleCoordinates[1].group, 'B')
  assert.equal(excerpt.sourceStatus, 'client-provided completed R result; not independently reverified by AI gateway')
  assert.equal('matrix' in excerpt, false)
  assert.throws(() => pcaExplanationExcerpt({ ...run, status: 'failed' }), /PCA_RESULT_UNAVAILABLE/)
  assert.throws(() => pcaExplanationExcerpt({ ...run, result: { ...run.result, method: 'compare' } }), /PCA_RESULT_UNAVAILABLE/)
})
