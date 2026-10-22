import { useRef, useState } from 'react';
import { componentAxes, correlationModel, finite, identity, orderedMatrix, permutationModel, volcanoModel, plotBinding, screeModel } from '../../analysis/plotModels.mjs';
import { collectTables, createCsvZip, createReproductionBundle, exportResultXlsx } from '../../analysis/resultExports.mjs';
import { casHref } from '../../analysis/casLink.mjs';
import { downloadFile } from '../../analysis/download.mjs';
import { Check, DataTable, NumberField, Select } from './Controls.jsx';
import { PlotBoundary, ScatterPlot } from './PlotPrimitives.jsx';
import MatrixPlot from './MatrixPlot.jsx';
import DistributionPlot from './DistributionPlot.jsx';
import '../../styles/analysis-plots.css';
function FullTables({
  run,
  t
}) {
  const tables = collectTables(run),
    [selected, setSelected] = useState(''),
    table = tables.find(x => x.name === selected) || tables[0];
  return <><Select label={t('Complete underlying table', '完整底层表')} value={table?.name} onChange={setSelected} options={tables.map(x => ({
      value: x.name,
      label: `${x.name} (${x.rows.length})`
    }))} />{table && <DataTable key={table.name} {...table} caption={table.name} t={t} />}</>;
}
function SupervisedValidation({
  run,
  t
}) {
  const data = run.result.data,
    v = data.validation,
    p = permutationModel(data.permutation);
  return <section className="analysis-validation"><h4>{t('Held-out nested validation — distinct from full fit', '留出嵌套验证——与全数据拟合分开')}</h4>
    {v ? <><DataTable rows={[{
        independentN: data.independentN,
        balancedAccuracy: v.balancedAccuracy,
        Q2_trainingPrevalence: v.Q2_trainingPrevalence,
        Q2NaReason: v.Q2NaReason,
        PRESS: v.PRESS,
        PRESS_null: v.PRESS_null,
        classOrder: data.classOrder
      }]} caption={t('Actual validation metrics (negative Q2 retained)', '实际验证指标（保留负 Q2）')} t={t} />
      <p>{v.confusionDefinition}</p><DataTable rows={(v.confusion || []).map((row, i) => ({
        trueClass: data.classOrder[i],
        ...Object.fromEntries(row.map((value, j) => [`predicted: ${data.classOrder[j]}`, value]))
      }))} caption={t('OOF confusion counts: rows true, columns predicted', 'OOF 混淆计数：行真实、列预测')} t={t} /></> : <p>{t('No validation returned.', '未返回验证结果。')}</p>}
    <h4>{t('Actual label-permutation results', '实际标签置换结果')}</h4>
    <DataTable rows={[{
      statistic: p.statistic,
      observed: p.observed,
      requested: p.requested,
      completed: p.completed,
      failed: p.failed,
      p: p.p,
      pNaReason: p.pNaReason
    }]} caption={t('Permutation audit', '置换审计')} t={t} />
    {p.points.length ? <ScatterPlot points={(data.permutation.distribution || []).map((value, i) => ({
      id: String(i + 1),
      x: i + 1,
      y: value
    }))} title={t('Permutation values — no histogram binning', '置换值——不进行直方图分箱')} xLabel={t('Permutation order', '置换顺序')} yLabel={p.statistic || 'statistic'} hline={p.observed} t={t} metadata={{
      ...plotBinding(run),
      view: 'permutation',
      observed: p.observed,
      requested: p.requested,
      completed: p.completed,
      failed: p.failed
    }} /> : <p>{t('No finite permutation distribution available; no p value is inferred.', '无可用有限值置换分布；不会推算 p 值。')} {p.pNaReason}</p>}
  </section>;
}
function Visualizations({
  run,
  t
}) {
  const data = run.result.data,
    method = run.request.analysis.method,
    fit = data.fullFit || data,
    features = run.request.dataset.features;
  const container = useRef(null),
    [view, setView] = useState(method === 'distribution' ? 'box' : 'scores'),
    [featureId, setFeatureId] = useState(data.featureIds?.[0] || fit.featureIds?.[0] || features[0]?.id || ''),
    [otherId, setOtherId] = useState(''),
    [xKey, setXKey] = useState(''),
    [yKey, setYKey] = useState(''),
    [labels, setLabels] = useState(false),
    [palette, setPalette] = useState('color'),
    [comparison, setComparison] = useState(''),
    [metric, setMetric] = useState('padj'),
    [fc, setFc] = useState(1),
    [cutoff, setCutoff] = useState(.05),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [tablesOpen, setTablesOpen] = useState(false);
  const axes = componentAxes(fit, method),
    xAxis = axes.find(a => a.key === xKey) || axes[0],
    yAxis = axes.find(a => a.key === yKey && a.key !== xAxis?.key) || axes.find(a => a.key !== xAxis?.key),
    feature = identity(run, featureId),
    cas = casHref(feature.cas, import.meta.env.BASE_URL),
    meta = {
      ...plotBinding(run),
      method,
      view
    };
  const selectPoint = p => {
    if (features.some(f => f.id === p.id)) setFeatureId(p.id);
  };
  const multi = ['pca', 'plsda', 'oplsda'].includes(method),
    supervised = !!data.fullFit;
  const featureOptions = (method === 'distribution' ? features.filter(f => data.featureIds.includes(f.id)) : features).map(f => ({
    value: f.id,
    label: identity(run, f.id).label
  }));
  async function exportFull(format) {
    setError('');
    setBusy(true);
    try {
      if (format === 'xlsx') downloadFile(`analysis-${run.id}-full.xlsx`, exportResultXlsx(run), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');else {
        const metadata = {
          boundRun: run.id,
          requestHash: run.requestHash,
          plots: [...(container.current?.querySelectorAll('svg[data-plot]') || [])].map(el => JSON.parse(el.dataset.plot)),
          viewSettings: {
            view,
            featureId,
            otherId,
            xKey: xAxis?.key,
            yKey: yAxis?.key,
            labels,
            palette,
            comparison,
            metric,
            fc,
            cutoff
          }
        };
        const zip = format === 'csv' ? await createCsvZip(run) : await createReproductionBundle(run, metadata);
        downloadFile(`analysis-${run.id}-${format}.zip`, await zip.generateAsync({
          type: 'blob'
        }), 'application/zip');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  let chart = null;
  if (multi) {
    if (view === 'scree') {
      const scree = screeModel(data);
      chart = <>
        <p>{t('Scree components are bounded by numerical rank; the full returned spectrum remains in raw tables and exports.', '碎石图成分以数值秩为界；完整返回谱仍保留在原始表格与导出中。')} {scree.rank}/{scree.totalSpectrum}</p>
        <ScatterPlot title={t('PCA scree — actual explained variance', 'PCA 碎石图——实际解释方差')} points={scree.points} xLabel={t('Component', '成分')} yLabel={t('Explained fraction (not percent)', '解释比例（非百分数）')} zeroY t={t} metadata={{...meta, rank: scree.rank, totalSpectrum: scree.totalSpectrum, componentScope: 'numerical rank; full spectrum retained in raw tables'}} />
      </>;
    } else if (view === 'vip') chart = <ScatterPlot title={t('Full-fit VIP — descriptive, not p values', '全拟合 VIP——描述性，非 p 值')} points={(fit.VIP || []).map((row, i) => ({
      id: row.featureId,
      label: identity(run, row.featureId).label,
      x: i + 1,
      y: row.value,
      raw: row
    }))} xLabel={t('Feature order', '特征顺序')} yLabel="VIP" onSelect={selectPoint} selected={featureId} labels={labels} palette={palette} t={t} metadata={meta} zeroY />;else if (xAxis) {
      const loadings = view === 'loadings',
        ids = loadings ? fit.featureIds : fit.sampleIds,
        matrix = axis => fit[axis.orthogonal ? loadings ? 'orthogonalLoadings' : 'orthogonalScores' : loadings ? 'loadings' : 'scores'];
      const points = ids.map((id, i) => {
        const item = identity(run, id, loadings ? 'feature' : 'sample');
        return {
          id,
          label: item.label,
          group: loadings ? t('Feature', '特征') : item.group || t('Unspecified', '未指定'),
          x: matrix(xAxis)?.[i]?.[xAxis.index] ?? null,
          y: yAxis ? matrix(yAxis)?.[i]?.[yAxis.index] ?? null : 0
        };
      });
      chart = <ScatterPlot points={points} title={`${method.toUpperCase()} · ${view} ${supervised ? t('(full-fit descriptive only)', '（仅全拟合描述）') : ''}`} xLabel={xAxis.label} yLabel={yAxis?.label || t('1D — no second component', '一维——无第二成分')} oneDimensional={!yAxis} labels={labels} palette={palette} onSelect={loadings ? selectPoint : undefined} selected={featureId} t={t} metadata={{
        ...meta,
        xAxis: xAxis.key,
        yAxis: yAxis?.key || null,
        rank: data.rank ?? fit.fitAudit?.rank
      }} />;
    } else chart = <p>{t('No stored finite component axes available.', '无存储的有限成分轴可用。')}</p>;
  } else if (method === 'heatmap' || method === 'preprocess') chart = <MatrixPlot model={orderedMatrix(data, 24)} run={run} title={t('Returned display matrix', '服务返回显示矩阵')} t={t} onSelect={setFeatureId} rowTree={data.rowTree} columnTree={data.columnTree} />;else if (method === 'compare') {
    const comparisons = [...new Set(data.results.map(r => r.comparison))],
      selectedComparison = comparisons.includes(comparison) ? comparison : comparisons[0],
      model = volcanoModel(data.results, selectedComparison, metric, fc, cutoff),
      rows = data.results.filter(r => r.comparison === selectedComparison),
      hasContrast = rows.some(r => r.control !== undefined && r.treatment !== undefined);
    chart = <><div className="analysis-plot-controls"><Select label={t('Returned comparison', '返回的比较')} value={selectedComparison} onChange={setComparison} options={comparisons} /><Select label={t('Vertical significance measure', '纵轴显著性指标')} value={metric} onChange={setMetric} options={['p', 'padj']} /><NumberField label={t('Display |log2 FC| cutoff', '显示 |log2 FC| 阈值')} value={fc} min={0} onChange={value => setFc(finite(value) ? Math.max(0, value) : 1)} /><NumberField label={t('Display p cutoff', '显示 p 阈值')} value={cutoff} min={0.000001} max={1} onChange={value => setCutoff(finite(value) ? Math.min(1, Math.max(0.000001, value)) : .05)} /></div>
      <p>{t('Adjustment and scope returned by the engine', '引擎返回的校正及范围')}: {data.adjust} / {data.adjustScope}. {t('Display cutoffs never recompute p or FDR. Raw p=0 is drawn at −log10(p)=300 and retained as zero in tables; invalid values are not zero.', '显示阈值不重算 p 或 FDR。原始 p=0 显示在 −log10(p)=300，表格保留原始零；无效值不置零。')}</p>
      {hasContrast ? <ScatterPlot points={model.allPoints.map(p => ({
        ...p,
        label: identity(run, p.id).label
      }))} title={`${t('Volcano', '火山图')}: ${selectedComparison}`} xLabel="log2 fold change" yLabel={`−log10(${metric})`} hline={-Math.log10(cutoff)} vlines={[-fc, fc]} onSelect={selectPoint} selected={featureId} labels={labels} palette={palette} t={t} metadata={{
        ...meta,
        comparison: selectedComparison,
        metric,
        fc,
        cutoff,
        pZeroCap: 300,
        adjust: data.adjust,
        adjustScope: data.adjustScope
      }} /> : <p>{t('No volcano: this multi-group omnibus result has no control/treatment fold-change contrast. No contrast is invented.', '不绘制火山图：该多组总体检验未返回对照/处理倍数变化比较，不虚构对比。')}</p>}
      <DataTable rows={data.results} caption={t('All returned comparisons — including failed features, n, effects and CIs', '全部返回比较——含失败特征、n、效应和 CI')} t={t} /><DataTable rows={data.posthoc || []} caption={t('Complete returned posthoc results', '完整返回事后检验结果')} t={t} />
    </>;
  } else if (method === 'distribution') chart = <DistributionPlot run={run} featureId={featureId} view={view} t={t} />;else if (method === 'correlation') {
    const model = correlationModel(data.results, 24),
      pair = data.results.find(r => r.featureId === featureId && r.otherFeatureId === otherId || r.otherFeatureId === featureId && r.featureId === otherId);
    chart = <><MatrixPlot model={model} run={run} title={t('Returned correlation matrix', '返回的相关矩阵')} t={t} correlation onSelect={(a, b) => {
        setFeatureId(a);
        setOtherId(b);
      }} /><Select label={t('Paired feature', '配对特征')} value={otherId} onChange={setOtherId} options={[{
        value: '',
        label: t('Select a pair', '选择配对')
      }, ...featureOptions]} />{pair ? <DataTable rows={[pair]} caption={t('Actual pair details', '实际配对详情')} t={t} /> : <p>{t('This pair was not computed (including uncomputed diagonal); no r=1 or p value is invented.', '此配对未计算（含未计算的对角线）；不虚构 r=1 或 p 值。')}</p>}<DataTable rows={data.results} caption={t('All correlation pairs', '全部相关配对')} t={t} /></>;
  }
  return <section className="analysis-visualizations" ref={container}>
    <h3>{t('Visual exploration & complete exports', '可视化探索与完整导出')}</h3>
    <p>{run.request.dataset.name} · {t('Bound run', '绑定运行')}: {run.id}. {t('Display controls do not change the recipe or call the analysis service. Sample counts do not establish independence; consult the bound design and audit.', '显示控件不更改配方，也不调用分析服务。样品计数不证明独立性，请查看绑定的设计与审计。')}</p>
    <div className="analysis-toolbar"><button disabled={busy} onClick={() => exportFull('csv')}>{t('Full tables CSV ZIP', '完整表格 CSV ZIP')}</button><button disabled={busy} onClick={() => exportFull('xlsx')}>{t('Full tables XLSX', '完整表格 XLSX')}</button><button disabled={busy} onClick={() => exportFull('reproduce')}>{t('Reproduction bundle + R runner', '复现包 + R 运行脚本')}</button></div>{error && <p role="alert">{error}</p>}
    <div className="analysis-plot-controls">
      {multi && <Select label={t('View', '视图')} value={view} onChange={setView} options={['scores', 'loadings', ...(method === 'pca' ? ['scree'] : ['vip'])]} />}
      {multi && ['scores', 'loadings'].includes(view) && <><Select label={t('X component', 'X 成分')} value={xAxis?.key} onChange={setXKey} options={axes.map(a => ({
          value: a.key,
          label: a.label
        }))} />{axes.length > 1 && <Select label={t('Y component', 'Y 成分')} value={yAxis?.key} onChange={setYKey} options={axes.filter(a => a.key !== xAxis?.key).map(a => ({
          value: a.key,
          label: a.label
        }))} />}</>}
      {method === 'distribution' && <Select label={t('Distribution view', '分布视图')} value={view} onChange={setView} options={['box', 'violin', 'composition']} />}
      {(multi || method === 'compare') && <><Check label={t('Show point labels (first 40)', '显示点标签（前 40）')} value={labels} onChange={setLabels} /><Select label={t('Palette (shapes retained)', '配色（保留形状）')} value={palette} onChange={setPalette} options={[{
          value: 'color',
          label: 'Okabe–Ito subset'
        }, {
          value: 'mono',
          label: t('Grayscale', '灰度')
        }]} /></>}
    </div>
    <div className="analysis-feature-inspector"><Select label={t('Shared selected feature — stable ID + name', '共享选中特征——稳定 ID + 名称')} value={featureId} onChange={setFeatureId} options={featureOptions} /><DataTable rows={[{
        featureId: feature.id,
        name: feature.name,
        CAS: feature.cas,
        unit: feature.unit,
        annotations: feature.annotations,
        boundRun: run.id,
        datasetId: run.request.dataset.id
      }]} caption={t('Bound feature identity and source annotations', '绑定特征身份及来源注释')} t={t} />{cas ? <a href={cas} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{t('Open CAS-filtered threshold search', '打开 CAS 筛选阈值检索')}: {feature.cas} ↗</a> : <p>{t('No valid CAS available for lookup.', '无有效 CAS 可供检索。')}</p>}</div>
    <PlotBoundary key={`${run.id}-${view}`} t={t}>{chart}</PlotBoundary>
    {supervised && <><p>{t('Full-fit scores/loadings/VIP are descriptive only, not held-out validation. VIP is not a p value, reliability badge, or causal evidence.', '全拟合得分/载荷/VIP 仅用于描述，不是留出验证。VIP 不是 p 值、可靠性标记或因果证据。')} R2X={fit.R2X ?? 'NA'}; R2Y={fit.R2Y ?? 'NA'}.</p><PlotBoundary t={t}><SupervisedValidation run={run} t={t} /></PlotBoundary></>}
    <button aria-expanded={tablesOpen} onClick={() => setTablesOpen(!tablesOpen)}>{t('Browse ALL result tables (paged; no graph subset limit)', '浏览全部结果表（分页；不受图形子集限制）')}</button>{tablesOpen && <PlotBoundary t={t}><FullTables run={run} t={t} /></PlotBoundary>}
  </section>;
}
export default function ResultVisualizations(props) {
  return <PlotBoundary key={props.run.id} t={props.t}><Visualizations {...props} /></PlotBoundary>;
}
