import { createElement } from 'react';
import { ArrowRight, Bot, Database, FlaskConical, LineChart, Search } from 'lucide-react';
import { usePlatformPreferences } from '../app/PlatformPreferences.jsx';
import { routeHref } from '../app/platformRoutes.js';
import './PlatformHomeV2.css';

const base = import.meta.env.BASE_URL;
const copy = {
  en: { eyebrow: 'Food flavor informatics', title: 'FlavorInsight AI', lead: 'From instrument data to reviewable flavor evidence.', description: 'Search sourced flavor records, process Shimadzu GC-MS workbooks, and analyze results in one research workspace.', processing: 'Start data processing', database: 'Explore database', search: 'Search a compound', preview: 'Actual database search for CAS 106-30-9. This is a current product screenshot, not a simulated result.', modules: 'Choose your workspace', workflow: 'One traceable research path', workflowNote: 'Each step keeps its source, method and review status. AI prediction is not deployed.', resources: 'Methods and source notes', privacy: 'Raw Shimadzu workbooks are processed in the browser. The analysis service runs locally when configured.', contact: 'Contact maintainer', live: 'Available', beta: 'Beta', planned: 'Planned' },
  zh: { eyebrow: '食品风味信息学', title: 'FlavorInsight AI', lead: '从仪器数据到可复核的风味证据。', description: '在同一科研工作台检索有来源的风味记录、处理岛津 GC-MS 工作簿，并开展结果分析。', processing: '开始数据处理', database: '进入数据库', search: '检索化合物', preview: '真实产品界面：CAS 106-30-9 的数据库检索。截图来自当前页面，非模拟结果。', modules: '选择工作台', workflow: '一条可追溯的研究路径', workflowNote: '每一步保留来源、方法和复核状态；AI 预测尚未部署。', resources: '方法与来源说明', privacy: '岛津原始工作簿在浏览器处理；数据分析计算服务需在本机配置。', contact: '联系维护者', live: '已上线', beta: '测试中', planned: '规划中' },
};
const modules = [
  { route: 'database', status: 'live', icon: Database, en: 'FlavorThresholdDB', zh: 'FlavorThresholdDB 数据库', enBody: 'Thresholds, descriptors, structures and record-level provenance.', zhBody: '阈值、风味描述、结构信息及逐条来源。' },
  { route: 'processing', status: 'live', icon: FlaskConical, en: 'Data processing', zh: '数据处理', enBody: 'Shimadzu GC-MS screening, QC, semi-quantification and export.', zhBody: '岛津 GC-MS 筛查、质控、半定量与导出。' },
  { route: 'analysis', status: 'beta', icon: LineChart, en: 'Data analysis', zh: '数据分析', enBody: 'Local datasets, grouping, statistics and editable visualizations.', zhBody: '本地数据集、分组、统计与可编辑可视化。' },
  { route: null, status: 'planned', icon: Bot, en: 'Intelligent models', zh: '智能模型', enBody: 'Unknown identification and flavor prediction remain research plans.', zhBody: '未知物辅助鉴定与风味预测仍处于研究规划。' },
];
const steps = [
  { en: 'Instrument peak table', zh: '仪器峰表' }, { en: 'Compound identity', zh: '化合物身份' },
  { en: 'Flavor evidence', zh: '风味证据' }, { en: 'QC and analysis', zh: '质控与分析' },
  { en: 'Reviewable results', zh: '可复核结果' },
];

function RouteLink({ route, onNavigate, className, children }) {
  const handleClick = event => {
    if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || typeof onNavigate !== 'function') return;
    event.preventDefault();
    onNavigate(route);
  };
  return <a className={className} href={routeHref(route, base)} onClick={handleClick}>{children}</a>;
}

export default function PlatformHomeV2({ onNavigate }) {
  const { language } = usePlatformPreferences();
  const t = copy[language] ?? copy.en;
  return <div className="fi-home">
    <section className="fi-home__hero" aria-labelledby="platform-home-title">
      <div className="fi-home__hero-copy">
        <p className="fi-home__eyebrow">{t.eyebrow}</p>
        <h1 id="platform-home-title">{t.title}</h1>
        <p className="fi-home__lead">{t.lead}</p>
        <p className="fi-home__description">{t.description}</p>
        <div className="fi-home__actions">
          <RouteLink route="processing" onNavigate={onNavigate} className="fi-home__button fi-home__button--primary">{t.processing}<ArrowRight size={18} aria-hidden="true" /></RouteLink>
          <RouteLink route="database" onNavigate={onNavigate} className="fi-home__button fi-home__button--secondary">{t.database}</RouteLink>
        </div>
        <RouteLink route="search" onNavigate={onNavigate} className="fi-home__search-link"><Search size={17} aria-hidden="true" />{t.search}</RouteLink>
      </div>
      <figure className="fi-home__preview">
        <RouteLink route="search" onNavigate={onNavigate} className="fi-home__preview-link">
          <img src={`${base}assets/product-search-preview.png`} width="1280" height="900" alt={language === 'zh' ? '真实数据库检索界面，显示庚酸乙酯 CAS 106-30-9 的结果' : 'Actual database search interface showing Ethyl heptanoate, CAS 106-30-9'} fetchPriority="high" />
          <span className="fi-home__preview-action"><Search size={16} aria-hidden="true" />{t.search}</span>
        </RouteLink>
        <figcaption>{t.preview}</figcaption>
      </figure>
    </section>
    <section className="fi-home__modules" aria-labelledby="modules-title">
      <h2 id="modules-title">{t.modules}</h2>
      <div className="fi-home__module-grid">{modules.map(({ route, status, icon: Icon, en, zh, enBody, zhBody }) => {
        const content = <><span className="fi-home__module-icon">{createElement(Icon, { size: 23, strokeWidth: 1.8, 'aria-hidden': true })}</span><span className={`fi-home__status fi-home__status--${status}`}>{t[status]}</span><h3>{language === 'zh' ? zh : en}</h3><p>{language === 'zh' ? zhBody : enBody}</p>{route && <ArrowRight className="fi-home__module-arrow" size={20} aria-hidden="true" />}</>;
        return route ? <RouteLink key={en} route={route} onNavigate={onNavigate} className="fi-home__module">{content}</RouteLink> : <article key={en} className="fi-home__module fi-home__module--planned">{content}</article>;
      })}</div>
    </section>
    <section className="fi-home__workflow" aria-labelledby="workflow-title"><div className="fi-home__section-heading"><h2 id="workflow-title">{t.workflow}</h2><p>{t.workflowNote}</p></div><ol>{steps.map((step, index) => <li key={step.en}><span>{String(index + 1).padStart(2, '0')}</span><strong>{step[language] ?? step.en}</strong></li>)}</ol></section>
    <footer className="fi-home__footer"><p>{t.privacy}</p><nav aria-label={language === 'zh' ? '页脚链接' : 'Footer links'}><RouteLink route="resources" onNavigate={onNavigate}>{t.resources}</RouteLink><a href="mailto:hanxq888@gmail.com">{t.contact}</a></nav></footer>
  </div>;
}
