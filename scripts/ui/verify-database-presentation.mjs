import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const { chromium } = createRequire('C:/Users/hanxq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const output = resolve('_local/ui-ux-database');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 375, 812]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    await context.addInitScript(() => {
      localStorage.setItem('flavorinsight:language', 'en');
      localStorage.setItem('flavorinsight:theme', 'light');
    });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:5181/FlavorInsightAI/aroma-threshold/');
    await page.locator('#compound-search').fill('106-30-9');
    await page.getByRole('button', { name: 'Table view' }).click();
    const table = page.locator('.database-summary-view table');
    await table.getByText('106-30-9').waitFor({ state: 'visible', timeout: 20000 });
    assert.equal(await table.locator('tbody tr').count(), 1);
    const overflow = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    assert.equal(overflow[0], overflow[1]);
    await page.screenshot({ path: resolve(output, `${name}-table.png`), fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'Open dossier' }).click();
    assert.equal(await page.getByRole('button', { name: 'Dossier view' }).getAttribute('aria-pressed'), 'true');
    await context.close();
    console.log(`${name}: table and dossier switch passed`);
  }
} finally {
  await browser.close();
}
