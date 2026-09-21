import { classifyCompoundBySmarts } from './compoundClassification.js'
import { V2_COMPOUND_IDENTITY_COLUMNS } from '../shimadzu-core/v2-identity-columns.mjs'
import { formatSentenceCaseEnglishName } from './compoundNameFormat.js'

const NA = 'NA'
const defaultBaseUrl = typeof import.meta.env === 'object' ? import.meta.env.BASE_URL : '/'
const defaultProxyUrl = (typeof import.meta.env === 'object' ? import.meta.env.VITE_FEMA_API_URL : '') || 'http://127.0.0.1:8787'
const asText = value => String(value ?? '').trim() || NA
const descriptorText = flavordb => [...new Set([
  ...(flavordb?.flavor_profile || []), ...(flavordb?.odor || []), ...(flavordb?.taste || []),
].map(value => asText(value)).filter(value => value !== NA))].join('；') || NA

export const createShimadzuCompoundEnrichmentService = ({
  fetchImpl = fetch,
  classifySmiles = classifyCompoundBySmarts,
  baseUrl = defaultBaseUrl,
  proxyUrl = defaultProxyUrl,
  cache = new Map(),
} = {}) => {
  let localNamesPromise
  const loadLocalNames = async () => {
    if (!localNamesPromise) localNamesPromise = (async () => {
      try {
        const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/aroma_data_merged.json`)
        if (!response.ok) return new Map()
        return new Map((await response.json()).map(item => [asText(item.cas), asText(item.chinese_name)]))
      } catch { return new Map() }
    })()
    return localNamesPromise
  }
  const enrichCas = async cas => {
    const normalizedCas = asText(cas)
    if (normalizedCas === NA) return Object.fromEntries(V2_COMPOUND_IDENTITY_COLUMNS.map(column => [column, NA]))
    if (!cache.has(normalizedCas)) cache.set(normalizedCas, (async () => {
      const [localNames, compound, fema] = await Promise.all([
        loadLocalNames(),
        fetchImpl(`${proxyUrl.replace(/\/$/, '')}/compound?cas=${encodeURIComponent(normalizedCas)}`).then(response => response.ok ? response.json() : {}).catch(() => ({})),
        fetchImpl(`${proxyUrl.replace(/\/$/, '')}/fema?cas=${encodeURIComponent(normalizedCas)}`).then(response => response.ok ? response.json() : {}).catch(() => ({})),
      ])
      const pubchem = compound?.pubchem || {}
      const flavordb = compound?.flavordb || {}
      const smiles = pubchem.smiles || flavordb.smiles
      const classification = smiles ? await classifySmiles(smiles).catch(() => ({})) : {}
      const identity = {
        中文名: localNames.get(normalizedCas) || NA,
        常用英文名: formatSentenceCaseEnglishName(pubchem.title || flavordb.common_name) || NA,
        主要官能团: (flavordb.functional_groups || []).map(asText).filter(value => value !== NA).join('；') || NA,
        化合物分类: asText(classification.zh || classification.主要化合物类别),
        FEMA编号: asText(fema.fema_number),
        FEMA风味描述: asText(fema.flavor_profile),
        'FlavorDB2 CID': asText(flavordb.cid),
        'FlavorDB2风味描述': descriptorText(flavordb),
      }
      const source = pubchem.smiles ? 'PubChem' : flavordb.smiles ? 'FlavorDB2' : NA
      return {
        identity,
        audit: {
          CAS: normalizedCas,
          SMILES: smiles || NA,
          '结构来源': source,
          'SMARTS 命中规则': classification.matches?.map(match => match.key).join('；') || NA,
          '分类方法': classification.method || (smiles ? 'SMARTS' : NA),
          '可靠性': classification.reliable === false ? '低' : smiles ? '高' : '低',
          '失败原因': smiles ? (classification.reason || NA) : 'missing_smiles',
          '查询时间': new Date().toISOString(),
        },
      }
    })())
    return (await cache.get(normalizedCas)).identity
  }
  return {
    enrichCas,
    async enrichCasValues(values) {
      const casValues = [...new Set((values || []).map(asText).filter(value => value !== NA))]
      return new Map(await Promise.all(casValues.map(async cas => [cas, await cache.get(cas) || await (async () => { await enrichCas(cas); return cache.get(cas) })()])))
    },
  }
}

export const shimadzuCompoundEnrichmentService = createShimadzuCompoundEnrichmentService()
