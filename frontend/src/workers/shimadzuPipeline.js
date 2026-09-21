import JSZip from 'jszip'

import { extractHit1, HIT1_OUTPUT_COLUMNS } from '../shimadzu-core/parse-shimadzu.mjs'
import { groupConfiguredSamples, stageStatus, summarizeHit1Sample } from '../shimadzu-core/v2-hit1-stage.mjs'
import { normalizeNameForMatching } from '../shimadzu-core/normalize.mjs'
import { validateV2Samples, V2_SAMPLE_HEADERS } from '../shimadzu-core/v2-sample-config.mjs'
import { screenStage2Sample } from '../shimadzu-core/v2-screening-stage.mjs'
import { processV2ReplicateGroup } from '../shimadzu-core/v2-replicate-area-stage.mjs'
import { processV2SemiquantBatch } from '../shimadzu-core/v2-semiquant-stage.mjs'
import { processV2Statistics } from '../shimadzu-core/v2-statistics-stage.mjs'
import { splitV2Matrices } from '../shimadzu-core/v2-matrix-split-stage.mjs'
import { shimadzuCompoundEnrichmentService } from '../lib/shimadzuCompoundEnrichment.js'
import { shimadzuCasRecoveryService } from '../lib/shimadzuCasRecovery.js'
import { shimadzuWaterDetectionThresholdService, WATER_DETECTION_THRESHOLD_COLUMNS } from '../lib/shimadzuWaterDetectionThreshold.js'
import { V2_COMPOUND_IDENTITY_COLUMNS } from '../shimadzu-core/v2-identity-columns.mjs'
import { readSampleConfiguration, readWorkbookSheets, writeTableWorkbook } from './shimadzuWorkbook.js'

export const V2_STAGE_DIRECTORIES = Object.freeze([
  '00_输入配置与清单', '01_Hit1整理', '02_化合物筛查', '03_平行峰面积处理',
  '04_跨样品合并与半定量', '05_统计_CV_CAS与QC', '06_按矩阵拆分',
])

const textBytes = value => new TextEncoder().encode(value)
const clone = value => structuredClone(value)
const sum = (items, key) => items.reduce((total, item) => total + Number(item?.[key] ?? 0), 0)
const issueStatus = issues => stageStatus(issues || [])
const fail = (code, details = {}) => Object.assign(new Error(code), { code, details, ...details })
const matchingName = value => normalizeNameForMatching(value).normalized

async function sha256(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const digest = await crypto.subtle.digest('SHA-256', input)
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
}

function assertNotCancelled(signal) {
  if (signal?.aborted) throw fail('ANALYSIS_CANCELLED')
}

function table(name, source) {
  return { name, columns: [...(source?.columns ?? [])], rows: clone(source?.rows ?? []) }
}

function recordTable(name, records, columns = HIT1_OUTPUT_COLUMNS) {
  return { name, columns: [...columns], rows: clone(records ?? []) }
}

async function enrichStage4Data(data, {
  enableClassification,
  enableWaterDetectionThreshold,
  enrichCasValues,
  resolveWaterDetectionThreshold,
}) {
  const casValues = [...new Set(data.table.rows.map(row => String(row['CAS #'] || '').trim()).filter(Boolean))]
  const identityByCas = enableClassification
    ? await enrichCasValues(casValues)
    : new Map()
  const thresholdByCas = enableWaterDetectionThreshold
    ? new Map(await Promise.all(casValues.map(async cas => [cas, await resolveWaterDetectionThreshold(cas)])))
    : new Map()
  const extraColumns = [
    ...(enableClassification ? V2_COMPOUND_IDENTITY_COLUMNS : []),
    ...(enableWaterDetectionThreshold ? WATER_DETECTION_THRESHOLD_COLUMNS : []),
  ]
  const emptyIdentity = Object.fromEntries(V2_COMPOUND_IDENTITY_COLUMNS.map(column => [column, 'NA']))
  const emptyThreshold = Object.fromEntries(WATER_DETECTION_THRESHOLD_COLUMNS.map(column => [column, 'NA']))
  return {
    ...data,
    table: {
      columns: ['CAS #', ...extraColumns, ...data.table.columns.filter(column => column !== 'CAS #')],
      rows: data.table.rows.map(row => {
        const cas = String(row['CAS #'] || '').trim()
        return {
          ...row,
          ...(enableClassification ? identityByCas.get(cas) || emptyIdentity : {}),
          ...(enableWaterDetectionThreshold ? thresholdByCas.get(cas) || emptyThreshold : {}),
        }
      }),
    },
  }
}

async function addWorkbook(zip, path, sheets, outputs) {
  const bytes = writeTableWorkbook(sheets)
  zip.file(path, bytes)
  outputs.push({ path, sha256: await sha256(bytes), size: bytes.byteLength })
}

async function addStage(zip, index, data, workbookSpecs, parameters = {}) {
  const directory = V2_STAGE_DIRECTORIES[index]
  const outputs = []
  for (const spec of workbookSpecs) await addWorkbook(zip, `${directory}/${spec.file}`, spec.sheets, outputs)
  const dataPath = `${directory}/data.json`
  const dataBytes = textBytes(`${JSON.stringify(data, null, 2)}\n`)
  zip.file(dataPath, dataBytes)
  outputs.push({ path: dataPath, sha256: await sha256(dataBytes), size: dataBytes.byteLength })
  const manifest = {
    schemaVersion: 'shimadzu-browser-manifest-1',
    stage: directory,
    createdAt: data.createdAt,
    severity: issueStatus(data.issues),
    canAdvance: !(data.issues || []).some(issue => issue.severity === 'FAIL'),
    counts: data.counts || {},
    parameters: clone(parameters),
    outputHashes: outputs,
  }
  const manifestBytes = textBytes(`${JSON.stringify(manifest, null, 2)}\n`)
  const manifestPath = `${directory}/manifest.json`
  zip.file(manifestPath, manifestBytes)
  zip.file(`${directory}/manifest.sha256`, `${await sha256(manifestBytes)}\n`)
  return manifest
}

const archiveFileName = name => {
  const invalidName = new Set('<>:"/\\|?*')
  const safeName = [...String(name || '岛津气质分析')]
    .map(character => invalidName.has(character) || character.charCodeAt(0) < 32 ? '_' : character)
    .join('').slice(0, 80) || '岛津气质分析'
  return `${safeName}_部分结果.zip`
}

export async function createPartialFailureArchive({ zip, name, stage, issues = [], completedStages = [], parameters = {} }) {
  const normalizedIssues = clone(Array.isArray(issues) ? issues : [issues])
  const completed = clone(completedStages)
  const generatedAt = new Date().toISOString()
  const failure = {
    schemaVersion: 'shimadzu-browser-failure-1', status: 'FAILED', failedStage: stage,
    failedStageName: V2_STAGE_DIRECTORIES[stage] || `stage-${stage}`, issues: normalizedIssues,
    completedStages: completed, generatedAt,
  }
  const state = {
    schemaVersion: 'shimadzu-browser-partial-run-1', status: 'PARTIAL_FAILED', name,
    failedStage: stage, completedStages: completed,
    archiveContents: '已完成步骤及失败步骤的证据、错误明细与处理状态', generatedAt,
  }
  const failureBytes = textBytes(`${JSON.stringify(failure, null, 2)}\n`)
  const stateBytes = textBytes(`${JSON.stringify(state, null, 2)}\n`)
  zip.file('失败任务/错误明细.json', failureBytes)
  zip.file('失败任务/部分运行状态.json', stateBytes)
  zip.file('失败任务/错误明细.sha256', `${await sha256(failureBytes)}\n`)
  zip.file('失败任务/部分运行状态.sha256', `${await sha256(stateBytes)}\n`)
  const runBytes = textBytes(`${JSON.stringify({
    schemaVersion: 'shimadzu-browser-run-1', completedAt: generatedAt, status: 'PARTIAL_FAILED',
    oavExecuted: false, name, failedStage: stage, completedStages: completed, parameters: clone(parameters),
  }, null, 2)}\n`)
  zip.file('v2-run.json', runBytes)
  zip.file('v2-run.sha256', `${await sha256(runBytes)}\n`)
  const archiveBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  const archiveSha256 = await sha256(archiveBytes)
  const details = { stage, issues: normalizedIssues, completedStages: completed, archiveStatus: 'PARTIAL_FAILED' }
  return Object.assign(new Error(`第${Number(stage) + 1}步未通过质量门禁`), {
    code: 'STAGE_GATE_FAILED', details, ...details,
    archiveBytes, archiveSha256, archiveSize: archiveBytes.byteLength,
    fileName: archiveFileName(name),
  })
}

export async function createPartialCancellationArchive({ zip, name, stage, completedStages = [], parameters = {} }) {
  const completed = clone(completedStages)
  const normalizedParameters = clone(parameters)
  const generatedAt = new Date().toISOString()
  const state = {
    schemaVersion: 'shimadzu-browser-cancellation-1', status: 'CANCELLED', errorCode: 'ANALYSIS_CANCELLED',
    name, cancelledBeforeStage: stage, completedStages: completed, parameters: normalizedParameters,
    archiveContents: 'Completed stage outputs, manifests, cancellation audit, and run parameters', generatedAt,
  }
  const stateBytes = textBytes(`${JSON.stringify(state, null, 2)}\n`)
  zip.file('取消任务/取消状态.json', stateBytes)
  zip.file('取消任务/取消状态.sha256', `${await sha256(stateBytes)}\n`)
  const manifest = {
    schemaVersion: 'shimadzu-browser-cancel-manifest-1', status: 'CANCELLED', errorCode: 'ANALYSIS_CANCELLED',
    generatedAt, completedStages: completed, parameters: normalizedParameters,
  }
  const manifestBytes = textBytes(`${JSON.stringify(manifest, null, 2)}\n`)
  zip.file('取消任务/manifest.json', manifestBytes)
  zip.file('取消任务/manifest.sha256', `${await sha256(manifestBytes)}\n`)
  const run = {
    schemaVersion: 'shimadzu-browser-run-1', completedAt: generatedAt, status: 'CANCELLED',
    errorCode: 'ANALYSIS_CANCELLED', oavExecuted: false, name, cancelledBeforeStage: stage,
    completedStages: completed, parameters: normalizedParameters,
  }
  const runBytes = textBytes(`${JSON.stringify(run, null, 2)}\n`)
  zip.file('v2-run.json', runBytes)
  zip.file('v2-run.sha256', `${await sha256(runBytes)}\n`)
  const archiveBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  const archiveSha256 = await sha256(archiveBytes)
  const details = { stage, completedStages: completed, archiveStatus: 'CANCELLED', parameters: normalizedParameters }
  return Object.assign(new Error('ANALYSIS_CANCELLED'), {
    code: 'ANALYSIS_CANCELLED', details, archiveBytes, archiveSha256,
    archiveSize: archiveBytes.byteLength, fileName: archiveFileName(name),
  })
}

function stage0(rawBytes, sampleBytes, rawName, sampleName) {
  const rawSheets = readWorkbookSheets(rawBytes)
  const parsed = readSampleConfiguration(sampleBytes)
  const samples = validateV2Samples(parsed.samples).filter(sample => sample.includeInAnalysis !== false)
  return {
    schemaVersion: 'shimadzu-v2-stage0-1', stage: V2_STAGE_DIRECTORIES[0], createdAt: new Date().toISOString(),
    samples, rawSheetNames: rawSheets.map(sheet => sheet.name), issues: [],
    source: { rawName, sampleName },
    counts: { samples: samples.length, sheets: rawSheets.length, issues: 0 },
    rawSheets,
  }
}

async function stage1(stage0Data, rawName, recoverCasRecord) {
  const sheetMap = new Map()
  for (const sheet of stage0Data.rawSheets) {
    const key = matchingName(sheet.name)
    if (sheetMap.has(key)) throw fail('DUPLICATE_NORMALIZED_SOURCE_SHEET', { sheetName: sheet.name })
    sheetMap.set(key, sheet)
  }
  const samples = {}
  const issues = []
  const identityAudits = []
  const identityReviews = []
  const configured = stage0Data.samples
  for (const sample of configured) {
    const sheet = sheetMap.get(matchingName(sample.sampleName))
    if (!sheet) throw fail('CONFIGURED_SOURCE_SHEET_MISSING', { sampleName: sample.sampleName })
    const extracted = extractHit1(sheet.rows)
    const localIssues = extracted.issues.map(issue => ({ ...clone(issue), sampleName: sample.sampleName, sampleGroup: sample.sampleGroup, sourceSheet: sheet.name }))
    const lineage = extracted.lineage.map(entry => ({ sourceWorkbook: rawName, sourceSheet: sheet.name, ...clone(entry) }))
    const auditBySourceRow = new Map((sheet.casRecoveryEvents || []).map(event => [event.sourceRow, event]))
    const records = []
    for (const [index, record] of extracted.records.entries()) {
      const recovery = await recoverCasRecord(record)
      records.push(clone(recovery.record))
      const sourceRow = extracted.lineage[index]?.searchSourceRow
      const dateAudit = auditBySourceRow.get(sourceRow)
      if (dateAudit) identityAudits.push({ ...clone(dateAudit), sampleName: sample.sampleName, sourceSheet: sheet.name })
      if (recovery.audit?.['CAS 来源'] !== '岛津原始值') identityAudits.push({ ...clone(recovery.audit), sampleName: sample.sampleName, sourceSheet: sheet.name, sourceRow })
      if (recovery.review) identityReviews.push({ ...clone(recovery.review), sampleName: sample.sampleName, sourceSheet: sheet.name, sourceRow, Name: record.Name, 'Mol.Form': record['Mol.Form'], 'Mol.Weight': record['Mol.Weight'] })
    }
    samples[sample.sampleName] = {
      sampleName: sample.sampleName, sampleGroup: sample.sampleGroup, matrixName: sample.matrixName,
      sourceWorkbook: rawName, sourceSheet: sheet.name, columns: [...HIT1_OUTPUT_COLUMNS],
      records, lineage, issues: localIssues,
      summary: summarizeHit1Sample(sample, extracted),
    }
    issues.push(...localIssues)
  }
  const groups = groupConfiguredSamples(configured).map(group => ({ sampleGroup: group.sampleGroup, sampleNames: group.samples.map(sample => sample.sampleName) }))
  for (const group of groups) if (group.sampleNames.length !== 3) issues.push({ severity: 'FAIL', code: 'FAIL_REPLICATE_GROUP_SIZE', sampleGroup: group.sampleGroup, count: group.sampleNames.length })
  const summaries = configured.map(sample => samples[sample.sampleName].summary)
  return {
    schemaVersion: 'shimadzu-v2-stage1-1', stage: V2_STAGE_DIRECTORIES[1], createdAt: new Date().toISOString(),
    source: { name: rawName, sheetOrder: stage0Data.rawSheetNames }, sampleOrder: configured.map(sample => sample.sampleName),
    groups, samples, issues, identityAudits, identityReviews,
    counts: {
      samples: summaries.length, groups: groups.length, input: sum(summaries, 'input'), retained: sum(summaries, 'retained'),
      removed: sum(summaries, 'removed'), merged: 0, imputed: 0, warn: sum(summaries, 'warn'),
      review: sum(summaries, 'review'), fail: sum(summaries, 'fail'),
    },
  }
}

function stage2(stage1Data) {
  const samples = {}
  const removals = []
  const duplicateDecisions = []
  const reviews = []
  const issues = []
  for (const sampleName of stage1Data.sampleOrder) {
    const source = stage1Data.samples[sampleName]
    const screened = screenStage2Sample({ sampleName, sampleGroup: source.sampleGroup, records: source.records, lineage: source.lineage })
    samples[sampleName] = screened
    removals.push(...screened.removals)
    duplicateDecisions.push(...screened.duplicateDecisions)
    reviews.push(...screened.reviews)
    issues.push(...screened.issues)
  }
  const summaries = stage1Data.sampleOrder.map(sampleName => samples[sampleName].summary)
  const counts = {
    samples: summaries.length, groups: stage1Data.groups.length, input: sum(summaries, 'input'),
    elementRemoved: sum(summaries, 'elementRemoved'), invalidRemoved: sum(summaries, 'invalidRemoved'),
    screeningRemoved: sum(summaries, 'screeningRemoved'), duplicateGroups: sum(summaries, 'duplicateGroups'),
    duplicateReduction: sum(summaries, 'duplicateReduction'), mergedAbsorbed: sum(summaries, 'mergedAbsorbed'),
    duplicateDiscarded: sum(summaries, 'duplicateDiscarded'), retained: sum(summaries, 'retained'),
    warn: sum(summaries, 'warn'), review: sum(summaries, 'review'), fail: sum(summaries, 'fail'),
  }
  if (counts.input !== counts.screeningRemoved + counts.duplicateReduction + counts.retained) throw fail('STAGE2_GLOBAL_COUNT_RECONCILIATION_FAILED', { counts })
  return {
    schemaVersion: 'shimadzu-v2-stage2-1', stage: V2_STAGE_DIRECTORIES[2], createdAt: new Date().toISOString(),
    sampleOrder: [...stage1Data.sampleOrder], groups: clone(stage1Data.groups), samples,
    removals, duplicateDecisions, reviews, issues, counts,
  }
}

function stage3(stage2Data, sampleConfigs) {
  const configBySample = Object.fromEntries(sampleConfigs.map(config => [config.sampleName, config]))
  const groups = {}
  for (const group of stage2Data.groups) groups[group.sampleGroup] = processV2ReplicateGroup({ group, sampleResults: stage2Data.samples, sampleConfigs: configBySample })
  const groupValues = Object.values(groups)
  const logs = {
    internalStandard: groupValues.flatMap(group => group.logs.internalStandard),
    imputedTwoOfThree: groupValues.flatMap(group => group.logs.imputedTwoOfThree),
    removedOneOfThree: groupValues.flatMap(group => group.logs.removedOneOfThree),
    metadataSources: groupValues.flatMap(group => group.logs.metadataSources),
  }
  const issues = logs.internalStandard.filter(entry => entry.action === 'Internal_Standard_Missing_Insufficient_Donors')
    .map(entry => ({ severity: 'WARN', code: entry.action, ...entry }))
  const inputRows = groupValues.reduce((total, group) => total + group.summary.inputRows, 0)
  const casRows = groupValues.reduce((total, group) => total + group.summary.casRows, 0)
  return {
    schemaVersion: 'shimadzu-v2-stage3-1', stage: V2_STAGE_DIRECTORIES[3], createdAt: new Date().toISOString(),
    sampleOrder: [...stage2Data.sampleOrder], groupOrder: stage2Data.groups.map(group => group.sampleGroup), groups,
    summaries: groupValues.map(group => group.summary), logs, issues,
    counts: {
      groups: groupValues.length, samples: stage2Data.sampleOrder.length, inputRows, casRows,
      internalStandardActions: logs.internalStandard.length,
      internalStandardSubstituted: logs.internalStandard.filter(entry => entry.action === 'Substituted_Internal_Standard_Area').length,
      internalStandardImputed: logs.internalStandard.filter(entry => entry.action === 'Imputed_Internal_Standard_Area').length,
      internalStandardInsufficient: issues.length,
      imputedTwoOfThree: logs.imputedTwoOfThree.length, removedOneOfThree: logs.removedOneOfThree.length,
    },
  }
}

function stage4(stage3Data, sampleConfigs) {
  const processed = processV2SemiquantBatch({ stage3Data, sampleConfigs })
  const calculated = processed.concentrationStatus.filter(entry => typeof entry.concentration === 'number' && Number.isFinite(entry.concentration)).length
  const counts = {
    samples: processed.sampleOrder.length, groups: processed.groupOrder.length,
    inputGroupCasRows: processed.groupOrder.reduce((total, groupName) => total + stage3Data.groups[groupName].groupTable.rows.length, 0),
    casRows: processed.table.rows.length, concentrationCells: processed.concentrationStatus.length,
    calculatedConcentrations: calculated, naConcentrations: processed.concentrationStatus.length - calculated,
    metadataConflicts: processed.metadataConflicts.length, semiquantExceptions: processed.semiquantExceptions.length,
    internalStandardImputed: stage3Data.logs.internalStandard.filter(entry => entry.action === 'Imputed_Internal_Standard_Area').length,
    imputedTwoOfThree: stage3Data.logs.imputedTwoOfThree.length, removedOneOfThree: stage3Data.logs.removedOneOfThree.length,
  }
  const issues = processed.semiquantExceptions.flatMap(entry => entry.issues.map(issue => ({ ...issue, cas: entry.cas, sampleName: entry.sampleName })))
  return {
    schemaVersion: 'shimadzu-v2-stage4-1', stage: V2_STAGE_DIRECTORIES[4], createdAt: new Date().toISOString(),
    ...processed, groups: stage3Data.groups, sampleConfigs, inheritedLogs: stage3Data.logs,
    qcRows: [['OAV', 'PASS', '未执行'], ['响应因子', 'PASS', '1']], issues, counts,
  }
}

function stage5(stage4Data, { enableCvScreening = true, cvThreshold = 30 } = {}) {
  const processed = processV2Statistics({ stage4Data, cvThreshold, enableCvScreening })
  return {
    schemaVersion: 'shimadzu-v2-stage5-1', stage: V2_STAGE_DIRECTORIES[5], createdAt: new Date().toISOString(),
    ...processed, sampleConfigs: stage4Data.sampleConfigs,
    qcRows: [['CV筛查', 'PASS', enableCvScreening ? '已执行' : '未执行'], ['CV阈值', 'PASS', cvThreshold], ['样本标准差', 'PASS', 'STDEV.S'], ['OAV', 'PASS', '未执行']], issues: [],
  }
}

function stage6(stage5Data) {
  const split = splitV2Matrices({ stage5Data })
  return {
    schemaVersion: 'shimadzu-v2-stage6-1', stage: V2_STAGE_DIRECTORIES[6], createdAt: new Date().toISOString(),
    ...split, issues: [],
  }
}

function workbookSpecs(index, data) {
  if (index === 0) return [
    { file: '00_样品与内标配置.xlsx', sheets: [{ name: '样品与内标信息', columns: V2_SAMPLE_HEADERS, rows: data.samples.map(sample => Object.fromEntries(V2_SAMPLE_HEADERS.map((header, i) => [header, [sample.sampleName, sample.sampleGroup, sample.matrixName, sample.sampleType, sample.sampleForm, sample.liquidAmountMl, sample.solidAmountG, sample.internalStandardCas, sample.internalStandardName, sample.stockUgMl, sample.spikeUl, sample.systemMl, sample.volumeBasis, sample.headspaceSystem, sample.includeSpikeVolume, sample.userFinalUgMl, sample.includeInAnalysis, sample.notes][i]]))) }] },
    { file: '00_输入清单.xlsx', sheets: [{ name: '输入清单', columns: ['项目', '数量'], rows: [{ 项目: '样品', 数量: data.counts.samples }, { 项目: '原始工作表', 数量: data.counts.sheets }] }] },
    { file: '00_输入配置报告.xlsx', sheets: [{ name: '报告', columns: ['检查项', '状态', '说明'], rows: [{ 检查项: 'OAV', 状态: 'PASS', 说明: '未执行' }, { 检查项: '样品配置', 状态: 'PASS', 说明: `${data.counts.samples}个样品` }] }] },
  ]
  if (index === 1 || index === 2) {
    const suffix = index === 1 ? 'Hit1整理' : '化合物筛查'
    const specs = data.groups.map(group => ({
      file: `结果清单/${group.sampleGroup}_${suffix}.xlsx`,
      sheets: [
        ...group.sampleNames.map(sampleName => recordTable(sampleName, data.samples[sampleName].records)),
        { name: '组汇总', columns: ['样品名称', '输入数', '保留数', '状态'], rows: group.sampleNames.map(sampleName => ({ 样品名称: sampleName, 输入数: data.samples[sampleName].summary.input, 保留数: data.samples[sampleName].summary.retained, 状态: data.samples[sampleName].summary.status })) },
      ],
    }))
    specs.push({ file: `0${index}_${suffix}报告.xlsx`, sheets: [{ name: '报告', columns: ['代码', '级别', '样品'], rows: data.issues.map(issue => ({ 代码: issue.code, 级别: issue.severity, 样品: issue.sampleName ?? 'NA' })) }] })
    if (index === 1) specs.push({
      file: '01_CAS恢复与审核.xlsx',
      sheets: [
        { name: '恢复审计', columns: ['样品名称', '源工作表', '源行号', 'CAS 原始值', 'CAS 来源', 'PubChem CID', 'CAS 补全状态'], rows: data.identityAudits },
        { name: '待人工确认', columns: ['样品名称', '源工作表', '源行号', 'Name', 'Mol.Form', 'Mol.Weight', 'CAS 原始值', 'CAS 来源', 'PubChem CID', 'CAS 补全状态'], rows: data.identityReviews },
      ],
    })
    return specs
  }
  if (index === 3) {
    const specs = data.groupOrder.map(groupName => {
      const group = data.groups[groupName]
      return { file: `结果清单/${groupName}_平行峰面积处理.xlsx`, sheets: [table('组峰面积', group.groupTable), ...group.sampleNames.map(sampleName => recordTable(sampleName, group.samples[sampleName].records, group.samples[sampleName].columns))] }
    })
    specs.push({ file: '03_平行峰面积处理报告.xlsx', sheets: [{ name: '补建与剔除', columns: ['类型', '样品组', 'CAS', '样品'], rows: [...data.logs.imputedTwoOfThree.map(entry => ({ 类型: 'Imputed_Two_of_Three', 样品组: entry.sampleGroup, CAS: entry.cas, 样品: entry.targetSample })), ...data.logs.removedOneOfThree.map(entry => ({ 类型: 'Removed_One_of_Three', 样品组: entry.sampleGroup, CAS: entry.cas, 样品: entry.detectedSample }))] }] })
    return specs
  }
  if (index === 4) return [
    { file: '04_全样品_峰面积与浓度.xlsx', sheets: [table('峰面积与浓度', data.table)] },
    { file: '04_半定量计算报告.xlsx', sheets: [{ name: '计算说明', columns: ['项目', '内容'], rows: [{ 项目: '响应因子', 内容: 1 }, { 项目: 'OAV', 内容: '未执行' }, { 项目: '样品数', 内容: data.counts.samples }] }, { name: '浓度状态', columns: ['样品', 'CAS', '状态', '浓度'], rows: data.concentrationStatus.map(entry => ({ 样品: entry.sampleName, CAS: entry.cas, 状态: entry.status, 浓度: entry.concentration })) }] },
  ]
  if (index === 5) {
    const cvLabel = data.cvScreeningExecuted ? `CV${data.cvThreshold}筛选后` : 'CV筛查未执行'
    return [
    { file: '05_01_三个平行浓度.xlsx', sheets: [table('三个平行浓度', data.triplicateBefore)] },
    { file: '05_02_Mean浓度与SD.xlsx', sheets: [table('Mean浓度与SD', data.meanSdBefore)] },
    { file: `05_03_${cvLabel}三个平行浓度.xlsx`, sheets: [table(cvLabel, data.triplicateAfter)] },
    { file: `05_04_${cvLabel}Mean浓度与SD.xlsx`, sheets: [table(`${cvLabel}Mean与SD`, data.meanSdAfter)] },
    { file: '05_05_CV筛选报告.xlsx', sheets: [{ name: 'CV筛选报告', columns: ['CAS', '样品组', 'CV', '状态'], rows: data.groupStatistics.map(entry => ({ CAS: entry.cas, 样品组: entry.sampleGroup, CV: entry.cv, 状态: entry.status })) }] },
    { file: '05_06_CAS清单.xlsx', sheets: [table('全部筛查后CAS', data.allScreenedCas), table('最终分析CAS', data.finalAnalysisCas)] },
    { file: '05_07_QC报告.xlsx', sheets: [{ name: 'QC', columns: ['检查项', '状态', '结果'], rows: data.qcRows.map(row => ({ 检查项: row[0], 状态: row[1], 结果: row[2] })) }] },
    ]
  }
  return data.matrices.flatMap(matrix => {
    const prefix = matrix.matrixName
    const cvLabel = data.cvScreeningExecuted ? 'CV筛选后' : 'CV筛查未执行'
    return [
      { file: `${prefix}/${prefix}_CV筛选前_三个平行浓度.xlsx`, sheets: [table('浓度', matrix.beforeTriplicate)] },
      { file: `${prefix}/${prefix}_CV筛选前_Mean浓度.xlsx`, sheets: [table('浓度', matrix.beforeMean)] },
      { file: `${prefix}/${prefix}_${cvLabel}_三个平行浓度.xlsx`, sheets: [table('浓度', matrix.afterTriplicate)] },
      { file: `${prefix}/${prefix}_${cvLabel}_Mean浓度.xlsx`, sheets: [table('浓度', matrix.afterMean)] },
    ]
  })
}

export async function runShimadzuBrowserPipeline({
  rawBytes, sampleBytes, rawName = 'raw.xlsx', sampleName = 'samples.xlsx', name = '岛津气质分析',
  onEvent = () => {}, reviewGate, signal, enableCvScreening = true, cvThreshold = 30,
  enableClassification = false, enableWaterDetectionThreshold = true,
  enrichCasValues = shimadzuCompoundEnrichmentService.enrichCasValues,
  resolveWaterDetectionThreshold = shimadzuWaterDetectionThresholdService.resolve,
  recoverCasRecord = shimadzuCasRecoveryService.recover,
}) {
  const raw = rawBytes instanceof Uint8Array ? rawBytes : new Uint8Array(rawBytes)
  const samples = sampleBytes instanceof Uint8Array ? sampleBytes : new Uint8Array(sampleBytes)
  const zip = new JSZip()
  const stages = []
  const parameters = { enableClassification, enableWaterDetectionThreshold, enableCvScreening, cvThreshold }
  const builders = [
    () => stage0(raw, samples, rawName, sampleName),
    () => stage1(stages[0], rawName, recoverCasRecord),
    () => stage2(stages[1]),
    () => stage3(stages[2], stages[0].samples),
    () => stage4(stages[3], stages[0].samples),
    () => stage5(stages[4], { enableCvScreening, cvThreshold }),
    () => stage6(stages[5]),
  ]
  const manifests = []
  for (let index = 0; index < builders.length; index += 1) {
    try {
      assertNotCancelled(signal)
      onEvent({ type: 'stage-start', stage: index, progress: Math.round(index / 7 * 100), message: V2_STAGE_DIRECTORIES[index] })
      const builtData = await builders[index]()
      const data = index === 4 && (enableClassification || enableWaterDetectionThreshold)
        ? await enrichStage4Data(builtData, {
          enableClassification, enableWaterDetectionThreshold, enrichCasValues, resolveWaterDetectionThreshold,
        })
        : builtData
      assertNotCancelled(signal)
      const manifest = await addStage(zip, index, data, workbookSpecs(index, data), parameters)
      if (!manifest.canAdvance) {
        throw await createPartialFailureArchive({
          zip, name, stage: index, issues: data.issues,
          completedStages: [...manifests, { stage: manifest.stage, status: manifest.severity, counts: manifest.counts }], parameters,
        })
      }
      stages.push(data)
      manifests.push(manifest)
      onEvent({ type: 'stage-complete', stage: index, progress: Math.round((index + 1) / 7 * 100), status: manifest.severity, counts: data.counts })
      if (reviewGate && index < builders.length - 1) {
        onEvent({ type: 'stage-review', stage: index, progress: Math.round((index + 1) / 7 * 100), message: '等待用户复核后继续' })
        await reviewGate(index)
        assertNotCancelled(signal)
      }
    } catch (error) {
      if (error?.code === 'ANALYSIS_CANCELLED') {
        if (error?.archiveBytes) throw error
        throw await createPartialCancellationArchive({ zip, name, stage: index, completedStages: manifests, parameters })
      }
      if (error?.archiveBytes) throw error
      throw await createPartialFailureArchive({
        zip, name, stage: index,
        issues: [{ severity: 'FAIL', code: error?.code || 'BROWSER_ANALYSIS_FAILED', message: error?.message || String(error), ...error?.details }],
        completedStages: manifests, parameters,
      })
    }
  }
  if (signal?.aborted) {
    throw await createPartialCancellationArchive({
      zip, name, stage: builders.length, completedStages: manifests, parameters,
    })
  }
  const completeness = {
    schemaVersion: 'shimadzu-v2-completeness-1', verifiedAt: new Date().toISOString(), status: 'PASS',
    scope: '步骤0至步骤6', oavExecuted: false, parameters, completedStages: [...V2_STAGE_DIRECTORIES],
    stageResults: manifests.map((manifest, index) => ({ index, stage: manifest.stage, status: manifest.severity, counts: manifest.counts })),
  }
  const completenessBytes = textBytes(`${JSON.stringify(completeness, null, 2)}\n`)
  zip.file('完整性验证/v2-completeness-verification.json', completenessBytes)
  zip.file('完整性验证/v2-completeness-verification.sha256', `${await sha256(completenessBytes)}\n`)
  const run = { schemaVersion: 'shimadzu-browser-run-1', completedAt: new Date().toISOString(), status: 'PASS', oavExecuted: false, name, parameters, completedStages: [...V2_STAGE_DIRECTORIES] }
  const runBytes = textBytes(`${JSON.stringify(run, null, 2)}\n`)
  zip.file('v2-run.json', runBytes)
  zip.file('v2-run.sha256', `${await sha256(runBytes)}\n`)
  const archiveBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  const archiveSha256 = await sha256(archiveBytes)
  onEvent({ type: 'complete', progress: 100, archiveSize: archiveBytes.byteLength, archiveSha256 })
  const invalidName = new Set('<>:"/\\|?*')
  const safeName = [...String(name || '岛津气质分析')]
    .map(character => invalidName.has(character) || character.charCodeAt(0) < 32 ? '_' : character)
    .join('').slice(0, 80) || '岛津气质分析'
  return { ...run, stages, manifests, archiveBytes, archiveSha256, fileName: `${safeName}_步骤0-6结果.zip` }
}
