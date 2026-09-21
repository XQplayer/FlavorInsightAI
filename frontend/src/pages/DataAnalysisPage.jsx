import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  Database,
  FileCheck2,
  FileSpreadsheet,
  FlaskConical,
  Network,
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
    status: '建设中',
    title: '数据分析平台',
    description: '规划承接 FlavorInsight 标准数据包，完成统计分析、可视化与可追溯解释。当前不提供上传或分析结果。',
    processingAction: '返回数据处理平台',
    packageEyebrow: '标准数据包',
    packageTitle: '待开发：从合规结果包进入分析项目',
    packageDescription: '未来入口将接收数据处理平台产生的标准结果包，并保留样品分组、化合物身份、质量状态、阈值、OAV、来源与运行参数。',
    packageInput: '计划输入',
    packageInputValue: '标准结果包或合规矩阵',
    packageGuard: '前置要求',
    packageGuardValue: '通过前序质量门禁',
    packageState: '当前状态',
    packageStateValue: '待开发，无上传入口',
    modulesTitle: '规划分析模块',
    modulesDescription: '每项能力均显示真实建设状态。页面不生成示例结果，也不暗示功能已经可用。',
    boundaryTitle: 'AI 能力边界',
    boundaryDescription: '未知物辅助鉴定与风味预测仍处于规划中。当前未部署生产级 AI 模型，也没有可用的 AI 分析结果。',
  },
  en: {
    status: 'In development',
    title: 'Data analysis platform',
    description: 'Planned to accept FlavorInsight standard data packages for statistics, visualization, and traceable interpretation. Upload and analysis results are not available yet.',
    processingAction: 'Back to data processing',
    packageEyebrow: 'Standard data package',
    packageTitle: 'To be developed: move from a compliant result package into an analysis project',
    packageDescription: 'The future entry will accept standard result packages from data processing while preserving sample groups, compound identity, quality status, thresholds, OAV, sources, and run parameters.',
    packageInput: 'Planned input',
    packageInputValue: 'Standard result package or compliant matrix',
    packageGuard: 'Prerequisite',
    packageGuardValue: 'Upstream quality gates passed',
    packageState: 'Current state',
    packageStateValue: 'To be developed, with no upload entry',
    modulesTitle: 'Planned analysis modules',
    modulesDescription: 'Every capability carries its actual delivery status. This page generates no sample results and does not imply that a feature is already available.',
    boundaryTitle: 'AI capability boundary',
    boundaryDescription: 'Unknown-compound assistance and flavor prediction remain planned. No production AI model or AI analysis result is currently available.',
  },
});

const STATUS = Object.freeze({
  building: { zh: '开发中', en: 'In development' },
  planned: { zh: '规划中', en: 'Planned' },
});

const FEATURES = Object.freeze([
  {
    icon: ShieldCheck,
    status: 'building',
    zh: '质量摘要',
    en: 'Quality summary',
    zhBody: '汇总样品、缺失值、补值与质量门禁状态。',
    enBody: 'Summarize samples, missing values, imputation, and quality-gate status.',
  },
  {
    icon: Activity,
    status: 'building',
    zh: 'PCA',
    en: 'PCA',
    zhBody: '探索样品整体差异，并保留预处理参数。',
    enBody: 'Explore overall sample variation while retaining preprocessing parameters.',
  },
  {
    icon: Network,
    status: 'building',
    zh: 'HCA',
    en: 'HCA',
    zhBody: '展示样品或化合物的层次聚类关系。',
    enBody: 'Show hierarchical relationships among samples or compounds.',
  },
  {
    icon: FileSpreadsheet,
    status: 'building',
    zh: '热图',
    en: 'Heatmap',
    zhBody: '在明确标准化方式后呈现矩阵模式。',
    enBody: 'Present matrix patterns with explicit normalization choices.',
  },
  {
    icon: BarChart3,
    status: 'building',
    zh: 'OAV 可视化',
    en: 'OAV visualization',
    zhBody: '读取结果包中的阈值与 OAV 字段，不覆盖前序规则。',
    enBody: 'Read threshold and OAV fields without overriding upstream rules.',
  },
  {
    icon: FlaskConical,
    status: 'planned',
    zh: '差异化合物',
    en: 'Differential compounds',
    zhBody: '规划提供分组比较、效应量与多重检验说明。',
    enBody: 'Planned group comparisons with effect sizes and multiple-testing notes.',
  },
  {
    icon: Database,
    status: 'planned',
    zh: '风味类别',
    en: 'Flavor categories',
    zhBody: '规划连接可追溯的风味描述与类别证据。',
    enBody: 'Planned links to traceable flavor descriptors and category evidence.',
  },
  {
    icon: Search,
    status: 'planned',
    zh: '结构相似性',
    en: 'Structure similarity',
    zhBody: '规划基于明确指纹与参数开展化学信息学比较。',
    enBody: 'Planned cheminformatics comparison with explicit fingerprints and settings.',
  },
  {
    icon: Bot,
    status: 'planned',
    zh: '未知物辅助鉴定',
    en: 'Unknown-compound assistance',
    zhBody: '未来结合谱图、结构与来源证据提供候选提示。',
    enBody: 'Future candidate suggestions grounded in spectra, structures, and source evidence.',
  },
  {
    icon: Sparkles,
    status: 'planned',
    zh: '风味预测',
    en: 'Flavor prediction',
    zhBody: '仅为未来方向，当前没有生产级预测模型。',
    enBody: 'A future direction only; no production prediction model is deployed.',
  },
]);

export default function DataAnalysisPage({ onNavigate }) {
  const { language } = usePlatformPreferences();
  const copy = COPY[language] ?? COPY.zh;

  const handleProcessingNavigation = event => {
    if (typeof onNavigate !== 'function') return;
    event.preventDefault();
    onNavigate('processing');
  };

  return (
    <div className="platform-page platform-status-page platform-analysis">
      <section
        className="platform-status-page__hero"
        aria-labelledby="data-analysis-title"
      >
        <div className="platform-status-page__hero-copy">
          <span className="platform-status platform-status--building">
            <Sparkles aria-hidden="true" />
            {copy.status}
          </span>
          <h1 id="data-analysis-title">{copy.title}</h1>
          <p>{copy.description}</p>
          <a
            className="platform-button platform-button--primary"
            href={routeHref('processing', PLATFORM_BASE_PATH)}
            onClick={handleProcessingNavigation}
          >
            {copy.processingAction}
            <ArrowRight aria-hidden="true" />
          </a>
        </div>

        <aside className="platform-status-page__package" aria-labelledby="analysis-package-title">
          <FileCheck2 aria-hidden="true" />
          <p>{copy.packageEyebrow}</p>
          <h2 id="analysis-package-title">{copy.packageTitle}</h2>
          <p>{copy.packageDescription}</p>
          <dl>
            <div>
              <dt>{copy.packageInput}</dt>
              <dd>{copy.packageInputValue}</dd>
            </div>
            <div>
              <dt>{copy.packageGuard}</dt>
              <dd>{copy.packageGuardValue}</dd>
            </div>
            <div>
              <dt>{copy.packageState}</dt>
              <dd>{copy.packageStateValue}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section
        className="platform-status-page__modules"
        aria-labelledby="analysis-modules-title"
      >
        <div className="platform-status-page__section-heading">
          <h2 id="analysis-modules-title">{copy.modulesTitle}</h2>
          <p>{copy.modulesDescription}</p>
        </div>
        <div className="platform-status-page__feature-grid">
          {FEATURES.map(feature => {
            const Icon = feature.icon;
            const status = STATUS[feature.status];
            return (
              <article
                className={`platform-status-page__feature platform-status-page__feature--${feature.status}`}
                key={feature.en}
              >
                <div className="platform-status-page__feature-heading">
                  <span className="platform-status-page__feature-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <span className={`platform-status platform-status--${feature.status}`}>
                    {status[language] ?? status.zh}
                  </span>
                </div>
                <h3>{language === 'en' ? feature.en : feature.zh}</h3>
                <p>{language === 'en' ? feature.enBody : feature.zhBody}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="platform-status-page__boundary" aria-labelledby="analysis-ai-boundary-title">
        <Bot aria-hidden="true" />
        <div>
          <h2 id="analysis-ai-boundary-title">{copy.boundaryTitle}</h2>
          <p>{copy.boundaryDescription}</p>
        </div>
      </section>
    </div>
  );
}
