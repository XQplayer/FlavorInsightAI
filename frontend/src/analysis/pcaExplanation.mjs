/** A bounded excerpt of an actual completed local R run. It is not gateway-verified evidence. */
export function pcaExplanationExcerpt(run) {
  const data = run?.result?.data
  if (run?.status !== 'completed' || run?.request?.analysis?.method !== 'pca' || run?.result?.method !== 'pca' ||
      !Array.isArray(data?.explained) || !Array.isArray(data?.scores) || !Array.isArray(data?.loadings) ||
      !Array.isArray(data?.sampleIds) || !Array.isArray(data?.featureIds) ||
      data.scores.length !== data.sampleIds.length || data.loadings.length !== data.featureIds.length ||
      !/^[0-9a-f]{64}$/i.test(run.requestHash || '') ||
      run.result.provenance?.datasetId !== run.request.dataset.id) throw new Error('PCA_RESULT_UNAVAILABLE')
  const safe = value => typeof value === 'string' ? value.slice(0, 48) : ''
  const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null
  const samples = new Map(run.request.dataset.samples.map(sample => [sample.id, sample]))
  const features = new Map(run.request.dataset.features.map(feature => [feature.id, feature]))
  const topLoadings = data.featureIds.map((id, index) => ({
    featureId: safe(id), name: safe(features.get(id)?.name), unit: safe(features.get(id)?.unit),
    pc1: finite(data.loadings[index]?.[0]), pc2: finite(data.loadings[index]?.[1]),
  })).filter(item => item.pc1 !== null).sort((a, b) => Math.abs(b.pc1) - Math.abs(a.pc1)).slice(0, 8)
  const sampleCoordinates = data.sampleIds.slice(0, 16).map((id, index) => ({
    sampleId: safe(id), group: safe(samples.get(id)?.group),
    pc1: finite(data.scores[index]?.[0]), pc2: finite(data.scores[index]?.[1]),
  }))
  return {
    method: 'pca', sourceStatus: 'client-provided completed R result; not independently reverified by AI gateway',
    synthetic: /synthetic/i.test(run.request.dataset.provenance?.source || '') || /synthetic/i.test(run.request.dataset.name || ''),
    datasetName: safe(run.request.dataset.name), requestHash: run.requestHash,
    datasetHash: run.planReceipt?.datasetHash || null,
    sampleCount: data.sampleIds.length, variableCount: data.featureIds.length,
    preprocessing: {
      impute: run.request.recipe?.impute?.method || 'none',
      scale: run.request.recipe?.scale?.method || 'none',
      transform: run.request.recipe?.transform?.method || 'none',
      center: run.request.analysis.center !== false,
    },
    engine: { version: run.result.provenance.engineVersion || null, rVersion: run.result.provenance.rVersion || null },
    explained: data.explained.slice(0, 2).map(finite),
    topLoadings, sampleCoordinates,
    omittedSampleCoordinates: Math.max(0, data.sampleIds.length - sampleCoordinates.length),
  }
}

export function pcaExplanationPrompt(excerpt) {
  const prefix = '请仅依据以下用户主动提供的、由本地 R 服务返回的 PCA 派生结果摘要解释。它未由 AI Gateway 独立复核；不能声称服务端验证。区分计算数值与解释性推断，不编造 P 值、显著性、OAV、因果或未列出的样本。说明 PCA 为探索性分析，记录数据来源、预处理、PC1/PC2 解释率、可见样本分布与主要载荷变量及单位；若样本坐标被截断，明确说明。\nPCA_RESULT_EXCERPT='
  const bounded = structuredClone(excerpt)
  let body = JSON.stringify(bounded)
  while (prefix.length + body.length > 3900 && bounded.sampleCoordinates.length > 2) {
    bounded.sampleCoordinates.pop()
    bounded.omittedSampleCoordinates++
    body = JSON.stringify(bounded)
  }
  while (prefix.length + body.length > 3900 && bounded.topLoadings.length > 2) {
    bounded.topLoadings.pop()
    body = JSON.stringify(bounded)
  }
  if (prefix.length + body.length > 3900) throw new Error('PCA_EXCERPT_TOO_LARGE')
  return prefix + body
}
