import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(new URL('./SearchInsights.jsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../App.css', import.meta.url), 'utf8');

test('unconfigured analytics use a compact honest state without zero activity counters', () => {
  assert.match(component, /analyticsEnabled && <div className="search-insights-counters"/);
  assert.match(component, /compound-treemap--unavailable/);
  assert.match(styles, /\.compound-treemap--unavailable\s*\{/);
});
