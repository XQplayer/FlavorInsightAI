import { runBrowserPca } from '../analysis/browserPca.mjs';

self.onmessage = ({ data }) => {
  const id = data?.id;
  if (typeof id !== 'string') return;
  try {
    self.postMessage({ id, status: 'completed', result: runBrowserPca(data.request) });
  } catch (error) {
    const code = String(error?.message || 'PCA_WORKER_ERROR');
    self.postMessage({ id, status: 'failed', code: /^[A-Z][A-Z0-9_]*$/.test(code) ? code : 'PCA_WORKER_ERROR' });
  }
};
