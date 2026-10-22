import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
const api = await import('./imports.mjs').catch(() => ({}))
test('preview requires explicit headers orientation and measurement columns; annotations never guessed', () => {
  assert.equal(typeof api.previewTable, 'function')
  const rows = [['Name', 'CAS', 'RT', 'S1', 'S2'], ['ethyl', '64-17-5', 7, '0', 'bad'], ['dup', '64-17-5', 8, '', 'NA']]
  assert.throws(() => api.previewTable(rows, {}), /EXPLICIT/)
  const preview = api.previewTable(rows, { headerRow: 0, orientation: 'features-rows', sampleColumns: [3, 4], nameColumn: 0, casColumn: 1 })
  assert.deepEqual(preview.dataset.matrix, [[0, null], [null, null]])
  assert.equal(preview.invalidCells.length, 1); assert.equal(preview.dataset.features.length, 2)
  assert.throws(() => api.previewTable(rows, { headerRow: 0, orientation: 'features-rows', sampleColumns: [1, 3], casColumn: 1 }), /ANNOTATION/)
})
test('sample-row orientation and quoted CSV/TSV/paste parsing', () => {
  assert.equal(typeof api.parseDelimited, 'function')
  assert.deepEqual(api.parseDelimited('Name,A,B\r\n"one, two",1,2\r\n'), [['Name','A','B'], ['one, two','1','2']])
  assert.deepEqual(api.parseDelimited('Name\tA\nS1\t2', '\t'), [['Name','A'], ['S1','2']])
  const result = api.previewTable([['sample','group','F1'], ['S1','G',3]], { headerRow: 0, orientation: 'samples-rows', featureColumns: [2], sampleNameColumn: 0, groupColumn: 1 })
  assert.equal(result.dataset.samples[0].group, 'G'); assert.deepEqual(result.dataset.matrix, [[3]])
})
test('xlsx uses cached values only, missing formula cache remains missing with warning', async () => {
  assert.equal(typeof api.readImportFile, 'function')
  const workbook = XLSX.utils.book_new(); const sheet = XLSX.utils.aoa_to_sheet([['Name','S1'], ['F1', 4], ['F2', null]])
  sheet.B2 = { t: 'n', f: '2+2', v: 4 }; sheet.B3 = { t: 'n', f: '1+1' }; sheet['!ref'] = 'A1:B3'
  XLSX.utils.book_append_sheet(workbook, sheet, 'Data')
  const result = await api.readImportFile(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), { name: 'data.xlsx' })
  assert.equal(result.sheets[0].rows[1][1], 4); assert.equal(result.sheets[0].rows[2][1], null)
  assert.equal(result.warnings.length, 1)
  await assert.rejects(api.readImportFile(new Uint8Array(12), { name: 'data.csv', maxBytes: 10 }), /FILE_TOO_LARGE/)
})
test('mean SD CV and status columns are rejected even with sample prefixes; hexadecimal is not numeric measurement', () => {
  assert.throws(() => api.previewTable([['Name','S1 Mean（μg/mL）'], ['A',2]], {headerRow:0,orientation:'features-rows',sampleColumns:[1],nameColumn:0}), /ANNOTATION/)
  const d = api.previewTable([['Name','S1'], ['A','0x10']], {headerRow:0,orientation:'features-rows',sampleColumns:[1],nameColumn:0})
  assert.equal(d.dataset.matrix[0][0],null); assert.equal(d.invalidCells.length,1)
})
test('declared ZIP sizes cannot hide expanded payloads', async () => {
  const zip = new JSZip(); zip.file('large.xml','x'.repeat(200_000)); const bytes = await zip.generateAsync({type:'uint8array',compression:'DEFLATE'})
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
  for(let p=0;p<bytes.length-46;p++) if(view.getUint32(p,true)===0x02014b50) view.setUint32(p+24,10,true)
  await assert.rejects(api.readImportFile(bytes,{name:'hostile.xlsx'}), /ZIP_ENTRY_SIZE/)
})
test('file preview honors explicit encoding and delimiter and retains reader settings', async () => {
  const result = await api.readImportFile(new TextEncoder().encode('Name;S1\nA;2'), {name:'x.csv',delimiter:';',encoding:'utf-8'})
  assert.deepEqual(result.sheets[0].rows,[['Name','S1'],['A','2']]); assert.equal(result.sourceOptions.delimiter,';')
  await assert.rejects(api.readImportFile(new Uint8Array(),{name:'x.csv',delimiter:'!!'}), /INVALID_DELIMITER/)
})
