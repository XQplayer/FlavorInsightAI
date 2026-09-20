import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('./components/platform/PlatformShell.jsx', import.meta.url),
  'utf8',
);
const styles = await readFile(
  new URL('./components/platform/PlatformShell.css', import.meta.url),
  'utf8',
);

test('provides a skip link and a labelled main landmark', () => {
  assert.match(source, /href="#main-content"/);
  assert.match(source, /<main[^>]*id="main-content"/);
});

test('defines exactly the five approved platform destinations and labels', () => {
  const navigation = source.match(/const NAV_ITEMS = Object\.freeze\(\[[\s\S]*?\]\);/)?.[0] ?? '';
  const destinations = [
    ['home', '首页', 'Home'],
    ['database', 'FlavorThresholdDB', 'FlavorThresholdDB'],
    ['processing', '数据处理', 'Data processing'],
    ['analysis', '数据分析', 'Data analysis'],
    ['resources', '资源中心', 'Resources'],
  ];

  assert.equal((navigation.match(/\broute:\s*'/g) ?? []).length, destinations.length);
  for (const [route, zhLabel, enLabel] of destinations) {
    assert.match(navigation, new RegExp(`route: '${route}'`));
    assert.match(navigation, new RegExp(`zh: '${zhLabel}'`));
    assert.match(navigation, new RegExp(`en: '${enLabel}'`));
  }

  assert.match(source, /href=\{routeHref\(item\.route,/);
  assert.match(source, /aria-current=\{isActive \? 'page' : undefined\}/);
});

test('labels language, theme, and account controls and uses Lucide icons only', () => {
  assert.match(source, /aria-label=\{copy\.languageControl\}/);
  assert.match(source, /data-language="zh"/);
  assert.match(source, /data-language="en"/);
  assert.match(source, /aria-label=\{copy\.themeControl\}/);
  assert.match(source, /aria-label=\{copy\.accountControl\}/);
  assert.match(source, /Menu,[\s\S]*Moon,[\s\S]*Sun,[\s\S]*UserRound,[\s\S]*X/);
  assert.doesNotMatch(source, /[\u{1F300}-\u{1FAFF}]/u);
});

test('uses an operable mobile disclosure and dismissible account explanation', () => {
  assert.match(source, /aria-expanded=\{mobileMenuOpen\}/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /shellRef\.current\?\.contains\(event\.target\)/);
  assert.match(source, /setMobileMenuOpen\(false\)/);
  assert.match(source, /本地模式/);
  assert.match(source, /可选云端留存正在规划中/);
});

test('keeps the fixed shell accessible and responsive', () => {
  assert.match(styles, /var\(--navbar-height,\s*70px\)/);
  assert.match(styles, /min-(?:height|width):\s*var\(--control-height,\s*44px\)/);
  assert.match(styles, /max-width:\s*var\(--container-max,\s*1200px\)/);
  assert.match(styles, /@media \(max-width:\s*1100px\)/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /scroll-margin-top:/);
  assert.match(styles, /overflow-x:\s*(?:clip|hidden)/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)/);
});
