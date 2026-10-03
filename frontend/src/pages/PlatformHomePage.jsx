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
    title: 'FlavorInsight AI',
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
    title: 'FlavorInsight AI',
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
  live: { zh: '已上线', en: 'Available', icon: CheckCircle2 },
  beta: { zh: '测试中', en: 'Beta', icon: FlaskConical },
  building: { zh: '开发中', en: 'In development', icon: Sparkles },
  planned: { zh: '规划中', en: 'Planned', icon: CircleDashed },
});

const WORKFLOW = Object.freeze([
  { icon: Activity, zh: '仪器数据', en: 'Instrument data', statuses: ['live'] },
  { icon: FlaskConical, zh: '化合物鉴定', en: 'Compound identification', statuses: ['live'] },
  { icon: Database, zh: '风味数据库', en: 'Flavor database', statuses: ['live'] },
  { icon: ShieldCheck, zh: '风味贡献评价', en: 'Flavor contribution', statuses: ['beta'] },
  { icon: Bot, zh: '数据分析与 AI', en: 'Data analysis and AI', statuses: ['building', 'planned'] },
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
    route: null,
    zh: '数据分析平台',
    en: 'Data analysis platform',
    zhBody: '规划承接标准化结果包的统计分析、差异解析与可视化。',
    enBody: 'Being developed for statistical analysis, differential interpretation, and visualization of standardized result packages.',
  },
  {
    icon: Bot,
    status: 'planned',
    route: null,
    zh: '多仪器与 AI',
    en: 'Multi-instrument and AI',
    zhBody: 'GC–O、GC–IMS、GC×GC–MS 适配，以及结构—气味关系、未知物辅助鉴定和风味预测均处于规划阶段。',
    enBody: 'GC–O, GC–IMS, GC×GC–MS support, structure–odor analysis, unknown identification, and flavor prediction remain planned.',
  },
  {
    icon: FileCheck2,
    status: 'live',
    route: 'resources',
    zh: '资源中心',
    en: 'Resources',
    zhBody: '获取已核验的模板和项目说明，规划资源不提供虚假下载入口。',
    enBody: 'Access verified templates and documentation; planned resources have no fake download links.',
  },
]);

const PRINCIPLES = Object.freeze([
  {
    icon: ShieldCheck,
    zh: '证据可追溯',
    en: 'Traceable evidence',
    zhBody: '保留来源、检索时间与分类规则。',
    enBody: 'Preserve sources, query time, and classification rules.',
  },
  {
    icon: FileCheck2,
    zh: '质量门禁',
    en: 'Quality gates',
    zhBody: '关键阶段先检查，再进入后续计算。',
    enBody: 'Validate critical stages before downstream calculations.',
  },
  {
    icon: Laptop,
    zh: '本地优先',
    en: 'Local-first',
    zhBody: '原始工作簿在当前设备处理，不会自动上传。',
    enBody: 'Raw workbooks are processed on this device and are not uploaded automatically.',
  },
  {
    icon: Download,
    zh: '标准化导出',
    en: 'Standardized export',
    zhBody: '主结果保持简洁，审核信息独立保留。',
    enBody: 'Keep primary results concise and retain audit evidence separately.',
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
          <div className="platform-home__process-preview" aria-label={language === 'zh' ? '数据处理流程预览' : 'Processing workflow preview'}>
            <span>{language === 'zh' ? '原始峰表' : 'Raw peak table'}</span>
            <ArrowRight aria-hidden="true" size={15} />
            <span>{language === 'zh' ? '质量门禁' : 'Quality gates'}</span>
            <ArrowRight aria-hidden="true" size={15} />
            <span>{language === 'zh' ? '半定量 · 阈值' : 'Semi-quant · Threshold'}</span>
            <ArrowRight aria-hidden="true" size={15} />
            <span>{language === 'zh' ? '审核结果包' : 'Auditable result package'}</span>
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
                <span className="platform-home__workflow-statuses">
                  {item.statuses.map(status => (
                    <StatusPill status={status} language={language} key={status} />
                  ))}
                </span>
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
              <article className={`platform-home__module-card platform-home__module-card--${index + 1}`} key={module.zh}>
                <div className="platform-home__module-topline">
                  <span className="platform-home__module-icon"><Icon aria-hidden="true" size={22} /></span>
                  <StatusPill status={module.status} language={language} />
                </div>
                <h3>{title}</h3>
                <p>{body}</p>
                {module.route ? (
                  <a
                    href={routeHref(module.route, PLATFORM_BASE_PATH)}
                    onClick={event => handleNavigation(event, module.route)}
                  >
                    {language === 'zh' ? '查看模块' : 'View module'}
                    <ArrowRight aria-hidden="true" size={17} />
                  </a>
                ) : (
                  <span className="platform-home__planned-note">
                    {language === 'zh' ? '不提供未就绪入口' : 'No unavailable entry is shown'}
                  </span>
                )}
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
          {PRINCIPLES.map(principle => {
            const Icon = principle.icon;
            return (
              <article key={principle.zh}>
                <Icon aria-hidden="true" />
                <h3>{principle[language] ?? principle.zh}</h3>
                <p>{language === 'en' ? principle.enBody : principle.zhBody}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="platform-section platform-section--faq" aria-labelledby="faq-title">
        <header className="platform-section__heading platform-section__heading--compact">
          <p className="platform-page__eyebrow">{copy.faqEyebrow}</p>
          <h2 id="faq-title">{copy.faqTitle}</h2>
        </header>
        <div className="platform-home__faq-list">
          <details><summary>{language === 'zh' ? '原始工作簿会上传云端吗？' : 'Are raw workbooks uploaded to the cloud?'}</summary><p>{language === 'zh' ? '不会。当前处理在本机浏览器与本地服务中完成，账号与可选云端留存仍在规划。' : 'No. Current processing runs in the local browser and service; accounts and optional cloud retention remain planned.'}</p></details>
          <details><summary>{language === 'zh' ? '当前支持哪些仪器？' : 'Which instruments are supported now?'}</summary><p>{language === 'zh' ? '当前已上线岛津 GC–MS 工作簿处理。GC–O、GC–IMS、GC×GC–MS 与其他厂商格式处于规划阶段。' : 'Shimadzu GC–MS workbook processing is live. GC–O, GC–IMS, GC×GC–MS, and other vendor formats remain planned.'}</p></details>
          <details><summary>{language === 'zh' ? '数据库信息来自哪里？' : 'Where does database information come from?'}</summary><p>{language === 'zh' ? '平台整合 FlavorThresholdDB 本地档案，并按字段标注 FEMA、FlavorDB2、PubChem、书籍与其他可核验来源；具体记录以检索结果所示来源为准。' : 'The platform combines local FlavorThresholdDB records with field-level FEMA, FlavorDB2, PubChem, book, and other verifiable sources; each record is governed by the provenance shown in its result.'}</p></details>
          <details><summary>{language === 'zh' ? 'AI 预测现在是否已经部署？' : 'Is AI prediction deployed now?'}</summary><p>{language === 'zh' ? '当前未部署生产级 AI 模型。未知物辅助鉴定、结构—气味关系和风味预测属于后续规划。' : 'No production AI model is deployed. Unknown-compound assistance, structure–odor relationships, and flavor prediction are planned work.'}</p></details>
        </div>
      </section>

      <footer className="platform-home__footer">
        <div className="platform-home__footer-meta">
          <strong>{copy.footer}</strong>
          <span>{language === 'zh' ? '引用说明：使用结果时请同时引用原始数据来源。' : 'Citation: cite the original data sources alongside platform outputs.'}</span>
          <span>{language === 'zh' ? '隐私说明：原始工作簿默认仅在本地处理，不会自动上传。' : 'Privacy: raw workbooks are processed locally by default and are not uploaded automatically.'}</span>
        </div>
        <nav aria-label={language === 'zh' ? '页脚链接' : 'Footer links'}>
          <a
            href={routeHref('resources', PLATFORM_BASE_PATH)}
            onClick={event => handleNavigation(event, 'resources')}
          >
            {language === 'zh' ? '资源中心' : 'Resources'}
          </a>
          <a href="mailto:hanxq888@gmail.com">{copy.contact}</a>
        </nav>
      </footer>
    </div>
  );
}
