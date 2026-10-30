import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('./pages/PlatformHomeV2.jsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('./pages/PlatformHomeV2.css', import.meta.url), 'utf8');
const app = await readFile(new URL('./app/PlatformApp.jsx', import.meta.url), 'utf8');

test('actual homepage routes four modules and distinguishes Beta studio from undeployed prediction', async () => {
  assert.match(app, /PlatformHomeV2\.jsx/);
  assert.equal((source.match(/route: (?:'[^']+'|null), status:/g) ?? []).length, 4);
  assert.match(source, /status: 'beta'/);
  assert.match(source, /id: 'models', route: 'models', status: 'beta'/);
  assert.match(source, /训练和预测尚未开放/);
  assert.match(source, /No production AI identification or flavor-prediction model is deployed/);
  assert.match(source, /尚未部署生产级 AI 鉴定或风味预测模型/);
  for (const asset of ['product-search-preview.png', 'product-processing-preview.png', 'product-analysis-preview.png']) {
    assert.match(source, new RegExp(asset.replace('.', '\\.')));
    assert.ok((await stat(new URL('../public/assets/' + asset, import.meta.url))).size > 20_000);
  }
  assert.doesNotMatch(source, /v1\.5\.0|<svg\b/);
});

test('homepage keeps direct workbench routes, contrast and responsive layout', () => {
  for (const route of ['processing', 'database', 'search', 'analysis', 'models', 'resources']) {
    assert.match(source, new RegExp(`route: '${route}'|route=\"${route}\"`));
  }
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media \(max-width: 767px\)/);
  assert.match(styles, /@container \(max-width: 430px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /--action-primary/);
  assert.match(styles, /--home-hero-base/);
});

test('homepage follows the evidence-first entry sequence without invented metrics', () => {
  for (const section of ['fi-home__hero', 'fi-home__trust', 'fi-home__features', 'fi-home__workflow', 'fi-home__advantages', 'fi-home__faq', 'fi-home__resources', 'fi-home__footer']) {
    assert.match(source, new RegExp(section));
  }
  assert.equal((source.match(/<details\b/g) ?? []).length, 1);
  assert.equal((source.match(/id: '(?:instruments|privacy|sources|ai)'/g) ?? []).length, 4);
  assert.match(source, /packageMetadata\.version/);
  assert.doesNotMatch(source, /30M\+|\d+%|用户数量|testimonials?/i);
});
