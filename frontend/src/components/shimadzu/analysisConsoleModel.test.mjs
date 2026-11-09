import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveAnalysisConsole } from './analysisConsoleModel.mjs'

const stages = (...statuses) => Array.from({ length: 7 }, (_, index) => ({
  index,
  status: statuses[index] || 'pending',
  counts: index === 0 && statuses[index] === 'PASS' ? { samples: 2 } : {},
}))

test('00 is input setup and 01–07 are exactly seven Worker stages', () => {
  const view = deriveAnalysisConsole({ fileReadiness: { ready: false }, engineState: 'ready' })
  assert.equal(view.state, 'pending')
  assert.deepEqual(view.progress, { completed: 0, total: 7 })
  assert.equal(view.activeStep, 0)
  assert.deepEqual(view.steps.map(step => step.number), ['00', '01', '02', '03', '04', '05', '06', '07'])
  assert.deepEqual(view.steps.map(step => step.runtimeIndex), [null, 0, 1, 2, 3, 4, 5, 6])
  assert.equal(view.steps[0].status, 'pending')
})

test('file checking and stage-zero validation do not fabricate progress', () => {
  const checking = deriveAnalysisConsole({ submitting: true, fileReadiness: { ready: true }, engineState: 'ready' })
  assert.equal(checking.state, 'checking')
  assert.equal(checking.steps[0].status, 'PASS')
  assert.equal(checking.progress.completed, 0)

  const running = deriveAnalysisConsole({ job: { status: 'running', next_stage: 0, stages: stages('running') }, fileReadiness: { ready: true }, engineState: 'ready' })
  assert.equal(running.state, 'checking')
  assert.equal(running.activeStep, 1)
  assert.equal(running.steps[1].status, 'running')
  assert.equal(running.progress.completed, 0)
})

test('invalid preflight parameters block setup without creating Worker progress', () => {
  const view = deriveAnalysisConsole({ fileReadiness: { ready: true }, cvReadiness: { valid: false }, hasInputFiles: true, engineState: 'ready' })
  assert.equal(view.state, 'pending')
  assert.equal(view.gate, 'blocked')
  assert.equal(view.steps[0].status, 'FAIL')
  assert.deepEqual(view.progress, { completed: 0, total: 7 })
})

test('later Worker events control the selected step and progress', () => {
  const view = deriveAnalysisConsole({ job: { status: 'running', next_stage: 2, stages: stages('PASS', 'PASS', 'running') }, fileReadiness: { ready: true }, engineState: 'ready' })
  assert.equal(view.state, 'running')
  assert.equal(view.activeStep, 3)
  assert.deepEqual(view.progress, { completed: 2, total: 7 })
  assert.equal(view.steps[3].status, 'running')
})

test('manual review and a failed QC gate are distinct from a generic failure', () => {
  const review = deriveAnalysisConsole({ job: { status: 'waiting_review', next_stage: 2, stages: stages('PASS', 'REVIEW') }, fileReadiness: { ready: true }, engineState: 'ready' })
  assert.equal(review.state, 'review')
  assert.equal(review.gate, 'review')
  assert.equal(review.activeStep, 2)

  const blocked = deriveAnalysisConsole({ job: { status: 'failed', next_stage: 4, stages: stages('PASS', 'PASS', 'PASS', 'PASS'), error: { code: 'STAGE_GATE_FAILED', details: { stage: 4, issues: [{ code: 'QC_INPUT', sampleName: 'S1' }] } } }, fileReadiness: { ready: true }, engineState: 'ready' })
  assert.equal(blocked.state, 'blocked')
  assert.equal(blocked.gate, 'blocked')
  assert.equal(blocked.activeStep, 5)
  assert.equal(blocked.steps[5].status, 'FAIL')
  assert.equal(blocked.progress.completed, 4)

  const failed = deriveAnalysisConsole({ job: { status: 'failed', stages: stages('PASS'), error: { code: 'WORKER_ERROR', details: { stage: 1 } } }, fileReadiness: { ready: true }, engineState: 'ready' })
  assert.equal(failed.state, 'failed')
  assert.equal(failed.gate, 'unknown')
  assert.equal(failed.activeStep, 2)
})

test('completion is seven of seven and result packaging is not a Worker step', () => {
  const complete = deriveAnalysisConsole({ job: { status: 'complete', stages: stages('PASS', 'WARN', 'PASS', 'PASS', 'PASS', 'PASS', 'PASS') }, fileReadiness: { ready: true }, engineState: 'ready' })
  assert.equal(complete.state, 'complete')
  assert.equal(complete.gate, 'warning')
  assert.deepEqual(complete.progress, { completed: 7, total: 7 })
  assert.equal(complete.activeStep, 7)
  assert.equal(complete.steps.length, 8)
  assert.equal(complete.steps[7].runtimeIndex, 6)
})
