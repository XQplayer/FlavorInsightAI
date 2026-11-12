// Explicitly authorized production probe. Only disposable synthetic users and rows are created.
// No password, JWT, API key, user ID or row ID is written to the public evidence file.
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const requireFromFrontend = createRequire(new URL('../../frontend/package.json', import.meta.url))
const { createClient } = requireFromFrontend('@supabase/supabase-js')
const ref = 'nwcoyhavzbygyqeadcnw'
const url = `https://${ref}.supabase.co`
const gateway = 'https://flavorinsight-ai-gateway.onrender.com'
const origin = 'https://xqplayer.github.io'
const evidencePath = path.resolve('_local/verification/ai-chat-rls-production.json')
const recoveryPath = path.resolve('_local/verification/ai-chat-prod-cleanup-recovery.local.json')
const anonKey = process.env.SUPABASE_PROD_ANON_KEY
const secretKey = process.env.SUPABASE_PROD_SERVICE_ROLE_KEY
const managementToken = process.env.SUPABASE_PROD_MANAGEMENT_TOKEN

if (process.env.FLAVOR_AI_PROD_SYNTHETIC_TEST !== 'true' ||
    process.env.SUPABASE_PROD_PROJECT_REF !== ref ||
    process.env.SUPABASE_PROD_URL !== url ||
    process.env.SUPABASE_PROD_ORGANIZATION_SLUG !== 'wkbburugozvjmhjgwjsz' ||
    !anonKey?.startsWith('sb_publishable_') || !secretKey?.startsWith('sb_secret_') ||
    !managementToken || anonKey === secretKey) {
  console.error('REFUSED: exact production identity, scoped credentials and explicit opt-in required')
  process.exit(2)
}

const client = key => createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
const admin = client(secretKey)
const createdUsers = []
const createdConversations = []
const checks = {}
const evidence = { project: 'XQplayer\'s Project', environment: 'production',
  fixture: 'synthetic-only', started: new Date().toISOString(), checks }

function checked(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.code || result.error.status || 'supabase_error'}`)
  return result.data
}
function mark(label, actual) {
  checks[label] = Boolean(actual)
  assert.equal(checks[label], true, label)
}
async function gatewayRequest(pathname, token, { method = 'GET', body } = {}) {
  const response = await fetch(gateway + pathname, {
    method, headers: { Origin: origin, Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000),
  })
  const payload = await response.json().catch(() => ({}))
  return { status: response.status, payload }
}
async function identity(label) {
  const email = `flavor-prod-rls-${label}-${randomUUID()}@example.com`
  const password = `${randomBytes(24).toString('base64url')}!Aa1`
  const result = checked(await admin.auth.admin.createUser({ email, password, email_confirm: true,
    user_metadata: { display_name: `SYNTHETIC_PROD_CHAT_RLS_${label}` } }), `create ${label}`)
  assert.ok(result.user?.id, `create ${label} missing user`)
  createdUsers.push(result.user.id)
  const profile = checked(await admin.from('profiles').select('id,is_admin,approval_status')
    .eq('id', result.user.id).single(), `profile ${label}`)
  mark(`${label}_ordinary_profile`, profile.is_admin === false)
  checked(await admin.from('profiles').update({ approval_status: 'approved' })
    .eq('id', result.user.id).select('id').single(), `approve synthetic ${label}`)
  const ordinary = client(anonKey)
  const login = checked(await ordinary.auth.signInWithPassword({ email, password }), `login ${label}`)
  assert.ok(login.session?.access_token, `login ${label} missing JWT`)
  return { id: result.user.id, token: login.session.access_token, client: ordinary }
}
async function run() {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}`, {
    headers: { Authorization: `Bearer ${managementToken}` }, signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`project identity HTTP ${response.status}`)
  const project = await response.json()
  mark('management_project_identity', (project.ref || project.id) === ref &&
    project.name === 'XQplayer\'s Project' &&
    project.organization_slug === 'wkbburugozvjmhjgwjsz' &&
    String(project.status || '').startsWith('ACTIVE'))
  checked(await admin.from('ai_conversations').select('id').limit(0), 'chat table preflight')

  const alice = await identity('alice')
  const bob = await identity('bob')
  for (const [label, person] of [['alice', alice], ['bob', bob]]) {
    const session = await gatewayRequest('/ai/session', person.token)
    mark(`${label}_gateway_real_jwt`, session.status === 200 && session.payload.identity === 'account')
    mark(`${label}_gateway_disabled_and_durable`, session.payload.mode === 'disabled' &&
      session.payload.history_persistence === 'supabase' &&
      session.payload.private_task_tools_enabled === false)
    const created = await gatewayRequest('/ai/conversations', person.token, { method: 'POST', body: {} })
    mark(`${label}_gateway_creates_session`, created.status === 201 && Boolean(created.payload.id))
    createdConversations.push(created.payload.id)
  }
  const [aliceConversation, bobConversation] = createdConversations
  for (const [label, person, sessionId] of [
    ['alice', alice, aliceConversation], ['bob', bob, bobConversation],
  ]) {
    checked(await admin.from('ai_messages').insert({ session_id: sessionId, user_id: person.id,
      role: 'user', content: `SYNTHETIC_PROD_CHAT_RLS_${label}`, status: 'completed' }), `seed ${label} message`)
    checked(await admin.from('ai_analysis_links').insert({ session_id: sessionId, user_id: person.id,
      analysis_id: `synthetic_${label}_${randomUUID()}`,
      result_id: `synthetic_${label}_${randomUUID()}`, result_schema: 'flavor-pca-result/1',
      summary: { synthetic: true }, provenance: 'client-validated-browser-pca-summary' }),
    `seed ${label} analysis link`)
  }

  const anonymous = client(anonKey)
  for (const table of ['ai_conversations', 'ai_messages', 'ai_analysis_links']) {
    const filter = table === 'ai_conversations' ? 'id' : 'session_id'
    const own = checked(await alice.client.from(table).select('*')
      .eq(filter, aliceConversation), `${table} owner read`)
    const foreign = checked(await bob.client.from(table).select('*')
      .eq(filter, aliceConversation), `${table} foreign read`)
    const anonymousResult = await anonymous.from(table).select('*').eq(filter, aliceConversation)
    mark(`${table}_owner_reads_own`, own.length === 1)
    mark(`${table}_foreign_reads_none`, foreign.length === 0)
    mark(`${table}_anonymous_reads_none`, Boolean(anonymousResult.error) || anonymousResult.data?.length === 0)
  }
  const aliceList = await gatewayRequest('/ai/conversations', alice.token)
  const bobList = await gatewayRequest('/ai/conversations', bob.token)
  mark('gateway_alice_lists_only_own', aliceList.status === 200 &&
    aliceList.payload.conversations?.length === 1 && aliceList.payload.conversations[0].id === aliceConversation)
  mark('gateway_bob_lists_only_own', bobList.status === 200 &&
    bobList.payload.conversations?.length === 1 && bobList.payload.conversations[0].id === bobConversation)
  const aliceReadsBob = await gatewayRequest(`/ai/conversations/${bobConversation}`, alice.token)
  const bobReadsAlice = await gatewayRequest(`/ai/conversations/${aliceConversation}`, bob.token)
  mark('gateway_alice_cannot_read_bob', aliceReadsBob.status === 404)
  mark('gateway_bob_cannot_read_alice', bobReadsAlice.status === 404)
  const aliceOwn = await gatewayRequest(`/ai/conversations/${aliceConversation}`, alice.token)
  mark('gateway_owner_sees_message_and_link', aliceOwn.status === 200 &&
    aliceOwn.payload.messages?.length === 1 && aliceOwn.payload.analysis_links?.length === 1)
  const invalid = await gatewayRequest('/ai/conversations/not-a-uuid', alice.token)
  mark('gateway_invalid_id_not_found', invalid.status === 404)
  const noToken = await fetch(gateway + '/ai/conversations', { headers: { Origin: origin },
    signal: AbortSignal.timeout(30000) })
  mark('gateway_anonymous_denied', noToken.status === 401)
  const insert = await alice.client.from('ai_conversations').insert({ user_id: alice.id,
    title: 'SYNTHETIC_UNAUTHORIZED_WRITE' })
  mark('authenticated_insert_denied', Boolean(insert.error))
  const update = await alice.client.from('ai_conversations').update({ title: 'SYNTHETIC_UNAUTHORIZED_WRITE' })
    .eq('id', aliceConversation).select('id')
  mark('authenticated_update_denied', Boolean(update.error) || update.data?.length === 0)
  const removal = await alice.client.from('ai_conversations').delete().eq('id', aliceConversation).select('id')
  mark('authenticated_delete_denied', Boolean(removal.error) || removal.data?.length === 0)
  const retained = checked(await admin.from('ai_conversations').select('id')
    .eq('id', aliceConversation), 'retained row')
  mark('service_owned_row_retained', retained.length === 1)
}

try {
  await run()
  evidence.status = 'PASS'
  console.log(`PASS production real-JWT chat RLS and Gateway: ${Object.keys(checks).length} checks`)
} catch (error) {
  evidence.status = 'FAIL'
  evidence.failure = String(error.message).replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '[redacted]').slice(0, 180)
  console.error(`FAIL production real-JWT chat RLS and Gateway: ${evidence.failure}`)
  process.exitCode = 1
} finally {
  const cleanup = []
  for (const id of createdConversations) {
    const result = await admin.from('ai_conversations').delete().eq('id', id)
    cleanup.push({ kind: 'synthetic_conversation', success: !result.error })
  }
  for (const id of createdUsers) {
    const result = await admin.auth.admin.deleteUser(id)
    cleanup.push({ kind: 'synthetic_user', success: !result.error })
  }
  for (const id of createdConversations) {
    const result = await admin.from('ai_conversations').select('id').eq('id', id)
    cleanup.push({ kind: 'verify_conversation_absent', success: !result.error && result.data?.length === 0 })
  }
  for (const id of createdUsers) {
    const result = await admin.auth.admin.getUserById(id)
    cleanup.push({ kind: 'verify_user_absent', success: Boolean(result.error) && !result.data?.user })
  }
  evidence.cleanup = cleanup
  evidence.completed = new Date().toISOString()
  if (cleanup.some(item => !item.success)) {
    evidence.status = 'FAIL_CLEANUP'
    process.exitCode = 1
    await mkdir(path.dirname(recoveryPath), { recursive: true })
    await writeFile(recoveryPath, JSON.stringify({ createdUsers, createdConversations }))
    console.error('FAIL: exact synthetic fixture IDs saved to ignored local recovery file')
  }
  await mkdir(path.dirname(evidencePath), { recursive: true })
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2))
}
