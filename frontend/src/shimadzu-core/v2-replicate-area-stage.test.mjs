import assert from 'node:assert/strict'
import test from 'node:test'

import { processV2ReplicateGroup } from './v2-replicate-area-stage.mjs'

test('stores input evidence only for samples in the current replicate group', () => {
  const group = { sampleGroup: 'G1', sampleNames: ['G1-1', 'G1-2', 'G1-3'] }
  const sampleResults = Object.fromEntries(['G1-1', 'G1-2', 'G1-3', 'OTHER-1'].map(sampleName => [sampleName, {
    records: [],
    lineage: [],
  }]))
  const sampleConfigs = Object.fromEntries(['G1-1', 'G1-2', 'G1-3', 'OTHER-1'].map(sampleName => [sampleName, {
    sampleName,
    internalStandardCas: '123-96-6',
    internalStandardName: '2-Octanol',
  }]))

  const result = processV2ReplicateGroup({ group, sampleResults, sampleConfigs })

  assert.deepEqual(Object.keys(result.inputEvidence.sampleResults), group.sampleNames)
  assert.deepEqual(Object.keys(result.inputEvidence.sampleConfigs), group.sampleNames)
})
