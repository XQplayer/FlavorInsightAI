import assert from 'node:assert/strict'
import test from 'node:test'

import { extractHit1 } from './parse-shimadzu.mjs'

test('keeps a sample with a peak table but no similarity-search results as an auditable warning', () => {
  const result = extractHit1([
    ['[MC Peak Table]'],
    ['Peak#', 'Area'],
    [1, 12345],
  ])

  assert.deepEqual(result.records, [])
  assert.deepEqual(result.lineage, [])
  assert.deepEqual(result.issues, [{
    severity: 'WARN',
    code: 'WARN_Missing_Search_Results',
    message: 'MS similarity search results section was not found; the sample was retained with no identified compounds',
  }])
})
