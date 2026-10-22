import test from 'node:test'
import assert from 'node:assert/strict'
const api = await import('./storage.mjs').catch(() => ({}))
test('local repository reports unavailable IndexedDB without silently storing in remote service', async () => {
  assert.equal(typeof api.createDatasetStore, 'function')
  const store = api.createDatasetStore({indexedDB:null})
  await assert.rejects(store.list(), /INDEXEDDB_UNAVAILABLE/)
  await assert.rejects(store.load('missing'), /INDEXEDDB_UNAVAILABLE/)
})
