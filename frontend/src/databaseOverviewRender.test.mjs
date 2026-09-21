import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('the production database page SSRs distinct embedded home and search views', async t => {
  const vite = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    logLevel: 'silent',
    server: { middlewareMode: true },
    appType: 'custom',
  });
  t.after(() => vite.close());

  const pageModule = await vite.ssrLoadModule('/src/pages/DatabaseOverviewPage.jsx');
  const DatabaseOverviewPage = pageModule.default;
  const sharedProps = {
    onLanguageChange() {},
    onNavigate() {},
  };

  const homeMarkup = renderToStaticMarkup(React.createElement(DatabaseOverviewPage, {
    ...sharedProps,
    initialView: 'home',
    language: 'zh',
  }));
  const searchMarkup = renderToStaticMarkup(React.createElement(DatabaseOverviewPage, {
    ...sharedProps,
    initialView: 'search',
    language: 'en',
  }));

  assert.match(homeMarkup, /class="app-shell embedded home-view"/);
  assert.match(homeMarkup, /FlavorInsight AI · 数据库模块/);
  assert.match(homeMarkup, /<h1>FlavorThresholdDB<\/h1>/);
  assert.match(homeMarkup, /aria-label="数据库数据覆盖"/);
  assert.match(homeMarkup, /数据库实时动态/);
  assert.match(homeMarkup, />数据来源与引用<\/button>/);
  assert.doesNotMatch(homeMarkup, /class="science-nav/);
  assert.doesNotMatch(homeMarkup, /联系我们|Contact us|HXQLab/);

  assert.match(searchMarkup, /class="app-shell embedded search-view"/);
  assert.match(searchMarkup, /Aroma threshold and flavor descriptor search/);
  assert.match(searchMarkup, /id="compound-search"/);
  assert.doesNotMatch(searchMarkup, /class="science-nav/);
  assert.doesNotMatch(searchMarkup, /Contact us|HXQLab/);
});
