import test from 'node:test'
import assert from 'node:assert/strict'
import { finalIsConcentration, semiquantify } from './semiquant.mjs'

// Public synthetic fixture. Hand calculation: 100 ug/mL * (10/1000 mL) / 5 mL = 0.2 ug/mL.
// With response factor fixed to one, (200/100) * 0.2 = 0.4 ug/mL extract.
test('independent mass-balance reference for pre-spike semiquantitation', () => {
  const internalStandard = finalIsConcentration({ stockUgMl: 100, spikeUl: 10, systemMl: 5, basis: 'pre-spike', method: 'ignore' })
  assert.ok(Math.abs(internalStandard - 0.2) < 1e-12)
  const result = semiquantify({ analyteArea: 200, isArea: 100, isConcentration: internalStandard })
  assert.equal(result.status, 'Calculated')
  assert.ok(Math.abs(result.value - 0.4) < 1e-12)
})

// If the added spike volume is included, final volume is 5.01 mL.
test('independent volume-basis reference includes spike volume when requested', () => {
  const result = finalIsConcentration({ stockUgMl: 100, spikeUl: 10, systemMl: 5, basis: 'pre-spike', method: 'include' })
  assert.ok(Math.abs(result - 1 / 5.01) < 1e-12)
})

test('invalid internal-standard area and unconfirmed volume basis fail safely', () => {
  assert.equal(semiquantify({ analyteArea: 200, isArea: 0, isConcentration: 0.2 }).status, 'FAIL')
  assert.throws(() => finalIsConcentration({ stockUgMl: 100, spikeUl: 10, systemMl: 5, basis: 'unknown', method: 'ignore' }), { code: 'UNCONFIRMED_VOLUME_METHOD' })
})
