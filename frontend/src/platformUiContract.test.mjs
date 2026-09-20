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

test('drives the theme control from the provider resolved theme', () => {
  assert.match(source, /resolvedTheme/);
  assert.match(source, /darkThemeActive = resolvedTheme === 'dark'/);
  assert.match(source, /setTheme\(nextThemePreference\(resolvedTheme\)\)/);
  assert.doesNotMatch(source, /darkThemeActive = theme === 'dark'/);
});

test('uses an operable mobile disclosure and dismissible account explanation', () => {
  assert.match(source, /aria-expanded=\{mobileMenuOpen\}/);
  assert.match(source, /dismissTopDisclosureOnEscape/);
  assert.match(source, /isOutsideDisclosure/);
  assert.match(source, /setMobileMenuOpen\(false\)/);
  assert.match(source, /本地模式/);
  assert.match(source, /可选云端留存正在规划中/);
});

test('places the mobile menu trigger before its controlled navigation and tracks separate boundaries', () => {
  const menuTriggerIndex = source.indexOf('className="platform-shell__menu-button"');
  const navigationIndex = source.indexOf('id="platform-navigation"');

  assert.notEqual(menuTriggerIndex, -1);
  assert.notEqual(navigationIndex, -1);
  assert.ok(menuTriggerIndex < navigationIndex);
  assert.match(source, /ref=\{menuButtonRef\}/);
  assert.match(source, /ref=\{navigationRegionRef\}/);
  assert.match(source, /ref=\{accountButtonRef\}/);
  assert.match(source, /ref=\{accountPopoverRef\}/);
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

test('keeps fixed-header compensation inside the shell height budget', () => {
  const bodyRule = styles.match(/body\s*\{([^}]*)\}/)?.[1] ?? '';
  const shellRules = [...styles.matchAll(/\.platform-shell\s*\{([^}]*)\}/g)]
    .map(match => match[1]);

  assert.doesNotMatch(bodyRule, /padding-top:/);
  assert.match(shellRules[0] ?? '', /box-sizing:\s*border-box/);
  assert.match(shellRules[0] ?? '', /padding-top:\s*var\(--navbar-height,\s*70px\)/);
  assert.match(shellRules[0] ?? '', /min-height:\s*100vh/);
  assert.match(shellRules[0] ?? '', /min-height:\s*100dvh/);
  assert.match(shellRules[1] ?? '', /padding-top:\s*60px/);
  assert.match(shellRules[1] ?? '', /min-height:\s*100dvh/);
});
