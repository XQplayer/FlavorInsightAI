// Real-JWT, real-R, owner-scoped PCA probe against the exact synthetic Staging target.
// Run with Node --env-file pointing to an ignored local file; never print credentials.
import assert from 'node:assert/strict'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(new URL('../../frontend/package.json', import.meta.url))
const { createClient } = require('@supabase/supabase-js')
const ref = 'zwbzyrshzegwlgcaxudo'
const url = `https://${ref}.supabase.co`
const origin = 'http://127.0.0.1:5174'
const port = 19194
const base = `http://127.0.0.1:${port}`
const env = process.env
const secret = env.SUPABASE_STAGING_SERVICE_ROLE_KEY
const anon = env.SUPABASE_STAGING_ANON_KEY
if (env.SUPABASE_STAGING_URL !== url || env.SUPABASE_STAGING_PROJECT_REF !== ref ||
    env.SUPABASE_STAGING_ORGANIZATION_SLUG !== 'wkbburugozvjmhjgwjsz' ||
    env.SUPABASE_STAGING_ENVIRONMENT !== 'nonproduction' || !secret || !anon || !env.ANALYSIS_RSCRIPT) {
  throw new Error('REFUSED: exact nonproduction Staging identity, credentials and local R are required')
}
const common = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const admin = createClient(url, secret, common)
const userClient = () => createClient(url, anon, common)
const created = []
let server
let jobId

function checked(value, label) {
  if (value.error) throw new Error(`${label}: Supabase error ${value.error.status || value.error.code || 'unknown'}`)
  return value.data
}

async function identity(label) {
  const email = `synthetic-pca-${label}-${randomUUID()}@example.com`
  const password = `${randomBytes(24).toString('base64url')}!Aa1`
  const user = checked(await admin.auth.admin.createUser({ email, password, email_confirm: true,
    user_metadata: { display_name: `SYNTHETIC_PCA_${label}` } }), `create ${label}`).user
  created.push(user.id)
  const profile = checked(await admin.from('profiles').update({ approval_status: 'approved', is_admin: false })
    .eq('id', user.id).select('id,is_admin'), `approve ${label}`)
  assert.equal(profile.length, 1)
  assert.equal(profile[0].is_admin, false)
  const client = userClient()
  const token = checked(await client.auth.signInWithPassword({ email, password }), `sign in ${label}`).session?.access_token
  assert.ok(token)
  return { id: user.id, token, client }
}

async function call(path, token, options = {}) {
  const response = await fetch(base + path, { ...options, headers: {
    Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
  }, signal: AbortSignal.timeout(12000) })
  return { status: response.status, body: await response.json() }
}

async function main() {
  const projectResponse = await fetch(`https://api.supabase.com/v1/projects/${ref}`, {
    headers: { Authorization: `Bearer ${env.SUPABASE_STAGING_MANAGEMENT_TOKEN}` },
    signal: AbortSignal.timeout(15000),
  })
  assert.equal(projectResponse.status, 200, 'management identity query')
  const project = await projectResponse.json()
  assert.equal(project.name, 'FlavorInsightAI-Staging')
  assert.equal(project.organization_slug, 'wkbburugozvjmhjgwjsz')
  assert.equal(project.ref || project.id, ref)
  console.log('PASS exact Staging project identity')

  const a = await identity('a')
  const b = await identity('b')
  console.log('PASS two ordinary approved synthetic users with real JWTs')

  server = spawn(env.FLAVOR_RLS_TEST_PYTHON || 'python', ['-m', 'services.analysis.hosted_http'], {
    cwd: process.cwd(), windowsHide: true, stdio: 'ignore', env: { ...env,
      FLAVOR_AI_PCA_ENABLED: 'true', FLAVOR_AI_SUPABASE_URL: url,
      FLAVOR_AI_PCA_SINGLE_INSTANCE: 'true',
      FLAVOR_AI_SUPABASE_ANON_KEY: anon, FLAVOR_AI_PCA_SUPABASE_SECRET_KEY: secret,
      FLAVOR_AI_PCA_PROJECT_REF: ref, FLAVOR_AI_ALLOWED_ORIGINS: origin,
      PORT: String(port),
    },
  })
  let ready = false
  for (let i = 0; i < 50; i++) {
    if (server.exitCode !== null) throw new Error('Hosted process exited before ready')
    try {
      const health = await call('/health')
      if (health.status === 200 && health.body.capabilities.runtimeReady) { ready = true; break }
    } catch { /* R startup may still be probing. */ }
    await new Promise(resolve => setTimeout(resolve, 300))
  }
  assert.ok(ready, 'hosted R service ready')
  console.log('PASS hosted API and real R engine ready')

  const dataset = { schemaVersion: 1, id: 'synthetic-staging-pca',
    samples: Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, group: i < 3 ? 'C' : 'T', biologicalUnitId: `u${i}`, include: true })),
    features: [{ id: 'f1', unit: 'mg/L' }, { id: 'f2', unit: 'mg/L' }],
    matrix: [[1, 2], [2, 4], [3, 5], [5, 8], [6, 10], [8, 12]],
    quality: { cellStates: Array.from({ length: 6 }, () => ['observed', 'observed']) },
    provenance: { independenceConfirmed: true },
  }
  const datasetJson = JSON.stringify(dataset)
  const analysis = { method: 'pca', components: 2, center: true }
  const payload = { datasetJson, recipe: {}, analysis, idempotencyKey: randomUUID(),
    planReceipt: { datasetId: dataset.id, datasetHash: createHash('sha256').update(datasetJson).digest('hex'),
      recipe: {}, analysis, confirmationHash: 'c'.repeat(64) } }
  const submitted = await call('/jobs', a.token, { method: 'POST', body: JSON.stringify(payload) })
  assert.equal(submitted.status, 202, `submit: ${submitted.body?.error?.code || 'unexpected status'}`)
  jobId = submitted.body.id
  assert.ok(jobId)
  assert.equal((await call(`/jobs/${jobId}`, b.token)).status, 404)
  assert.equal((await call(`/jobs/${jobId}`, 'invalid-jwt')).status, 401)
  assert.equal((await call(`/jobs/${jobId}`)).status, 401)
  console.log('PASS hosted API foreign, invalid and anonymous requests denied')

  const own = checked(await a.client.from('ai_pca_jobs').select('id,status').eq('id', jobId), 'owner read')
  assert.equal(own.length, 1)
  const foreign = checked(await b.client.from('ai_pca_jobs').select('id,status').eq('id', jobId), 'foreign read')
  assert.equal(foreign.length, 0)
  const anonymous = await userClient().from('ai_pca_jobs').select('id').eq('id', jobId)
  // The reviewed migration revokes anon table SELECT outright, so 42501 is
  // the expected stronger denial; an empty RLS result is also safe.
  assert.ok(anonymous.error?.code === '42501' || (!anonymous.error && anonymous.data?.length === 0))
  const forged = await b.client.from('ai_pca_jobs').insert({ user_id: a.id, status: 'completed' })
  assert.ok(forged.error)
  console.log('PASS actual RLS owner read, foreign/anonymous denial and client write denial')

  let terminal
  for (let i = 0; i < 120; i++) {
    const response = await call(`/jobs/${jobId}`, a.token)
    assert.equal(response.status, 200)
    if (['completed', 'failed', 'cancelled', 'interrupted'].includes(response.body.status)) {
      terminal = response.body; break
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  assert.equal(terminal?.status, 'completed', `real R result: ${terminal?.error_code || 'timeout'}`)
  assert.equal(terminal.result_json?.method, 'pca')
  assert.equal(terminal.result_json?.data?.scores?.length, 6)
  assert.equal(terminal.logs?.[0]?.code, 'USER_CONFIRMED_PLAN')
  console.log('PASS synthetic PCA completed with real R scores and persisted owner-scoped result')
}

try {
  await main()
} catch (error) {
  // Never emit URLs, JWTs, passwords, raw matrices or third-party error bodies.
  console.error(`FAIL ${error.name}: ${String(error.message).slice(0, 180)}`)
  process.exitCode = 1
} finally {
  if (server) server.kill()
  let cleanupOk = true
  for (const id of created) {
    const deletion = await admin.auth.admin.deleteUser(id)
    if (deletion.error) { console.error('FAIL synthetic user cleanup'); process.exitCode = 1; cleanupOk = false }
  }
  if (jobId) {
    const remaining = await admin.from('ai_pca_jobs').select('id').eq('id', jobId)
    if (remaining.error || remaining.data?.length) { console.error('FAIL synthetic job cascade cleanup'); process.exitCode = 1; cleanupOk = false }
  }
  if (created.length) console.log(`Synthetic test cleanup: ${cleanupOk ? 'PASS' : 'CHECK_REQUIRED'}`)
}
