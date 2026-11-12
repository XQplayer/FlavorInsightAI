import assert from 'node:assert/strict'
import test from 'node:test'

import { createShimadzuTaskStore } from './shimadzuTaskStore.js'

const memoryAdapter = () => {
  const values = new Map()
  return {
    values,
    async getMany(keys) { return keys.map(key => values.get(key)) },
    async putMany(entries) { for (const [key, value] of entries) values.set(key, structuredClone(value)) },
    async deleteMany(keys) { for (const key of keys) values.delete(key) },
  }
}

const task = (overrides = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  scope: 'user-1',
  userId: 'user-1',
  name: '刷新恢复测试',
  mode: 'step',
  status: 'running',
  nextStage: 2,
  rawName: 'raw.xlsx',
  sampleName: 'samples.xlsx',
  rawBytes: new Uint8Array([1, 2, 3]).buffer,
  sampleBytes: new Uint8Array([4, 5]).buffer,
  stageSummary: [{ stage: 0, status: 'PASS' }, { stage: 1, status: 'PASS' }],
  ...overrides,
})

test('rerun preserves a UUID-keyed parent evidence record without retaining raw input copies', async () => {
  const { createTaskRun, persistTaskRun } = await import('./shimadzuTaskLifecycle.mjs')
  const adapter = memoryAdapter()
  const store = createShimadzuTaskStore({ adapter, now: () => new Date('2026-11-12T07:30:45Z') })
  const parent = { ...createTaskRun(task()), status: 'failed', partialArchiveBytes: new Uint8Array([80,75,1]).buffer, partialArchiveFileName: 'parent.zip' }
  await store.save(parent)
  const child = createTaskRun({}, { parent })
  await persistTaskRun(child, { parent, store, cloud: { configured: false } })
  assert.equal((await store.load(parent.scope)).id, child.id)
  const history = await store.listHistory(parent.scope)
  assert.deepEqual(await store.listHistory('another-user'), [])
  assert.equal(history[0].id, parent.id)
  assert.equal(history[0].hasLocalArchive, true)
  assert.equal(history[0].rawBytes, undefined)
  const saved = await store.loadHistory(parent.scope, parent.id)
  assert.deepEqual([...new Uint8Array(saved.archiveBytes)], [80,75,1])
  assert.equal(saved.rawBytes, undefined)
})

test('local history expires evidence after seven days and metadata after ninety days', async () => {
  let now = new Date('2026-11-12T07:30:45Z')
  const store = createShimadzuTaskStore({ adapter: memoryAdapter(), now: () => now })
  const record = task({ scope: 'local', startedAt: now.toISOString(), status: 'failed', partialArchiveBytes: new ArrayBuffer(2) })
  await store.saveHistory(record)
  now = new Date('2026-11-20T07:30:45Z')
  const expired = await store.listHistory('local')
  assert.equal(expired.length, 1)
  assert.equal(expired[0].hasLocalArchive, false)
  assert.equal((await store.loadHistory('local', record.id)).archiveBytes, undefined)
  now = new Date('2027-02-12T07:30:45Z')
  assert.deepEqual(await store.listHistory('local'), [])
})

test('full local history never evicts evidence or overwrites the active parent to start a rerun', async () => {
  const { createTaskRun, persistTaskRun } = await import('./shimadzuTaskLifecycle.mjs')
  const store = createShimadzuTaskStore({ adapter: memoryAdapter(), now: () => new Date('2026-11-12T07:30:45Z') })
  for (let i = 0; i < 100; i++) await store.saveHistory(task({ id: `retained-${i}`, status: 'failed', partialArchiveBytes: new Uint8Array([i]).buffer }))
  const parent = createTaskRun(task({ scope: 'user-1' }))
  await store.save(parent)
  await assert.rejects(persistTaskRun(createTaskRun({}, { parent }), { parent, store, cloud: { configured: false } }), /LOCAL_TASK_HISTORY_CAPACITY_REACHED/)
  assert.equal((await store.load('user-1')).id, parent.id)
  assert.equal((await store.listHistory('user-1')).length, 100)
  assert.deepEqual([...new Uint8Array((await store.loadHistory('user-1','retained-0')).archiveBytes)], [0])
})

test('stores workbook buffers separately and restores only the matching scope', async () => {
  const adapter = memoryAdapter()
  const store = createShimadzuTaskStore({ adapter, now: () => new Date('2026-08-03T00:00:00.000Z') })
  await store.save(task())

  assert.equal(adapter.values.size, 3)
  assert.equal(adapter.values.get('shimadzu-active:user-1:meta').rawBytes, undefined)
  assert.deepEqual([...new Uint8Array(adapter.values.get('shimadzu-active:user-1:raw'))], [1, 2, 3])
  assert.equal(await store.load('user-2'), null)

  const restored = await store.load('user-1')
  assert.equal(restored.name, '刷新恢复测试')
  assert.equal(restored.nextStage, 2)
  assert.deepEqual([...new Uint8Array(restored.sampleBytes)], [4, 5])
})

test('updates progress without replacing stored workbook buffers', async () => {
  const adapter = memoryAdapter()
  const store = createShimadzuTaskStore({ adapter })
  await store.save(task())
  const rawBefore = adapter.values.get('shimadzu-active:user-1:raw')
  const samplesBefore = adapter.values.get('shimadzu-active:user-1:samples')

  await store.update('user-1', { status: 'waiting_review', nextStage: 3, stageSummary: [{ stage: 2, status: 'WARN' }] })

  assert.strictEqual(adapter.values.get('shimadzu-active:user-1:raw'), rawBefore)
  assert.strictEqual(adapter.values.get('shimadzu-active:user-1:samples'), samplesBefore)
  const restored = await store.load('user-1')
  assert.equal(restored.status, 'waiting_review')
  assert.equal(restored.nextStage, 3)
})

test('persists a partial result archive with a failed task for resume and download', async () => {
  const adapter = memoryAdapter()
  const store = createShimadzuTaskStore({ adapter })
  const partial = new Uint8Array([9, 8, 7]).buffer
  await store.save(task({
    status: 'failed',
    error: { code: 'STAGE_GATE_FAILED', message: '步骤4未通过质量门禁', details: { stage: 4 } },
    partialArchiveBytes: partial,
    partialArchiveSha256: 'partial-sha',
    partialArchiveFileName: '失败测试_部分结果.zip',
  }))

  const restored = await store.load('user-1')
  assert.equal(restored.status, 'failed')
  assert.equal(restored.error.details.stage, 4)
  assert.deepEqual([...new Uint8Array(restored.partialArchiveBytes)], [9, 8, 7])
  assert.equal(restored.partialArchiveSha256, 'partial-sha')
  assert.equal(restored.partialArchiveFileName, '失败测试_部分结果.zip')
})

test('clears all active-task records', async () => {
  const adapter = memoryAdapter()
  const store = createShimadzuTaskStore({ adapter })
  await store.save(task())
  await store.clear('user-1')
  assert.equal(adapter.values.size, 0)
  assert.equal(await store.load('user-1'), null)
})

test('expires stale active inputs after seven days', async () => {
  const adapter = memoryAdapter()
  const storeAtStart = createShimadzuTaskStore({ adapter, now: () => new Date('2026-08-03T00:00:00.000Z') })
  await storeAtStart.save(task())

  const storeAfterExpiry = createShimadzuTaskStore({ adapter, now: () => new Date('2026-08-10T00:00:01.000Z') })
  assert.equal(await storeAfterExpiry.load('user-1'), null)
  assert.equal(adapter.values.size, 0)
})

test('preserves CV screening settings across task recovery', async () => {
  const adapter = memoryAdapter()
  const store = createShimadzuTaskStore({ adapter })
  await store.save(task({ enableCvScreening: true, cvThreshold: 12.5 }))
  const restored = await store.load('user-1')
  assert.equal(restored.enableCvScreening, true)
  assert.equal(restored.cvThreshold, 12.5)
})

test('preserves the independent water threshold setting and a cancelled audit archive', async () => {
  const adapter = memoryAdapter()
  const store = createShimadzuTaskStore({ adapter })
  const partial = new Uint8Array([5, 4, 3]).buffer
  await store.save(task({
    status: 'cancelled', enableClassification: false, enableWaterDetectionThreshold: true,
    error: { code: 'ANALYSIS_CANCELLED', message: 'ANALYSIS_CANCELLED' },
    partialArchiveBytes: partial, partialArchiveSha256: 'cancel-sha', partialArchiveFileName: 'cancelled_部分结果.zip',
  }))
  const restored = await store.load('user-1')
  assert.equal(restored.status, 'cancelled')
  assert.equal(restored.enableClassification, false)
  assert.equal(restored.enableWaterDetectionThreshold, true)
  assert.deepEqual([...new Uint8Array(restored.partialArchiveBytes)], [5, 4, 3])
})
