import { finite, boxSummary, densityModel, PALETTE, identity, valueLimits, plotBinding } from '../../analysis/plotModels.mjs';
import { PlotFrame, Marker, ScatterPlot } from './PlotPrimitives.jsx';
import { DataTable } from './Controls.jsx';
export default function DistributionPlot({
  run,
  featureId,
  view,
  t
}) {
  const data = run.result.data,
    index = data.featureIds.indexOf(featureId),
    feature = identity(run, featureId);
  const rows = data.points.map(p => ({
    ...p,
    featureId,
    value: p.values[index] ?? null
  }));
  if (view === 'composition') return <>
    <p>{t('Composition is returned only for complete nonnegative same-unit features with a positive total. NA reasons remain missing; no re-normalization is performed here.', '组成仅来自完整、非负、同单位且总量为正的服务结果。NA 原因保留为缺失；此处不重新归一化。')}</p>
    <ScatterPlot points={(data.composition || []).map((p, i) => ({
      id: p.sampleId,
      label: p.sampleId,
      group: p.group,
      x: i + 1,
      y: p.proportions?.[index] ?? null,
      raw: {
        ...p,
        featureId,
        naReason: p.naReason
      }
    }))} title={`${t('Composition proportion', '组成比例')}: ${feature.label}`} xLabel={t('Result unit order', '结果单位顺序')} yLabel={t('Returned proportion', '返回的比例')} zeroY t={t} metadata={{
      ...plotBinding(run),
      view,
      featureId,
      inferenceSource: data.source
    }} />
  </>;
  const groups = [...new Set(rows.map(p => p.group))],
    shown = groups.slice(0, 12),
    stats = shown.map(group => {
      const all = rows.filter(p => p.group === group);
      return {
        group,
        rows: all,
        box: boxSummary(all.map(p => p.value)),
        density: densityModel(all.map(p => p.value))
      };
    });
  const values = rows.map(p => p.value).filter(finite),
    [low, high] = valueLimits(values),
    pad = (high - low || 1) * .1,
    sy = v => 430 - (v - low + pad) / (high - low + 2 * pad) * 350,
    cw = 720 / Math.max(1, shown.length);
  const visible = rows.filter(p => shown.includes(p.group) && finite(p.value)).slice(0, 500);
  const description = `${data.source}. ${t('Type 7 quantiles; Tukey whiskers at furthest observed value within 1.5 IQR. All observed points included up to explicit display cap; no significance inferred.', 'Type 7 分位数；Tukey 须线为 1.5 IQR 内最远观测值。观测点按明确上限显示；不推导显著性。')} ${t('Groups shown / total', '显示组 / 总组')}: ${shown.length}/${groups.length}; ${t('points shown / total rows', '显示点 / 总行')}: ${visible.length}/${rows.length}; NA=${rows.length - values.length}. ${view === 'violin' ? t('Gaussian KDE: Scott bandwidth 1.06 × sample SD × n^(-1/5), 64 points, restricted to observed range; each group peak has equal width. n<3 or constant: box/points only.', '高斯 KDE：Scott 带宽 1.06 × 样本 SD × n^(-1/5)，64 点，限制在观测范围；各组峰值宽度相同。n<3 或常数：仅箱线与点。') : ''}`;
  return <>
    <PlotFrame title={`${view === 'violin' ? t('Violin + observed points', '小提琴 + 观测点') : t('Box + observed points', '箱线 + 观测点')}: ${feature.label}`} description={description} t={t} metadata={{
      ...plotBinding(run),
      view,
      featureId,
      unit: feature.unit,
      subset: {
        groups: shown,
        points: visible.length,
        total: rows.length
      },
      quantiles: 'Type 7',
      whiskers: 'Tukey 1.5 IQR',
      densities: stats.map(s => ({
        group: s.group,
        bandwidth: s.density.bandwidth,
        reason: s.density.reason,
        method: s.density.method
      }))
    }}>
      {Array.from({
        length: 5
      }, (_, i) => {
        const value = low + (high - low) * i / 4;
        return <g key={i}><line x1="75" x2="805" y1={sy(value)} y2={sy(value)} stroke="#d5dbe0" /><text x="67" y={sy(value) + 4} textAnchor="end">{Number(value.toPrecision(4))}</text></g>;
      })}
      {stats.map((s, i) => {
        const x = 85 + (i + .5) * cw,
          b = s.box,
          d = s.density,
          max = Math.max(...d.points.map(p => p.y), 1e-100),
          w = Math.min(28, cw * .35);
        return <g key={s.group}>
          {view === 'violin' && d.points.length > 0 && <path d={[...d.points.map((p, j) => `${j ? 'L' : 'M'}${x - p.y / max * w},${sy(p.x)}`), ...d.points.toReversed().map(p => `L${x + p.y / max * w},${sy(p.x)}`), 'Z'].join('')} fill="#dceaf1" stroke={PALETTE[i % 5]} />}
          {b.n > 0 && <><line x1={x} x2={x} y1={sy(b.whiskers[0])} y2={sy(b.whiskers[1])} stroke="#17212b" /><rect x={x - w * .5} y={sy(b.quartiles[2])} width={w} height={Math.max(1, sy(b.quartiles[0]) - sy(b.quartiles[2]))} fill="#ffffff" stroke="#17212b" /><line x1={x - w * .5} x2={x + w * .5} y1={sy(b.quartiles[1])} y2={sy(b.quartiles[1])} stroke="#17212b" />{b.whiskers.map((v, j) => <line key={j} x1={x - w * .35} x2={x + w * .35} y1={sy(v)} y2={sy(v)} stroke="#17212b" />)}</>}
          <text x={x} y="465" textAnchor="middle" fontSize="11"><title>{s.group}</title>{String(s.group).slice(0, 14)}</text><text x={x} y="484" textAnchor="middle" fontSize="10">n={b.n}; NA={b.missing}</text>
        </g>;
      })}
      {visible.map((p, i) => {
        const g = shown.indexOf(p.group),
          x = 85 + (g + .5) * cw + (i % 7 - 3) * Math.min(3, cw / 20);
        return <Marker key={`${p.sampleId}-${i}`} x={x} y={sy(p.value)} index={g} color={PALETTE[g % 5]} label={`${p.sampleId}; ${p.biologicalUnitId}; ${p.group}; ${p.value}`} />;
      })}
      <text x="20" y="255" textAnchor="middle" transform="rotate(-90 20 255)">{feature.unit || t('value (unit unspecified)', '值（单位未指定）')}</text>
      <text x="440" y="520" textAnchor="middle">{t('Observed biological-unit-condition means; deterministic horizontal jitter only', '观测生物学单位-条件均值；仅作确定性水平抖动')}</text>
    </PlotFrame>
    <DataTable rows={stats.map(s => ({
      group: s.group,
      ...s.box,
      bandwidth: s.density.bandwidth,
      kdeNaReason: s.density.reason
    }))} caption={t('Descriptive display estimates', '描述性显示估计')} t={t} />
    <details><summary>{t('All observed points for this feature', '此特征的全部观测点')}</summary><DataTable rows={rows} caption={feature.label} t={t} /></details>
  </>;
}
