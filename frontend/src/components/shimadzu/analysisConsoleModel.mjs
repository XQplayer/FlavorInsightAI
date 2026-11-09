import { getStageProgress } from '../../lib/shimadzuApi.js'

const WORKER_STAGE_COUNT = 7
const completedStatuses = new Set(['PASS', 'WARN', 'REVIEW'])

export function deriveAnalysisConsole({ job = null, fileReadiness = { ready: false }, cvReadiness = { valid: true }, hasInputFiles = false, submitting = false, engineState = 'checking' } = {}) {
  const runtime = Array.isArray(job?.stages) ? job.stages.slice(0, WORKER_STAGE_COUNT) : []
  const progress = getStageProgress({ stages: runtime })
  const completed = Math.min(progress.completed, WORKER_STAGE_COUNT)
  const failedIndex = job?.error?.details?.stage
  const hasFailedIndex = Number.isInteger(failedIndex) && failedIndex >= 0 && failedIndex < WORKER_STAGE_COUNT
  const gateBlocked = job?.error?.code === 'STAGE_GATE_FAILED' || runtime.some(stage => stage?.can_advance === false)
  const hasReview = job?.status === 'waiting_review' || runtime.some(stage => stage?.status === 'REVIEW')
  const hasWarning = runtime.some(stage => stage?.status === 'WARN')

  let state = 'pending'
  if (job?.status === 'complete') state = 'complete'
  else if (gateBlocked) state = 'blocked'
  else if (job?.status === 'failed') state = 'failed'
  else if (job?.status === 'waiting_review') state = 'review'
  else if (job?.status === 'saving') state = 'finalizing'
  else if (job?.status === 'cancelled' || job?.status === 'interrupted') state = 'stopped'
  else if (submitting || (job?.status === 'running' && runtime[0]?.status === 'running')) state = 'checking'
  else if (job?.status === 'running') state = 'running'

  let gate = 'pending'
  if (gateBlocked || (!job && cvReadiness.valid === false)) gate = 'blocked'
  else if (job?.status === 'failed') gate = 'unknown'
  else if (hasReview) gate = 'review'
  else if (hasWarning) gate = 'warning'
  else if (job?.status === 'complete') gate = 'passed'
  else if (job?.status === 'running' || submitting) gate = 'checking'

  const steps = [
    { number: '00', runtimeIndex: null, status: job || (fileReadiness.ready && cvReadiness.valid) ? 'PASS' : hasInputFiles || cvReadiness.valid === false ? 'FAIL' : 'pending' },
    ...Array.from({ length: WORKER_STAGE_COUNT }, (_, index) => ({
      number: String(index + 1).padStart(2, '0'),
      runtimeIndex: index,
      status: hasFailedIndex && failedIndex === index && job?.status === 'failed'
        ? 'FAIL'
        : runtime[index]?.status || 'pending',
    })),
  ]

  let activeStep = 0
  if (job) {
    const runningIndex = runtime.findIndex(stage => stage?.status === 'running')
    if (hasFailedIndex && job.status === 'failed') activeStep = failedIndex + 1
    else if (runningIndex >= 0) activeStep = runningIndex + 1
    else if (job.status === 'complete' || job.status === 'saving') activeStep = WORKER_STAGE_COUNT
    else if (job.status === 'waiting_review') activeStep = Math.max(1, Math.min(WORKER_STAGE_COUNT, Number(job.next_stage) || completed))
    else activeStep = Math.min(WORKER_STAGE_COUNT, Math.max(1, Number(job.next_stage || 0) + 1))
  }

  return { state, gate, progress: { completed, total: WORKER_STAGE_COUNT }, steps, activeStep, engineState }
}

export const isCompletedConsoleStep = status => completedStatuses.has(status)
