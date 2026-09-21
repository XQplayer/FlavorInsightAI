import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('./DataProcessingPage.jsx', import.meta.url), 'utf8');
const routerSource = await readFile(new URL('../app/PlatformApp.jsx', import.meta.url), 'utf8');

test('embeds the Shimadzu workbench with platform preferences and navigation', () => {
  assert.match(source, /<ShimadzuAnalysisPage/);
  assert.match(source, /embedded/);
  assert.match(source, /language=\{language\}/);
  assert.match(source, /theme=\{theme\}/);
  assert.match(source, /onNavigate=\{onNavigate\}/);
});

test('keeps the processing integration behind its route-level wrapper', () => {
  assert.match(routerSource, /lazy\(\(\) => import\('\.\.\/pages\/DataProcessingPage\.jsx'\)\)/);
  assert.match(routerSource, /<DataProcessingPage/);
});
