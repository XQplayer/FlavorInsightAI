const severityRank = Object.freeze({ FAIL: 0, REVIEW: 1, WARN: 2, PASS: 3 })

export function prioritizeShimadzuIssues(issues, limit = 4) {
  return [...(Array.isArray(issues) ? issues : [])]
    .map((issue, index) => ({ issue, index }))
    .sort((left, right) => (severityRank[left.issue?.severity] ?? 4) - (severityRank[right.issue?.severity] ?? 4) || left.index - right.index)
    .slice(0, limit)
    .map(entry => entry.issue)
}

const pick = (language, zh, en) => language === 'en' ? en : zh

function describeIssue(issue, language) {
  const headers = (Array.isArray(issue.missingHeaders) ? issue.missingHeaders : []).join(', ')
  let reason = issue.message || issue.code || pick(language, '任务异常，具体原因未记录。', 'The task failed without a recorded explanation.')
  let suggestion = pick(language, '下载错误证据，核对原始输入后再重试。', 'Download the error evidence and check the original inputs before retrying.')
  switch (issue.code) {
    case 'FAIL_Missing_Peak_Headers':
      reason = issue.sectionEmpty === true
        ? pick(language, '工作表缺失整段峰面积数据，仅保留峰表段标题。', 'The entire peak-area table is missing; only its section title remains.')
        : pick(language, '峰表未识别到必需的表头，无法读取峰编号和峰面积。', 'Required peak-table headers were not found, so peak numbers and areas cannot be read.')
      suggestion = pick(language, '从岛津软件重新导出该样品的完整峰表与检索结果，保存修订副本后重新分析。不要用其他平行样的峰面积代替。', 'Re-export the complete peak table and search results for this sample from Shimadzu, save a revised copy and rerun. Do not substitute peak areas from another replicate.')
      break
    case 'FAIL_Missing_Peak_Table':
      reason = pick(language, '工作表中未找到 MC Peak Table 峰表区域。', 'The MC Peak Table section was not found in this worksheet.')
      suggestion = pick(language, '重新导出包含峰编号、峰面积和相似度检索结果的完整工作表。', 'Re-export the complete worksheet with peak numbers, peak areas and similarity-search results.')
      break
    case 'FAIL_Missing_Search_Headers':
      reason = pick(language, '相似度检索结果缺少必需表头，无法关联第一候选化合物。', 'Required similarity-search headers are missing; Hit #1 compounds cannot be matched.')
      suggestion = pick(language, '检查并重新导出该样品的完整相似度检索结果，保留 Spectrum#、Hit #、CAS # 等原始表头。', 'Re-export the complete similarity-search results, retaining the original Spectrum#, Hit # and CAS # headers.')
      break
    case 'CONFIGURED_SOURCE_SHEET_MISSING':
      reason = pick(language, '样品配置中的名称没有匹配到原始工作簿中的同名工作表。', 'A configured sample has no matching worksheet in the raw workbook.')
      suggestion = pick(language, '核对样品名称和工作表名称。若多个样品纵向合并在一张表中，请按当前输入要求分别导出为同名工作表。', 'Check sample and worksheet names. For samples stacked in one sheet, export separate matching worksheets as required by the current input format.')
      break
    case 'INVALID_REPLICATE_GROUP_SIZE':
      reason = pick(language, `该分组的样品数量为 ${issue.count ?? '未知'}，不符合当前三个平行样的要求。`, `This group contains ${issue.count ?? 'an unknown number of'} samples instead of the required three replicates.`)
      suggestion = pick(language, '核对样品分组与纳入分析设置，只按实际实验设计修正配置。', 'Check grouping and inclusion settings against the actual experimental design.')
      break
    case 'COMPOUND_DATA_API_UNAVAILABLE':
    case 'WATER_THRESHOLD_DATA_UNAVAILABLE':
      reason = issue.message || pick(language, '联网补充所需的数据服务或数据库未成功加载。', 'A required enrichment service or database could not be loaded.')
      suggestion = pick(language, '检查网络和数据服务状态，稍后重新运行。保留部分结果与错误证据。', 'Check the network and data service, then rerun. Keep the partial results and error evidence.')
      break
    default: break
  }
  let evidence = ''
  if (Number.isInteger(issue.sourceRow) && issue.sourceRow > 0) {
    evidence = pick(language, `原始工作表第 ${issue.sourceRow} 行`, `Source worksheet row ${issue.sourceRow}`)
    if (Number.isInteger(issue.nextSectionRow) && issue.nextSectionRow > 0) {
      evidence += pick(language, `；下一数据段从第 ${issue.nextSectionRow} 行开始`, `; the next section starts at row ${issue.nextSectionRow}`)
      if (issue.nextSectionTitle) evidence += ` (${issue.nextSectionTitle})`
    }
  }
  return { issue, reason, suggestion, evidence, missingHeaders: headers }
}

export function describeShimadzuFailure(error, language = 'zh') {
  const details = error?.details || {}
  const issues = Array.isArray(details.issues) ? details.issues : []
  const blockers = issues.filter(issue => issue.severity === 'FAIL')
  const review = issues.filter(issue => issue.severity === 'REVIEW')
  const selected = blockers.length ? blockers : review.length ? review : [error || {}]
  const stage = Number.isInteger(details.stage) ? details.stage : null
  const stages = Array.isArray(details.completedStages) ? details.completedStages : []
  const summary = stages.findLast(entry => entry.stage === stage || (stage !== null && String(entry.stage).startsWith(`${String(stage).padStart(2, '0')}_`)))
  return {
    stage,
    blockingCount: blockers.length,
    warningCount: issues.filter(issue => issue.severity === 'WARN').length,
    reviewCount: review.length,
    causes: selected.map(issue => describeIssue(issue, language)),
    counts: summary?.counts || null,
    technicalIssues: prioritizeShimadzuIssues(issues, 50),
    issueCount: issues.length,
    notices: Array.isArray(details.contextWarnings) ? details.contextWarnings : [],
  }
}
