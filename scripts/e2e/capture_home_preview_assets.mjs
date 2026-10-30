import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const output = path.join(root, 'frontend', 'public', 'assets');
const node = process.env.CODEX_E2E_NODE || process.execPath;
const defaultPlaywright = path.resolve(path.dirname(node), '..', 'node_modules', 'playwright', 'index.mjs');
const { chromium } = await import(process.env.CODEX_E2E_PLAYWRIGHT || pathToFileURL(defaultPlaywright).href);
const baseUrl = process.env.HOME_PREVIEW_URL || 'http://127.0.0.1:5174/FlavorInsightAI/';

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (originalError) {
    for (const executablePath of [
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    ]) {
      try {
        await fs.access(executablePath);
        return await chromium.launch({ headless: true, executablePath });
      } catch {
        // Try the next installed Chromium binary.
      }
    }
    throw originalError;
  }
}

await fs.mkdir(output, { recursive: true });
const browser = await launchBrowser();
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 1,
  colorScheme: 'light',
  reducedMotion: 'reduce',
});
await context.addInitScript(() => {
  localStorage.setItem('flavorinsight:language', 'zh');
  localStorage.setItem('flavorinsight:theme', 'light');
});

try {
  const search = await context.newPage();
  await search.goto(baseUrl + 'aroma-threshold/', { waitUntil: 'domcontentloaded' });
  await search.locator('.search-input').fill('106-30-9');
  await search.getByText('庚酸乙酯', { exact: false }).first().waitFor({ state: 'visible', timeout: 30_000 });
  await search.screenshot({
    path: path.join(output, 'product-search-preview.png'),
    clip: { x: 284, y: 320, width: 1250, height: 580 },
  });
  await search.close();

  const processing = await context.newPage();
  await processing.goto(baseUrl + 'data-processing/', { waitUntil: 'domcontentloaded' });
  await processing.locator('.shimadzu-main').waitFor({ state: 'visible' });
  await processing.screenshot({
    path: path.join(output, 'product-processing-preview.png'),
    clip: { x: 284, y: 250, width: 1250, height: 610 },
  });
  await processing.close();

  const analysis = await context.newPage();
  await analysis.goto(baseUrl + 'data-analysis/', { waitUntil: 'domcontentloaded' });
  await analysis.locator('.analysis-service-card .is-ready').waitFor({ state: 'visible', timeout: 20_000 });
  await analysis.getByRole('button', { name: /加载合成示例/ }).click();
  await analysis.locator('#analysis-tab-analysis').click();
  await analysis.getByRole('button', { name: '运行分析' }).click();
  await analysis.locator('.analysis-visualizations').waitFor({ state: 'visible', timeout: 90_000 });
  await analysis.locator('.analysis-figure').first().scrollIntoViewIfNeeded();
  await analysis.evaluate(() => window.scrollBy(0, -70));
  await analysis.screenshot({
    path: path.join(output, 'product-analysis-preview.png'),
    clip: { x: 284, y: 88, width: 1250, height: 700 },
  });
  await analysis.close();
  console.log('Captured real compound search, processing UI and a clearly labelled synthetic analysis result.');
} finally {
  await context.close();
  await browser.close();
}
