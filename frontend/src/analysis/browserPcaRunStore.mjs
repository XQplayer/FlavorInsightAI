import { validateBrowserPcaArchive } from './browserPcaArchive.mjs';

/** Explicit local save. The owner namespace prevents accidental cross-account listing, not shared-device access. */
export function createBrowserPcaRunStore({ indexedDB = globalThis.indexedDB, databaseName = 'flavor-browser-pca-runs-v1' } = {}) {
  let pending;
  const open = () => {
    if (!indexedDB) return Promise.reject(new Error('INDEXEDDB_UNAVAILABLE'));
    pending ||= new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('runs', { keyPath: 'key' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => { pending = null; reject(request.error || new Error('INDEXEDDB_OPEN_FAILED')); };
      request.onblocked = () => { pending = null; reject(new Error('INDEXEDDB_BLOCKED')); };
    });
    return pending;
  };
  const transact = async (mode, action) => new Promise((resolve, reject) => {
    open().then(db => {
      const tx = db.transaction('runs', mode);
      const request = action(tx.objectStore('runs'));
      let output;
      request.onsuccess = () => { output = request.result; };
      tx.oncomplete = () => resolve(output);
      tx.onerror = () => reject(tx.error || new Error('INDEXEDDB_TRANSACTION_FAILED'));
      tx.onabort = () => reject(tx.error || new Error('INDEXEDDB_ABORTED'));
    }, reject);
  });
  const key = (owner, runId) => {
    if (!owner || !runId || typeof owner !== 'string' || typeof runId !== 'string') throw new Error('PCA_STORE_ID_INVALID');
    return `${owner}:${runId}`;
  };
  return {
    async save(owner, archive) {
      const checked = await validateBrowserPcaArchive(archive);
      const runId = checked.result.provenance.run_id;
      await transact('readwrite', store => store.put({ key: key(owner, runId), owner, runId, archive: checked }));
      return runId;
    },
    async load(owner, runId) {
      const entry = await transact('readonly', store => store.get(key(owner, runId)));
      return entry?.owner === owner ? validateBrowserPcaArchive(entry.archive) : null;
    },
    async list(owner) {
      if (!owner || typeof owner !== 'string') throw new Error('PCA_STORE_ID_INVALID');
      const rows = await transact('readonly', store => store.getAll());
      return rows.filter(row => row.owner === owner).map(row => ({ runId: row.runId, name: row.archive.dataset.name,
        savedAt: row.archive.saved_at, engineVersion: row.archive.result.engine_version, datasetId: row.archive.dataset.id }));
    },
    async remove(owner, runId) { await transact('readwrite', store => store.delete(key(owner, runId))); },
    async close() { if (pending) { (await pending).close(); pending = null; } }
  };
}
