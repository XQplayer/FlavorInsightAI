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

test('yields document title ownership only when embedded without skipping the worker lifecycle', () => {
  assert.match(source, /function ShimadzuAnalysisPage\(\{ embedded = false, language = 'zh', theme: controlledTheme, onNavigate, onHome \}\)/)
  assert.match(source, /useEffect\(\(\) => \{\s*if \(!embedded\) \{\s*document\.title = '岛津气质分析 \| HXQLab'\s*\}\s*workerClientRef\.current = createShimadzuWorkerClient\(\)/)
  assert.match(source, /workerClientRef\.current\?\.dispose\(\)/)
  assert.match(source, /\}, \[api, embedded\]\)/)
})

test('lets the platform own theme, language and navigation when embedded', () => {
  assert.match(source, /const theme = controlledTheme \?\? standaloneTheme/)
  assert.match(source, /data-language=\{language\}/)
  assert.match(source, /\{!embedded && \(/)
  assert.match(source, /onNavigate\?\.\('home'\)/)
})

test('exposes the processing workbench as three explicitly labelled regions', () => {
  assert.match(source, /<section[^>]+aria-labelledby="analysis-output-configuration-title"/)
  assert.match(source, /id="analysis-output-configuration-title"[^>]*>[\s\S]*?分析流程与数据导出配置[\s\S]*?Analysis workflow and data export configuration/)
  assert.match(source, /<section[^>]+aria-labelledby="data-import-preflight-title"/)
  assert.match(source, /id="data-import-preflight-title"[^>]*>[\s\S]*?数据导入与运行前检查[\s\S]*?Data import and preflight checks/)
  assert.match(source, /<section[^>]+aria-labelledby="process-monitor-results-title"/)
  assert.match(source, /id="process-monitor-results-title"[^>]*>[\s\S]*?分析任务控制台[\s\S]*?Analysis Console/)
})

test('does not offer step-by-step execution in the integrated workbench', () => {
  assert.doesNotMatch(source, /分步运行|单步运行|逐步运行|逐步复核|step[- ]by[- ]step/i)
  assert.doesNotMatch(source, /mode === 'step'|setMode\('step'\)/)
})

test('presents a 00 to 07 process rail without changing the seven worker stages', () => {
  assert.match(source, /view\.steps\.map/)
  assert.match(source, /data-console-step=\{step\.number\}/)
  assert.match(source, /WORKFLOW\[index - 1\]/)
  assert.doesNotMatch(source, /const PROCESS_RAIL/)
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

test('places the setup workspace before the unified console', () => {
  const setupIndex = source.indexOf('className="shimadzu-setup"')
  const workflowRenderIndex = source.lastIndexOf('<AnalysisConsole job={job}')

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

test('announces actual task state and exposes numeric progress to assistive technology', () => {
  assert.match(source, /taskFeedback\(job, language\)/)
  assert.match(source, /className="shimadzu-task-feedback"[^>]*role="status"[^>]*aria-live="polite"/)
  assert.match(source, /role="progressbar"/)
  assert.match(source, /aria-valuenow=\{Math\.round\(view\.progress\.completed \/ view\.progress\.total \* 100\)\}/)
  assert.match(styles, /\.shimadzu-task-feedback/)
  assert.match(source, /analysis-console-status-primary" role="status" aria-live="polite"/)
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

test('keeps scientific controls and one stage-detail surface in the deck', () => {
  assert.match(source, /data-control-deck-v4/)
  assert.match(source, /shimadzu-readiness-strip/)
  assert.match(source, /analysis-console-steps/)
  assert.match(source, /analysis-console-detail/)
  assert.match(source, /analysis-console-metrics/)
})

test('exposes an opt-in PubChem SMARTS classification control', () => {
  assert.match(source, /enableClassification/)
  assert.match(source, /启用 CAS 结构分类/)
  assert.match(source, /PubChem SMILES/)
  assert.match(source, /enableClassification: taskEnableClassification/)
})

test('keeps water detection thresholds independently enabled by default and persisted with tasks', () => {
  assert.match(source, /const \[enableWaterDetectionThreshold, setEnableWaterDetectionThreshold\] = useState\(true\)/)
  assert.match(source, /启用水中觉察阈值/)
  assert.match(source, /enableWaterDetectionThreshold: taskEnableWaterDetectionThreshold/)
  assert.match(source, /task\.enableWaterDetectionThreshold !== false/)
})

test('offers estimated reference OAV beside compound-enrichment controls and persists its dependency', () => {
  assert.match(source, /enableEstimatedReferenceOav/)
  assert.match(source, /启用估算参考 OAV/)
  assert.match(source, /setEnableWaterDetectionThreshold\(true\)/)
})

test('offers the audit archive after a task is cancelled', () => {
  assert.match(source, /job\.status === 'cancelled'/)
  assert.match(source, /下载取消审计与部分结果/)
})

test('provides English copy for the major processing controls, states, stages and result actions', () => {
  for (const copy of [
    'Analysis workflow and data export configuration',
    'Data import and preflight checks',
    'Analysis Console',
    'Enable CAS structural classification',
    'Enable water detection thresholds',
    'Seven-stage progress',
    'Analysis cancelled',
    'Download cancellation audit and partial results',
    'Run log and stage records',
  ]) assert.match(source, new RegExp(copy))
  assert.match(source, /enLabel: 'Input configuration and inventory'/)
  assert.match(source, /enLabel: 'Statistics, CV, CAS, and QC'/)
})

test('shows only the selected method and keeps the console compact', () => {
  assert.doesNotMatch(styles, /\.shimadzu-header \{ padding-top: 64px; \}/)
  assert.match(source, /selectedStage\?\.description/)
  assert.match(source, /selectedStage\.work\.map/)
  assert.match(styles, /\.analysis-console-detail-grid/)
})

test('keeps capabilities visible while advanced research settings begin collapsed', () => {
  const config = source.slice(source.indexOf('<section id="processing-configuration"'), source.indexOf('<section id="processing-import"'))
  assert.ok(config.indexOf('className="shimadzu-capability-grid"') < config.indexOf('<details className="shimadzu-configuration-details"'))
  assert.doesNotMatch(config, /<details className="shimadzu-configuration-details" open=/)
  assert.match(config, /高级科研参数|Advanced research parameters/)
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

test('keeps the console in normal flow with local horizontal scrolling', () => {
  assert.match(styles, /\.analysis-console-steps\s*\{[^}]*overflow-x:\s*auto/)
  assert.doesNotMatch(source, /<WorkflowMap|<StageRail/)
  assert.match(styles, /scroll-margin-top: 24px/)
})

test('keeps an explicit idle console and mounts job actions only for a job', () => {
  assert.match(source, /<AnalysisReadinessStrip/)
  assert.match(source, /<AnalysisConsole job=\{job\}/)
  assert.match(source, /job \? localizedTaskName/)
  assert.match(source, /actions=\{job &&/)
})

test('keeps the console singular and preserves research utility surfaces', () => {
  assert.equal((source.match(/<AnalysisConsole job=\{job\}/g) || []).length, 1)
  assert.match(source, /<AnalysisSummary/)
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
  assert.match(source, /state-\$\{view\.state\}/)
  assert.match(styles, /\.analysis-console-state\.state-running/)
  assert.match(styles, /\.analysis-console-state\.state-blocked/)
  assert.match(styles, /\.analysis-console-state\.state-failed/)
  assert.match(styles, /\.analysis-console-state\.state-complete/)
  assert.match(styles, /\.shimadzu-inline-error/)
  assert.match(source, /下载错误证据与部分结果/)
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

test('maps workbench colors to platform tokens and contains horizontal overflow locally', () => {
  assert.match(styles, /--sz-page:\s*var\(--platform-canvas/)
  assert.match(styles, /--sz-surface:\s*var\(--platform-surface/)
  assert.match(styles, /\.shimadzu-page\s*\{[\s\S]*overflow-x:\s*clip/)
  assert.match(styles, /\.analysis-console-steps\s*\{[^}]*overflow-x:\s*auto/)
  assert.match(styles, /\.shimadzu-history-table[\s\S]*overflow-x:\s*auto/)
  assert.match(styles, /\.shimadzu-page\[data-theme='light'\] \.shimadzu-monitor/)
})

test('keeps raw workbooks in the browser and never requests cloud input upload', () => {
  assert.doesNotMatch(source, /uploadInputs/)
  assert.doesNotMatch(source, /downloadInputUrl/)
})

test('completed current and historical tasks expose a scoped AI interpretation route', () => {
  assert.match(source, /item\.status === 'complete' && onExplain/)
  assert.match(source, /onExplain=\{onNavigate \? item => onNavigate\('assistant', \{ task_id: item\.id \}\)/)
  assert.match(source, /job\.status === 'complete' && onNavigate && cloud\.configured && session/)
})

test('uses one Analysis Console with a selectable 00–07 rail and one stage detail', () => {
  assert.match(source, /分析任务控制台|Analysis Console/)
  assert.match(source, /deriveAnalysisConsole/)
  assert.match(source, /className="analysis-console-steps"/)
  assert.match(source, /className="analysis-console-detail"/)
  assert.match(source, /aria-pressed=\{selectedStep === index\}/)
  assert.doesNotMatch(source, /<WorkflowMap job=\{job\}/)
  assert.doesNotMatch(source, /<StageRail job=\{job\}/)
  assert.doesNotMatch(source, /<LiveMonitor job=\{job\}/)
})

test('gives the current task priority while keeping logs and history available on demand', () => {
  assert.match(source, /<details[^>]*className="[^"]*analysis-console-log"/)
  assert.match(source, /<details[^>]*className="shimadzu-history-disclosure"/)
  assert.match(source, /view\.state === 'failed' \|\| view\.state === 'blocked'/)
  assert.match(source, /logRef\.current\.open = true/)
  assert.match(styles, /\.analysis-console-steps\s*\{[^}]*overflow-x:\s*auto/)
})

test('places workbook inputs side by side on wide screens and keeps the 00–07 flow readable', () => {
  assert.match(styles, /\.shimadzu-page\.is-embedded \.shimadzu-upload-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
  assert.match(styles, /\.analysis-console-steps\s*\{[^}]*grid-template-columns:\s*repeat\(8,/)
  assert.match(styles, /@media \(max-width: 600px\)[\s\S]*\.analysis-console-detail-grid \{ grid-template-columns: minmax\(0, 1fr\)/)
})

test('scopes GSAP presentation to the page and honors changing motion preferences', () => {
  assert.match(source, /gsap\.matchMedia\(\)/)
  assert.match(source, /prefers-reduced-motion: reduce/)
  assert.match(source, /useGSAP\([\s\S]*scope: pageRef/)
  assert.doesNotMatch(source, /import \{ ScrollTrigger \}/)
  assert.match(source, /summary\.focus\(\)/)
  assert.match(source, /getStageProgress\(job\)/)
})
