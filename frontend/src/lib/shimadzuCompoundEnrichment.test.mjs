import assert from 'node:assert/strict'
import test from 'node:test'

import { createShimadzuCompoundEnrichmentService } from './shimadzuCompoundEnrichment.js'

test('uses FlavorDB2 fields as the Stage 4 functional-group source', async () => {
  const service = createShimadzuCompoundEnrichmentService({
    fetchImpl: async url => ({
      ok: true,
      json: async () => url.includes('aroma_data_merged')
        ? [{ cas: '141-78-6', chinese_name: '乙酸乙酯' }]
        : url.includes('/fema?')
          ? { found: true, fema_number: '2414', flavor_profile: 'Aromatic, Brandy' }
          : { pubchem: { found: true, cid: 8857, title: 'ETHYL ACETATE', smiles: 'CCOC(=O)C' }, flavordb: { found: true, cid: 8857, functional_groups: ['carboxylic acid derivative', 'carboxylic acid ester'], flavor_profile: ['fruity'], odor: ['pineapple'], taste: ['sweet'] } },
    }),
    classifySmiles: async () => ({ 主要化合物类别: '酯类' }),
  })
  assert.deepEqual(await service.enrichCas('141-78-6'), {
    中文名: '乙酸乙酯', 常用英文名: 'Ethyl acetate', 主要官能团: 'carboxylic acid derivative；carboxylic acid ester', 化合物分类: '酯类',
    FEMA编号: '2414', FEMA风味描述: 'Aromatic, Brandy', 'FlavorDB2 CID': '8857', 'FlavorDB2风味描述': 'fruity；pineapple；sweet',
  })
})

test('uses NA fields when a CAS is unavailable from all enrichment sources', async () => {
  const service = createShimadzuCompoundEnrichmentService({
    fetchImpl: async () => ({ ok: false, json: async () => ({}) }),
    classifyCasValues: async () => new Map(),
  })
  assert.deepEqual(await service.enrichCas('missing'), {
    中文名: 'NA', 常用英文名: 'NA', 主要官能团: 'NA', 化合物分类: 'NA',
    FEMA编号: 'NA', FEMA风味描述: 'NA', 'FlavorDB2 CID': 'NA', 'FlavorDB2风味描述': 'NA',
  })
})
