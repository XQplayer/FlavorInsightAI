// Local synthetic PCA pilot. Requires the existing R service on 8890 and a Vite
// preview on 5180 started with VITE_AI_PCA_ENABLED=true. Never targets production.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../..', import.meta.url))
const { chromium } = createRequire(process.env.ANALYSIS_PLAYWRIGHT_PACKAGE || 'C:/Users/hanxq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright')
const base = 'http://127.0.0.1:5180/FlavorInsightAI/data-analysis/'
const output = path.join(root, '_local/verification/ai-pca')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: process.env.ANALYSIS_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, reducedMotion: 'reduce' })
  const errors = [], chatPosts = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/ai/chat')) chatPosts.push(request.url()) })
  page.on('dialog', dialog => dialog.accept())
  await page.goto(base)
  await page.getByRole('heading', { name: /Data analysis|数据分析/u }).waitFor()
  await page.getByText(/Compute service: Ready|计算服务.*已就绪/u).waitFor()
  await page.getByRole('button', { name: /Load SYNTHETIC example|加载合成示例/u }).click()
  await page.getByRole('textbox', { name: /Research question|科研问题/u }).fill('帮我分析这份数据的整体差异，先做 PCA。')
  await page.getByRole('button', { name: /Inspect dataset and recommend|检查数据并推荐/u }).click()
  await page.getByRole('heading', { name: /Review required|待确认/u }).waitFor()
  await page.screenshot({ path: path.join(output, 'plan-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: /Confirm settings and run real PCA|确认参数并运行真实 PCA/u }).click()
  await page.waitForFunction(() => [...document.querySelectorAll('select')].some(select => select.closest('label')?.textContent?.match(/Run history|运行历史/u) && [...select.options].some(option => option.textContent.includes('pca · completed'))), null, { timeout: 90000 })
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: /Export raw result & audit JSON|导出原始结果及审计 JSON/u }).click()
  const downloaded = await pending
  const file = path.join(output, 'completed-run.json')
  await downloaded.saveAs(file)
  const run = JSON.parse(await readFile(file, 'utf8'))
  assert.equal(run.status, 'completed')
  assert.equal(run.request.analysis.method, 'pca')
  assert.equal(run.result.method, 'pca')
  assert.match(run.planReceipt?.datasetHash || '', /^[0-9a-f]{64}$/)
  assert.equal(run.result.data.explained.length > 1, true)
  assert.equal(run.result.data.scores.length, 24)
  assert.equal(run.result.data.loadings.length, 8)
  await page.screenshot({ path: path.join(output, 'result-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, 'mobile horizontal overflow')
  await page.screenshot({ path: path.join(output, 'result-mobile.png'), fullPage: true })
  await page.getByRole('button', { name: /Prepare bounded PCA result for AI explanation|准备有限 PCA 结果供 AI 解读/u }).click()
  await page.getByRole('heading', { name: /AI Research Assistant|AI 科研助手/u }).waitFor()
  const draft = await page.locator('#ai-research-input').inputValue()
  assert.match(draft, /PCA_RESULT_EXCERPT=/)
  assert.match(draft, /"explained":\[/)
  assert.equal(chatPosts.length, 0, 'PCA excerpt requires a separate explicit Send action')
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ status: 'PASS', synthetic: true, method: run.result.method, sampleCount: run.result.data.sampleIds.length, explained: run.result.data.explained.slice(0, 2), planReceipt: true, desktopAndMobile: true, aiDraftRequiresSend: true }))
} finally { await browser.close() }
