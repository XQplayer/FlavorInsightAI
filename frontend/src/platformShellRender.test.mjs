import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

// This loads and renders the production JSX. Full keyboard and pointer browser coverage remains Task 10.
test('production shell renders the resolved system theme through its provider', async t => {
  const previousLocalStorage = globalThis.localStorage;
  const previousMatchMedia = globalThis.matchMedia;
  const mediaQuery = {
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  };

  globalThis.localStorage = {
    getItem() {
      return null;
    },
    setItem() {},
  };
  globalThis.matchMedia = () => mediaQuery;

  const vite = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    logLevel: 'silent',
    server: { middlewareMode: true },
    appType: 'custom',
  });

  t.after(async () => {
    await vite.close();
    if (previousLocalStorage === undefined) {
      delete globalThis.localStorage;
    } else {
      globalThis.localStorage = previousLocalStorage;
    }
    if (previousMatchMedia === undefined) {
      delete globalThis.matchMedia;
    } else {
      globalThis.matchMedia = previousMatchMedia;
    }
  });

  const [shellModule, homeModule, preferencesModule] = await Promise.all([
    vite.ssrLoadModule('/src/components/platform/PlatformShell.jsx'),
    vite.ssrLoadModule('/src/pages/PlatformHomePage.jsx'),
    vite.ssrLoadModule('/src/app/PlatformPreferences.jsx'),
  ]);
  const PlatformShell = shellModule.default;
  const PlatformHomePage = homeModule.default;
  const {
    PlatformPreferencesProvider,
    usePlatformPreferences,
  } = preferencesModule;

  function ThemeProbe() {
    const { theme, resolvedTheme } = usePlatformPreferences();
    return React.createElement('output', {
      'data-preference-theme': theme,
      'data-resolved-theme': resolvedTheme,
    });
  }

  const markup = renderToStaticMarkup(
    React.createElement(
      PlatformPreferencesProvider,
      null,
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          PlatformShell,
          { route: 'home', onNavigate() {} },
          React.createElement(PlatformHomePage, { onNavigate() {} }),
        ),
        React.createElement(ThemeProbe),
      ),
    ),
  );

  assert.match(markup, /FlavorInsight AI/);
  assert.match(markup, /href="\/FlavorThresholdDB\/"/);
  assert.match(markup, /<main[^>]*id="main-content"[^>]*>[\s\S]*食品风味信息学智能分析平台/);
  assert.match(markup, /href="\/FlavorThresholdDB\/database\/"/);
  assert.match(markup, /href="\/FlavorThresholdDB\/aroma-threshold\/"/);
  assert.match(markup, /href="\/FlavorThresholdDB\/data-processing\/"/);
  assert.equal((markup.match(/<details/g) ?? []).length, 4);
  assert.match(markup, /当前未部署生产级 AI 模型/);
  assert.match(markup, /data-preference-theme="system"/);
  assert.match(markup, /data-resolved-theme="dark"/);
  assert.match(markup, /aria-label="主题切换"[^>]*aria-pressed="true"[^>]*title="切换至浅色主题"/);
  assert.match(markup, /lucide-sun/);
});
