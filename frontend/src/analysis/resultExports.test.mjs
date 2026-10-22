import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
const m = await import('./resultExports.mjs').catch(() => ({}));
const run = {
  id: 'test',
  request: {
    dataset: {
      features: [{
        id: 'f',
        name: '=HYPERLINK("bad")'
      }],
      samples: [{
        id: 's'
      }]
    },
    recipe: {},
    analysis: {
      method: 'heatmap'
    }
  },
  result: {
    data: {
      matrix: [[null, 0]],
      sampleIds: ['s'],
      featureIds: ['f', 'g'],
      rowOrder: [1],
      columnOrder: [2, 1],
      rowTree: null
    },
    provenance: {
      version: 'x'
    }
  }
};
test('complete CSV tables preserve missing/zero and formula-safe scalars', () => {
  assert.equal(typeof m.collectTables, 'function');
  const tables = m.collectTables(run);
  const matrix = tables.find(x => x.name === 'data.matrix');
  assert.equal(matrix.rows[0]['[1] f'], null);
  assert.equal(matrix.rows[0]['[2] g'], 0);
  assert.match(m.tableCsv({
    rows: [{
      a: '=1',
      b: 0,
      c: null,
      d: {
        f: '1+1'
      },
      e: '\t=1'
    }]
  }), /'=1/);
  assert.equal(m.safeScalar({
    f: '1+1'
  }), '\'{"f":"1+1"}'.slice(1));
});
test('XLSX contains only scalar typed cells and preserves all rows', () => {
  assert.equal(typeof m.exportResultXlsx, 'function');
  const bytes = m.exportResultXlsx(run),
    wb = XLSX.read(bytes, {
      type: 'array'
    });
  assert.ok(wb.SheetNames.length >= 4);
  for (const name of wb.SheetNames) for (const [key, cell] of Object.entries(wb.Sheets[name])) if (!key.startsWith('!')) assert.equal(cell.f, undefined);
  const content = wb.SheetNames.flatMap(name => XLSX.utils.sheet_to_json(wb.Sheets[name], {
    header: 1
  })).flat().join('|');
  assert.match(content, /'=HYPERLINK/);
});
test('reproduction runner is fixed code and bundle retains exact request', async () => {
  assert.equal(typeof m.createReproductionBundle, 'function');
  const zip = await m.createReproductionBundle(run, {
    view: 'matrix'
  });
  assert.deepEqual(JSON.parse(await zip.file('request.json').async('string')), run.request);
  const script = await zip.file('reproduce.R').async('string');
  assert.match(script, /commandArgs/);
  assert.match(script, /engine.R/);
  assert.doesNotMatch(script, /HYPERLINK|eval\(|parse\(/);
  assert.match(script, /file.exists\(output\)/);
  assert.match(script, /args=c\('--vanilla'/);
  assert.ok(zip.file('result.json'));
  assert.ok(zip.file('plot-metadata.json'));
});
test('XLSX rejects unrepresentable cells explicitly instead of truncating', () => {
  const huge = structuredClone(run);
  huge.request.dataset.features[0].name = 'x'.repeat(32768);
  assert.throws(() => m.exportResultXlsx(huge), /Excel cell limit/);
});
test('portable result keys cannot create traversal paths in CSV archives', async () => {
  const malicious = structuredClone(run);
  malicious.result.data['../../untrusted\\path'] = [{
    value: 1
  }];
  const zip = await m.createCsvZip(malicious);
  for (const path of Object.keys(zip.files)) {
    assert.doesNotMatch(path, /[\\/]/);
    assert.doesNotMatch(path, /^\.\./);
  }
  assert.ok(zip.file('table-manifest.json'));
  const manifest = JSON.parse(await zip.file('table-manifest.json').async('string'));
  assert.ok(manifest.some(x => x.table.includes('../../')));
});
