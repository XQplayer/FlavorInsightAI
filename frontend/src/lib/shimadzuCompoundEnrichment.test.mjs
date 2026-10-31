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
          : url.includes('/pubchem?')
            ? { found: true, cid: 8857, title: 'ETHYL ACETATE', smiles: 'CCOC(=O)C' }
            : { found: true, cid: 8857, functional_groups: ['carboxylic acid derivative', 'carboxylic acid ester'], flavor_profile: ['fruity'], odor: ['pineapple'], taste: ['sweet'] },
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

test('bounds batch requests instead of flooding the public API', async () => {
  let active = 0
  let peak = 0
  const service = createShimadzuCompoundEnrichmentService({
    fetchImpl: async url => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise(resolve => setTimeout(resolve, 5))
      active -= 1
      return { ok: true, json: async () => url.includes('aroma_data_merged') ? [] : { found: false } }
    },
  })
  await service.enrichCasValues(Array.from({ length: 20 }, (_, index) => `test-${index}`))
  assert.ok(peak <= 4, `observed ${peak} simultaneous requests`)
})

test('uses lightweight identity endpoints and preserves PubChem when FlavorDB2 fails', async () => {
  const urls = []
  const service = createShimadzuCompoundEnrichmentService({
    fetchImpl: async url => {
      urls.push(url)
      if (url.endsWith('/health')) return { ok: true, json: async () => ({ ok: true }) }
      if (url.includes('aroma_data_merged')) return { ok: true, json: async () => [] }
      if (url.includes('/pubchem?')) return { ok: true, json: async () => ({ found: true, cid: 8857, title: 'ETHYL ACETATE', smiles: 'CCOC(=O)C' }) }
      return { ok: false, status: 503 }
    },
    classifySmiles: async () => ({ zh: '酯类', reliable: true }),
  })
  const entries = await service.enrichCasValues(['141-78-6'])
  assert.equal(entries.get('141-78-6').identity.常用英文名, 'Ethyl acetate')
  assert.equal(entries.get('141-78-6').identity.化合物分类, '酯类')
  assert.match(entries.get('141-78-6').audit['失败原因'], /503/)
  assert.equal(urls.some(url => url.includes('/compound?')), false)
})

test('keeps local names on network failure and retries failed CAS on the next run', async () => {
  let online = false
  const service = createShimadzuCompoundEnrichmentService({
    fetchImpl: async url => {
      if (url.endsWith('/health')) return { ok: true, json: async () => ({ ok: true }) }
      if (url.includes('aroma_data_merged')) return { ok: true, json: async () => [{ cas: '141-78-6', chinese_name: '乙酸乙酯', english_name: 'ETHYL ACETATE' }] }
      if (!online) return { ok: false, status: 503 }
      const data = url.includes('/pubchem?') ? { found: true, cid: 8857, title: 'ETHYL ACETATE' } : { found: true, cid: 8857, fema_number: '2414' }
      return { ok: true, json: async () => data }
    },
  })
  const first = (await service.enrichCasValues(['141-78-6'])).get('141-78-6')
  assert.equal(first.identity.常用英文名, 'Ethyl acetate')
  assert.match(first.audit['失败原因'], /503/)
  online = true
  assert.equal((await service.enrichCasValues(['141-78-6'])).get('141-78-6').identity.FEMA编号, '2414')
})

test('records a classifier initialization failure instead of reporting high reliability', async () => {
  const service = createShimadzuCompoundEnrichmentService({
    fetchImpl: async url => ({ ok: true, json: async () => url.includes('aroma_data_merged') ? [] : { found: true, cid: 8857, smiles: 'CCOC(=O)C' } }),
    classifySmiles: async () => { throw new Error('WASM download failed') },
  })
  const entry = (await service.enrichCasValues(['141-78-6'])).get('141-78-6')
  assert.equal(entry.identity.化合物分类, 'NA')
  assert.equal(entry.audit['可靠性'], '低')
  assert.match(entry.audit['失败原因'], /classification_unavailable/)
})
