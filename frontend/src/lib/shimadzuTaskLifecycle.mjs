import { createTaskIdentity, taskIdentity } from './taskIdentity.mjs'

/** Explicit reruns carry only inputs/settings, never terminal state or artifacts. */
export function createTaskRun(input = {}, { parent = null, now = new Date(), crypto = globalThis.crypto } = {}) {
  const source = parent || input
  const keys = ['scope', 'userId', 'name', 'mode', 'rawBytes', 'sampleBytes', 'rawName', 'sampleName', 'rawSize', 'sampleSize', 'enableCvScreening', 'cvThreshold', 'enableClassification', 'enableWaterDetectionThreshold', 'enableEstimatedReferenceOav']
  const base = Object.fromEntries(keys.filter(key => key in source).map(key => [key, source[key]]))
  const identity = createTaskIdentity({ name: taskIdentity(parent)?.taskName || source.name, now, parent, crypto })
  return { ...base, ...identity, id: crypto.randomUUID(), name: identity.taskName, startedAt: identity.taskCreatedAt, status: 'running', nextStage: 0, stageSummary: [], error: null }
}

export async function persistTaskRun(task, { store, cloud, parent }) {
  let created = false
  try {
    if (parent) await store.saveHistory(parent)
    if (cloud?.configured) {
      await cloud.createJob({ id: task.id, userId: task.userId, name: task.name, mode: task.mode, sourceNames: {
        taskIdentity: { ...taskIdentity(task), taskId: task.id },
        raw: { name: task.rawName, size: task.rawSize }, sample_info: { name: task.sampleName, size: task.sampleSize },
        cv: { enableCvScreening: task.enableCvScreening, threshold: task.cvThreshold },
        classification: { enabled: task.enableClassification, source: 'PubChem SMARTS' },
        waterDetectionThreshold: { enabled: task.enableWaterDetectionThreshold, source: 'local evidence database' },
      } })
      created = true
    }
    await store.save(task)
    return task
  } catch (error) {
    if (created) await cloud.updateJob(task.id, { status: 'failed', stage_summary: [{ type: 'error', code: 'TASK_PREPARATION_FAILED', message: error.message, at: new Date().toISOString() }] }).catch(() => {})
    throw error
  }
}
