// Opt-in deployed preview sign-in check using one synthetic Staging user.
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'

const requireFromFrontend = createRequire(new URL('../../frontend/package.json', import.meta.url))
const { createClient } = requireFromFrontend('@supabase/supabase-js')
const { chromium } = requireFromFrontend('playwright')
const ref = 'zwbzyrshzegwlgcaxudo'
const url = `https://${ref}.supabase.co`
const preview = 'https://flavorinsight-agent-pca-preview.onrender.com/ai-assistant/'
if (process.env.FLAVOR_AI_PREVIEW_AUTH_TEST !== 'true' ||
    process.env.SUPABASE_STAGING_ENVIRONMENT !== 'nonproduction' ||
    process.env.SUPABASE_STAGING_PROJECT_REF !== ref ||
    process.env.SUPABASE_STAGING_URL !== url ||
    !process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY ||
    !process.env.SUPABASE_STAGING_MANAGEMENT_TOKEN) {
  console.error('REFUSED: exact Staging configuration and explicit preview-test opt-in required')
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
const email = `flavor-ai-preview-${randomUUID()}@example.com`
const password = `${randomBytes(24).toString('base64url')}!Aa1`
const created = await admin.auth.admin.createUser({ email, password, email_confirm: true,
  user_metadata: { display_name: 'SYNTHETIC_AI_PREVIEW' } })
if (created.error || !created.data.user?.id) throw new Error('Synthetic Staging account creation failed')

let browser
try {
  browser = await chromium.launch({ headless: true,
    executablePath: process.env.BROWSER_PCA_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' })
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
  const page = await context.newPage()
  const sessionResponses = []
  page.on('response', response => {
    if (response.url() === 'https://flavorinsight-ai-gateway-preview.onrender.com/ai/session')
      sessionResponses.push(response.status())
  })
  await page.goto(preview, { waitUntil: 'domcontentloaded' })
  await page.getByRole('textbox', { name: /Email|邮箱/ }).waitFor({ timeout: 20000 })
  await page.getByRole('textbox', { name: /Email|邮箱/ }).fill(email)
  await page.getByLabel(/Password|密码/).fill(password)
  const authenticatedSession = page.waitForResponse(response => response.url() ===
    'https://flavorinsight-ai-gateway-preview.onrender.com/ai/session' && response.status() === 200,
  { timeout: 20000 })
  await page.getByRole('button', { name: /Sign in|登录/ }).click()
  const configuration = await (await authenticatedSession).json()
  if (process.env.FLAVOR_AI_EXPECTED_MODE) assert.equal(configuration.mode, process.env.FLAVOR_AI_EXPECTED_MODE)
  await page.getByText(email, { exact: true }).waitFor({ timeout: 20000 })
  await page.getByRole('button', { name: /Sign out|退出登录/ }).click()
  await page.getByRole('textbox', { name: /Email|邮箱/ }).waitFor({ timeout: 20000 })
  assert.ok(sessionResponses.includes(200), 'authenticated Gateway session must succeed')
  console.log(JSON.stringify({ status: 'PASS', environment: 'Staging synthetic account',
    preview, mode: configuration.mode, authenticatedSession: true, signOut: true }))
  await context.close()
} finally {
  await browser?.close()
  const removed = await admin.auth.admin.deleteUser(created.data.user.id)
  if (removed.error) { console.error('Synthetic user cleanup failed'); process.exitCode = 1 }
}
