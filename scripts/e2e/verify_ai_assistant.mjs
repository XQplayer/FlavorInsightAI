import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const defaultPlaywright = path.resolve(path.dirname(process.execPath), '..', 'node_modules', 'playwright', 'index.mjs')
const selectedPlaywright = process.env.CODEX_E2E_PLAYWRIGHT
const moduleUrl = selectedPlaywright
  ? /^[A-Za-z]:[\\/]/.test(selectedPlaywright) ? pathToFileURL(selectedPlaywright).href : selectedPlaywright
  : pathToFileURL(defaultPlaywright).href
const { chromium } = await import(moduleUrl)
const base = process.env.AI_E2E_BASE_URL || 'http://127.0.0.1:5195/FlavorInsightAI/ai-assistant/'
const output = path.resolve('_local/verification/ai-assistant')
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, ...(process.env.AI_E2E_CHROME ? { executablePath: process.env.AI_E2E_CHROME } : {}) })
try {
  for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'tablet', width: 768, height: 1024 }, { name: 'mobile', width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(base, { waitUntil: 'domcontentloaded' })
    await page.getByText(/Local Mock|本地 Mock/u).first().waitFor()
    await page.getByRole('button', { name: /141-78-6/u }).click()
    await page.getByText(/乙酸乙酯/u).waitFor({ timeout: 15000 })
    await page.getByText(/数据来源|Sources/u).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, `${viewport.name} horizontal overflow`)
    assert.deepEqual(errors, [], `${viewport.name} page errors`)
    await page.screenshot({ path: path.join(output, `${viewport.name}.png`), fullPage: true })
    if (viewport.name === 'desktop') {
      await page.getByRole('button', { name: /Theme toggle|主题切换/u }).click()
      await page.screenshot({ path: path.join(output, 'desktop-dark.png'), fullPage: true })
    }
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /141-78-6/u }).first().waitFor()
    if (viewport.name === 'desktop') {
      await page.route('**/ai/chat', route => route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'data: {"type":"delta","text":"![remote](https://example.invalid/pixel) <script>window.__xss=1</script> [unsafe](javascript:alert(1))"}\n\ndata: {"type":"done","sources":[]}\n\n' }))
      await page.getByRole('button', { name: /New conversation|新建会话/u }).click()
      await page.locator('#ai-research-input').fill('Test Markdown rendering')
      await page.getByRole('button', { name: /^Send$|^发送$/u }).click()
      await page.getByText(/unsafe/u).waitFor()
      assert.equal(await page.locator('.ai-research-markdown img, .ai-research-markdown script, .ai-research-markdown a[href^="javascript:"]').count(), 0)
      assert.equal(await page.evaluate(() => window.__xss), undefined)
      await page.unroute('**/ai/chat')
      await page.goto(`${base}?cas=141-78-6`, { waitUntil: 'domcontentloaded' })
      assert.match(await page.locator('#ai-research-input').inputValue(), /141-78-6/u)
      await page.goto(`${base}?task_id=11111111-1111-4111-8111-111111111111`, { waitUntil: 'domcontentloaded' })
      await page.getByText(/私有任务解读尚未开放|Private task interpretation is not enabled/u).waitFor()
    }
    await page.close()
    console.log(`PASS ${viewport.name}: real public CAS record, Mock disclosure, source, history and no overflow`)
  }
} finally {
  await browser.close()
}
