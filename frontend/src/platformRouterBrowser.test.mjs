import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

import { createServer } from 'vite';

const frontendRoot = path.resolve(import.meta.dirname, '..');
const playwrightPath = path.resolve(
  path.dirname(process.execPath),
  '..',
  'node_modules',
  'playwright',
  'index.mjs',
);
const edgeCandidates = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];

async function findEdge() {
  for (const candidate of edgeCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next standard Edge installation path.
    }
  }
  return null;
}

async function assertSinglePlatformLandmarks(page) {
  assert.equal(await page.locator('main').count(), 1);
  assert.equal(await page.locator('#main-content').count(), 1);
  assert.equal(await page.locator('a[href="#main-content"]').count(), 1);
}

test('Edge smoke covers click, popstate cleanup, and a rejected lazy route', {
  timeout: 45_000,
}, async t => {
  const edgePath = await findEdge();
  if (!edgePath) {
    t.skip('Microsoft Edge is not installed');
    return;
  }
  try {
    await access(playwrightPath);
  } catch {
    t.skip('Bundled Playwright is not available');
    return;
  }
  const { chromium } = await import(pathToFileURL(playwrightPath).href);

  const previousSupabaseUrl = process.env.VITE_SUPABASE_URL;
  const previousSupabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  process.env.VITE_SUPABASE_URL = 'https://flavorinsight-browser-test.invalid';
  process.env.VITE_SUPABASE_ANON_KEY = 'browser-test-anon-key';
  t.after(() => {
    if (previousSupabaseUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = previousSupabaseUrl;
    if (previousSupabaseAnonKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
    else process.env.VITE_SUPABASE_ANON_KEY = previousSupabaseAnonKey;
  });

  const vite = await createServer({
    root: frontendRoot,
    configFile: path.join(frontendRoot, 'vite.config.js'),
    logLevel: 'silent',
    server: {
      host: '127.0.0.1',
      port: 0,
    },
  });
  await vite.listen();
  t.after(() => vite.close());

  const address = vite.httpServer.address();
  assert.equal(typeof address, 'object');
  const baseUrl = `http://127.0.0.1:${address.port}/FlavorThresholdDB/`;
  const browser = await chromium.launch({
    executablePath: edgePath,
    headless: true,
  });
  t.after(() => browser.close());

  const page = await browser.newPage();
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (!url.startsWith('https://flavorinsight-browser-test.invalid/')) {
        return originalFetch(input, init);
      }
      const headers = { 'Content-Type': 'application/json' };
      if (url.includes('/rest/v1/search_stats')) {
        return new Response(JSON.stringify([{
          cas: '141-78-6',
          common_name: 'Ethyl acetate',
          chinese_name: '乙酸乙酯',
          search_count: 12,
          last_searched_at: '2026-09-21T00:00:00.000Z',
        }]), { status: 200, headers });
      }
      if (url.includes('/rest/v1/rpc/get_analytics_summary')) {
        return new Response(JSON.stringify({
          total_visits: 24,
          total_searches: 12,
          today_searches: 3,
        }), { status: 200, headers });
      }
      return new Response('null', { status: 200, headers });
    };

    const originalAdd = window.addEventListener.bind(window);
    const originalRemove = window.removeEventListener.bind(window);
    const listeners = new Set();
    window.__platformPopstateTracker = {
      added: 0,
      removed: 0,
      active: () => listeners.size,
    };
    window.addEventListener = (type, listener, options) => {
      if (type === 'popstate') {
        window.__platformPopstateTracker.added += 1;
        listeners.add(listener);
      }
      return originalAdd(type, listener, options);
    };
    window.removeEventListener = (type, listener, options) => {
      if (type === 'popstate') {
        window.__platformPopstateTracker.removed += 1;
        listeners.delete(listener);
      }
      return originalRemove(type, listener, options);
    };
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', {
    name: 'FlavorInsight AI 食品风味信息学智能分析平台',
  }).waitFor();
  assert.equal(await page.title(), 'FlavorInsight AI | 食品风味信息学智能分析平台');
  await assertSinglePlatformLandmarks(page);
  const platformNavigation = page.getByRole('navigation', { name: '平台主导航' });
  await platformNavigation.getByRole('link', { name: '数据处理', exact: true }).click();
  await page.waitForURL('**/FlavorThresholdDB/data-processing/');
  await page.getByRole('heading', { name: '岛津风味数据分析控制舱', exact: true }).waitFor();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.title(), '数据处理 | FlavorInsight AI');
  await platformNavigation.getByRole('link', { name: '首页', exact: true }).click();
  await page.waitForURL(baseUrl);
  await page.getByRole('heading', {
    name: 'FlavorInsight AI 食品风味信息学智能分析平台',
  }).waitFor();
  assert.equal(await page.title(), 'FlavorInsight AI | 食品风味信息学智能分析平台');

  await page.getByRole('link', { name: /进入数据库/ }).first().click();
  await page.waitForURL('**/FlavorThresholdDB/database/');
  await page.getByRole('heading', { name: 'FlavorThresholdDB', exact: true }).waitFor();
  assert.equal(await page.title(), 'FlavorThresholdDB 数据库 | FlavorInsight AI');
  await assertSinglePlatformLandmarks(page);

  await page.locator('button[data-language="en"]').click();
  assert.equal(await page.title(), 'FlavorThresholdDB Database | FlavorInsight AI');
  await page.locator('button[data-language="zh"]').click();
  assert.equal(await page.title(), 'FlavorThresholdDB 数据库 | FlavorInsight AI');

  const insight = page.getByRole('button', { name: /Ethyl acetate/ });
  await insight.waitFor();
  await insight.click();
  await page.waitForURL('**/FlavorThresholdDB/aroma-threshold/');
  const compoundSearch = page.locator('#compound-search');
  await compoundSearch.waitFor();
  assert.equal(await compoundSearch.inputValue(), '141-78-6');
  await page.getByText('CAS 141-78-6', { exact: true }).first().waitFor();
  assert.equal(await page.title(), '香气阈值检索 | FlavorInsight AI');
  await assertSinglePlatformLandmarks(page);

  await platformNavigation.getByRole('link', { name: 'FlavorThresholdDB', exact: true }).click();
  await page.waitForURL('**/FlavorThresholdDB/database/');
  await page.getByRole('heading', { name: 'FlavorThresholdDB', exact: true }).waitFor();
  await assertSinglePlatformLandmarks(page);
  await page.getByRole('button', { name: '开启风味探索之旅' }).click();
  await page.waitForURL('**/FlavorThresholdDB/aroma-threshold/');
  assert.equal(await page.locator('#compound-search').inputValue(), '141-78-6');
  await assertSinglePlatformLandmarks(page);

  await page.goBack();
  await page.waitForURL('**/FlavorThresholdDB/database/');
  await page.goBack();
  await page.waitForURL('**/FlavorThresholdDB/aroma-threshold/');
  await page.goBack();
  await page.waitForURL('**/FlavorThresholdDB/database/');
  await page.goBack();
  await page.waitForURL(baseUrl);
  await page.getByRole('heading', { name: 'FlavorInsight AI 食品风味信息学智能分析平台' }).waitFor();
  assert.equal(await page.title(), 'FlavorInsight AI | 食品风味信息学智能分析平台');
  await assertSinglePlatformLandmarks(page);

  const listenerState = await page.evaluate(() => ({
    active: window.__platformPopstateTracker.active(),
    added: window.__platformPopstateTracker.added,
    removed: window.__platformPopstateTracker.removed,
  }));
  assert.equal(listenerState.active, 1);
  assert.ok(listenerState.added >= 2);
  assert.ok(listenerState.removed >= 1);

  const standalonePage = await browser.newPage();
  await standalonePage.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await standalonePage.getByRole('heading', {
    name: 'FlavorInsight AI 食品风味信息学智能分析平台',
  }).waitFor();
  await standalonePage.evaluate(async () => {
    const [React, ReactDom, shimadzuModule] = await Promise.all([
      import('/FlavorThresholdDB/node_modules/.vite/deps/react.js'),
      import('/FlavorThresholdDB/node_modules/.vite/deps/react-dom_client.js'),
      import('/FlavorThresholdDB/src/components/shimadzu/ShimadzuAnalysisPage.jsx'),
    ]);
    const standaloneRoot = document.createElement('div');
    standaloneRoot.id = 'standalone-root';
    document.body.replaceChildren(standaloneRoot);
    document.title = 'Standalone harness';
    ReactDom.default.createRoot(standaloneRoot).render(
      React.default.createElement(shimadzuModule.default, { onHome() {} }),
    );
  });
  await standalonePage.getByRole('heading', {
    name: '岛津风味数据分析控制舱',
    exact: true,
  }).waitFor();
  await standalonePage.waitForFunction(() => document.title === '岛津气质分析 | HXQLab');
  assert.equal(await standalonePage.title(), '岛津气质分析 | HXQLab');

  const rejectionPage = await browser.newPage();
  let rejectedImports = 0;
  await rejectionPage.route('**/src/App.jsx*', async route => {
    rejectedImports += 1;
    await route.abort('failed');
  });
  await rejectionPage.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await rejectionPage.getByRole('link', { name: /进入数据库/ }).first().click();
  await rejectionPage.waitForURL('**/FlavorThresholdDB/database/');

  const alert = rejectionPage.getByRole('alert');
  await alert.waitFor();
  await rejectionPage.getByRole('navigation', { name: '平台主导航' }).waitFor();
  const homeLink = alert.getByRole('link', { name: '返回首页' });
  assert.equal(await homeLink.getAttribute('href'), '/FlavorThresholdDB/');
  assert.ok(rejectedImports >= 1);

  const reloadNavigation = rejectionPage.waitForEvent('framenavigated');
  await alert.getByRole('button', { name: '重新加载' }).click();
  await reloadNavigation;
  await rejectionPage.getByRole('alert').waitFor();
  await rejectionPage.getByRole('alert').getByRole('link', { name: '返回首页' }).click();
  await rejectionPage.waitForURL(baseUrl);
  await rejectionPage.getByRole('heading', {
    name: 'FlavorInsight AI 食品风味信息学智能分析平台',
  }).waitFor();
});
