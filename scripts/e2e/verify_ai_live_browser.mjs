import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const defaultPlaywright = path.resolve(path.dirname(process.execPath), '..', 'node_modules', 'playwright', 'index.mjs')
const { chromium } = await import(process.env.CODEX_E2E_PLAYWRIGHT || pathToFileURL(defaultPlaywright).href)
const browser = await chromium.launch({ headless: true, ...(process.env.AI_E2E_CHROME ? { executablePath: process.env.AI_E2E_CHROME } : {}) })
const output = path.resolve('_local/verification/ai-live-browser.png')
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const errors = []
  const unsafeRequests = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    if (request.url().includes('api.openai.com') || /^Bearer sk-/u.test(request.headers().authorization || '')) unsafeRequests.push(request.url())
  })
  await page.goto('http://127.0.0.1:5195/FlavorInsightAI/ai-assistant/', { waitUntil: 'domcontentloaded' })
  await page.getByText('OpenAI model').waitFor()
  await page.locator('#ai-research-input').fill('请调用平台工具查询 CAS 141-78-6，并只依据平台记录说明风味描述。')
  await page.getByRole('button', { name: 'Send' }).click()
  await page.getByText(/乙酸乙酯/u).waitFor({ timeout: 60000 })
  await page.getByText(/search_compound/u).waitFor({ timeout: 30000 }).catch(async error => {
    const answer = await page.locator('.ai-research-message.assistant').last().innerText().catch(() => '')
    throw new Error(`Expected real compound tool event; assistant output: ${answer.slice(0, 700)}`, { cause: error })
  })
  await page.locator('.ai-research-sources strong').waitFor()
  await page.getByText(/Usage:/u).waitFor()
  assert.deepEqual(errors, [])
  assert.deepEqual(unsafeRequests, [])
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false)
  await fs.mkdir(path.dirname(output), { recursive: true })
  await page.screenshot({ path: output, fullPage: true })
  console.log('PASS live browser: OpenAI mode, real search_compound, source, usage, no browser key/API request, no overflow')
  await page.close()
} finally {
  await browser.close()
}
