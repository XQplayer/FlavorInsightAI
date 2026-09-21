import { Component, lazy, Suspense, useCallback, useEffect, useState } from 'react';

import PlatformShell from '../components/platform/PlatformShell.jsx';
import PlatformHomePage from '../pages/PlatformHomePage.jsx';
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

const DatabaseApp = lazy(() => import('../App.jsx'));
const ShimadzuAnalysisPage = lazy(() => import('../components/shimadzu/ShimadzuAnalysisPage.jsx'));
const PLATFORM_BASE_PATH = import.meta.env.BASE_URL;

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

function PlannedRoute({ route, onNavigate }) {
  const { language } = usePlatformPreferences();
  const isAnalysis = route === 'analysis';

  return (
    <section className="platform-route-placeholder" aria-labelledby="platform-route-placeholder-title">
      <p>{language === 'en' ? 'In development' : '开发中'}</p>
      <h1 id="platform-route-placeholder-title">
        {isAnalysis
          ? (language === 'en' ? 'Data analysis' : '数据分析')
          : (language === 'en' ? 'Resources' : '资源中心')}
      </h1>
      <p>
        {language === 'en'
          ? 'This section is being prepared. Current production capabilities remain available from the platform home.'
          : '此模块正在建设中，当前已上线能力可从平台首页进入。'}
      </p>
      <button type="button" onClick={() => onNavigate('home')}>
        {language === 'en' ? 'Back to home' : '返回首页'}
      </button>
    </section>
  );
}

function PlatformRoute({ route, onNavigate }) {
  const { language, setLanguage } = usePlatformPreferences();

  if (route === 'home') {
    return <PlatformHomePage onNavigate={onNavigate} />;
  }

  if (route === 'database' || route === 'search') {
    return (
      <RouteErrorBoundary routeKey={route} language={language} onNavigate={onNavigate}>
        <Suspense fallback={<RouteLoading />}>
          <DatabaseApp
            key={route}
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
          <ShimadzuAnalysisPage
            embedded
            language={language}
            onLanguageChange={setLanguage}
            onNavigate={onNavigate}
            isEnglish={language === 'en'}
            setInterfaceLanguage={setLanguage}
            onHome={() => onNavigate('home')}
            onThresholds={() => onNavigate('search')}
          />
        </Suspense>
      </RouteErrorBoundary>
    );
  }

  return <PlannedRoute route={route} onNavigate={onNavigate} />;
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
