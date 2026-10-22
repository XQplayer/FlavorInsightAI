import * as XLSX from 'xlsx'
import { createDataset, deepFreeze } from './dataset.mjs'
import { IMPORT_LIMITS } from './imports.mjs'
export function exportProject(dataset, settings = {}) {
  return JSON.stringify({ schemaVersion: 'flavor-analysis-project-1', dataset: createDataset(dataset), settings }, null, 2)
}
export function importProject(text) {
  if (new TextEncoder().encode(text).length > IMPORT_LIMITS.maxBytes) throw new Error('FILE_TOO_LARGE')
  const project = JSON.parse(text)
  if (project.schemaVersion !== 'flavor-analysis-project-1') throw new Error('PROJECT_SCHEMA')
  return deepFreeze({ dataset: createDataset(project.dataset), settings: structuredClone(project.settings || {}) })
}
function tableRows(dataset) {
  const d = createDataset(dataset)
  return [['Name','CAS','Unit',...d.samples.map(s => s.name)], ...d.features.map((f,j) => [f.name,f.cas,f.unit,...d.matrix.map(row => row[j])])]
}
export function exportDatasetCsv(dataset) {
  const cell = v => {
    let text = v === null ? '' : String(v)
    if (typeof v === 'string' && /^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  return '\uFEFF' + tableRows(dataset).map(row => row.map(cell).join(',')).join('\r\n')
}
export function exportDatasetXlsx(dataset) {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(tableRows(dataset)), 'Data')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(dataset.samples), 'Samples')
  return new Uint8Array(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }))
}
