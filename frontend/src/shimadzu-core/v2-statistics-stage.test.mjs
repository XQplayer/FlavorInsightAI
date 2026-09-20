import assert from 'node:assert/strict'
import test from 'node:test'

import { processV2Statistics } from './v2-statistics-stage.mjs'

test('keeps incomplete triplicate concentrations as NA statistics without aborting the batch', () => {
  const sampleOrder = ['S1', 'S2', 'S3']
  const stage4Data = {
    stage: '04_跨样品合并与半定量', sampleOrder, groupOrder: ['G'],
    sampleConfigs: sampleOrder.map(sampleName => ({ sampleName, sampleGroup: 'G', internalStandardCas: '123-96-6' })),
    inheritedLogs: { imputedTwoOfThree: [] },
    table: {
      columns: ['CAS #', 'Name', ...sampleOrder.map(name => `${name}（μg/mL）`)],
      rows: [{ 'CAS #': '141-78-6', Name: 'Ethyl acetate', 'S1（μg/mL）': 1.2, 'S2（μg/mL）': 'NA', 'S3（μg/mL）': 'NA' }],
    },
  }

  const result = processV2Statistics({ stage4Data, cvThreshold: 30, enableCvScreening: true })

  assert.equal(result.groupStatistics[0].status, 'Incomplete_Triplicate')
  assert.equal(result.groupStatistics[0].mean, 'NA')
  assert.equal(result.groupStatistics[0].sd, 'NA')
  assert.equal(result.groupStatistics[0].cv, 'NA')
  assert.equal(result.counts.incompleteGroups, 1)
})
