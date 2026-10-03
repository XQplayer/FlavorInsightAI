export const LANGUAGE_STORAGE_KEY = 'flavorinsight:language';
export const THEME_STORAGE_KEY = 'flavorinsight:theme';

const DEFAULT_LANGUAGE = 'en';
const DEFAULT_THEME = 'system';
const VALID_LANGUAGES = new Set(['en', 'zh']);
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

export function persistPreference(key, value, storage) {
  try {
    const resolvedStorage = storage === undefined ? globalThis.localStorage : storage;
    resolvedStorage?.setItem(key, value);
  } catch {
    // Persistence is optional; preferences still work for the current session.
  }
}

export function applyLanguagePreference(language, documentElement) {
  try {
    const resolvedDocumentElement = documentElement === undefined
      ? globalThis.document?.documentElement
      : documentElement;
    if (resolvedDocumentElement) {
      resolvedDocumentElement.lang = normalizeLanguage(language) === 'zh' ? 'zh-CN' : 'en';
    }
  } catch {
    // DOM preference updates are best-effort.
  }
}

export function applyThemePreference(theme, documentElement, matchMedia) {
  const resolvedTheme = resolveTheme(theme, matchMedia);
  let resolvedDocumentElement = documentElement;

  if (documentElement === undefined) {
    try {
      resolvedDocumentElement = globalThis.document?.documentElement;
    } catch {
      resolvedDocumentElement = null;
    }
  }

  try {
    if (resolvedDocumentElement) {
      resolvedDocumentElement.dataset.theme = resolvedTheme;
    }
  } catch {
    // A restricted dataset must not block the remaining preference update.
  }

  try {
    if (resolvedDocumentElement) {
      resolvedDocumentElement.style.colorScheme = resolvedTheme;
    }
  } catch {
    // DOM preference updates are best-effort.
  }

  return resolvedTheme;
}

export function subscribeToSystemTheme(theme, listener, matchMedia) {
  if (normalizeTheme(theme) !== 'system' || typeof listener !== 'function') {
    return () => {};
  }

  try {
    const resolvedMatchMedia = matchMedia === undefined ? globalThis.matchMedia : matchMedia;
    const mediaQuery = resolvedMatchMedia.call(globalThis, '(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', listener);

    return () => {
      try {
        mediaQuery.removeEventListener('change', listener);
      } catch {
        // Cleanup is best-effort when a media query implementation disappears.
      }
    };
  } catch {
    return () => {};
  }
}
