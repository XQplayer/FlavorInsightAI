import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('./pages/PlatformHomeV2.jsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('./pages/PlatformHomeV2.css', import.meta.url), 'utf8');
const app = await readFile(new URL('./app/PlatformApp.jsx', import.meta.url), 'utf8');

test('actual homepage uses four honest module states and a real local screenshot', async () => {
  assert.match(app, /PlatformHomeV2\.jsx/);
  assert.equal((source.match(/route: (?:'[^']+'|null), status:/g) ?? []).length, 4);
  assert.match(source, /status: 'beta'/);
  assert.match(source, /status: 'planned'/);
  assert.match(source, /AI prediction is not deployed/);
  assert.match(source, /AI 预测尚未部署/);
  assert.match(source, /product-search-preview\.png/);
  assert.ok((await stat(new URL('../public/assets/product-search-preview.png', import.meta.url))).size > 20_000);
  assert.doesNotMatch(source, /v1\.5\.0|<svg\b/);
});

test('homepage keeps direct workbench routes, contrast and responsive layout', () => {
  for (const route of ['processing', 'database', 'search', 'analysis', 'resources']) {
    assert.match(source, new RegExp(`route: '${route}'|route=\"${route}\"`));
  }
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media \(max-width: 768px\)/);
  assert.match(styles, /@media \(max-width: 480px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /#2563eb/i);
  assert.match(styles, /#102a43/i);
});
