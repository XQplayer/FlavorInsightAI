const KEY = 'flavorinsight:auth-intent:v1'
const MAX_AGE_MS = 15 * 60_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ACTION_ROUTES = Object.freeze({
  'processing.start': 'data-processing',
  'processing.private': 'data-processing',
  'assistant.send': 'ai-assistant',
  'assistant.conversation': 'ai-assistant',
  'analysis.ai': 'data-analysis',
})

function safeDraft(action, draft) {
  if (!draft || typeof draft !== 'object') return {}
  if (action === 'assistant.send') return { text: String(draft.text || '').slice(0, 4000) }
  if (action === 'analysis.ai') return { goal: String(draft.goal || '').slice(0, 500) }
  if (action === 'processing.start') {
    const result = {}
    if (typeof draft.name === 'string') result.name = draft.name.slice(0, 120)
    if (['continuous', 'step'].includes(draft.mode)) result.mode = draft.mode
    if (typeof draft.cvThreshold === 'string') result.cvThreshold = draft.cvThreshold.slice(0, 12)
    for (const key of ['enableCvScreening', 'enableClassification', 'enableWaterDetectionThreshold', 'enableEstimatedReferenceOav']) {
      if (typeof draft[key] === 'boolean') result[key] = draft[key]
    }
    return result
  }
  return {}
}

export function createAuthIntent({ returnPath, action, draft } = {}, basePath = '/', at = Date.now()) {
  const route = ACTION_ROUTES[action]
  if (!route || typeof returnPath !== 'string' || returnPath.length > 500) return null
  const segments = String(basePath).split('/').filter(Boolean)
  const base = segments.length ? `/${segments.join('/')}/` : '/'
  let url
  try { url = new URL(returnPath, 'https://flavorinsight.invalid') } catch { return null }
  if (url.origin !== 'https://flavorinsight.invalid') return null
  const suffix = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : ''
  if (suffix !== route + '/' && suffix !== route && !(route === 'data-processing' && /^(?:data-processing|shimadzu-analysis)(?:\/(?:new|monitor|results|tasks))?\/?$/.test(suffix))) return null
  const query = new URLSearchParams()
  const input = url.searchParams
  if (route === 'data-processing' && UUID.test(input.get('task_id') || '')) query.set('task_id', input.get('task_id'))
  if (route === 'ai-assistant') {
    if (UUID.test(input.get('conversation_id') || '')) query.set('conversation_id', input.get('conversation_id'))
    if (UUID.test(input.get('task_id') || '')) query.set('task_id', input.get('task_id'))
    if (/^\d{2,7}-\d{2}-\d$/.test(input.get('cas') || '')) query.set('cas', input.get('cas'))
  }
  if (route === 'data-analysis') {
    if (input.get('engine') === 'local') query.set('engine', 'local')
    if (UUID.test(input.get('conversation_id') || '')) query.set('conversation_id', input.get('conversation_id'))
  }
  return { version: 1, at, action, returnPath: `${url.pathname}${query.size ? `?${query}` : ''}`, draft: safeDraft(action, draft) }
}

export function saveAuthIntent(input, basePath, storage, at = Date.now()) {
  const intent = createAuthIntent(input, basePath, at)
  if (!intent) return false
  try { (storage ?? window.sessionStorage).setItem(KEY, JSON.stringify(intent)); return true } catch { return false }
}

export function takeAuthIntent(basePath, storage, now = Date.now()) {
  let raw
  try { const target = storage ?? window.sessionStorage; raw = target.getItem(KEY); target.removeItem(KEY) } catch { return null }
  if (!raw) return null
  try {
    const saved = JSON.parse(raw)
    if (saved.version !== 1 || !Number.isFinite(saved.at) || now - saved.at > MAX_AGE_MS || now < saved.at) return null
    return createAuthIntent(saved, basePath, saved.at)
  } catch { return null }
}
