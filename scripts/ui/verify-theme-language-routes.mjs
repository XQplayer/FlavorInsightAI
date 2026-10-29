import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const runtime = process.env.CODEX_PLAYWRIGHT_PACKAGE
  || 'C:/Users/hanxq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json';
const { chromium } = createRequire(runtime)('playwright');
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5180/FlavorInsightAI/';
const routes = ['', 'database/', 'aroma-threshold/', 'data-processing/', 'data-analysis/', 'resources/', 'login/'];
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.UI_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});

try {
  for (const [language, theme, width] of [
    ['en', 'light', 1440],
    ['zh', 'light', 375],
    ['en', 'dark', 375],
    ['zh', 'dark', 1440],
  ]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await context.addInitScript(({ language: nextLanguage, theme: nextTheme }) => {
      localStorage.setItem('flavorinsight:language', nextLanguage);
      localStorage.setItem('flavorinsight:theme', nextTheme);
    }, { language, theme });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const route of routes) {
      await page.goto(new URL(route, base).href, { waitUntil: 'domcontentloaded' });
      await page.locator('h1').first().waitFor();
      const state = await page.evaluate(() => ({
        language: document.documentElement.lang,
        theme: document.documentElement.dataset.theme,
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      assert.equal(state.language, language === 'zh' ? 'zh-CN' : 'en', `${route} language`);
      assert.equal(state.theme, theme, `${route} theme`);
      assert.ok(state.scroll <= state.client + 1, `${route} page-wide overflow: ${JSON.stringify(state)}`);
    }
    assert.deepEqual(errors, [], `${language}/${theme} page errors`);
    await context.close();
    console.log(`PASS ${language}/${theme}/${width}: ${routes.length} routes, reduced motion and no page-wide overflow`);
  }
} finally {
  await browser.close();
}
