const severityRank = Object.freeze({ FAIL: 0, REVIEW: 1, WARN: 2, PASS: 3 })

export function prioritizeShimadzuIssues(issues, limit = 4) {
  return [...(Array.isArray(issues) ? issues : [])]
    .map((issue, index) => ({ issue, index }))
    .sort((left, right) => (severityRank[left.issue?.severity] ?? 4) - (severityRank[right.issue?.severity] ?? 4) || left.index - right.index)
    .slice(0, limit)
    .map(entry => entry.issue)
}
