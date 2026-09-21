import { Component, lazy, Suspense, useCallback, useEffect, useState } from 'react';

import PlatformShell from '../components/platform/PlatformShell.jsx';
import DataAnalysisPage from '../pages/DataAnalysisPage.jsx';
import PlatformHomePage from '../pages/PlatformHomePage.jsx';
import ResourcesPage from '../pages/ResourcesPage.jsx';
import {
  PlatformPreferencesProvider,
  usePlatformPreferences,
} from './PlatformPreferences.jsx';
import {
  navigatePlatformRoute,
  parsePlatformRoute,
  routeHref,
  subscribeToPlatformPopstate,
} from './platformRoutes.js';

const DatabaseOverviewPage = lazy(() => import('../pages/DatabaseOverviewPage.jsx'));
const DataProcessingPage = lazy(() => import('../pages/DataProcessingPage.jsx'));
const PLATFORM_BASE_PATH = import.meta.env.BASE_URL;

const PLATFORM_ROUTE_TITLES = Object.freeze({
  zh: {
    home: 'FlavorInsight AI | 食品风味信息学智能分析平台',
    database: 'FlavorThresholdDB 数据库 | FlavorInsight AI',
    search: '香气阈值检索 | FlavorInsight AI',
    processing: '数据处理 | FlavorInsight AI',
    analysis: '数据分析 | FlavorInsight AI',
    resources: '资源中心 | FlavorInsight AI',
  },
  en: {
    home: 'FlavorInsight AI | Food Flavor Informatics Platform',
    database: 'FlavorThresholdDB Database | FlavorInsight AI',
    search: 'Aroma Threshold Search | FlavorInsight AI',
    processing: 'Data Processing | FlavorInsight AI',
    analysis: 'Data Analysis | FlavorInsight AI',
    resources: 'Resources | FlavorInsight AI',
  },
});

const ROUTE_ERROR_COPY = Object.freeze({
  zh: {
    title: '工作区加载失败',
    description: '该工作区暂时无法加载。平台导航仍可使用；你可以返回首页或重新加载当前页面。',
    home: '返回首页',
    reload: '重新加载',
  },
  en: {
    title: 'Workspace failed to load',
    description: 'This workspace could not be loaded. Platform navigation remains available; return home or reload the current page.',
    home: 'Back to home',
    reload: 'Reload',
  },
});

export class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    this.handleHome = this.handleHome.bind(this);
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(previousProps) {
    if (previousProps.routeKey !== this.props.routeKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  handleHome(event) {
    if (typeof this.props.onNavigate !== 'function') return;
    event.preventDefault();
    this.setState({ hasError: false });
    this.props.onNavigate('home');
  }

  handleReload() {
    window.location.reload();
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const copy = ROUTE_ERROR_COPY[this.props.language] ?? ROUTE_ERROR_COPY.zh;
    return (
      <section className="platform-route-error" role="alert" aria-live="assertive">
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
        <div className="platform-route-error__actions">
          <a href={routeHref('home', PLATFORM_BASE_PATH)} onClick={this.handleHome}>
            {copy.home}
          </a>
          <button type="button" onClick={this.handleReload}>
            {copy.reload}
          </button>
        </div>
      </section>
    );
  }
}

function RouteLoading() {
  const { language } = usePlatformPreferences();

  return (
    <div className="platform-route-loading" role="status" aria-live="polite">
      {language === 'en' ? 'Loading workspace…' : '正在加载工作区…'}
    </div>
  );
}

function PlatformRoute({ route, onNavigate }) {
  const { language, resolvedTheme, setLanguage } = usePlatformPreferences();

  useEffect(() => {
    document.title = PLATFORM_ROUTE_TITLES[language]?.[route]
      ?? PLATFORM_ROUTE_TITLES.zh[route]
      ?? PLATFORM_ROUTE_TITLES.zh.home;
  }, [language, route]);

  if (route === 'home') {
    return <PlatformHomePage onNavigate={onNavigate} />;
  }

  if (route === 'database' || route === 'search') {
    return (
      <RouteErrorBoundary routeKey={route} language={language} onNavigate={onNavigate}>
        <Suspense fallback={<RouteLoading />}>
          <DatabaseOverviewPage
            initialView={route === 'search' ? 'search' : 'home'}
            embedded
            language={language}
            onLanguageChange={setLanguage}
            onNavigate={onNavigate}
          />
        </Suspense>
      </RouteErrorBoundary>
    );
  }

  if (route === 'processing') {
    return (
      <RouteErrorBoundary routeKey={route} language={language} onNavigate={onNavigate}>
        <Suspense fallback={<RouteLoading />}>
          <DataProcessingPage
            language={language}
            theme={resolvedTheme}
            onNavigate={onNavigate}
          />
        </Suspense>
      </RouteErrorBoundary>
    );
  }

  if (route === 'analysis') {
    return <DataAnalysisPage onNavigate={onNavigate} />;
  }

  if (route === 'resources') {
    return <ResourcesPage />;
  }

  return <PlatformHomePage onNavigate={onNavigate} />;
}

export default function PlatformApp() {
  const [route, setRoute] = useState(() => parsePlatformRoute(window.location.pathname));

  useEffect(() => subscribeToPlatformPopstate(setRoute), []);

  const navigate = useCallback(nextRoute => {
    navigatePlatformRoute(nextRoute, { basePath: PLATFORM_BASE_PATH });
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  return (
    <PlatformPreferencesProvider>
      <PlatformShell route={route} onNavigate={navigate}>
        <PlatformRoute route={route} onNavigate={navigate} />
      </PlatformShell>
    </PlatformPreferencesProvider>
  );
}
