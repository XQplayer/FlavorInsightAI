import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  Database,
  House,
  Languages,
  Menu,
  BrainCircuit,
  Moon,
  PanelsTopLeft,
  Sun,
  UserRound,
  X,
} from 'lucide-react';

import { usePlatformPreferences } from '../../app/PlatformPreferences.jsx';
import { routeHref } from '../../app/platformRoutes.js';
import { isNormalLeftClick, nextThemePreference } from './platformShellBehavior.js';
import './PlatformShell.css';

const NAV_ITEMS = Object.freeze([
  { route: 'home', icon: House, labels: { zh: '首页', en: 'Home' } },
  { route: 'database', icon: Database, labels: { zh: 'FlavorThresholdDB', en: 'FlavorThresholdDB' } },
  { route: 'processing', icon: PanelsTopLeft, labels: { zh: '数据处理', en: 'Data processing' } },
  { route: 'analysis', icon: ChartNoAxesCombined, labels: { zh: '数据分析', en: 'Data analysis' } },
  { route: 'models', icon: BrainCircuit, labels: { zh: '智能模型', en: 'AI Models' } },
  { route: 'resources', icon: BookOpen, labels: { zh: '资源中心', en: 'Resources' } },
]);

const COPY = Object.freeze({
  zh: {
    skipLink: '跳至主要内容', navigation: '平台主导航', openMenu: '打开导航菜单',
    closeMenu: '关闭导航菜单', expandSidebar: '展开侧边栏', collapseSidebar: '折叠侧边栏',
    languageControl: '语言选择', switchToChinese: '切换至中文', switchToEnglish: 'Switch to English',
    themeControl: '主题切换', useLightTheme: '切换至浅色主题', useDarkTheme: '切换至深色主题',
    accountControl: '账号状态', localStatus: '本地模式', workspace: '科研工作台',
    search: '香气阈值检索', login: '账号访问',
  },
  en: {
    skipLink: 'Skip to main content', navigation: 'Platform navigation', openMenu: 'Open navigation menu',
    closeMenu: 'Close navigation menu', expandSidebar: 'Expand sidebar', collapseSidebar: 'Collapse sidebar',
    languageControl: 'Language selection', switchToChinese: '切换至中文', switchToEnglish: 'Switch to English',
    themeControl: 'Theme toggle', useLightTheme: 'Switch to light theme', useDarkTheme: 'Switch to dark theme',
    accountControl: 'Account status', localStatus: 'Local mode', workspace: 'Research workspace',
    search: 'Aroma threshold search', login: 'Account access',
  },
});

const PLATFORM_BASE_PATH = import.meta.env.BASE_URL;
const SIDEBAR_STORAGE_KEY = 'flavorinsight:sidebar-collapsed';

function loadSidebarPreference() {
  try {
    const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (saved === 'true') return true;
    if (saved === 'false') return false;
  } catch {
    // A blocked storage API must not prevent navigation.
  }
  return null;
}

export default function PlatformShell({ route, onNavigate, children }) {
  const { language, setLanguage, resolvedTheme, setTheme } = usePlatformPreferences();
  const [manualCollapsed, setManualCollapsed] = useState(loadSidebarPreference);
  const [compactViewport, setCompactViewport] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 1279px)').matches);
  const [mobileViewport, setMobileViewport] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);
  const [mobileMenuState, setMobileMenuState] = useState({ route, open: false });
  const mobileMenuOpen = mobileMenuState.route === route && mobileMenuState.open;
  const setMobileMenuOpen = useCallback(nextOpen => {
    setMobileMenuState(current => {
      const wasOpen = current.route === route && current.open;
      return { route, open: typeof nextOpen === 'function' ? nextOpen(wasOpen) : nextOpen };
    });
  }, [route]);
  const menuButtonRef = useRef(null);
  const sidebarRef = useRef(null);
  const drawerCloseRef = useRef(null);
  const copy = COPY[language] ?? COPY.en;
  const collapsed = manualCollapsed ?? compactViewport;
  const activeRoute = route === 'search' ? 'database' : route;
  const darkThemeActive = resolvedTheme === 'dark';
  const pageTitle = route === 'search' || route === 'login'
    ? copy[route]
    : NAV_ITEMS.find(item => item.route === activeRoute)?.labels[language] ?? 'FlavorInsight AI';

  useEffect(() => {
    const compact = window.matchMedia('(max-width: 1279px)');
    const mobile = window.matchMedia('(max-width: 767px)');
    const updateCompact = event => setCompactViewport(event.matches);
    const updateMobile = event => {
      setMobileViewport(event.matches);
      if (!event.matches) setMobileMenuOpen(false);
    };
    compact.addEventListener('change', updateCompact);
    mobile.addEventListener('change', updateMobile);
    return () => {
      compact.removeEventListener('change', updateCompact);
      mobile.removeEventListener('change', updateMobile);
    };
  }, [setMobileMenuOpen]);

  const closeMobileMenu = useCallback((returnFocus = true) => {
    setMobileMenuOpen(false);
    if (returnFocus) window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  }, [setMobileMenuOpen]);

  useEffect(() => {
    if (!mobileViewport || !mobileMenuOpen) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => drawerCloseRef.current?.focus({ preventScroll: true }), 80);
    const handleKeydown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMobileMenu();
      }
      if (event.key !== 'Tab') return;
      const focusable = [...sidebarRef.current.querySelectorAll('a[href], button:not([disabled])')]
        .filter(element => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeydown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [closeMobileMenu, mobileMenuOpen, mobileViewport]);

  const handleRouteClick = (event, destination) => {
    if (!isNormalLeftClick(event) || typeof onNavigate !== 'function') return;
    event.preventDefault();
    if (mobileViewport) closeMobileMenu(false);
    onNavigate(destination);
  };

  const toggleSidebar = () => {
    const next = !collapsed;
    setManualCollapsed(next);
    try { window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next)); }
    catch { /* Navigation still works when storage is unavailable. */ }
  };

  return (
    <div className={`platform-shell${collapsed ? ' is-collapsed' : ''}${mobileMenuOpen ? ' is-drawer-open' : ''}`}>
      <a className="platform-shell__skip-link" href="#main-content">{copy.skipLink}</a>
      <button
        className="platform-shell__scrim"
        type="button"
        tabIndex={mobileMenuOpen ? 0 : -1}
        aria-label={copy.closeMenu}
        aria-hidden={!mobileMenuOpen}
        onClick={() => closeMobileMenu()}
      />
      <aside
        ref={sidebarRef}
        className="platform-shell__sidebar"
        id="platform-navigation"
        role={mobileViewport && mobileMenuOpen ? 'dialog' : undefined}
        aria-modal={mobileViewport && mobileMenuOpen ? 'true' : undefined}
        aria-label={copy.navigation}
        aria-hidden={mobileViewport && !mobileMenuOpen ? true : undefined}
        inert={mobileViewport && !mobileMenuOpen ? true : undefined}
      >
        <div className="platform-shell__sidebar-head">
          <a className="platform-shell__brand" href={routeHref('home', PLATFORM_BASE_PATH)}
            aria-label="FlavorInsight AI" onClick={event => handleRouteClick(event, 'home')}>
            <span className="platform-shell__brand-mark" aria-hidden="true">FI</span>
            <span className="platform-shell__brand-name">FlavorInsight AI</span>
          </a>
          <button ref={drawerCloseRef} className="platform-shell__drawer-close" type="button"
            aria-label={copy.closeMenu} onClick={() => closeMobileMenu()}>
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        <nav className="platform-shell__nav" aria-label={copy.navigation}>
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const label = item.labels[language] ?? item.labels.zh;
            const isActive = activeRoute === item.route;
            return (
              <a className="platform-shell__nav-link" href={routeHref(item.route, PLATFORM_BASE_PATH)}
                key={item.route} aria-label={label} title={collapsed && !mobileViewport ? label : undefined}
                aria-current={isActive ? 'page' : undefined}
                onClick={event => handleRouteClick(event, item.route)}>
                <Icon aria-hidden="true" size={20} strokeWidth={1.9} />
                <span className="platform-shell__nav-label">{label}</span>
              </a>
            );
          })}
        </nav>

        <div className="platform-shell__controls">
          <div className="platform-shell__language" role="group" aria-label={copy.languageControl}>
            <Languages aria-hidden="true" size={18} strokeWidth={1.8} />
            <button type="button" data-language="zh" aria-label={copy.switchToChinese}
              aria-pressed={language === 'zh'} onClick={() => setLanguage('zh')}>中</button>
            <button type="button" data-language="en" aria-label={copy.switchToEnglish}
              aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
          </div>
          <button className="platform-shell__utility-link" type="button" aria-label={copy.themeControl}
            aria-pressed={darkThemeActive} title={darkThemeActive ? copy.useLightTheme : copy.useDarkTheme}
            onClick={() => setTheme(nextThemePreference(resolvedTheme))}>
            {darkThemeActive ? <Sun aria-hidden="true" size={20} /> : <Moon aria-hidden="true" size={20} />}
            <span className="platform-shell__control-label">{darkThemeActive ? copy.useLightTheme : copy.useDarkTheme}</span>
          </button>
          <a className="platform-shell__utility-link platform-shell__account-button"
            href={routeHref('login', PLATFORM_BASE_PATH)} aria-label={copy.accountControl}
            aria-current={route === 'login' ? 'page' : undefined}
            onClick={event => handleRouteClick(event, 'login')}>
            <UserRound aria-hidden="true" size={20} />
            <span className="platform-shell__control-label">{copy.localStatus}</span>
          </a>
          <button className="platform-shell__utility-link platform-shell__collapse-button" type="button"
            aria-label={collapsed ? copy.expandSidebar : copy.collapseSidebar}
            aria-expanded={!collapsed} aria-controls="platform-navigation" onClick={toggleSidebar}>
            {collapsed ? <ChevronRight aria-hidden="true" size={20} /> : <ChevronLeft aria-hidden="true" size={20} />}
            <span className="platform-shell__control-label">{collapsed ? copy.expandSidebar : copy.collapseSidebar}</span>
          </button>
        </div>
      </aside>

      <div className="platform-shell__main-area">
        <header className="platform-shell__utility-header">
          <button ref={menuButtonRef} className="platform-shell__menu-button" type="button"
            aria-label={mobileMenuOpen ? copy.closeMenu : copy.openMenu}
            aria-expanded={mobileMenuOpen} aria-controls="platform-navigation"
            onClick={() => setMobileMenuOpen(open => !open)}>
            {mobileMenuOpen ? <X aria-hidden="true" size={22} /> : <Menu aria-hidden="true" size={22} />}
          </button>
          <div className="platform-shell__utility-context">
            <span>{copy.workspace}</span>
            <strong>{pageTitle}</strong>
          </div>
          <span className="platform-shell__utility-status">{copy.localStatus}</span>
        </header>
        <main className="platform-shell__main" id="main-content" tabIndex="-1">{children}</main>
      </div>
    </div>
  );
}
