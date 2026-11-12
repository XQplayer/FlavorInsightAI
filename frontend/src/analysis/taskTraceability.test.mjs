import assert from 'node:assert/strict'
import test from 'node:test'
import { createAnalysisTask, analysisArchiveFileName, analysisTaskMetadata, datasetExportFileName } from './taskTraceability.mjs'
import { mergeJobResponse } from './lifecycle.mjs'
import { createDataset, deriveDataset } from './dataset.mjs'
import { exportProject, importProject, exportDatasetXlsx } from './exports.mjs'
import * as XLSX from 'xlsx'
import { createCsvZip, createReproductionBundle } from './resultExports.mjs'
import { createReportBundle } from './report.mjs'
import { runFixture } from './evidenceFixture.mjs'
import { restoreSettings } from './workbench.mjs'

const origin = { taskNumber: 'FI-20261112-153045-A7C92E', taskName: '源任务', taskId: 'origin', taskCreatedAt: '2026-11-12T07:30:45.000Z', parentTaskId: null, parentTaskNumber: null }
const dataset = () => createDataset({ id:'d', name:'Synthetic', samples:[{id:'s'}], features:[{id:'f'}], matrix:[[1]], provenance:{taskIdentity:origin} })

test('analysis execution gets its own identity and keeps origin through polling and exports', () => {
  const request = { dataset: dataset(), analysis:{method:'pca'}, recipe:{} }
  const run = createAnalysisTask(request)
  assert.notEqual(run.taskIdentity.taskNumber, origin.taskNumber)
  assert.equal(run.taskIdentity.parentTaskNumber, origin.taskNumber)
  assert.equal(run.taskIdentity.parentTaskId, 'origin')
  const polled = mergeJobResponse(run, {id:'server-id',status:'running',requestHash:'hash'})
  assert.deepEqual(polled.taskIdentity,run.taskIdentity)
  assert.equal(analysisTaskMetadata(polled).sourceTaskIdentity.taskNumber,origin.taskNumber)
  assert.equal(analysisTaskMetadata(polled).serviceRunId,'server-id')
  assert.ok(analysisArchiveFileName(polled,'report').startsWith(run.taskIdentity.taskNumber+'_'))
  assert.ok(analysisArchiveFileName(polled,'csv').endsWith('_数据分析表格.zip'))
  const derived = deriveDataset(request.dataset, {}, 'edit')
  const restored = importProject(exportProject(derived)).dataset
  assert.deepEqual(restored.provenance.taskIdentity,origin)
  assert.equal(datasetExportFileName(restored,'csv'),'FI-20261112-153045-A7C92E_源任务_源矩阵.csv')
})

test('XLSX metadata is scalar-only and preserves the source task without changing matrix layout', () => {
  const wb = XLSX.read(exportDatasetXlsx(dataset()),{type:'array'})
  assert.equal(wb.Sheets.Data.D2.v,1)
  assert.ok(wb.SheetNames.includes('Task provenance'))
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Task provenance'],{header:1})
  assert.ok(rows.some(row=>row[0]==='taskNumber'&&row[1]===origin.taskNumber))
  for(const [address,cell] of Object.entries(wb.Sheets['Task provenance'])) if(!address.startsWith('!')) assert.equal(cell.f,undefined)
})

test('analysis CSV, reproduction and report ZIPs retain both run and source identities', async () => {
  const run = runFixture()
  run.request.dataset.provenance.taskIdentity = origin
  run.taskIdentity = { taskNumber: 'FI-20261112-153046-B8D93F', taskName: '统计分析', taskId: 'local-run', taskCreatedAt: '2026-11-12T07:30:46.000Z', parentTaskId: 'origin', parentTaskNumber: origin.taskNumber }
  for (const make of [createCsvZip, createReproductionBundle, createReportBundle]) {
    const zip = await make(run)
    const trace = JSON.parse(await zip.file('task-traceability.json').async('string'))
    assert.equal(trace.taskIdentity.taskNumber, 'FI-20261112-153046-B8D93F')
    assert.equal(trace.sourceTaskIdentity.taskNumber, 'FI-20261112-153045-A7C92E')
    assert.equal(trace.datasetId, run.request.dataset.id)
  }
})

test('new analysis identity round-trips through the actual strict settings restore contract', () => {
  const run = createAnalysisTask(runFixture().request)
  const restored = restoreSettings(importProject(exportProject(run.request.dataset, { runs: [run] })).settings)
  assert.deepEqual(restored.runs[0].taskIdentity, run.taskIdentity)
  assert.equal(restored.runs[0].status, 'interrupted')
  const legacy = { ...run }; delete legacy.taskIdentity
  assert.equal(restoreSettings({ runs: [legacy] }).runs[0].taskIdentity, undefined)
  assert.throws(() => restoreSettings({ runs: [{ ...run, taskIdentity: { ...run.taskIdentity, taskNumber: 'invalid' } }] }), /RUN/)
  assert.throws(() => restoreSettings({ runs: [{ ...run, taskIdentity: { ...run.taskIdentity, arbitrarySecret: 'not-allowed' } }] }), /RUN/)
})

test('analysis retry links the selected run, retaining the original processing source separately', () => {
  const parent = createAnalysisTask({ ...runFixture().request, dataset: dataset() })
  const child = createAnalysisTask(parent.request, { parent })
  assert.notEqual(child.taskIdentity.taskNumber, parent.taskIdentity.taskNumber)
  assert.equal(child.taskIdentity.parentTaskId, parent.id)
  assert.equal(child.taskIdentity.parentTaskNumber, parent.taskIdentity.taskNumber)
  assert.equal(analysisTaskMetadata(child).sourceTaskIdentity.taskNumber, origin.taskNumber)
  assert.equal(child.request, parent.request)
})
