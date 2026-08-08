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

test('uses the approved scientific workbench title', () => {
  assert.match(source, /<h1>岛津 GC–MS 风味数据分析工作台<\/h1>/)
})

test('places the workflow dock before the main setup workspace', () => {
  const setupIndex = source.indexOf('className="shimadzu-setup"')
  const workflowRenderIndex = source.lastIndexOf('<WorkflowMap job={job} />')

  assert.notEqual(setupIndex, -1)
  assert.notEqual(workflowRenderIndex, -1)
  assert.ok(workflowRenderIndex < setupIndex)
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

test('uses the hybrid research workbench presentation contract', () => {
  assert.match(source, /hybrid-research-workbench-v3/)
  assert.match(source, /shimadzu-workflow-dock/)
  assert.match(source, /shimadzu-readiness-strip/)
  assert.match(source, /shimadzu-stage-rail/)
  assert.match(source, /shimadzu-workspace-tabs/)
})

test('keeps the full workflow description and reserves space below the fixed navigation', () => {
  assert.match(styles, /\.shimadzu-header \{ padding-top: 64px; \}/)
  assert.match(styles, /\.shimadzu-workflow-dock \.shimadzu-section-intro p \{ display: block;/)
  assert.match(styles, /\.shimadzu-workflow-dock \.shimadzu-flow-node > small \{ display: block;/)
})

test('densifies the desktop idle setup without changing the mobile stack', () => {
  assert.match(styles, /@media \(min-width: 1101px\)/)
  assert.match(styles, /\.shimadzu-settings \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(styles, /@media \(max-width: 820px\)/)
  assert.match(styles, /\.shimadzu-settings \{ display: block; \}/)
})

test('keeps the idle state lightweight and only mounts the monitor for a job', () => {
  assert.match(source, /\{!job \? \(/)
  assert.match(source, /<AnalysisReadinessStrip/)
  assert.doesNotMatch(source, /<LiveMonitor job=\{null\}/)
  assert.match(source, /<LiveMonitor job=\{job\}/)
})

test('keeps the workflow dock singular and preserves the research utility surfaces', () => {
  assert.equal((source.match(/<WorkflowMap job=\{job\} \/>/g) || []).length, 1)
  assert.match(source, /<AnalysisSummary/)
  assert.match(source, /<WorkspaceTabs/)
  assert.match(source, /HistoryPanel/)
  assert.match(source, /AccountPanel/)
})

test('defines responsive hybrid layout hooks', () => {
  assert.match(styles, /\.shimadzu-workflow-dock/)
  assert.match(styles, /\.shimadzu-stage-rail/)
  assert.match(styles, /overflow-x:\s*auto/)
  assert.match(styles, /@media \(max-width: 1024px\)/)
})
