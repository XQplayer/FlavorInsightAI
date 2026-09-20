import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  LANGUAGE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  loadLanguagePreference,
  loadThemePreference,
  normalizeLanguage,
  normalizeTheme,
  resolveTheme,
} from './app/platformPreferences.js';

const memoryStorage = (initial = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.get(key) ?? null,
  };
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

test('platform tokens expose the product palette, sizing, radii, and dark mappings', () => {
  const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
  const requiredTokens = [
    '--color-primary: #3385ff;',
    '--color-primary-hover: #1e6fe8;',
    '--color-heading: #17233d;',
    '--color-body: #64748b;',
    '--color-background: #f7f9fc;',
    '--color-white: #ffffff;',
    '--color-border: #e2e8f0;',
    '--color-success: #07be84;',
    '--color-warning: #d97706;',
    '--color-danger: #ed4014;',
    '--color-dark-background: #111827;',
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

  assert.match(tokens, /@media \(max-width: 640px\)[\s\S]*--container-gutter: 16px;/);
});
