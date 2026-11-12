import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const { chromium } = await import(process.env.CODEX_E2E_PLAYWRIGHT || pathToFileURL(path.resolve(path.dirname(process.execPath), '../node_modules/playwright/index.mjs')).href)
const base = process.env.BRAND_PREVIEW_URL || 'http://127.0.0.1:5176/FlavorInsightAI/'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const originalHash = hash(await readFile(new URL('../../docs/brand/flavorinsight-ai-mark.png', import.meta.url)))
let browser
try {
  try { browser = await chromium.launch({ headless: true }) } catch { browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }) }
  for (const width of [1440, 768, 390]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' })
    const page = await context.newPage()
    page.setDefaultTimeout(6000)
    await page.goto(new URL('ai-models/', base).href)
    const icons = page.locator('head link[rel="icon"]')
    assert.ok(await icons.count() > 0)
    for (const icon of await icons.all()) {
      const response = await context.request.get(await icon.evaluate(node => node.href))
      assert.equal(response.status(), 200)
      assert.equal(hash(await response.body()), originalHash, 'tab icon must use the supplied original logo, not the old generic icon')
    }
    if (width < 768) await page.getByRole('button', { name: /Open navigation menu|打开导航菜单/ }).click()
    const brand = page.locator('.platform-shell__brand')
    const logo = brand.locator('img')
    await logo.waitFor({ state: 'visible' })
    assert.equal(await logo.evaluate(node => node.complete && node.naturalWidth > 0), true)
    assert.equal(await brand.getAttribute('aria-label'), 'FlavorInsight AI')
    assert.equal(hash(await (await context.request.get(await logo.evaluate(node => node.src))).body()), originalHash)
    const box = await logo.boundingBox()
    assert.ok(box.width >= 32 && box.height >= 32)
    await brand.focus()
    await page.keyboard.press('Enter')
    await page.waitForURL(url => url.pathname.replace(/\/$/, '') === new URL(base).pathname.replace(/\/$/, ''))
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
    console.log(`${width}/${theme}: original tab/sidebar logo, nested route, home link and overflow PASS`)
    await context.close()
  }
} finally { await browser?.close() }
