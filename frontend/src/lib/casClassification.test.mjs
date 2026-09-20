import assert from 'node:assert/strict'
import test from 'node:test'

import { createCasClassificationService } from './casClassification.js'

test('classifies each unique CAS from PubChem SMILES and exposes Chinese export fields', async () => {
  const requested = []
  const service = createCasClassificationService({
    fetchImpl: async url => {
      requested.push(url)
      return { ok: true, json: async () => ({ PropertyTable: { Properties: [{ IsomericSMILES: 'CCOC(=O)C' }] } }) }
    },
    classify: async smiles => {
      assert.equal(smiles, 'CCOC(=O)C')
      return { reliable: true, zh: '酯类', matches: [{ zh: '酯类' }, { zh: '醚类' }] }
    },
  })

  const results = await service.classifyCasValues(['141-78-6', '141-78-6'])

  assert.equal(requested.length, 1)
  assert.deepEqual(results.get('141-78-6'), {
    官能团名称: '酯类；醚类',
    主要化合物类别: '酯类',
  })
})

test('accepts the current PubChem SMILES response field', async () => {
  const service = createCasClassificationService({
    fetchImpl: async () => ({ ok: true, json: async () => ({ PropertyTable: { Properties: [{ SMILES: 'CCOC(=O)C' }] } }) }),
    classify: async () => ({ reliable: true, zh: '酯类', matches: [{ zh: '酯类' }] }),
  })
  assert.deepEqual(await service.classifyCas('141-78-6'), { 官能团名称: '酯类', 主要化合物类别: '酯类' })
})

test('returns NA fields when PubChem has no usable structure', async () => {
  const service = createCasClassificationService({
    fetchImpl: async () => ({ ok: false, json: async () => ({}) }),
    classify: async () => { throw new Error('classification must not run') },
  })

  const results = await service.classifyCasValues(['not-a-cas'])

  assert.deepEqual(results.get('not-a-cas'), {
    官能团名称: 'NA',
    主要化合物类别: 'NA',
  })
})

test('returns NA fields when SMARTS has no matching functional group', async () => {
  const service = createCasClassificationService({
    fetchImpl: async () => ({ ok: true, json: async () => ({ PropertyTable: { Properties: [{ SMILES: 'CC' }] } }) }),
    classify: async () => ({ reliable: true, zh: '其他类', matches: [] }),
  })
  assert.deepEqual(await service.classifyCas('74-84-0'), { 官能团名称: 'NA', 主要化合物类别: 'NA' })
})
