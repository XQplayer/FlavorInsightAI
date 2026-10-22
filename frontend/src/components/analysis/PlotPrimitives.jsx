import { Component, useId, useRef, useState } from 'react';
import { DataTable } from './Controls.jsx';
import { boundedPoints, finite, PALETTE, markerEncoding } from '../../analysis/plotModels.mjs';
import { serializeSvg, rasterizeSvg } from '../../analysis/svgExport.mjs';
import { downloadFile } from '../../analysis/download.mjs';
export class PlotBoundary extends Component {
  state = {
    error: null
  };
  static getDerivedStateFromError(error) {
    return {
      error
    };
  }
  render() {
    return this.state.error ? <p role="alert">{this.props.t('Unable to display this result safely. Raw JSON and audit remain available.', '无法安全显示此结果。仍可导出原始 JSON 和审计。')} {String(this.state.error.message)}</p> : this.props.children;
  }
}
export function PlotFrame({
  title,
  description,
  width = 900,
  height = 570,
  metadata = {},
  children,
  t
}) {
  const ref = useRef(null),
    id = useId(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const meta = {
    ...metadata,
    title,
    description,
    pixels: {
      width,
      height
    },
    background: '#ffffff',
    sourceDescription: 'bound completed run.result; presentation only'
  };
  async function save(format) {
    setError('');
    setBusy(true);
    try {
      const text = serializeSvg(ref.current, meta),
        name = `analysis-${String(metadata.runId || 'plot').replace(/[^a-zA-Z0-9_-]/g, '_')}-${String(metadata.view || 'plot').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      if (format === 'svg') downloadFile(`${name}.svg`, text, 'image/svg+xml;charset=utf-8');else {
        const blob = await rasterizeSvg(text, width, height);
        downloadFile(`${name}.png`, blob, 'image/png');
        downloadFile(`${name}-metadata.json`, JSON.stringify({
          ...meta,
          format: 'PNG'
        }, null, 2));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return <figure className="analysis-figure">
    <figcaption><strong>{title}</strong><p>{description}</p></figcaption>
    <div className="analysis-toolbar"><button disabled={busy} onClick={() => save('svg')}>{t('Export this SVG', '导出此 SVG')}</button><button disabled={busy} onClick={() => save('png')}>{t('Export this PNG + metadata', '导出此 PNG + 元数据')}</button><span>{width} × {height} px · {t('opaque background; no automatic DPI claim', '不透明背景；不自动声明 DPI')}</span></div>
    {error && <p role="alert">{error}</p>}
    <div className="analysis-plot-scroll"><svg ref={ref} data-plot={JSON.stringify(meta)} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title ${id}-desc`} xmlns="http://www.w3.org/2000/svg" fontFamily="Arial, sans-serif" fontSize="12" fill="#17212b" style={{
        background: '#fff'
      }}>
      <title id={`${id}-title`}>{title}</title><desc id={`${id}-desc`}>{description}</desc><rect width={width} height={height} fill="#ffffff" />
      <text x="18" y="25" fontSize="16" fontWeight="700">{title.length > 100 ? title.slice(0, 97) + '…' : title}</text>
      {/synthetic/i.test(metadata.datasetName || '') && <text x="18" y="47" fontSize="12" fontWeight="700" fill="#8b2800">{t('SYNTHETIC — not experimental evidence', '合成示例——不是实验证据')}</text>}
      <text x="18" y={height - 10} fontSize="11">{t('Bound run', '绑定运行')}: {metadata.runId} · {t('Full data in tables / exports', '完整数据见表格 / 导出')}</text>
      {children}
    </svg></div>
  </figure>;
}
export function Marker({
  x,
  y,
  index = 0,
  color = '#0072B2',
  label,
  onSelect,
  selected = false
}) {
  const common = {
    fill: color,
    stroke: selected ? '#000' : '#fff',
    strokeWidth: selected ? 2 : 1
  };
  const shape = markerEncoding(index).shape;
  const paths = {
    triangle: `M${x},${y - 6}L${x + 6},${y + 5}L${x - 6},${y + 5}Z`,
    diamond: `M${x},${y - 6}L${x + 6},${y}L${x},${y + 6}L${x - 6},${y}Z`,
    plus: `M${x - 5},${y - 2}H${x - 2}V${y - 5}H${x + 2}V${y - 2}H${x + 5}V${y + 2}H${x + 2}V${y + 5}H${x - 2}V${y + 2}H${x - 5}Z`,
    down: `M${x - 6},${y - 5}L${x + 6},${y - 5}L${x},${y + 6}Z`,
    hexagon: `M${x - 6},${y}L${x - 3},${y - 5}L${x + 3},${y - 5}L${x + 6},${y}L${x + 3},${y + 5}L${x - 3},${y + 5}Z`,
    star: `M${x},${y - 7}L${x + 2},${y - 2}L${x + 7},${y - 2}L${x + 3},${y + 1}L${x + 5},${y + 6}L${x},${y + 3}L${x - 5},${y + 6}L${x - 3},${y + 1}L${x - 7},${y - 2}L${x - 2},${y - 2}Z`,
    left: `M${x - 6},${y}L${x + 5},${y - 6}L${x + 5},${y + 6}Z`
  };
  return <g role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined} aria-label={label} onClick={onSelect} onKeyDown={e => {
    if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onSelect();
    }
  }} style={{
    cursor: onSelect ? 'pointer' : 'default'
  }}>
    <title>{label}</title>
    {shape === 'circle' ? <circle cx={x} cy={y} r="5" {...common} /> : shape === 'square' ? <rect x={x - 5} y={y - 5} width="10" height="10" {...common} /> : shape === 'ring' ? <circle cx={x} cy={y} r="5" fill="#fff" stroke={color} strokeWidth="2" /> : shape === 'hollow-square' ? <rect x={x - 5} y={y - 5} width="10" height="10" fill="#fff" stroke={color} strokeWidth="2" /> : shape === 'cross' ? <path d={`M${x - 5},${y - 5}L${x + 5},${y + 5}M${x + 5},${y - 5}L${x - 5},${y + 5}`} stroke={color} strokeWidth="3" /> : <path d={paths[shape]} {...common} />}
  </g>;
}
function domain(values, zero = false) {
  const clean = values.filter(finite);
  if (!clean.length) return [0, 1];
  let lo = Math.min(...clean),
    hi = Math.max(...clean);
  if (zero) {
    lo = Math.min(0, lo);
    hi = Math.max(0, hi);
  }
  const margin = (hi - lo || Math.max(1, Math.abs(hi))) * .08;
  return [lo - margin, hi + margin];
}
const number = v => finite(v) ? Number(v.toPrecision(4)).toString() : 'NA';
export function ScatterPlot({
  points,
  title,
  xLabel,
  yLabel,
  oneDimensional = false,
  labels = false,
  palette = 'color',
  onSelect,
  selected,
  t,
  metadata = {},
  hline = null,
  vlines = [],
  zeroY = false
}) {
  const model = boundedPoints(points),
    groups = [...new Set(points.map(p => p.group || 'Value'))],
    colors = palette === 'mono' ? ['#111111', '#444444', '#777777'] : PALETTE;
  const xd = domain(model.points.map(p => p.x).concat(vlines)),
    yd = domain(model.points.map(p => p.y).concat(finite(hline) ? [hline] : []), zeroY),
    sx = x => 85 + (x - xd[0]) / (xd[1] - xd[0]) * 710,
    sy = y => 420 - (y - yd[0]) / (yd[1] - yd[0]) * 350;
  const description = `${xLabel}; ${yLabel}. ${t('Displayed finite points / total', '显示有限值点 / 总数')}: ${model.points.length}/${model.total}; ${t('missing/invalid', '缺失/无效')}: ${model.missing}. ${t('First 500 finite points in result order; all rows remain in the table. Labels limited to first 40 displayed points.', '按结果顺序显示前 500 个有限值点；表格保留所有行。标签限于前 40 个显示点。')}${oneDimensional ? ' ' + t('One-dimensional: vertical placement is not a measured component.', '一维：纵向位置不是测量成分。') : ''}`;
  return <>
    <PlotFrame title={title} description={description} t={t} metadata={{
      ...metadata,
      displayed: model.points.length,
      total: model.total,
      missing: model.missing,
      subset: 'first 500 finite points in result order',
      labels,
      palette,
      xLabel,
      yLabel,
      oneDimensional,
      hline,
      vlines
    }}>
      {Array.from({
        length: 5
      }, (_, i) => {
        const x = xd[0] + (xd[1] - xd[0]) * i / 4,
          y = yd[0] + (yd[1] - yd[0]) * i / 4;
        return <g key={i}><line x1={sx(x)} x2={sx(x)} y1="70" y2="420" stroke="#d5dbe0" /><text x={sx(x)} y="440" textAnchor="middle">{number(x)}</text>{!oneDimensional && <><line x1="85" x2="795" y1={sy(y)} y2={sy(y)} stroke="#d5dbe0" /><text x="75" y={sy(y) + 4} textAnchor="end">{number(y)}</text></>}</g>;
      })}
      <path d="M85,70V420H795" fill="none" stroke="#17212b" />
      {finite(hline) && <line x1="85" x2="795" y1={sy(hline)} y2={sy(hline)} stroke="#111" strokeDasharray="6 4"><title>{`Observed / cutoff: ${hline}`}</title></line>}
      {vlines.filter(finite).map((v, i) => <line key={i} x1={sx(v)} x2={sx(v)} y1="70" y2="420" stroke="#111" strokeDasharray="6 4" />)}
      {model.points.map((p, i) => {
        const group = groups.indexOf(p.group || 'Value'),
          x = sx(p.x),
          y = oneDimensional ? 245 : sy(p.y);
        return <g key={`${p.id}-${i}`}><Marker x={x} y={y} index={group} color={colors[group % colors.length]} label={`${p.label || p.id}; ${p.group || ''}; ${xLabel}=${p.x}; ${yLabel}=${oneDimensional ? 'not measured' : p.y}${p.capped ? '; capped display, raw p retained' : ''}`} onSelect={onSelect ? () => onSelect(p) : undefined} selected={selected === p.id} />{labels && i < 40 && <text x={x + 7} y={y - 7} fontSize="10">{String(p.label || p.id).slice(0, 35)}</text>}</g>;
      })}
      <text x="440" y="467" textAnchor="middle">{xLabel}</text><text x="19" y="245" textAnchor="middle" transform="rotate(-90 19 245)">{yLabel}</text>
      {groups.slice(0, 12).map((group, i) => <g key={group}><Marker x={90 + i % 4 * 200} y={492 + Math.floor(i / 4) * 20} index={i} color={colors[i % colors.length]} label={group} /><text x={100 + i % 4 * 200} y={496 + Math.floor(i / 4) * 20}>{String(group).slice(0, 24)}</text></g>)}
    </PlotFrame>
    {groups.length > 12 && <p role="note">{t('More than 12 groups: marker shapes repeat and the legend shows only the first 12. Do not identify later groups by marker alone; exact group IDs for every point are retained in the full data table below.', '超过 12 组：标记形状会重复，图例仅显示前 12 组。请勿仅凭标记识别后续组；下方完整表格保留每个点的确切分组。')}</p>}
    <details><summary>{t('Complete plot data (including missing values)', '完整图形数据（含缺失值）')}</summary><DataTable rows={points.map(p => ({
        id: p.id,
        label: p.label,
        group: p.group,
        x: p.x,
        y: oneDimensional ? null : p.y,
        capped: p.capped ?? false,
        ...p.raw
      }))} caption={title} t={t} /></details>
  </>;
}
