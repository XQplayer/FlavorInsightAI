// Real Staging Auth/RLS probe for the optional paid-Gateway approval gate.
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const requireFromFrontend = createRequire(new URL('../../frontend/package.json', import.meta.url))
const { createClient } = requireFromFrontend('@supabase/supabase-js')
const ref = 'zwbzyrshzegwlgcaxudo'
const url = `https://${ref}.supabase.co`
if (process.env.FLAVOR_AI_APPROVAL_STAGING_TEST !== 'true' ||
    process.env.SUPABASE_STAGING_ENVIRONMENT !== 'nonproduction' ||
    process.env.SUPABASE_STAGING_PROJECT_REF !== ref ||
    process.env.SUPABASE_STAGING_URL !== url ||
    !process.env.SUPABASE_STAGING_MANAGEMENT_TOKEN ||
    !process.env.SUPABASE_STAGING_ANON_KEY ||
    !process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY) {
  console.error('REFUSED: exact Staging identity and explicit opt-in required')
  process.exit(2)
}
const projectResponse = await fetch(`https://api.supabase.com/v1/projects/${ref}`, {
  headers: { Authorization: `Bearer ${process.env.SUPABASE_STAGING_MANAGEMENT_TOKEN}` },
  signal: AbortSignal.timeout(20000),
})
const project = await projectResponse.json()
assert.equal(projectResponse.ok && project.name === 'FlavorInsightAI-Staging' &&
  project.organization_slug === process.env.SUPABASE_STAGING_ORGANIZATION_SLUG, true)

const client = key => createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
const admin = client(process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY)
const ordinary = client(process.env.SUPABASE_STAGING_ANON_KEY)
const email = `flavor-ai-approval-${randomUUID()}@example.com`
const password = `${randomBytes(24).toString('base64url')}!Aa1`
const created = await admin.auth.admin.createUser({ email, password, email_confirm: true,
  user_metadata: { display_name: 'SYNTHETIC_APPROVAL_GATE' } })
if (created.error || !created.data.user?.id) throw new Error('Synthetic Staging user creation failed')
let server
try {
  const login = await ordinary.auth.signInWithPassword({ email, password })
  if (login.error || !login.data.session?.access_token) throw new Error('Synthetic Staging sign-in failed')
  const token = login.data.session.access_token
  const port = '18893'
  server = spawn('python', ['ai_gateway_server.py'], {
    cwd: process.cwd(), stdio: 'ignore', windowsHide: true,
    env: { ...process.env, HOST: '127.0.0.1', PORT: port, FLAVOR_AI_MODE: 'disabled',
      FLAVOR_AI_SUPABASE_URL: url,
      FLAVOR_AI_SUPABASE_ANON_KEY: process.env.SUPABASE_STAGING_ANON_KEY,
      FLAVOR_AI_SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY,
      FLAVOR_AI_REQUIRE_PERSISTENCE: 'true', FLAVOR_AI_REQUIRE_APPROVED_PROFILE: 'true',
      FLAVOR_AI_ALLOWED_ORIGINS: `http://127.0.0.1:${port}` },
  })
  const base = `http://127.0.0.1:${port}`
  let ready = false
  for (let attempt = 0; attempt < 30; attempt++) {
    try { ready = (await fetch(`${base}/health`, { signal: AbortSignal.timeout(1000) })).ok } catch { /* booting */ }
    if (ready) break
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  assert.equal(ready, true, 'local Gateway startup')
  const sessionStatus = async () => (await fetch(`${base}/ai/session`, {
    headers: { Authorization: `Bearer ${token}`, Origin: base },
    signal: AbortSignal.timeout(20000),
  })).status
  const setStatus = async approval_status => {
    const change = await admin.from('profiles').update({ approval_status }).eq('id', created.data.user.id).select('id')
    if (change.error || change.data?.length !== 1) throw new Error('Synthetic Staging profile update failed')
  }
  await setStatus('pending')
  const pending = await sessionStatus()
  await setStatus('approved')
  const approved = await sessionStatus()
  await setStatus('rejected')
  const rejected = await sessionStatus()
  assert.deepEqual([pending, approved, rejected], [403, 200, 403])
  console.log(JSON.stringify({ status: 'PASS', project: 'FlavorInsightAI-Staging',
    gate: 'real JWT and owner-visible profile RLS', pending, approved, rejected, model_calls: 0 }))
} finally {
  if (server) { server.kill(); await new Promise(resolve => server.once('exit', resolve)) }
  await ordinary.auth.signOut()
  const removed = await admin.auth.admin.deleteUser(created.data.user.id)
  if (removed.error) { console.error('Synthetic Staging user cleanup failed'); process.exitCode = 1 }
}
