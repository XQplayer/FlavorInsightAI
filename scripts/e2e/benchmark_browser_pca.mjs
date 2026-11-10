import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const entry = process.env.BROWSER_PCA_PLAYWRIGHT || 'playwright';
const { chromium } = await import(entry.startsWith('file:') ? entry : entry.startsWith('/') || /^[A-Za-z]:[\\/]/.test(entry) ? pathToFileURL(entry).href : entry);
const base = process.env.BROWSER_PCA_BASE_URL || 'http://127.0.0.1:5198/FlavorInsightAI/data-analysis/';
const out = path.resolve(process.env.BROWSER_PCA_QA_OUTPUT || '_local/browser-pca-qa');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PCA_CHROME || undefined });
try {
  const page = await browser.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(async () => {
    const { createBrowserPcaEngine } = await import('/FlavorInsightAI/src/analysis/browserPcaEngine.mjs');
    const sizes = [[24, 8], [200, 40], [500, 100], [1000, 100]];
    const cases = [];
    let lastDataset;
    for (const [samples, features] of sizes) {
      const dataset = {
        id: `synthetic-benchmark-${samples}x${features}`, name: 'SYNTHETIC benchmark',
        samples: Array.from({ length: samples }, (_, i) => ({ id: `s${i}`, group: i % 2 ? 'B' : 'A' })),
        features: Array.from({ length: features }, (_, j) => ({ id: `f${j}`, unit: 'a.u.' })),
        matrix: Array.from({ length: samples }, (_, i) => Array.from({ length: features }, (_, j) => Math.sin((i + 1) * (j + 2) * 0.017) + (i % 7) * 0.03 + j * 0.001)),
        provenance: { source: 'deterministic synthetic benchmark', formula: 'sin((i+1)*(j+2)*0.017)+(i%7)*0.03+j*0.001' }
      };
      lastDataset = dataset;
      const engine = createBrowserPcaEngine();
      const start = performance.now();
      let ticks = 0;
      const timer = setInterval(() => ticks++, 16);
      const fit = await engine.run({ dataset, options: { components: 2 } });
      clearInterval(timer);
      cases.push({ samples, features, milliseconds: Math.round(performance.now() - start), mainThreadTicks: ticks,
        rank: fit.data.rank, explainedFirst: fit.data.explained[0], workerReleased: !engine.active });
    }
    const controller = new AbortController();
    const cancellable = createBrowserPcaEngine();
    const interrupted = cancellable.run({ dataset: lastDataset, options: { components: 2 } }, { signal: controller.signal });
    setTimeout(() => controller.abort(), 10);
    let cancellation = 'unexpected success';
    try { await interrupted; } catch (error) { cancellation = error.message; }
    return { browser: navigator.userAgent, engine: 'browser-pca@1.0.0', cases, cancellation, cancelledWorkerReleased: !cancellable.active };
  });
  if (result.cancellation !== 'PCA_CANCELLED' || !result.cancelledWorkerReleased) throw new Error('Browser Worker cancellation failed');
  await fs.writeFile(path.join(out, 'benchmark.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
