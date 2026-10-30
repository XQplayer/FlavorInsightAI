import { createElement } from 'react';
import { ArrowRight, ArrowUpRight, BrainCircuit, Database, FileCheck2, FlaskConical, LineChart } from 'lucide-react';

import packageMetadata from '../../package.json';
import { usePlatformPreferences } from '../app/PlatformPreferences.jsx';
import { routeHref } from '../app/platformRoutes.js';
import './PlatformHomeV2.css';

const base = import.meta.env.BASE_URL;
const repositoryUrl = 'https://github.com/XQplayer/FlavorInsightAI';

const copy = {
  en: {
    eyebrow: 'FLAVOR INFORMATICS PLATFORM',
    title: 'Make flavor data interpretable research evidence.',
    description: 'Connect FlavorThresholdDB, Shimadzu GC–MS processing and statistical analysis in one traceable research workflow.',
    processing: 'Start data processing', database: 'Explore FlavorThresholdDB',
    previewTitle: 'See the research workspace',
    previewNote: 'Real interfaces from this platform. The analysis example is synthetic, not experimental evidence.',
    previewDatabase: 'Compound search · CAS 106-30-9',
    previewProcessing: 'Shimadzu GC–MS workflow',
    previewAnalysis: 'Data analysis · synthetic example',
    trustTitle: 'Built for the work between raw files and results',
    capabilityLabels: ['Sourced records', 'Instrument processing', 'Statistical analysis', 'Browser-local workflow', 'Reviewable outputs'],
    featuresTitle: 'Four connected capabilities',
    featuresIntro: 'Start with a compound record, an instrument workbook or an analysis-ready dataset.',
    live: 'Available', beta: 'Beta', planned: 'Planned',
    featureActions: { database: 'Explore records', processing: 'Open processing', analysis: 'Open analysis', models: 'Open Model Studio' },
    workflowTitle: 'From raw data to a reviewable result in three steps',
    workflowIntro: 'Each stage has a clear input, a check and an output. Scientific decisions remain visible.',
    advantagesTitle: 'Why FlavorInsight AI',
    advantagesIntro: 'A research workspace designed around evidence, not unsupported claims.',
    faqTitle: 'Frequently asked questions',
    resourceTitle: 'Methods, templates and source notes',
    resourceBody: 'Check supported inputs, source definitions and the current scope of each workspace before starting.',
    resources: 'Browse resources',
    footerPlatform: 'FlavorInsight AI · Food flavor informatics',
    footerVersion: 'Version', footerCitation: 'Methods & citation',
    footerPrivacy: 'Original Shimadzu workbooks are processed in the browser; the analysis service runs locally when configured.',
    footerContact: 'Email maintainer', footerRepository: 'GitHub repository',
  },
  zh: {
    eyebrow: 'FLAVOR INFORMATICS PLATFORM',
    title: '让风味数据成为可解释的科研证据',
    description: '整合 FlavorThresholdDB、岛津 GC–MS 数据处理与统计分析，形成从仪器信号到科研结果的可追溯工作流。',
    processing: '开始数据处理', database: '进入 FlavorThresholdDB',
    previewTitle: '看看真实科研工作台',
    previewNote: '展示本平台的真实页面；数据分析示例为合成数据，不代表实验结果。',
    previewDatabase: '化合物检索 · CAS 106-30-9',
    previewProcessing: '岛津 GC–MS 处理流程',
    previewAnalysis: '数据分析 · 合成示例',
    trustTitle: '连接原始文件与科研结果',
    capabilityLabels: ['来源可查的数据库', '仪器数据处理', '统计分析', '浏览器本地处理', '可复核结果'],
    featuresTitle: '四项核心能力',
    featuresIntro: '可以从化合物记录、仪器工作簿或已整理的数据集开始。',
    live: '已上线', beta: '测试中', planned: '规划中',
    featureActions: { database: '检索记录', processing: '进入处理', analysis: '进入分析', models: '进入模型工作台' },
    workflowTitle: '从原始数据到可复核结果，分三步完成',
    workflowIntro: '每一步都有明确的输入、校核与输出，科研判断过程保留可查。',
    advantagesTitle: '为什么选择 FlavorInsight AI',
    advantagesIntro: '围绕证据链组织工作，而不是只展示最终数字。',
    faqTitle: '常见问题',
    resourceTitle: '方法、模板与来源说明',
    resourceBody: '开始前可核对支持的输入格式、来源定义和各工作台当前开放的范围。',
    resources: '查看资源中心',
    footerPlatform: 'FlavorInsight AI · 食品风味信息学',
    footerVersion: '版本', footerCitation: '方法与引用',
    footerPrivacy: '岛津原始工作簿在浏览器内处理；数据分析服务需在本机配置。',
    footerContact: '联系维护者', footerRepository: 'GitHub 仓库',
  },
};

const capabilities = [
  { icon: Database, en: 'Database search', zh: '数据库检索' },
  { icon: FlaskConical, en: 'GC–MS processing', zh: 'GC–MS 数据处理' },
  { icon: LineChart, en: 'Data analysis', zh: '数据分析' },
  { icon: FileCheck2, en: 'Local-first', zh: '本地优先' },
  { icon: ArrowUpRight, en: 'Traceability', zh: '来源可追溯' },
];

const features = [
  {
    id: 'database', route: 'search', status: 'live', icon: Database,
    en: 'FlavorThresholdDB', zh: 'FlavorThresholdDB 香气阈值数据库',
    enBody: 'Search thresholds, flavor descriptors and compound identities with record-level sources and references.',
    zhBody: '检索香气阈值、风味描述与化合物身份，并查看逐条来源和参考文献。',
    image: 'product-search-preview.png',
    imageAltEn: 'Actual compound search for CAS 106-30-9',
    imageAltZh: '真实化合物检索页面，CAS 106-30-9',
  },
  {
    id: 'processing', route: 'processing', status: 'live', icon: FlaskConical,
    en: 'Shimadzu GC–MS processing', zh: '岛津 GC–MS 数据处理',
    enBody: 'Review raw peak tables through Hit #1, screening, replicates, semi-quantification, statistics and QC before export.',
    zhBody: '从 Hit #1、筛查和平行处理到半定量、统计与 QC，保留各阶段审核线索。',
    image: 'product-processing-preview.png',
    imageAltEn: 'Actual Shimadzu data-processing workbench',
    imageAltZh: '真实岛津数据处理工作台',
  },
  {
    id: 'analysis', route: 'analysis', status: 'beta', icon: LineChart,
    en: 'Statistics and visualizations', zh: '统计分析与图表构建',
    enBody: 'Organize groups, select preprocessing and methods, inspect results and export editable research figures.',
    zhBody: '管理分组、选择预处理和分析方法，检查统计结果并导出可编辑图表。',
    image: 'product-analysis-preview.png',
    imageAltEn: 'Actual data-analysis workbench with a labelled synthetic example',
    imageAltZh: '真实数据分析工作台，显示明确标注的合成示例',
  },
  {
    id: 'models', route: 'models', status: 'beta', icon: BrainCircuit,
    en: 'AI Models & Predictive Evaluation', zh: '智能模型与预测评价',
    enBody: 'Explore predictive relationships among flavor features, fermentation parameters, and analytical responses through model experiments and evaluation.',
    zhBody: '整合风味数据、模型实验与性能评价，探索化合物特征、发酵指标和风味响应之间的预测关系。',
  },
];

const steps = [
  { en: 'Import data', zh: '导入数据', enBody: 'Prepare an instrument workbook, sample metadata or an analysis-ready dataset.', zhBody: '准备仪器工作簿、样品信息或已整理的数据集。' },
  { en: 'Process and review', zh: '处理与校核', enBody: 'Run the established screening and QC steps; inspect exceptions before interpreting results.', zhBody: '按既定流程完成筛查与质量控制，先核对异常再解释结果。' },
  { en: 'Analyze and export', zh: '分析与导出', enBody: 'Link compound evidence, explore statistics and export results with their review context.', zhBody: '关联化合物证据、开展统计分析，并连同复核信息导出结果。' },
];

const advantages = [
  { en: 'Local-first handling', zh: '本地优先', enBody: 'Original Shimadzu workbooks stay in the browser during processing.', zhBody: '岛津原始工作簿在浏览器内处理。' },
  { en: 'Research-oriented rules', zh: '科研导向', enBody: 'Quality gates and method choices remain explicit.', zhBody: '质量门禁与方法选择明确可见。' },
  { en: 'Traceable evidence', zh: '结果可追溯', enBody: 'Records preserve source and review context.', zhBody: '记录保留来源和审核线索。' },
  { en: 'Connected workspaces', zh: '模块一体化', enBody: 'Search, processing and analysis share one platform entry.', zhBody: '检索、处理与分析共用平台入口。' },
  { en: 'Structured export', zh: '标准化导出', enBody: 'Outputs follow the existing scientific data contracts.', zhBody: '结果沿用既定科研数据契约。' },
  { en: 'Room for AI', zh: '可扩展 AI 能力', enBody: 'Model features are reserved for future validated work.', zhBody: '为后续经验证的模型功能预留空间。' },
];

const questions = [
  { id: 'instruments', en: 'Which instruments are supported now?', zh: '当前支持哪些仪器？', enAnswer: 'The active processing workflow supports Shimadzu GC–MS workbooks. GC–O, GC–IMS and GC×GC–MS remain planned.', zhAnswer: '当前可用的是岛津 GC–MS 工作簿处理流程。GC–O、GC–IMS 和 GC×GC–MS 仍处于规划阶段。' },
  { id: 'privacy', en: 'Are original files automatically uploaded?', zh: '原始文件会自动上传吗？', enAnswer: 'No. The Shimadzu workbook is processed in the browser. Database lookup may request external sources when that option is used.', zhAnswer: '不会。岛津工作簿在浏览器内处理；启用外部来源检索时，数据库查询可能请求相应外部服务。' },
  { id: 'sources', en: 'Where do database records come from?', zh: '数据库记录来自哪里？', enAnswer: 'The search workspace labels each available source and keeps record-level source details. Methods and field definitions are linked in Resources.', zhAnswer: '检索工作台标注可用来源，并保留逐条来源信息；方法与字段定义见资源中心。' },
  { id: 'ai', en: 'Is an AI prediction model deployed?', zh: 'AI 预测模型已经上线了吗？', enAnswer: 'No production AI identification or flavor-prediction model is deployed. Model Studio is in beta for workspace design and experiment planning; training and prediction are not enabled.', zhAnswer: '尚未部署生产级 AI 鉴定或风味预测模型。模型工作台目前为测试中的页面与实验规划框架，训练和预测尚未开放。' },
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
  const localText = (item, field) => item[language === 'zh' ? 'zh' + field : 'en' + field];

  return <div className="fi-home">
    <section className="fi-home__hero" aria-labelledby="platform-home-title">
      <div className="fi-home__hero-copy">
        <p className="fi-home__eyebrow">{t.eyebrow} <span>FlavorInsight AI</span></p>
        <h1 id="platform-home-title">{t.title}</h1>
        <p className="fi-home__description">{t.description}</p>
        <div className="fi-home__actions">
          <RouteLink route="processing" onNavigate={onNavigate} className="fi-home__button fi-home__button--primary">{t.processing}<ArrowRight size={18} aria-hidden="true" /></RouteLink>
          <RouteLink route="database" onNavigate={onNavigate} className="fi-home__button fi-home__button--secondary">{t.database}</RouteLink>
        </div>
      </div>
      <div className="fi-home__preview" aria-label={t.previewTitle}>
        <div className="fi-home__preview-heading"><strong>{t.previewTitle}</strong><span>{t.previewNote}</span></div>
        <div className="fi-home__preview-grid">
          {features.slice(0, 3).map(feature => <RouteLink key={feature.id} route={feature.route} onNavigate={onNavigate} className={'fi-home__preview-card fi-home__preview-card--' + feature.id}>
            <img src={base + 'assets/' + feature.image} width="1280" height="720" alt={language === 'zh' ? feature.imageAltZh : feature.imageAltEn} loading={feature.id === 'database' ? 'eager' : 'lazy'} />
            <span>{t['preview' + feature.id[0].toUpperCase() + feature.id.slice(1)]}<ArrowUpRight size={15} aria-hidden="true" /></span>
          </RouteLink>)}
        </div>
      </div>
    </section>

    <section className="fi-home__trust" aria-labelledby="home-trust-title">
      <h2 id="home-trust-title">{t.trustTitle}</h2>
      <ul>{capabilities.map(({ icon: Icon, en, zh }, index) => <li key={en}>{createElement(Icon, { size: 20, 'aria-hidden': true })}<span>{t.capabilityLabels[index] || (language === 'zh' ? zh : en)}</span></li>)}</ul>
    </section>

    <section className="fi-home__features fi-home__section" aria-labelledby="home-features-title">
      <div className="fi-home__section-intro"><h2 id="home-features-title">{t.featuresTitle}</h2><p>{t.featuresIntro}</p></div>
      <div className="fi-home__feature-grid">
        {features.map(feature => {
          const Icon = feature.icon;
          return <article key={feature.id} className={'fi-home__feature fi-home__feature--' + feature.id}>
            <div className="fi-home__feature-copy">
              <div className="fi-home__feature-top">{createElement(Icon, { size: 23, strokeWidth: 1.8, 'aria-hidden': true })}<span className={'fi-home__status fi-home__status--' + feature.status}>{t[feature.status]}</span></div>
              <h3>{localText(feature, '')}</h3>
              <p>{localText(feature, 'Body')}</p>
              <RouteLink route={feature.route} onNavigate={onNavigate} className="fi-home__feature-link">{t.featureActions[feature.id]}<ArrowRight size={17} aria-hidden="true" /></RouteLink>
            </div>
            {feature.image && <img className="fi-home__feature-image" src={base + 'assets/' + feature.image} width="1280" height="720" alt={language === 'zh' ? feature.imageAltZh : feature.imageAltEn} loading="lazy" />}
          </article>;
        })}
      </div>
    </section>

    <section className="fi-home__workflow fi-home__section" aria-labelledby="home-workflow-title">
      <div className="fi-home__section-intro"><h2 id="home-workflow-title">{t.workflowTitle}</h2><p>{t.workflowIntro}</p></div>
      <ol>{steps.map((step, index) => <li key={step.en}><span className="fi-home__step-number">{String(index + 1).padStart(2, '0')}</span><div><h3>{language === 'zh' ? step.zh : step.en}</h3><p>{language === 'zh' ? step.zhBody : step.enBody}</p></div></li>)}</ol>
    </section>

    <section className="fi-home__advantages fi-home__section" aria-labelledby="home-advantages-title">
      <div className="fi-home__section-intro"><h2 id="home-advantages-title">{t.advantagesTitle}</h2><p>{t.advantagesIntro}</p></div>
      <dl>{advantages.map(item => <div key={item.en}><dt>{language === 'zh' ? item.zh : item.en}</dt><dd>{language === 'zh' ? item.zhBody : item.enBody}</dd></div>)}</dl>
    </section>

    <section className="fi-home__faq fi-home__section" aria-labelledby="home-faq-title">
      <div className="fi-home__section-intro"><h2 id="home-faq-title">{t.faqTitle}</h2></div>
      <div className="fi-home__faq-grid">{questions.map(item => <details key={item.id} id={'home-faq-' + item.id}><summary>{language === 'zh' ? item.zh : item.en}<span aria-hidden="true">+</span></summary><p>{language === 'zh' ? item.zhAnswer : item.enAnswer}</p></details>)}</div>
    </section>

    <aside className="fi-home__resources fi-home__section" aria-labelledby="home-resource-title">
      <div><h2 id="home-resource-title">{t.resourceTitle}</h2><p>{t.resourceBody}</p></div>
      <RouteLink route="resources" onNavigate={onNavigate} className="fi-home__button fi-home__button--primary">{t.resources}<ArrowRight size={18} aria-hidden="true" /></RouteLink>
    </aside>

    <footer className="fi-home__footer">
      <div><strong>{t.footerPlatform}</strong><span>{t.footerVersion} {packageMetadata.version}</span><p>{t.footerPrivacy}</p></div>
      <nav aria-label={language === 'zh' ? '页脚链接' : 'Footer links'}>
        <RouteLink route="resources" onNavigate={onNavigate}>{t.footerCitation}</RouteLink>
        <a href={repositoryUrl} target="_blank" rel="noopener noreferrer">{t.footerRepository}<ArrowUpRight size={14} aria-hidden="true" /></a>
        <a href="mailto:hanxq888@gmail.com">{t.footerContact}</a>
      </nav>
    </footer>
  </div>;
}
