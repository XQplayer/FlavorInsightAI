import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { createServer } from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptRoot, '..', '..');
const frontendRoot = path.join(root, 'frontend');
const distRoot = path.join(frontendRoot, 'dist');
const node = process.env.CODEX_E2E_NODE || process.execPath;
const defaultPlaywright = path.resolve(path.dirname(node), '..', 'node_modules', 'playwright', 'index.mjs');
const playwrightModule = process.env.CODEX_E2E_PLAYWRIGHT || pathToFileURL(defaultPlaywright).href;
const { chromium } = await import(playwrightModule);
const viteEntry = path.join(frontendRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const runId = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const screenshotRoot = path.join(root, '_local', 'verification', 'platform-ui', runId);
const resultPath = path.join(screenshotRoot, 'platform-shell-results.json');
const servers = [];
const verificationScope = process.env.CODEX_E2E_SCOPE || 'all';

const ROUTES = Object.freeze([
  { name: 'home', segment: '', heading: /FlavorInsight AI/, title: /^FlavorInsight AI \|/u, lightweight: true },
  { name: 'database', segment: 'database/', heading: /^FlavorThresholdDB$/u, title: /^FlavorThresholdDB 数据库 \|/u },
  { name: 'search', segment: 'aroma-threshold/', heading: /香气阈值与风味描述检索/u, title: /^香气阈值检索 \|/u },
  { name: 'processing', segment: 'data-processing/', heading: /仪器数据处理平台/u, title: /^数据处理 \|/u },
  { name: 'processing-compat', segment: 'shimadzu-analysis/', heading: /仪器数据处理平台/u, title: /^数据处理 \|/u },
  { name: 'analysis', segment: 'data-analysis/', heading: /^数据分析平台$/u, title: /^数据分析 \|/u, lightweight: true },
  { name: 'resources', segment: 'resources/', heading: /^资源中心$/u, title: /^资源中心 \|/u, lightweight: true },
  { name: 'login', segment: 'login/', heading: /^FlavorInsight AI$/u, title: /^账号访问 \|/u, lightweight: true },
]);

const VIEWPORTS = Object.freeze([
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
]);

async function portIsFree(port) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}

async function choosePort(preferred, excluded = new Set()) {
  if (!excluded.has(preferred) && await portIsFree(preferred)) return preferred;
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(error => {
        if (error) reject(error);
        else if (excluded.has(port)) choosePort(preferred, excluded).then(resolve, reject);
        else resolve(port);
      });
    });
  });
}

async function runProcess(command, args, { cwd, env, label }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => {
      stdout += chunk;
      process.stderr.write(`[${label}] ${chunk}`);
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
      process.stderr.write(`[${label}] ${chunk}`);
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`${label} failed (code=${code}, signal=${signal})\n${stderr}`));
    });
  });
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return ({
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.zip': 'application/zip',
  })[extension] || 'application/octet-stream';
}

async function startHttpServer(port, label, handler) {
  const server = createServer((request, response) => {
    Promise.resolve(handler(request, response)).catch(error => {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(`${label}: ${error.message}`);
    });
  });
  await new Promise((resolve, reject) => {
    const onError = error => reject(error);
    server.once('error', onError);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', onError);
      resolve();
    });
  });
  const record = { server, port, label, errors: [] };
  server.on('error', error => record.errors.push(error.message));
  servers.push(record);
  return server;
}

async function startStaticServer(port) {
  return startHttpServer(port, 'static', async (request, response) => {
    const url = new URL(request.url || '/', `http://127.0.0.1:${port}`);
    const decoded = decodeURIComponent(url.pathname);
    const deploymentPrefix = '/FlavorInsightAI/';
    if (!decoded.startsWith(deploymentPrefix)) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(`Not found outside deployment base: ${url.pathname}`);
      return;
    }
    const deployedPath = `/${decoded.slice(deploymentPrefix.length)}`;
    const relativePath = deployedPath.endsWith('/') ? `${deployedPath}index.html` : deployedPath;
    const resolved = path.resolve(distRoot, `.${relativePath}`);
    const relative = path.relative(distRoot, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    try {
      const bytes = await fs.readFile(resolved);
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': contentType(resolved),
      });
      response.end(bytes);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(`Not found: ${url.pathname}`);
    }
  });
}

async function startHealthStub(port) {
  return startHttpServer(port, 'health-stub', async (request, response) => {
    const url = new URL(request.url || '/', `http://127.0.0.1:${port}`);
    const headers = {
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
    };
    if (url.pathname === '/health') {
      response.writeHead(200, headers);
      response.end(JSON.stringify({ status: 'ok', mode: 'platform-e2e-health-stub' }));
      return;
    }
    response.writeHead(404, headers);
    response.end(JSON.stringify({ error: 'not-found' }));
  });
}

async function waitForUrl(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_500) });
      if (response.ok) return;
      lastError = new Error(`${response.status} ${url}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message || 'unknown error'}`);
}

async function waitForPortRelease(port, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await portIsFree(port)) return true;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return false;
}

async function stopServer(record) {
  await new Promise((resolve, reject) => record.server.close(error => error ? reject(error) : resolve()));
  if (!await waitForPortRelease(record.port)) {
    throw new Error(`${record.label} port ${record.port} was not released`);
  }
}

function observePage(page, localOrigins) {
  const observed = {
    requests: [],
    pendingLocalRequests: new Map(),
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    badResponses: [],
  };
  page.on('request', request => {
    observed.requests.push(request.url());
    const requestUrl = new URL(request.url());
    if (localOrigins.has(requestUrl.origin) && requestUrl.pathname !== '/health') {
      observed.pendingLocalRequests.set(
        request.url(),
        (observed.pendingLocalRequests.get(request.url()) || 0) + 1,
      );
    }
  });
  const settleLocalRequest = request => {
    const pending = observed.pendingLocalRequests.get(request.url()) || 0;
    if (pending <= 1) observed.pendingLocalRequests.delete(request.url());
    else observed.pendingLocalRequests.set(request.url(), pending - 1);
  };
  page.on('requestfinished', settleLocalRequest);
  page.on('console', message => {
    if (message.type() === 'error') observed.consoleErrors.push(message.text());
  });
  page.on('pageerror', error => observed.pageErrors.push(error.message));
  page.on('requestfailed', request => {
    settleLocalRequest(request);
    const failure = request.failure()?.errorText || 'unknown failure';
    observed.requestFailures.push(`${request.method()} ${request.url()} :: ${failure}`);
  });
  page.on('response', response => {
    const origin = new URL(response.url()).origin;
    if (localOrigins.has(origin) && response.status() >= 400) {
      observed.badResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  return observed;
}

function assertClean(label, observed) {
  assert.deepEqual(observed.consoleErrors, [], `${label}: console errors`);
  assert.deepEqual(observed.pageErrors, [], `${label}: page errors`);
  assert.deepEqual(observed.requestFailures, [], `${label}: failed requests`);
  assert.deepEqual(observed.badResponses, [], `${label}: bad local responses`);
}

async function assertLayout(page, label) {
  const layout = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    mainCount: document.querySelectorAll('main').length,
    mainIdCount: document.querySelectorAll('#main-content').length,
    title: document.title,
  }));
  assert.ok(layout.title.includes('FlavorInsight AI'), `${label}: route title belongs to the platform`);
  assert.ok(layout.documentWidth <= layout.viewportWidth + 1, `${label}: no page-level horizontal overflow (${layout.documentWidth} > ${layout.viewportWidth})`);
  assert.equal(layout.mainCount, 1, `${label}: exactly one main landmark`);
  assert.equal(layout.mainIdCount, 1, `${label}: exactly one #main-content`);
  return layout;
}

async function waitForStableRoute(page, observed) {
  await page.waitForLoadState('load', { timeout: 60_000 });
  const deadline = Date.now() + 60_000;
  let stableSince = null;
  while (Date.now() < deadline) {
    if (observed.pendingLocalRequests.size === 0) {
      stableSince ??= Date.now();
      if (Date.now() - stableSince >= 500) break;
    } else {
      stableSince = null;
    }
    await page.waitForTimeout(100);
  }
  assert.equal(observed.pendingLocalRequests.size, 0, `local requests settle: ${[...observed.pendingLocalRequests.keys()].join(', ')}`);
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(250);
}

async function assertRouteIdentity(page, route, expectedUrl, label) {
  assert.equal(new URL(page.url()).pathname, new URL(expectedUrl).pathname, `${label}: exact route path`);
  assert.match(await page.title(), route.title, `${label}: route-owned document title`);
  const heading = page.locator('#main-content h1').first();
  assert.match((await heading.innerText()).trim(), route.heading, `${label}: expected primary heading`);
}

function assertLightweightRequests(route, requests, label) {
  if (!route.lightweight) return;
  const forbidden = requests.filter(url => /aroma_data_merged|book_flavor_chemistry_index|references(?:_lookup)?\.json|shimadzu|xlsx|rdkit|3dmol/iu.test(url));
  assert.deepEqual(forbidden, [], `${label}: lightweight route does not load database or processing assets`);
}

async function verifyRoute(browser, viewport, route, baseUrl, proxyOrigin) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  await context.addInitScript(() => {
    localStorage.setItem('flavorinsight:language', 'zh');
    localStorage.setItem('flavorinsight:theme', 'light');
  });
  try {
    const page = await context.newPage();
    const observed = observePage(page, new Set([new URL(baseUrl).origin, proxyOrigin]));
    const url = `${baseUrl}${route.segment}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const heading = page.locator('#main-content h1').first();
    await heading.waitFor({ state: 'visible', timeout: 45_000 });
    await waitForStableRoute(page, observed);
    await assertRouteIdentity(page, route, url, `${viewport.name}/${route.name}`);
    const firstLayout = await assertLayout(page, `${viewport.name}/${route.name}`);

    await page.reload({ waitUntil: 'domcontentloaded' });
    const refreshedHeading = page.locator('#main-content h1').first();
    await refreshedHeading.waitFor({ state: 'visible', timeout: 45_000 });
    await waitForStableRoute(page, observed);
    await assertRouteIdentity(page, route, url, `${viewport.name}/${route.name}/refresh`);
    const refreshedLayout = await assertLayout(page, `${viewport.name}/${route.name}/refresh`);

    const screenshot = path.join(screenshotRoot, viewport.name, `${route.name}.png`);
    await fs.mkdir(path.dirname(screenshot), { recursive: true });
    await page.screenshot({ path: screenshot, fullPage: true });
    assertLightweightRequests(route, observed.requests, `${viewport.name}/${route.name}`);
    assertClean(`${viewport.name}/${route.name}`, observed);
    return {
      route: route.name,
      heading: (await page.locator('#main-content h1').first().innerText()).trim(),
      url: page.url(),
      screenshot,
      firstLayout,
      refreshedLayout,
    };
  } finally {
    await context.close();
  }
}

async function verifyShellInteractions(browser, baseUrl, proxyOrigin) {
  const freshContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const freshPage = await freshContext.newPage();
    await freshPage.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await freshPage.getByRole('heading', { name: 'FlavorInsight AI', exact: true }).waitFor();
    assert.equal(await freshPage.locator('html').getAttribute('lang'), 'en', 'fresh visitors start in English');
    await freshPage.getByRole('link', { name: 'Account status' }).click();
    await freshPage.getByRole('heading', { name: 'Work locally today.' }).waitFor();
    assert.equal(await freshPage.locator('input[type="email"], input[type="password"]').count(), 0, 'account status never requests credentials');
    await freshPage.getByRole('link', { name: 'Continue locally' }).click();
    await freshPage.getByRole('heading', { name: 'FlavorInsight AI', exact: true }).waitFor();
  } finally {
    await freshContext.close();
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    if (!localStorage.getItem('flavorinsight:language')) localStorage.setItem('flavorinsight:language', 'zh');
    if (!localStorage.getItem('flavorinsight:theme')) localStorage.setItem('flavorinsight:theme', 'light');
  });
  try {
    const page = await context.newPage();
    const observed = observePage(page, new Set([new URL(baseUrl).origin, proxyOrigin]));
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('#platform-home-title').waitFor({ state: 'visible' });
    await waitForStableRoute(page, observed);

    await page.keyboard.press('Tab');
    await page.waitForFunction(() => {
      const element = document.querySelector('.platform-shell__skip-link');
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      return document.activeElement === element && rect.top >= 0 && rect.bottom <= window.innerHeight;
    });
    const skipLinkState = await page.locator('.platform-shell__skip-link').evaluate(element => ({
      focused: document.activeElement === element,
      visible: element.getBoundingClientRect().top >= 0
        && element.getBoundingClientRect().bottom <= window.innerHeight
        && element.getBoundingClientRect().width > 0,
      outlined: getComputedStyle(element).outlineStyle !== 'none'
        && Number.parseFloat(getComputedStyle(element).outlineWidth) > 0,
    }));
    assert.deepEqual(skipLinkState, { focused: true, visible: true, outlined: true }, 'skip link receives visible keyboard focus');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#main-content').evaluate(element => document.activeElement === element), true, 'skip link focuses main content');

    await page.locator('button[data-language="en"]').click();
    await page.getByRole('heading', { name: 'FlavorInsight AI', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Theme toggle' }).click();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'FlavorInsight AI', exact: true }).waitFor();
    await waitForStableRoute(page, observed);
    assert.equal(await page.locator('html').getAttribute('lang'), 'en', 'language preference survives refresh');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark', 'theme preference survives refresh');
    await page.getByRole('link', { name: 'Data processing', exact: true }).click();
    await page.getByRole('heading', { name: 'Instrument data processing' }).waitFor({ timeout: 45_000 });
    await waitForStableRoute(page, observed);
    assert.match(page.url(), /\/FlavorInsightAI\/data-processing\/$/);
    assert.equal(await page.getByRole('link', { name: 'Data processing', exact: true }).getAttribute('aria-current'), 'page', 'active desktop route is announced');
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'FlavorInsight AI', exact: true }).waitFor();
    await waitForStableRoute(page, observed);
    assert.equal(new URL(page.url()).pathname, '/FlavorInsightAI/');
    assert.ok(['', '#main-content'].includes(new URL(page.url()).hash), 'history preserves only the intentional skip-link anchor');
    await page.goForward({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Instrument data processing' }).waitFor({ timeout: 45_000 });
    await waitForStableRoute(page, observed);
    assert.match(page.url(), /\/FlavorInsightAI\/data-processing\/$/);
    assertClean('desktop shell interactions', observed);
  } finally {
    await context.close();
  }

  const mobileContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await mobileContext.addInitScript(() => {
    if (!localStorage.getItem('flavorinsight:language')) localStorage.setItem('flavorinsight:language', 'zh');
    if (!localStorage.getItem('flavorinsight:theme')) localStorage.setItem('flavorinsight:theme', 'light');
  });
  try {
    const page = await mobileContext.newPage();
    const observed = observePage(page, new Set([new URL(baseUrl).origin, proxyOrigin]));
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('#platform-home-title').waitFor({ state: 'visible' });
    await waitForStableRoute(page, observed);
    const menu = page.locator('.platform-shell__menu-button');
    assert.equal(await menu.getAttribute('aria-label'), '打开导航菜单', 'mobile menu exposes its closed-state label');
    await menu.focus();
    await page.keyboard.press('Enter');
    assert.equal(await menu.getAttribute('aria-expanded'), 'true', 'mobile menu opens');
    assert.equal(await menu.getAttribute('aria-label'), '关闭导航菜单', 'mobile menu exposes its open-state label');
    const resourcesLink = page
      .getByRole('navigation', { name: '平台主导航' })
      .getByRole('link', { name: '资源中心', exact: true });
    await resourcesLink.waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true, 'open mobile menu does not cause page overflow');
    const menuScreenshot = path.join(screenshotRoot, 'mobile', 'menu-open.png');
    await fs.mkdir(path.dirname(menuScreenshot), { recursive: true });
    await page.screenshot({ path: menuScreenshot, fullPage: false });
    await page.keyboard.press('Escape');
    assert.equal(await menu.getAttribute('aria-expanded'), 'false', 'Escape closes the mobile menu');
    assert.equal(await menu.getAttribute('aria-label'), '打开导航菜单', 'mobile menu restores its closed-state label');
    assert.equal(await menu.evaluate(element => document.activeElement === element), true, 'Escape restores focus to the mobile menu trigger');
    await page.keyboard.press('Enter');
    await resourcesLink.waitFor({ state: 'visible' });
    await resourcesLink.click();
    await page.getByRole('heading', { name: '资源中心', exact: true }).waitFor({ state: 'visible' });
    await waitForStableRoute(page, observed);
    assert.match(page.url(), /\/FlavorInsightAI\/resources\/$/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true, 'mobile navigation does not cause page overflow');
    assertClean('mobile shell interactions', observed);
  } finally {
    await mobileContext.close();
  }
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (firstError) {
    const candidates = [
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
    ];
    for (const executablePath of candidates) {
      try {
        await fs.access(executablePath);
        return await chromium.launch({ headless: true, executablePath });
      } catch {
        // Try the next locally installed browser.
      }
    }
    throw firstError;
  }
}

await fs.mkdir(screenshotRoot, { recursive: true });
const proxyPort = await choosePort(18787);
const staticPort = await choosePort(5175, new Set([proxyPort]));
const proxyOrigin = `http://127.0.0.1:${proxyPort}`;
const baseUrl = `http://127.0.0.1:${staticPort}/FlavorInsightAI/`;
let browser;
let result;
let runError;
let sourceCommit = 'unknown';

try {
  sourceCommit = await runProcess('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    env: process.env,
    label: 'source-commit',
  });
  await runProcess(node, [viteEntry, 'build'], {
    cwd: frontendRoot,
    env: { ...process.env, VITE_FEMA_API_URL: proxyOrigin },
    label: 'vite-build',
  });
  await runProcess(node, [path.join(frontendRoot, 'scripts', 'create-static-routes.mjs')], {
    cwd: frontendRoot,
    env: process.env,
    label: 'static-routes',
  });
  await startHealthStub(proxyPort);
  await startStaticServer(staticPort);
  await waitForUrl(`${proxyOrigin}/health`);
  await waitForUrl(baseUrl);
  browser = await launchBrowser();

  const routeResults = [];
  if (verificationScope !== 'interactions') {
    for (const viewport of VIEWPORTS) {
      for (const route of ROUTES) {
        process.stderr.write(`[platform-e2e] ${viewport.name}/${route.name}\n`);
        routeResults.push(await verifyRoute(browser, viewport, route, baseUrl, proxyOrigin));
      }
    }
  }
  if (verificationScope !== 'routes') {
    process.stderr.write('[platform-e2e] shell interactions\n');
    await verifyShellInteractions(browser, baseUrl, proxyOrigin);
  }
  result = {
    status: 'PASS',
    runId,
    sourceCommit,
    testedAt: new Date().toISOString(),
    verificationScope,
    viewports: VIEWPORTS,
    routes: ROUTES.map(route => route.name),
    routeResults,
    interactions: ['skip-link', 'language-persistence', 'theme-persistence', 'desktop-navigation', 'mobile-navigation'],
    servedFromProductionDist: true,
    ports: { proxyPort, staticPort },
  };
} catch (error) {
  runError = error;
  result = {
    status: 'FAIL',
    runId,
    sourceCommit,
    testedAt: new Date().toISOString(),
    error: error?.stack || String(error),
    servedFromProductionDist: true,
    ports: { proxyPort, staticPort },
  };
} finally {
  const cleanupErrors = [];
  if (browser) {
    try {
      await browser.close();
    } catch (error) {
      cleanupErrors.push(`browser: ${error.message}`);
    }
  }
  for (const record of [...servers].reverse()) {
    if (record.errors.length) cleanupErrors.push(`${record.label}: ${record.errors.join('; ')}`);
    try {
      await stopServer(record);
    } catch (error) {
      cleanupErrors.push(`${record.label}: ${error.message}`);
    }
  }
  result.cleanupErrors = cleanupErrors;
  await fs.writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result, null, 2));
}

if (runError) throw runError;
if (result.cleanupErrors.length) throw new Error(`Platform E2E cleanup failed: ${result.cleanupErrors.join('; ')}`);
