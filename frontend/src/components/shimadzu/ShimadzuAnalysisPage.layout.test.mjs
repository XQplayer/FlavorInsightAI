import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('./ShimadzuAnalysisPage.jsx', import.meta.url), 'utf8')
const styles = await readFile(new URL('./ShimadzuAnalysisPage.css', import.meta.url), 'utf8')
const failureSource = await readFile(new URL('./ShimadzuFailureDetails.jsx', import.meta.url), 'utf8')

test('keeps one mounted browser worker and task recovery lifecycle', () => {
  assert.match(source, /workerClientRef\.current = createShimadzuWorkerClient\(\)/)
  assert.match(source, /workerClientRef\.current\?\.dispose\(\)/)
  assert.match(source, /createShimadzuTaskStore\(\)/)
  assert.match(source, /restoreActiveTask/)
  assert.match(source, /resumeFromStage/)
})

test('separates the four workspaces without former three-anchor navigation', () => {
  for (const view of ['new', 'monitor', 'results', 'tasks']) assert.match(source, new RegExp(`processingView === '${view}'`))
  assert.doesNotMatch(source, /<nav className="shimadzu-workbench-nav"/)
  for (const surface of ['PreflightPanel', 'AnalysisConsole', 'ResultsWorkspace', 'TaskManager']) assert.match(source, new RegExp(`<${surface}`))
})

test('new analysis retains local workbook controls and scientific defaults', () => {
  assert.match(source, /assertWorkbookFile\(file\)/)
  assert.match(source, /onDrop=\{handleDrop\}/)
  assert.match(source, /清除文件|Clear file/)

  assert.match(source, /templateHref=\{api\.templateUrl\('raw-example'\)\}/)
  assert.match(source, /templateHref=\{api\.templateUrl\('sample-info'\)\}/)
  assert.match(source, /const \[enableCvScreening, setEnableCvScreening\] = useState\(restoredDraft\?\.enableCvScreening \?\? false\)/)
  assert.match(source, /const \[enableClassification, setEnableClassification\] = useState\(restoredDraft\?\.enableClassification \?\? true\)/)
  assert.match(source, /const \[enableWaterDetectionThreshold, setEnableWaterDetectionThreshold\] = useState\(restoredDraft\?\.enableWaterDetectionThreshold \?\? true\)/)
  assert.match(source, /const \[enableEstimatedReferenceOav, setEnableEstimatedReferenceOav\] = useState\(restoredDraft\?\.enableEstimatedReferenceOav \?\? false\)/)
  assert.match(source, /参考导出，不自动作为正式 QC 门禁/)
  assert.doesNotMatch(source, /uploadInputs/)
})

test('completed current and historical tasks expose a scoped AI interpretation route', () => {
  assert.match(source, /item\.status === 'complete' && onExplain/)
  assert.match(source, /onExplain=\{onNavigate && cloud\.configured && session \? item => onNavigate\('assistant', \{ task_id: item\.id \}\)/)
  assert.match(source, /source\.status === 'complete' && onExplain && record/)
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

test('preflight does not claim unexecuted workbook structure checks passed', () => {
  assert.match(source, /structureState === 'pending'/)
  assert.match(source, /Worker 阶段 0 验证/)
  assert.match(source, /onRecheck/)
  assert.match(source, /canStart/)
})

test('monitor uses real stage status, observed timestamps and error evidence', () => {
  assert.match(source, /deriveProcessingStages\(job/)
  assert.match(source, /stageView\.steps\.map/)
  assert.match(source, /data-console-step=\{step\.number\}/)
  assert.match(source, /stageView\.completed\}\/\{stageView\.total/)
  assert.match(source, /role="progressbar"/)
  assert.match(source, /job\?\.started_at && job\?\.updated_at/)
  assert.match(source, /job\?\.error && <ShimadzuFailureDetails/)
  assert.match(source, /logRef\.current\.open = true/)
})

test('results and history only offer actual artifacts', () => {
  assert.match(source, /resultAvailability\(source\)/)
  assert.match(source, /downloadable/)
  assert.match(source, /selectedTaskId/)
  assert.match(source, /stage_summary/)
  assert.match(source, /isAdmin &&/)
})

test('preserves theme, language, motion preference and responsive uploads', () => {
  assert.match(source, /data-language=\{language\}/)
  assert.match(source, /data-theme=\{theme\}/)
  assert.match(source, /gsap\.matchMedia\(\)/)
  assert.match(source, /prefers-reduced-motion: reduce/)
  assert.match(styles, /\.shimadzu-page\.is-embedded \.shimadzu-upload-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
  assert.match(styles, /@media \(max-width: 600px\)/)
})
