import { ArrowRight, Fingerprint, LockKeyhole, ShieldCheck } from 'lucide-react';

import { usePlatformPreferences } from '../app/PlatformPreferences.jsx';
import { routeHref } from '../app/platformRoutes.js';
import './PlatformPages.css';

const PLATFORM_BASE_PATH = import.meta.env.BASE_URL;

const COPY = {
  en: {
    eyebrow: 'A research environment, built for evidence',
    title: 'FlavorInsight AI',
    statement: 'From instrument signals to traceable flavor insight.',
    detail: 'Bring compound identity, flavor evidence, quality control, and analysis into one disciplined workspace.',
    provenance: 'Sources stay visible. Methods stay reviewable.',
    label: 'ACCOUNT ACCESS',
    heading: 'Work locally today.',
    status: 'Account service is not enabled in this local deployment.',
    explanation: 'You do not need an account to use the available database and data-processing tools. No password is requested or submitted here.',
    action: 'Continue locally',
    note: 'Future account access is planned. Existing optional Shimadzu cloud features remain separate.',
  },
  zh: {
    eyebrow: '以证据为基础的科研环境',
    title: 'FlavorInsight AI',
    statement: '从仪器信号走向可追溯的风味解析。',
    detail: '将化合物身份、风味证据、质量控制与分析组织在一个严谨的工作台中。',
    provenance: '来源清晰可见，方法可供复核。',
    label: '账号访问',
    heading: '现在可在本地使用。',
    status: '当前本地部署尚未启用全站账号服务。',
    explanation: '使用已上线的数据库和数据处理工具无需账号。本页不会要求或提交密码。',
    action: '继续本地使用',
    note: '全站账号功能仍在规划中；岛津模块已有的可选云端功能保持独立。',
  },
};

export default function PlatformLoginPage({ onNavigate }) {
  const { language } = usePlatformPreferences();
  const copy = COPY[language] ?? COPY.en;

  const handleContinue = event => {
    if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (typeof onNavigate !== 'function') return;
    event.preventDefault();
    onNavigate('home');
  };

  return (
    <div className="platform-login platform-page">
      <div className="platform-login__layout">
        <section className="platform-login__story" aria-labelledby="login-brand-title">
          <span className="platform-login__eyebrow"><Fingerprint aria-hidden="true" />{copy.eyebrow}</span>
          <h1 id="login-brand-title">{copy.title}</h1>
          <p className="platform-login__statement">{copy.statement}</p>
          <p className="platform-login__detail">{copy.detail}</p>
          <p className="platform-login__provenance"><ShieldCheck aria-hidden="true" />{copy.provenance}</p>
        </section>
        <section className="platform-login__card" aria-labelledby="login-access-title">
          <span className="platform-login__card-kicker"><LockKeyhole aria-hidden="true" />{copy.label}</span>
          <h2 id="login-access-title">{copy.heading}</h2>
          <p className="platform-login__status" role="status">{copy.status}</p>
          <p>{copy.explanation}</p>
          <a className="platform-login__continue" href={routeHref('home', PLATFORM_BASE_PATH)} onClick={handleContinue}>
            {copy.action}<ArrowRight aria-hidden="true" />
          </a>
          <p className="platform-login__note">{copy.note}</p>
        </section>
      </div>
    </div>
  );
}
