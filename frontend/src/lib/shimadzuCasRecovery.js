const text = value => String(value ?? '').trim()
const formula = value => text(value).replace(/\s+/g, '').toUpperCase()
const primaryName = value => text(value).split('$$')[0].replace(/\s+#\s*$/, '').trim()
const audit = ({ original, source, cid = 'NA', status }) => ({
  'CAS 原始值': original || 'NA', 'CAS 来源': source, 'PubChem CID': cid, 'CAS 补全状态': status,
})

export function createShimadzuCasRecoveryService({ proxyUrl = 'http://127.0.0.1:8787', fetchImpl = fetch } = {}) {
  const recover = async record => {
    const original = text(record?.['CAS #'])
    if (original && original !== '0-00-0') return { record, audit: audit({ original, source: '岛津原始值', status: '无需补全' }) }
    const name = primaryName(record?.Name)
    if (!name) return { record, review: audit({ original, source: '待人工确认', status: '待人工确认' }) }
    try {
      const identityResponse = await fetchImpl(`${proxyUrl.replace(/\/$/, '')}/pubchem?cas=${encodeURIComponent(name)}`)
      const identity = identityResponse.ok ? await identityResponse.json() : { found: false }
      const expectedMass = Number(record?.['Mol.Weight'])
      if (!identity?.found || formula(identity.molecular_formula) !== formula(record?.['Mol.Form']) || !Number.isFinite(expectedMass) || Math.abs(Number(identity.molecular_weight) - expectedMass) > 1) {
        return { record, review: audit({ original, source: '待人工确认', status: '待人工确认' }) }
      }
      const candidatesResponse = await fetchImpl(`${proxyUrl.replace(/\/$/, '')}/pubchem-cas-candidates?cid=${encodeURIComponent(identity.cid)}`)
      const candidates = candidatesResponse.ok ? await candidatesResponse.json() : { candidates: [] }
      if ((candidates.candidates || []).length !== 1) {
        return { record, review: audit({ original, source: '待人工确认', cid: String(identity.cid), status: '待人工确认' }) }
      }
      const cas = candidates.candidates[0]
      return { record: { ...record, 'CAS #': cas }, audit: audit({ original, source: 'PubChem 精确名称补全', cid: String(identity.cid), status: '已补全' }) }
    } catch {
      return { record, review: audit({ original, source: '待人工确认', status: '待人工确认' }) }
    }
  }
  return { recover }
}

export const shimadzuCasRecoveryService = createShimadzuCasRecoveryService()
