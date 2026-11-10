import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const entry = process.env.BROWSER_PCA_PLAYWRIGHT || 'playwright';
const { chromium } = await import(/^[A-Za-z]:[\\/]/.test(entry) ? pathToFileURL(entry).href : entry);
const preview = process.env.BROWSER_PCA_BASE_URL || 'https://xqplayer.github.io/FlavorInsightAI-BrowserPCA-Preview/data-analysis/';
const formal = 'https://xqplayer.github.io/FlavorInsightAI/';
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PCA_CHROME || undefined });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const externalHosts = new Set();
  page.on('request', request => {
    const host = new URL(request.url()).hostname;
    if (host !== new URL(preview).hostname) externalHosts.add(host);
  });
  await page.goto(preview, { waitUntil: 'domcontentloaded' });
  await page.getByRole('note').filter({ hasText: /Public preview|公开预览/ }).waitFor();
  const registrations = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
  await page.evaluate(() => localStorage.setItem('browser-pca-synthetic-origin-canary', 'synthetic-only'));
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('browser-pca-synthetic-origin-probe', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('canary');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('canary', 'readwrite');
      tx.objectStore('canary').put('synthetic-only', 'marker');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  // A synthetic response on the formal path proves browser-origin sharing without running formal-site code.
  await page.route(`${formal}**`, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>synthetic path probe</title>' }));
  await page.goto(formal, { waitUntil: 'domcontentloaded' });
  const sharedCanary = await page.evaluate(() => localStorage.getItem('browser-pca-synthetic-origin-canary'));
  const sharedIndexedDb = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('browser-pca-synthetic-origin-probe', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const value = await new Promise((resolve, reject) => {
      const request = db.transaction('canary').objectStore('canary').get('marker');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return value;
  });
  await page.evaluate(() => localStorage.removeItem('browser-pca-synthetic-origin-canary'));
  await page.evaluate(() => indexedDB.deleteDatabase('browser-pca-synthetic-origin-probe'));
  assert.equal(new URL(preview).origin, new URL(formal).origin);
  assert.equal(sharedCanary, 'synthetic-only');
  assert.equal(sharedIndexedDb, 'synthetic-only');
  assert.equal(externalHosts.has('flavorthresholddb-api.onrender.com'), false);
  assert.equal([...externalHosts].some(host => host.endsWith('.supabase.co')), false);
  console.log(JSON.stringify({ status: 'PASS', sameOrigin: true, syntheticLocalStorageVisibleAcrossPaths: true, syntheticIndexedDbVisibleAcrossPaths: true,
    previewServiceWorkerRegistrations: registrations, previewExternalHosts: [...externalHosts] }));
  await context.close();
} finally { await browser.close(); }
