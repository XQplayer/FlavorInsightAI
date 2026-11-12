import assert from 'node:assert/strict'
import test from 'node:test'
import { createTaskRun, persistTaskRun } from './shimadzuTaskLifecycle.mjs'
import { taskIdentity } from './taskIdentity.mjs'
import { filterTaskRecords } from '../components/shimadzu/processingWorkspaceModel.mjs'

test('explicit rerun is a fresh run with parent identity, no stale archives and unchanged inputs', () => {
  const parent = createTaskRun({ name: '批次 A', scope: 'local', rawBytes: new ArrayBuffer(2), sampleBytes: new ArrayBuffer(3), enableClassification: true })
  Object.assign(parent, { status: 'failed', nextStage: 4, stageSummary: [{ stage: 0 }], error: { code: 'FAIL' }, partialArchiveBytes: new ArrayBuffer(9), partialDownloadUrl: 'blob:old', partialArchiveFileName: 'old.zip', expiresAt: 'yesterday' })
  const child = createTaskRun({}, { parent })
  assert.notEqual(child.id, parent.id)
  assert.notEqual(child.taskNumber, parent.taskNumber)
  assert.equal(child.parentTaskId, parent.id)
  assert.equal(child.parentTaskNumber, parent.taskNumber)
  assert.equal(child.name, '批次 A')
  assert.equal(child.rawBytes, parent.rawBytes)
  assert.equal(child.enableClassification, true)
  assert.equal(child.nextStage, 0)
  assert.deepEqual(child.stageSummary, [])
  for (const key of ['partialArchiveBytes', 'partialDownloadUrl', 'partialArchiveFileName', 'expiresAt']) assert.equal(child[key], undefined)
  assert.equal(parent.status, 'failed')
})

test('cloud creation and browser persistence complete before a task is ready; failures are recorded', async () => {
  const task = createTaskRun({ name: '云测试', scope: 'user', rawName: 'raw.xlsx', sampleName: 'samples.xlsx', rawSize: 3, sampleSize: 4 })
  const calls = []
  const cloud = { configured: true, createJob: async value => calls.push(['cloud', value]), updateJob: async (...args) => calls.push(['failure', ...args]) }
  await persistTaskRun(task, { cloud, store: { save: async value => calls.push(['browser', value]) } })
  assert.equal(calls[0][0], 'cloud')
  assert.equal(calls[1][0], 'browser')
  assert.deepEqual(calls[0][1].sourceNames.taskIdentity, { ...taskIdentity(task), taskId: task.id })
  assert.deepEqual(calls[0][1].sourceNames.raw, { name: 'raw.xlsx', size: 3 })
  await assert.rejects(persistTaskRun(task, { cloud, store: { save: async () => { throw new Error('STORAGE_FULL') } } }), /STORAGE_FULL/)
  assert.equal(calls.at(-1)[0], 'failure')
  assert.equal(calls.at(-1)[2].status, 'failed')
})

test('task list can locate a task by public number, UUID or name', () => {
  const task = createTaskRun({ name: '测试批次' })
  const record = { id: task.id, name: task.name, source_names: { taskIdentity: taskIdentity(task) }, status: 'complete', created_at: task.startedAt }
  for (const query of [task.taskNumber, task.id, '测试批次']) assert.equal(filterTaskRecords([record], { query }).length, 1)
  assert.equal(filterTaskRecords([record], { query: 'not-present' }).length, 0)
})
