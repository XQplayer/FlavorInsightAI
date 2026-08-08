import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveDuplicateCas } from './duplicate-cas.mjs'
import { normalizeV2Sample } from './v2-sample-config.mjs'
import { processV2Statistics } from './v2-statistics-stage.mjs'

const duplicateRow = (cas, retIndex, libraryIndex, area, originalRowOrder, name = `row-${originalRowOrder}`) => ({
  cas, retIndex, libraryIndex, area, originalRowOrder, name,
})

test('browser snapshot preserves adjacent duplicate CAS delta-D rule', () => {
  const result = resolveDuplicateCas([
    duplicateRow('1', 1000, 1018, 10, 1, 'higher D'),
    duplicateRow('1', 1000, 1005, 20, 2, 'lower D'),
  ])
  assert.deepEqual(result.kept, [{ ...duplicateRow('1', 1000, 1005, 20, 2, 'lower D'), area: 30 }])
  assert.equal(result.decisionLog[0].action, 'MERGE_ADJACENT_WITHIN_20')
})

test('browser snapshot preserves per-sample internal-standard parameters', () => {
  const sample = normalizeV2Sample({
    sampleName: 'A-1', sampleGroup: 'A', matrixName: 'M', sampleForm: '液体',
    liquidAmountMl: 5, solidAmountG: 'NA', internalStandardCas: '123-96-6',
    internalStandardName: '2-Octanol', stockUgMl: 100, spikeUl: 20, systemMl: 5,
  })
  assert.equal(sample.stockUgMl, 100)
  assert.equal(sample.spikeUl, 20)
  assert.equal(sample.includeSpikeVolume, true)
})

test('browser snapshot uses sample SD and keeps CV equal to 30', () => {
  const sampleOrder = ['A-1', 'A-2', 'A-3']
  const row = { 'CAS #': '67-56-1', Name: 'Boundary 30' }
  for (const [index, sample] of sampleOrder.entries()) {
    row[`${sample} Area`] = 100
    row[`${sample}（μg/mL）`] = [7, 10, 13][index]
  }
  const output = processV2Statistics({
    stage4Data: {
      stage: '04_跨样品合并与半定量',
      sampleOrder,
      groupOrder: ['A'],
      sampleConfigs: sampleOrder.map(sampleName => ({ sampleName, sampleGroup: 'A', matrixName: 'M', internalStandardCas: '123-96-6' })),
      table: { columns: ['CAS #', 'Name', ...sampleOrder.flatMap(sample => [`${sample} Area`, `${sample}（μg/mL）`])], rows: [row] },
      inheritedLogs: { imputedTwoOfThree: [], removedOneOfThree: [], internalStandard: [] },
    },
    cvThreshold: 30,
  })
  assert.deepEqual([output.groupStatistics[0].mean, output.groupStatistics[0].sd, output.groupStatistics[0].cv], [10, 3, 30])
  assert.equal(output.groupStatistics[0].status, 'Retained_CV_At_Or_Below_Threshold')
})

const statisticsFixture = () => {
  const sampleOrder = ['A-1', 'A-2', 'A-3']
  const row = { 'CAS #': '67-56-1', Name: 'CV toggle fixture' }
  for (const [index, sample] of sampleOrder.entries()) {
    row[`${sample} Area`] = 100
    row[`${sample}（μg/mL）`] = [6, 10, 14][index]
  }
  return {
    stage4Data: {
      stage: '04_跨样品合并与半定量', sampleOrder, groupOrder: ['A'],
      sampleConfigs: sampleOrder.map(sampleName => ({ sampleName, sampleGroup: 'A', matrixName: 'M', internalStandardCas: '123-96-6' })),
      table: { columns: ['CAS #', 'Name', ...sampleOrder.flatMap(sample => [`${sample} Area`, `${sample}（μg/mL）`])], rows: [row] },
      inheritedLogs: { imputedTwoOfThree: [], removedOneOfThree: [], internalStandard: [] },
    },
  }
}

test('CV screening can be disabled while retaining calculated statistics', () => {
  const output = processV2Statistics({ ...statisticsFixture(), cvThreshold: 20, enableCvScreening: false })
  assert.equal(output.cvScreeningExecuted, false)
  assert.equal(output.cvReport.length, 0)
  assert.equal(output.groupStatistics[0].cv, 40)
  assert.deepEqual(output.triplicateAfter.rows, output.triplicateBefore.rows)
  assert.deepEqual(output.meanSdAfter.rows, output.meanSdBefore.rows)
  assert.equal(output.groupStatistics[0].status, 'CV_Screening_Not_Executed')
})

test('CV screening uses a custom threshold when enabled', () => {
  const output = processV2Statistics({ ...statisticsFixture(), cvThreshold: 20, enableCvScreening: true })
  assert.equal(output.cvScreeningExecuted, true)
  assert.equal(output.cvThreshold, 20)
  assert.equal(output.cvReport.length, 1)
  assert.equal(output.groupStatistics[0].status, 'Filtered_CV_Above_Threshold')
  assert.equal(output.cvReport[0].cvThreshold, 20)
  assert.equal(output.triplicateAfter.rows[0]['A-1（μg/mL）'], 'NA')
})
