import assert from 'node:assert/strict'
import test from 'node:test'

import { prioritizeShimadzuIssues } from './shimadzuIssues.js'

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
