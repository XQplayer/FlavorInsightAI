import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  const appModule = await vite.ssrLoadModule('/src/App.jsx');
  const DatabaseOverviewPage = pageModule.default;
  const DatabaseApp = appModule.default;
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
  const standaloneSearchMarkup = renderToStaticMarkup(React.createElement(DatabaseApp, {
    initialView: 'search',
    language: 'en',
  }));

  assert.match(homeMarkup, /class="app-shell embedded home-view"/);
  assert.match(homeMarkup, /科研工作台/);
  assert.match(homeMarkup, /<h1 lang="zh-CN">探索风味化合物的科学证据<\/h1>/);
  assert.match(homeMarkup, /id="database-overview-query"/);
  assert.match(homeMarkup, /示例记录 · 字段预览/);
  assert.doesNotMatch(homeMarkup, /aria-label="数据库数据覆盖"|从化合物到可引用记录/);
  assert.match(homeMarkup, /id="database-activity"/);
  assert.match(homeMarkup, /访问与化合物检索统计/);
  assert.match(homeMarkup, /累计访问|Total visits/);
  assert.doesNotMatch(homeMarkup, /compound-treemap--unavailable/);
  assert.equal((homeMarkup.match(/<main\b/g) ?? []).length, 0);
  assert.match(homeMarkup, />数据来源与引用<\/button>/);
  assert.doesNotMatch(homeMarkup, /class="science-nav/);
  assert.doesNotMatch(homeMarkup, /联系我们|Contact us|HXQLab/);

  assert.match(searchMarkup, /class="app-shell embedded search-view"/);
  assert.match(searchMarkup, /Aroma threshold and flavor descriptor search/);
  assert.match(searchMarkup, /id="compound-search"/);
  assert.doesNotMatch(searchMarkup, /class="science-nav/);
  assert.doesNotMatch(searchMarkup, /Contact us|HXQLab/);
  assert.equal((searchMarkup.match(/<main\b/g) ?? []).length, 0);
  assert.equal((searchMarkup.match(/id="main-content"/g) ?? []).length, 0);

  assert.equal((standaloneSearchMarkup.match(/<main\b/g) ?? []).length, 1);
  assert.equal((standaloneSearchMarkup.match(/id="main-content"/g) ?? []).length, 1);
  assert.equal((standaloneSearchMarkup.match(/href="#main-content"/g) ?? []).length, 1);
});

test('the mobile embedded database overview collapses its hero and fields without changing search layout', () => {
  const css = readFileSync(fileURLToPath(new URL('./pages/DatabaseWorkspace.css', import.meta.url)), 'utf8');

  assert.match(css, /@container \(max-width: 1000px\) \{[\s\S]*?\.database-overview__hero-grid\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.match(css, /@container \(max-width: 680px\) \{[\s\S]*?\.database-overview__fields\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.doesNotMatch(css, /\.database-overview__metrics|\.database-overview__usage/);
});
