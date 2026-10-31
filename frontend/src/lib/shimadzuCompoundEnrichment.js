import { classifyCompoundBySmarts } from './compoundClassification.js'
import { V2_COMPOUND_IDENTITY_COLUMNS } from '../shimadzu-core/v2-identity-columns.mjs'
import { formatSentenceCaseEnglishName } from './compoundNameFormat.js'
import { SHIMADZU_DATA_API_URL, requestShimadzuJson } from './shimadzuDataRequest.js'

const NA = 'NA'
const defaultBaseUrl = typeof import.meta.env === 'object' ? import.meta.env.BASE_URL : '/'
const asText = value => String(value ?? '').trim() || NA
const descriptorText = flavordb => [...new Set([
  ...(flavordb?.flavor_profile || []), ...(flavordb?.odor || []), ...(flavordb?.taste || []),
].map(value => asText(value)).filter(value => value !== NA))].join('；') || NA

export const createShimadzuCompoundEnrichmentService = ({
  fetchImpl = fetch,
  classifySmiles = classifyCompoundBySmarts,
  baseUrl = defaultBaseUrl,
  proxyUrl = SHIMADZU_DATA_API_URL,
  cache = new Map(),
} = {}) => {
  let localNamesPromise
  const loadLocalNames = async () => {
    if (!localNamesPromise) localNamesPromise = (async () => {
      try {
        const rows = await requestShimadzuJson(`${baseUrl.replace(/\/$/, '')}/aroma_data_merged.json`, { fetchImpl })
        const names = new Map()
        for (const row of rows) {
          const previous = names.get(asText(row.cas)) || {}
          names.set(asText(row.cas), {
            chinese: asText(row.chinese_name) === NA ? previous.chinese : asText(row.chinese_name),
            english: asText(row.english_name) === NA ? previous.english : asText(row.english_name),
          })
        }
        return names
      } catch { localNamesPromise = undefined; return new Map() }
    })()
    return localNamesPromise
  }
  const loadEntry = async (cas, { signal } = {}) => {
    const normalizedCas = asText(cas)
    if (normalizedCas === NA) return { identity: Object.fromEntries(V2_COMPOUND_IDENTITY_COLUMNS.map(column => [column, NA])) }
    if (!cache.has(normalizedCas)) cache.set(normalizedCas, (async () => {
      const failures = []
      const query = async (source, path) => {
        try {
          const data = await requestShimadzuJson(`${proxyUrl.replace(/\/$/, '')}${path}`, { fetchImpl, signal })
          if (['error', 'upstream_unavailable', 'rate_limited'].includes(data.status)) failures.push(`${source}: ${data.error || data.status}`)
          return data
        } catch (error) {
          signal?.throwIfAborted()
          failures.push(`${source}: ${error.message}`)
          return {}
        }
      }
      const [localNames, pubchem, fema] = await Promise.all([
        loadLocalNames(),
        query('PubChem', `/pubchem?cas=${encodeURIComponent(normalizedCas)}`),
        query('FEMA', `/fema?cas=${encodeURIComponent(normalizedCas)}`),
      ])
      const flavordb = pubchem.cid ? await query('FlavorDB2', `/flavordb?cid=${encodeURIComponent(pubchem.cid)}`) : {}
      const smiles = pubchem.smiles || flavordb.smiles
      const classification = smiles ? await classifySmiles(smiles).catch(() => ({ reliable: false, reason: 'classification_unavailable' })) : {}
      const identity = {
        中文名: localNames.get(normalizedCas)?.chinese || NA,
        常用英文名: formatSentenceCaseEnglishName(pubchem.title || flavordb.common_name || localNames.get(normalizedCas)?.english) || NA,
        主要官能团: (flavordb.functional_groups || []).map(asText).filter(value => value !== NA).join('；') || NA,
        化合物分类: classification.reliable === false ? NA : asText(classification.zh || classification.主要化合物类别),
        FEMA编号: asText(fema.fema_number),
        FEMA风味描述: asText(fema.flavor_profile),
        'FlavorDB2 CID': asText(flavordb.cid),
        'FlavorDB2风味描述': descriptorText(flavordb),
      }
      const source = pubchem.smiles ? 'PubChem' : flavordb.smiles ? 'FlavorDB2' : NA
      return {
        identity,
        retryable: failures.length > 0 || classification.reliable === false,
        audit: {
          CAS: normalizedCas,
          SMILES: smiles || NA,
          '结构来源': source,
          'SMARTS 命中规则': classification.matches?.map(match => match.key).join('；') || NA,
          '分类方法': classification.method || (smiles ? 'SMARTS' : NA),
          '可靠性': failures.length || classification.reliable === false ? '低' : smiles ? '高' : '低',
          '失败原因': [...failures, ...(classification.reason ? [classification.reason] : []), ...(!smiles ? ['missing_smiles'] : [])].join('；') || NA,
          '查询时间': new Date().toISOString(),
        },
      }
    })())
    try {
      const entry = await cache.get(normalizedCas)
      if (entry.retryable) cache.delete(normalizedCas)
      return entry
    } catch (error) { cache.delete(normalizedCas); throw error }
  }
  return {
    async enrichCas(cas) { return (await loadEntry(cas)).identity },
    async enrichCasValues(values, options = {}) {
      const casValues = [...new Set((values || []).map(asText).filter(value => value !== NA))]
      const results = new Map()
      // Two CAS tasks at a time: at most four external requests, not hundreds.
      if (casValues.length) {
        try {
          // Render can serve a waking-up HTML page before JSON is available.
          await requestShimadzuJson(`${proxyUrl.replace(/\/$/, '')}/health`, {
            fetchImpl, signal: options.signal, attempts: 7, retryDelayMs: 10000, timeoutMs: 15000,
          })
        } catch (error) {
          options.signal?.throwIfAborted()
          throw Object.assign(new Error(`化合物信息服务暂时不可用，请稍后重试：${error.message}`), { code: 'COMPOUND_DATA_API_UNAVAILABLE' })
        }
      }
      await loadLocalNames()
      let next = 0
      await Promise.all(Array.from({ length: Math.min(2, casValues.length) }, async () => {
        while (next < casValues.length) {
          options.signal?.throwIfAborted()
          const cas = casValues[next++]
          results.set(cas, await loadEntry(cas, options))
        }
      }))
      return results
    },
  }
}

export const shimadzuCompoundEnrichmentService = createShimadzuCompoundEnrichmentService()
