import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const runtime = process.env.CODEX_PLAYWRIGHT_PACKAGE
  || 'C:/Users/hanxq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json';
const { chromium } = createRequire(runtime)('playwright');
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5181/FlavorInsightAI/';
const output = resolve(process.env.UI_CAPTURE_DIR || '_local/ui-ux-analysis');
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.UI_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});

try {
  for (const [name, width, height, theme] of [
    ['desktop', 1440, 900, 'light'],
    ['mobile', 375, 812, 'light'],
    ['desktop-dark', 1440, 900, 'dark'],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme });
    await context.addInitScript(selectedTheme => {
      localStorage.setItem('flavorinsight:language', 'en');
      localStorage.setItem('flavorinsight:theme', selectedTheme);
    }, theme);
    const page = await context.newPage();
    await page.goto(new URL('data-analysis/', base).href, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Data analysis' }).waitFor();
    assert.equal(await page.getByRole('tab').count(), 4);
    assert.equal(await page.getByRole('tab', { name: '01 Data & groups' }).getAttribute('aria-selected'), 'true');
    await page.getByRole('button', { name: /Load SYNTHETIC example/ }).click();
    await page.getByRole('button', { name: 'Export portable project' }).waitFor();
    await page.getByRole('tab', { name: '02 Preprocess' }).click();
    assert.equal(await page.getByRole('tab', { name: '02 Preprocess' }).getAttribute('aria-selected'), 'true');
    await page.getByRole('tab', { name: '03 Analysis' }).click();
    await page.getByRole('tab', { name: '04 Results' }).click();
    await page.getByRole('tab', { name: '01 Data & groups' }).click();
    const widthState = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    assert.ok(widthState.scroll <= widthState.client + 1, `${name} page-wide overflow: ${JSON.stringify(widthState)}`);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true, animations: 'disabled' });
    await context.close();
    console.log(`${name}: tabs, synthetic context and responsive width passed`);
  }
} finally {
  await browser.close();
}
