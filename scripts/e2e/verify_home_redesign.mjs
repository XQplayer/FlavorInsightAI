import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const node = process.env.CODEX_E2E_NODE || process.execPath;
const defaultPlaywright = path.resolve(path.dirname(node), '..', 'node_modules', 'playwright', 'index.mjs');
const { chromium } = await import(process.env.CODEX_E2E_PLAYWRIGHT || pathToFileURL(defaultPlaywright).href);
const baseUrl = process.env.HOME_VERIFY_URL || 'http://127.0.0.1:5174/FlavorInsightAI/';
const output = path.join(root, '_local', 'verification', 'home-redesign');
const cases = [
  ...[375, 768, 1024, 1366, 1920, 2560].map(width => ({ width, language: 'zh', theme: 'light' })),
  { width: 375, language: 'en', theme: 'dark' },
  { width: 1920, language: 'en', theme: 'dark' },
];

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
        // Try the next browser.
      }
    }
    throw originalError;
  }
}

await fs.mkdir(output, { recursive: true });
const browser = await launchBrowser();
const results = [];
try {
  for (const scenario of cases) {
    const context = await browser.newContext({
      viewport: { width: scenario.width, height: 900 },
      deviceScaleFactor: 1,
      colorScheme: scenario.theme,
      reducedMotion: 'reduce',
    });
    await context.addInitScript(preferences => {
      localStorage.setItem('flavorinsight:language', preferences.language);
      localStorage.setItem('flavorinsight:theme', preferences.theme);
    }, scenario);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('.fi-home__hero h1').waitFor({ state: 'visible' });
    await page.locator('.fi-home img').evaluateAll(async images => {
      await Promise.all(images.map(async image => {
        image.loading = 'eager';
        await image.decode();
      }));
    });
    const metrics = await page.evaluate(() => {
      const box = selector => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return { x: rect.x, right: rect.right, width: rect.width, y: rect.y, bottom: rect.bottom };
      };
      return {
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        theme: document.documentElement.dataset.theme,
        main: box('.platform-shell__main'),
        hero: box('.fi-home__hero'),
        copy: box('.fi-home__hero-copy'),
        preview: box('.fi-home__preview'),
        sections: [...document.querySelectorAll('.fi-home > section, .fi-home > aside, .fi-home > footer')]
          .map(element => element.className),
        previewImagesReady: [...document.querySelectorAll('.fi-home__preview img')]
          .every(image => image.complete && image.naturalWidth > 0),
      };
    });
    assert.equal(metrics.document, metrics.viewport, scenario.width + 'px: no page overflow');
    assert.equal(metrics.theme, scenario.theme, scenario.width + 'px: theme preference');
    assert.equal(metrics.sections.length, 8, scenario.width + 'px: all home sections');
    assert.ok(metrics.previewImagesReady, scenario.width + 'px: preview assets load');
    assert.equal(await page.locator('.fi-home__faq details').count(), 4);
    assert.ok(metrics.hero.width >= metrics.main.width - 82, scenario.width + 'px: hero uses workspace width');
    if (scenario.width >= 1366) {
      assert.ok(metrics.preview.x >= metrics.copy.right - 1, scenario.width + 'px: hero columns do not overlap');
    } else {
      assert.ok(metrics.preview.y >= metrics.copy.bottom - 1, scenario.width + 'px: hero stacks vertically');
    }
    const faq = page.locator('#home-faq-ai');
    await page.getByRole('link', { name: scenario.language === 'zh' ? '查看当前状态' : 'View current status' }).click();
    assert.equal(await faq.evaluate(element => element.open), true);
    await page.evaluate(() => window.scrollTo(0, 0));
    const screenshot = path.join(output, scenario.width + '-' + scenario.language + '-' + scenario.theme + '.png');
    await page.screenshot({ path: screenshot, fullPage: true });
    if (scenario.width === 1920 && scenario.language === 'zh') {
      await page.getByRole('link', { name: /开始数据处理/ }).first().click();
      assert.match(page.url(), /data-processing\/$/);
      await page.goBack();
      await page.getByRole('link', { name: /进入 FlavorThresholdDB/ }).first().click();
      assert.match(page.url(), /database\/$/);
    }
    assert.deepEqual(errors, [], scenario.width + 'px: no browser exceptions');
    results.push({ ...scenario, ...metrics, screenshot, errors });
    console.log(scenario.width + 'px ' + scenario.language + ' ' + scenario.theme + ': PASS');
    await context.close();
  }
} finally {
  await browser.close();
}
await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2) + '\n');
console.log('Home redesign visual and interaction checks passed.');
