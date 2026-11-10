import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const entry = process.env.BROWSER_PCA_PLAYWRIGHT || 'playwright';
const { chromium } = await import(/^[A-Za-z]:[\\/]/.test(entry) ? pathToFileURL(entry).href : entry);
const base = process.env.BROWSER_PCA_BASE_URL || 'http://127.0.0.1:5210/FlavorInsightAI-BrowserPCA-Preview/data-analysis/';
const apiBase = process.env.BROWSER_PCA_AI_BASE_URL || 'http://127.0.0.1:8787';
const out = path.resolve(process.env.BROWSER_PCA_QA_OUTPUT || '_local/browser-pca-qa');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PCA_CHROME || undefined });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  let plans = 0, explanations = 0, workerCount = 0;
  let invalidPlan = false, networkFailure = false;
  page.on('worker', () => workerCount++);
  await page.route(`${apiBase}/ai/**`, async route => {
    const request = route.request();
    const headers = { 'Access-Control-Allow-Origin': new URL(base).origin, 'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Content-Type': 'application/json' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (request.url().endsWith('/session')) return route.fulfill({ status: 200, headers, body: JSON.stringify({ mode: 'mock', identity: 'local_mock' }) });
    if (request.url().endsWith('/plan')) {
      plans++;
      if (networkFailure) return route.abort('failed');
      const body = request.postDataJSON();
      assert.equal(body.inspection.dataset_id, 'synthetic-r-prcomp-6x3-v1');
      assert.equal('matrix' in body.inspection, false);
      assert.equal('samples' in body.inspection, true);
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ mode: 'mock', requires_user_confirmation: true,
        plan: { schema_version: 'flavor-pca-plan/1', algorithm: 'pca', dataset_id: invalidPlan ? 'wrong-dataset' : body.inspection.dataset_id,
          options: { missing: 'error', constant: 'error', center: true, scale: 'uv', components: 2, includeInternalStandards: false } } }) });
    }
    if (request.url().endsWith('/explain')) {
      explanations++;
      const body = request.postDataJSON();
      assert.equal('scores' in body.facts, false);
      assert.equal('matrix' in body.facts, false);
      assert.equal(body.facts.explained_variance.length, 2);
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ mode: 'mock', source: 'client-validated-browser-pca-summary', explanation: '【本地 Mock，非 GPT 回答】PCA 是探索性分析。' }) });
    }
    return route.fulfill({ status: 404, headers, body: '{}' });
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /SYNTHETIC R|合成的 R 参考数据/ }).click();
  await page.getByRole('textbox', { name: /Analysis goal|分析目标/ }).fill('Explore group structure with PCA');
  await page.getByRole('button', { name: /Ask AI for PCA settings|请求 AI 推荐 PCA 参数/ }).click();
  await page.getByRole('button', { name: /Confirm settings and run in browser|确认参数并在浏览器运行/ }).waitFor();
  assert.equal(workerCount, 0, 'plan alone must not run Worker');
  await page.getByRole('button', { name: /Confirm settings and run in browser|确认参数并在浏览器运行/ }).click();
  await page.getByText(/Calculation complete|计算完成/).waitFor();
  assert.equal(workerCount, 1);
  await page.getByRole('button', { name: /Confirm sharing summary and ask AI to explain|确认分享摘要并请求 AI 解读/ }).click();
  await page.getByText(/本地 Mock，非 GPT 回答/).last().waitFor();
  assert.equal(plans, 1); assert.equal(explanations, 1);
  await page.screenshot({ path: path.join(out, 'desktop-agent-mock-confirmed.png'), fullPage: true });
  invalidPlan = true;
  await page.getByRole('button', { name: /Ask AI for PCA settings|请求 AI 推荐 PCA 参数/ }).click();
  await page.getByRole('alert').filter({ hasText: /DATASET_MISMATCH/ }).waitFor();
  assert.equal(workerCount, 1, 'invalid plan must not start Worker');
  networkFailure = true;
  await page.getByRole('button', { name: /Ask AI for PCA settings|请求 AI 推荐 PCA 参数/ }).click();
  await page.getByRole('alert').waitFor();
  assert.equal(workerCount, 1);
  console.log(JSON.stringify({ status: 'PASS', mode: 'intercepted-mock-network', plans, explanations, workerCount, screenshot: path.join(out, 'desktop-agent-mock-confirmed.png') }));
  await context.close();
} finally { await browser.close(); }
