import { finite, identity, treeSegments, valueLimits, matrixScaleLabel, plotBinding } from '../../analysis/plotModels.mjs';
import { PlotFrame } from './PlotPrimitives.jsx';
function mix(a, b, t) {
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, t)))).join(',')})`;
}
export default function MatrixPlot({
  model,
  run,
  title,
  t,
  onSelect,
  rowTree,
  columnTree,
  correlation = false
}) {
  const d = run.result.data,
    [lo, hi] = correlation ? [-1, 1] : valueLimits((d.matrix || []).flat());
  const scaleLabel = correlation ? {
      en: 'Correlation r (center 0)',
      zh: '相关系数 r（中心 0）'
    } : matrixScaleLabel(run),
    scale = t(scaleLabel.en, scaleLabel.zh);
  const diverging = correlation || ['feature-z', 'sample-z'].includes(d.displayScale),
    max = Math.max(Math.abs(lo), Math.abs(hi)) || 1;
  const color = v => !finite(v) ? '#888888' : diverging ? v < 0 ? mix([247, 247, 247], [33, 102, 172], -v / max) : mix([247, 247, 247], [178, 24, 43], v / max) : mix([247, 251, 255], [8, 48, 107], hi === lo ? .5 : (v - lo) / (hi - lo));
  const cw = 540 / Math.max(1, model.columns.length),
    ch = 480 / Math.max(1, model.rows.length),
    left = 270,
    top = 220;
  const rowComplete = model.rows.length === model.totalRows,
    colComplete = model.columns.length === model.totalColumns;
  const rs = rowTree && rowComplete ? treeSegments(rowTree, model.rowIndices) : [],
    cs = columnTree && colComplete ? treeSegments(columnTree, model.columnIndices) : [];
  const rh = Math.max(...(rowTree?.height || [0]), 0) || 1,
    cth = Math.max(...(columnTree?.height || [0]), 0) || 1;
  const description = `${t('Displayed rows × columns', '显示行 × 列')}: ${model.rows.length} × ${model.columns.length} / ${model.totalRows} × ${model.totalColumns}. ${t('First ordered subset; full ordered matrix and original trees in exports. Trees omitted on a truncated axis; branch heights are original R hclust heights. Gray = missing, not zero.', '按排序显示首个子集；导出包含完整排序矩阵与原始树。截断轴不显示树；枝高是实际 R hclust 高度。灰色为缺失，不是零。')} ${model.scale}`;
  return <PlotFrame title={title} description={description} width={960} height={820} t={t} metadata={{
    ...plotBinding(run),
    view: correlation ? 'correlation' : 'heatmap',
    scale,
    displayScale: d.displayScale,
    limits: [lo, hi],
    center: diverging ? 0 : null,
    subset: {
      rowIds: model.rows,
      columnIds: model.columns,
      totalRows: model.totalRows,
      totalColumns: model.totalColumns
    },
    trees: {
      row: !!rs.length,
      column: !!cs.length
    }
  }}>
    {rs.map((s, i) => <line key={`r${i}`} x1={left - 8 - 70 * s.y1 / rh} x2={left - 8 - 70 * s.y2 / rh} y1={top + s.x1 * ch} y2={top + s.x2 * ch} stroke="#222" />)}
    {cs.map((s, i) => <line key={`c${i}`} x1={left + s.x1 * cw} x2={left + s.x2 * cw} y1={top - 8 - 60 * s.y1 / cth} y2={top - 8 - 60 * s.y2 / cth} stroke="#222" />)}
    {!!rs.length && <text x="190" y="745" fontSize="10">row h: 0–{Number(rh.toPrecision(4))}</text>}
    {!!cs.length && <text x="440" y="60" fontSize="10">column h: 0–{Number(cth.toPrecision(4))}</text>}
    {model.rows.map((id, i) => <text key={id} x={rs.length ? 185 : 260} y={top + (i + .5) * ch + 4} textAnchor="end" fontSize="10"><title>{identity(run, id, correlation ? 'feature' : 'sample').label}</title>{identity(run, id, correlation ? 'feature' : 'sample').label.slice(0, 29)}</text>)}
    {model.columns.map((id, j) => <text key={id} x={left + (j + .5) * cw} y={cs.length ? 145 : 210} fontSize="10" transform={`rotate(-48 ${left + (j + .5) * cw} ${cs.length ? 145 : 210})`}><title>{identity(run, id).label}</title>{identity(run, id).label.slice(0, 26)}</text>)}
    {model.values.flatMap((row, i) => row.map((value, j) => {
      const label = `${model.rows[i]} × ${model.columns[j]}: ${finite(value) ? value : 'NA'}`;
      return <g key={`${i}-${j}`} role="button" tabIndex="0" aria-label={label} onClick={() => onSelect(model.columns[j], model.rows[i])} onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(model.columns[j], model.rows[i]);
        }
      }}>
        <title>{label}</title><rect x={left + j * cw} y={top + i * ch} width={cw} height={ch} fill={color(value)} stroke="#fff" strokeWidth=".5" />
        {!finite(value) && <text x={left + (j + .5) * cw} y={top + (i + .5) * ch + 3} fill="#fff" fontSize="9" textAnchor="middle">NA</text>}
      </g>;
    }))}
    {Array.from({
      length: 100
    }, (_, i) => <rect key={i} x={300 + i * 4} y="755" width="4.1" height="14" fill={color(lo + (hi - lo) * i / 99)} />)}
    <text x="300" y="787">{Number(lo.toPrecision(5))}</text><text x="700" y="787" textAnchor="end">{Number(hi.toPrecision(5))}</text>
    <text x="500" y="739" textAnchor="middle" fontSize="11">{scale}</text><rect x="740" y="755" width="15" height="14" fill="#888888" /><text x="762" y="767">NA</text>
  </PlotFrame>;
}
