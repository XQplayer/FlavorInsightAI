// Paid, opt-in Staging-only online check. Uses synthetic accounts and never logs credentials or answers.
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const requireFromFrontend = createRequire(new URL('../../frontend/package.json', import.meta.url))
const { createClient } = requireFromFrontend('@supabase/supabase-js')
const ref = 'zwbzyrshzegwlgcaxudo'
const url = `https://${ref}.supabase.co`
const gateway = 'https://flavorinsight-ai-gateway-preview.onrender.com'
const origin = 'https://flavorinsight-browser-pca-preview.onrender.com'
const evidencePath = path.resolve('_local/verification/ai-online-ten-turns.json')
const checks = {}
const rounds = []
const evidence = { started: new Date().toISOString(), environment: 'FlavorInsightAI-Staging', gateway, checks, rounds }

if (process.env.FLAVOR_AI_ONLINE_TEN_TURNS !== 'true' ||
    process.env.SUPABASE_STAGING_ENVIRONMENT !== 'nonproduction' ||
    process.env.SUPABASE_STAGING_PROJECT_REF !== ref ||
    process.env.SUPABASE_STAGING_URL !== url ||
    !process.env.SUPABASE_STAGING_ANON_KEY ||
    !process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY ||
    !process.env.SUPABASE_STAGING_MANAGEMENT_TOKEN) {
  console.error('REFUSED: explicit paid-test opt-in and exact Staging configuration are required')
  process.exit(2)
}

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const admin = createClient(url, process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY, options)
const identities = []
const mark = (name, ok) => { checks[name] = Boolean(ok); assert.equal(checks[name], true, name) }
const bodyJson = async response => { const body = await response.json(); return { status: response.status, body } }
const request = (token, route, init = {}) => fetch(`${gateway}${route}`, {
  ...init,
  headers: { Origin: origin, Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  signal: AbortSignal.timeout(120000),
})
const getJson = async (token, route, init) => bodyJson(await request(token, route, init))

async function makeIdentity(label) {
  const email = `flavor-ai-online-${label}-${randomUUID()}@example.com`
  const password = `${randomBytes(24).toString('base64url')}!Aa1`
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true,
    user_metadata: { display_name: `SYNTHETIC_AI_ONLINE_${label}` } })
  if (created.error || !created.data?.user?.id) throw new Error(`Create synthetic ${label} failed`)
  const id = created.data.user.id
  identities.push(id)
  const ordinary = createClient(url, process.env.SUPABASE_STAGING_ANON_KEY, options)
  const login = await ordinary.auth.signInWithPassword({ email, password })
  if (login.error || !login.data?.session?.access_token) throw new Error(`Sign in synthetic ${label} failed`)
  return { id, email, password, token: login.data.session.access_token, client: ordinary }
}

async function chat(token, conversationId, message) {
  const response = await request(token, '/ai/chat', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation_id: conversationId, message }) })
  const raw = await response.text()
  const events = raw.split(/\r?\n/u).filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)))
  const answer = events.filter(event => event.type === 'delta').map(event => event.text).join('')
  const error = events.find(event => event.type === 'error')
  if (response.status !== 200 || error || !events.some(event => event.type === 'done')) {
    throw new Error(`Online chat failed: HTTP ${response.status}; code ${error?.code || 'NO_DONE'}`)
  }
  return { answer, events }
}

try {
  const projectResponse = await fetch(`https://api.supabase.com/v1/projects/${ref}`, {
    headers: { Authorization: `Bearer ${process.env.SUPABASE_STAGING_MANAGEMENT_TOKEN}` },
    signal: AbortSignal.timeout(20000),
  })
  const project = await projectResponse.json()
  mark('exact_staging_identity', projectResponse.ok && (project.ref || project.id) === ref &&
    project.name === 'FlavorInsightAI-Staging' &&
    project.organization_slug === process.env.SUPABASE_STAGING_ORGANIZATION_SLUG)

  const alice = await makeIdentity('alice')
  const bob = await makeIdentity('bob')
  const session = await getJson(alice.token, '/ai/session')
  mark('real_model_and_persistent_history', session.status === 200 && session.body.mode === 'openai' &&
    session.body.key_configured === true && session.body.history_persistence === 'supabase' &&
    session.body.identity === 'account' && !Object.hasOwn(session.body, 'api_key'))
  const created = await getJson(alice.token, '/ai/conversations', { method: 'POST' })
  mark('conversation_created', created.status === 201 && typeof created.body.id === 'string')
  const conversationId = created.body.id
  const denied = await getJson(bob.token, `/ai/conversations/${conversationId}`)
  mark('second_user_denied', denied.status === 404)

  const codeword = `ORCHID-${randomBytes(3).toString('hex').toUpperCase()}`
  const prompts = [
    `这是一组完全合成的科研测试数据。我们讨论 PCA，记住代号 ${codeword}；请用一句话确认。`,
    '上一轮的代号是什么？只写代号。',
    'PCA 前为什么要检查常量变量？请一句话回答。',
    '请调用平台工具查询 CAS 141-78-6，只列有来源的化合物信息。',
    '上一轮查询的 CAS 是什么？',
    '如果样本单位不同，PCA 的中心化与 UV 标准化各做什么？简答。',
    '小样本 PCA 的解释应避免什么过度结论？简答。',
    '浏览器本地 PCA 的原始矩阵是否必须上传模型？简答。',
    '没有真实计算结果时，可以报告 PC1 方差解释率吗？简答。',
    `请回顾第一轮代号和本会话讨论的方法名称；不要编造任何 PCA 数值。`,
  ]
  for (let index = 0; index < prompts.length; index++) {
    if (index > 0) await new Promise(resolve => setTimeout(resolve, 8000))
    const result = await chat(alice.token, conversationId, prompts[index])
    const usage = result.events.find(event => event.type === 'usage') || {}
    rounds.push({ turn: index + 1, deltas: result.events.filter(event => event.type === 'delta').length,
      tools: result.events.filter(event => event.type === 'tool').map(event => ({ name: event.name, status: event.status })),
      input_tokens: usage.input_tokens || 0, output_tokens: usage.output_tokens || 0 })
    if (index === 1) mark('early_context_recall', result.answer.includes(codeword))
    if (index === 3) mark('real_compound_tool', rounds[index].tools.some(tool => tool.name === 'search_compound' && tool.status === 'complete'))
    if (index === 9) mark('ten_turn_context_recall', result.answer.includes(codeword) && /PCA/iu.test(result.answer))
    console.log(`PASS online synthetic turn ${index + 1}/10; deltas=${rounds[index].deltas}; tools=${rounds[index].tools.length}`)
  }
  mark('ten_completed_model_turns', rounds.length === 10 && rounds.every(round => round.input_tokens > 0))
  mark('streamed_text', rounds.some(round => round.deltas > 1))
  const restored = await getJson(alice.token, `/ai/conversations/${conversationId}`)
  mark('history_persisted', restored.status === 200 && restored.body.messages?.length >= 20)
  await alice.client.auth.signOut()
  const relogin = await alice.client.auth.signInWithPassword({ email: alice.email, password: alice.password })
  if (relogin.error) throw new Error('Synthetic re-login failed')
  const afterLogin = await getJson(relogin.data.session.access_token, `/ai/conversations/${conversationId}`)
  mark('history_restored_after_relogin', afterLogin.status === 200 && afterLogin.body.messages?.length >= 20)
  const bobList = await getJson(bob.token, '/ai/conversations')
  mark('conversation_list_isolated', bobList.status === 200 && !bobList.body.conversations?.some(item => item.id === conversationId))
  evidence.status = 'PASS'
} catch (error) {
  evidence.status = 'FAIL'
  evidence.error = String(error.message).slice(0, 180)
  process.exitCode = 1
  console.error(`FAIL online synthetic chat: ${evidence.error}`)
} finally {
  const cleanup = []
  for (const id of identities) {
    const conversations = await admin.from('ai_conversations').delete().eq('user_id', id)
    cleanup.push({ kind: 'synthetic_conversations', success: !conversations.error })
    const user = await admin.auth.admin.deleteUser(id)
    cleanup.push({ kind: 'synthetic_user', success: !user.error })
  }
  evidence.cleanup = cleanup
  evidence.completed = new Date().toISOString()
  if (cleanup.some(item => !item.success)) { evidence.status = 'FAIL_CLEANUP'; process.exitCode = 1 }
  await mkdir(path.dirname(evidencePath), { recursive: true })
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2))
  console.log(`Online ten-turn status: ${evidence.status}; evidence: ${evidencePath}`)
}
