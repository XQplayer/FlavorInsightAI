import assert from 'node:assert/strict'
import test from 'node:test'
import { createTaskIdentity, taskIdentity, taskLabel, taskArchiveFileName } from './taskIdentity.mjs'
import { createShimadzuTaskStore } from './shimadzuTaskStore.js'

const fixedCrypto = { getRandomValues(bytes) { bytes.set([0xa7, 0xc9, 0x2e]); return bytes } }
const identity = { taskNumber: 'FI-20261112-153045-A7C92E', taskName: '发酵试验', taskCreatedAt: '2026-11-12T07:30:45.000Z', parentTaskId: null, parentTaskNumber: null }

test('creates a fixed UTC+8 number, preserving names and rolling dates at midnight', () => {
  assert.deepEqual(createTaskIdentity({ name: '发酵试验', now: new Date('2026-11-12T07:30:45Z'), crypto: fixedCrypto }), identity)
  assert.equal(createTaskIdentity({ name: 'x', now: new Date('2026-12-31T16:00:00Z'), crypto: fixedCrypto }).taskNumber, 'FI-20270101-000000-A7C92E')
  assert.throws(() => createTaskIdentity({ name: 'x', now: new Date('invalid'), crypto: fixedCrypto }), /INVALID_TASK_DATE/)
  assert.throws(() => createTaskIdentity({ name: 'x', crypto: {} }), /SECURE_TASK_RANDOM_REQUIRED/)
})

test('same-second starts are distinct and reruns retain parent identity', () => {
  const now = new Date('2026-11-12T07:30:45Z')
  const numbers = Array.from({ length: 100 }, () => createTaskIdentity({ name: 'x', now }).taskNumber)
  assert.equal(new Set(numbers).size, 100)
  const rerun = createTaskIdentity({ name: identity.taskName, now, crypto: fixedCrypto, parent: { id: 'uuid-parent', ...identity } })
  assert.equal(rerun.parentTaskId, 'uuid-parent')
  assert.equal(rerun.parentTaskNumber, identity.taskNumber)
})

test('normalizes persisted cloud and local identity without numbering legacy records', () => {
  assert.deepEqual(taskIdentity({ id: 'uuid', source_names: { taskIdentity: identity } }), identity)
  assert.equal(taskIdentity({ id: 'old', name: '历史任务' }), null)
  assert.equal(taskLabel({ id: 'old', name: '历史任务' }), 'old 历史任务')
  assert.equal(taskLabel({ id: 'uuid', ...identity }), 'FI-20261112-153045-A7C92E 发酵试验')
})

test('names all archive states safely, preserving metadata and bounding long names', () => {
  assert.equal(taskArchiveFileName(identity, 'complete'), 'FI-20261112-153045-A7C92E_发酵试验_分析结果.zip')
  assert.equal(taskArchiveFileName(identity, 'failed'), 'FI-20261112-153045-A7C92E_发酵试验_失败证据与部分结果.zip')
  assert.equal(taskArchiveFileName(identity, 'cancelled'), 'FI-20261112-153045-A7C92E_发酵试验_取消审计与部分结果.zip')
  assert.equal(taskArchiveFileName({ ...identity, taskName: 'A:/B*? . ' }, 'complete'), 'FI-20261112-153045-A7C92E_A__B___分析结果.zip')
  const long = taskArchiveFileName({ ...identity, taskName: '样'.repeat(500) }, 'complete')
  assert.ok(long.length < 145)
  assert.ok(new TextEncoder().encode(long).length <= 255, 'download names must fit common filesystem byte limits')
  assert.equal(identity.taskName, '发酵试验')
})

test('public identity survives browser persistence without modifying input bytes', async () => {
  const values = new Map()
  const adapter = { getMany: async keys => keys.map(k => values.get(k)), putMany: async entries => entries.forEach(([k,v]) => values.set(k,v)), deleteMany: async keys => keys.forEach(k => values.delete(k)) }
  const store = createShimadzuTaskStore({ adapter, now: () => new Date('2026-11-12T07:30:45Z') })
  const rawBytes = new Uint8Array([1, 0, 2]).buffer
  await store.save({ id: 'uuid', ...identity, rawBytes, sampleBytes: new Uint8Array([3]).buffer })
  await store.update('local', { nextStage: 2 })
  const restored = await store.load('local')
  assert.deepEqual(taskIdentity(restored), identity)
  assert.deepEqual([...new Uint8Array(restored.rawBytes)], [1, 0, 2])
})
