import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const runtime = process.env.CODEX_PLAYWRIGHT_PACKAGE
  || 'C:/Users/hanxq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json';
const { chromium } = createRequire(runtime)('playwright');
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5181/FlavorInsightAI/';
const output = resolve(process.env.UI_CAPTURE_DIR || '_local/ui-ux-processing');
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
    await page.goto(new URL('data-processing/', base).href, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Instrument data processing' }).waitFor();
    assert.equal(await page.locator('.shimadzu-workbench-nav a').count(), 3);
    assert.equal(await page.locator('[data-testid="workflow-node"]').count(), 8);
    assert.equal(await page.locator('.shimadzu-workflow').evaluate(element => getComputedStyle(element).visibility), 'visible');
    assert.equal(await page.locator('[data-testid="workflow-node"]').first().evaluate(element => getComputedStyle(element).visibility), 'visible');
    const widthState = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    assert.ok(widthState.scroll <= widthState.client + 1, `${name} page-wide overflow: ${JSON.stringify(widthState)}`);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true, animations: 'disabled' });
    await context.close();
    console.log(`${name}: nav, workflow visibility and responsive width passed`);
  }
} finally {
  await browser.close();
}
