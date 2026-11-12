export const PROCESSING_VIEWS = Object.freeze(['new', 'monitor', 'results', 'tasks'])
const VALID_TASK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseProcessingLocation(pathname, search = '') {
  const segments = String(pathname || '').split('/').filter(Boolean)
  const rootIndex = segments.findIndex(segment => segment === 'data-processing' || segment === 'shimadzu-analysis')
  const candidate = rootIndex < 0 ? '' : segments[rootIndex + 1]
  const view = PROCESSING_VIEWS.includes(candidate) ? candidate : 'new'
  const queryId = new URLSearchParams(search).get('task_id') || ''
  return { view, taskId: VALID_TASK_ID.test(queryId) ? queryId : '' }
}

export function processingViewHref(view, basePath = '', taskId = '') {
  const base = String(basePath || '').replace(/\/+$/, '')
  const suffix = PROCESSING_VIEWS.includes(view) && view !== 'new' ? `${view}/` : ''
  const query = VALID_TASK_ID.test(taskId) ? `?task_id=${encodeURIComponent(taskId)}` : ''
  return `${base}/data-processing/${suffix}${query}`
}
