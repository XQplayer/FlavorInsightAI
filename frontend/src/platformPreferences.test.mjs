import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  LANGUAGE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  applyLanguagePreference,
  applyThemePreference,
  loadLanguagePreference,
  loadThemePreference,
  normalizeLanguage,
  normalizeTheme,
  persistPreference,
  resolveTheme,
  subscribeToSystemTheme,
} from './app/platformPreferences.js';

const memoryStorage = (initial = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.get(key) ?? null,
  };
};

const readCustomProperties = css => new Map(
  [...css.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)]
    .map(([, name, value]) => [name, value.trim()]),
);

const relativeLuminance = (hex) => {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  assert.ok(match, `expected a six-digit hex color, received ${hex}`);

  const channels = match.slice(1).map(channel => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
};

const contrastRatio = (foreground, background) => {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

test('language preferences normalize to zh or en and default to zh', () => {
  assert.equal(normalizeLanguage('zh'), 'zh');
  assert.equal(normalizeLanguage('en'), 'en');
  assert.equal(normalizeLanguage('en-US'), 'zh');
  assert.equal(normalizeLanguage(null), 'zh');

  assert.equal(loadLanguagePreference(memoryStorage({ [LANGUAGE_STORAGE_KEY]: 'en' })), 'en');
  assert.equal(loadLanguagePreference(memoryStorage({ [LANGUAGE_STORAGE_KEY]: 'invalid' })), 'zh');
});

test('theme preferences normalize to light, dark, or system and default to system', () => {
  assert.equal(normalizeTheme('light'), 'light');
  assert.equal(normalizeTheme('dark'), 'dark');
  assert.equal(normalizeTheme('system'), 'system');
  assert.equal(normalizeTheme('invalid'), 'system');
  assert.equal(normalizeTheme(undefined), 'system');

  assert.equal(loadThemePreference(memoryStorage({ [THEME_STORAGE_KEY]: 'dark' })), 'dark');
  assert.equal(loadThemePreference(memoryStorage()), 'system');
});

test('preference loading keeps safe defaults when storage access throws', () => {
  const throwingStorage = {
    getItem() {
      throw new Error('storage unavailable');
    },
  };

  assert.equal(loadLanguagePreference(throwingStorage), 'zh');
  assert.equal(loadThemePreference(throwingStorage), 'system');
});

test('system theme resolves safely from matchMedia', () => {
  assert.equal(resolveTheme('light', () => ({ matches: true })), 'light');
  assert.equal(resolveTheme('dark', () => ({ matches: false })), 'dark');
  assert.equal(resolveTheme('system', () => ({ matches: true })), 'dark');
  assert.equal(resolveTheme('system', () => ({ matches: false })), 'light');
  assert.equal(resolveTheme('system', () => { throw new Error('media unavailable'); }), 'light');
  assert.equal(resolveTheme('invalid', () => ({ matches: true })), 'dark');
});

test('runtime preference helpers persist and apply language and theme', () => {
  const writes = [];
  persistPreference(LANGUAGE_STORAGE_KEY, 'en', {
    setItem: (key, value) => writes.push([key, value]),
  });
  assert.deepEqual(writes, [[LANGUAGE_STORAGE_KEY, 'en']]);

  const documentElement = { dataset: {}, lang: '', style: {} };
  applyLanguagePreference('zh', documentElement);
  assert.equal(documentElement.lang, 'zh-CN');
  applyLanguagePreference('en', documentElement);
  assert.equal(documentElement.lang, 'en');

  assert.equal(
    applyThemePreference('system', documentElement, () => ({ matches: true })),
    'dark',
  );
  assert.equal(documentElement.dataset.theme, 'dark');
  assert.equal(documentElement.style.colorScheme, 'dark');
});

test('runtime preference helpers contain storage, document, and media failures', () => {
  const throwingStorage = {
    setItem() {
      throw new Error('storage unavailable');
    },
  };
  const throwingDocumentElement = {
    get dataset() {
      throw new Error('dataset unavailable');
    },
    set lang(_value) {
      throw new Error('lang unavailable');
    },
    get style() {
      throw new Error('style unavailable');
    },
  };

  assert.doesNotThrow(() => persistPreference(THEME_STORAGE_KEY, 'dark', throwingStorage));
  assert.doesNotThrow(() => applyLanguagePreference('en', throwingDocumentElement));
  assert.doesNotThrow(() => applyThemePreference(
    'system',
    throwingDocumentElement,
    () => { throw new Error('media unavailable'); },
  ));
});

test('system theme subscriptions deliver live changes and clean up safely', () => {
  let changeListener;
  let removedListener;
  const mediaQuery = {
    addEventListener(type, listener) {
      assert.equal(type, 'change');
      changeListener = listener;
    },
    removeEventListener(type, listener) {
      assert.equal(type, 'change');
      removedListener = listener;
    },
  };
  const changes = [];
  const cleanup = subscribeToSystemTheme(
    'system',
    event => changes.push(event.matches),
    () => mediaQuery,
  );

  changeListener({ matches: true });
  assert.deepEqual(changes, [true]);
  cleanup();
  assert.equal(removedListener, changeListener);

  assert.doesNotThrow(() => subscribeToSystemTheme(
    'system',
    () => {},
    () => { throw new Error('media unavailable'); },
  )());
});

test('platform tokens expose the product palette, sizing, radii, and dark mappings', () => {
  const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
  const requiredTokens = [
    '--platform-brand: #3385ff;',
    '--platform-ink: #17233d;',
    '--platform-canvas: #f7f9fc;',
    '--platform-action: #1d4ed8;',
    '--platform-action-text: #ffffff;',
    '--platform-monitor: #111827;',
    '--color-primary: var(--platform-brand);',
    '--color-primary-hover: var(--platform-brand-hover);',
    '--color-heading: var(--platform-ink);',
    '--color-body: var(--platform-text);',
    '--color-background: var(--platform-canvas);',
    '--color-white: #ffffff;',
    '--color-border: var(--platform-border);',
    '--color-success: var(--platform-success);',
    '--color-warning: var(--platform-warning);',
    '--color-danger: var(--platform-danger);',
    '--color-dark-background: var(--platform-monitor);',
    '--navbar-height: 70px;',
    '--container-max: 1200px;',
    '--container-gutter: 24px;',
    '--radius-sm: 8px;',
    '--radius-surface: 12px;',
    '--radius-panel: 16px;',
    '--radius-xl: 24px;',
    ":root[data-theme='dark']",
  ];

  for (const token of requiredTokens) {
    assert.ok(tokens.includes(token), `missing platform token: ${token}`);
  }

  const rootTheme = tokens.match(/:root\s*{([^}]*)}/)?.[1] ?? '';
  const darkTheme = tokens.match(/:root\[data-theme='dark'\]\s*{([^}]*)}/)?.[1] ?? '';
  for (const token of [
    '--platform-canvas:',
    '--platform-surface:',
    '--platform-ink:',
    '--platform-text:',
    '--platform-border:',
    '--platform-focus:',
    '--platform-danger:',
    '--platform-monitor:',
  ]) {
    assert.ok(darkTheme.includes(token), `missing dark platform override: ${token}`);
  }

  const rootProperties = readCustomProperties(rootTheme);
  const darkProperties = new Map([
    ...rootProperties,
    ...readCustomProperties(darkTheme),
  ]);
  assert.equal(rootProperties.get('--action-primary'), 'var(--platform-action)');
  assert.equal(rootProperties.get('--text-on-brand'), 'var(--platform-action-text)');
  assert.ok(
    contrastRatio(darkProperties.get('--platform-ink'), darkProperties.get('--platform-surface')) >= 4.5,
    'dark platform ink must remain readable on the dark surface',
  );
  assert.ok(
    contrastRatio(darkProperties.get('--platform-danger'), darkProperties.get('--platform-canvas')) >= 4.5,
    'dark danger text must remain readable on the dark canvas',
  );
  assert.ok(
    contrastRatio(darkProperties.get('--platform-action-text'), darkProperties.get('--platform-action')) >= 4.5,
    'primary action text must meet WCAG AA contrast',
  );

  assert.match(tokens, /@media \(max-width: 640px\)[\s\S]*--container-gutter: 16px;/);
});

test('platform preferences hook retains its outside-provider guard', () => {
  const provider = readFileSync(new URL('./app/PlatformPreferences.jsx', import.meta.url), 'utf8');

  assert.match(provider, /usePlatformPreferences must be used within PlatformPreferencesProvider/);
});
