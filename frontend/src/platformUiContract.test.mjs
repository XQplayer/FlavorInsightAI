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
const homeSource = await readFile(
  new URL('./pages/PlatformHomePage.jsx', import.meta.url),
  'utf8',
).catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error));
const pageStyles = await readFile(
  new URL('./pages/PlatformPages.css', import.meta.url),
  'utf8',
).catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error));

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

test('presents the approved bilingual evidence-led platform identity', () => {
  assert.match(homeSource, /usePlatformPreferences/);
  assert.match(homeSource, /FlavorInsight AI 食品风味信息学智能分析平台/);
  assert.match(homeSource, /FlavorInsight AI Food Flavor Informatics Platform/);
  assert.match(homeSource, /从仪器信号到可解释的风味证据/);
  assert.match(homeSource, /From instrumental signals to interpretable flavor evidence/);
  assert.match(homeSource, /可追溯/);
  assert.match(homeSource, /traceable/i);
});

test('exposes real database, search, and processing destinations', () => {
  for (const route of ['database', 'search', 'processing']) {
    assert.match(homeSource, new RegExp(`routeHref\\('${route}',`));
    assert.match(homeSource, new RegExp(`handleNavigation\\(event, '${route}'\\)`));
  }
  assert.match(homeSource, /typeof onNavigate === 'function'/);
});

test('renders the real capability preview and complete honest research chain', () => {
  assert.match(homeSource, /platform-home__capability-preview/);
  assert.match(homeSource, /乙酸乙酯/);
  assert.match(homeSource, /141-78-6/);
  assert.match(homeSource, /仪器数据/);
  assert.match(homeSource, /化合物鉴定/);
  assert.match(homeSource, /风味数据库/);
  assert.match(homeSource, /风味贡献评价/);
  assert.match(homeSource, /AI 解析与预测/);
  assert.doesNotMatch(homeSource, /<img\b/i);
});

test('labels capability status without claiming deployed AI', () => {
  assert.match(homeSource, /已上线/);
  assert.match(homeSource, /开发中/);
  assert.match(homeSource, /规划中/);
  assert.match(homeSource, /当前未部署生产级 AI 模型/);
  assert.match(homeSource, /No production AI model is deployed/);
  assert.doesNotMatch(homeSource, /AI(?:模型)?已上线|AI (?:prediction|model) is (?:live|available)/i);
  assert.doesNotMatch(homeSource, /用户数量|使用次数|客户评价|users trust|testimonials?/i);
});

test('includes four factual FAQs, platform principles, and a compact footer', () => {
  assert.match(homeSource, /证据可追溯/);
  assert.match(homeSource, /质量门禁/);
  assert.match(homeSource, /本地优先/);
  assert.match(homeSource, /标准化导出/);
  assert.equal((homeSource.match(/<details\b/g) ?? []).length, 4);
  assert.match(homeSource, /<footer\b/);
  assert.match(homeSource, /v1\.5\.0/);
  assert.match(homeSource, /mailto:hanxq888@gmail\.com/);
});

test('keeps the homepage responsive and motion restrained', () => {
  assert.match(pageStyles, /overflow-x:\s*(?:clip|hidden)/);
  assert.match(pageStyles, /min-height:\s*clamp\(520px,[^;]+650px\)/);
  assert.match(pageStyles, /animation-duration:\s*(?:[34]\d{2}|500)ms/);
  assert.match(pageStyles, /@media \(max-width:\s*1024px\)/);
  assert.match(pageStyles, /@media \(max-width:\s*768px\)/);
  assert.match(pageStyles, /@media \(max-width:\s*420px\)/);
  assert.match(pageStyles, /@media \(min-width:\s*1440px\)/);
  assert.match(pageStyles, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(pageStyles, /animation:\s*none\s*!important/);
});
