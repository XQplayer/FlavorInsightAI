import assert from 'node:assert/strict'
import test from 'node:test'

import { recoverExcelDateCas } from './cas-identity-recovery.mjs'

test('recovers a two-digit CAS prefix from an Excel date when its checksum is unique', () => {
  assert.deepEqual(recoverExcelDateCas({ year: 1960, month: 12, day: 8 }), {
    status: 'recovered',
    cas: '60-12-8',
    candidates: ['1960-12-8', '60-12-8'],
  })
})

test('recovers a four-digit CAS prefix from an Excel date when its checksum is unique', () => {
  assert.deepEqual(recoverExcelDateCas({ year: 2050, month: 9, day: 1 }), {
    status: 'recovered',
    cas: '2050-09-1',
    candidates: ['2050-09-1', '50-09-1'],
  })
})

test('keeps Excel dates unresolved when no candidate passes the CAS checksum', () => {
  assert.deepEqual(recoverExcelDateCas({ year: 2001, month: 1, day: 1 }), {
    status: 'unresolved',
    cas: null,
    candidates: ['2001-01-1', '01-01-1'],
  })
})
