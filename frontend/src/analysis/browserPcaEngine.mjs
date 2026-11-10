/** Same run(request, {signal}) contract can be implemented by a future hosted adapter. */
export function createBrowserPcaEngine({ workerFactory = () => new Worker(new URL('../workers/browserPca.worker.mjs', import.meta.url), { type: 'module' }) } = {}) {
  let current = null;
  return {
    capabilities: { methods: ['pca'], execution: 'browser', requiresApi: false },
    get active() { return current !== null; },
    run(request, { signal } = {}) {
      if (current) return Promise.reject(new Error('PCA_BUSY'));
      if (signal?.aborted) return Promise.reject(new Error('PCA_CANCELLED'));
      return new Promise((resolve, reject) => {
        let worker;
        try { worker = workerFactory(); } catch { reject(new Error('PCA_WORKER_ERROR')); return; }
        const id = crypto.randomUUID();
        const finish = (error, result) => {
          if (current?.id !== id) return;
          signal?.removeEventListener('abort', cancel);
          worker.terminate();
          current = null;
          if (error) reject(error); else resolve(result);
        };
        const cancel = () => finish(new Error('PCA_CANCELLED'));
        current = { id, cancel };
        signal?.addEventListener('abort', cancel, { once: true });
        if (signal?.aborted) { cancel(); return; }
        worker.onmessage = ({ data }) => {
          if (data?.id !== id) return;
          if (data.status === 'completed') finish(null, data.result);
          else if (data.status === 'failed') finish(new Error(/^[A-Z][A-Z0-9_]*$/.test(data.code) ? data.code : 'PCA_WORKER_ERROR'));
        };
        worker.onerror = () => finish(new Error('PCA_WORKER_ERROR'));
        try { worker.postMessage({ id, request }); } catch { finish(new Error('PCA_WORKER_ERROR')); }
      });
    },
    cancel() { current?.cancel(); }
  };
}
