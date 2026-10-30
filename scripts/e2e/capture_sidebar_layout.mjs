import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const frontend = path.join(root, 'frontend');
const node = process.env.CODEX_E2E_NODE || process.execPath;
const playwrightPath = process.env.CODEX_E2E_PLAYWRIGHT
  || pathToFileURL(path.resolve(path.dirname(node), '..', 'node_modules', 'playwright', 'index.mjs')).href;
const { chromium } = await import(playwrightPath);
const phase = process.argv[2] || 'after';
const language = process.env.CAPTURE_LANGUAGE || 'zh';
const theme = process.env.CAPTURE_THEME || 'light';
const widths = (process.env.CAPTURE_WIDTHS || '375,768,1024,1366,1920,2560')
  .split(',').map(Number);
const routes = {
  home: '', database: 'database/', search: 'aroma-threshold/',
  processing: 'data-processing/', analysis: 'data-analysis/',
  resources: 'resources/', login: 'login/',
};
const port = await new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const available = probe.address().port;
    probe.close(error => error ? reject(error) : resolve(available));
  });
});
const baseUrl = `http://127.0.0.1:${port}/FlavorInsightAI/`;
const output = path.join(root, '_local', 'verification', 'sidebar-layout', phase);
await fs.mkdir(output, { recursive: true });

const server = spawn(node, [path.join(frontend, 'node_modules', 'vite', 'bin', 'vite.js'),
  '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: frontend, windowsHide: true, stdio: 'ignore',
});
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) { ready = true; break; }
    } catch { /* Vite is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error('Vite did not start');
  try {
    browser = await chromium.launch({ headless: true });
  } catch (firstError) {
    const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
    try { await fs.access(edge); browser = await chromium.launch({ headless: true, executablePath: edge }); }
    catch { throw firstError; }
  }
  const results = [];
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    await context.addInitScript(preferences => {
      localStorage.setItem('flavorinsight:language', preferences.language);
      localStorage.setItem('flavorinsight:theme', preferences.theme);
    }, { language, theme });
    for (const [name, segment] of Object.entries(routes)) {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${baseUrl}${segment}`, { waitUntil: 'domcontentloaded' });
      await page.locator('#main-content h1').first().waitFor({ state: 'visible', timeout: 45_000 });
      await page.evaluate(() => document.fonts?.ready);
      await page.waitForTimeout(500);
      const metrics = await page.evaluate(() => {
        const rect = selector => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const box = element.getBoundingClientRect();
          return { x: Math.round(box.x), width: Math.round(box.width), right: Math.round(box.right) };
        };
        return {
          viewport: document.documentElement.clientWidth,
          document: document.documentElement.scrollWidth,
          sidebar: rect('.platform-shell__sidebar'),
          main: rect('.platform-shell__main'),
          hero: rect('.fi-home__hero'),
          content: rect('.search-main, .shimadzu-main, .analysis-workbench, .platform-status-page__hero, .platform-login__layout'),
        };
      });
      const screenshot = path.join(output, `${width}-${name}.png`);
      await page.screenshot({ path: screenshot, fullPage: false });
      if (process.env.CAPTURE_DRAWER === '1' && width < 768 && name === 'home') {
        await page.locator('.platform-shell__menu-button').click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(output, `${width}-drawer-open.png`), fullPage: false });
      }
      results.push({ width, route: name, screenshot, metrics, errors });
      console.log(`${phase} ${width} ${name}: ${metrics.document}/${metrics.viewport}`);
      await page.close();
    }
    await context.close();
  }
  await fs.writeFile(path.join(output, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
} finally {
  if (browser) await browser.close();
  server.kill();
}
