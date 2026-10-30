import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(new URL('./SearchInsights.jsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../App.css', import.meta.url), 'utf8');
const analyticsClient = await readFile(new URL('../lib/supabase.js', import.meta.url), 'utf8');

test('database activity keeps an honest compact panel and only shows recorded statistics', () => {
  assert.match(component, /id="database-activity"/);
  assert.match(component, /setStatus\('ready'\)/);
  assert.match(component, /setStatus\('error'\)/);
  assert.match(component, /Promise\.allSettled\(\[fetchSearchStats\(30\), fetchAnalyticsSummary\(\)\]\)/);
  assert.match(component, /status === 'ready' \? summary\.total_visits : '—'/);
  assert.match(component, /status === 'ready' \? summary\.total_searches : '—'/);
  assert.match(component, /status === 'ready' && leaves\.length > 0/);
  assert.match(component, /analyticsReadOnly/);
  assert.match(analyticsClient, /analyticsReadOnly = import\.meta\.env\.DEV \|\| import\.meta\.env\.VITE_ANALYTICS_READ_ONLY === 'true'/);
  assert.match(analyticsClient, /if \(!supabase \|\| analyticsReadOnly\) return false/);
  assert.match(analyticsClient, /if \(!supabase \|\| analyticsReadOnly \|\| !cas \|\| !commonName\) return false/);
  assert.doesNotMatch(styles, /compound-treemap--unavailable/);
});
