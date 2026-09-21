import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

function findElement(node, predicate) {
  if (!React.isValidElement(node)) return null;
  if (predicate(node)) return node;

  const children = React.Children.toArray(node.props.children);
  for (const child of children) {
    const match = findElement(child, predicate);
    if (match) return match;
  }
  return null;
}

test('the production route error boundary renders and operates its recovery controls', async t => {
  const vite = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    logLevel: 'silent',
    server: { middlewareMode: true },
    appType: 'custom',
  });
  t.after(() => vite.close());

  const platformModule = await vite.ssrLoadModule('/src/app/PlatformApp.jsx');
  assert.equal(typeof platformModule.default, 'function');
  assert.equal(typeof platformModule.RouteErrorBoundary, 'function');

  const navigations = [];
  let reloads = 0;
  const previousWindow = globalThis.window;
  globalThis.window = { location: { reload: () => { reloads += 1; } } };
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });

  const boundary = new platformModule.RouteErrorBoundary({
    language: 'zh',
    routeKey: 'database',
    onNavigate: route => navigations.push(route),
  });
  boundary.setState = update => {
    const nextState = typeof update === 'function'
      ? update(boundary.state, boundary.props)
      : update;
    boundary.state = { ...boundary.state, ...nextState };
  };
  boundary.state = platformModule.RouteErrorBoundary.getDerivedStateFromError(
    new Error('injected lazy rejection'),
  );

  const fallback = boundary.render();
  const zhMarkup = renderToStaticMarkup(fallback);
  assert.match(zhMarkup, /role="alert"/);
  assert.match(zhMarkup, /工作区加载失败/);
  assert.match(zhMarkup, /返回首页/);
  assert.match(zhMarkup, /重新加载/);

  const homeLink = findElement(fallback, element => element.type === 'a');
  assert.ok(homeLink);
  assert.equal(homeLink.props.href, '/FlavorThresholdDB/');
  let prevented = false;
  homeLink.props.onClick({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(navigations, ['home']);
  assert.equal(boundary.state.hasError, false);

  boundary.state = { hasError: true };
  const reloadButton = findElement(boundary.render(), element => element.type === 'button');
  assert.ok(reloadButton);
  reloadButton.props.onClick();
  assert.equal(reloads, 1);

  boundary.state = { hasError: true };
  const previousProps = boundary.props;
  boundary.props = { ...boundary.props, routeKey: 'search' };
  boundary.componentDidUpdate(previousProps);
  assert.equal(boundary.state.hasError, false);

  const englishBoundary = new platformModule.RouteErrorBoundary({
    language: 'en',
    routeKey: 'processing',
    onNavigate() {},
  });
  englishBoundary.state = { hasError: true };
  const enMarkup = renderToStaticMarkup(englishBoundary.render());
  assert.match(enMarkup, /Workspace failed to load/);
  assert.match(enMarkup, /Back to home/);
  assert.match(enMarkup, /Reload/);
});
