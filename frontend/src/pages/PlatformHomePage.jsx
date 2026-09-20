import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDashed,
  Database,
  Download,
  FileCheck2,
  FlaskConical,
  Laptop,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { usePlatformPreferences } from '../app/PlatformPreferences.jsx';
import { routeHref } from '../app/platformRoutes.js';
import './PlatformPages.css';

const PLATFORM_BASE_PATH = import.meta.env.BASE_URL;

const COPY = Object.freeze({
  zh: {
    eyebrow: '食品风味化学 · 风味组学 · 化学信息学',
    title: 'FlavorInsight AI 食品风味信息学智能分析平台',
    lead: '从仪器信号到可解释的风味证据',
    description: '以 FlavorThresholdDB 为数据基础，连接可追溯的化合物检索、GC–MS 标准化处理与风味贡献评价，为研究过程保留来源、规则和质量门禁。',
    databaseAction: '进入数据库',
    processingAction: '开始数据处理',
    searchAction: '检索化合物',
    previewLabel: '已上线能力预览',
    previewTitle: '一条 CAS，连接身份、结构与风味证据',
    previewNote: '示例仅展示平台已支持的信息组织方式；结果仍以实际检索来源为准。',
    chainEyebrow: '研究工作链',
    chainTitle: '从原始峰表到可复核结论',
    chainDescription: '已上线模块直接进入真实工作台；后续能力以明确状态展示，不将规划功能描述为可用结果。',
    modulesEyebrow: '平台模块',
    modulesTitle: '一个入口，分层承载数据库与分析工作台',
    principlesEyebrow: '设计原则',
    principlesTitle: '让每一步结果都能解释、检查和复用',
    faqEyebrow: '常见问题',
    faqTitle: '使用前需要知道的边界',
    footer: 'FlavorInsight AI · 当前本地版本 v1.5.0',
    contact: '联系维护者',
  },
  en: {
    eyebrow: 'Flavor chemistry · Flavoromics · Cheminformatics',
    title: 'FlavorInsight AI Food Flavor Informatics Platform',
    lead: 'From instrumental signals to interpretable flavor evidence',
    description: 'Built on FlavorThresholdDB, the platform connects traceable compound search, standardized GC–MS processing, and flavor-contribution assessment while preserving sources, rules, and quality gates.',
    databaseAction: 'Open database',
    processingAction: 'Start processing',
    searchAction: 'Search compounds',
    previewLabel: 'Live capability preview',
    previewTitle: 'One CAS connects identity, structure, and flavor evidence',
    previewNote: 'This example shows the supported information structure; actual results remain tied to their retrieved sources.',
    chainEyebrow: 'Research workflow',
    chainTitle: 'From raw peak tables to reviewable conclusions',
    chainDescription: 'Live modules open real workbenches. Future capabilities carry explicit status labels and are never presented as available results.',
    modulesEyebrow: 'Platform modules',
    modulesTitle: 'One entry point for a database and scientific workbenches',
    principlesEyebrow: 'Platform principles',
    principlesTitle: 'Make every result explainable, reviewable, and reusable',
    faqEyebrow: 'FAQ',
    faqTitle: 'Boundaries to understand before use',
    footer: 'FlavorInsight AI · Local version v1.5.0',
    contact: 'Contact maintainer',
  },
});

const STATUS = Object.freeze({
  live: { zh: '已上线', en: 'Live', icon: CheckCircle2 },
  building: { zh: '开发中', en: 'In development', icon: Sparkles },
  planned: { zh: '规划中', en: 'Planned', icon: CircleDashed },
});

const WORKFLOW = Object.freeze([
  { icon: Activity, zh: '仪器数据', en: 'Instrument data', status: 'live' },
  { icon: FlaskConical, zh: '化合物鉴定', en: 'Compound identification', status: 'live' },
  { icon: Database, zh: '风味数据库', en: 'Flavor database', status: 'live' },
  { icon: ShieldCheck, zh: '风味贡献评价', en: 'Flavor contribution', status: 'building' },
  { icon: Bot, zh: 'AI 解析与预测', en: 'AI interpretation and prediction', status: 'planned' },
]);

const MODULES = Object.freeze([
  {
    icon: Database,
    status: 'live',
    route: 'database',
    zh: 'FlavorThresholdDB 香气阈值与风味描述检索库',
    en: 'FlavorThresholdDB aroma threshold and descriptor database',
    zhBody: '检索 CAS、中英文名称、阈值、气味描述、来源及结构关联信息。',
    enBody: 'Search CAS, names, thresholds, odor descriptors, sources, and structure-linked evidence.',
  },
  {
    icon: FlaskConical,
    status: 'live',
    route: 'processing',
    zh: '数据处理平台',
    en: 'Data processing platform',
    zhBody: '在本地完成岛津 GC–MS 峰表筛查、质量控制、半定量、化合物补充与导出。',
    enBody: 'Process Shimadzu GC–MS peak tables locally with screening, QC, semi-quantification, enrichment, and export.',
  },
  {
    icon: Activity,
    status: 'building',
    route: 'analysis',
    zh: '数据分析平台',
    en: 'Data analysis platform',
    zhBody: '规划承接标准化结果包的统计分析、差异解析与可视化。',
    enBody: 'Being developed for statistical analysis, differential interpretation, and visualization of standardized result packages.',
  },
  {
    icon: Download,
    status: 'planned',
    route: 'resources',
    zh: '资源中心',
    en: 'Resource center',
    zhBody: '逐步整理可验证的模板、方法说明与数据规范；未就绪资源不会提供虚假下载。',
    enBody: 'Will curate verified templates, methods, and data specifications; unavailable resources never appear as fake downloads.',
  },
]);

function StatusPill({ status, language }) {
  const definition = STATUS[status];
  const Icon = definition.icon;
  return (
    <span className={`platform-status platform-status--${status}`}>
      <Icon aria-hidden="true" size={15} strokeWidth={2} />
      {definition[language] ?? definition.zh}
    </span>
  );
}

function isNormalLeftClick(event) {
  return event.button === 0
    && !event.altKey
    && !event.ctrlKey
    && !event.metaKey
    && !event.shiftKey;
}

export default function PlatformHomePage({ onNavigate }) {
  const { language } = usePlatformPreferences();
  const copy = COPY[language] ?? COPY.zh;

  const handleNavigation = (event, route) => {
    if (isNormalLeftClick(event) && typeof onNavigate === 'function') {
      event.preventDefault();
      onNavigate(route);
    }
  };

  return (
    <div className="platform-page platform-home">
      <section className="platform-home__hero" aria-labelledby="platform-home-title">
        <div className="platform-home__hero-copy platform-home__reveal">
          <p className="platform-page__eyebrow">{copy.eyebrow}</p>
          <h1 id="platform-home-title">{copy.title}</h1>
          <p className="platform-home__lead">{copy.lead}</p>
          <p className="platform-home__description">{copy.description}</p>
          <div className="platform-home__actions">
            <a
              className="platform-button platform-button--primary"
              href={routeHref('database', PLATFORM_BASE_PATH)}
              onClick={event => handleNavigation(event, 'database')}
            >
              {copy.databaseAction}
              <ArrowRight aria-hidden="true" size={18} />
            </a>
            <a
              className="platform-button platform-button--secondary"
              href={routeHref('processing', PLATFORM_BASE_PATH)}
              onClick={event => handleNavigation(event, 'processing')}
            >
              {copy.processingAction}
            </a>
          </div>
          <a
            className="platform-home__text-link"
            href={routeHref('search', PLATFORM_BASE_PATH)}
            onClick={event => handleNavigation(event, 'search')}
          >
            <Search aria-hidden="true" size={17} />
            {copy.searchAction}
          </a>
        </div>

        <div className="platform-home__capability-preview platform-home__reveal" aria-label={copy.previewLabel}>
          <div className="platform-home__preview-header">
            <div>
              <span>{copy.previewLabel}</span>
              <h2>{copy.previewTitle}</h2>
            </div>
            <StatusPill status="live" language={language} />
          </div>
          <div className="platform-home__compound-card">
            <div className="platform-home__compound-identity">
              <span className="platform-home__compound-index">01</span>
              <div>
                <strong>{language === 'zh' ? '乙酸乙酯' : 'Ethyl acetate'}</strong>
                <span>CAS 141-78-6</span>
              </div>
            </div>
            <dl>
              <div><dt>{language === 'zh' ? '类别' : 'Class'}</dt><dd>{language === 'zh' ? '酯类' : 'Ester'}</dd></div>
              <div><dt>{language === 'zh' ? '证据' : 'Evidence'}</dt><dd>PubChem · FEMA · FlavorDB2</dd></div>
              <div><dt>{language === 'zh' ? '输出' : 'Output'}</dt><dd>{language === 'zh' ? '来源与规则可追溯' : 'Traceable sources and rules'}</dd></div>
            </dl>
          </div>
          <p className="platform-home__preview-note">{copy.previewNote}</p>
        </div>
      </section>

      <section className="platform-section platform-section--chain" aria-labelledby="workflow-title">
        <header className="platform-section__heading">
          <p className="platform-page__eyebrow">{copy.chainEyebrow}</p>
          <h2 id="workflow-title">{copy.chainTitle}</h2>
          <p>{copy.chainDescription}</p>
        </header>
        <ol className="platform-home__workflow">
          {WORKFLOW.map((item, index) => {
            const Icon = item.icon;
            return (
              <li key={item.zh}>
                <span className="platform-home__workflow-index">{String(index + 1).padStart(2, '0')}</span>
                <Icon aria-hidden="true" size={22} strokeWidth={1.8} />
                <strong>{item[language] ?? item.zh}</strong>
                <StatusPill status={item.status} language={language} />
              </li>
            );
          })}
        </ol>
      </section>

      <section className="platform-section" aria-labelledby="modules-title">
        <header className="platform-section__heading platform-section__heading--compact">
          <p className="platform-page__eyebrow">{copy.modulesEyebrow}</p>
          <h2 id="modules-title">{copy.modulesTitle}</h2>
        </header>
        <div className="platform-home__module-grid">
          {MODULES.map((module, index) => {
            const Icon = module.icon;
            const title = language === 'en' ? module.en : module.zh;
            const body = language === 'en' ? module.enBody : module.zhBody;
            return (
              <article className={`platform-home__module-card platform-home__module-card--${index + 1}`} key={module.route}>
                <div className="platform-home__module-topline">
                  <span className="platform-home__module-icon"><Icon aria-hidden="true" size={22} /></span>
                  <StatusPill status={module.status} language={language} />
                </div>
                <h3>{title}</h3>
                <p>{body}</p>
                <a
                  href={routeHref(module.route, PLATFORM_BASE_PATH)}
                  onClick={event => handleNavigation(event, module.route)}
                >
                  {language === 'zh' ? '查看模块' : 'View module'}
                  <ArrowRight aria-hidden="true" size={17} />
                </a>
              </article>
            );
          })}
        </div>
      </section>

      <section className="platform-section platform-section--principles" aria-labelledby="principles-title">
        <header className="platform-section__heading">
          <p className="platform-page__eyebrow">{copy.principlesEyebrow}</p>
          <h2 id="principles-title">{copy.principlesTitle}</h2>
        </header>
        <div className="platform-home__principles">
          <article><ShieldCheck aria-hidden="true" /><h3>证据可追溯</h3><p>{language === 'zh' ? '保留来源、检索时间与分类规则。' : 'Preserve sources, query time, and classification rules.'}</p></article>
          <article><FileCheck2 aria-hidden="true" /><h3>质量门禁</h3><p>{language === 'zh' ? '关键阶段先检查，再进入后续计算。' : 'Validate critical stages before downstream calculations.'}</p></article>
          <article><Laptop aria-hidden="true" /><h3>本地优先</h3><p>{language === 'zh' ? '原始工作簿在当前设备处理，不会自动上传。' : 'Raw workbooks are processed on this device and are not uploaded automatically.'}</p></article>
          <article><Download aria-hidden="true" /><h3>标准化导出</h3><p>{language === 'zh' ? '主结果保持简洁，审核信息独立保留。' : 'Keep primary results concise and retain audit evidence separately.'}</p></article>
        </div>
      </section>

      <section className="platform-section platform-section--faq" aria-labelledby="faq-title">
        <header className="platform-section__heading platform-section__heading--compact">
          <p className="platform-page__eyebrow">{copy.faqEyebrow}</p>
          <h2 id="faq-title">{copy.faqTitle}</h2>
        </header>
        <div className="platform-home__faq-list">
          <details><summary>{language === 'zh' ? '平台目前哪些功能可以直接使用？' : 'Which capabilities are available now?'}</summary><p>{language === 'zh' ? 'FlavorThresholdDB 检索与岛津 GC–MS 数据处理已上线；数据分析页用于呈现开发范围。' : 'FlavorThresholdDB search and Shimadzu GC–MS processing are live; the analysis page documents the development scope.'}</p></details>
          <details><summary>{language === 'zh' ? '原始工作簿会上传云端吗？' : 'Are raw workbooks uploaded to the cloud?'}</summary><p>{language === 'zh' ? '不会。当前处理在本机浏览器与本地服务中完成，账号与可选云端留存仍在规划。' : 'No. Current processing runs in the local browser and service; accounts and optional cloud retention remain planned.'}</p></details>
          <details><summary>{language === 'zh' ? '化合物分类和阈值结果能否复核？' : 'Can classification and threshold results be reviewed?'}</summary><p>{language === 'zh' ? '可以。设计保留 CAS、结构来源、规则命中、阈值原值、单位与来源，供审核表复核。' : 'Yes. The design retains CAS, structure source, rule hits, original threshold value, unit, and provenance for review.'}</p></details>
          <details><summary>{language === 'zh' ? 'AI 预测现在是否已经部署？' : 'Is AI prediction deployed now?'}</summary><p>{language === 'zh' ? '当前未部署生产级 AI 模型。未知物辅助鉴定、结构—气味关系和风味预测属于后续规划。' : 'No production AI model is deployed. Unknown-compound assistance, structure–odor relationships, and flavor prediction are planned work.'}</p></details>
        </div>
      </section>

      <footer className="platform-home__footer">
        <span>{copy.footer}</span>
        <a href="mailto:hanxq888@gmail.com">{copy.contact}</a>
      </footer>
    </div>
  );
}
