import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserPcaEngine } from './browserPcaEngine.mjs';

test('worker result resolves and worker resources are released', async () => {
  let worker;
  const engine = createBrowserPcaEngine({ workerFactory: () => (worker = { terminated: false, postMessage(message) { queueMicrotask(() => this.onmessage({ data: { id: message.id, status: 'completed', result: { method: 'pca' } } })); }, terminate() { this.terminated = true; } }) });
  assert.equal(engine.capabilities.methods[0], 'pca');
  assert.deepEqual(await engine.run({ dataset: {} }), { method: 'pca' });
  assert.equal(worker.terminated, true);
});

test('AbortSignal cancels a running SVD by terminating its Worker', async () => {
  let worker;
  const engine = createBrowserPcaEngine({ workerFactory: () => (worker = { postMessage() {}, terminate() { this.terminated = true; } }) });
  const controller = new AbortController();
  const pending = engine.run({ dataset: {} }, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, /PCA_CANCELLED/);
  assert.equal(worker.terminated, true);
  assert.equal(engine.active, false);
});

test('abort during Worker construction cannot leave a pending run', async () => {
  const controller = new AbortController();
  let worker;
  const engine = createBrowserPcaEngine({ workerFactory: () => {
    controller.abort();
    return (worker = { postMessage() {}, terminate() { this.terminated = true; } });
  } });
  const pending = engine.run({ dataset: {} }, { signal: controller.signal });
  await assert.rejects(Promise.race([pending, new Promise((_, reject) => setTimeout(() => reject(new Error('RUN_HUNG')), 100))]), /PCA_CANCELLED/);
  assert.equal(worker.terminated, true);
  assert.equal(engine.active, false);
});

test('concurrent run and worker fault fail without success data', async () => {
  let worker;
  const engine = createBrowserPcaEngine({ workerFactory: () => (worker = { postMessage() {}, terminate() { this.terminated = true; } }) });
  const pending = engine.run({});
  await assert.rejects(engine.run({}), /PCA_BUSY/);
  worker.onerror(new Error('worker crash'));
  await assert.rejects(pending, /PCA_WORKER_ERROR/);
  assert.equal(worker.terminated, true);
});
