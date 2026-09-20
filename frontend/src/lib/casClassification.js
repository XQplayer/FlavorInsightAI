import { classifyCompoundBySmarts } from './compoundClassification.js'

const NA_CLASSIFICATION = Object.freeze({
  官能团名称: 'NA',
  主要化合物类别: 'NA',
})

const extractSmiles = payload => {
  const property = payload?.PropertyTable?.Properties?.[0]
  return property?.IsomericSMILES || property?.CanonicalSMILES || property?.SMILES || property?.ConnectivitySMILES || ''
}

export const createCasClassificationService = ({
  fetchImpl = fetch,
  classify = classifyCompoundBySmarts,
  cache = new Map(),
} = {}) => {
  const classifyCas = async cas => {
    const normalizedCas = String(cas || '').trim()
    if (!normalizedCas) return NA_CLASSIFICATION
    if (!cache.has(normalizedCas)) {
      cache.set(normalizedCas, (async () => {
        try {
          const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(normalizedCas)}/property/IsomericSMILES,CanonicalSMILES/JSON`
          const response = await fetchImpl(url)
          if (!response.ok) return NA_CLASSIFICATION
          const smiles = extractSmiles(await response.json())
          if (!smiles) return NA_CLASSIFICATION
        const result = await classify(smiles)
        if (!result?.reliable || !result?.zh) return NA_CLASSIFICATION
        const functionalGroups = [...new Set((result.matches || []).map(match => match.zh).filter(Boolean))]
        if (!functionalGroups.length) return NA_CLASSIFICATION
        return {
            官能团名称: functionalGroups.join('；') || 'NA',
            主要化合物类别: result.zh,
          }
        } catch {
          return NA_CLASSIFICATION
        }
      })())
    }
    return cache.get(normalizedCas)
  }

  return {
    classifyCas,
    async classifyCasValues(values) {
      const casValues = [...new Set((values || []).map(value => String(value || '').trim()).filter(Boolean))]
      const classifications = await Promise.all(casValues.map(async cas => [cas, await classifyCas(cas)]))
      return new Map(classifications)
    },
  }
}

export const casClassificationService = createCasClassificationService()
