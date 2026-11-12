import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const { chromium } = await import(process.env.CODEX_E2E_PLAYWRIGHT || pathToFileURL(path.resolve(path.dirname(process.execPath), '../node_modules/playwright/index.mjs')).href)
const base = process.env.VERSION_PREVIEW_URL || 'http://127.0.0.1:5176/FlavorInsightAI/'
let browser
try {
  try { browser = await chromium.launch({ headless: true }) } catch { browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }) }
  for (const width of [1440, 390]) for (const language of ['en', 'zh']) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } })
    const page = await context.newPage()
    page.setDefaultTimeout(7000)
    await page.goto(base)
    if (width < 768) await page.getByRole('button', { name: /Open navigation menu|打开导航菜单/ }).click()
    await page.locator(`button[data-language="${language}"]`).first().click()
    if (width < 768) await page.keyboard.press('Escape')
    const current = page.locator('.fi-home__footer a[data-release="current"]')
    await current.waitFor()
    await current.scrollIntoViewIfNeeded()
    assert.match(await current.innerText(), /1\.1\.0/)
    assert.equal(await current.getAttribute('href'), 'https://github.com/XQplayer/FlavorInsightAI/releases/tag/flavorinsight-v1.1.0')
    const archive = page.locator('.fi-home__footer a[data-release="archive"]')
    assert.match(await archive.innerText(), /1\.0\.0/)
    assert.equal(await archive.getAttribute('href'), 'https://github.com/XQplayer/FlavorInsightAI/releases/tag/flavorinsight-v1.0.0')
    await current.focus()
    assert.equal(await current.evaluate(node => document.activeElement === node), true)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
    console.log(`${width}/${language}: current 1.1.0 and archive 1.0.0 visible/keyboard/link PASS`)
    await context.close()
  }
} finally { await browser?.close() }
