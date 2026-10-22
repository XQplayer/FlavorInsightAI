import { useState } from 'react';
import { DataTable, Select } from './Controls.jsx';
import { isRunStale } from '../../analysis/workbench.mjs';
import { downloadFile } from '../../analysis/download.mjs';
import { serviceError } from '../../analysis/client.mjs';
import { resultTable } from '../../analysis/resultTables.mjs';
function ArrayTable({value,name,context,t}) {
  const table=resultTable(value,{name,context});
  return <>
    {table.columnAxis&&<p>{t('Rows','行')}: {table.rowAxis}; {t('Columns','列')}: {table.columnAxis}; {value.length} × {table.width}. {t('Every matrix cell is accessible through row/column paging.','所有矩阵单元格均可通过行/列分页访问。')}</p>}
    <DataTable {...table} caption={name} t={t}/>
  </>;
}
function JsonBranch({
  value,
  name,
  context = {},
  t
}) {
  const [open, setOpen] = useState(false);
  if (value === null || typeof value !== 'object') return <p>
  <strong>
    {name}: </strong>
  {value === null ? 'NA' : String(value)}
</p>;
  return <div className="analysis-json">
  <button aria-expanded={open} onClick={() => setOpen(!open)}>
    {open ? '−' : '+'} {name} {Array.isArray(value) ? `(${value.length})` : ''}
  </button>
  {open && (Array.isArray(value) ? <ArrayTable value={value} name={name} context={context} t={t} /> : Object.entries(value).map(([key, entry]) => <JsonBranch key={key} name={key} value={entry} context={{...context,...value}} t={t} />))}
</div>;
}
export default function ResultsPanel({
  runs,
  dataset,
  recipe,
  analysis,
  onRetry,
  disabled,
  t
}) {
  const [selected, setSelected] = useState(''),
    run = runs.find(r => r.id === selected) || runs.at(-1);
  return <section className="analysis-section">
  <h2>
    {t('Results & audit', '结果与审计')}
  </h2>
  {!run ? <p>
    {t('No runs yet. Results appear only after actual service execution.', '尚无运行。仅展示实际服务计算结果。')}
  </p> : <>
    <Select label={t('Run history', '运行历史')} value={run.id} onChange={setSelected} options={runs.map(r => ({
        value: r.id,
        label: `${r.request.analysis.method} · ${r.status} · ${r.id}`
      }))} />
    <p>
      {t('Snapshot', '快照')}: {run.request.dataset.id}
    </p>
    <p>
      {t('Request SHA-256', '请求 SHA-256')}: {run.requestHash || t('Not returned by service', '服务未返回')}
    </p>
    <p>
      {t('Status', '状态')}: {run.status} {isRunStale(run, dataset, recipe, analysis) && <strong> — {t('STALE: bound to an older snapshot or settings', '旧结果：绑定较早快照或设置')}
      </strong>}
    </p>
    <div className="analysis-toolbar">
      <button onClick={() => downloadFile(`analysis-${run.id}-request.json`, JSON.stringify(run.request, null, 2))}>
        {t('Export exact request', '导出精确请求')}
      </button>
      <button onClick={() => downloadFile(`analysis-${run.id}-result.json`, JSON.stringify(run, null, 2))}>
        {t('Export raw result & audit JSON', '导出原始结果及审计 JSON')}
      </button>
      <button disabled={disabled} onClick={() => onRetry(run.request)}>
        {t('Retry as NEW run using this exact bound request', '以此绑定请求新建运行重试')}
      </button>
    </div>
    {run.error && <p role="alert">
      {t(serviceError(run.error, 'en'), serviceError(run.error, 'zh'))}
    </p>}
    {run.result && <>
      <JsonBranch name={t('Provenance', '来源')} value={run.result.provenance} t={t} />
      {run.result.data?.fullFit && <section>
        <h3>
          {t('Full-fit descriptive results — NOT held-out validation', '全数据拟合描述结果——不是留出验证')}
        </h3>
        <p>
          {t('VIP is not a p value or causal evidence.', 'VIP 不是 p 值或因果证据。')}
        </p>
        <JsonBranch name="fullFit" value={run.result.data.fullFit} t={t} />
      </section>}
      {run.result.data?.validation && <section>
        <h3>
          {t('Held-out nested validation', '留出嵌套验证')}
        </h3>
        <JsonBranch name="validation" value={run.result.data.validation} t={t} />
        <JsonBranch name="permutation" value={run.result.data.permutation} t={t} />
      </section>}
      {Object.entries(run.result.data || {}).filter(([key]) => !['fullFit', 'validation', 'permutation'].includes(key)).map(([key, value]) => <JsonBranch key={key} name={key} value={value} context={run.result.data} t={t} />)}
      <JsonBranch name={t('Preprocessing & audit', '预处理与审计')} value={run.result.preprocessing} t={t} />
    </>}
  </>}
</section>;
}
