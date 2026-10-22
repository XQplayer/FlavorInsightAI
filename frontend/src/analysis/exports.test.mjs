import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { createDataset } from './dataset.mjs'
const api = await import('./exports.mjs').catch(() => ({}))
const data = () => createDataset({id:'d',name:'Export',samples:[{id:'s',name:'=2+2'}],features:[{id:'f',name:'@evil',cas:'64-17-5'}],matrix:[[null]]})
test('portable project JSON round-trips complete dataset and analysis configuration', () => {
  assert.equal(typeof api.exportProject, 'function')
  const original = data(); const text = api.exportProject(original,{normalization:'none'})
  const restored = api.importProject(text); assert.deepEqual(restored.dataset,original); assert.deepEqual(restored.settings,{normalization:'none'})
  assert.throws(()=>api.importProject('{"schemaVersion":999}'), /PROJECT_SCHEMA/)
})
test('CSV escapes formula-like labels and keeps missing blank; XLSX never generates formulas', () => {
  assert.equal(typeof api.exportDatasetCsv,'function')
  const csv = api.exportDatasetCsv(data()); assert.ok(csv.includes("'=2+2")); assert.ok(csv.includes("'@evil")); assert.ok(!csv.includes('null'))
  const wb = XLSX.read(api.exportDatasetXlsx(data()),{type:'array'}); assert.equal(wb.Sheets.Data.D1.v,'=2+2'); assert.equal(wb.Sheets.Data.D1.f,undefined)
})
