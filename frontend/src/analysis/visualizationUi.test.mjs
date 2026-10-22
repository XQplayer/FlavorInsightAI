import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => {
  try {
    return readFileSync(new URL(p, import.meta.url), 'utf8');
  } catch {
    return '';
  }
};
test('completed bound runs mount visualizations and expose full exports', () => {
  const panel = read('../components/analysis/ResultsPanel.jsx');
  assert.match(panel, /ResultVisualizations/);
  assert.match(panel, /run.status === 'completed'/);
  const view = read('../components/analysis/ResultVisualizations.jsx');
  assert.match(view, /run.request.dataset/);
  assert.match(view, /createReproductionBundle/);
  assert.match(view, /exportResultXlsx/);
  assert.match(view, /createCsvZip/);
  assert.doesNotMatch(view, /submitJob|updateRecipe/);
});
test('native SVG charts offer title, description, keyboard and raw data alternatives', () => {
  const chart = read('../components/analysis/PlotPrimitives.jsx');
  assert.match(chart, /<title/);
  assert.match(chart, /<desc/);
  assert.match(chart, /onKeyDown/);
  assert.match(chart, /DataTable/);
  assert.match(chart, /serializeSvg/);
  assert.match(chart, /rasterizeSvg/);
});
test('scree renderer uses rank-bounded model, never the unrestricted spectrum', () => {
  const view = read('../components/analysis/ResultVisualizations.jsx');
  assert.match(view, /screeModel\(data\)/);
  assert.doesNotMatch(view, /points=\{\(data\.explained/);
});
test('public-only bilingual directory contains precisely seven curated references', async () => {
  const m = await import('./externalTools.mjs').catch(() => ({}));
  assert.ok(Array.isArray(m.EXTERNAL_TOOLS));
  assert.equal(m.EXTERNAL_TOOLS.length, 7);
  assert.match(m.EXTERNAL_TOOLS.find(x => x.id === 'hiplot-pca').url, /shiny\.hiplot/);
  assert.match(m.EXTERNAL_TOOLS.find(x => x.id === 'seqout').en, /not statistics/);
  assert.doesNotMatch(JSON.stringify(m.EXTERNAL_TOOLS), /originalBookmarkCount|sourceScope|书签/);
  const page = read('../components/analysis/ExternalTools.jsx');
  assert.match(page, /noopener noreferrer/);
  assert.match(page, /no-referrer/);
  assert.match(page, /2026-10-23/);
  assert.doesNotMatch(page, /<iframe|fetch\(/);
});
