import { useId } from 'react';
import { PlotFrame } from './PlotPrimitives.jsx';
import { PALETTE } from '../../analysis/plotModels.mjs';
import { pcaPlotData } from '../../analysis/browserPcaPresentation.mjs';

const number = value => Number(value.toPrecision(4)).toString();
const extent = (values, includeZero = false, zoom = 1) => {
  const finite = values.filter(Number.isFinite);
  let low = Math.min(...finite), high = Math.max(...finite);
  if (!finite.length) [low, high] = [0, 1];
  if (includeZero) { low = Math.min(0, low); high = Math.max(0, high); }
  const midpoint = (low + high) / 2, half = ((high - low) || Math.max(1, Math.abs(midpoint))) * .58 / zoom;
  return [midpoint - half, midpoint + half];
};
const symbol = (shape, x, y, color) => {
  const attrs = { fill: color, stroke: '#fff', strokeWidth: 1.5 };
  if (shape === 'square') return <rect x={x - 5} y={y - 5} width={10} height={10} {...attrs} />;
  if (shape === 'triangle') return <path d={`M${x},${y - 7}L${x + 7},${y + 6}L${x - 7},${y + 6}Z`} {...attrs} />;
  if (shape === 'diamond') return <path d={`M${x},${y - 7}L${x + 7},${y}L${x},${y + 7}L${x - 7},${y}Z`} {...attrs} />;
  return <circle cx={x} cy={y} r={5.5} {...attrs} />;
};

export default function BrowserPcaPlot({ result, dataset, view, settings, t }) {
  const clipId = useId();
  const model = pcaPlotData(result, dataset, view);
  if (model.oneDimensional && view === 'biplot') return <p role="status">{t('Biplot needs two components; this matrix has numerical rank one.', '双标图需要两个主成分；当前矩阵的数值秩为一。')}</p>;
  const points = model.points.slice(0, 500), arrows = model.arrows.slice(0, 80);
  const groups = [...new Set(model.points.map(point => point.group))];
  const right = settings.legend === 'right' ? 140 : 0;
  const x0 = 90, x1 = 790 - right, y0 = 70, y1 = 420;
  const xDomain = extent([...points.map(p => p.x), ...arrows.map(a => a.x)], view !== 'scree', settings.zoom);
  const yDomain = extent([...points.map(p => p.y), ...arrows.map(a => a.y)], view !== 'scree', settings.zoom);
  const sx = value => x0 + (value - xDomain[0]) / (xDomain[1] - xDomain[0]) * (x1 - x0);
  const sy = value => y1 - (value - yDomain[0]) / (yDomain[1] - yDomain[0]) * (y1 - y0);
  const xLabel = settings.xTitle || (view === 'scree' ? t('Component', '主成分') : `PC1 (${number(result.data.explained[0] * 100)}%)`);
  const yLabel = settings.yTitle || (view === 'scree' ? t('Explained variance (%)', '方差解释率 (%)') : model.oneDimensional ? t('No PC2', '无 PC2') : `PC2 (${number(result.data.explained[1] * 100)}%)`);
  const title = ({ scores: t('PCA score plot', 'PCA 得分图'), loadings: t('PCA loading plot', 'PCA 载荷图'), biplot: t('PCA biplot', 'PCA 双标图'), scree: t('PCA scree plot', 'PCA 碎石图') })[view];
  const description = view === 'biplot'
    ? t(`Scores use processed-data coordinates; loading arrows are multiplied by ${number(model.displayFactor)} for display only. Hover for unscaled loadings.`, `得分使用预处理数据坐标；载荷箭头仅为展示乘以 ${number(model.displayFactor)}。悬浮可查看原始载荷。`)
    : t('Exploratory PCA from the selected browser-local dataset. Full values are available in tables and CSV.', '来自当前浏览器本地数据的探索性 PCA；完整数值见表格与 CSV。');
  return <PlotFrame key={`${result.provenance.runId}-${view}-${JSON.stringify(settings)}`} title={title} description={description} t={t} metadata={{
    runId: result.provenance.runId ?? result.provenance.datasetId, datasetId: dataset.id, datasetName: dataset.name, view,
    sourceHash: dataset.provenance?.sourceSha256 ?? null, algorithmVersion: result.provenance.algorithmVersion,
    scale: result.preprocessing.scale, missing: result.preprocessing.missing, displayedPoints: points.length,
    totalPoints: model.points.length, displayedArrows: arrows.length, totalArrows: model.arrows.length,
    zoom: settings.zoom, xLabel, yLabel, biplotDisplayFactor: model.displayFactor ?? null
  }}>
    <g fontSize={settings.fontSize}>
      <defs><clipPath id={clipId}><rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} /></clipPath></defs>
      {Array.from({ length: 5 }, (_, i) => {
        const x = xDomain[0] + (xDomain[1] - xDomain[0]) * i / 4;
        const y = yDomain[0] + (yDomain[1] - yDomain[0]) * i / 4;
        return <g key={i}><line x1={sx(x)} x2={sx(x)} y1={y0} y2={y1} stroke="#e1e7ed" /><text x={sx(x)} y={y1 + 18} textAnchor="middle">{number(x)}</text><line x1={x0} x2={x1} y1={sy(y)} y2={sy(y)} stroke="#e1e7ed" /><text x={x0 - 8} y={sy(y) + 4} textAnchor="end">{number(y)}</text></g>;
      })}
      <path d={`M${x0},${y0}V${y1}H${x1}`} fill="none" stroke="#243748" />
      <g clipPath={`url(#${clipId})`}>{view === 'scree' ? points.map(point => <g key={point.id}><rect x={sx(point.x) - 13} y={Math.min(sy(point.y), sy(0))} width={26} height={Math.abs(sy(0) - sy(point.y))} fill="#0072B2"><title>{`${point.id}: ${number(point.y)}%; cumulative ${number(point.cumulative)}%`}</title></rect></g>)
        : points.map((point, i) => {
          const style = settings.groupStyles[point.group] ?? {};
          const color = style.color ?? PALETTE[groups.indexOf(point.group) % PALETTE.length];
          const shape = style.symbol ?? ['circle', 'square', 'triangle', 'diamond'][groups.indexOf(point.group) % 4];
          const x = sx(point.x), y = sy(point.y);
          if (x < x0 || x > x1 || y < y0 || y > y1) return null;
          return <g key={`${point.id}-${i}`}><title>{`${point.label} · ${point.group}: ${xLabel}=${number(point.x)}, ${yLabel}=${number(point.y)}`}</title>{symbol(shape, x, y, color)}{((view === 'loadings' ? settings.variableLabels : settings.sampleLabels) && i < 40) && <text x={x + 8} y={y - 7}>{String(point.label).slice(0, 28)}</text>}</g>;
        })}
      {view === 'biplot' && arrows.map(arrow => {
        const x = sx(arrow.x), y = sy(arrow.y), originX = sx(0), originY = sy(0);
        return <g key={arrow.id}><title>{`${arrow.label}: loading PC1=${number(arrow.loadingX)}, PC2=${number(arrow.loadingY)}`}</title><line x1={originX} y1={originY} x2={x} y2={y} stroke="#b55126" strokeWidth="1.5" /><circle cx={x} cy={y} r="3" fill="#b55126" />{settings.variableLabels && <text x={x + 5} y={y - 5} fill="#92421d">{String(arrow.label).slice(0, 25)}</text>}</g>;
      })}</g>
      <text x={(x0 + x1) / 2} y="463" textAnchor="middle" fontWeight="700">{xLabel}</text><text x="22" y="245" textAnchor="middle" fontWeight="700" transform="rotate(-90 22 245)">{yLabel}</text>
      {settings.legend !== 'hidden' && view !== 'scree' && groups.slice(0, 12).map((group, i) => {
        const x = settings.legend === 'right' ? 670 : 95 + (i % 4) * 190;
        const y = settings.legend === 'right' ? 90 + i * 23 : 490 + Math.floor(i / 4) * 21;
        const style = settings.groupStyles[group] ?? {};
        return <g key={group}>{symbol(style.symbol ?? ['circle', 'square', 'triangle', 'diamond'][i % 4], x, y, style.color ?? PALETTE[i % PALETTE.length])}<text x={x + 11} y={y + 4}>{String(group).slice(0, 20)}</text></g>;
      })}
    </g>
  </PlotFrame>;
}
