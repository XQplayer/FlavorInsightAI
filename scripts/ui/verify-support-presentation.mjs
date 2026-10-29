import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const runtime = process.env.CODEX_PLAYWRIGHT_PACKAGE
  || 'C:/Users/hanxq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json';
const { chromium } = createRequire(runtime)('playwright');
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5181/FlavorInsightAI/';
const output = resolve(process.env.UI_CAPTURE_DIR || '_local/ui-ux-support');
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
    await page.goto(new URL('resources/', base).href, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Resources', exact: true }).waitFor();
    assert.equal(await page.locator('.platform-resources__workflow-list li').count(), 5);
    assert.equal(await page.locator('.platform-resources__verified-card').count(), 5);
    let size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    assert.ok(size.scroll <= size.client + 1, `${name} resources overflow: ${JSON.stringify(size)}`);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: resolve(output, `${name}-resources.png`), fullPage: true, animations: 'disabled' });
    await page.goto(new URL('login/', base).href, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'FlavorInsight AI' }).waitFor();
    await page.getByText('Account service is not enabled in this local deployment.').waitFor();
    size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    assert.ok(size.scroll <= size.client + 1, `${name} login overflow: ${JSON.stringify(size)}`);
    await page.screenshot({ path: resolve(output, `${name}-login.png`), fullPage: true, animations: 'disabled' });
    await page.getByRole('link', { name: 'Continue locally' }).click();
    await page.getByRole('heading', { name: /FlavorInsight AI/i }).first().waitFor();
    await context.close();
    console.log(`${name}: resources, login and responsive width passed`);
  }
} finally {
  await browser.close();
}
