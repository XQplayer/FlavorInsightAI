import { useState } from 'react'
import { confirmAnalysis, prepareAnalysis } from '../../analysis/agentPlan.mjs'

const initialPrompt = () => {
  try {
    const value = sessionStorage.getItem('flavor-pca-prompt') || ''
    sessionStorage.removeItem('flavor-pca-prompt')
    return value.slice(0, 4000)
  } catch { return '' }
}

export default function PcaAgentPanel({ dataset, available, busy, dirty, onConfirm, t }) {
  const [prompt, setPrompt] = useState(initialPrompt)
  const [plan, setPlan] = useState(null)
  const [error, setError] = useState('')
  const [planning, setPlanning] = useState(false)
  const visiblePlan = plan?.datasetId === dataset?.id ? plan : null
  const changeRecipe = (section, key, value) => setPlan(current => ({ ...current, recipe: { ...current.recipe, [section]: { ...current.recipe[section], [key]: value } } }))
  const inspect = async () => {
    setPlanning(true); setError(''); setPlan(null)
    try { setPlan(await prepareAnalysis(dataset, prompt)) }
    catch (reason) { setError(reason.message) }
    finally { setPlanning(false) }
  }
  const confirm = async () => {
    setPlanning(true); setError('')
    try { const bound = await confirmAnalysis(plan, dataset); onConfirm(bound.request, bound.receipt) }
    catch (reason) { setError(reason.message) }
    finally { setPlanning(false) }
  }
  return <section className="analysis-section analysis-agent-plan" aria-label={t('Agents SAI PCA planning', 'Agents SAI PCA 规划')}>
    <h2>{t('Agents SAI · plan a PCA', 'Agents SAI · 规划 PCA')}</h2>
    <p>{t('Inspect the selected local snapshot, review the suggested settings, then confirm before real R computation. Planning is deterministic; no raw matrix is sent to GPT.', '检查当前本地快照、核对建议参数，然后确认才会调用真实 R 计算。此处规划是确定性规则，不向 GPT 发送原始矩阵。')}</p>
    <label className="analysis-agent-prompt">{t('Research question', '科研问题')}
      <textarea value={prompt} onChange={event => { setPrompt(event.target.value); setPlan(null) }} maxLength={4000} rows={2} placeholder={t('Analyze overall patterns with PCA', '帮我分析整体差异，先做 PCA')} />
    </label>
    <div className="analysis-toolbar"><button type="button" disabled={!dataset || !prompt.trim() || busy || dirty || planning} onClick={inspect}>{t('Inspect dataset and recommend', '检查数据并推荐')}</button></div>
    {!dataset && <p role="status">{t('Import or restore a dataset first.', '请先导入或恢复数据集。')}</p>}
    {dirty && <p role="status">{t('Apply or discard the pending metadata draft first.', '请先应用或丢弃待处理的元数据草稿。')}</p>}
    {error && <p role="alert">{error}</p>}
    {visiblePlan && <div className="analysis-agent-card">
      <h3>{t('Review required · exploratory PCA', '待确认 · 探索性 PCA')}</h3>
      <p>{plan.inspection.datasetName} · {plan.inspection.sampleCount} {t('samples', '个样品')} × {plan.inspection.numericFeatureCount} {t('numeric variables', '个数值变量')} · SHA-256 {plan.datasetHash.slice(0, 16)}…</p>
      <p>{t('Groups', '分组')}: {Object.entries(plan.inspection.groups).map(([label, count]) => `${label}: ${count}`).join(' · ') || t('not provided', '未提供')} · {t('Units', '单位')}: {plan.inspection.units.join(', ') || t('unrecorded', '未记录')}</p>
      <p>{t('Missing cells', '缺失单元格')}: {plan.inspection.missingCount} · {t('constant variables', '常量变量')}: {plan.inspection.constantFeatureIds.length} · {t('biological units with IDs', '有标识的生物学单位')}: {plan.inspection.design.biologicalUnitCount}</p>
      <p>{t('Independence', '独立性')}: {plan.inspection.design.independence}. {t('Names alone never prove independent biological replication.', '样品名称本身不能证明独立生物学重复。')}</p>
      {plan.recommendation.warnings.length > 0 && <ul className="analysis-agent-warnings">{plan.recommendation.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
      <div className="analysis-grid">
        <label>{t('Components', '主成分数')}<input type="number" min="1" max={Math.min(plan.inspection.sampleCount - 1, plan.inspection.numericFeatureCount)} value={plan.analysis.components} onChange={event => setPlan(current => ({ ...current, analysis: { ...current.analysis, components: Number(event.target.value) } }))} /></label>
        <label>{t('Scaling', '标准化')}<select value={plan.recipe.scale.method} onChange={event => changeRecipe('scale', 'method', event.target.value)}><option value="none">none</option><option value="uv">UV</option><option value="pareto">Pareto</option><option value="center">center</option></select></label>
        <label>{t('Missing-value strategy', '缺失值策略')}<select value={plan.recipe.impute.method} onChange={event => changeRecipe('impute', 'method', event.target.value)}><option value="none">{t('Stop on missing', '遇缺失停止')}</option><option value="median">{t('Explicit median fill', '明确中位数补值')}</option></select></label>
        <label>{t('Constant variables', '常量变量')}<select value={plan.recipe.filter.zeroVariance} onChange={event => changeRecipe('filter', 'zeroVariance', event.target.value)}><option value="keep">{t('Keep', '保留')}</option><option value="drop">{t('Drop with audit', '剔除并记录')}</option></select></label>
      </div>
      <label className="analysis-agent-check"><input type="checkbox" checked={plan.analysis.center} onChange={event => setPlan(current => ({ ...current, analysis: { ...current.analysis, center: event.target.checked } }))} />{t('Center variables in PCA unless already centered by recipe', 'PCA 中心化变量（配方已中心化时不重复）')}</label>
      {plan.inspection.units.length > 1 && <label className="analysis-agent-check"><input type="checkbox" checked={plan.recipe.filter.allowMixedUnits} onChange={event => changeRecipe('filter', 'allowMixedUnits', event.target.checked)} />{t('I explicitly acknowledge mixed feature units', '我明确知悉混合特征单位')}</label>}
      <p>{t('PCA is descriptive. Score separation alone is not a significance test.', 'PCA 是探索性分析；得分图分离本身不是显著性检验。')}</p>
      <button type="button" className="analysis-agent-run" disabled={planning || busy || dirty || !available.includes('pca')} onClick={confirm}>{t('Confirm settings and run real PCA', '确认参数并运行真实 PCA')}</button>
      {!available.includes('pca') && <p role="status">{t('R analysis service is unavailable. No result will be simulated.', 'R 分析服务不可用；不会模拟计算结果。')}</p>}
    </div>}
  </section>
}
