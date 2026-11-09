import assert from 'node:assert/strict'
import test from 'node:test'
import { taskFeedback } from './taskFeedback.mjs'

test('waiting and active states describe the real task rather than predicting completion', () => {
  assert.match(taskFeedback({ status: 'queued' }, 'en'), /waiting|queued/i)
  assert.match(taskFeedback({ status: 'running', next_stage: 3 }, 'en'), /processing is underway/i)
  assert.match(taskFeedback({ status: 'saving' }, 'en'), /saving/i)
  assert.doesNotMatch(taskFeedback({ status: 'running', next_stage: 3 }, 'en'), /complete/i)
})

test('terminal and review states give an accurate next action in both languages', () => {
  assert.match(taskFeedback({ status: 'complete' }, 'en'), /download/i)
  assert.match(taskFeedback({ status: 'failed' }, 'en'), /error.*rerun.*new task/i)
  assert.match(taskFeedback({ status: 'failed' }, 'zh'), /错误.*重新运行.*新任务/)
  assert.match(taskFeedback({ status: 'waiting_review' }, 'en'), /review.*continue/i)
  assert.match(taskFeedback({ status: 'interrupted' }, 'en'), /rerun/i)
})

test('unknown state has a safe fallback', () => {
  assert.match(taskFeedback({ status: 'unrecognized' }, 'en'), /check.*log/i)
  assert.match(taskFeedback(null, 'en'), /select.*workbook/i)
})
