import { createDataset } from './dataset.mjs'
/** No network fallback: browsers may evict storage, so project export remains the portable backup. */
export function createDatasetStore({ indexedDB = globalThis.indexedDB, databaseName = 'flavor-analysis-projects-v1' } = {}) {
  let database
  const open = () => {
    if (!indexedDB) return Promise.reject(new Error('INDEXEDDB_UNAVAILABLE'))
    database ||= new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1)
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('datasets')) request.result.createObjectStore('datasets', { keyPath: 'id' }) }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => { database = undefined; reject(request.error || new Error('INDEXEDDB_OPEN_FAILED')) }
      request.onblocked = () => { database = undefined; reject(new Error('INDEXEDDB_BLOCKED')) }
    })
    return database
  }
  async function transaction(mode, action) {
    const db = await open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('datasets', mode); const request = action(tx.objectStore('datasets')); let result
      request.onsuccess = () => { result = request.result }
      tx.oncomplete = () => resolve(result)
      tx.onerror = () => reject(tx.error || request.error || new Error('INDEXEDDB_TRANSACTION_FAILED'))
      tx.onabort = () => reject(tx.error || new Error('INDEXEDDB_ABORTED'))
    })
  }
  return {
    async save(dataset, settings = {}) { const checked = createDataset(dataset); await transaction('readwrite', store => store.put({ id: checked.id, dataset: structuredClone(checked), settings: structuredClone(settings), savedAt: new Date().toISOString() })); return checked.id },
    async load(id) { const entry = await transaction('readonly', store => store.get(id)); return entry ? { ...entry, dataset: createDataset(entry.dataset) } : null },
    async list() { const entries = await transaction('readonly', store => store.getAll()); return entries.map(e => ({ id: e.id, name: e.dataset.name, savedAt: e.savedAt, samples: e.dataset.samples.length, features: e.dataset.features.length })) },
    async remove(id) { await transaction('readwrite', store => store.delete(id)) },
    async close() { if (database) { (await database).close(); database = undefined } },
  }
}
