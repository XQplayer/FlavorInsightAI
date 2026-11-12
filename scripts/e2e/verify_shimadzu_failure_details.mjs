import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const { createServer } = await import(pathToFileURL(path.join(root, 'frontend/node_modules/vite/dist/node/index.js')).href)
const playwrightPath = process.env.CODEX_E2E_PLAYWRIGHT || pathToFileURL(path.resolve(path.dirname(process.execPath), '../node_modules/playwright/index.mjs')).href
const { chromium } = await import(playwrightPath)
const shots = path.join(root, '_local/verification/failure-details')
await fs.mkdir(shots, { recursive: true })
const vite = await createServer({ root: path.join(root, 'frontend'), server: { host: '127.0.0.1', port: 5181, strictPort: true }, logLevel: 'error' })
await vite.listen()
let browser
try {
  try { browser = await chromium.launch({ headless: true }) }
  catch { browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }) }
  const context = await browser.newContext()
  await context.route(/https:\/\//, route => route.abort())
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:5181/FlavorInsightAI/')
  // Structural UI fixture; the counts are not analytical measurements.
  const error = { code: 'STAGE_GATE_FAILED', message: '第2步未通过质量门禁', details: {
    stage: 1,
    issues: [...Array.from({ length: 380 }, () => ({ severity: 'WARN', code: 'HIT1_NOT_FOUND', message: 'Hit #1 was not found', sampleName: 'Sample-1' })), {
      severity: 'FAIL', code: 'FAIL_Missing_Peak_Headers', sampleName: 'L-1-36h-1', sourceSheet: 'L-1-36h-1', sampleGroup: 'L-1-36h',
      sourceWorkbook: '结构回归示例.xlsx', sourceRow: 6, nextSectionRow: 7, nextSectionTitle: '[MS Similarity Search Results for Spectrum Process Table]', sectionEmpty: true, missingHeaders: ['Peak#', 'Area'],
    }],
    completedStages: [{ stage: '01_Hit1整理', counts: { samples: 36, input: 1063, retained: 683 } }],
    contextWarnings: [{ sourceWorkbook: '配置回归示例.xlsx', sourceSheet: '样品与内标信息', count: 36 }],
  } }
  const results = []
  for (const width of [1280, 390]) for (const language of ['zh', 'en']) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 1000 })
    await page.evaluate(async ({ error, language, theme }) => {
      const [{ default: React }, client, { default: Details }] = await Promise.all([
        import('/FlavorInsightAI/node_modules/.vite/deps/react.js'),
        import('/FlavorInsightAI/node_modules/.vite/deps/react-dom_client.js'),
        import('/FlavorInsightAI/src/components/shimadzu/ShimadzuFailureDetails.jsx'),
        import('/FlavorInsightAI/src/components/shimadzu/ShimadzuAnalysisPage.css'),
      ])
      const createRoot = client.createRoot || client.default.createRoot
      globalThis.__failureRoot?.unmount()
      document.body.innerHTML = `<main class="shimadzu-page" data-theme="${theme}" style="padding:16px"><div id="failure-root"></div></main>`
      globalThis.__failureRoot = createRoot(document.getElementById('failure-root'))
      globalThis.__failureRoot.render(React.createElement(Details, { error, language, downloadUrl: 'blob:regression', downloadName: 'evidence.zip' }))
    }, { error, language, theme })
    await page.locator('.shimadzu-failure-cause').waitFor()
    await page.evaluate(() => document.fonts.ready)
    const report = page.locator('.shimadzu-failure-report')
    assert.notEqual(await report.evaluate(node => getComputedStyle(node).display), 'block', 'production error-panel styles must be loaded')
    assert.match(await report.innerText(), language === 'zh' ? /整段峰面积数据/ : /entire peak-area table/)
    assert.equal(await page.locator('.shimadzu-failure-cause').count(), 1)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}/${language}/${theme} horizontal overflow`)
    const summary = page.locator('.shimadzu-failure-technical summary')
    await summary.focus()
    await page.keyboard.press('Enter')
    assert.equal(await page.locator('.shimadzu-failure-technical').evaluate(node => node.open), true)
    await page.keyboard.press('Enter')
    assert.equal(await page.locator('.shimadzu-failure-technical').evaluate(node => node.open), false)
    assert.equal(await report.locator('a[download]').getAttribute('download'), 'evidence.zip')
    if (language === 'zh') await page.screenshot({ path: path.join(shots, `${width}-${theme}.png`), fullPage: true })
    results.push(`${width}/${language}/${theme}:PASS`)
  }
  console.log(results.join('\n'))
  console.log(`Screenshots: ${shots}`)
} finally { await browser?.close(); await vite.close() }
