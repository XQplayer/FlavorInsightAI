// One synthetic browser canary: real Staging JWT/RLS, hosted R, UI and export.
// All credentials come from an ignored --env-file; never use a production user.
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const require = createRequire(new URL('../../frontend/package.json', import.meta.url))
const { createClient } = require('@supabase/supabase-js')
const { chromium } = createRequire(process.env.ANALYSIS_PLAYWRIGHT_PACKAGE || 'C:/Users/hanxq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright')
const root = path.resolve(import.meta.dirname, '../..')
const ref = 'zwbzyrshzegwlgcaxudo'
const url = `https://${ref}.supabase.co`
const origin = 'http://127.0.0.1:5181'
const api = 'http://127.0.0.1:19195'
const env = process.env
if (env.SUPABASE_STAGING_URL !== url || env.SUPABASE_STAGING_PROJECT_REF !== ref ||
    env.SUPABASE_STAGING_ORGANIZATION_SLUG !== 'wkbburugozvjmhjgwjsz' ||
    env.SUPABASE_STAGING_ENVIRONMENT !== 'nonproduction' || !env.SUPABASE_STAGING_SERVICE_ROLE_KEY ||
    !env.SUPABASE_STAGING_ANON_KEY || !env.ANALYSIS_RSCRIPT) {
  throw new Error('REFUSED: exact synthetic Staging configuration is required')
}
const common = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const admin = createClient(url, env.SUPABASE_STAGING_SERVICE_ROLE_KEY, common)
let userId, hosted, vite, browser, jobId
const output = path.join(root, '_local/verification/ai-pca-hosted')
const check = (value, label) => {
  if (value.error) throw new Error(`${label}: Supabase ${value.error.code || value.error.status || 'error'}`)
  return value.data
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
async function ready(endpoint, expected) {
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(1000) })
      if (response.status === expected) return
    } catch { /* child startup */ }
    await pause(300)
  }
  throw new Error('Local canary service did not become ready')
}

try {
  const email = `synthetic-pca-browser-${randomUUID()}@example.com`
  const password = `${randomBytes(24).toString('base64url')}!Aa1`
  const user = check(await admin.auth.admin.createUser({ email, password, email_confirm: true,
    user_metadata: { display_name: 'SYNTHETIC_PCA_BROWSER' } }), 'create synthetic user').user
  userId = user.id
  const approved = check(await admin.from('profiles').update({ approval_status: 'approved', is_admin: false })
    .eq('id', userId).select('id,is_admin'), 'approve synthetic user')
  assert.equal(approved.length, 1)
  assert.equal(approved[0].is_admin, false)
  const client = createClient(url, env.SUPABASE_STAGING_ANON_KEY, common)
  const session = check(await client.auth.signInWithPassword({ email, password }), 'sign in synthetic user').session
  assert.ok(session?.access_token)

  hosted = spawn(env.FLAVOR_RLS_TEST_PYTHON || 'python', ['-m', 'services.analysis.hosted_http'], {
    cwd: root, windowsHide: true, stdio: 'ignore', env: { ...env,
      FLAVOR_AI_PCA_ENABLED: 'true', FLAVOR_AI_PCA_SINGLE_INSTANCE: 'true',
      FLAVOR_AI_PCA_ALLOWED_USER_IDS: userId,
      FLAVOR_AI_SUPABASE_URL: url, FLAVOR_AI_SUPABASE_ANON_KEY: env.SUPABASE_STAGING_ANON_KEY,
      FLAVOR_AI_PCA_SUPABASE_SECRET_KEY: env.SUPABASE_STAGING_SERVICE_ROLE_KEY,
      FLAVOR_AI_PCA_PROJECT_REF: ref, FLAVOR_AI_ALLOWED_ORIGINS: origin, PORT: '19195',
    },
  })
  await ready(`${api}/health`, 200)
  vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5181', '--strictPort'], {
    cwd: path.join(root, 'frontend'), windowsHide: true, stdio: 'ignore', env: { ...env,
      VITE_AI_PCA_ENABLED: 'true', VITE_ANALYSIS_API_URL: api,
      VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: env.SUPABASE_STAGING_ANON_KEY,
    },
  })
  await ready(`${origin}/FlavorInsightAI/data-analysis/`, 200)
  browser = await chromium.launch({ headless: true,
    executablePath: env.ANALYSIS_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, reducedMotion: 'reduce' })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
    { key: `sb-${ref}-auth-token`, session })
  await page.goto(`${origin}/FlavorInsightAI/data-analysis/`)
  await page.getByText(/HOSTED PCA|线上 PCA/u).first().waitFor()
  await page.getByText(/Compute service: Ready|计算服务.*已就绪/u).waitFor()
  await page.getByRole('button', { name: /Load SYNTHETIC example|加载合成示例/u }).click()
  await page.getByRole('textbox', { name: /Research question|科研问题/u }).fill('帮我分析这份数据的整体差异，先做 PCA。')
  await page.getByRole('button', { name: /Inspect dataset and recommend|检查数据并推荐/u }).click()
  await page.getByRole('heading', { name: /Review required|待确认/u }).waitFor()
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, 'hosted-plan-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: /Confirm settings and run real PCA|确认参数并运行真实 PCA/u }).click()
  await page.waitForFunction(() => [...document.querySelectorAll('select')].some(select =>
    select.closest('label')?.textContent?.match(/Run history|运行历史/u) &&
    [...select.options].some(option => option.textContent.includes('pca · completed'))), null, { timeout: 90000 })
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /Export raw result & audit JSON|导出原始结果及审计 JSON/u }).click()
  const item = await download
  const file = path.join(output, 'hosted-result-synthetic.json')
  await item.saveAs(file)
  const run = JSON.parse(await readFile(file, 'utf8'))
  jobId = run.id
  assert.equal(run.status, 'completed')
  assert.equal(run.result?.method, 'pca')
  assert.equal(run.result?.data?.scores?.length, 24)
  assert.ok(run.planReceipt?.confirmationHash)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
  await page.screenshot({ path: path.join(output, 'hosted-result-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
  await page.screenshot({ path: path.join(output, 'hosted-result-mobile.png'), fullPage: true })
  assert.deepEqual(errors, [])
  console.log('PASS synthetic browser PCA plan, real hosted R completion, result JSON, desktop/mobile layout and no page errors')
} catch (error) {
  console.error(`FAIL hosted browser canary: ${error.name}: ${String(error.message).slice(0, 180)}`)
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  if (vite) vite.kill()
  if (hosted) hosted.kill()
  if (userId) {
    const deletion = await admin.auth.admin.deleteUser(userId)
    const remaining = await admin.from('ai_pca_jobs').select('id').eq('user_id', userId)
    if (deletion.error || remaining.error || remaining.data?.length) {
      console.error('FAIL synthetic browser fixture cleanup')
      process.exitCode = 1
    } else console.log('Synthetic browser fixture cleanup: PASS')
  }
}
