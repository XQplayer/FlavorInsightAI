import test from 'node:test'
import assert from 'node:assert/strict'
const api = await import('./dataset.mjs').catch(() => ({}))
export const example = () => ({ id: 'd1', name: 'Trial', samples: [{ id: 's1', name: 'A', group: 'G', biologicalUnitId: 'b1' }], features: [{ id: 'f1', name: 'A', cas: '64-17-5' }, { id: 'f2', name: 'B', cas: '64-17-5' }], matrix: [[1, null]] })
test('untrusted project identity and name cannot become renderable objects',()=>{
 assert.throws(()=>api.createDataset({...example(),name:{url:'https://example.invalid'}}),/INVALID_DATASET/)
 assert.throws(()=>api.createDataset({...example(),id:123}),/INVALID_DATASET/)
})
test('dataset contract preserves duplicate CAS, normalizes metadata and freezes snapshots', () => {
  assert.equal(typeof api.createDataset, 'function')
  const source = example(); const data = api.createDataset(source)
  assert.equal(data.schemaVersion, 1); assert.equal(data.features.length, 2)
  assert.equal(data.samples[0].include, true); assert.equal(data.samples[0].subjectId, '')
  source.matrix[0][0] = 9; assert.equal(data.matrix[0][0], 1)
  assert.throws(() => { data.matrix[0][0] = 8 }, TypeError)
})
test('rejects duplicate IDs, non-finite or nonnumeric matrix entries and wrong dimensions', () => {
  assert.equal(typeof api.createDataset, 'function')
  for (const value of ['3', NaN, Infinity, undefined]) assert.throws(() => api.createDataset({ ...example(), matrix: [[value, null]] }), /MATRIX_VALUE/)
  assert.throws(() => api.createDataset({ ...example(), features: [{ id: 'f' }, { id: 'f' }] }), /DUPLICATE_FEATURE_ID/)
  assert.throws(() => api.createDataset({ ...example(), matrix: [[1]] }), /MATRIX_DIMENSIONS/)
  assert.throws(() => api.createDataset({ ...example(), schemaVersion: 2 }), /SCHEMA_VERSION/)
})
test('version derives a new immutable snapshot with parent and unchanged original', () => {
  assert.equal(typeof api.deriveDataset, 'function')
  const original = api.createDataset(example()); const next = api.deriveDataset(original, { name: 'Revised' }, 'annotation')
  assert.notEqual(next.id, original.id); assert.equal(next.provenance.parentId, original.id)
  assert.equal(original.name, 'Trial'); assert.equal(next.name, 'Revised')
})
test('quality masks must align to matrix and default unknown provenance never claims independence', () => {
  const data = api.createDataset(example())
  assert.equal(data.provenance.groupedIndependenceConfirmed, false)
  assert.deepEqual(data.quality.cellStates, [['unknown','missing']])
  assert.throws(() => api.createDataset({...example(),quality:{cellStates:[['observed']]}}), /QUALITY_DIMENSIONS/)
})
