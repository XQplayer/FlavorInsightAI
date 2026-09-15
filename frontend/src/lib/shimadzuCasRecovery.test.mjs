import assert from 'node:assert/strict'
import test from 'node:test'

import { createShimadzuCasRecoveryService } from './shimadzuCasRecovery.js'

const jsonResponse = body => ({ ok: true, json: async () => body })

test('fills a unique CAS only after exact PubChem identity checks', async () => {
  const service = createShimadzuCasRecoveryService({
    fetchImpl: async url => url.includes('pubchem-cas-candidates')
      ? jsonResponse({ found: true, cid: '45934107', candidates: ['914926-20-8'] })
      : jsonResponse({ found: true, cid: '45934107', title: 'Linoleyl myristate', molecular_formula: 'C32H60O2', molecular_weight: '476.8' }),
  })
  const result = await service.recover({ 'CAS #': '0-00-0', Name: 'Linoleyl myristate', 'Mol.Form': 'C32H60O2', 'Mol.Weight': 476 })
  assert.equal(result.record['CAS #'], '914926-20-8')
  assert.equal(result.audit['CAS 来源'], 'PubChem 精确名称补全')
})

test('keeps a CID-only result in review when PubChem has no valid CAS candidate', async () => {
  const service = createShimadzuCasRecoveryService({
    fetchImpl: async url => url.includes('pubchem-cas-candidates')
      ? jsonResponse({ found: false, cid: '527299', candidates: [] })
      : jsonResponse({ found: true, cid: '527299', title: 'Propyl eicosanoate', molecular_formula: 'C23H46O2', molecular_weight: '354.6' }),
  })
  const result = await service.recover({ 'CAS #': '0-00-0', Name: 'Eicosanoic acid, propyl ester', 'Mol.Form': 'C23H46O2', 'Mol.Weight': 354 })
  assert.equal(result.record['CAS #'], '0-00-0')
  assert.equal(result.review['PubChem CID'], '527299')
  assert.equal(result.review['CAS 补全状态'], '待人工确认')
})
