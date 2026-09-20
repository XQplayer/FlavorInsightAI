export const LANGUAGE_STORAGE_KEY = 'flavorinsight:language';
export const THEME_STORAGE_KEY = 'flavorinsight:theme';

const DEFAULT_LANGUAGE = 'zh';
const DEFAULT_THEME = 'system';
const VALID_LANGUAGES = new Set([DEFAULT_LANGUAGE, 'en']);
const VALID_THEMES = new Set(['light', 'dark', DEFAULT_THEME]);

export function normalizeLanguage(language) {
  return VALID_LANGUAGES.has(language) ? language : DEFAULT_LANGUAGE;
}

export function normalizeTheme(theme) {
  return VALID_THEMES.has(theme) ? theme : DEFAULT_THEME;
}

export function loadLanguagePreference(storage) {
  try {
    const resolvedStorage = storage === undefined ? globalThis.localStorage : storage;
    return normalizeLanguage(resolvedStorage?.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function loadThemePreference(storage) {
  try {
    const resolvedStorage = storage === undefined ? globalThis.localStorage : storage;
    return normalizeTheme(resolvedStorage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export function resolveTheme(theme, matchMedia) {
  const normalizedTheme = normalizeTheme(theme);
  if (normalizedTheme !== DEFAULT_THEME) {
    return normalizedTheme;
  }

  try {
    const resolvedMatchMedia = matchMedia === undefined ? globalThis.matchMedia : matchMedia;
    return resolvedMatchMedia?.call(globalThis, '(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  } catch {
    return 'light';
  }
}
