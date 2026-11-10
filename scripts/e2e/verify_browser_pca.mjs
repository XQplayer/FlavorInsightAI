import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const XLSX = require('xlsx');
const playwrightPath = process.env.BROWSER_PCA_PLAYWRIGHT || 'playwright';
const { chromium } = await import(playwrightPath.startsWith('file:') ? playwrightPath : playwrightPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(playwrightPath) ? pathToFileURL(playwrightPath).href : playwrightPath);
const base = process.env.BROWSER_PCA_BASE_URL || 'http://127.0.0.1:5198/FlavorInsightAI/data-analysis/';
const out = path.resolve(process.env.BROWSER_PCA_QA_OUTPUT || '_local/browser-pca-qa');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PCA_CHROME || undefined });
const results = [];
try {
  for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['tablet', { width: 820, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, acceptDownloads: true });
    const page = await context.newPage();
    let localApiCalls = 0;
    const posts = [];
    const workerPaths = [];
    page.on('worker', worker => workerPaths.push(new URL(worker.url()).pathname));
    page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
    await page.route('http://127.0.0.1:8890/**', route => { localApiCalls++; route.abort(); });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /SYNTHETIC R|合成的 R 参考数据/ }).click();
    await page.getByRole('button', { name: /Run browser PCA|运行浏览器 PCA/ }).click();
    await page.getByText(/Calculation complete|计算完成/).waitFor({ timeout: 20000 });
    assert.equal(await page.locator('svg[data-plot]').count(), 1);
    assert.equal(localApiCalls, 0, `${name}: browser path called local API`);
    assert.ok(workerPaths.some(workerPath => workerPath.startsWith('/FlavorInsightAI/') && workerPath.includes('browserPca.worker')), `${name}: Browser PCA Worker not loaded from the deployment base`);
    for (const view of ['scores', 'loadings', 'biplot', 'scree']) {
      await page.getByRole('combobox', { name: /Figure|图表/ }).selectOption(view);
      const plot = JSON.parse(await page.locator('svg[data-plot]').getAttribute('data-plot'));
      assert.equal(plot.view, view);
      assert.ok(plot.totalPoints > 0);
    }
    await page.getByRole('combobox', { name: /Figure|图表/ }).selectOption('scores');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const overflowElements = overflow > 2 ? await page.evaluate(() => [...document.querySelectorAll('*')].filter(element => element.getBoundingClientRect().right > window.innerWidth + 2 && getComputedStyle(element).position !== 'fixed').slice(0, 8).map(element => `${element.tagName}.${element.className?.baseVal ?? element.className}`)) : [];
    assert.ok(overflow <= 2, `${name}: horizontal overflow ${overflow}px; ${overflowElements.join(', ')}`);
    await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
    await page.screenshot({ path: path.join(out, `${name}-synthetic-pca.png`), fullPage: true });
    if (name === 'desktop') {
      const figureButtons = page.locator('figure.analysis-figure button');
      const svgDownload = page.waitForEvent('download');
      await figureButtons.nth(0).click();
      const svg = await svgDownload;
      assert.match(svg.suggestedFilename(), /\.svg$/);
      assert.match(await fs.readFile(await svg.path(), 'utf8'), /synthetic-r-prcomp-6x3-v1/);
      const pngDownload = page.waitForEvent('download', { predicate: download => download.suggestedFilename().endsWith('.png') });
      const metadataDownload = page.waitForEvent('download', { predicate: download => download.suggestedFilename().endsWith('-metadata.json') });
      await figureButtons.nth(1).click();
      const png = await pngDownload;
      assert.match(png.suggestedFilename(), /\.png$/);
      assert.equal((await fs.readFile(await png.path())).subarray(1, 4).toString(), 'PNG');
      const pngMeta = await metadataDownload;
      assert.equal(JSON.parse(await fs.readFile(await pngMeta.path(), 'utf8')).algorithmVersion, '1.0.0');
      const csvDownload = page.waitForEvent('download');
      await page.getByRole('button', { name: /scores CSV/ }).click();
      const csv = await csvDownload;
      assert.match(csv.suggestedFilename(), /\.csv$/);
      assert.match(await fs.readFile(await csv.path(), 'utf8'), /synthetic-s1/);
      const jsonDownload = page.waitForEvent('download');
      await page.getByRole('button', { name: /result JSON|结果 JSON/ }).click();
      const json = await jsonDownload;
      assert.match(json.suggestedFilename(), /\.json$/);
      const archive = JSON.parse(await fs.readFile(await json.path(), 'utf8'));
      assert.equal(archive.schema_version, 'flavor-pca-result/1');
      assert.equal(archive.engine, 'browser-pca');
      assert.equal(archive.scores.values.length, 6);
      assert.equal(archive.dataset_metadata.synthetic, true);
      assert.equal('matrix' in archive.dataset_metadata, false);

      const rows = [['sample', 'group', 'A', 'B'], ['S1', 'G1', 1, 2], ['S2', 'G1', 2, 3], ['S3', 'G2', 4, 2], ['S4', 'G2', 5, 4]];
      const fileInput = page.locator('input[type=file]');
      const importAndRun = async (filename, buffer) => {
        await fileInput.setInputFiles({ name: filename, mimeType: filename.endsWith('csv') ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
        const expectedHash = createHash('sha256').update(buffer).digest('hex');
        await page.locator('code').filter({ hasText: expectedHash }).waitFor();
        await page.getByRole('combobox', { name: /Sample ID\/name|样品 ID\/名称/ }).selectOption('0');
        await page.getByRole('combobox', { name: /Group column|分组列/ }).selectOption('1');
        await page.locator('select[multiple]').selectOption(['2', '3']);
        await page.getByRole('button', { name: /Preview selected matrix|预览选定矩阵/ }).click();
        await page.getByRole('button', { name: /Confirm browser-local dataset|确认浏览器本地数据集/ }).click();
        await page.getByRole('button', { name: /Run browser PCA|运行浏览器 PCA/ }).click();
        await page.getByText(/Calculation complete|计算完成/).waitFor({ timeout: 20000 });
        assert.equal(localApiCalls, 0);
      };
      const csvText = rows.map(row => row.join(',')).join('\n');
      await importAndRun('synthetic.csv', Buffer.from(csvText));
      const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Synthetic');
      await importAndRun('synthetic.xlsx', Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })));
      assert.deepEqual(posts, [], 'browser import/compute must not POST data');
      await page.screenshot({ path: path.join(out, 'desktop-imported-xlsx-pca.png'), fullPage: true });
      const missingRows = rows.map(row => [...row]); missingRows[2][2] = '';
      await fileInput.setInputFiles({ name: 'synthetic-missing.csv', mimeType: 'text/csv', buffer: Buffer.from(missingRows.map(row => row.join(',')).join('\n')) });
      await page.getByRole('combobox', { name: /Sample ID\/name|样品 ID\/名称/ }).selectOption('0');
      await page.getByRole('combobox', { name: /Group column|分组列/ }).selectOption('1');
      await page.locator('select[multiple]').selectOption(['2', '3']);
      await page.getByRole('button', { name: /Preview selected matrix|预览选定矩阵/ }).click();
      await page.getByRole('button', { name: /Confirm browser-local dataset|确认浏览器本地数据集/ }).click();
      await page.getByRole('button', { name: /Run browser PCA|运行浏览器 PCA/ }).click();
      await page.getByRole('alert').filter({ hasText: /Missing values remain|仍有缺失值/ }).waitFor();
      await page.getByRole('combobox', { name: /Missing values|缺失值/ }).selectOption('mean');
      await page.getByRole('button', { name: /Run browser PCA|运行浏览器 PCA/ }).click();
      await page.getByText(/Calculation complete|计算完成/).waitFor();
      assert.deepEqual(posts, [], 'browser import/compute must not POST data');
      await page.screenshot({ path: path.join(out, 'desktop-missing-mean-pca.png'), fullPage: true });
    }
    results.push({ viewport: name, width: viewport.width, localApiCalls, workerPaths, overflow, figures: 4, status: 'PASS' });
    await context.close();
  }
  await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ status: 'PASS', results, screenshots: out }, null, 2));
} finally { await browser.close(); }
