import { lazy, Suspense, useEffect, useState } from 'react';
import { usePlatformPreferences } from '../app/PlatformPreferences.jsx';
import BrowserPcaPage from './BrowserPcaPage.jsx';

const LocalAnalysisWorkbench = lazy(() => import('./LocalAnalysisWorkbench.jsx'));
const currentMode = () => new URLSearchParams(window.location.search).get('engine') === 'local' ? 'local' : 'browser';

export default function DataAnalysisPage({ onNavigate, onRequireAuth, resumeIntent }) {
  const [mode, setMode] = useState(currentMode);
  const { language } = usePlatformPreferences();
  const t = (en, zh) => language === 'zh' ? zh : en;
  useEffect(() => {
    const onPop = () => setMode(currentMode());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const choose = next => {
    const url = new URL(window.location.href);
    if (next === 'local') url.searchParams.set('engine', 'local'); else url.searchParams.delete('engine');
    window.history.pushState({ route: 'analysis', engine: next }, '', url);
    setMode(next);
  };
  return <><nav className="analysis-mode-switch" aria-label={t('Compute engine', '计算引擎')}>
    <button type="button" aria-current={mode === 'browser' ? 'page' : undefined} onClick={() => choose('browser')}>{t('Browser PCA · no local service', '浏览器 PCA · 无需本地服务')}</button>
    <button type="button" aria-current={mode === 'local' ? 'page' : undefined} onClick={() => choose('local')}>{t('Existing local R workbench', '现有本地 R 工作台')}</button>
  </nav>{mode === 'browser'
    ? <div className="analysis-workbench analysis-browser-root"><BrowserPcaPage onRequireAuth={onRequireAuth} resumeIntent={resumeIntent} /></div>
    : <Suspense fallback={<p role="status">{t('Loading local workbench…', '正在加载本地工作台…')}</p>}><LocalAnalysisWorkbench onNavigate={onNavigate} /></Suspense>}
  </>;
}
