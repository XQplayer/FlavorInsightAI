import assert from 'node:assert/strict'
import { access, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import { createServer } from 'vite'

const root = path.resolve(import.meta.dirname, '..')
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'synthetic@example.invalid', aud: 'authenticated', role: 'authenticated' }
const session = { access_token: 'synthetic-access-token', refresh_token: 'synthetic-refresh-token', token_type: 'bearer', expires_in: 3600, user }

test('anonymous routes stay public and protected actions return to their page without submission', { timeout: 90_000 }, async t => {
  try { await access(edge) } catch { t.skip('Edge unavailable'); return }
  const { chromium } = await import('playwright')
  const previous = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_AI_API_URL'].map(key => [key, process.env[key]])
  process.env.VITE_SUPABASE_URL = 'https://auth-test.invalid'
  process.env.VITE_SUPABASE_ANON_KEY = 'synthetic-anon-key'
  process.env.VITE_AI_API_URL = 'https://ai-test.invalid'
  t.after(() => { for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value } })
  const vite = await createServer({ root, configFile: path.join(root, 'vite.config.js'), logLevel: 'silent', server: { host: '127.0.0.1', port: 0 } })
  await vite.listen()
  t.after(() => vite.close())
  const port = vite.httpServer.address().port
  const browser = await chromium.launch({ executablePath: edge, headless: true })
  t.after(() => browser.close())
  const base = `http://127.0.0.1:${port}/FlavorInsightAI/`
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  t.after(() => context.close())
  let privateReads = 0, privateChatReads = 0, taskWrites = 0, chatWrites = 0
  await context.route('https://auth-test.invalid/**', route => {
    const url = route.request().url()
    if (url.includes('/auth/v1/token')) {
      if (route.request().postDataJSON()?.password === 'wrong-password') return route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"invalid_grant","error_description":"Invalid login credentials"}' })
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) })
    }
    if (url.includes('/auth/v1/user')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) })
    if (url.includes('/auth/v1/logout')) return route.fulfill({ status: 204, body: '' })
    if (url.includes('/rest/v1/profiles')) {
      const profile = { id: user.id, approval_status: 'approved', is_admin: false }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(route.request().headers().accept?.includes('vnd.pgrst.object') ? profile : [profile]) })
    }
    if (url.includes('/rest/v1/shimadzu_jobs')) { privateReads++; if (route.request().method() !== 'GET') taskWrites++; return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }) }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
  })
  await context.route('https://ai-test.invalid/**', route => {
    const url = route.request().url()
    if (route.request().method() !== 'GET') chatWrites++
    if (url.includes('/ai/conversations') && route.request().method() === 'GET') privateChatReads++
    if (url.endsWith('/ai/session')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ mode: 'openai', history_persistence: 'supabase', limits: { input_characters: 4000 } }) })
    if (url.endsWith('/ai/conversations')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"conversations":[]}' })
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
  })
  const page = await context.newPage()
  await page.addInitScript(() => localStorage.setItem('flavorinsight:language', 'zh'))
  for (const segment of ['data-processing/', 'data-processing/monitor/', 'data-processing/results/', 'data-processing/tasks/', 'data-analysis/', 'ai-models/', 'ai-assistant/']) {
    await page.goto(base + segment)
    await page.locator('main h1').first().waitFor()
    assert.equal(new URL(page.url()).pathname, `/FlavorInsightAI/${segment}`)
    await page.reload()
    await page.locator('main h1').first().waitFor()
    assert.equal(new URL(page.url()).pathname, `/FlavorInsightAI/${segment}`)
  }
  assert.equal(privateReads, 0, 'guest must not query private tasks')
  assert.equal(privateChatReads, 0, 'guest must not query private conversations')
  await page.locator('#ai-research-input').fill('查询合成样品的 PCA 方案')
  await page.getByRole('button', { name: '发送' }).click()
  await page.waitForURL('**/FlavorInsightAI/login/')
  assert.equal(chatWrites, 0, 'guest click must not submit chat')
  assert.equal(JSON.parse(await page.evaluate(() => sessionStorage.getItem('flavorinsight:auth-intent:v1'))).draft.text, '查询合成样品的 PCA 方案')
  await page.locator('input[type=email]').fill(user.email)
  await page.locator('input[type=password]').fill('wrong-password')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await page.getByText('登录失败，请检查邮箱、密码或邮箱验证状态。').waitFor()
  assert.equal(JSON.parse(await page.evaluate(() => sessionStorage.getItem('flavorinsight:auth-intent:v1'))).draft.text, '查询合成样品的 PCA 方案', 'failed login must retain the return intent')
  await page.locator('input[type=password]').fill('synthetic-password')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await page.waitForURL('**/FlavorInsightAI/ai-assistant/')
  await page.waitForFunction(() => document.querySelector('#ai-research-input')?.value === '查询合成样品的 PCA 方案')
  assert.equal(await page.locator('#ai-research-input').inputValue(), '查询合成样品的 PCA 方案')
  assert.equal(chatWrites, 0, 'login must not replay chat automatically')
  const output = path.join(root, '..', '_local', 'verification', 'on-demand-auth')
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, 'assistant-after-login-desktop.png'), fullPage: true })
  await page.goto(base + 'login/')
  await page.getByRole('button', { name: '退出登录' }).click()
  await page.goto(base + 'data-processing/tasks/')
  await page.getByRole('heading', { name: '任务管理' }).first().waitFor()
  assert.equal(privateReads, 0, 'signed-out user must not query private tasks')
  await page.goto(base + 'data-processing/')
  await page.getByRole('heading', { name: '新建分析' }).first().waitFor()
  const uploadInputs = page.locator('input[type=file]')
  assert.equal(await uploadInputs.count(), 2)
  await uploadInputs.nth(0).setInputFiles({ name: 'synthetic-raw.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('synthetic-only') })
  await uploadInputs.nth(1).setInputFiles({ name: 'synthetic-samples.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('synthetic-only') })
  await page.getByLabel('任务名称').fill('合成登录恢复测试')
  await page.getByRole('button', { name: '开始分析' }).click()
  await page.waitForURL('**/FlavorInsightAI/login/')
  assert.equal(taskWrites, 0, 'guest click must not create a task')
  await page.locator('input[type=email]').fill(user.email)
  await page.locator('input[type=password]').fill('synthetic-password')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await page.waitForURL('**/FlavorInsightAI/data-processing/')
  await page.waitForFunction(() => document.querySelector('.processing-task-name input')?.value === '合成登录恢复测试')
  assert.equal(await page.locator('input[type=file]').nth(0).inputValue(), '')
  assert.equal(await page.locator('input[type=file]').nth(1).inputValue(), '')
  assert.equal(taskWrites, 0, 'login must not start the Worker or create a task automatically')
  await page.screenshot({ path: path.join(output, 'processing-after-login-desktop.png'), fullPage: true })
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } })
  t.after(() => mobile.close())
  const mobilePage = await mobile.newPage()
  await mobilePage.addInitScript(() => localStorage.setItem('flavorinsight:language', 'zh'))
  await mobilePage.goto(base + 'ai-assistant/')
  await mobilePage.getByRole('heading', { name: 'AI 科研助手' }).waitFor()
  assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true)
  await mobilePage.screenshot({ path: path.join(output, 'assistant-anonymous-mobile.png'), fullPage: true })
  await mobilePage.locator('#ai-research-input').fill('合成问题')
  await mobilePage.getByRole('button', { name: '发送' }).click()
  await mobilePage.waitForURL('**/FlavorInsightAI/login/')
  assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true)
  await mobilePage.screenshot({ path: path.join(output, 'login-mobile.png'), fullPage: true })
})
