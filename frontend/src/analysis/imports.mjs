import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import { createDataset } from './dataset.mjs'

export const IMPORT_LIMITS = Object.freeze({ maxBytes: 32 * 1024 * 1024, maxExpandedBytes: 256 * 1024 * 1024, maxEntries: 2000, maxCells: 2_000_000 })
export function parseDelimited(text, delimiter = ',') {
  const rows = []; let row = [], cell = '', quoted = false
  const value = String(text).replace(/^\uFEFF/, '')
  for (let i = 0; i < value.length; i++) {
    const c = value[i]
    if (c === '"') { if (quoted && value[i + 1] === '"') { cell += '"'; i++ } else quoted = !quoted }
    else if (!quoted && c === delimiter) { row.push(cell); cell = '' }
    else if (!quoted && (c === '\n' || c === '\r')) { if (c === '\r' && value[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  if (quoted) throw new Error('UNTERMINATED_QUOTED_FIELD')
  if (row.length || cell.length) { row.push(cell); rows.push(row) }
  return rows
}
export function safeArchivePath(path) {
  return typeof path === 'string' && path.length > 0 && !/[\\\u0000-\u001f:]/.test(path) && !path.startsWith('/') && !path.split('/').some(p => p === '..' || p === '.')
}
/** Validate the central directory before any decompression (including XLSX). ZIP64/encryption are intentionally unsupported. */
export function inspectZip(bytes, options = {}) {
  const limits = { ...IMPORT_LIMITS, ...options }; const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  if (input.byteLength > limits.maxBytes) throw new Error('FILE_TOO_LARGE')
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength)
  let end = -1
  for (let p = input.length - 22; p >= Math.max(0, input.length - 65557); p--) if (view.getUint32(p, true) === 0x06054b50 && p + 22 + view.getUint16(p + 20, true) === input.length) { end = p; break }
  if (end < 0) throw new Error('INVALID_ZIP')
  const count = view.getUint16(end + 10, true); let offset = view.getUint32(end + 16, true); let total = 0
  if (count > limits.maxEntries || count === 65535 || view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0) throw new Error('ZIP_LIMIT')
  const entries = []; const names = new Set()
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw new Error('INVALID_ZIP')
    const size = view.getUint32(offset + 24, true), length = view.getUint16(offset + 28, true), extra = view.getUint16(offset + 30, true), comment = view.getUint16(offset + 32, true)
    if (offset + 46 + length + extra + comment > end) throw new Error('INVALID_ZIP')
    const name = new TextDecoder().decode(input.subarray(offset + 46, offset + 46 + length))
    if (!safeArchivePath(name) || names.has(name)) throw new Error('UNSAFE_ZIP_PATH')
    if (view.getUint16(offset + 8, true) & 1) throw new Error('ENCRYPTED_ZIP')
    total += size; if (size === 0xffffffff || total > limits.maxExpandedBytes) throw new Error('ZIP_EXPANDED_LIMIT')
    names.add(name); entries.push({ name, size }); offset += 46 + length + extra + comment
  }
  return entries
}
export function readBoundedZipEntry(entry, expectedSize) {
  return new Promise((resolve, reject) => {
    let total = 0; const chunks = []; const stream = entry.internalStream('uint8array')
    stream.on('data', chunk => { total += chunk.length; if (total > expectedSize) { stream.pause(); reject(new Error('ZIP_ENTRY_SIZE')) } else chunks.push(chunk) })
    stream.on('error', () => reject(new Error('ZIP_ENTRY_SIZE')))
    stream.on('end', () => { if (total !== expectedSize) { reject(new Error('ZIP_ENTRY_SIZE')); return }; const result = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { result.set(chunk,offset); offset += chunk.length }; resolve(result) })
    stream.resume()
  })
}
export async function readImportFile(input, options = {}) {
  const limits = { ...IMPORT_LIMITS, ...options }
  if (input?.size > limits.maxBytes) throw new Error('FILE_TOO_LARGE')
  const bytes = input?.arrayBuffer ? new Uint8Array(await input.arrayBuffer()) : input instanceof Uint8Array ? input : new Uint8Array(input)
  if (bytes.byteLength > limits.maxBytes) throw new Error('FILE_TOO_LARGE')
  const name = options.name || input?.name || 'pasted.csv'; const extension = name.split('.').pop().toLowerCase()
  if (['csv', 'tsv', 'txt'].includes(extension)) {
    const delimiter = options.delimiter ?? (extension === 'csv' ? ',' : '\t'); const encoding = options.encoding ?? 'utf-8'
    if (![',','\t',';','|'].includes(delimiter)) throw new Error('INVALID_DELIMITER')
    if (!['utf-8','utf-16le','utf-16be','gb18030','gbk','windows-1252'].includes(encoding.toLowerCase())) throw new Error('INVALID_ENCODING')
    const rows = parseDelimited(new TextDecoder(encoding, {fatal:true}).decode(bytes), delimiter)
    if (rows.reduce((n, r) => n + r.length, 0) > limits.maxCells) throw new Error('CELL_LIMIT')
    return { name, sheets: [{ name: 'Data', rows }], warnings: [], sourceOptions: {encoding,delimiter} }
  }
  if (extension !== 'xlsx') throw new Error('UNSUPPORTED_IMPORT_TYPE')
  const entries = inspectZip(bytes, limits); const zip = await JSZip.loadAsync(bytes)
  for (const entry of entries) if (!entry.name.endsWith('/')) await readBoundedZipEntry(zip.file(entry.name), entry.size)
  const workbook = XLSX.read(bytes, { type: 'array', cellFormula: true, sheetStubs: true, sheetRows: limits.maxCells + 1 }); const warnings = []
  let cells = 0
  const sheets = workbook.SheetNames.map(sheetName => {
    const sheet = workbook.Sheets[sheetName]; const range = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref'] || 'A1')
    cells += (range.e.r + 1) * (range.e.c + 1); if (cells > limits.maxCells) throw new Error('CELL_LIMIT')
    for (const [address, cell] of Object.entries(sheet)) if (cell?.f && (cell.v === undefined || cell.v === null || cell.t === 'z')) warnings.push({ sheet: sheetName, address, code: 'FORMULA_WITHOUT_CACHED_VALUE' })
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null, blankrows: true }).map(row => Array.from({ length: range.e.c + 1 }, (_, c) => row[c] ?? null))
    return { name: sheetName, rows }
  })
  return { name, sheets, warnings }
}
const annotations = /^(?:cas(?:\s*#)?|rt|ri|ret\.?\s*(?:time|index)|retention\s*(?:time|index)|mean|sd|cv|unit|name|id|group|batch|subject|biologicalunitid|内标|名称|单位)(?:$|\s|（|\()/i
export function previewTable(rows, config) {
  const { headerRow, orientation } = config
  if (!Number.isInteger(headerRow) || headerRow < 0 || headerRow >= rows.length || !['features-rows', 'samples-rows'].includes(orientation)) throw new Error('EXPLICIT_HEADER_ORIENTATION_REQUIRED')
  const header = rows[headerRow]; const body = rows.slice(headerRow + 1).map((row, i) => ({ row, sourceRow: headerRow + i + 2 })).filter(({ row }) => row.some(v => v !== null && v !== undefined && String(v).trim() !== ''))
  const columns = orientation === 'features-rows' ? config.sampleColumns : config.featureColumns
  if (!Array.isArray(columns) || !columns.length || new Set(columns).size !== columns.length || columns.some(c => !Number.isInteger(c) || c < 0 || c >= header.length)) throw new Error('EXPLICIT_MEASUREMENT_COLUMNS_REQUIRED')
  const reserved = ['nameColumn', 'casColumn', 'unitColumn', 'sampleNameColumn', 'groupColumn', 'biologicalUnitColumn', 'subjectColumn', 'batchColumn'].map(k => config[k]).filter(Number.isInteger)
  if (columns.some(c => reserved.includes(c) || annotations.test(String(header[c])) || /(?:^|[\s_])(?:mean|sd|cv|status)(?:$|[\s_（(])/i.test(String(header[c])))) throw new Error('ANNOTATION_AS_MEASUREMENT')
  const invalidCells = []; const missingTokens = new Set(['', 'na', 'n/a', 'null', 'nan', '-'])
  function numeric(value, row, column) {
    if (value === null || value === undefined || missingTokens.has(String(value).trim().toLowerCase())) return null
    if ((typeof value === 'number' || typeof value === 'string') && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(String(value).trim()) && Number.isFinite(Number(value))) return Number(value)
    invalidCells.push({ row, column: column + 1, value: String(value), code: 'NONNUMERIC_MEASUREMENT' }); return null
  }
  let samples, features, matrix
  if (orientation === 'features-rows') {
    samples = columns.map((c, i) => ({ id: `sample-${i + 1}`, name: String(header[c] ?? `Sample ${i + 1}`) }))
    features = body.map(({ row, sourceRow }, i) => ({ id: `feature-${i + 1}`, name: String(row[config.nameColumn] ?? `Feature ${i + 1}`), cas: String(row[config.casColumn] ?? ''), unit: String(row[config.unitColumn] ?? config.unit ?? ''), sourceRow }))
    matrix = columns.map(c => body.map(({ row, sourceRow }) => numeric(row[c], sourceRow, c)))
  } else {
    samples = body.map(({ row, sourceRow }, i) => ({ id: `sample-${i + 1}`, name: String(row[config.sampleNameColumn] ?? `Sample ${i + 1}`), group: row[config.groupColumn] ?? '', biologicalUnitId: row[config.biologicalUnitColumn] ?? '', subjectId: row[config.subjectColumn] ?? '', batch: row[config.batchColumn] ?? '', sourceRow }))
    features = columns.map((c, i) => ({ id: `feature-${i + 1}`, name: String(header[c] ?? `Feature ${i + 1}`), unit: config.unit ?? '' }))
    matrix = body.map(({ row, sourceRow }) => columns.map(c => numeric(row[c], sourceRow, c)))
  }
  const serializableConfig = Object.fromEntries(Object.entries(config).filter(([, value]) => value !== undefined))
  const dataset = createDataset({ name: config.name || 'Imported dataset', samples, features, matrix, quality: { invalidCells }, provenance: { source: 'table-import', config: structuredClone(serializableConfig) } })
  return { dataset, invalidCells, header: [...header], sampleCount: samples.length, featureCount: features.length, requiresConfirmation: true }
}
