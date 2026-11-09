import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const playwrightPath = process.env.CODEX_E2E_PLAYWRIGHT || pathToFileURL(path.resolve(path.dirname(process.execPath), '../node_modules/playwright/index.mjs')).href
const { chromium } = await import(playwrightPath)
const allocator = createServer()
await new Promise(resolve => allocator.listen(0, '127.0.0.1', resolve))
const port = allocator.address().port
await new Promise(resolve => allocator.close(resolve))
const url = `http://127.0.0.1:${port}/FlavorInsightAI/data-processing/`
const vite = path.join(root, 'frontend/node_modules/vite/bin/vite.js')
const preview = spawn(process.execPath, [vite, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: path.join(root, 'frontend'), windowsHide: true, stdio: 'ignore',
})
let browser

async function openPage(width) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  await page.goto(url)
  await page.locator('.shimadzu-run-button').waitFor()
  return page
}

async function chooseInputs(page, raw) {
  const sample = path.join(root, 'resources/shimadzu/templates/Shimadzu_Sample_Internal_Standard_Template.xlsx')
  const inputs = page.locator('input[type="file"]')
  await inputs.nth(0).setInputFiles(raw)
  await inputs.nth(1).setInputFiles(sample)
  await page.locator('.shimadzu-configuration-details > summary').click()
  await page.getByRole('checkbox', { name: /Enable CAS structural classification|启用 CAS 结构分类/ }).uncheck()
  await page.getByRole('checkbox', { name: /Enable water detection thresholds|启用水中觉察阈值/ }).uncheck()
  await page.locator('.shimadzu-configuration-details > summary').click()
}

try {
  for (let i = 0; i < 40; i += 1) {
    if (preview.exitCode !== null) throw new Error(`Vite preview exited before readiness: ${preview.exitCode}`)
    try { if ((await fetch(url)).ok) break } catch { /* preview is starting */ }
    if (i === 39) throw new Error('Vite preview did not start')
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  try { browser = await chromium.launch({ headless: true }) }
  catch { browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }) }

  const desktop = await openPage(1440)
  await chooseInputs(desktop, path.join(root, 'resources/shimadzu/templates/Shimadzu_Raw_Workbook_Example.xlsx'))
  await desktop.locator('.shimadzu-run-button').click()
  await desktop.locator('.platform-shell__subnav-link').filter({ hasText: /Task management|任务管理/ }).click()
  await desktop.locator('.processing-tasks').waitFor()
  await desktop.locator('.platform-shell__subnav-link').filter({ hasText: /Run monitor|运行监控/ }).click()
  await desktop.locator('.analysis-console.state-complete').waitFor({ timeout: 60_000 })
  assert.match(desktop.url(), /\/data-processing\/monitor\/\?task_id=/)
  assert.match(await desktop.locator('.shimadzu-task-feedback').innerText(), /All seven stages finished|七个步骤已完成/)
  assert.equal(await desktop.getByRole('progressbar').getAttribute('aria-valuenow'), '100')
  assert.deepEqual(await desktop.locator('[data-console-step]').evaluateAll(nodes => nodes.map(node => node.dataset.consoleStep)), ['00', '01', '02', '03', '04', '05', '06', '07'])
  assert.equal(await desktop.locator('[data-console-step="07"]').getAttribute('class').then(value => value.includes('state-PASS')), true)
  const taskId = new URL(desktop.url()).searchParams.get('task_id')
  await desktop.locator('[data-console-step="06"]').click()
  assert.equal(await desktop.locator('[data-console-step="06"]').getAttribute('aria-pressed'), 'true')
  await desktop.locator('.analysis-console-log summary').click()
  assert.notEqual(await desktop.locator('.analysis-console-log').getAttribute('open'), null)
  if (process.env.CODEX_CAPTURE_CONSOLE === '1') {
    await mkdir(path.join(root, '_local'), { recursive: true })
    await desktop.locator('.analysis-console').screenshot({ path: path.join(root, '_local/console-runtime-complete.png') })
  }
  assert.equal(await desktop.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await desktop.getByRole('button', { name: /View results and reports|查看结果与报告/ }).click()
  assert.match(desktop.url(), /\/data-processing\/results\/\?task_id=/)
  assert.equal(new URL(desktop.url()).searchParams.get('task_id'), taskId)
  assert.equal(await desktop.locator('.processing-result-item').count(), 4)
  assert.equal(await desktop.locator('.processing-result-download a[download]').count(), 1)
  await desktop.locator('.platform-shell__subnav-link').filter({ hasText: /Task management|任务管理/ }).click()
  assert.equal(await desktop.locator('.processing-task-list li').count(), 1)
  await desktop.locator('.processing-task-list li').first().getByRole('button', { name: /Run details|运行详情/ }).click()
  assert.equal(new URL(desktop.url()).searchParams.get('task_id'), taskId)
  await desktop.reload()
  assert.equal(new URL(desktop.url()).searchParams.get('task_id'), taskId)
  await desktop.locator('.processing-historical-run, .processing-empty').first().waitFor()
  await desktop.close()

  const mobile = await openPage(390)
  await chooseInputs(mobile, { name: 'invalid.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('invalid workbook') })
  await mobile.locator('.shimadzu-run-button').click()
  await mobile.locator('.analysis-console.state-failed, .analysis-console.state-blocked').waitFor({ timeout: 30_000 })
  assert.match(await mobile.locator('.shimadzu-task-feedback').innerText(), /error.*rerun|错误.*重新运行/)
  assert.equal(await mobile.locator('.shimadzu-inline-error[role="alert"]').count(), 1)
  assert.notEqual(await mobile.locator('.analysis-console-log').getAttribute('open'), null)
  if (process.env.CODEX_CAPTURE_CONSOLE === '1') await mobile.locator('.analysis-console').screenshot({ path: path.join(root, '_local/console-runtime-failed.png') })
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await mobile.getByRole('button', { name: /New task|新建任务/ }).click()
  await mobile.locator('.processing-preflight').waitFor()
  assert.equal(await mobile.locator('.shimadzu-run-button').isDisabled(), true)
  await mobile.close()
  console.log('Processing feedback E2E: desktop completion and mobile failure passed')
} finally {
  await browser?.close()
  preview.kill()
}
