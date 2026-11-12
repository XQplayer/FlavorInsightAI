// Public/synthetic fixtures only. No research data or external requests.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { createRequire } from 'node:module'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(path.join(root, 'frontend/package.json'))
const XLSX = require('xlsx')
const JSZip = require('jszip')
const { chromium } = await import(process.env.CODEX_E2E_PLAYWRIGHT || pathToFileURL(path.resolve(path.dirname(process.execPath), '../node_modules/playwright/index.mjs')).href)
const allocator = createServer()
await new Promise(resolve => allocator.listen(0, '127.0.0.1', resolve))
const port = allocator.address().port
await new Promise(resolve => allocator.close(resolve))
const url = `http://127.0.0.1:${port}/FlavorInsightAI/data-processing/`
const preview = spawn(process.execPath, [path.join(root, 'frontend/node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: path.join(root, 'frontend'), windowsHide: true, stdio: 'ignore' })
const resource = name => path.join(root, 'resources/shimadzu/templates', name)
let browser
async function choose(page, raw, name = '编号回归测试', classification = false) {
  await page.goto(url)
  await page.locator('.shimadzu-run-button').waitFor()
  await page.locator('input[type="file"]').nth(0).setInputFiles(raw)
  await page.locator('input[type="file"]').nth(1).setInputFiles(resource('Shimadzu_Sample_Internal_Standard_Template.xlsx'))
  await page.locator('.processing-task-name input').fill(name)
  await page.locator('.shimadzu-configuration-details > summary').click()
  await page.getByRole('checkbox', { name: /Enable CAS structural classification|启用 CAS 结构分类/ }).setChecked(classification)
  await page.getByRole('checkbox', { name: /Enable water detection thresholds|启用水中觉察阈值/ }).uncheck()
  await page.locator('.shimadzu-configuration-details > summary').click()
  await page.locator('.shimadzu-run-button').click()
}
const numberFrom = async page => (await page.locator('.analysis-console-status-primary').innerText()).match(/FI-\d{8}-\d{6}-[A-F0-9]{6}/)?.[0]
async function download(page, link, expected) {
  const waiting = page.waitForEvent('download')
  await link.click()
  const result = await waiting
  assert.equal(result.suggestedFilename(), expected)
  const zip = await JSZip.loadAsync(await readFile(await result.path()))
  const run = JSON.parse(await zip.file('v2-run.json').async('string'))
  assert.ok(expected.startsWith(run.parameters.taskIdentity.taskNumber))
  return run
}
try {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(url)).ok) break } catch { /* starting */ }
    if (i === 49) throw new Error('PREVIEW_START_FAILED')
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  try { browser = await chromium.launch({ headless: true }) } catch { browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }) }
  await mkdir(path.join(root, '_local/verification/task-traceability'), { recursive: true })
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 950 }, acceptDownloads: true })
    await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort())
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await choose(page, resource('Shimadzu_Raw_Workbook_Example.xlsx'))
    await page.locator('.analysis-console.state-complete').waitFor({ timeout: 30000 })
    const completeNumber = await numberFrom(page)
    assert.ok(completeNumber, 'created task must expose its public number')
    assert.equal(await page.locator('.analysis-console-status-primary > strong').evaluate(node => node.scrollWidth <= node.clientWidth + 1), true, 'task number and name must be fully visible, not clipped')
    await page.getByRole('button', { name: /View results and reports|查看结果与报告/ }).click()
    await download(page, page.locator('.processing-result-download a[download]'), `${completeNumber}_编号回归测试_分析结果.zip`)
    if (width < 768) await page.getByRole('button', { name: /Open navigation menu|打开导航菜单/ }).click()
    await page.locator('.platform-shell__subnav-link').filter({ hasText: /Run monitor|运行监控/ }).click()
    await page.getByRole('button', { name: /New task|新任务|新建任务/ }).click()

    const raw = XLSX.readFile(resource('Shimadzu_Raw_Workbook_Example.xlsx'))
    raw.Sheets[raw.SheetNames[0]] = XLSX.utils.aoa_to_sheet([['[MC Peak Table]'], ['[MS Similarity Search Results for Spectrum Process Table]']])
    await choose(page, { name: 'synthetic-missing-peak.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: XLSX.write(raw, { type: 'buffer', bookType: 'xlsx' }) })
    await page.locator('.analysis-console.state-blocked, .analysis-console.state-failed').waitFor()
    const parent = await numberFrom(page)
    assert.ok(parent)
    assert.notEqual(parent, completeNumber)
    const parentId = new URL(page.url()).searchParams.get('task_id')
    const run = await download(page, page.locator('.shimadzu-failure-report a[download]'), `${parent}_编号回归测试_失败证据与部分结果.zip`)
    assert.equal(run.parameters.taskIdentity.taskId, parentId)
    await page.reload()
    await page.locator('.analysis-console.state-blocked, .analysis-console.state-failed').waitFor()
    assert.equal(await numberFrom(page), parent)
    if (width < 768) await page.getByRole('button', { name: /Open navigation menu|打开导航菜单/ }).click()
    await page.locator('.platform-shell__language button[data-language="zh"]').click()
    if (width < 768) await page.keyboard.press('Escape')
    assert.equal(await numberFrom(page), parent)
    await page.getByRole('button', { name: /Rerun|重新运行/ }).click()
    await page.waitForURL(value => value.searchParams.get('task_id') !== parentId)
    await page.locator('.analysis-console.state-blocked, .analysis-console.state-failed').waitFor()
    const child = await numberFrom(page)
    assert.notEqual(child, parent)
    assert.notEqual(new URL(page.url()).searchParams.get('task_id'), parentId)
    assert.match(await page.locator('.analysis-console-status-primary').innerText(), new RegExp(parent))
    const childRun = await download(page, page.locator('.shimadzu-failure-report a[download]'), `${child}_编号回归测试_失败证据与部分结果.zip`)
    assert.equal(childRun.parameters.taskIdentity.parentTaskId, parentId)
    assert.equal(childRun.parameters.taskIdentity.parentTaskNumber, parent)
    await page.reload()
    await page.locator('.analysis-console.state-blocked, .analysis-console.state-failed').waitFor()
    if (width < 768) await page.getByRole('button', { name: /Open navigation menu|打开导航菜单/ }).click()
    await page.locator('.platform-shell__subnav-link').filter({ hasText: /Task management|任务管理/ }).click()
    const parentRow = page.locator('.processing-task-list li').filter({ has: page.locator('strong').filter({ hasText: new RegExp(`^${parent} `) }) })
    assert.equal(await parentRow.count(), 1)
    const retainedParent = await download(page, parentRow.getByRole('button', { name: /Download|下载/, exact: true }), `${parent}_编号回归测试_失败证据与部分结果.zip`)
    assert.equal(retainedParent.parameters.taskIdentity.taskId, parentId)
    const childRow = page.locator('.processing-task-list li').filter({ has: page.locator('strong').filter({ hasText: new RegExp(`^${child} `) }) })
    await childRow.getByRole('button', { name: /Run details|运行详情/ }).click()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
    assert.deepEqual(errors, [])
    await page.screenshot({ path: path.join(root, `_local/verification/task-traceability/${width}-failure.png`), fullPage: true })
    await page.getByRole('button', { name: /New task|新任务|新建任务/ }).click()
    await choose(page, resource('Shimadzu_Raw_Workbook_Example.xlsx'))
    await page.locator('.analysis-console.state-complete').waitFor({ timeout: 30000 })
    const sourceNumber = await numberFrom(page)
    await page.getByRole('button', { name: /View results and reports|查看结果与报告/ }).click()
    await page.getByRole('combobox', { name: /Matrix for analysis|进入分析的矩阵/ }).selectOption('before-cv')
    await page.getByRole('button', { name: /Enter data analysis|进入数据分析/, exact: true }).click()
    await page.locator('.analysis-header .analysis-task-identity').waitFor()
    assert.match(await page.locator('.analysis-header .analysis-task-identity').innerText(), new RegExp(sourceNumber))
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
    await context.close()
    console.log(`${width}: downloads, restore, rerun + retained parent evidence and verified analysis handoff PASS`)
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 950 }, acceptDownloads: true })
  // Hold enrichment responses so cancellation is exercised deterministically on a real Worker.
  await context.route(/\/(fema|flavordb|pubchem|compound|structure|health)/i, async route => { await new Promise(resolve => setTimeout(resolve, 1500)); await route.abort().catch(() => {}) })
  const page = await context.newPage()
  const longName = '独立取消与长名称回归测试'.repeat(6)
  await choose(page, resource('Shimadzu_Raw_Workbook_Example.xlsx'), longName, true)
  const cancel = page.getByRole('button', { name: /Cancel analysis|取消分析/ })
  await cancel.waitFor()
  const cancelNumber = await numberFrom(page)
  await cancel.focus()
  await page.keyboard.press('Enter')
  await page.locator('.shimadzu-failure-report').waitFor()
  const run = await download(page, page.locator('.shimadzu-failure-report a[download]'), `${cancelNumber}_${[...longName].slice(0, 53).join('')}_取消审计与部分结果.zip`)
  assert.equal(run.parameters.taskIdentity.taskName, longName)
  assert.equal(run.status, 'CANCELLED')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
  await context.close()
  console.log('390: keyboard cancellation download and long names PASS')
} finally { await browser?.close(); preview.kill() }
