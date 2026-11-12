import { createTaskIdentity, taskIdentity, taskArchiveFileName } from '../lib/taskIdentity.mjs'

const identityWithId = value => {
  const identity = taskIdentity(value)
  return identity ? { ...identity, taskId: value?.taskId ? String(value.taskId) : null } : null
}

export function createAnalysisTask(request, { parent = null } = {}) {
  const id = crypto.randomUUID()
  const origin = request.dataset?.provenance?.taskIdentity
  const task = createTaskIdentity({ name: `${request.dataset?.name || 'Analysis'} · ${request.analysis?.method || 'analysis'}`, parent: parent || origin })
  return { id, status: 'queued', createdAt: task.taskCreatedAt, request, taskIdentity: { ...task, taskId: id } }
}

export function analysisTaskMetadata(run) {
  return { taskIdentity: identityWithId(run.taskIdentity), sourceTaskIdentity: identityWithId(run.request?.dataset?.provenance?.taskIdentity), datasetId: run.request?.dataset?.id || null, serviceRunId: run.id || null }
}

export function analysisArchiveFileName(run, kind = 'report') {
  const identity = taskIdentity(run) || taskIdentity(run.request?.dataset?.provenance)
  if (!identity) return kind === 'report' ? `analysis-report-${run.id}.zip` : `analysis-${run.id}-${kind}.zip`
  const suffix = { report: '数据分析报告', csv: '数据分析表格', reproduce: '数据分析复现包' }[kind] || '数据分析结果'
  return taskArchiveFileName(identity).replace(/_分析结果\.zip$/, `_${suffix}.zip`)
}

export function datasetExportFileName(dataset, kind) {
  const identity = taskIdentity(dataset.provenance)
  if (!identity) return kind === 'project' ? 'analysis-project.json' : `source-matrix.${kind}`
  return taskArchiveFileName(identity).replace(/_分析结果\.zip$/, kind === 'project' ? '_分析项目.json' : `_源矩阵.${kind}`)
}
