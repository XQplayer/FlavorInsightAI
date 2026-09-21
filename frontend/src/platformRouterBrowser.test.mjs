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
  await page.getByRole('link', { name: /进入数据库/ }).first().click();
  await page.waitForURL('**/FlavorThresholdDB/database/');
  await page.getByRole('heading', { name: 'FlavorThresholdDB', exact: true }).waitFor();
  await page.goBack();
  await page.waitForURL(baseUrl);
  await page.getByRole('heading', {
    name: 'FlavorInsight AI 食品风味信息学智能分析平台',
  }).waitFor();

  const listenerState = await page.evaluate(() => ({
    active: window.__platformPopstateTracker.active(),
    added: window.__platformPopstateTracker.added,
    removed: window.__platformPopstateTracker.removed,
  }));
  assert.equal(listenerState.active, 1);
  assert.ok(listenerState.added >= 2);
  assert.ok(listenerState.removed >= 1);

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
