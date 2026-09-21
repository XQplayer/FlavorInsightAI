import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptRoot, '..', '..');
const frontendRoot = path.join(root, 'frontend');
const node = process.env.CODEX_E2E_NODE || process.execPath;
const python = process.env.CODEX_E2E_PYTHON
  || path.resolve(path.dirname(node), '..', '..', 'python', 'python.exe');
const defaultPlaywright = path.resolve(path.dirname(node), '..', 'node_modules', 'playwright', 'index.mjs');
const playwrightModule = process.env.CODEX_E2E_PLAYWRIGHT || pathToFileURL(defaultPlaywright).href;
const { chromium } = await import(playwrightModule);
const viteEntry = path.join(frontendRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const screenshotRoot = path.join(root, '_local', 'verification', 'platform-ui');
const resultPath = path.join(screenshotRoot, 'platform-shell-results.json');
const children = [];

const ROUTES = Object.freeze([
  { name: 'home', segment: '', heading: /FlavorInsight AI/ },
  { name: 'database', segment: 'database/', heading: /^FlavorThresholdDB$/ },
  { name: 'search', segment: 'aroma-threshold/', heading: /香气阈值与风味描述检索/ },
  { name: 'processing', segment: 'data-processing/', heading: /仪器数据处理平台/ },
  { name: 'processing-compat', segment: 'shimadzu-analysis/', heading: /仪器数据处理平台/ },
  { name: 'analysis', segment: 'data-analysis/', heading: /^数据分析/ },
  { name: 'resources', segment: 'resources/', heading: /^资源/ },
]);

const VIEWPORTS = Object.freeze([
  { name: 'desktop', width: 1440, height: 900 },
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

function start(command, args, options) {
  const child = spawn(command, args, {
    ...options,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const record = { child, label: options.label, stderr: '', exited: false, error: null };
  child.stdout.on('data', chunk => process.stderr.write(`[${options.label}] ${chunk}`));
  child.stderr.on('data', chunk => {
    record.stderr += chunk;
    process.stderr.write(`[${options.label}] ${chunk}`);
  });
  child.once('error', error => { record.error = error; });
  child.once('exit', (code, signal) => {
    record.exited = true;
    record.exitCode = code;
    record.signal = signal;
  });
  children.push(record);
  return record;
}

async function waitForUrl(url, records, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    for (const record of records) {
      if (record.error) throw record.error;
      if (record.exited) {
        throw new Error(`${record.label} exited before readiness (code=${record.exitCode}, signal=${record.signal})\n${record.stderr}`);
      }
    }
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

async function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null) return true;
  return Promise.race([
    new Promise(resolve => child.once('exit', () => resolve(true))),
    new Promise(resolve => setTimeout(() => resolve(false), timeoutMs)),
  ]);
}

async function stopChild(record) {
  if (!record?.child || record.child.exitCode !== null) return;
  record.child.kill('SIGTERM');
  if (await waitForExit(record.child, 5_000)) return;
  record.child.kill('SIGKILL');
  if (!await waitForExit(record.child, 5_000)) {
    throw new Error(`${record.label} did not exit after SIGKILL`);
  }
}

function observePage(page, localOrigins) {
  const observed = { consoleErrors: [], pageErrors: [], requestFailures: [], badResponses: [] };
  page.on('console', message => {
    if (message.type() === 'error') observed.consoleErrors.push(message.text());
  });
  page.on('pageerror', error => observed.pageErrors.push(error.message));
  page.on('requestfailed', request => {
    const failure = request.failure()?.errorText || 'unknown failure';
    if (failure === 'net::ERR_ABORTED') return;
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
    assert.match((await heading.innerText()).trim(), route.heading, `${viewport.name}/${route.name}: expected primary heading`);
    const firstLayout = await assertLayout(page, `${viewport.name}/${route.name}`);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#main-content h1').first().waitFor({ state: 'visible', timeout: 45_000 });
    const refreshedLayout = await assertLayout(page, `${viewport.name}/${route.name}/refresh`);

    const screenshot = path.join(screenshotRoot, viewport.name, `${route.name}.png`);
    await fs.mkdir(path.dirname(screenshot), { recursive: true });
    await page.screenshot({ path: screenshot, fullPage: true });
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
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const page = await context.newPage();
    const observed = observePage(page, new Set([new URL(baseUrl).origin, proxyOrigin]));
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('#platform-home-title').waitFor({ state: 'visible' });

    await page.keyboard.press('Tab');
    const skipLinkState = await page.locator('.platform-shell__skip-link').evaluate(element => ({
      focused: document.activeElement === element,
      visible: element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0,
    }));
    assert.deepEqual(skipLinkState, { focused: true, visible: true }, 'skip link receives visible keyboard focus');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#main-content').evaluate(element => document.activeElement === element), true, 'skip link focuses main content');

    await page.locator('button[data-language="en"]').click();
    await page.getByRole('heading', { name: /Food Flavor Informatics Platform/ }).waitFor();
    await page.getByRole('button', { name: 'Theme toggle' }).click();
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('html').getAttribute('lang'), 'en', 'language preference survives refresh');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark', 'theme preference survives refresh');
    await page.getByRole('link', { name: 'Data processing', exact: true }).click();
    await page.getByRole('heading', { name: 'Instrument data processing' }).waitFor({ timeout: 45_000 });
    assert.match(page.url(), /\/FlavorThresholdDB\/data-processing\/$/);
    assertClean('desktop shell interactions', observed);
  } finally {
    await context.close();
  }

  const mobileContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
  try {
    const page = await mobileContext.newPage();
    const observed = observePage(page, new Set([new URL(baseUrl).origin, proxyOrigin]));
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    const menu = page.getByRole('button', { name: '打开导航菜单' });
    await menu.click();
    assert.equal(await menu.getAttribute('aria-expanded'), 'true', 'mobile menu opens');
    await page.getByRole('link', { name: '资源中心', exact: true }).click();
    await page.locator('#main-content h1').first().waitFor({ state: 'visible' });
    assert.match(page.url(), /\/FlavorThresholdDB\/resources\/$/);
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
const vitePort = await choosePort(5175, new Set([proxyPort]));
const proxyOrigin = `http://127.0.0.1:${proxyPort}`;
const baseUrl = `http://127.0.0.1:${vitePort}/FlavorThresholdDB/`;
let browser;
let result;
let runError;

try {
  const proxy = start(python, ['fema_proxy_server.py'], {
    cwd: root,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(proxyPort) },
    label: 'proxy',
  });
  const vite = start(node, [viteEntry, '--host', '127.0.0.1', '--port', String(vitePort), '--strictPort'], {
    cwd: frontendRoot,
    env: { ...process.env, VITE_FEMA_API_URL: proxyOrigin },
    label: 'vite',
  });
  await waitForUrl(`${proxyOrigin}/health`, [proxy, vite]);
  await waitForUrl(baseUrl, [proxy, vite]);
  browser = await launchBrowser();

  const routeResults = [];
  for (const viewport of VIEWPORTS) {
    for (const route of ROUTES) {
      routeResults.push(await verifyRoute(browser, viewport, route, baseUrl, proxyOrigin));
    }
  }
  await verifyShellInteractions(browser, baseUrl, proxyOrigin);
  result = {
    status: 'PASS',
    testedAt: new Date().toISOString(),
    viewports: VIEWPORTS,
    routes: ROUTES.map(route => route.name),
    routeResults,
    interactions: ['skip-link', 'language-persistence', 'theme-persistence', 'desktop-navigation', 'mobile-navigation'],
    ports: { proxyPort, vitePort },
  };
} catch (error) {
  runError = error;
  result = {
    status: 'FAIL',
    testedAt: new Date().toISOString(),
    error: error?.stack || String(error),
    ports: { proxyPort, vitePort },
  };
} finally {
  if (browser) await browser.close().catch(() => {});
  const cleanupErrors = [];
  for (const record of [...children].reverse()) {
    try {
      await stopChild(record);
    } catch (error) {
      cleanupErrors.push(error.message);
    }
  }
  result.cleanupErrors = cleanupErrors;
  await fs.writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result, null, 2));
}

if (runError) throw runError;
if (result.cleanupErrors.length) throw new Error(`Platform E2E cleanup failed: ${result.cleanupErrors.join('; ')}`);
