import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

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
} from './platformPreferences.js';

const PlatformPreferencesContext = createContext(null);

export function PlatformPreferencesProvider({ children }) {
  const [language, setLanguageState] = useState(() => loadLanguagePreference());
  const [theme, setThemeState] = useState(() => loadThemePreference());
  const subscribeToResolvedTheme = useCallback(
    listener => subscribeToSystemTheme(theme, listener),
    [theme],
  );
  const getResolvedTheme = useCallback(() => resolveTheme(theme), [theme]);
  const resolvedTheme = useSyncExternalStore(
    subscribeToResolvedTheme,
    getResolvedTheme,
    getResolvedTheme,
  );

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
    persistPreference(LANGUAGE_STORAGE_KEY, language);
    applyLanguagePreference(language);
  }, [language]);

  useEffect(() => {
    persistPreference(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    applyThemePreference(resolvedTheme);
  }, [resolvedTheme]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    theme,
    resolvedTheme,
    setTheme,
  }), [language, resolvedTheme, setLanguage, setTheme, theme]);

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
