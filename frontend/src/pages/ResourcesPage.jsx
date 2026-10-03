import {
  CircleDashed,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  History,
  ShieldCheck,
} from 'lucide-react';

import { usePlatformPreferences } from '../app/PlatformPreferences.jsx';
import './PlatformPages.css';

const REPOSITORY_BASE = 'https://github.com/XQplayer/FlavorInsightAI/blob/main';
const RAW_REPOSITORY_BASE = 'https://raw.githubusercontent.com/XQplayer/FlavorInsightAI/main';

const COPY = Object.freeze({
  zh: {
    status: '已核实资源',
    title: '资源中心',
    description: '仅列出当前可访问的模板与项目文档。尚未发布的材料明确标记为待开放，不提供失效下载入口。',
    policyTitle: '链接发布原则',
    policyDescription: '链接仅指向项目仓库中已存在的文件。模板可直接下载，文档可在仓库中查看。',
    verifiedTitle: '当前可用',
    verifiedDescription: '以下入口已经核对文件路径与访问状态。外部链接将在新标签页打开。',
    verifiedStatus: '可用',
    plannedTitle: '待开放资源',
    plannedDescription: '这些材料尚未形成可公开核验的正式文件，因此只展示范围与状态。',
    plannedStatus: '待开放',
    download: '下载文件',
    view: '查看文档',
    newWindow: '在新标签页打开',
  },
  en: {
    status: 'Verified resources',
    title: 'Resources',
    description: 'Only accessible templates and project documentation are listed. Unreleased materials are clearly marked as coming later and have no dead download links.',
    policyTitle: 'Link publication policy',
    policyDescription: 'Links point only to files that exist in the project repository. Templates can be downloaded directly and documentation can be reviewed in the repository.',
    verifiedTitle: 'Available now',
    verifiedDescription: 'The following paths and access status have been checked. External links open in a new tab.',
    verifiedStatus: 'Available',
    plannedTitle: 'Coming later',
    plannedDescription: 'These materials do not yet exist as formal, publicly verifiable files, so only their scope and status are shown.',
    plannedStatus: 'Coming later',
    download: 'Download file',
    view: 'View document',
    newWindow: 'opens in a new tab',
  },
});

const VERIFIED_RESOURCES = Object.freeze([
  {
    icon: FileSpreadsheet,
    kind: 'download',
    href: `${RAW_REPOSITORY_BASE}/resources/shimadzu/templates/Shimadzu_Raw_Workbook_Example.xlsx`,
    zh: '岛津原始工作簿示例',
    en: 'Shimadzu raw workbook example',
    zhBody: '用于查看工作表与峰表结构的 XLSX 示例文件。',
    enBody: 'An XLSX example showing the expected worksheet and peak-table structure.',
    zhMeta: 'XLSX 示例数据',
    enMeta: 'XLSX example data',
  },
  {
    icon: FileSpreadsheet,
    kind: 'download',
    href: `${RAW_REPOSITORY_BASE}/resources/shimadzu/templates/Shimadzu_Sample_Internal_Standard_Template.xlsx`,
    zh: '样品与内标信息模板',
    en: 'Sample and internal-standard template',
    zhBody: '用于填写样品分组、形态、内标浓度、添加量与体系。',
    enBody: 'An XLSX template for sample groups, form, internal standards, additions, and systems.',
    zhMeta: 'XLSX 模板',
    enMeta: 'XLSX template',
  },
  {
    icon: FileText,
    kind: 'document',
    href: `${REPOSITORY_BASE}/docs/DATA_DICTIONARY.md`,
    zh: 'FlavorThresholdDB 字段字典',
    en: 'FlavorThresholdDB data dictionary',
    zhBody: '说明本地阈值数据集与公开检索界面的稳定字段。',
    enBody: 'Defines stable fields for the local threshold dataset and public search interface.',
    zhMeta: '仓库文档',
    enMeta: 'Repository document',
  },
  {
    icon: Database,
    kind: 'document',
    href: `${REPOSITORY_BASE}/docs/DATA_SOURCES.md`,
    zh: '数据来源与使用边界',
    en: 'Data sources and use boundaries',
    zhBody: '记录数据库来源、证据边界与适用说明。',
    enBody: 'Documents database sources, evidence boundaries, and use guidance.',
    zhMeta: '仓库文档',
    enMeta: 'Repository document',
  },
  {
    icon: History,
    kind: 'document',
    href: `${REPOSITORY_BASE}/CHANGELOG.md`,
    zh: '版本记录',
    en: 'Version history',
    zhBody: '查看已记录的功能变更与修复。',
    enBody: 'Review recorded feature changes and fixes.',
    zhMeta: '更新记录',
    enMeta: 'Change log',
  },
]);

const PLANNED_RESOURCES = Object.freeze([
  {
    zh: '分析流程与 SOP',
    en: 'Analysis workflow and SOP',
    zhBody: '正式流程文件完成核验后再开放。',
    enBody: 'The formal workflow will be linked after verification.',
  },
  {
    zh: '标准数据包字段字典、单位与质量门禁说明',
    en: 'Standard-package fields, units, and quality gates',
    zhBody: '待标准数据包契约稳定后发布。',
    enBody: 'Planned after the standard data package contract is stable.',
  },
  {
    zh: '半定量、阈值选择与 OAV 规则',
    en: 'Semi-quantitation, threshold selection, and OAV rules',
    zhBody: '待科学规则说明形成可核验版本后发布。',
    enBody: 'Planned after the scientific rules have a verifiable release.',
  },
  {
    zh: '结果包解释',
    en: 'Result-package interpretation',
    zhBody: '待标准结果包定型后提供字段与文件说明。',
    enBody: 'Planned after the standard result package is finalized.',
  },
]);

export default function ResourcesPage() {
  const { language } = usePlatformPreferences();
  const copy = COPY[language] ?? COPY.zh;

  return (
    <div className="platform-page platform-status-page platform-resources">
      <section
        className="platform-status-page__hero platform-resources__hero"
        aria-labelledby="resources-title"
      >
        <div className="platform-status-page__hero-copy">
          <span className="platform-status platform-status--live">
            <ShieldCheck aria-hidden="true" />
            {copy.status}
          </span>
          <h1 id="resources-title">{copy.title}</h1>
          <p>{copy.description}</p>
        </div>

        <aside className="platform-resources__policy" aria-labelledby="resources-policy-title">
          <ShieldCheck aria-hidden="true" />
          <div>
            <h2 id="resources-policy-title">{copy.policyTitle}</h2>
            <p>{copy.policyDescription}</p>
          </div>
        </aside>
      </section>

      <section className="platform-resources__section" aria-labelledby="verified-resources-title">
        <div className="platform-status-page__section-heading">
          <h2 id="verified-resources-title">{copy.verifiedTitle}</h2>
          <p>{copy.verifiedDescription}</p>
        </div>
        <div className="platform-resources__verified-grid">
          {VERIFIED_RESOURCES.map(resource => {
            const Icon = resource.icon;
            const title = language === 'en' ? resource.en : resource.zh;
            return (
              <a
                className="platform-resources__verified-card"
                href={resource.href}
                key={resource.href}
                target="_blank"
                rel="noreferrer"
                aria-label={`${title}, ${copy.newWindow}`}
              >
                <div className="platform-resources__verified-card-topline">
                  <span className="platform-resources__resource-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <span className="platform-status platform-status--live">
                    {copy.verifiedStatus}
                  </span>
                </div>
                <p className="platform-resources__meta">
                  {language === 'en' ? resource.enMeta : resource.zhMeta}
                </p>
                <h3>{title}</h3>
                <p>{language === 'en' ? resource.enBody : resource.zhBody}</p>
                <span className="platform-resources__action">
                  {resource.kind === 'download' ? copy.download : copy.view}
                  {resource.kind === 'download'
                    ? <Download aria-hidden="true" />
                    : <ExternalLink aria-hidden="true" />}
                </span>
              </a>
            );
          })}
        </div>
      </section>

      <section className="platform-resources__section" aria-labelledby="planned-resources-title">
        <div className="platform-status-page__section-heading">
          <h2 id="planned-resources-title">{copy.plannedTitle}</h2>
          <p>{copy.plannedDescription}</p>
        </div>
        <div className="platform-resources__planned-grid">
          {PLANNED_RESOURCES.map(resource => (
            <article className="platform-resources__planned-card" key={resource.en}>
              <div className="platform-resources__planned-card-topline">
                <CircleDashed aria-hidden="true" />
                <span className="platform-status platform-status--planned">
                  {copy.plannedStatus}
                </span>
              </div>
              <h3>{language === 'en' ? resource.en : resource.zh}</h3>
              <p>{language === 'en' ? resource.enBody : resource.zhBody}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
