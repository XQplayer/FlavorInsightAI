import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const { chromium } = createRequire('C:/Users/hanxq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const output = resolve(process.env.UI_PRODUCT_PREVIEW || 'frontend/public/assets/product-search-preview.png');
await mkdir(dirname(output), { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, colorScheme: 'light' });
  await context.addInitScript(() => {
    localStorage.setItem('flavorinsight:language', 'en');
    localStorage.setItem('flavorinsight:theme', 'light');
  });
  const page = await context.newPage();
  await page.goto(process.env.UI_BASE_URL || 'http://127.0.0.1:5174/FlavorInsightAI/aroma-threshold/', { waitUntil: 'domcontentloaded' });
  await page.locator('#compound-search').fill('106-30-9');
  await page.getByText('Ethyl heptanoate', { exact: true }).first().waitFor({ state: 'visible', timeout: 20000 });
  await page.getByText('Ethyl heptanoate', { exact: true }).first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: output, animations: 'disabled' });
  console.log(output);
} finally {
  await browser.close();
}
