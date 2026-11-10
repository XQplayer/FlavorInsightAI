import { supabase } from './supabase.js'
import { verifiedAiEvents } from './aiStream.js'

export const AI_API_BASE = (import.meta.env.VITE_FEMA_API_URL || 'http://127.0.0.1:8787').replace(/\/$/, '')

async function authHeaders() {
  const session = supabase ? (await supabase.auth.getSession()).data?.session : null
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(`${AI_API_BASE}${path}`, {
    method, credentials: 'include', signal,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...await authHeaders() },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || `AI service returned HTTP ${response.status}`)
  }
  return response
}

export const aiChatClient = {
  async session() { return (await request('/ai/session')).json() },
  async list() { return (await request('/ai/conversations')).json() },
  async get(id) { return (await request(`/ai/conversations/${encodeURIComponent(id)}`)).json() },
  async create() { return (await request('/ai/conversations', { method: 'POST' })).json() },
  async rename(id, title) { return (await request(`/ai/conversations/${encodeURIComponent(id)}`, { method: 'PATCH', body: { title } })).json() },
  async linkAnalysis(id, facts) { return (await request(`/ai/conversations/${encodeURIComponent(id)}/analysis-links`, { method: 'POST', body: { facts } })).json() },
  async remove(id) { return (await request(`/ai/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' })).json() },
  async *send(conversationId, message, signal) {
    const response = await request('/ai/chat', { method: 'POST', body: { conversation_id: conversationId, message }, signal })
    yield* verifiedAiEvents(response.body)
  },
  async analysisPlan(goal, inspection, signal) {
    return (await request('/ai/analysis/plan', { method: 'POST', body: { goal, inspection }, signal })).json()
  },
  async analysisExplain(facts, language = 'zh', signal) {
    return (await request('/ai/analysis/explain', { method: 'POST', body: { facts, language }, signal })).json()
  },
}
