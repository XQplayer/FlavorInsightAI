import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const entry = process.env.BROWSER_PCA_PLAYWRIGHT || 'playwright';
const { chromium } = await import(/^[A-Za-z]:[\\/]/.test(entry) ? pathToFileURL(entry).href : entry);
const base = process.env.BROWSER_PCA_BASE_URL || 'http://127.0.0.1:5210/FlavorInsightAI-BrowserPCA-Preview/data-analysis/';
const out = path.resolve(process.env.BROWSER_PCA_QA_OUTPUT || '_local/browser-pca-qa');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PCA_CHROME || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const requests = [];
  const usage = [];
  page.on('request', request => {
    if (request.method() !== 'POST' || !request.url().includes('/ai/analysis/')) return;
    const body = request.postDataJSON();
    assert.equal('matrix' in (body.inspection || body.facts), false);
    assert.equal('scores' in (body.inspection || body.facts), false);
    requests.push(new URL(request.url()).pathname);
  });
  page.on('response', async response => {
    if (!response.url().includes('/ai/analysis/') || response.status() !== 200) return;
    const body = await response.json().catch(() => ({}));
    if (body.usage) usage.push({ path: new URL(response.url()).pathname, ...body.usage });
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /SYNTHETIC R|合成的 R 参考数据/ }).click();
  await page.getByRole('textbox', { name: /Analysis goal|分析目标/ }).fill('Explore the synthetic groups with centered, UV-scaled PCA. Recommend two components.');
  await page.getByRole('button', { name: /Ask AI for PCA settings|请求 AI 推荐 PCA 参数/ }).click();
  await page.getByRole('button', { name: /Confirm settings and run in browser|确认参数并在浏览器运行/ }).waitFor({ timeout: 90000 });
  assert.equal(await page.getByText(/Mock plan, not GPT|Mock 计划，非 GPT/).count(), 0);
  await page.getByRole('button', { name: /Confirm settings and run in browser|确认参数并在浏览器运行/ }).click();
  await page.getByText(/Calculation complete|计算完成/).waitFor({ timeout: 20000 });
  assert.equal(await page.locator('svg[data-plot]').count(), 1);
  await page.getByRole('button', { name: /Confirm sharing summary and ask AI to explain|确认分享摘要并请求 AI 解读/ }).click();
  await page.getByText(/Agents SAI ·/).waitFor({ timeout: 90000 });
  assert.deepEqual(requests, ['/ai/analysis/plan', '/ai/analysis/explain']);
  const screenshot = path.join(out, 'desktop-agent-live-synthetic.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  console.log(JSON.stringify({ status: 'PASS', mode: 'live-openai-local-gateway', requests, usage, screenshot }));
} finally { await browser.close(); }
