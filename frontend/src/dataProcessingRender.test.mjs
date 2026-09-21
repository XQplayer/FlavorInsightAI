import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import React from 'react';
import { renderToReadableStream } from 'react-dom/server.edge';
import { createServer } from 'vite';

test('the production processing page renders on the Edge server without duplicate shell landmarks', async t => {
  const previousWindow = globalThis.window;
  const storage = { getItem: () => null, setItem() {} };
  globalThis.window = {
    location: { hash: '', origin: 'https://example.test' },
    localStorage: storage,
    matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  };

  const vite = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    logLevel: 'silent',
    server: { middlewareMode: true },
    appType: 'custom',
  });

  t.after(async () => {
    await vite.close();
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });

  const pageModule = await vite.ssrLoadModule('/src/pages/DataProcessingPage.jsx');
  const stream = await renderToReadableStream(React.createElement(pageModule.default, {
    language: 'en',
    theme: 'dark',
    onNavigate() {},
  }));
  const markup = await new Response(stream).text();

  assert.match(markup, /class="shimadzu-page is-embedded"/);
  assert.match(markup, /data-theme="dark"/);
  assert.match(markup, /data-language="en"/);
  assert.match(markup, /Instrument data processing/);
  assert.match(markup, /aria-labelledby="analysis-output-configuration-title"/);
  assert.match(markup, /aria-labelledby="data-import-preflight-title"/);
  assert.match(markup, /aria-labelledby="process-monitor-results-title"/);
  assert.doesNotMatch(markup, /class="shimadzu-header"/);
  assert.doesNotMatch(markup, /<main\b/);
  assert.doesNotMatch(markup, /逐步复核|mode="step"/);
});
