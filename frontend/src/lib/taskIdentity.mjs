/** Public run identity supplements, never replaces, the UUID storage key. */
export function createTaskIdentity({ name, now = new Date(), parent = null, crypto = globalThis.crypto } = {}) {
  const date = new Date(now)
  if (!Number.isFinite(date.getTime())) throw new Error('INVALID_TASK_DATE')
  if (!crypto?.getRandomValues) throw new Error('SECURE_TASK_RANDOM_REQUIRED')
  const beijing = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const pad = n => String(n).padStart(2, '0')
  const stamp = `${beijing.getUTCFullYear()}${pad(beijing.getUTCMonth() + 1)}${pad(beijing.getUTCDate())}-${pad(beijing.getUTCHours())}${pad(beijing.getUTCMinutes())}${pad(beijing.getUTCSeconds())}`
  const suffix = [...crypto.getRandomValues(new Uint8Array(3))].map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase()
  return { taskNumber: `FI-${stamp}-${suffix}`, taskName: String(name || 'Shimadzu GC-MS analysis'), taskCreatedAt: date.toISOString(), parentTaskId: parent?.id || parent?.taskId || null, parentTaskNumber: taskIdentity(parent)?.taskNumber || null }
}

export function taskIdentity(record) {
  if (!record) return null
  const value = record.taskIdentity || record.source_names?.taskIdentity || record.parameters?.taskIdentity || record
  if (!/^FI-\d{8}-\d{6}-[A-F0-9]{6}$/.test(value.taskNumber || '')) return null
  return { taskNumber: value.taskNumber, taskName: String(value.taskName || record.name || 'Shimadzu GC-MS analysis'), taskCreatedAt: value.taskCreatedAt || null, parentTaskId: value.parentTaskId || null, parentTaskNumber: value.parentTaskNumber || null }
}

export function taskLabel(record) {
  const identity = taskIdentity(record)
  return identity ? `${identity.taskNumber} ${identity.taskName}` : [record?.id || record?.taskId, record?.name].filter(Boolean).join(' ')
}

export function taskArchiveFileName(record, status = 'complete') {
  const identity = taskIdentity(record)
  // Only filename text is sanitized; the original name remains in the evidence.
  const safe = value => {
    const chars = [...String(value)].map(c => '<>:"/\\|?*'.includes(c) || c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? '_' : c).slice(0, 80)
    let result = '', bytes = 0
    for (const char of chars) {
      bytes += new TextEncoder().encode(char).length
      if (bytes > 160) break
      result += char
    }
    return result.replace(/[. ]+$/g, '') || 'Shimadzu'
  }
  const name = safe(identity?.taskName || record?.name || '岛津气质分析')
  const prefix = identity?.taskNumber || record?.id || record?.taskId
  const suffix = identity ? ({ complete: '分析结果', failed: '失败证据与部分结果', cancelled: '取消审计与部分结果' }[status] || '分析结果') : status === 'complete' ? '步骤0-6结果' : '部分结果'
  return `${prefix ? `${safe(prefix)}_` : ''}${name}_${suffix}.zip`
}
