import { casChecksumValid } from './normalize.mjs'

export function recoverExcelDateCas({ year, month, day }) {
  const paddedMonth = String(month).padStart(2, '0')
  const candidates = [
    `${year}-${paddedMonth}-${day}`,
    `${String(year % 100).padStart(2, '0')}-${paddedMonth}-${day}`,
  ]
  const validCandidates = candidates.filter(casChecksumValid)
  return validCandidates.length === 1
    ? { status: 'recovered', cas: validCandidates[0], candidates }
    : { status: 'unresolved', cas: null, candidates }
}
