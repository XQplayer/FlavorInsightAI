import { V2_WATER_DETECTION_THRESHOLD_COLUMNS } from '../shimadzu-core/v2-identity-columns.mjs'

const NA = 'NA'

export const WATER_DETECTION_THRESHOLD_COLUMNS = V2_WATER_DETECTION_THRESHOLD_COLUMNS

const emptyResult = () => Object.fromEntries(WATER_DETECTION_THRESHOLD_COLUMNS.map(column => [column, NA]))
const text = value => String(value ?? '').trim()
const normalizedCas = value => text(value)
const isWater = value => text(value) === '水'
const isDetection = value => ['d', '觉察'].includes(text(value).toLowerCase())

function normalizedValue(value, unit) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  const normalizedUnit = text(unit).replaceAll('µ', 'μ').toLowerCase().replaceAll(' ', '')
  const factors = { 'ng/l': 0.001, 'μg/l': 1, 'ug/l': 1, 'mg/l': 1000, 'g/l': 1000000, 'mg/kg': 1000 }
  const factor = factors[normalizedUnit]
  return factor == null ? null : numeric * factor
}

function scalarFromText(value, { inferWaterUnit = false } = {}) {
  const raw = text(value)
  if (!raw || /[<>≤≥~～]|\d\s*-\s*\d/.test(raw)) return null
  const match = raw.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(ng\/L|[μµu]g\/L|mg\/L|g\/L)\b/i)
  if (match) {
    const normalized = normalizedValue(match[1], match[2])
    return normalized == null ? null : { raw: `${match[1]} ${match[2].replace('µ', 'μ')}`, value: normalized, inferredUnit: false }
  }
  if (/\b(?:m?mol|ppm|ppb)\s*\/L\b/i.test(raw)) return null
  const inferred = inferWaterUnit ? raw.match(/(?:^|\s)d\s+(\d+(?:\.\d+)?)(?:\s|$)/i) : null
  if (!inferred) return null
  return { raw: `${inferred[1]} mg/kg（项目推定）`, value: normalizedValue(inferred[1], 'mg/kg'), inferredUnit: true }
}

function ordinaryCandidates(thresholds, cas) {
  return thresholds.flatMap(item => {
    if (normalizedCas(item?.cas) !== cas || !isWater(item?.medium)) return []
    return (item?.threshold_data || []).flatMap(entry => {
      const raw = typeof entry === 'string' ? entry : text(entry?.threshold ?? entry?.value)
      const type = typeof entry === 'object' ? entry?.type ?? entry?.threshold_type : raw.match(/(?:^|\s)([dr])(?:\s|$)/i)?.[1]
      if (!isDetection(type)) return []
      const parsed = scalarFromText(raw, { inferWaterUnit: true })
      if (!parsed) return []
      const source = raw.slice(0, raw.search(/(?:^|\s)d(?:\s|$)/i)).trim()
      const year = Math.max(...[...source.matchAll(/(?:19|20)\d{2}/g)].map(match => Number(match[0])), -Infinity)
      return [{ ...parsed, source: `${source || NA}${parsed.inferredUnit ? '（单位按项目约定推定为 mg/kg）' : ''}`, year }]
    })
  })
}

function bookCandidates(bookIndex, cas) {
  return (bookIndex?.records || []).flatMap(record => {
    if (normalizedCas(record?.entity_cas) !== cas || !isWater((record?.media || [])[0]) || !isDetection(record?.threshold_type)) return []
    const values = record?.values || []
    if (values.length !== 1 || values[0]?.high != null || text(values[0]?.low).match(/[<>≤≥~～]/)) return []
    const normalized = normalizedValue(values[0]?.low, values[0]?.unit)
    if (normalized == null) return []
    const raw = text(record?.raw_text) || `${values[0].low} ${values[0].unit}`
    const source = `书籍：${text(record?.book_title) || '酒类风味化学'}${Number.isFinite(record?.page) ? `，第${record.page}页` : ''}`
    return [{ raw, source, value: normalized }]
  })
}

function result(candidate) {
  return candidate ? {
    '水中觉察阈值原始数据': candidate.raw,
    '水中觉察阈值来源': candidate.source,
    '水中觉察阈值（μg/L）': candidate.value,
  } : emptyResult()
}

export const createShimadzuWaterDetectionThresholdService = ({
  fetchImpl = fetch,
  baseUrl = typeof import.meta.env === 'object' ? import.meta.env.BASE_URL : '/',
  loadThresholds = () => fetchImpl(`${baseUrl.replace(/\/$/, '')}/aroma_data_merged.json`).then(response => response.ok ? response.json() : []),
  loadBookIndex = () => fetchImpl(`${baseUrl.replace(/\/$/, '')}/book_flavor_chemistry_index.json`).then(response => response.ok ? response.json() : ({ records: [] })),
  cache = new Map(),
} = {}) => ({
  async resolve(value) {
    const cas = normalizedCas(value)
    if (!cas) return emptyResult()
    if (!cache.has(cas)) cache.set(cas, (async () => {
      const [thresholds, bookIndex] = await Promise.all([loadThresholds(), loadBookIndex()])
      const ordinary = ordinaryCandidates(thresholds, cas).sort((left, right) => right.year - left.year || left.value - right.value)
      if (ordinary.length) return result(ordinary[0])
      return result(bookCandidates(bookIndex, cas).sort((left, right) => left.value - right.value)[0])
    })().catch(() => emptyResult()))
    return cache.get(cas)
  },
})

export const shimadzuWaterDetectionThresholdService = createShimadzuWaterDetectionThresholdService()
