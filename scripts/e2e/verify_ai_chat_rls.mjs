// Staging-only chat table probe with real ordinary-user JWTs and synthetic rows.
// No credential, password, JWT, user ID or row ID is written to the evidence file.
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const requireFromFrontend = createRequire(new URL('../../frontend/package.json', import.meta.url))
const { createClient } = requireFromFrontend('@supabase/supabase-js')
const ref = process.env.SUPABASE_STAGING_PROJECT_REF
const url = process.env.SUPABASE_STAGING_URL
const anonKey = process.env.SUPABASE_STAGING_ANON_KEY
const serviceKey = process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY
const managementToken = process.env.SUPABASE_STAGING_MANAGEMENT_TOKEN
const orgSlug = process.env.SUPABASE_STAGING_ORGANIZATION_SLUG
const evidencePath = path.resolve('_local/verification/ai-chat-rls-real.json')

if (ref !== 'zwbzyrshzegwlgcaxudo' || url !== `https://${ref}.supabase.co` ||
    process.env.SUPABASE_STAGING_ENVIRONMENT !== 'nonproduction' ||
    !anonKey || !serviceKey || anonKey === serviceKey || !managementToken || !orgSlug) {
  console.error('REFUSED: exact Staging identity and separate test credentials are required')
  process.exit(2)
}

const client = key => createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
const admin = client(serviceKey)
const checks = {}
const createdUsers = []
const createdConversations = []
const evidence = { project: 'FlavorInsightAI-Staging', started: new Date().toISOString(), checks }

function checked(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.code || result.error.status || 'supabase_error'}`)
  return result.data
}
function mark(label, passed) {
  checks[label] = Boolean(passed)
  assert.equal(checks[label], true, label)
}
async function identity(label) {
  const email = `flavor-chat-rls-${label}-${randomUUID()}@example.com`
  const password = `${randomBytes(24).toString('base64url')}!Aa1`
  const user = checked(await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { display_name: `SYNTHETIC_CHAT_RLS_${label}` },
  }), `create ${label}`).user
  if (!user?.id) throw new Error(`create ${label}: no user ID`)
  createdUsers.push(user.id)
  const ordinary = client(anonKey)
  checked(await ordinary.auth.signInWithPassword({ email, password }), `login ${label}`)
  return { id: user.id, client: ordinary }
}
async function seed(owner, label) {
  const conversation = checked(await admin.from('ai_conversations').insert({
    user_id: owner.id, title: `SYNTHETIC_CHAT_RLS_${label}`,
  }).select('id').single(), `seed ${label} conversation`)
  createdConversations.push(conversation.id)
  checked(await admin.from('ai_messages').insert({
    session_id: conversation.id, user_id: owner.id, role: 'user',
    content: `SYNTHETIC_CHAT_RLS_${label}`, status: 'completed',
  }), `seed ${label} message`)
  checked(await admin.from('ai_analysis_links').insert({
    session_id: conversation.id, user_id: owner.id,
    analysis_id: `synthetic_${label}_${randomUUID()}`,
    result_id: `synthetic_${label}_${randomUUID()}`,
    result_schema: 'flavor-pca-result/1', summary: { synthetic: true },
    provenance: 'client-validated-browser-pca-summary',
  }), `seed ${label} analysis link`)
  return conversation.id
}
async function run() {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}`, {
    headers: { Authorization: `Bearer ${managementToken}` }, signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(`Staging project lookup HTTP ${response.status}`)
  const project = await response.json()
  mark('management_project_identity', (project.ref || project.id) === ref &&
    project.name === 'FlavorInsightAI-Staging' && project.organization_slug === orgSlug &&
    String(project.status || '').startsWith('ACTIVE'))

  const alice = await identity('alice')
  const bob = await identity('bob')
  const aliceConversation = await seed(alice, 'alice')
  await seed(bob, 'bob')
  const anonymous = client(anonKey)

  for (const table of ['ai_conversations', 'ai_messages', 'ai_analysis_links']) {
    const filter = table === 'ai_conversations' ? 'id' : 'session_id'
    const own = checked(await alice.client.from(table).select('*').eq(filter, aliceConversation), `${table} owner read`)
    const foreign = checked(await bob.client.from(table).select('*').eq(filter, aliceConversation), `${table} foreign read`)
    const anon = await anonymous.from(table).select('*').eq(filter, aliceConversation)
    mark(`${table}_owner_reads_own`, own.length === 1)
    mark(`${table}_foreign_reads_none`, foreign.length === 0)
    mark(`${table}_anonymous_reads_none`, Boolean(anon.error) || anon.data?.length === 0)
  }

  const insert = await alice.client.from('ai_conversations').insert({ user_id: alice.id, title: 'SYNTHETIC_UNAUTHORIZED_WRITE' })
  const update = await alice.client.from('ai_conversations').update({ title: 'SYNTHETIC_UNAUTHORIZED_WRITE' }).eq('id', aliceConversation).select('id')
  const removal = await alice.client.from('ai_conversations').delete().eq('id', aliceConversation).select('id')
  mark('authenticated_insert_denied', Boolean(insert.error))
  mark('authenticated_update_denied', Boolean(update.error) || update.data?.length === 0)
  mark('authenticated_delete_denied', Boolean(removal.error) || removal.data?.length === 0)
  mark('service_owned_row_retained', checked(await admin.from('ai_conversations').select('id').eq('id', aliceConversation), 'retained row').length === 1)
}

try {
  await run()
  evidence.status = 'PASS'
  console.log(`PASS real Staging chat RLS: ${Object.values(checks).filter(Boolean).length} checks`)
} catch (error) {
  evidence.status = 'FAIL'
  evidence.error = String(error.message).slice(0, 160)
  console.error(`FAIL real Staging chat RLS: ${evidence.error}`)
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
  evidence.cleanup = cleanup
  evidence.completed = new Date().toISOString()
  if (cleanup.some(item => !item.success)) {
    evidence.status = 'FAIL_CLEANUP'
    console.error('FAIL: synthetic fixture cleanup requires review')
    process.exitCode = 1
  }
  await mkdir(path.dirname(evidencePath), { recursive: true })
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2))
}
