import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { resultTable } from './resultTables.mjs';
import { orderedMatrix } from './plotModels.mjs';
export function safeScalar(value) {
  if (value === null || value === undefined) return 'NA';
  if (typeof value === 'number') return Number.isFinite(value) ? value : 'NA';
  if (typeof value === 'boolean') return value;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return /^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text) ? "'" + text : text;
}
export function collectTables(run) {
  const tables = [];
  function visit(value, path, context = {}) {
    if (Array.isArray(value)) {
      tables.push({
        name: path,
        ...resultTable(value, {
          name: path.split('.').at(-1),
          context
        })
      });
      return;
    }
    if (value && typeof value === 'object') for (const [key, entry] of Object.entries(value)) visit(entry, `${path}.${key}`, value);
  }
  visit(run.result?.data || {}, 'data');
  tables.push({
    name: 'features',
    rows: run.request.dataset.features
  }, {
    name: 'samples',
    rows: run.request.dataset.samples
  });
  const leaves = [];
  function leaf(value, path) {
    if (value && typeof value === 'object') for (const [key, entry] of Object.entries(value)) leaf(entry, `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`);else leaves.push({
      path,
      value
    });
  }
  leaf(run.result, '');
  tables.push({
    name: 'all-result-fields',
    rows: leaves
  });
  const d = run.result?.data;
  if (d?.matrix && d.rowOrder) {
    const o = orderedMatrix(d, Infinity);
    tables.push({
      name: 'ordered-display-matrix',
      rows: o.values.map((row, i) => ({
        sampleId: o.rows[i],
        ...Object.fromEntries(o.columns.map((id, j) => [id, row[j]]))
      }))
    });
  }
  return tables;
}
function grid(table) {
  const keys = table.columns || [...new Set(table.rows.flatMap(r => Object.keys(r)))];
  return [keys.map(safeScalar), ...table.rows.map(r => keys.map(k => safeScalar(r[k])))];
}
export function tableCsv(table) {
  return '\uFEFF' + grid(table).map(row => row.map(v => '"' + String(v).replaceAll('"', '""') + '"').join(',')).join('\r\n');
}
export function exportResultXlsx(run) {
  const workbook = XLSX.utils.book_new();
  collectTables(run).forEach((table, i) => {
    const rows = grid(table);
    // Excel has a fixed text-cell limit; never silently truncate a result.
    if (rows.some(row => row.some(v => typeof v === 'string' && v.length > 32767))) throw new Error('Excel cell limit exceeded; use complete CSV ZIP / reproduction bundle.');
    if (rows.length > 1048576 || rows.some(row => row.length > 16384)) throw new Error('Excel sheet limit exceeded; use complete CSV ZIP.');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), `${i + 1}-${table.name.replace(/[\\/?*[\]:]/g, '_')}`.slice(0, 31));
  });
  return XLSX.write(workbook, {
    type: 'array',
    bookType: 'xlsx'
  });
}
export async function createCsvZip(run) {
  const zip = new JSZip(),
    manifest = [];
  collectTables(run).forEach((table, i) => {
    const filename = `${i + 1}-${table.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120)}.csv`;
    zip.file(filename, tableCsv(table));
    manifest.push({
      filename,
      table: table.name,
      rows: table.rows.length
    });
  });
  zip.file('table-manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('README.txt', 'Complete result tables; table-manifest.json maps safe archive filenames to original table paths. NA denotes missing. Formula-like text is prefixed with an apostrophe. Nested objects are JSON text; all-result-fields contains every scalar leaf using JSON Pointer paths. IDs refer to the bound request, never a newer dataset.');
  return zip;
}
export const REPRODUCE_R = `# Fixed trusted runner. JSON content is data, never evaluated as code.
args <- commandArgs(trailingOnly=TRUE)
if (length(args) != 3) stop('Usage: Rscript reproduce.R request.json trusted-engine-directory output.json')
request <- normalizePath(args[1], mustWork=TRUE)
engine <- normalizePath(file.path(args[2], 'engine.R'), mustWork=TRUE)
output <- normalizePath(args[3], mustWork=FALSE)
if (identical(request, output)) stop('Output must not overwrite request')
if (file.exists(output)) stop('Output already exists; choose a new output file')
if (!dir.exists(dirname(output))) stop('Output directory must already exist')
status <- system2(file.path(R.home('bin'), 'Rscript'), args=c('--vanilla', shQuote(c(engine, request, output))))
if (status != 0) stop('Engine execution failed')
`;
export async function createReproductionBundle(run, metadata = {}) {
  const zip = await createCsvZip(run);
  zip.file('request.json', JSON.stringify(run.request, null, 2));
  zip.file('result.json', JSON.stringify(run, null, 2));
  zip.file('recipe.json', JSON.stringify(run.request.recipe, null, 2));
  zip.file('plot-metadata.json', JSON.stringify(metadata, null, 2));
  zip.file('reproduce.R', REPRODUCE_R);
  zip.file('methods-provenance.txt', JSON.stringify({
    analysis: run.request.analysis,
    recipe: run.request.recipe,
    provenance: run.result?.provenance,
    preprocessing: run.result?.preprocessing,
    requestHash: run.requestHash
  }, null, 2));
  zip.file('README.txt', 'Run Rscript --vanilla reproduce.R request.json PATH_TO_TRUSTED_services/analysis output.json. Use the matching reviewed engine and R/package versions recorded in methods-provenance.txt. The engine and dependencies are not bundled. No request strings are executable code. Output must be a new file in an existing directory. Numerical results can depend on runtime versions. Tables include the complete result; charts may display explicit subsets. NA is missing, not zero. Formula-like strings receive an apostrophe. No PDF report or automatic 300-DPI claim. All artifacts are generated locally.');
  return zip;
}
