import { EXTERNAL_TOOLS } from '../../analysis/externalTools.mjs';
export default function ExternalTools({
  t
}) {
  return <section className="platform-resources__section" aria-labelledby="external-tools-title">
    <h2 id="external-tools-title">{t('Curated public external references', '精选公共外部参考')}</h2>
    <p>{t('Checked 2026-10-23. Official pages read does not mean algorithms verified. Dynamic controls, account requirements and fees are not fully validated. Not all tools are free. No automatic upload, network probe or embedded iframe. Opening a link leaves this site; review the destination privacy policy before uploading data.', '核对日期 2026-10-23。读取官方页面不等于验证算法。动态控件、账号要求与费用未全面验证，不代表全部免费。不自动上传、不探测网络、不嵌入 iframe。打开链接将离开本站，上传数据前请核查目标平台隐私政策。')}</p>
    <div className="platform-resources__verified-grid">{EXTERNAL_TOOLS.map(tool => <article className="platform-resources__planned-card" key={tool.id}>
      <h3><a href={tool.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{tool.name} ↗</a></h3><p>{t(tool.en, tool.zh)}</p>
    </article>)}</div>
  </section>;
}
