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

test('uses an operable mobile disclosure and account route', () => {
  assert.match(source, /aria-expanded=\{mobileMenuOpen\}/);
  assert.match(source, /dismissTopDisclosureOnEscape/);
  assert.match(source, /isOutsideDisclosure/);
  assert.match(source, /setMobileMenuOpen\(false\)/);
  assert.match(source, /本地模式/);
  assert.match(source, /routeHref\('login', PLATFORM_BASE_PATH\)/);
});

test('places the mobile menu trigger before its controlled navigation and tracks separate boundaries', () => {
  const menuTriggerIndex = source.indexOf('className="platform-shell__menu-button"');
  const navigationIndex = source.indexOf('id="platform-navigation"');

  assert.notEqual(menuTriggerIndex, -1);
  assert.notEqual(navigationIndex, -1);
  assert.ok(menuTriggerIndex < navigationIndex);
  assert.match(source, /ref=\{menuButtonRef\}/);
  assert.match(source, /ref=\{navigationRegionRef\}/);
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
  assert.match(homeSource, /title: 'FlavorInsight AI'/);
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
  assert.match(homeSource, /原始峰表/);
  assert.match(homeSource, /质量门禁/);
  assert.match(homeSource, /审核结果包/);
  assert.match(homeSource, /仪器数据/);
  assert.match(homeSource, /化合物鉴定/);
  assert.match(homeSource, /风味数据库/);
  assert.match(homeSource, /风味贡献评价/);
  assert.match(homeSource, /数据分析与 AI/);
  assert.match(homeSource, /风味贡献评价[^\n]+statuses:\s*\['beta'\]/);
  assert.doesNotMatch(homeSource, /半定量[^\n]+OAV/);
  assert.doesNotMatch(homeSource, /<img\b/i);
});

test('labels capability status without claiming deployed AI', () => {
  assert.match(homeSource, /已上线/);
  assert.match(homeSource, /测试中/);
  assert.match(homeSource, /开发中/);
  assert.match(homeSource, /规划中/);
  assert.match(homeSource, /Available/);
  assert.match(homeSource, /Beta/);
  assert.match(homeSource, /当前未部署生产级 AI 模型/);
  assert.match(homeSource, /No production AI model is deployed/);
  assert.doesNotMatch(homeSource, /AI(?:模型)?已上线|AI (?:prediction|model) is (?:live|available)/i);
  assert.doesNotMatch(homeSource, /用户数量|使用次数|客户评价|users trust|testimonials?/i);
});

test('includes four factual FAQs, platform principles, and a compact footer', () => {
  assert.match(homeSource, /证据可追溯/);
  assert.match(homeSource, /Traceable evidence/);
  assert.match(homeSource, /质量门禁/);
  assert.match(homeSource, /Quality gates/);
  assert.match(homeSource, /本地优先/);
  assert.match(homeSource, /Local-first/);
  assert.match(homeSource, /标准化导出/);
  assert.match(homeSource, /Standardized export/);
  assert.match(homeSource, /多仪器与 AI/);
  assert.equal((homeSource.match(/<details\b/g) ?? []).length, 4);
  assert.match(homeSource, /当前支持哪些仪器/);
  assert.match(homeSource, /数据库信息来自哪里/);
  assert.match(homeSource, /<footer\b/);
  assert.match(homeSource, /v1\.5\.0/);
  assert.match(homeSource, /mailto:hanxq888@gmail\.com/);
  assert.match(homeSource, /引用说明/);
  assert.match(homeSource, /隐私说明/);
  assert.match(homeSource, /routeHref\('resources',/);
});

test('keeps the homepage responsive and motion restrained', () => {
  assert.match(pageStyles, /overflow-x:\s*(?:clip|hidden)/);
  assert.match(pageStyles, /min-height:\s*clamp\(520px,[^;]+650px\)/);
  assert.match(pageStyles, /animation-duration:\s*(?:[34]\d{2}|500)ms/);
  assert.match(pageStyles, /font-size:\s*clamp\([^;]+56px\)/);
  assert.match(pageStyles, /font-size:\s*32px/);
  assert.match(pageStyles, /@media \(max-width:\s*1024px\)/);
  assert.match(pageStyles, /@media \(max-width:\s*768px\)/);
  assert.match(pageStyles, /@media \(max-width:\s*420px\)/);
  assert.match(pageStyles, /@media \(min-width:\s*1440px\)/);
  assert.match(pageStyles, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(pageStyles, /animation:\s*none\s*!important/);
});

test('presents data analysis as a bilingual future capability without fake controls', () => {
  assert.match(analysisSource, /usePlatformPreferences/);
  assert.match(analysisSource, /title: '数据分析平台'/);
  assert.match(analysisSource, /title: 'Data analysis platform'/);
  assert.match(analysisSource, /建设中/);
  assert.match(analysisSource, /待开发/);
  assert.match(analysisSource, /In development/);
  assert.match(analysisSource, /标准数据包/);
  assert.match(analysisSource, /standard data package/i);

  for (const feature of [
    '质量摘要',
    'PCA',
    'HCA',
    '热图',
    '差异化合物',
    'OAV',
    '风味类别',
    '结构相似性',
    '未知物辅助鉴定',
    '风味预测',
  ]) {
    assert.match(analysisSource, new RegExp(feature));
  }

  assert.match(analysisSource, /status:\s*'building'/);
  assert.match(analysisSource, /status:\s*'planned'/);
  assert.match(analysisSource, /routeHref\('processing',\s*PLATFORM_BASE_PATH\)/);
  assert.doesNotMatch(analysisSource, /<main\b/i);
  assert.doesNotMatch(analysisSource, /<input\b|type=['"]file['"]|<button\b/i);
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
  assert.match(platformAppSource, /import DataAnalysisPage from ['"]\.\.\/pages\/DataAnalysisPage\.jsx['"]/);
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
