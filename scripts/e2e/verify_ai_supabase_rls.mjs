// Real, ephemeral nonproduction Supabase RLS probe. No passwords, JWTs or keys are logged.
import assert from 'node:assert/strict'
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const requireFromFrontend = createRequire(new URL('../../frontend/package.json', import.meta.url))
const { createClient } = requireFromFrontend('@supabase/supabase-js')
const JSZip = requireFromFrontend('jszip')

const required = ['FLAVOR_RLS_TEST_URL', 'FLAVOR_RLS_TEST_ANON_KEY', 'FLAVOR_RLS_TEST_SERVICE_ROLE_KEY', 'FLAVOR_RLS_TEST_PROJECT_REF']
const missing = required.filter(name => !process.env[name])
if (missing.length) {
  console.error(`NOT_RUN: configure ${missing.join(', ')} in a private local environment; no remote changes were made`)
  process.exit(2)
}

const projectUrl = new URL(process.env.FLAVOR_RLS_TEST_URL)
const projectRef = process.env.FLAVOR_RLS_TEST_PROJECT_REF
if (projectUrl.protocol !== 'https:' || projectUrl.hostname !== `${projectRef}.supabase.co` || projectUrl.pathname !== '/' || projectUrl.search || projectUrl.hash || process.env.FLAVOR_RLS_TEST_ENVIRONMENT !== 'nonproduction') {
  console.error('REFUSED: exact nonproduction Supabase project reference and environment marker are required')
  process.exit(2)
}
if (process.env.FLAVOR_RLS_TEST_ANON_KEY === process.env.FLAVOR_RLS_TEST_SERVICE_ROLE_KEY) {
  console.error('REFUSED: ordinary-user tests require a distinct anon key, never the service role key')
  process.exit(2)
}

const gatewayUrl = process.env.FLAVOR_RLS_TEST_GATEWAY_URL || 'http://127.0.0.1:18887'
const gatewayOrigin = process.env.FLAVOR_RLS_TEST_GATEWAY_ORIGIN || 'http://127.0.0.1:5195'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(gatewayUrl)) {
  console.error('REFUSED: the AI Gateway must be a local loopback service for this test')
  process.exit(2)
}

const anonKey = process.env.FLAVOR_RLS_TEST_ANON_KEY
const admin = createClient(projectUrl.href, process.env.FLAVOR_RLS_TEST_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
const createUserClient = () => createClient(projectUrl.href, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
const created = []
const storagePaths = []
const checks = {}
const started = new Date().toISOString()
const mark = (name, outcome) => { checks[name] = outcome; assert.equal(outcome, true, name) }
const checked = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.code || result.error.status || 'supabase_error'}`)
  return result.data
}
const gatewayHeaders = token => ({ Authorization: `Bearer ${token}`, Origin: gatewayOrigin })
const gatewayJson = async (route, token, options = {}) => {
  const response = await fetch(`${gatewayUrl}${route}`, { ...options, headers: { ...gatewayHeaders(token), ...(options.headers || {}) } })
  const body = await response.json()
  return { status: response.status, body }
}

async function makeIdentity(label) {
  const password = `${randomBytes(24).toString('base64url')}!Aa1`
  const email = `flavor-rls-${label}-${randomUUID()}@example.com`
  const user = checked(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: `SYNTHETIC_RLS_${label}` } }), `create ${label}`).user
  if (!user?.id) throw new Error(`create ${label}: no user id`)
  created.push(user.id)
  const profile = checked(await admin.from('profiles').update({ approval_status: 'approved', is_admin: label === 'admin' }).eq('id', user.id).select('id,is_admin'), `approve ${label}`)
  if (profile?.length !== 1 || profile[0].is_admin !== (label === 'admin')) throw new Error(`approve ${label}: profile policy setup did not persist`)
  const client = createUserClient()
  const session = checked(await client.auth.signInWithPassword({ email, password }), `login ${label}`).session
  if (!session?.access_token) throw new Error(`login ${label}: no JWT`)
  return { id: user.id, token: session.access_token, client }
}

async function makeArchive() {
  const archive = new JSZip()
  const stage4Path = '04_跨样品合并与半定量/data.json'
  const stage5Path = '05_统计_CV_CAS与QC/data.json'
  const stage4 = JSON.stringify({ table: { rows: [{ 'CAS #': '141-78-6', Name: 'SYNTHETIC_ETHYL_ACETATE', 化合物分类: '酯类' }] }, concentrationStatus: [{ cas: '141-78-6', sampleName: 'SYNTHETIC_S1', concentration: 2.5, status: 'Calculated' }], counts: { naConcentrations: 0 } })
  const stage5 = JSON.stringify({ cvScreeningExecuted: true, cvThreshold: 30, groupStatistics: [{ cas: '141-78-6', sampleGroup: 'SYNTHETIC_G', sampleNames: ['SYNTHETIC_S1', 'SYNTHETIC_S2', 'SYNTHETIC_S3'], concentrations: [2, 2.5, 3], mean: 2.5, sd: 0.5, cv: 20, status: 'Retained_CV_At_Or_Below_Threshold' }], counts: { allNaGroups: 0, incompleteGroups: 0, filteredGroups: 0 } })
  for (const [dataPath, content] of [[stage4Path, stage4], [stage5Path, stage5]]) {
    archive.file(dataPath, content)
    archive.file(dataPath.replace('/data.json', '/manifest.json'), JSON.stringify({ severity: 'PASS', outputHashes: [{ path: dataPath, sha256: createHash('sha256').update(content).digest('hex') }] }))
  }
  return archive.generateAsync({ type: 'nodebuffer' })
}

async function makeTask(identity, label, archive) {
  const id = randomUUID()
  const row = { id, user_id: identity.id, name: `SYNTHETIC_RLS_${label}`, status: 'complete', mode: 'continuous', current_stage: 7, progress: 100, stage_summary: [{ stage: 5, status: 'PASS', counts: { filteredGroups: 0 } }], qc_summary: { filteredGroups: 0 }, completed_at: new Date().toISOString() }
  checked(await identity.client.from('shimadzu_jobs').insert(row), `insert ${label} task with ordinary JWT`)
  const objectPath = `${identity.id}/${id}/result.zip`
  checked(await identity.client.storage.from('shimadzu-results').upload(objectPath, archive, { contentType: 'application/zip', upsert: false }), `upload ${label} archive with ordinary JWT`)
  storagePaths.push(objectPath)
  const hash = createHash('sha256').update(archive).digest('hex')
  const linked = checked(await identity.client.from('shimadzu_jobs').update({ result_path: objectPath, result_size: archive.length, result_sha256: hash }).eq('id', id).select('id'), `link ${label} archive`)
  if (linked?.length !== 1) throw new Error(`link ${label} archive: update was not visible to owner`)
  return { id, objectPath }
}

async function main() {
  const archive = await makeArchive()
  // Create the named admin first so the migration's first-user bootstrap cannot accidentally promote an ordinary test user.
  const administrator = await makeIdentity('admin')
  const alice = await makeIdentity('alice')
  const bob = await makeIdentity('bob')
  const aliceTask = await makeTask(alice, 'alice', archive)
  const bobTask = await makeTask(bob, 'bob', archive)
  const nonexistent = randomUUID()
  const select = (identity, id) => identity.client.from('shimadzu_jobs').select('id,user_id,name,result_path').eq('id', id)
  mark('alice_owns_alice_task', checked(await select(alice, aliceTask.id), 'alice own read').length === 1)
  mark('bob_owns_bob_task', checked(await select(bob, bobTask.id), 'bob own read').length === 1)
  mark('alice_cannot_read_bob_task', checked(await select(alice, bobTask.id), 'alice foreign read').length === 0)
  mark('absent_task_matches_foreign_visibility', checked(await select(alice, nonexistent), 'alice absent read').length === 0)
  mark('admin_reads_bob_task_under_real_rls', checked(await select(administrator, bobTask.id), 'admin read').length === 1)
  mark('alice_storage_downloads_own_result', !!checked(await alice.client.storage.from('shimadzu-results').download(aliceTask.objectPath), 'alice own ZIP'))
  const foreignDownload = await bob.client.storage.from('shimadzu-results').download(aliceTask.objectPath)
  mark('bob_cannot_download_alice_result', !!foreignDownload.error && !foreignDownload.data)
  const traversalDownload = await bob.client.storage.from('shimadzu-results').download(`${bob.id}/../${aliceTask.objectPath}`)
  mark('bob_cannot_traverse_to_alice_result', !!traversalDownload.error && !traversalDownload.data)
  mark('admin_downloads_alice_result_under_real_rls', !!checked(await administrator.client.storage.from('shimadzu-results').download(aliceTask.objectPath), 'admin ZIP'))

  const sessionA = await gatewayJson('/ai/session', alice.token)
  const sessionB = await gatewayJson('/ai/session', bob.token)
  mark('gateway_verified_real_jwts', sessionA.status === 200 && sessionB.status === 200 && sessionA.body.identity === 'account' && sessionB.body.identity === 'account')
  const conversation = await gatewayJson('/ai/conversations', alice.token, { method: 'POST' })
  mark('alice_conversation_created', conversation.status === 201 && !!conversation.body.id)
  const denied = await gatewayJson(`/ai/conversations/${conversation.body.id}`, bob.token)
  mark('bob_cannot_read_alice_conversation', denied.status === 404)
  const deniedChat = await gatewayJson('/ai/chat', bob.token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation_id: conversation.body.id, message: 'SYNTHETIC CROSS-USER SESSION PROBE' }) })
  mark('bob_cannot_use_alice_conversation', deniedChat.status === 404)
  const bobList = await gatewayJson('/ai/conversations', bob.token)
  mark('bob_list_excludes_alice_conversation', bobList.status === 200 && !bobList.body.conversations?.some(item => item.id === conversation.body.id))
  const ownConversation = await gatewayJson(`/ai/conversations/${conversation.body.id}`, alice.token)
  mark('alice_can_read_own_conversation', ownConversation.status === 200)

  if (process.env.FLAVOR_RLS_TEST_RUN_MODEL === 'true') {
    if (sessionA.body.mode !== 'openai' || !sessionA.body.key_configured) throw new Error('Gateway must be configured for a real OpenAI model call')
    const taskPrompt = async (taskId, message) => {
      const response = await fetch(`${gatewayUrl}/ai/chat`, { method: 'POST', headers: { ...gatewayHeaders(alice.token), 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation_id: conversation.body.id, message: `${message} ${taskId}` }) })
      const events = (await response.text()).split(/\r?\n/).filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)))
      return { status: response.status, events, answer: events.filter(event => event.type === 'delta').map(event => event.text).join('') }
    }
    const denied = probe => probe.status === 200 && probe.events.some(event => event.type === 'tool' && event.name === 'get_analysis_summary' && event.status === 'failed') && probe.events.some(event => event.type === 'done' && (!event.sources || event.sources.length === 0))
    const foreign = await taskPrompt(bobTask.id, '解释我无权访问的任务的结果摘要')
    const absent = await taskPrompt(nonexistent, '解释不存在的任务的结果摘要')
    mark('model_tool_denied_foreign_task', denied(foreign))
    mark('model_tool_denied_absent_task', denied(absent))
    mark('model_response_does_not_enumerate_task_ids', foreign.answer === absent.answer && !foreign.answer.includes('SYNTHETIC_RLS_bob') && !foreign.answer.includes('2.5'))
    const own = await taskPrompt(aliceTask.id, '解读我自己的合成任务结果摘要、半定量单位与 QC')
    mark('model_tool_reads_only_authorized_task', own.status === 200 && own.events.some(event => event.type === 'tool' && event.name === 'get_analysis_summary' && event.status === 'complete') && own.events.some(event => event.type === 'done' && event.sources?.some(source => source.type === 'private_task_record')))
    mark('model_own_answer_does_not_leak_foreign_task', !own.answer.includes('SYNTHETIC_RLS_bob'))
  } else {
    checks.model_tool_denied_foreign_task = 'NOT_RUN: set FLAVOR_RLS_TEST_RUN_MODEL=true for one bounded paid model call'
  }
  return { started, completed: new Date().toISOString(), project_ref: projectRef, status: process.env.FLAVOR_RLS_TEST_RUN_MODEL === 'true' ? 'PASS' : 'PARTIAL', synthetic_task_ids: [aliceTask.id, bobTask.id], checks }
}

let result
try {
  result = await main()
  console.log(`${result.status} real Supabase RLS probe: ${Object.values(result.checks).filter(value => value === true).length} checks; project ${projectRef}`)
} catch (error) {
  result = { started, completed: new Date().toISOString(), project_ref: projectRef, checks, status: 'FAIL', error: String(error.message).slice(0, 180) }
  console.error(`FAIL real Supabase RLS probe: ${result.error}`)
  process.exitCode = 1
} finally {
  // Only generated paths and identities are removed, from the explicitly named nonproduction project.
  const cleanup = []
  for (const objectPath of storagePaths) {
    const removal = await admin.storage.from('shimadzu-results').remove([objectPath])
    cleanup.push({ kind: 'synthetic_archive', success: !removal.error })
  }
  for (const id of created.reverse()) {
    const removal = await admin.auth.admin.deleteUser(id)
    cleanup.push({ kind: 'synthetic_user_and_cascaded_task', success: !removal.error })
  }
  if (result.synthetic_task_ids?.length) {
    const rows = await admin.from('shimadzu_jobs').select('id').in('id', result.synthetic_task_ids)
    cleanup.push({ kind: 'synthetic_task_cascade_verification', success: !rows.error && rows.data?.length === 0 })
  }
  result.cleanup = cleanup
  const output = path.resolve('_local/verification/ai-supabase-rls-real.json')
  await mkdir(path.dirname(output), { recursive: true })
  if (cleanup.some(item => !item.success)) {
    result.status = 'FAIL_CLEANUP'
    console.error('FAIL: cleanup of generated nonproduction fixtures was incomplete; inspect the local evidence file')
    process.exitCode = 1
  }
  await writeFile(output, JSON.stringify(result, null, 2))
}
