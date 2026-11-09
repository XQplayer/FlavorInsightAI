import assert from 'node:assert/strict'
import test from 'node:test'
import { parseProcessingLocation, processingViewHref } from './processingRoutes.js'

test('processing subroutes are direct and the root defaults to new analysis', () => {
  assert.deepEqual(parseProcessingLocation('/FlavorInsightAI/data-processing/'), { view: 'new', taskId: '' })
  for (const view of ['monitor', 'results', 'tasks']) {
    assert.equal(parseProcessingLocation(`/FlavorInsightAI/data-processing/${view}/`).view, view)
    assert.equal(processingViewHref(view, '/FlavorInsightAI'), `/FlavorInsightAI/data-processing/${view}/`)
  }
  assert.equal(parseProcessingLocation('/FlavorInsightAI/shimadzu-analysis/').view, 'new')
})

test('task id is encoded, restored and never accepted from unrelated query keys', () => {
  const id = 'f9661b02-9313-4ab9-aa23-10770ef55322'
  const href = processingViewHref('results', '/FlavorInsightAI', id)
  assert.equal(href, `/FlavorInsightAI/data-processing/results/?task_id=${id}`)
  assert.deepEqual(parseProcessingLocation('/FlavorInsightAI/data-processing/results/', `?task_id=${id}`), { view: 'results', taskId: id })
  assert.deepEqual(parseProcessingLocation('/FlavorInsightAI/data-processing/results/', '?task_id=../../other'), { view: 'results', taskId: '' })
})

test('unknown processing views return the new-analysis workspace', () => {
  assert.equal(parseProcessingLocation('/FlavorInsightAI/data-processing/unknown/').view, 'new')
  assert.equal(processingViewHref('unknown', '/FlavorInsightAI'), '/FlavorInsightAI/data-processing/')
})
