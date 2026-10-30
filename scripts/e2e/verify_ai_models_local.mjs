import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const node = process.execPath;
const modulePath = process.env.CODEX_E2E_PLAYWRIGHT
  ?? pathToFileURL(path.resolve(path.dirname(node), '..', 'node_modules', 'playwright', 'index.mjs')).href;
const { chromium } = await import(modulePath);
const output = path.resolve('_local', 'verification', 'ai-models');
const url = 'http://127.0.0.1:5174/FlavorInsightAI/ai-models/';
await fs.mkdir(output, { recursive: true });

let browser;
try {
  browser = await chromium.launch({ headless: true });
} catch (firstError) {
  for (const executablePath of [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ]) {
    try {
      await fs.access(executablePath);
      browser = await chromium.launch({ headless: true, executablePath });
      break;
    } catch {
      // Continue to another already installed browser.
    }
  }
  if (!browser) throw firstError;
}
try {
  for (const width of [375, 1920]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(() => {
      localStorage.setItem('flavorinsight:language', 'en');
      localStorage.setItem('flavorinsight:theme', 'dark');
    });
    try {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'AI Model Studio' }).waitFor();
      await page.getByRole('tab', { name: 'Model Training' }).click();
      assert.equal(await page.getByRole('button', { name: 'Start training' }).isDisabled(), true);
      const layout = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        theme: document.documentElement.dataset.theme,
      }));
      assert.ok(layout.document <= layout.viewport + 1, `${width}px: no horizontal overflow`);
      assert.equal(layout.theme, 'dark');
      await page.screenshot({ path: path.join(output, `models-training-en-dark-${width}.png`), fullPage: true });
      await page.goto('http://127.0.0.1:5174/FlavorInsightAI/', { waitUntil: 'domcontentloaded' });
      await page.locator('.fi-home__feature--models .fi-home__feature-link').click();
      assert.match(page.url(), /\/FlavorInsightAI\/ai-models\/$/);
      await page.goBack();
      assert.match(page.url(), /\/FlavorInsightAI\/$/);
      await page.goForward();
      assert.match(page.url(), /\/FlavorInsightAI\/ai-models\/$/);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
process.stdout.write(`English/dark Model Studio checked at 375px and 1920px: ${output}\n`);
