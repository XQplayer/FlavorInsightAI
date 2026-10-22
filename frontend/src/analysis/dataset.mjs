/** Versioned, browser-local samples × features contract. CAS is annotation, never identity. */
export const DATASET_SCHEMA_VERSION = 1
export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(deepFreeze); Object.freeze(value) }
  return value
}
export function createDataset(input) {
  if (!input || (input.schemaVersion !== undefined && input.schemaVersion !== 1)) throw new Error('SCHEMA_VERSION')
  const data = structuredClone(input)
  data.schemaVersion = 1
  data.id ||= crypto.randomUUID(); data.name ||= 'Untitled dataset'
  if (typeof data.id !== 'string' || !data.id.trim() || typeof data.name !== 'string') throw new Error('INVALID_DATASET_ID_OR_NAME')
  if (!Array.isArray(data.samples) || !Array.isArray(data.features) || !data.samples.length || !data.features.length) throw new Error('EMPTY_DATASET')
  for (const [key, label] of [['samples', 'SAMPLE'], ['features', 'FEATURE']]) {
    const ids = new Set()
    for (const item of data[key]) {
      if (!item || typeof item.id !== 'string' || !item.id.trim()) throw new Error(`INVALID_${label}_ID`)
      if (ids.has(item.id)) throw new Error(`DUPLICATE_${label}_ID`)
      ids.add(item.id)
    }
  }
  data.samples = data.samples.map(s => ({ ...s, name: String(s.name ?? s.id), group: String(s.group ?? ''), biologicalUnitId: String(s.biologicalUnitId ?? ''), subjectId: String(s.subjectId ?? ''), batch: String(s.batch ?? ''), include: s.include !== false }))
  data.features = data.features.map(f => ({ ...f, name: String(f.name ?? f.id), cas: String(f.cas ?? ''), unit: String(f.unit ?? ''), isInternalStandard: f.isInternalStandard === true }))
  if (!Array.isArray(data.matrix) || data.matrix.length !== data.samples.length || data.matrix.some(row => !Array.isArray(row) || row.length !== data.features.length)) throw new Error('MATRIX_DIMENSIONS')
  for (const row of data.matrix) for (const value of row) if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) throw new Error('MATRIX_VALUE')
  data.quality ??= {}; data.provenance ??= {}
  data.provenance.independenceConfirmed ??= false; data.provenance.groupedIndependenceConfirmed ??= false
  data.quality.cellStates ??= data.matrix.map(row => row.map(v => v === null ? 'missing' : 'unknown'))
  for (const key of ['cellStates', 'originalImputedMask', 'qcFilteredMask', 'unknownSourceMask']) {
    const mask = data.quality[key]; if (mask === undefined) continue
    if (!Array.isArray(mask) || mask.length !== data.samples.length || mask.some(row => !Array.isArray(row) || row.length !== data.features.length)) throw new Error('QUALITY_DIMENSIONS')
    for (const row of mask) for (const value of row) if (key === 'cellStates' ? !['observed','original-imputed','qc-filtered','missing','unknown'].includes(value) : typeof value !== 'boolean') throw new Error('QUALITY_VALUE')
  }
  return deepFreeze(data)
}
export function deriveDataset(dataset, patch, operation = 'edit') {
  return createDataset({ ...structuredClone(dataset), ...structuredClone(patch), id: crypto.randomUUID(), provenance: { ...dataset.provenance, ...patch.provenance, parentId: dataset.id, operation, createdAt: new Date().toISOString() } })
}
