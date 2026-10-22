import { useMemo, useState } from 'react';
import { textPage } from '../../analysis/resultTables.mjs';
export function Field({
  label,
  children
}) {
  return <label className="analysis-field">
  <span>
    {label}
  </span>
  {children}
</label>;
}
export function Select({
  label,
  value,
  onChange,
  options,
  disabled = false
}) {
  const [query, setQuery] = useState(''),
    key = o => typeof o === 'string' ? o : o.value,
    name = o => typeof o === 'string' ? o : o.label;
  const filtered = options.length > 200 ? options.filter(o => String(name(o)).toLowerCase().includes(query.toLowerCase())).slice(0, 200) : options;
  const selected = options.find(o => String(key(o)) === String(value ?? '')),
    visible = selected && !filtered.includes(selected) ? [selected, ...filtered] : filtered;
  return <div>
  {options.length > 200 && <Field label={`${label} — Search / 搜索 (≤200)`}>
    <input value={query} onChange={e => setQuery(e.target.value)} disabled={disabled} />
  </Field>}
  <Field label={label}>
    <select value={value ?? ''} onChange={e => onChange(e.target.value)} disabled={disabled}>
      {visible.map(o => <option key={key(o)} value={key(o)}>
        {name(o)}
      </option>)}
    </select>
  </Field>
</div>;
}
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  integer = false,
  nullable = false
}) {
  return <Field label={label}>
  <input type="number" step={integer ? 1 : 'any'} min={min} max={max} value={value ?? ''} onChange={e => onChange(e.target.value === '' && nullable ? null : e.target.value === '' ? '' : Number(e.target.value))} />
</Field>;
}
export function Check({
  label,
  value,
  onChange,
  disabled = false
}) {
  return <label className="analysis-check">
  <input type="checkbox" checked={value === true} onChange={e => onChange(e.target.checked)} disabled={disabled} />
  <span>
    {label}
  </span>
</label>;
}
export function TextField({
  label,
  value,
  onChange
}) {
  return <Field label={label}>
  <input value={value ?? ''} onChange={e => onChange(e.target.value)} />
</Field>;
}
function CellValue({value,t}) {
  const [expanded,setExpanded]=useState(false),[page,setPage]=useState(0);
  const text=useMemo(()=>value===null||value===undefined?'NA':typeof value==='object'?JSON.stringify(value):String(value),[value]);
  if(text.length<=500)return <span>{text}</span>;
  const fragment=textPage(text,page);
  return <div>
    <span>{expanded?fragment.text:text.slice(0,500)}{!expanded?'…':''}</span>
    <button aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?t('Close full value','收起完整值'):t('Read complete value (paged)','读取完整值（分页）')}</button>
    {expanded&&<div className="analysis-toolbar"><button disabled={!fragment.page} onClick={()=>setPage(fragment.page-1)}>{t('Previous fragment','上一片段')}</button><span>{fragment.page+1}/{fragment.pages} · {text.length} {t('characters','字符')}</span><button disabled={fragment.page===fragment.pages-1} onClick={()=>setPage(fragment.page+1)}>{t('Next fragment','下一片段')}</button></div>}
  </div>;
}
export function DataTable({
  rows,
  columns,
  pinnedColumns = [],
  caption,
  t
}) {
  const [page, setPage] = useState(0),
    [columnPage, setColumnPage] = useState(0),
    size = 20,
    width = Math.max(1,8-pinnedColumns.length);
  const keys = (columns || [...new Set(rows.flatMap(r => Object.keys(r || {})))]).filter(key=>!pinnedColumns.includes(key)),
    last = Math.max(0, Math.ceil(rows.length / size) - 1),
    current = Math.min(page, last),
    currentColumn = Math.min(columnPage, Math.max(0, Math.ceil(keys.length / width) - 1)),
    visible = [...pinnedColumns,...keys.slice(currentColumn * width, currentColumn * width + width)];
  return <div className="analysis-table">
  <div className="analysis-toolbar">
    <span>
      {caption} ({rows.length})</span>
    <button disabled={current === 0} onClick={() => setPage(current - 1)}>
      {t('Previous rows', '上一页')}
    </button>
    <span>
      {current + 1}/{last + 1}
    </span>
    <button disabled={current === last} onClick={() => setPage(current + 1)}>
      {t('Next rows', '下一页')}
    </button>
    {keys.length > width && <>
      <span>{t('Columns','列')}: {currentColumn*width+1}–{Math.min((currentColumn+1)*width,keys.length)}/{keys.length}</span>
      <button disabled={!currentColumn} onClick={() => setColumnPage(currentColumn - 1)}>
        {t('Previous columns', '前列')}
      </button>
      <button disabled={(currentColumn + 1) * width >= keys.length} onClick={() => setColumnPage(currentColumn + 1)}>
        {t('Next columns', '后列')}
      </button>
    </>}
  </div>
  <div className="analysis-scroll">
    <table>
      <caption className="sr-only">
        {caption}
      </caption>
      <thead>
        <tr>
          {visible.map(k => <th key={k} scope="col">
            {k}
          </th>)}
        </tr>
      </thead>
      <tbody>
        {rows.slice(current * size, current * size + size).map((row, i) => <tr key={current*size+i}>
          {visible.map(k => <td key={k}>
            <CellValue value={row[k]} t={t}/>
          </td>)}
        </tr>)}
      </tbody>
    </table>
  </div>
</div>;
}
