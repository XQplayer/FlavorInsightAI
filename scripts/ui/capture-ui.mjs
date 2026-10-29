import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const runtime = process.env.CODEX_PLAYWRIGHT_PACKAGE
  || 'C:/Users/hanxq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json';
const { chromium } = createRequire(runtime)('playwright');
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5174/FlavorInsightAI/';
const output = resolve(process.env.UI_CAPTURE_DIR || '_local/ui-ux-captures');
const routes = ['home', 'database', 'aroma-threshold', 'data-processing', 'data-analysis', 'resources', 'login'];
const viewports = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
};

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.UI_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
try {
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    await mkdir(resolve(output, viewportName), { recursive: true });
    const context = await browser.newContext({ viewport, colorScheme: 'light' });
    await context.addInitScript(() => {
      localStorage.setItem('flavorinsight:language', 'en');
      localStorage.setItem('flavorinsight:theme', 'light');
    });
    const page = await context.newPage();
    for (const route of routes) {
      const url = new URL(route === 'home' ? '' : `${route}/`, base).href;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.locator('h1').first().waitFor({ state: 'visible', timeout: 15000 });
      await page.screenshot({ path: resolve(output, viewportName, `${route}.png`), fullPage: true, animations: 'disabled' });
      const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      console.log(`${viewportName}/${route}: ${width.scroll}/${width.client}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
