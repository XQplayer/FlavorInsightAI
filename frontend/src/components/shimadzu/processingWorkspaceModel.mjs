import { taskLabel } from '../../lib/taskIdentity.mjs'

const COMPLETE = new Set(['PASS', 'WARN', 'REVIEW'])
const STAGES = Object.freeze([
  { number: '00', label: '运行前预检', workerIndex: 0 },
  { number: '01', label: 'Hit #1', workerIndex: 1 },
  { number: '02', label: '筛选', workerIndex: 2 },
  { number: '03', label: '平行处理', workerIndex: 3 },
  { number: '04', label: '半定量', workerIndex: 4 },
  { number: '05', label: '统计与 QC', workerIndex: 5 },
  { number: '06', label: '矩阵拆分', workerIndex: 6 },
  { number: '07', label: '结果包', workerIndex: null },
])

export function resultAvailability(record, now = new Date()) {
  if (!record) return { downloadable: false, source: 'none' }
  if (record.downloadUrl?.startsWith('blob:')) return { downloadable: true, source: 'browser' }
  if (record.result_path && new Date(record.result_expires_at).getTime() > now.getTime()) return { downloadable: true, source: 'cloud' }
  if (record.hasLocalArchive && new Date(record.local_result_expires_at || record.result_expires_at).getTime() > now.getTime()) return { downloadable: true, source: 'history' }
  return { downloadable: false, source: 'none' }
}

export function deriveProcessingStages(job, preflight = {}) {
  const runtime = Array.isArray(job?.stages) ? job.stages : []
  const stageZero = runtime[0]?.status || (preflight.failed ? 'FAIL' : 'pending')
  const archived = job?.status === 'complete' && Boolean(job.downloadUrl || job.result_path || job.archiveSha256 || job.result_sha256)
  const packaging = archived ? 'PASS' : job?.status === 'saving' ? 'running' : 'pending'
  const failedIndex = job?.error?.details?.stage
  const steps = STAGES.map((stage, index) => {
    let status = index === 0 ? stageZero : index === 7 ? packaging : runtime[stage.workerIndex]?.status || 'pending'
    if (job?.status === 'failed' && failedIndex === stage.workerIndex && stage.workerIndex !== null) status = 'FAIL'
    return { ...stage, status }
  })
  const completed = steps.slice(1).filter(step => COMPLETE.has(step.status)).length
  const active = steps.findIndex((step, index) => index > 0 && step.status === 'running')
  const failed = steps.findIndex(step => step.status === 'FAIL')
  return { steps, completed, total: 7, active: !job ? 0 : failed >= 0 ? failed : active >= 0 ? active : job.status === 'complete' ? 7 : Math.min(7, completed + 1) }
}

export function filterTaskRecords(records = [], { query = '', status = 'all', newestFirst = true } = {}) {
  const needle = String(query).trim().toLocaleLowerCase()
  return records.filter(item => (!needle || taskLabel(item).toLocaleLowerCase().includes(needle) || String(item.id || '').toLocaleLowerCase().includes(needle)) && (status === 'all' || item.status === status))
    .sort((a, b) => (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) * (newestFirst ? 1 : -1))
}
