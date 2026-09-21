import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function readSource(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8')
    .catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error));
}

const [pageSource, platformSource, appSource, appStyles, tokenStyles] = await Promise.all([
  readSource('./pages/DatabaseOverviewPage.jsx'),
  readSource('./app/PlatformApp.jsx'),
  readSource('./App.jsx'),
  readSource('./App.css'),
  readSource('./tokens.css'),
]);

function hexToRgb(hex) {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function relativeLuminance(hex) {
  const channels = hexToRgb(hex).map(channel => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function tokenValue(block, name) {
  return block.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1];
}

test('database overview wraps the mature database app in embedded controlled mode', () => {
  assert.match(pageSource, /import DatabaseApp from ['"]\.\.\/App\.jsx['"]/);
  assert.match(pageSource, /function DatabaseOverviewPage\(\{[\s\S]*initialView[\s\S]*language[\s\S]*onLanguageChange[\s\S]*onNavigate[\s\S]*\}\)/);
  assert.match(pageSource, /<DatabaseApp[\s\S]*initialView=\{initialView\}[\s\S]*embedded[\s\S]*language=\{language\}[\s\S]*onLanguageChange=\{onLanguageChange\}[\s\S]*onNavigate=\{onNavigate\}/);
});

test('database and search routes share the lazy database overview boundary', () => {
  assert.match(platformSource, /lazy\(\(\) => import\(['"]\.\.\/pages\/DatabaseOverviewPage\.jsx['"]\)\)/);
  assert.match(platformSource, /<DatabaseOverviewPage[\s\S]*initialView=\{route === ['"]search['"] \? ['"]search['"] : ['"]home['"]\}/);
  assert.doesNotMatch(platformSource, /lazy\(\(\) => import\(['"]\.\.\/App\.jsx['"]\)\)/);
  assert.doesNotMatch(platformSource, /<DatabaseOverviewPage[\s\S]*?key=\{route\}/);
  assert.match(appSource, /useEffect\(\(\) => \{[\s\S]*if \(!embedded\)[\s\S]*setCurrentView\(initialView\)[\s\S]*\}, \[embedded, initialView\]\)/);
});

test('the platform owns route titles while the standalone database keeps its title', () => {
  assert.match(platformSource, /const PLATFORM_ROUTE_TITLES = Object\.freeze\(/);
  assert.match(platformSource, /useEffect\(\(\) => \{[\s\S]*document\.title = PLATFORM_ROUTE_TITLES\[language\]\?\.\[route\][\s\S]*\}, \[language, route\]\)/);
  assert.match(appSource, /useEffect\(\(\) => \{[\s\S]*if \(!embedded\) \{[\s\S]*document\.title = [\s\S]*\}[\s\S]*\}, \[embedded, isEnglish\]\)/);
});

test('embedded search yields its main landmark and skip target to the platform shell', () => {
  assert.match(appSource, /const SearchContentRoot = embedded \? ['"]div['"] : ['"]main['"]/);
  assert.match(appSource, /<SearchContentRoot[\s\S]*id=\{embedded \? undefined : ['"]main-content['"]\}/);
  assert.match(appSource, /<\/SearchContentRoot>/);
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

test('the secondary database action uses tokenized light and dark colors above AA contrast', () => {
  assert.match(appStyles, /\.science-secondary-action\s*\{[^}]*color:\s*var\(--text-primary\)[^}]*background:\s*var\(--surface-panel\)/);
  assert.match(appStyles, /:root\[data-theme=['"]dark['"]\] \.science-secondary-action\s*\{[^}]*color:\s*var\(--platform-ink\)[^}]*background:\s*var\(--platform-surface\)/);
  const lightTokens = tokenStyles.match(/:root\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  const darkTokens = tokenStyles.match(/:root\[data-theme=['"]dark['"]\]\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  assert.ok(contrastRatio(
    tokenValue(lightTokens, 'platform-ink'),
    tokenValue(lightTokens, 'platform-surface'),
  ) >= 4.5);
  assert.ok(contrastRatio(
    tokenValue(darkTokens, 'platform-ink'),
    tokenValue(darkTokens, 'platform-surface'),
  ) >= 4.5);
});

test('search insight counters use tokenized light and dark surfaces above AA contrast', () => {
  assert.match(appStyles, /\.search-insights-counters span\s*\{[^}]*color:\s*var\(--text-primary\)[^}]*background:\s*var\(--surface-panel\)/);
  assert.match(appStyles, /:root\[data-theme=['"]dark['"]\] \.search-insights-counters span\s*\{[^}]*color:\s*var\(--platform-ink\)[^}]*background:\s*var\(--platform-surface\)/);
  const lightTokens = tokenStyles.match(/:root\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  const darkTokens = tokenStyles.match(/:root\[data-theme=['"]dark['"]\]\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  assert.ok(contrastRatio(
    tokenValue(lightTokens, 'platform-ink'),
    tokenValue(lightTokens, 'platform-surface'),
  ) >= 4.5);
  assert.ok(contrastRatio(
    tokenValue(darkTokens, 'platform-ink'),
    tokenValue(darkTokens, 'platform-surface'),
  ) >= 4.5);
});
