import assert from 'node:assert/strict'
import test from 'node:test'

import { processV2SemiquantBatch, STAGE4_BASE_COLUMNS } from './v2-semiquant-stage.mjs'

test('retains analyte area and writes NA concentration when an internal standard is unavailable', () => {
  const sampleNames = ['S1', 'S2', 'S3']
  const groupColumns = [...STAGE4_BASE_COLUMNS, ...sampleNames.flatMap(name => [`${name} Area`, `${name} Area_Status`])]
  const metadata = { 'CAS #': '141-78-6', Name: 'Ethyl acetate', 'Mol.Form': 'C4H8O2', 'Mol.Weight': 88, 'Proc.To': 'NA', 'Ret. Index': 600, 'Retention Index': 600 }
  const stage3Data = {
    stage: '03_平行峰面积处理',
    sampleOrder: sampleNames,
    groupOrder: ['G'],
    groups: {
      G: {
        sampleGroup: 'G', sampleNames,
        groupTable: { columns: groupColumns, rows: [{ ...metadata, 'S1 Area': 100, 'S1 Area_Status': 'Measured', 'S2 Area': 120, 'S2 Area_Status': 'Measured', 'S3 Area': 140, 'S3 Area_Status': 'Measured' }] },
        internalStandards: {
          S1: { area: 50, detectedCas: '123-96-6', status: 'Measured_Internal_Standard' },
          S2: { area: 'NA', detectedCas: 'NA', status: 'Internal_Standard_Missing_Insufficient_Donors' },
          S3: { area: 55, detectedCas: '123-96-6', status: 'Measured_Internal_Standard' },
        },
        logs: { metadataSources: [{ cas: '141-78-6', sourceSample: 'S1' }] },
        samples: Object.fromEntries(sampleNames.map(name => [name, { records: [{ 'CAS #': '141-78-6' }], rawLineage: [{ sourceRow: 1 }] }])),
      },
    },
  }
  const sampleConfigs = sampleNames.map(sampleName => ({
    sampleName, sampleGroup: 'G', internalStandardCas: '123-96-6', internalStandardName: '2-Octanol',
    stockUgMl: 10, spikeUl: 10, systemMl: 10, volumeBasis: 'pre-spike', includeSpikeVolume: true, userFinalUgMl: 'NA',
  }))

  const result = processV2SemiquantBatch({ stage3Data, sampleConfigs })
  const unavailable = result.concentrationStatus.find(entry => entry.sampleName === 'S2')

  assert.equal(unavailable.area, 120)
  assert.equal(unavailable.concentration, 'NA')
  assert.equal(unavailable.status, 'Internal_Standard_Unavailable')
  assert.deepEqual(unavailable.issues, [{ severity: 'WARN', code: 'INTERNAL_STANDARD_UNAVAILABLE', message: 'Concentration was not calculated because the internal-standard area is unavailable' }])
})
