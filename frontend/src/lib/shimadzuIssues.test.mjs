import assert from 'node:assert/strict'
import test from 'node:test'

import { prioritizeShimadzuIssues, describeShimadzuFailure } from './shimadzuIssues.js'

test('shows fatal Shimadzu issues before earlier warnings', () => {
  const issues = [
    { severity: 'WARN', code: 'WARN_1' },
    { severity: 'WARN', code: 'WARN_2' },
    { severity: 'WARN', code: 'WARN_3' },
    { severity: 'WARN', code: 'WARN_4' },
    { severity: 'FAIL', code: 'ACTUAL_FAILURE' },
  ]

  assert.deepEqual(prioritizeShimadzuIssues(issues, 4).map(issue => issue.code), [
    'ACTUAL_FAILURE', 'WARN_1', 'WARN_2', 'WARN_3',
  ])
})

// Structural regression fixture, not an experimental result.
const missingPeak = { severity: 'FAIL', code: 'FAIL_Missing_Peak_Headers', sampleName: 'L-1-36h-1', sourceSheet: 'L-1-36h-1', sourceWorkbook: 'raw.xlsx', missingHeaders: ['Peak#', 'Area'], sourceRow: 6, nextSectionRow: 7, sectionEmpty: true }

test('describes the blocking cause, evidence and remedy ahead of 380 warnings', () => {
  const result = describeShimadzuFailure({ code: 'STAGE_GATE_FAILED', details: {
    stage: 1, issues: [...Array.from({ length: 380 }, () => ({ severity: 'WARN', code: 'HIT1_NOT_FOUND' })), missingPeak],
    completedStages: [{ stage: '01_Hit1整理', counts: { samples: 36, retained: 683 } }],
  } }, 'zh')
  assert.equal(result.warningCount, 380)
  assert.equal(result.blockingCount, 1)
  assert.equal(result.causes[0].issue.sampleName, 'L-1-36h-1')
  assert.match(result.causes[0].reason, /整段峰面积数据/)
  assert.match(result.causes[0].evidence, /6.*7/)
  assert.match(result.causes[0].suggestion, /重新导出/)
  assert.equal(result.counts.retained, 683)
})

test('does not infer missing rows or an empty table from a legacy missing-header error', () => {
  const result = describeShimadzuFailure({ details: { issues: [{ severity: 'FAIL', code: 'FAIL_Missing_Peak_Headers', missingHeaders: ['Peak#', 'Area'] }] } }, 'en')
  assert.match(result.causes[0].reason, /header/i)
  assert.equal(result.causes[0].evidence, '')
  assert.doesNotMatch(result.causes[0].reason, /entire/)
})

test('preserves unknown errors without guessing a scientific cause', () => {
  const result = describeShimadzuFailure({ code: 'FUTURE_ERROR', message: 'original diagnostic' }, 'en')
  assert.equal(result.causes[0].reason, 'original diagnostic')
  assert.equal(result.blockingCount, 0)
  assert.equal(result.counts, null)
})
