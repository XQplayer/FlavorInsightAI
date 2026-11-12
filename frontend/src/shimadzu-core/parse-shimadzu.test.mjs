import assert from 'node:assert/strict'
import test from 'node:test'

import { extractHit1 } from './parse-shimadzu.mjs'

test('reports source section rows for an empty peak table without inventing peak areas', () => {
  const result = extractHit1([
    { sourceRow: 6, cells: ['[MC Peak Table]'] },
    { sourceRow: 7, cells: ['[MS Similarity Search Results for Spectrum Process Table]'] },
  ])
  assert.equal(result.issues[0].code, 'FAIL_Missing_Peak_Headers')
  assert.equal(result.issues[0].sourceRow, 6)
  assert.equal(result.issues[0].nextSectionRow, 7)
  assert.equal(result.issues[0].sectionEmpty, true)
  assert.equal(result.records.length, 0)
})

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
