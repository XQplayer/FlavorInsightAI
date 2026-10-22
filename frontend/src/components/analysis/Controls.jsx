import { useState } from 'react';
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
export function DataTable({
  rows,
  columns,
  caption,
  t
}) {
  const [page, setPage] = useState(0),
    [columnPage, setColumnPage] = useState(0),
    size = 20,
    width = 8;
  const keys = columns || [...new Set(rows.flatMap(r => Object.keys(r || {})))],
    last = Math.max(0, Math.ceil(rows.length / size) - 1),
    current = Math.min(page, last),
    currentColumn = Math.min(columnPage, Math.max(0, Math.ceil(keys.length / width) - 1)),
    visible = keys.slice(currentColumn * width, currentColumn * width + width);
  const display = v => v === null || v === undefined ? 'NA' : typeof v === 'object' ? JSON.stringify(v) : String(v);
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
        {rows.slice(current * size, current * size + size).map((row, i) => <tr key={i}>
          {visible.map(k => <td key={k}>
            <span title={display(row[k]).slice(0, 500)}>
              {display(row[k]).slice(0, 500)}
            </span>
          </td>)}
        </tr>)}
      </tbody>
    </table>
  </div>
</div>;
}
