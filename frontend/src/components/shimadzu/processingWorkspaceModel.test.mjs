import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveProcessingStages, filterTaskRecords, resultAvailability } from './processingWorkspaceModel.mjs'

test('00 is input preflight and 01–07 are six Worker stages plus real packaging', () => {
  const idle = deriveProcessingStages(null)
  assert.deepEqual(idle.steps.map(step => step.number), ['00', '01', '02', '03', '04', '05', '06', '07'])
  assert.deepEqual(idle.steps.map(step => step.label), ['运行前预检', 'Hit #1', '筛选', '平行处理', '半定量', '统计与 QC', '矩阵拆分', '结果包'])
  assert.equal(idle.completed, 0)
  assert.equal(idle.active, 0)
  assert.equal(deriveProcessingStages(null, { ready: true }).steps[0].status, 'pending', 'worksheet structure remains unchecked until Worker stage 0')
  const running = deriveProcessingStages({ status: 'running', stages: [{ status: 'PASS' }, { status: 'running' }] })
  assert.equal(running.steps[0].status, 'PASS')
  assert.equal(running.steps[1].status, 'running')
  assert.equal(running.completed, 0)
  const complete = deriveProcessingStages({ status: 'complete', downloadUrl: 'blob:abc', stages: Array.from({ length: 7 }, () => ({ status: 'PASS' })) })
  assert.equal(complete.completed, 7)
  assert.equal(complete.steps[7].status, 'PASS')
})

test('packaging stays pending when the Worker is finished but archive save is not', () => {
  const view = deriveProcessingStages({ status: 'saving', stages: Array.from({ length: 7 }, () => ({ status: 'PASS' })) })
  assert.equal(view.completed, 6)
  assert.equal(view.steps[7].status, 'running')
})

test('failed input validation selects preflight rather than the next analysis step', () => {
  const view = deriveProcessingStages({ status: 'failed', error: { details: { stage: 0 } }, stages: [{ status: 'FAIL' }] })
  assert.equal(view.active, 0)
  assert.equal(view.steps[0].status, 'FAIL')
  assert.equal(view.completed, 0)
})

test('results only expose actual reachable archives', () => {
  assert.equal(resultAvailability(null).downloadable, false)
  assert.equal(resultAvailability({ status: 'complete' }).downloadable, false)
  assert.equal(resultAvailability({ status: 'complete', downloadUrl: 'blob:abc' }).downloadable, true)
  assert.equal(resultAvailability({ status: 'complete', result_path: 'private.zip', result_expires_at: '2000-01-01' }, new Date('2026-11-10')).downloadable, false)
})

test('task list filters by name, status and sort without changing source order', () => {
  const records = [
    { id: 'a', name: 'First', status: 'complete', created_at: '2026-01-01' },
    { id: 'b', name: 'Second', status: 'failed', created_at: '2026-02-01' },
  ]
  assert.deepEqual(filterTaskRecords(records, { query: 'sec', status: 'failed', newestFirst: true }).map(item => item.id), ['b'])
  assert.deepEqual(filterTaskRecords(records, { newestFirst: true }).map(item => item.id), ['b', 'a'])
  assert.deepEqual(records.map(item => item.id), ['a', 'b'])
})
