import { useState } from 'react';
import { deriveDataset } from '../../analysis/dataset.mjs';
import { applyMetadata, confirmMeasured, metadataPreview, qualitySummary } from '../../analysis/workbench.mjs';
import { IMPORT_LIMITS } from '../../analysis/imports.mjs';
import { Check, Field, Select, DataTable } from './Controls.jsx';
export default function GroupEditor({
  dataset,
  dirty,
  onDataset,
  onDirty,
  onError,
  t
}) {
  const [draft, setDraft] = useState(() => structuredClone(dataset.samples)),
    [confirmed, setConfirmed] = useState(false),
    [measured, setMeasured] = useState(false),
    [page, setPage] = useState(0),
    [text, setText] = useState(''),
    [delimiter, setDelimiter] = useState('\t'),
    [preview, setPreview] = useState(null),
    [featurePage, setFeaturePage] = useState(0);
  const edit = (id, key, value) => {
    setDraft(rows => rows.map(s => s.id === id ? {
      ...s,
      [key]: value
    } : s));
    setConfirmed(false);
    onDirty(true);
  };
  const attempt = fn => {
    try {
      fn();
    } catch (e) {
      onError(e);
    }
  };
  const labels = {
    name: t('Name', '名称'),
    group: t('Group', '分组'),
    biologicalUnitId: t('Biological unit ID', '生物学单位 ID'),
    subjectId: t('Subject ID (paired)', '配对主体 ID'),
    batch: t('Batch', '批次'),
    include: t('Include', '纳入')
  };
  return <section className="analysis-section">
  <h2>
    {t('Data & groups', '数据与分组')}
  </h2>
  <p>
    {t('Stable IDs define identity, not names or CAS. Technical replicates are not independent biological units. NA is never zero.', '使用稳定 ID 识别样品和特征，而非名称或 CAS。技术平行不等于独立生物学单位，NA 不等于 0。')}
  </p>
  <div className="analysis-summary">
    {Object.entries(qualitySummary(dataset)).map(([key, n]) => <span key={key}>
      {key}: {n}
    </span>)}
  </div>
 {dataset.provenance.source === 'table-import' && <div className="analysis-notice">
    <Check label={t('I confirm eligible finite unknown values in this generic table are measured observations, not prior imputations. Protected QC/imputed states remain excluded.', '我确认通用表格中符合条件的有限未知值是实测值而非先前补值。受保护的 QC/补值状态保持排除。')} value={measured} onChange={setMeasured} />
    <button disabled={!measured || dirty} onClick={() => attempt(() => onDataset(confirmMeasured(dataset)))}>
      {t('Apply measured-value confirmation', '应用实测确认')}
    </button>
  </div>}
 <div className="analysis-toolbar">
    <button disabled={!page} onClick={() => setPage(page - 1)}>
      {t('Previous', '上一页')}
    </button>
    <span>
      {page + 1}/{Math.ceil(draft.length / 20)}
    </span>
    <button disabled={(page + 1) * 20 >= draft.length} onClick={() => setPage(page + 1)}>
      {t('Next', '下一页')}
    </button>
    <button onClick={() => {
        setDraft(rows => rows.map(s => ({
          ...s,
          biologicalUnitId: s.id
        })));
        setConfirmed(false);
        onDirty(true);
      }}>
      {t('Explicitly assign one biological unit per sample', '明确选择：每个样品一个生物学单位')}
    </button>
  </div>
  <div className="analysis-scroll">
    <table>
      <caption>
        {t('Editable sample metadata — draft until Apply', '样品元数据——应用前为草稿')}
      </caption>
      <thead>
        <tr>
          <th scope="col">ID</th>
          {Object.values(labels).map(label => <th key={label} scope="col">
            {label}
          </th>)}
        </tr>
      </thead>
      <tbody>
        {draft.slice(page * 20, page * 20 + 20).map(s => <tr key={s.id}>
          <th scope="row">
            {s.id}
          </th>
          {Object.entries(labels).map(([key, label]) => <td key={key}>
            {key === 'include' ? <input aria-label={`${s.id} ${label}`} type="checkbox" checked={s.include !== false} onChange={e => edit(s.id, key, e.target.checked)} /> : <input aria-label={`${s.id} ${label}`} value={s[key]} onChange={e => edit(s.id, key, e.target.value)} />}
          </td>)}
        </tr>)}
      </tbody>
    </table>
  </div>
 <Check label={t('I explicitly confirm the declared biological units are independent for the intended design.', '我明确确认所声明的生物学单位在预期实验设计中独立。')} value={confirmed} onChange={v => {
      setConfirmed(v);
      onDirty(true);
    }} />
  <div className="analysis-toolbar">
    <button onClick={() => attempt(() => {
        onDataset(applyMetadata(dataset, draft, confirmed));
        onDirty(false);
      })}>
      {t('Apply metadata snapshot', '应用元数据快照')}
    </button>
    <button onClick={() => {
        setDraft(structuredClone(dataset.samples));
        setConfirmed(false);
        onDirty(false);
      }}>
      {t('Discard metadata draft', '放弃元数据草稿')}
    </button>
    <span>
      {t('Current independence confirmation', '当前独立性确认')}: {String(dataset.provenance.independenceConfirmed)}
    </span>
  </div>
 <details>
    <summary>
      {t('Bulk metadata import (exact unique ID or name)', '批量元数据导入（唯一 ID 或名称精确匹配）')}
    </summary>
    <p>id / name, group, biologicalUnitId, subjectId, batch, include (true / false)</p>
    <Select label={t('Metadata delimiter', '元数据分隔符')} value={delimiter} onChange={setDelimiter} options={[{
        value: ',',
        label: 'CSV'
      }, {
        value: '\t',
        label: 'TSV'
      }]} />
    <Field label={t('Metadata file (UTF-8)', '元数据文件（UTF-8）')}>
      <input type="file" accept=".csv,.tsv,.txt" onChange={async e => {
          try {
            const file = e.target.files[0];
            if (file) {
              if (file.size > IMPORT_LIMITS.maxBytes) throw new Error('FILE_TOO_LARGE');
              setText(await file.text());
              setPreview(null);
            }
          } catch (error) {
            onError(error);
          }
          e.target.value = '';
        }} />
    </Field>
    <Field label={t('Paste metadata', '粘贴元数据')}>
      <textarea value={text} rows={4} onChange={e => {
          setText(e.target.value);
          setPreview(null);
        }} />
    </Field>
    <button onClick={() => attempt(() => setPreview(metadataPreview(dataset, text, delimiter)))}>
      {t('Preview metadata', '预览元数据')}
    </button>
    {preview && <>
      <p role={preview.errors.length ? 'alert' : 'status'}>
        {preview.errors.length ? preview.errors.join('; ') : `${preview.matched} ${t('matched samples', '匹配样品')}`}
      </p>
      <DataTable rows={preview.samples} caption={t('Metadata preview', '元数据预览')} t={t} />
      <button disabled={preview.errors.length > 0} onClick={() => {
          setDraft(preview.samples);
          setConfirmed(false);
          onDirty(true);
          setPreview(null);
        }}>
        {t('Use preview as draft', '将预览用作草稿')}
      </button>
    </>}
  </details>
 <details>
    <summary>
      {t('Feature identities & internal standards', '特征身份与内标')}
    </summary>
    <div className="analysis-toolbar">
      <button disabled={!featurePage} onClick={() => setFeaturePage(featurePage - 1)}>
        {t('Previous', '上一页')}
      </button>
      <button disabled={(featurePage + 1) * 20 >= dataset.features.length} onClick={() => setFeaturePage(featurePage + 1)}>
        {t('Next', '下一页')}
      </button>
    </div>
    {dataset.features.slice(featurePage * 20, featurePage * 20 + 20).map(f => <Check key={f.id} label={`${f.id} · ${f.name} · ${f.cas} · ${f.unit} — ${t('internal standard', '内标')}`} value={f.isInternalStandard} disabled={dirty} onChange={v => onDataset(deriveDataset(dataset, {
        features: dataset.features.map(x => x.id === f.id ? {
          ...x,
          isInternalStandard: v
        } : x)
      }, 'internal-standard-metadata'))} />)}
  </details>
 <DataTable rows={dataset.samples.map((s, i) => ({
      id: s.id,
      name: s.name,
      ...Object.fromEntries(dataset.features.map((f, j) => [`${f.id}: ${f.name}`, dataset.matrix[i][j]]))
    }))} caption={t('Source matrix (unchanged by preprocessing)', '源矩阵（预处理不改写）')} t={t} />
 </section>;
}
