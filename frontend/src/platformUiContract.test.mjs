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
  new URL('./pages/PlatformHomeV2.jsx', import.meta.url),
  'utf8',
).catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error));
const pageStyles = await readFile(
  new URL('./pages/PlatformPages.css', import.meta.url),
  'utf8',
).catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error));
const homeStyles = await readFile(new URL('./pages/PlatformHomeV2.css', import.meta.url), 'utf8');
const analysisSource = await readFile(
  new URL('./pages/DataAnalysisPage.jsx', import.meta.url),
  'utf8',
).catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error));
const resourcesSource = await readFile(
  new URL('./pages/ResourcesPage.jsx', import.meta.url),
  'utf8',
).catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error));
const platformAppSource = await readFile(
  new URL('./app/PlatformApp.jsx', import.meta.url),
  'utf8',
);
const loginSource = await readFile(
  new URL('./pages/PlatformLoginPage.jsx', import.meta.url),
  'utf8',
).catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error));
const preferenceSource = await readFile(new URL('./app/platformPreferences.js', import.meta.url), 'utf8');

test('defaults to English and provides an honest account-status route', () => {
  assert.match(preferenceSource, /DEFAULT_LANGUAGE = 'en'/);
  assert.match(platformAppSource, /login: 'Account access \| FlavorInsight AI'/);
  assert.match(platformAppSource, /route === 'login'/);
  assert.match(source, /routeHref\('login', PLATFORM_BASE_PATH\)/);
  assert.match(loginSource, /Continue locally/);
  assert.match(loginSource, /继续本地使用/);
  assert.doesNotMatch(loginSource, /<input|type="submit"|type="password"/);
});

test('provides a skip link and a labelled main landmark', () => {
  assert.match(source, /href="#main-content"/);
  assert.match(source, /<main[^>]*id="main-content"/);
});

test('defines the six platform destinations and labels', () => {
  const navigation = source.match(/const NAV_ITEMS = Object\.freeze\(\[[\s\S]*?\]\);/)?.[0] ?? '';
  const destinations = [
    ['home', '首页', 'Home'],
    ['database', 'FlavorThresholdDB', 'FlavorThresholdDB'],
    ['processing', '数据处理', 'Data processing'],
    ['analysis', '数据分析', 'Data analysis'],
    ['models', '智能模型', 'AI Models'],
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
  for (const icon of ['House', 'Database', 'PanelsTopLeft', 'ChartNoAxesCombined', 'BrainCircuit', 'BookOpen', 'Menu', 'Moon', 'Sun', 'UserRound', 'X']) {
    assert.match(source, new RegExp(`\\b${icon}\\b`));
  }
  assert.doesNotMatch(source, /[\u{1F300}-\u{1FAFF}]/u);
});

test('drives the theme control from the provider resolved theme', () => {
  assert.match(source, /resolvedTheme/);
  assert.match(source, /darkThemeActive = resolvedTheme === 'dark'/);
  assert.match(source, /setTheme\(nextThemePreference\(resolvedTheme\)\)/);
  assert.doesNotMatch(source, /darkThemeActive = theme === 'dark'/);
});

test('uses an operable mobile drawer and account route', () => {
  assert.match(source, /aria-expanded=\{mobileMenuOpen\}/);
  assert.match(source, /className="platform-shell__scrim"/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /event\.key !== 'Tab'/);
  assert.match(source, /menuButtonRef\.current\?\.focus\(\)/);
  assert.match(source, /aria-modal=\{mobileViewport && mobileMenuOpen/);
  assert.match(source, /inert=\{mobileViewport && !mobileMenuOpen/);
  assert.match(source, /setMobileMenuOpen\(false\)/);
  assert.match(source, /本地模式/);
  assert.match(source, /routeHref\('login', PLATFORM_BASE_PATH\)/);
});

test('connects the mobile trigger and collapse button to the shared navigation', () => {
  assert.match(source, /id="platform-navigation"/);
  assert.match(source, /aria-controls="platform-navigation"/);
  assert.match(source, /className="platform-shell__sidebar"/);
  assert.match(source, /className="platform-shell__menu-button"/);
  assert.match(source, /ref=\{menuButtonRef\}/);
  assert.match(source, /ref=\{sidebarRef\}/);
  assert.match(source, /ref=\{drawerCloseRef\}/);
});

test('keeps the fixed sidebar accessible and responsive', () => {
  assert.match(styles, /grid-template-columns:\s*var\(--shell-sidebar-width\) minmax\(0,\s*1fr\)/);
  assert.match(styles, /--shell-sidebar-width:\s*256px/);
  assert.match(styles, /--shell-sidebar-width:\s*72px/);
  assert.match(styles, /height:\s*100dvh/);
  assert.match(styles, /min-(?:height|width):\s*var\(--control-height,\s*44px\)/);
  assert.match(styles, /@media \(max-width:\s*767px\)/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /scroll-margin-top:/);
  assert.doesNotMatch(styles, /overflow-x:\s*(?:clip|hidden)/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)/);
});

test('removes legacy top-nav compensation without changing the global container token', () => {
  const bodyRule = styles.match(/body\s*\{([^}]*)\}/)?.[1] ?? '';
  const shellRules = [...styles.matchAll(/\.platform-shell\s*\{([^}]*)\}/g)]
    .map(match => match[1]);

  assert.doesNotMatch(bodyRule, /padding-top:/);
  assert.match(shellRules[0] ?? '', /box-sizing:\s*border-box/);
  assert.match(shellRules[0] ?? '', /--navbar-height:\s*0px/);
  assert.doesNotMatch(shellRules[0] ?? '', /padding-top:/);
  assert.match(shellRules[0] ?? '', /min-height:\s*100vh/);
  assert.match(shellRules[0] ?? '', /min-height:\s*100dvh/);
  assert.match(styles, /\.platform-shell__utility-header\s*\{/);
  assert.doesNotMatch(styles, /--container-max:\s*100%/);
});

test('presents bilingual evidence-led identity in a clear entry hero', () => {
  assert.match(homeSource, /usePlatformPreferences/);
  assert.match(homeSource, /FlavorInsight AI/);
  assert.match(homeSource, /Make flavor data interpretable research evidence/);
  assert.match(homeSource, /让风味数据成为可解释的科研证据/);
  assert.match(homeStyles, /\.fi-home__hero\s*\{[^}]*background:/s);
  assert.match(homeStyles, /\.fi-home__hero\s*\{[^}]*border-radius:/s);
});

test('uses three real product screenshots rather than decorative metrics', () => {
  for (const asset of ['product-search-preview', 'product-processing-preview', 'product-analysis-preview']) {
    assert.match(homeSource, new RegExp(asset + '\\.png'));
  }
  assert.match(homeSource, /CAS 106-30-9/);
  assert.match(homeSource, /<img\b/);
  assert.doesNotMatch(homeSource, /<svg\b|platform-home__trajectory/);
});

test('uses one sidebar across all routes while the home hero fills the remaining area', () => {
  assert.match(source, /<aside[\s\S]*className="platform-shell__sidebar"/);
  assert.match(source, /<main className="platform-shell__main"/);
  assert.match(styles, /\.platform-shell__main-area\s*\{[^}]*grid-column:\s*2/s);
  assert.match(homeStyles, /\.fi-home__hero\s*\{[^}]*width:\s*100%/s);
  assert.doesNotMatch(source, /platform-shell--brand|platform-shell--home/);
});

test('exposes real database, search, and processing destinations', () => {
  for (const route of ['database', 'search', 'processing']) {
    assert.match(homeSource, new RegExp(`route: '${route}'|route="${route}"`));
  }
  assert.match(homeSource, /typeof onNavigate !== 'function'/);
});

test('keeps a three-step research workflow explicit without inventing scientific results', () => {
  for (const step of ['导入数据', '处理与校核', '分析与导出']) {
    assert.match(homeSource, new RegExp(step));
  }
  assert.equal((homeSource.match(/enBody: '.*', zhBody:/g) ?? []).length >= 3, true);
  assert.doesNotMatch(homeSource, /半定量[^\n]+OAV/);
});

test('labels capability status without claiming deployed AI', () => {
  assert.match(homeSource, /已上线/);
  assert.match(homeSource, /测试中/);
  assert.match(homeSource, /规划中/);
  assert.match(homeSource, /Available/);
  assert.match(homeSource, /Beta/);
  assert.match(homeSource, /尚未部署生产级 AI 鉴定或风味预测模型/);
  assert.match(homeSource, /No production AI identification or flavor-prediction model is deployed/);
  assert.doesNotMatch(homeSource, /AI(?:模型)?已上线|AI (?:prediction|model) is (?:live|available)/i);
  assert.doesNotMatch(homeSource, /用户数量|使用次数|客户评价|users trust|testimonials?/i);
});

test('keeps four concise FAQ answers and a factual footer', () => {
  assert.equal((homeSource.match(/<details\b/g) ?? []).length, 1);
  assert.equal((homeSource.match(/id: '(?:instruments|privacy|sources|ai)'/g) ?? []).length, 4);
  assert.match(homeSource, /<footer\b/);
  assert.match(homeSource, /mailto:hanxq888@gmail\.com/);
  assert.match(homeSource, /route="resources"/);
});

test('keeps the homepage responsive and motion restrained', () => {
  assert.match(homeStyles, /@container \(max-width: 1050px\)/);
  assert.match(homeStyles, /@media \(max-width: 767px\)/);
  assert.match(homeStyles, /@container \(max-width: 430px\)/);
  assert.match(homeStyles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(homeStyles, /:focus-visible/);
  assert.match(homeStyles, /--home-gutter:\s*clamp\(20px,\s*2vw,\s*40px\)/);
  assert.match(homeStyles, /width:\s*min\(100%,\s*1840px\)/);
  assert.doesNotMatch(homeStyles, /transform:\s*scale\(/);
});

test('offers a real bilingual local analysis workbench without claiming deployed prediction', () => {
  assert.match(analysisSource, /usePlatformPreferences/);
  for (const component of ['ImportPanel','GroupEditor','RecipePanel','AnalysisPanel','ResultsPanel']) assert.match(analysisSource,new RegExp(component));
  assert.match(analysisSource, /Data & groups/);
  assert.match(analysisSource, /数据与分组/);
  assert.match(analysisSource, /SYNTHETIC example \(not scientific evidence\)/);
  assert.match(analysisSource, /no production AI model is deployed/);
  assert.match(analysisSource, /role="tablist"/);
  assert.match(analysisSource, /ArrowLeft/);
  assert.match(analysisSource, /Export portable project/);
  assert.doesNotMatch(analysisSource, /<main\b/i);
  assert.doesNotMatch(analysisSource, /用户数量|使用次数|客户评价|production AI (?:is live|is available)/i);
});

test('offers only verified resources and keeps pending resources non-interactive', () => {
  assert.match(resourcesSource, /usePlatformPreferences/);
  assert.match(resourcesSource, /资源中心/);
  assert.match(resourcesSource, /Resources/);
  assert.match(resourcesSource, /VERIFIED_RESOURCES\.map\([\s\S]*?<a\b[\s\S]*?href=\{resource\.href\}/);
  assert.match(resourcesSource, /PLANNED_RESOURCES\.map\([\s\S]*?<article\b/);

  for (const verifiedPath of [
    'Shimadzu_Raw_Workbook_Example.xlsx',
    'Shimadzu_Sample_Internal_Standard_Template.xlsx',
    'docs/DATA_DICTIONARY.md',
    'docs/DATA_SOURCES.md',
    'CHANGELOG.md',
  ]) {
    assert.match(resourcesSource, new RegExp(verifiedPath.replaceAll('.', '\\.')));
  }

  for (const plannedResource of [
    '分析流程与 SOP',
    '标准数据包字段字典',
    '半定量、阈值选择与 OAV 规则',
    '结果包解释',
  ]) {
    assert.match(resourcesSource, new RegExp(plannedResource));
  }

  assert.match(resourcesSource, /待开放/);
  assert.match(resourcesSource, /Coming later/);
  const plannedRenderStart = resourcesSource.indexOf('{PLANNED_RESOURCES.map');
  const plannedRenderEnd = resourcesSource.indexOf('</section>', plannedRenderStart);
  assert.notEqual(plannedRenderStart, -1);
  assert.notEqual(plannedRenderEnd, -1);
  assert.doesNotMatch(
    resourcesSource.slice(plannedRenderStart, plannedRenderEnd),
    /<a\b|<button\b|onClick=/i,
  );
  assert.doesNotMatch(resourcesSource, /<main\b/i);
  assert.doesNotMatch(resourcesSource, /用户数量|使用次数|客户评价|AI 用户|testimonials?/i);
});

test('routes analysis and resources through their real pages with owned titles', () => {
  assert.match(platformAppSource, /const DataAnalysisPage = lazy\(\(\) => import\(['"]\.\.\/pages\/DataAnalysisPage\.jsx['"]\)\)/);
  assert.match(platformAppSource, /import ResourcesPage from ['"]\.\.\/pages\/ResourcesPage\.jsx['"]/);
  assert.match(platformAppSource, /route === 'analysis'[\s\S]*?<DataAnalysisPage\s+onNavigate=\{onNavigate\}/);
  assert.match(platformAppSource, /route === 'resources'[\s\S]*?<ResourcesPage\s*\/>/);
  assert.doesNotMatch(platformAppSource, /function PlannedRoute\b|<PlannedRoute\b/);
  assert.match(platformAppSource, /analysis:\s*'数据分析 \| FlavorInsight AI'/);
  assert.match(platformAppSource, /resources:\s*'资源中心 \| FlavorInsight AI'/);
  assert.match(platformAppSource, /analysis:\s*'Data Analysis \| FlavorInsight AI'/);
  assert.match(platformAppSource, /resources:\s*'Resources \| FlavorInsight AI'/);
});

test('styles status pages with platform tokens and responsive grids', () => {
  assert.match(pageStyles, /\.platform-status-page\s*\{/);
  assert.match(pageStyles, /\.platform-status-page__feature-grid\s*\{/);
  assert.match(pageStyles, /\.platform-resources__verified-grid\s*\{/);
  assert.match(pageStyles, /\.platform-resources__planned-card\s*\{/);
  assert.match(pageStyles, /var\(--surface-panel\)/);
  assert.match(pageStyles, /var\(--border-default\)/);
  assert.doesNotMatch(pageStyles, /\.platform-status-page__boundary\s*\{[^}]*border-left:\s*[2-9]px/s);
  assert.match(pageStyles, /@media \(max-width:\s*768px\)[\s\S]*\.platform-status-page__feature-grid/);
});
