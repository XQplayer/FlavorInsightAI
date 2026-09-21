import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function readSource(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8')
    .catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error));
}

const [pageSource, platformSource, appSource, appStyles] = await Promise.all([
  readSource('./pages/DatabaseOverviewPage.jsx'),
  readSource('./app/PlatformApp.jsx'),
  readSource('./App.jsx'),
  readSource('./App.css'),
]);

test('database overview wraps the mature database app in embedded controlled mode', () => {
  assert.match(pageSource, /import DatabaseApp from ['"]\.\.\/App\.jsx['"]/);
  assert.match(pageSource, /function DatabaseOverviewPage\(\{[\s\S]*initialView[\s\S]*language[\s\S]*onLanguageChange[\s\S]*onNavigate[\s\S]*\}\)/);
  assert.match(pageSource, /<DatabaseApp[\s\S]*initialView=\{initialView\}[\s\S]*embedded[\s\S]*language=\{language\}[\s\S]*onLanguageChange=\{onLanguageChange\}[\s\S]*onNavigate=\{onNavigate\}/);
});

test('database and search routes share the lazy database overview boundary', () => {
  assert.match(platformSource, /lazy\(\(\) => import\(['"]\.\.\/pages\/DatabaseOverviewPage\.jsx['"]\)\)/);
  assert.match(platformSource, /<DatabaseOverviewPage[\s\S]*initialView=\{route === ['"]search['"] \? ['"]search['"] : ['"]home['"]\}/);
  assert.doesNotMatch(platformSource, /lazy\(\(\) => import\(['"]\.\.\/App\.jsx['"]\)\)/);
});

test('the legacy homepage is explicitly scoped to the database module', () => {
  assert.match(appSource, /FlavorInsight AI · Database module/);
  assert.match(appSource, /FlavorInsight AI · 数据库模块/);
  assert.match(appSource, /Database coverage/);
  assert.match(appSource, /数据库数据覆盖/);
  assert.match(appSource, /<SearchInsights/);
  for (const sourceName of ['FEMA', 'FlavorDB2', 'PubChem', 'Van Gemert', 'Fan & Xu']) {
    assert.match(appSource, new RegExp(sourceName.replace('&', '\\&')));
  }
  assert.match(appSource, /embedded\s*&&[\s\S]*onClick=\{openDataSources\}[\s\S]*数据来源与引用/);
  assert.match(appSource, /if \(!embedded\)\s*\{[\s\S]*window\.history\.pushState\(\{ view: 'home' \}/);
});

test('embedded database chrome inherits platform surfaces without legacy top offsets', () => {
  const embeddedShell = appStyles.match(/\.app-shell\.embedded\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(embeddedShell, /--surface-workbench:\s*var\(--platform-canvas\)/);
  assert.match(embeddedShell, /--surface-panel:\s*var\(--platform-surface\)/);
  assert.match(embeddedShell, /--text-primary:\s*var\(--platform-ink\)/);
  assert.match(embeddedShell, /--text-secondary:\s*var\(--platform-text\)/);
  assert.match(appStyles, /\.app-shell\.embedded \.science-hero\s*\{[^}]*padding-top:\s*0/);
  assert.match(appStyles, /\.app-shell\.embedded \.search-page-header\s*\{[^}]*padding-top:\s*0/);
});
