import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const defaultPlaywright = path.resolve(path.dirname(process.execPath), '..', 'node_modules', 'playwright', 'index.mjs')
const { chromium } = await import(process.env.CODEX_E2E_PLAYWRIGHT || pathToFileURL(defaultPlaywright).href)
const browser = await chromium.launch({ headless: true, ...(process.env.AI_E2E_CHROME ? { executablePath: process.env.AI_E2E_CHROME } : {}) })
const taskId = '22222222-2222-4222-8222-222222222222' // synthetic UUID, never a real task
try {
  for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' })
    const errors = []
    const chatRequests = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => { if (request.url().includes('/ai/chat')) chatRequests.push(request.url()) })
    await page.goto(`http://127.0.0.1:5195/FlavorInsightAI/ai-assistant/?task_id=${taskId}`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('note').getByText(/Task interpretation|任务 AI 解读/u).waitFor()
    assert.match(await page.locator('#ai-research-input').inputValue(), /get_analysis_summary/u)
    assert.match(await page.locator('#ai-research-input').inputValue(), /22222222-2222-4222-8222-222222222222/u)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    assert.deepEqual(chatRequests, [])
    assert.deepEqual(errors, [])
    console.log(`PASS ${viewport.name}: synthetic task context, explicit server-bound evidence note, no automatic model request or overflow`)
    await page.close()
  }
} finally {
  await browser.close()
}
