import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  LANGUAGE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  loadLanguagePreference,
  loadThemePreference,
  normalizeLanguage,
  normalizeTheme,
  resolveTheme,
} from './platformPreferences.js';

const PlatformPreferencesContext = createContext(null);

export function PlatformPreferencesProvider({ children }) {
  const [language, setLanguageState] = useState(() => loadLanguagePreference());
  const [theme, setThemeState] = useState(() => loadThemePreference());

  const setLanguage = useCallback(nextLanguage => {
    setLanguageState(currentLanguage => normalizeLanguage(
      typeof nextLanguage === 'function' ? nextLanguage(currentLanguage) : nextLanguage,
    ));
  }, []);

  const setTheme = useCallback(nextTheme => {
    setThemeState(currentTheme => normalizeTheme(
      typeof nextTheme === 'function' ? nextTheme(currentTheme) : nextTheme,
    ));
  }, []);

  useEffect(() => {
    try {
      globalThis.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Preferences remain usable when persistence is unavailable.
    }

    if (typeof document !== 'undefined') {
      document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    }
  }, [language]);

  useEffect(() => {
    try {
      globalThis.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Preferences remain usable when persistence is unavailable.
    }

    const root = typeof document === 'undefined' ? null : document.documentElement;
    let mediaQuery = null;

    if (theme === 'system') {
      try {
        mediaQuery = globalThis.matchMedia('(prefers-color-scheme: dark)');
      } catch {
        mediaQuery = null;
      }
    }

    const applyTheme = () => {
      const resolvedTheme = resolveTheme(theme, mediaQuery ? () => mediaQuery : undefined);
      if (root) {
        root.dataset.theme = resolvedTheme;
        root.style.colorScheme = resolvedTheme;
      }
    };

    applyTheme();
    mediaQuery?.addEventListener?.('change', applyTheme);

    return () => {
      mediaQuery?.removeEventListener?.('change', applyTheme);
    };
  }, [theme]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    theme,
    setTheme,
  }), [language, setLanguage, setTheme, theme]);

  return (
    <PlatformPreferencesContext.Provider value={value}>
      {children}
    </PlatformPreferencesContext.Provider>
  );
}

// The provider and its consumer hook intentionally share this module as one public API.
// eslint-disable-next-line react-refresh/only-export-components
export function usePlatformPreferences() {
  const preferences = useContext(PlatformPreferencesContext);
  if (!preferences) {
    throw new Error('usePlatformPreferences must be used within PlatformPreferencesProvider');
  }

  return preferences;
}
