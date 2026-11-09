import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const playwrightModule = process.env.CODEX_E2E_PLAYWRIGHT || pathToFileURL(path.resolve(path.dirname(process.execPath), '../node_modules/playwright/index.mjs')).href
const { chromium } = await import(playwrightModule)

let browser
try { browser = await chromium.launch({ headless: true }) }
catch (error) {
  if (!process.env.CODEX_E2E_CHROME) throw error
  browser = await chromium.launch({ headless: true, executablePath: process.env.CODEX_E2E_CHROME })
}
const base = process.env.CODEX_E2E_BASE || 'http://127.0.0.1:5196/FlavorInsightAI/data-processing/'
let checks = 0
try {
  for (const [name, width, height] of [['wide', 1920, 1080], ['desktop', 1440, 900], ['compact', 1280, 800], ['mobile', 390, 844]]) {
    for (const theme of ['dark', 'light']) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' })
      await context.addInitScript(value => { localStorage.setItem('flavorinsight:language', 'zh'); localStorage.setItem('flavorinsight:theme', value) }, theme)
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(base)
      await page.locator('.processing-preflight').waitFor()
      const run = page.locator('.processing-preflight-footer .shimadzu-run-button')
      assert.equal(await run.innerText(), '开始分析')
      assert.equal(await run.isDisabled(), true)
      assert.equal(await page.locator('.shimadzu-upload-slot').count(), 2)
      assert.equal(await page.locator('.shimadzu-upload-slot .shimadzu-file-picker').first().evaluate(el => getComputedStyle(el).borderStyle), 'dashed')
      await page.locator('.shimadzu-upload-slot input[type="file"]').first().setInputFiles({ name: 'wrong.csv', mimeType: 'text/csv', buffer: Buffer.from('invalid') })
      assert.match(await page.locator('.shimadzu-upload-slot.has-error [role="alert"]').innerText(), /仅支持 \.xlsx/)
      assert.equal(await run.isDisabled(), true)
      await page.locator('.shimadzu-file-clear').click()
      await page.locator('.shimadzu-configuration-details > summary').click()
      await page.getByRole('checkbox', { name: /启用估算参考 OAV/ }).check()
      await page.locator('#oav-help summary').click()
      assert.equal(await page.locator('#oav-help').getAttribute('open') !== null, true)
      assert.equal(await page.getByRole('checkbox', { name: /启用水中觉察阈值/ }).isChecked(), true)
      for (const view of ['new', 'monitor', 'results', 'tasks']) {
        await page.goto(view === 'new' ? base : `${base}${view}/`)
        await page.locator('.processing-workspace-intro').waitFor()
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true, `${name}/${theme}/${view} overflow`)
        checks += 1
      }
      assert.deepEqual(errors, [], `${name}/${theme} page errors`)
      await context.close()
      console.log(`${name}/${theme}: pass`)
    }
  }
  console.log(`UI polish: ${checks} route/viewport/theme checks passed`)
} finally { await browser.close() }
