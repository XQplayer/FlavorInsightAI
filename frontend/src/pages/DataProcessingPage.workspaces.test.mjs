import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const page = await readFile(new URL('../components/shimadzu/ShimadzuAnalysisPage.jsx', import.meta.url), 'utf8')
const shell = await readFile(new URL('../components/platform/PlatformShell.jsx', import.meta.url), 'utf8')

test('processing shell exposes one active, addressable secondary workspace', () => {
  for (const label of ['新建分析', '运行监控', '结果与报告', '任务管理']) assert.match(shell, new RegExp(label))
  assert.match(shell, /platform-shell__subnav-link/)
  assert.match(shell, /aria-expanded=\{item\.route === 'processing'/)
  assert.match(shell, /processingViewHref/)
})

test('page renders four independent workspace surfaces and no duplicate stage anchor navigation', () => {
  assert.match(page, /processingView === 'new'/)
  assert.match(page, /processingView === 'monitor'/)
  assert.match(page, /processingView === 'results'/)
  assert.match(page, /processingView === 'tasks'/)
  assert.doesNotMatch(page, /<nav className="shimadzu-workbench-nav"/)
})

test('file actions, preflight, results and task filtering remain accessible', () => {
  assert.match(page, /onDrop=\{handleDrop\}/)
  assert.match(page, /清除文件|Clear file/)
  assert.match(page, /重新检查|Recheck/)
  assert.match(page, /<ResultsWorkspace/)
  assert.match(page, /<TaskManager/)
})
