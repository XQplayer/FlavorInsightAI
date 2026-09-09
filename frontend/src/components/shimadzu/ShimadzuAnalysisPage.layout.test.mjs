import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('./ShimadzuAnalysisPage.jsx', import.meta.url), 'utf8')
const styles = await readFile(new URL('./ShimadzuAnalysisPage.css', import.meta.url), 'utf8')

test('keeps duplicate workflow explanations out of the hero', () => {
  assert.doesNotMatch(source, /从岛津原始工作簿出发/)
  assert.doesNotMatch(source, /shimadzu-hero-facts/)
  assert.doesNotMatch(source, /7 个审计节点|2 个 Excel 工作簿|当前浏览器处理/)
})

test('keeps the live browser engine status in the hero', () => {
  assert.match(source, /shimadzu-hero-status/)
  assert.match(source, /engine\.title/)
  assert.match(source, /engine\.detail/)
})

test('uses the approved Shimadzu data control deck shell', () => {
  assert.match(source, /data-ui-revision="data-control-deck-v4"/)
  assert.match(source, /className="shimadzu-deck-topbar"/)
  assert.match(source, /className="shimadzu-home-link"/)
  assert.match(source, />返回首页</)
  assert.match(source, /<h1>岛津风味数据分析控制舱<\/h1>/)
  assert.doesNotMatch(source, /className="science-nav search-science-nav"/)
  assert.doesNotMatch(source, /className="science-nav-links"/)
  assert.doesNotMatch(source, /className="science-language"/)
})

test('places the setup workspace before the workflow dock', () => {
  const setupIndex = source.indexOf('className="shimadzu-setup"')
  const workflowRenderIndex = source.lastIndexOf('<WorkflowMap job={job} />')

  assert.notEqual(setupIndex, -1)
  assert.notEqual(workflowRenderIndex, -1)
  assert.ok(setupIndex < workflowRenderIndex)
})

test('moves account and task access into the control deck workspace', () => {
  assert.doesNotMatch(source, /原始峰表 → 化合物筛查 → 平行补建 → 半定量 → 统计与作图矩阵/)
  assert.match(source, /className="shimadzu-deck-utility(?:\s|")/)
  assert.match(source, /href="#task-workbench"/)
  assert.match(source, /href="#account-panel"/)
  assert.match(source, /<AccountPanel/)
  assert.match(source, /<HistoryPanel/)
})

test('provides an accessible persistent light and dark theme switch', () => {
  assert.match(source, /shimadzu-analysis-theme/)
  assert.match(source, /localStorage\.getItem\(THEME_STORAGE_KEY\)/)
  assert.match(source, /localStorage\.setItem\(THEME_STORAGE_KEY, theme\)/)
  assert.match(source, /data-theme=\{theme\}/)
  assert.match(source, /className="shimadzu-theme-toggle"/)
  assert.match(source, /aria-pressed=\{theme === 'light'\}/)
  assert.match(source, /切换到浅色主题/)
  assert.match(source, /切换到深色主题/)
})

test('composes an explicit light control deck instead of mechanically inverting dark mode', () => {
  assert.match(styles, /\.shimadzu-page\[data-theme='light'\]/)
  assert.match(styles, /--sz-deck-bg:\s*#f3f6fb/)
  assert.match(styles, /--sz-deck-panel:\s*#ffffff/)
  assert.match(styles, /--sz-deck-text:\s*#162238/)
  assert.match(styles, /color-scheme:\s*light/)
  assert.match(styles, /\.shimadzu-page\[data-theme='light'\] \.shimadzu-monitor/)
  assert.match(styles, /\.shimadzu-theme-toggle:focus-visible/)
})

test('explains file readiness and disabled start conditions', () => {
  assert.match(source, /文件已准备，可以开始分析/)
  assert.match(source, /aria-live="polite"/)
  assert.match(source, /startFeedback\.buttonLabel/)
})

test('keeps implementation terms out of ordinary page copy', () => {
  assert.doesNotMatch(source, /科学规则已经由 skill 固定/)
  assert.doesNotMatch(source, /状态来自各步骤 manifest/)
  assert.match(source, /分析参数依据已确认的科研规则执行/)
})

test('enforces the minimum page type scale and keeps reduced-motion support', () => {
  const pixelSizes = [...styles.matchAll(/font-size:\s*([\d.]+)px/g)].map(match => Number(match[1]))
  assert.ok(pixelSizes.every(size => size === 0 || size >= 11))
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/)
})

test('persists active browser tasks and automatically restores their monitor', () => {
  assert.match(source, /createShimadzuTaskStore/)
  assert.match(source, /restoreActiveTask/)
  assert.match(source, /resumeFromStage/)
  assert.match(source, /刷新或重新打开后自动恢复/)
  assert.match(source, /页面关闭期间不会继续计算/)
})

test('does not present legacy cloud-only jobs as still computing', () => {
  assert.match(source, /interruptedJobIds/)
  assert.match(source, /已中断，需重新运行/)
  assert.match(source, /markInterrupted/)
})

test('exposes opt-in CV screening controls with a bounded decimal threshold', () => {
  assert.match(source, /enableCvScreening/)
  assert.match(source, /cvThreshold/)
  assert.match(source, /min="0"/)
  assert.match(source, /max="1000"/)
  assert.match(source, /step="1"/)
  assert.match(source, /enableCvScreening: taskEnableCvScreening/)
  assert.match(source, /cvThreshold: taskCvThreshold/)
})

test('keeps the scientific workflow features inside the control deck presentation', () => {
  assert.match(source, /data-control-deck-v4/)
  assert.match(source, /shimadzu-workflow-dock/)
  assert.match(source, /shimadzu-readiness-strip/)
  assert.match(source, /shimadzu-stage-rail/)
  assert.match(source, /shimadzu-workspace-tabs/)
})

test('exposes an opt-in PubChem SMARTS classification control', () => {
  assert.match(source, /enableClassification/)
  assert.match(source, /启用 CAS 结构分类/)
  assert.match(source, /PubChem SMILES/)
  assert.match(source, /enableClassification: taskEnableClassification/)
})

test('keeps the full workflow description below the compact control deck header', () => {
  assert.doesNotMatch(styles, /\.shimadzu-header \{ padding-top: 64px; \}/)
  assert.match(styles, /\.shimadzu-workflow-dock \.shimadzu-section-intro p \{ display: block;/)
  assert.match(styles, /\.shimadzu-workflow-dock \.shimadzu-flow-node > small \{ display: block;/)
})

test('uses a compact desktop split setup while preserving the mobile stack', () => {
  assert.match(styles, /@media \(min-width: 1101px\)/)
  assert.match(styles, /\.shimadzu-setup \{ grid-template-columns: minmax\(0, 1\.42fr\) minmax\(330px, \.78fr\); grid-template-areas: "input settings"; gap: 16px; \}/)
  assert.match(styles, /\.shimadzu-settings \{ display: block; \}/)
  assert.match(styles, /\.shimadzu-settings \.shimadzu-mode-field \{ display: grid; grid-template-columns: 1fr 1fr;/)
  assert.match(styles, /\.shimadzu-settings \.shimadzu-cv-field \{ display: grid; grid-template-columns: minmax\(0, 1fr\) 112px;/)
  assert.match(styles, /@media \(max-width: 820px\)/)
  assert.match(styles, /\.shimadzu-setup \{ grid-template-columns: 1fr; grid-template-areas: "input" "settings"; \}/)
})

test('provides a task desk entry and exposes stored failure context', () => {
  assert.match(source, /TaskDeskEntry/)
  assert.match(source, /href="#task-workbench"/)
  assert.match(source, /id="task-workbench"/)
  assert.match(source, /stage_summary/)
  assert.match(source, /shimadzu-history-error/)
})

test('keeps sticky work areas below the compact control deck top bar', () => {
  assert.match(styles, /\.shimadzu-workflow-dock \{ position: sticky; top: 12px;/)
  assert.match(styles, /\.shimadzu-stage-rail \{ position: sticky; top: 18px;/)
  assert.match(styles, /scroll-margin-top: 24px/)
})

test('keeps the idle state lightweight and only mounts the monitor for a job', () => {
  assert.match(source, /\{!job \? \(/)
  assert.match(source, /<AnalysisReadinessStrip/)
  assert.match(source, /<LiveMonitor job=\{null\}/)
  assert.match(source, /<LiveMonitor job=\{job\}/)
})

test('keeps the workflow dock singular and preserves the research utility surfaces', () => {
  assert.equal((source.match(/<WorkflowMap job=\{job\} \/>/g) || []).length, 1)
  assert.match(source, /<AnalysisSummary/)
  assert.match(source, /<WorkspaceTabs/)
  assert.match(source, /HistoryPanel/)
  assert.match(source, /AccountPanel/)
})

test('defines the dark control deck visual system and desktop work zones', () => {
  assert.match(styles, /--sz-deck-bg:\s*#090f1a/)
  assert.match(styles, /--sz-deck-panel:\s*#111a29/)
  assert.match(styles, /\.shimadzu-deck-topbar/)
  assert.match(styles, /\.shimadzu-deck-utility-link/)
  assert.match(styles, /\.shimadzu-setup \{ grid-template-columns: minmax\(0, 1\.42fr\) minmax\(330px, \.72fr\);/)
  assert.match(styles, /\.shimadzu-overview-grid \{[\s\S]*grid-template-columns: minmax\(0, 1\.18fr\) minmax\(360px, \.82fr\);/)
  assert.match(styles, /\.shimadzu-overview-grid \{[\s\S]*align-items: stretch;/)
})

test('defines explicit control deck treatments for every task terminal state', () => {
  assert.match(styles, /\.shimadzu-job-workspace\.state-running/)
  assert.match(styles, /\.shimadzu-job-workspace\.state-waiting_review/)
  assert.match(styles, /\.shimadzu-job-workspace\.state-failed/)
  assert.match(styles, /\.shimadzu-job-workspace\.state-complete/)
  assert.match(styles, /\.shimadzu-inline-error/)
  assert.match(source, /下载已完成步骤与错误证据/)
})

test('keeps the minimal deck shell and work zones usable at tablet and mobile widths', () => {
  assert.match(styles, /@media \(max-width: 1024px\)/)
  assert.match(styles, /@media \(max-width: 768px\)/)
  assert.match(styles, /@media \(max-width: 420px\)/)
  assert.match(styles, /\.shimadzu-deck-topbar \{ width: calc\(100% - 24px\);/)
  assert.match(styles, /\.shimadzu-setup \{ grid-template-columns: 1fr;/)
  assert.match(styles, /\.shimadzu-flow-track \{ overflow-x: auto;/)
})

test('keeps the account entry and both example downloads visible in the compact setup', () => {
  assert.match(source, /href="#account-panel"/)
  assert.match(source, /账号登录|账号管理/)
  assert.match(source, /templateHref=\{api\.templateUrl\('raw-example'\)\}/)
  assert.match(source, /templateHref=\{api\.templateUrl\('sample-info'\)\}/)
  assert.match(source, /下载原始工作簿示例/)
  assert.match(source, /下载样品信息模板/)
})

test('uses compact desktop upload cards without hiding template links', () => {
  assert.match(styles, /\.shimadzu-file-picker \{[\s\S]*?min-height: 96px;/)
  assert.match(styles, /\.shimadzu-template-link \{[\s\S]*?display: flex;/)
})
