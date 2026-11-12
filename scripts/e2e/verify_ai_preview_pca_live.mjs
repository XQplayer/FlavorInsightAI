// Explicitly opt in: three bounded real-model calls on a synthetic Staging account.
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const requireFromFrontend = createRequire(new URL('../../frontend/package.json', import.meta.url))
const { createClient } = requireFromFrontend('@supabase/supabase-js')
const { chromium } = requireFromFrontend('playwright')
const ref = 'zwbzyrshzegwlgcaxudo'
const url = `https://${ref}.supabase.co`
const site = 'https://flavorinsight-agent-pca-preview.onrender.com'
const gateway = 'https://flavorinsight-ai-gateway-preview.onrender.com'
if (process.env.FLAVOR_AI_PREVIEW_PCA_LIVE !== 'true' ||
    process.env.SUPABASE_STAGING_ENVIRONMENT !== 'nonproduction' ||
    process.env.SUPABASE_STAGING_PROJECT_REF !== ref ||
    process.env.SUPABASE_STAGING_URL !== url ||
    !process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY ||
    !process.env.SUPABASE_STAGING_MANAGEMENT_TOKEN) {
  console.error('REFUSED: explicit paid test opt-in and exact Staging project required')
  process.exit(2)
}
const projectResponse = await fetch(`https://api.supabase.com/v1/projects/${ref}`, {
  headers: { Authorization: `Bearer ${process.env.SUPABASE_STAGING_MANAGEMENT_TOKEN}` },
  signal: AbortSignal.timeout(20000),
})
const project = await projectResponse.json()
assert.equal(projectResponse.ok && project.name === 'FlavorInsightAI-Staging' &&
  project.organization_slug === process.env.SUPABASE_STAGING_ORGANIZATION_SLUG, true)

const admin = createClient(url, process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
const email = `flavor-ai-pca-${randomUUID()}@example.com`
const password = `${randomBytes(24).toString('base64url')}!Aa1`
const created = await admin.auth.admin.createUser({ email, password, email_confirm: true,
  user_metadata: { display_name: 'SYNTHETIC_AI_PCA' } })
if (created.error || !created.data.user?.id) throw new Error('Synthetic Staging account creation failed')
let browser
const report = { gateway, site, status: 'FAIL', checks: {} }
const mark = (name, condition) => { report.checks[name] = Boolean(condition); assert.equal(report.checks[name], true, name) }
const output = path.resolve('_local/verification/ai-preview-pca-live.png')
try {
  browser = await chromium.launch({ headless: true,
    executablePath: process.env.BROWSER_PCA_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' })
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, acceptDownloads: true })
  const page = await context.newPage()
  let workers = 0
  let rawMatrixSent = false
  let facts
  page.on('worker', () => workers++)
  page.on('request', request => {
    if (request.url().startsWith(gateway) && request.method() === 'POST') {
      const body = request.postDataJSON()
      if (body && (Object.hasOwn(body, 'matrix') || Object.hasOwn(body?.inspection || {}, 'matrix') ||
        Object.hasOwn(body?.facts || {}, 'matrix') || Object.hasOwn(body?.facts || {}, 'scores'))) rawMatrixSent = true
      if (request.url().endsWith('/ai/analysis/explain')) facts = body.facts
    }
  })
  await page.goto(`${site}/ai-assistant/`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('textbox', { name: /Email|邮箱/ }).waitFor({ timeout: 30000 })
  await page.getByRole('textbox', { name: /Email|邮箱/ }).fill(email)
  await page.getByLabel(/Password|密码/).fill(password)
  const sessionResponse = page.waitForResponse(response => response.url() === `${gateway}/ai/session` && response.status() === 200,
    { timeout: 30000 })
  await page.getByRole('button', { name: /Sign in|登录/ }).click()
  mark('real_gateway_mode', (await (await sessionResponse).json()).mode === 'openai')
  await page.getByRole('button', { name: /New conversation|新建会话/ }).click()
  await page.waitForURL(/conversation_id=[0-9a-f-]{36}/i, { timeout: 30000 })
  const conversationId = new URL(page.url()).searchParams.get('conversation_id')
  mark('conversation_created', Boolean(conversationId))
  await page.getByRole('link', { name: /Open Browser PCA in this conversation|在当前会话中打开浏览器 PCA/ }).click()
  await page.waitForURL(/data-analysis\/?\?conversation_id=/, { timeout: 20000 })
  await page.getByRole('button', { name: /SYNTHETIC R|合成的 R 参考数据/ }).click()
  await page.getByRole('textbox', { name: /Analysis goal|分析目标/ }).fill('Use PCA for exploratory structure of this synthetic dataset; do not infer significance.')
  mark('worker_not_started_before_confirmation', workers === 0)
  await page.getByRole('button', { name: /Ask AI for PCA settings|请求 AI 推荐 PCA 参数/ }).click()
  await page.getByRole('button', { name: /Confirm settings and run in browser|确认参数并在浏览器运行/ }).waitFor({ timeout: 120000 })
  mark('worker_not_started_by_model_plan', workers === 0)
  await page.getByRole('button', { name: /Confirm settings and run in browser|确认参数并在浏览器运行/ }).click()
  await page.getByText(/Calculation complete|计算完成/).waitFor({ timeout: 30000 })
  mark('browser_worker_computed', workers > 0 && await page.locator('svg[data-plot]').count() === 1)
  for (const view of ['scores', 'loadings', 'biplot', 'scree']) {
    await page.getByRole('combobox', { name: /Figure|图表/ }).selectOption(view)
    mark(`plot_${view}`, JSON.parse(await page.locator('svg[data-plot]').getAttribute('data-plot')).view === view)
  }
  const explainResponse = page.waitForResponse(response => response.url() === `${gateway}/ai/analysis/explain`, { timeout: 120000 })
  await page.getByRole('button', { name: /Confirm sharing summary and ask AI to explain|确认分享摘要并请求 AI 解读/ }).click()
  const explanation = await (await explainResponse).json()
  mark('real_model_explanation', explanation.mode === 'openai' && explanation.explanation?.length > 20)
  mark('bounded_validated_facts', facts?.source === 'client-validated-browser-pca-result' &&
    facts?.explained_variance?.length > 0 && !rawMatrixSent)
  await page.getByRole('button', { name: /Save in this browser|保存到本浏览器/ }).click()
  await page.getByRole('button', { name: /^Restore$|^恢复$/ }).waitFor()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /^Restore$|^恢复$/ }).click()
  await page.getByText(/Calculation complete|计算完成/).waitFor()
  mark('local_result_restored', await page.locator('svg[data-plot]').count() === 1)
  await page.getByRole('link', { name: /Return to conversation|返回对话/ }).click()
  await page.getByText(/Linked browser analyses|已关联的浏览器分析/).waitFor({ timeout: 30000 })
  mark('analysis_link_restored', (await page.locator('.ai-research-task-context').allTextContents()).some(text => text.includes(facts.run_id)))
  await page.getByRole('textbox', { name: /Ask a research question|输入科研问题/ }).fill('For the linked synthetic PCA, state the PC1 explained variance as a percent and clarify that the server did not recompute it. Do not invent significance.')
  const chatResponse = page.waitForResponse(response => response.url() === `${gateway}/ai/chat`, { timeout: 120000 })
  await page.getByRole('button', { name: /^Send$|^发送$/ }).click()
  const stream = await (await chatResponse).text()
  mark('followup_stream_completed', stream.includes('"type": "done"') || stream.includes('"type":"done"'))
  const answer = stream.split(/\r?\n/u).filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)))
    .filter(event => event.type === 'delta').map(event => event.text).join('')
  const percent = facts.explained_variance[0] * 100
  const numbers = [...answer.matchAll(/\d+(?:\.\d+)?/gu)].map(match => Number(match[0]))
  if (!(/PC1/iu.test(answer) && numbers.some(value => Math.abs(value - percent) < 1))) {
    console.error(JSON.stringify({ check: 'followup_uses_linked_pc1', expected_percent: percent,
      answer_excerpt: answer.slice(0, 800), stream_types: [...new Set(stream.split(/\r?\n/u).filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)).type))] }))
  }
  mark('followup_uses_linked_pc1', /PC1/iu.test(answer) && numbers.some(value => Math.abs(value - percent) < 1))
  await mkdir(path.dirname(output), { recursive: true })
  await page.screenshot({ path: output, fullPage: true })
  report.status = 'PASS'
  console.log(JSON.stringify({ ...report, screenshot: output }))
  await context.close()
} finally {
  await browser?.close()
  const conversations = await admin.from('ai_conversations').delete().eq('user_id', created.data.user.id)
  const user = await admin.auth.admin.deleteUser(created.data.user.id)
  if (conversations.error || user.error) { console.error('Synthetic Staging cleanup failed'); process.exitCode = 1 }
}
