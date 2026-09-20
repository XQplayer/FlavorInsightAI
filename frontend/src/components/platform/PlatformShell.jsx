import { useEffect, useRef, useState } from 'react';
import {
  Languages,
  Menu,
  Moon,
  Sun,
  UserRound,
  X,
} from 'lucide-react';

import { usePlatformPreferences } from '../../app/PlatformPreferences.jsx';
import { routeHref } from '../../app/platformRoutes.js';
import './PlatformShell.css';

const NAV_ITEMS = Object.freeze([
  { route: 'home', labels: { zh: '首页', en: 'Home' } },
  { route: 'database', labels: { zh: 'FlavorThresholdDB', en: 'FlavorThresholdDB' } },
  { route: 'processing', labels: { zh: '数据处理', en: 'Data processing' } },
  { route: 'analysis', labels: { zh: '数据分析', en: 'Data analysis' } },
  { route: 'resources', labels: { zh: '资源中心', en: 'Resources' } },
]);

const COPY = Object.freeze({
  zh: {
    skipLink: '跳至主要内容',
    navigation: '平台主导航',
    openMenu: '打开导航菜单',
    closeMenu: '关闭导航菜单',
    languageControl: '语言选择',
    switchToChinese: '切换至中文',
    switchToEnglish: 'Switch to English',
    themeControl: '主题切换',
    useLightTheme: '切换至浅色主题',
    useDarkTheme: '切换至深色主题',
    accountControl: '账号状态',
    localStatus: '本地模式',
    accountTitle: '本地模式',
    accountDescription: '当前偏好与任务信息仅保存在此浏览器。',
    accountCloud: '账号登录与可选云端留存正在规划中，当前不会自动上传或留存数据。',
  },
  en: {
    skipLink: 'Skip to main content',
    navigation: 'Platform navigation',
    openMenu: 'Open navigation menu',
    closeMenu: 'Close navigation menu',
    languageControl: 'Language selection',
    switchToChinese: '切换至中文',
    switchToEnglish: 'Switch to English',
    themeControl: 'Theme toggle',
    useLightTheme: 'Switch to light theme',
    useDarkTheme: 'Switch to dark theme',
    accountControl: 'Account status',
    localStatus: 'Local mode',
    accountTitle: 'Local mode',
    accountDescription: 'Preferences and task information currently stay in this browser.',
    accountCloud: 'Sign-in and optional cloud retention are planned; nothing is uploaded or retained automatically today.',
  },
});

const PLATFORM_BASE_PATH = import.meta.env.BASE_URL;

export default function PlatformShell({ route, onNavigate, children }) {
  const { language, setLanguage, theme, setTheme } = usePlatformPreferences();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const shellRef = useRef(null);
  const copy = COPY[language] ?? COPY.zh;
  const activeRoute = route === 'search' ? 'database' : route;
  const darkThemeActive = theme === 'dark';

  useEffect(() => {
    if (!mobileMenuOpen && !accountOpen) {
      return undefined;
    }

    const dismissOnOutsidePointer = event => {
      if (!shellRef.current?.contains(event.target)) {
        setMobileMenuOpen(false);
        setAccountOpen(false);
      }
    };
    const dismissOnEscape = event => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        setAccountOpen(false);
      }
    };

    document.addEventListener('pointerdown', dismissOnOutsidePointer);
    document.addEventListener('keydown', dismissOnEscape);

    return () => {
      document.removeEventListener('pointerdown', dismissOnOutsidePointer);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [accountOpen, mobileMenuOpen]);

  const handleRouteClick = (event, destination) => {
    setMobileMenuOpen(false);
    setAccountOpen(false);

    const isNormalLeftClick = event.button === 0
      && !event.altKey
      && !event.ctrlKey
      && !event.metaKey
      && !event.shiftKey;

    if (!isNormalLeftClick || typeof onNavigate !== 'function') {
      return;
    }

    event.preventDefault();
    onNavigate(destination);
  };

  return (
    <div className="platform-shell">
      <a className="platform-shell__skip-link" href="#main-content">
        {copy.skipLink}
      </a>

      <header className="platform-shell__header" ref={shellRef}>
        <div className="platform-shell__header-inner">
          <a
            className="platform-shell__brand"
            href={routeHref('home', PLATFORM_BASE_PATH)}
            onClick={event => handleRouteClick(event, 'home')}
          >
            <span className="platform-shell__brand-mark" aria-hidden="true">FI</span>
            <span>FlavorInsight AI</span>
          </a>

          <div
            className={`platform-shell__navigation-region${mobileMenuOpen ? ' is-open' : ''}`}
            id="platform-navigation"
          >
            <nav className="platform-shell__nav" aria-label={copy.navigation}>
              {NAV_ITEMS.map(item => {
                const isActive = activeRoute === item.route;
                return (
                  <a
                    className="platform-shell__nav-link"
                    href={routeHref(item.route, PLATFORM_BASE_PATH)}
                    key={item.route}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={event => handleRouteClick(event, item.route)}
                  >
                    {item.labels[language] ?? item.labels.zh}
                  </a>
                );
              })}
            </nav>

            <div className="platform-shell__controls">
              <div className="platform-shell__language" role="group" aria-label={copy.languageControl}>
                <Languages aria-hidden="true" size={18} strokeWidth={1.8} />
                <button
                  type="button"
                  data-language="zh"
                  aria-label={copy.switchToChinese}
                  aria-pressed={language === 'zh'}
                  onClick={() => setLanguage('zh')}
                >
                  中
                </button>
                <button
                  type="button"
                  data-language="en"
                  aria-label={copy.switchToEnglish}
                  aria-pressed={language === 'en'}
                  onClick={() => setLanguage('en')}
                >
                  EN
                </button>
              </div>

              <button
                className="platform-shell__icon-button"
                type="button"
                aria-label={copy.themeControl}
                aria-pressed={darkThemeActive}
                title={darkThemeActive ? copy.useLightTheme : copy.useDarkTheme}
                onClick={() => setTheme(darkThemeActive ? 'light' : 'dark')}
              >
                {darkThemeActive
                  ? <Sun aria-hidden="true" size={20} strokeWidth={1.8} />
                  : <Moon aria-hidden="true" size={20} strokeWidth={1.8} />}
                <span className="platform-shell__visually-hidden">
                  {darkThemeActive ? copy.useLightTheme : copy.useDarkTheme}
                </span>
              </button>

              <div className="platform-shell__account">
                <button
                  className="platform-shell__account-button"
                  type="button"
                  aria-label={copy.accountControl}
                  aria-expanded={accountOpen}
                  aria-controls="platform-account-popover"
                  aria-haspopup="dialog"
                  onClick={() => setAccountOpen(open => !open)}
                >
                  <UserRound aria-hidden="true" size={20} strokeWidth={1.8} />
                  <span>{copy.localStatus}</span>
                </button>

                {accountOpen ? (
                  <div
                    className="platform-shell__account-popover"
                    id="platform-account-popover"
                    role="dialog"
                    aria-label={copy.accountTitle}
                  >
                    <strong>{copy.accountTitle}</strong>
                    <p>{copy.accountDescription}</p>
                    <p>{copy.accountCloud}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <button
            className="platform-shell__menu-button"
            type="button"
            aria-label={mobileMenuOpen ? copy.closeMenu : copy.openMenu}
            aria-expanded={mobileMenuOpen}
            aria-controls="platform-navigation"
            onClick={() => {
              setMobileMenuOpen(open => !open);
              setAccountOpen(false);
            }}
          >
            {mobileMenuOpen
              ? <X aria-hidden="true" size={22} strokeWidth={1.8} />
              : <Menu aria-hidden="true" size={22} strokeWidth={1.8} />}
          </button>
        </div>
      </header>

      <main className="platform-shell__main" id="main-content" tabIndex="-1">
        {children}
      </main>
    </div>
  );
}
