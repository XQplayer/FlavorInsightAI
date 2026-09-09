export function formatSentenceCaseEnglishName(value) {
  const normalized = String(value ?? '').trim().replace(/\s+/g, ' ')
  if (!normalized) return ''
  const lower = normalized.toLowerCase()
  return lower.replace(/[a-z]/i, letter => letter.toUpperCase())
}
