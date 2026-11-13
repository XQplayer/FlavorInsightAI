import { Component, lazy, Suspense, useCallback, useEffect, useState } from 'react';

import PlatformShell from '../components/platform/PlatformShell.jsx';
import PlatformHomePage from '../pages/PlatformHomeV2.jsx';
import ResourcesPage from '../pages/ResourcesPage.jsx';
import PlatformLoginPage from '../pages/PlatformLoginPage.jsx';
import './PlatformFeedback.css';
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
import { parseProcessingLocation, processingViewHref } from './processingRoutes.js';
import { saveAuthIntent, takeAuthIntent } from './authIntent.js';
import { supabase } from '../lib/supabase.js';

const DatabaseOverviewPage = lazy(() => import('../pages/DatabaseOverviewPage.jsx'));
const DataProcessingPage = lazy(() => import('../pages/DataProcessingPage.jsx'));
const DataAnalysisPage = lazy(() => import('../pages/DataAnalysisPage.jsx'));
const AIModelsPage = lazy(() => import('../pages/AIModelsPage.jsx'));
const AIResearchAssistantPage = lazy(() => import('../pages/AIResearchAssistantPage.jsx'));
const PLATFORM_BASE_PATH = import.meta.env.BASE_URL;

const PLATFORM_ROUTE_TITLES = Object.freeze({
  zh: {
    home: 'FlavorInsight AI | 食品风味信息学智能分析平台',
    database: 'FlavorThresholdDB 数据库 | FlavorInsight AI',
    search: '香气阈值检索 | FlavorInsight AI',
    processing: '数据处理 | FlavorInsight AI',
    analysis: '数据分析 | FlavorInsight AI',
    models: '智能模型 | FlavorInsight AI',
    assistant: 'AI 科研助手 | FlavorInsight AI',
    resources: '资源中心 | FlavorInsight AI',
    login: '账号访问 | FlavorInsight AI',
  },
  en: {
    home: 'FlavorInsight AI | Food Flavor Informatics Platform',
    database: 'FlavorThresholdDB Database | FlavorInsight AI',
    search: 'Aroma Threshold Search | FlavorInsight AI',
    processing: 'Data Processing | FlavorInsight AI',
    analysis: 'Data Analysis | FlavorInsight AI',
    models: 'AI Models | FlavorInsight AI',
    assistant: 'AI Research Assistant | FlavorInsight AI',
    resources: 'Resources | FlavorInsight AI',
    login: 'Account access | FlavorInsight AI',
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

function PlatformRoute({ route, onNavigate, processingLocation, onProcessingNavigate, onRequireAuth, onLoginSuccess, resumeIntent, authSession, loginPrompt }) {
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
            processingView={processingLocation.view}
            selectedTaskId={processingLocation.taskId}
            onProcessingNavigate={onProcessingNavigate}
            onRequireAuth={onRequireAuth}
            resumeIntent={resumeIntent}
          />
        </Suspense>
      </RouteErrorBoundary>
    );
  }

  if (route === 'analysis') {
    return <RouteErrorBoundary routeKey={route} language={language} onNavigate={onNavigate}><Suspense fallback={<RouteLoading />}><DataAnalysisPage onNavigate={onNavigate} onRequireAuth={onRequireAuth} resumeIntent={resumeIntent} /></Suspense></RouteErrorBoundary>;
  }

  if (route === 'models') {
    return <RouteErrorBoundary routeKey={route} language={language} onNavigate={onNavigate}><Suspense fallback={<RouteLoading />}><AIModelsPage onNavigate={onNavigate} /></Suspense></RouteErrorBoundary>;
  }

  if (route === 'assistant') {
    return <RouteErrorBoundary routeKey={route} language={language} onNavigate={onNavigate}><Suspense fallback={<RouteLoading />}><AIResearchAssistantPage language={language} onRequireAuth={onRequireAuth} resumeIntent={resumeIntent} /></Suspense></RouteErrorBoundary>;
  }

  if (route === 'resources') {
    return <ResourcesPage />;
  }

  if (route === 'login') {
    return <PlatformLoginPage onNavigate={onNavigate} onLoginSuccess={onLoginSuccess} authSession={authSession} loginPrompt={loginPrompt} />;
  }

  return <PlatformHomePage onNavigate={onNavigate} />;
}

export default function PlatformApp() {
  const [route, setRoute] = useState(() => parsePlatformRoute(window.location.pathname));
  const [processingLocation, setProcessingLocation] = useState(() => parseProcessingLocation(window.location.pathname, window.location.search));
  const [authSession, setAuthSession] = useState(null);
  const [resumeIntent, setResumeIntent] = useState(null);
  const [loginPrompt, setLoginPrompt] = useState('');

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) setAuthSession(data.session || null); }).catch(() => {});
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setAuthSession(session || null));
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => subscribeToPlatformPopstate(nextRoute => {
    setRoute(nextRoute);
    setProcessingLocation(parseProcessingLocation(window.location.pathname, window.location.search));
  }), []);

  const navigate = useCallback((nextRoute, context = null) => {
    setResumeIntent(null);
    navigatePlatformRoute(nextRoute, { basePath: PLATFORM_BASE_PATH, context });
    setRoute(nextRoute);
    if (nextRoute === 'processing') setProcessingLocation({ view: 'new', taskId: '' });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const navigateProcessing = useCallback((view, taskId = processingLocation.taskId) => {
    setResumeIntent(null);
    const href = processingViewHref(view, PLATFORM_BASE_PATH, taskId);
    window.history.pushState({ route: 'processing', view, taskId }, '', href);
    setRoute('processing');
    setProcessingLocation(parseProcessingLocation(window.location.pathname, window.location.search));
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [processingLocation.taskId]);

  const requireAuth = useCallback(async (action, draft = {}) => {
    if (!supabase) throw new Error('当前部署未连接账号服务；服务端功能暂不可用。');
    const { data, error } = await supabase.auth.getUser();
    if (data?.user) return true;
    if (error && error.status !== 401 && error.status !== 403 && error.name !== 'AuthSessionMissingError') throw new Error('无法核验登录状态，请检查网络后重试。');
    const saved = saveAuthIntent({ returnPath: window.location.pathname + window.location.search, action, draft }, PLATFORM_BASE_PATH);
    if (!saved) throw new Error('无法安全保存返回位置；请检查浏览器会话存储后重试。');
    setLoginPrompt(authSession ? 'expired' : 'required');
    if (authSession) await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    navigatePlatformRoute('login', { basePath: PLATFORM_BASE_PATH });
    setRoute('login');
    window.scrollTo({ top: 0, behavior: 'auto' });
    return false;
  }, [authSession]);

  const loginSuccess = useCallback(() => {
    const intent = takeAuthIntent(PLATFORM_BASE_PATH);
    setLoginPrompt('');
    if (!intent) { navigate('home'); return; }
    window.history.pushState({ route: parsePlatformRoute(intent.returnPath) }, '', intent.returnPath);
    setRoute(parsePlatformRoute(intent.returnPath));
    setProcessingLocation(parseProcessingLocation(window.location.pathname, window.location.search));
    setResumeIntent(intent);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [navigate]);

  return (
    <PlatformPreferencesProvider>
      <PlatformShell route={route} onNavigate={navigate} processingView={processingLocation.view} selectedTaskId={processingLocation.taskId} onProcessingNavigate={navigateProcessing} authSession={authSession}>
        <PlatformRoute route={route} onNavigate={navigate} processingLocation={processingLocation} onProcessingNavigate={navigateProcessing} onRequireAuth={requireAuth} onLoginSuccess={loginSuccess} resumeIntent={resumeIntent} authSession={authSession} loginPrompt={loginPrompt} />
      </PlatformShell>
    </PlatformPreferencesProvider>
  );
}
