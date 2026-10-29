import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const runtime = process.env.CODEX_PLAYWRIGHT_PACKAGE
  || 'C:/Users/hanxq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json';
const { chromium } = createRequire(runtime)('playwright');
const root = process.env.SHIMADZU_FIXTURE_ROOT;
assert.ok(root, 'Set SHIMADZU_FIXTURE_ROOT to the read-only regression fixture folder');
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5180/FlavorInsightAI/';
const output = resolve(process.env.UI_CAPTURE_DIR || '_local/ui-ux-processing-workflow');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.UI_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await context.addInitScript(() => {
    localStorage.setItem('flavorinsight:language', 'en');
    localStorage.setItem('flavorinsight:theme', 'light');
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(new URL('data-processing/', base).href, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Instrument data processing' }).waitFor();
  await page.getByRole('checkbox', { name: /Enable CAS structural classification/ }).uncheck();
  await page.getByRole('checkbox', { name: /Enable water detection thresholds/ }).uncheck();
  const fileInputs = page.locator('input[type="file"]');
  await fileInputs.nth(0).setInputFiles(join(root, 'CT&JX1-3.xlsx'));
  await fileInputs.nth(1).setInputFiles(join(root, 'CT&JX1-3样品与内标信息.xlsx'));
  await page.getByRole('button', { name: /Start analysis|Run analysis|开始分析/ }).click();
  await page.locator('.shimadzu-job-bar .shimadzu-job-badge.complete').waitFor({ timeout: 240000 });
  const resultLink = page.getByRole('link', { name: 'Download result package' });
  const downloadPromise = page.waitForEvent('download');
  await resultLink.click();
  const download = await downloadPromise;
  const target = join(output, download.suggestedFilename().replace(/[^a-zA-Z0-9._-]/g, '_'));
  await download.saveAs(target);
  const bytes = await readFile(target);
  assert.ok(bytes.length > 1000, 'result package must be nonempty');
  assert.deepEqual(pageErrors, []);
  await page.screenshot({ path: join(output, 'complete.png'), fullPage: true, animations: 'disabled' });
  console.log(`PASS Shimadzu browser workflow: complete; result ZIP ${bytes.length} bytes; no page errors`);
  await context.close();
} finally {
  await browser.close();
}
