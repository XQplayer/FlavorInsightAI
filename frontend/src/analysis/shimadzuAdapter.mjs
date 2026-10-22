import JSZip from 'jszip'
import { createDataset } from './dataset.mjs'
import { inspectZip, safeArchivePath, readBoundedZipEntry } from './imports.mjs'

export const SHIMADZU_STAGE_DIRECTORIES = Object.freeze(['00_输入配置与清单','01_Hit1整理','02_化合物筛查','03_平行峰面积处理','04_跨样品合并与半定量','05_统计_CV_CAS与QC','06_按矩阵拆分'])
const sha256 = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('')
/** Both ZIP upload and in-process handoff verify the SAME immutable exported evidence. No algorithm is rerun. */
export async function importShimadzuArchive(input, options = {}) {
  if (!['before-cv', 'after-cv'].includes(options.selection)) throw new Error('EXPLICIT_STAGE_SELECTION_REQUIRED')
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  const entrySizes = new Map(inspectZip(bytes, options).map(entry => [entry.name, entry.size]))
  const zip = await JSZip.loadAsync(bytes)
  async function read(path) {
    if (!safeArchivePath(path)) throw new Error('UNSAFE_ZIP_PATH')
    const entry = zip.file(path); if (!entry) throw new Error(`MISSING_ARCHIVE_ENTRY: ${path}`)
    return readBoundedZipEntry(entry, entrySizes.get(path))
  }
  async function signedJson(path) {
    const value = await read(path); const expected = new TextDecoder().decode(await read(path.replace(/\.json$/, '.sha256'))).trim()
    if (await sha256(value) !== expected) throw new Error(`HASH_MISMATCH: ${path}`)
    return JSON.parse(new TextDecoder().decode(value))
  }
  const run = await signedJson('v2-run.json')
  if (run.schemaVersion !== 'shimadzu-browser-run-1' || run.status !== 'PASS' || !SHIMADZU_STAGE_DIRECTORIES.every(d => run.completedStages?.includes(d))) throw new Error('RUN_NOT_COMPLETE')
  const completeness = await signedJson('完整性验证/v2-completeness-verification.json')
  if (completeness.schemaVersion !== 'shimadzu-v2-completeness-1' || completeness.status !== 'PASS' || !SHIMADZU_STAGE_DIRECTORIES.every(d => completeness.completedStages?.includes(d))) throw new Error('RUN_NOT_COMPLETE')
  const stages = []; const manifests = []
  for (const [index, directory] of SHIMADZU_STAGE_DIRECTORIES.entries()) {
    const manifest = await signedJson(`${directory}/manifest.json`)
    if (manifest.schemaVersion !== 'shimadzu-browser-manifest-1' || manifest.stage !== directory || manifest.canAdvance !== true || !['PASS','WARN','REVIEW'].includes(manifest.severity) || !Array.isArray(manifest.outputHashes)) throw new Error('INVALID_STAGE_MANIFEST')
    const paths = new Set()
    for (const output of manifest.outputHashes) {
      if (!safeArchivePath(output.path) || !output.path.startsWith(`${directory}/`) || paths.has(output.path)) throw new Error('INVALID_MANIFEST_OUTPUT')
      paths.add(output.path); const value = await read(output.path)
      if (value.byteLength !== output.size) throw new Error(`SIZE_MISMATCH: ${output.path}`)
      if (await sha256(value) !== output.sha256) throw new Error(`HASH_MISMATCH: ${output.path}`)
    }
    if (!paths.has(`${directory}/data.json`)) throw new Error('UNHASHED_STAGE_DATA')
    const stage = JSON.parse(new TextDecoder().decode(await read(`${directory}/data.json`)))
    const expectedSchema = index === 6 ? 'shimadzu-v2-stage6-split-1' : `shimadzu-v2-stage${index}-1`
    if (stage.schemaVersion !== expectedSchema || stage.stage !== directory || stage.issues?.some(i => i.severity === 'FAIL')) throw new Error('INVALID_STAGE_DATA')
    stages.push(stage); manifests.push(manifest)
  }
  const pre = stages[4], post = stages[5]; const table = options.selection === 'before-cv' ? pre.table : post.triplicateAfter
  if (!Array.isArray(pre.sampleOrder) || !Array.isArray(pre.sampleConfigs) || !table?.columns || !Array.isArray(table.rows)) throw new Error('INVALID_SAMPLE_TABLE')
  if (options.selection === 'after-cv' && JSON.stringify(pre.sampleOrder) !== JSON.stringify(post.sampleOrder)) throw new Error('SAMPLE_ORDER_MISMATCH')
  const sampleNames = pre.sampleOrder
  if (new Set(sampleNames).size !== sampleNames.length || pre.sampleConfigs.length !== sampleNames.length) throw new Error('SAMPLE_CONFIGURATION_MISMATCH')
  const samples = sampleNames.map((name, i) => {
    const matches = pre.sampleConfigs.filter(s => s.sampleName === name); if (matches.length !== 1) throw new Error('SAMPLE_CONFIGURATION_MISMATCH')
    const s = matches[0]
    return { id: `sample-${i + 1}`, name, group: s.sampleGroup || '', biologicalUnitId: s.biologicalUnitId || '', subjectId: s.subjectId || '', batch: s.batch || '', include: s.includeInAnalysis !== false, sourceConfiguration: s }
  })
  const standards = new Set(pre.sampleConfigs.map(s => s.internalStandardCas))
  const features = table.rows.map((row, i) => ({ id: `feature-${i + 1}`, name: String(row.Name || row['CAS #'] || `Feature ${i + 1}`), cas: String(row['CAS #'] || ''), unit: 'μg/mL', isInternalStandard: standards.has(row['CAS #']), annotations: Object.fromEntries(Object.entries(row).filter(([k]) => !sampleNames.some(s => k === `${s} Area` || k === `${s}（μg/mL）`))) }))
  const matrix = samples.map(s => {
    const column = `${s.name}（μg/mL）`; if (!table.columns.includes(column)) throw new Error('PER_SAMPLE_CONCENTRATION_REQUIRED')
    return table.rows.map(row => {
      const v = row[column]; if (v === 'NA' || v === null || v === undefined || v === '') return null
      if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('INVALID_CONCENTRATION')
      return v
    })
  })
  const inherited = pre.inheritedLogs || {}; const statusIndex = new Map((pre.concentrationStatus || []).map(e => [`${e.sampleName}\u0000${e.cas}`, e]))
  const originalImputedMask = samples.map(s => features.map((f, j) => {
    const originalConcentration = pre.table?.rows?.[j]?.[`${s.name}（μg/mL）`]
    const originalAvailable = typeof originalConcentration === 'number' && Number.isFinite(originalConcentration)
    return /Imputed/i.test(statusIndex.get(`${s.name}\u0000${f.cas}`)?.areaStatus || '')
      || (inherited.imputedTwoOfThree || []).some(e => e.cas === f.cas && e.targetSample === s.name)
      || (originalAvailable && /Imputed/i.test(pre.sampleCalculations?.[s.name]?.internalStandardAreaStatus || ''))
  }))
  const qcFilteredMask = samples.map(s => features.map(f => options.selection === 'after-cv' && (post.cvReport || []).some(e => e.cas === f.cas && e.sampleNames?.includes(s.name))))
  const cellStates = samples.map((s, i) => features.map((f, j) => {
    if (qcFilteredMask[i][j]) return 'qc-filtered'
    if (originalImputedMask[i][j]) return 'original-imputed'
    if (matrix[i][j] === null) return 'missing'
    const analyteMeasured = ['Measured', 'Measured_Internal_Standard'].includes(statusIndex.get(`${s.name}\u0000${f.cas}`)?.areaStatus)
    const denominatorMeasured = pre.sampleCalculations?.[s.name]?.internalStandardAreaStatus === 'Measured_Internal_Standard'
    return analyteMeasured && denominatorMeasured ? 'observed' : 'unknown'
  }))
  const archiveSha256 = await sha256(bytes)
  return createDataset({ id: `shimadzu-${archiveSha256}-${options.selection}`, name: `${run.name || 'Shimadzu'} · ${options.selection}`, samples, features, matrix,
    quality: { originalImputedMask, qcFilteredMask, cellStates, unknownSourceMask: cellStates.map(row => row.map(s => s === 'unknown')), inheritedLogs: inherited, groupStatistics: post.groupStatistics || [], cvScreeningExecuted: post.cvScreeningExecuted === true, cvThreshold: post.cvThreshold ?? null, qcRows: [...(pre.qcRows || []), ...(post.qcRows || [])], issues: stages.flatMap(s => s.issues || []) },
    provenance: { source: 'shimadzu-verified-archive', archiveSha256, selection: options.selection, sourceStage: options.selection === 'before-cv' ? SHIMADZU_STAGE_DIRECTORIES[4] : SHIMADZU_STAGE_DIRECTORIES[5], run, manifests, independenceConfirmed: false, groupedIndependenceConfirmed: false, warnings: ['Technical replicates must not be assumed to be independent biological replicates.'] } })
}
export function datasetFromShimadzuResult(result, options) {
  if (!result?.archiveBytes) return Promise.reject(new Error('VERIFIABLE_ARCHIVE_REQUIRED'))
  return importShimadzuArchive(result.archiveBytes, options)
}
