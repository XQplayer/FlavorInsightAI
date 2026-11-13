import { useEffect, useRef, useState } from 'react';
import { usePlatformPreferences } from '../app/PlatformPreferences.jsx';
import { readImportFile, previewTable, IMPORT_LIMITS } from '../analysis/imports.mjs';
import { createDataset } from '../analysis/dataset.mjs';
import { createBrowserAnalysisAdapter, BROWSER_PCA_PLAN_SCHEMA } from '../analysis/browserAnalysisAdapter.mjs';
import { createBrowserPcaArchive } from '../analysis/browserPcaArchive.mjs';
import { createBrowserPcaRunStore } from '../analysis/browserPcaRunStore.mjs';
import { BROWSER_PCA_LIMITS } from '../analysis/browserPca.mjs';
import { pcaCsv } from '../analysis/browserPcaPresentation.mjs';
import { toUnifiedPcaResult } from '../analysis/pcaResult.mjs';
import { downloadFile } from '../analysis/download.mjs';
import { Check, DataTable, Field, NumberField, Select, TextField } from '../components/analysis/Controls.jsx';
import BrowserPcaPlot from '../components/analysis/BrowserPcaPlot.jsx';
import reference from '../analysis/browserPca.reference.json';
import { aiChatClient } from '../lib/aiChatClient.js';
import { supabase } from '../lib/supabase.js';
import '../styles/analysis.css';
import '../styles/analysis-plots.css';
import '../styles/browser-pca.css';

const INITIAL = { missing: 'error', constant: 'error', center: true, scale: 'none', components: null, includeInternalStandards: false };
const PLOT_INITIAL = { view: 'scores', sampleLabels: false, variableLabels: false, legend: 'bottom', zoom: 1, fontSize: 12, xTitle: '', yTitle: '', groupStyles: {} };
const IS_PREVIEW = import.meta.env.VITE_PCA_PREVIEW === 'true';
const AI_GATEWAY_AVAILABLE = !IS_PREVIEW || Boolean(import.meta.env.VITE_FEMA_API_URL);
const CONVERSATION_CONTEXT = (() => {
  const value = new URLSearchParams(window.location.search).get('conversation_id');
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
})();
const errorText = (code, t) => ({
  MISSING_VALUES: t('Missing values remain. Choose an explicit policy, or inspect the source.', '仍有缺失值。请明确选择处理方式或检查源数据。'),
  ALL_MISSING_FEATURE: t('A variable is entirely missing; mean/median fill is impossible. Choose explicit feature exclusion.', '某变量全部缺失，无法计算均值或中位数；请明确选择剔除变量。'),
  CONSTANT_FEATURE: t('A constant variable is present. Review it or explicitly drop constant variables.', '存在常量变量，请核对或明确选择剔除。'),
  QC_FILTERED: t('QC-filtered values cannot be restored by exploratory imputation.', 'QC 排除值不能通过探索性补值恢复。'),
  PCA_COMPONENTS: t('Requested components exceed numerical rank.', '请求的主成分数超过数值秩。'),
  PCA_DIMENSIONS: t('At least two samples and one variable must remain.', '至少需要两个样品和一个变量。'),
  MATRIX_LIMIT: t(`Browser limit: ${BROWSER_PCA_LIMITS.maxSamples} samples, ${BROWSER_PCA_LIMITS.maxFeatures} variables and ${BROWSER_PCA_LIMITS.maxCells} cells. Reduce the selection.`, `浏览器上限：${BROWSER_PCA_LIMITS.maxSamples} 个样品、${BROWSER_PCA_LIMITS.maxFeatures} 个变量及 ${BROWSER_PCA_LIMITS.maxCells} 个单元格。请缩小范围。`),
  PCA_CANCELLED: t('Calculation cancelled; no result was produced.', '计算已取消，未生成结果。'),
  PCA_WORKER_ERROR: t('Worker failed. Check browser resources and try a smaller matrix.', '后台计算失败；请检查浏览器资源或缩小矩阵。'),
  'Failed to fetch': t('AI Gateway could not be reached. Browser PCA remains available.', '无法连接 AI Gateway；浏览器 PCA 仍可使用。')
})[code] || `${code}: ${t('No result was produced. Check the input and settings.', '未生成结果，请检查输入和设置。')}`;

export default function BrowserPcaPage({ onRequireAuth, resumeIntent }) {
  const { language } = usePlatformPreferences();
  const t = (en, zh) => language === 'zh' ? zh : en;
  const [book, setBook] = useState(null), [sheet, setSheet] = useState(0), [headerRow, setHeaderRow] = useState(0);
  const [sampleColumn, setSampleColumn] = useState(''), [groupColumn, setGroupColumn] = useState(''), [featureColumns, setFeatureColumns] = useState([]), [unit, setUnit] = useState('');
  const [sourceHash, setSourceHash] = useState(''), [candidate, setCandidate] = useState(null), [dataset, setDataset] = useState(null);
  const [options, setOptions] = useState(INITIAL), [plot, setPlot] = useState(PLOT_INITIAL);
  const [result, setResult] = useState(null), [status, setStatus] = useState('idle'), [error, setError] = useState('');
  const [adapter] = useState(() => createBrowserAnalysisAdapter());
  const [runStore] = useState(() => createBrowserPcaRunStore({ databaseName: IS_PREVIEW ? 'flavor-browser-pca-preview-runs-v1' : 'flavor-browser-pca-runs-v1' }));
  const [owner, setOwner] = useState(''), [savedRuns, setSavedRuns] = useState([]), [currentRunId, setCurrentRunId] = useState('');
  const [goal, setGoal] = useState(''), [aiPlan, setAiPlan] = useState(null), [aiMode, setAiMode] = useState('');
  const [aiBusy, setAiBusy] = useState(false), [aiExplanation, setAiExplanation] = useState('');
  const [aiEnabled, setAiEnabled] = useState(AI_GATEWAY_AVAILABLE);
  const controller = useRef(null), sequence = useRef(0), ownerIdentity = useRef('');
  const aiController = useRef(null), aiSequence = useRef(0);
  const handledResume = useRef(null);
  const [authResumeNotice, setAuthResumeNotice] = useState('');
  useEffect(() => {
    if (resumeIntent?.action !== 'analysis.ai' || handledResume.current === resumeIntent) return;
    handledResume.current = resumeIntent;
    setGoal(resumeIntent.draft?.goal || '');
    setAuthResumeNotice(language === 'zh' ? '登录已完成。请重新导入本地文件并确认数据；AI 请求不会自动提交。' : 'Signed in. Reimport and confirm the local dataset; the AI request will not be submitted automatically.');
  }, [language, resumeIntent]);
  const cancelAi = () => { aiSequence.current++; aiController.current?.abort(); aiController.current = null; setAiBusy(false); };
  const toggleAi = enabled => {
    if (!enabled) { cancelAi(); setAiPlan(null); setAiExplanation(''); }
    setAiEnabled(enabled);
  };
  useEffect(() => {
    let live = true;
    const update = session => {
      if (!live) return;
      const next = session?.user?.id || 'local-guest';
      if (ownerIdentity.current === next) return;
      ownerIdentity.current = next; sequence.current++; controller.current?.abort(); cancelAi();
      setBook(null); setCandidate(null); setDataset(null); setResult(null); setCurrentRunId('');
      setAiPlan(null); setAiExplanation(''); setSourceHash(''); setStatus('idle');
      setOwner(next); setSavedRuns([]);
    };
    if (supabase) {
      supabase.auth.getSession().then(({ data }) => update(data.session)).catch(() => update(null));
      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => update(session));
      return () => { live = false; listener.subscription.unsubscribe(); };
    }
    update(null);
    return () => { live = false; };
  }, []);
  useEffect(() => { if (owner) runStore.list(owner).then(setSavedRuns).catch(() => setSavedRuns([])); }, [owner, runStore]);
  useEffect(() => () => { sequence.current++; controller.current?.abort(); aiSequence.current++; aiController.current?.abort(); runStore.close(); }, [runStore]);
  const refreshSaved = () => owner && runStore.list(owner).then(setSavedRuns);
  const resetResult = () => { sequence.current++; controller.current?.abort(); controller.current = null; cancelAi(); setResult(null); setCurrentRunId(''); setAiPlan(null); setAiExplanation(''); setError(''); setStatus('idle'); };
  const updateOption = (key, value) => { setOptions(current => ({ ...current, [key]: value, ...(key === 'scale' && value !== 'none' ? { center: true } : {}) })); resetResult(); };
  const updatePlot = (key, value) => setPlot(current => ({ ...current, [key]: value }));
  const rows = book?.sheets[sheet]?.rows ?? [], header = rows[headerRow] ?? [];
  const columnOptions = [{ value: '', label: t('Choose a column', '选择列') }, ...header.map((name, index) => ({ value: String(index), label: `${index + 1}: ${name ?? ''}` }))];
  const read = async file => {
    if (!file) return;
    resetResult(); setDataset(null); setCandidate(null); setBook(null);
    const current = sequence.current;
    try {
      if (file.size > IMPORT_LIMITS.maxBytes) throw new Error('FILE_TOO_LARGE');
      const bytes = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
      const parsed = await readImportFile(new Uint8Array(bytes), { name: file.name });
      if (current !== sequence.current) return;
      setSourceHash(hash); setBook(parsed); setSheet(0); setHeaderRow(0); setSampleColumn(''); setGroupColumn(''); setFeatureColumns([]); setUnit('');
    } catch (cause) { if (current === sequence.current) setError(errorText(cause.message, t)); }
  };
  const preview = () => {
    try {
      if (sampleColumn === '' || !featureColumns.length) throw new Error('EXPLICIT_MAPPING_REQUIRED');
      const mapped = previewTable(rows, {
        name: book.name, headerRow, orientation: 'samples-rows', sampleNameColumn: Number(sampleColumn),
        ...(groupColumn === '' ? {} : { groupColumn: Number(groupColumn) }), featureColumns, unit: unit.trim()
      });
      const snapshot = createDataset({ ...mapped.dataset, provenance: { ...mapped.dataset.provenance,
        sourceFileName: book.name, sourceSha256: sourceHash, sourceSheet: book.sheets[sheet].name, browserLocal: true } });
      setCandidate({ ...mapped, dataset: snapshot }); setError('');
    } catch (cause) { setCandidate(null); setError(errorText(cause.message, t)); }
  };
  const accept = () => { resetResult(); setDataset(candidate.dataset); setCandidate(null); };
  const runWithPlan = async plan => {
    if (!dataset || status === 'running') return;
    const current = ++sequence.current;
    controller.current = new AbortController();
    setStatus('running'); setError(''); setResult(null); setAiExplanation(''); setAiPlan(null);
    try {
      const prepared = adapter.prepare_pca(dataset, plan);
      adapter.confirm_pca(prepared.plan_id); // This function is called only by a visible user button.
      const completed = await adapter.run_browser_pca({ plan_id: prepared.plan_id, signal: controller.current.signal });
      if (current === sequence.current) { setResult(adapter.get_browser_pca_core_result(completed.provenance.run_id)); setCurrentRunId(completed.provenance.run_id); setStatus('completed'); setOptions(prepared.options); }
    } catch (cause) {
      if (current === sequence.current) { setStatus(cause.message === 'PCA_CANCELLED' ? 'cancelled' : 'failed'); setError(errorText(cause.message, t)); }
    } finally { if (current === sequence.current) controller.current = null; }
  };
  const run = () => runWithPlan({ schema_version: BROWSER_PCA_PLAN_SCHEMA, algorithm: 'pca', dataset_id: dataset?.id, options });
  const cancel = () => { controller.current?.abort(); };
  const requestPlan = async () => {
    if (!aiEnabled || !dataset || !goal.trim() || aiBusy) return;
    try { if (supabase && !(await onRequireAuth?.('analysis.ai', { goal }))) return; }
    catch (cause) { setError(cause.message); return; }
    const requestId = ++aiSequence.current;
    const abort = new AbortController();
    aiController.current = abort;
    setAiBusy(true); setError(''); setAiPlan(null);
    try {
      const inspection = adapter.inspect_dataset(dataset);
      if (!adapter.recommend_analysis(dataset).candidate) throw new Error('PCA_INPUT_INVALID');
      await aiChatClient.session();
      if (requestId !== aiSequence.current) return;
      const response = await aiChatClient.analysisPlan(goal.trim().slice(0, 500), inspection, abort.signal);
      if (requestId !== aiSequence.current) return;
      const prepared = adapter.prepare_pca(dataset, response.plan);
      setAiPlan({ ...response.plan, preview: prepared }); setAiMode(response.mode);
    } catch (cause) { if (requestId === aiSequence.current) setError(errorText(cause.message, t)); }
    finally { if (requestId === aiSequence.current) { aiController.current = null; setAiBusy(false); } }
  };
  const explain = async () => {
    if (!aiEnabled || !currentRunId || aiBusy) return;
    try { if (supabase && !(await onRequireAuth?.('analysis.ai', { goal }))) return; }
    catch (cause) { setError(cause.message); return; }
    const requestId = ++aiSequence.current;
    const abort = new AbortController();
    aiController.current = abort;
    setAiBusy(true); setError('');
    try {
      adapter.confirm_explanation(currentRunId); // User clicked after seeing exactly which facts are sent.
      const facts = adapter.explain_pca_result(currentRunId);
      if (CONVERSATION_CONTEXT && owner !== 'local-guest') await aiChatClient.linkAnalysis(CONVERSATION_CONTEXT, facts);
      await aiChatClient.session();
      if (requestId !== aiSequence.current) return;
      const response = await aiChatClient.analysisExplain(facts, language, abort.signal);
      if (requestId !== aiSequence.current) return;
      setAiMode(response.mode); setAiExplanation(response.explanation);
    } catch (cause) { if (requestId === aiSequence.current) setError(errorText(cause.message, t)); }
    finally { if (requestId === aiSequence.current) { aiController.current = null; setAiBusy(false); } }
  };
  const saveLocal = async () => {
    if (!owner || !dataset || !result) return;
    try { await runStore.save(owner, await createBrowserPcaArchive({ dataset, result, options, plot })); await refreshSaved(); setError(''); }
    catch (cause) { setError(errorText(cause.message, t)); }
  };
  const restoreLocal = async runId => {
    try {
      const archive = await runStore.load(owner, runId);
      if (!archive) throw new Error('PCA_RESULT_NOT_FOUND');
      resetResult(); setBook(null); setCandidate(null); setDataset(createDataset(archive.dataset));
      setOptions(archive.options); setPlot(archive.plot); setResult(archive.core_result);
      setCurrentRunId(adapter.restore_browser_pca_result(archive.core_result, archive.dataset)); setStatus('completed');
    } catch (cause) { setError(errorText(cause.message, t)); }
  };
  const deleteLocal = async runId => {
    try { await runStore.remove(owner, runId); await refreshSaved(); }
    catch (cause) { setError(errorText(cause.message, t)); }
  };
  const exportArchive = async () => {
    try { const archive = await createBrowserPcaArchive({ dataset, result, options, plot }); downloadFile(`browser-pca-archive-${currentRunId}.json`, JSON.stringify(archive, null, 2)); }
    catch (cause) { setError(errorText(cause.message, t)); }
  };
  const loadSynthetic = () => {
    resetResult(); setBook(null); setCandidate(null); setSourceHash('');
    setDataset(createDataset(reference.dataset));
  };
  const save = format => {
    if (!result || !dataset) return;
    const stem = `browser-pca-${result.provenance.runId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    if (format === 'json') downloadFile(`${stem}.json`, JSON.stringify(toUnifiedPcaResult(result, dataset), null, 2));
    else { const files = pcaCsv(result, dataset); downloadFile(`${stem}-${format}.csv`, files[format], 'text/csv;charset=utf-8'); }
  };
  const groups = result && dataset ? [...new Set(result.data.sampleIds.map(id => dataset.samples.find(sample => sample.id === id)?.group || 'Ungrouped'))] : [];
  const featureUnits = result && dataset ? [...new Set(result.data.featureIds.map(id => dataset.features.find(feature => feature.id === id)?.unit || ''))] : [];
  const scores = result?.data.sampleIds.map((id, i) => ({ id, sample: dataset.samples.find(s => s.id === id)?.name ?? id, group: dataset.samples.find(s => s.id === id)?.group ?? '', ...Object.fromEntries(result.data.scores[i].map((value, j) => [`PC${j + 1}`, value])) })) ?? [];
  const loadings = result?.data.featureIds.map((id, i) => ({ id, variable: dataset.features.find(f => f.id === id)?.name ?? id, unit: dataset.features.find(f => f.id === id)?.unit ?? '', ...Object.fromEntries(result.data.loadings[i].map((value, j) => [`PC${j + 1}`, value])) })) ?? [];
  const variance = result?.data.eigenvalues.map((value, i) => ({ component: `PC${i + 1}`, eigenvalue: value, explainedPercent: result.data.explained[i] * 100, cumulativePercent: result.data.cumulative[i] * 100 })) ?? [];
  return <div className="browser-pca">
    <header><div><p className="analysis-eyebrow">BROWSER SCIENTIFIC ENGINE · PCA 1.0</p><h1>{t('Browser PCA', '浏览器 PCA')}</h1><p>{t('Import, calculate and export entirely in this browser. No file upload or local Python/R service is used.', '导入、计算与导出全部在浏览器内完成；不上传文件，也不使用本地 Python/R 服务。')}</p></div><span className="browser-pca-badge">{t('Local computation', '本地计算')}</span></header>
    {IS_PREVIEW && <p role="note" className="analysis-notice">{t('Public preview: use synthetic data only. This GitHub Pages repository has a separate release path, but shares the xqplayer.github.io browser origin and IndexedDB access with the formal site.', '公开预览：仅使用合成数据。此 GitHub Pages 仓库具有独立发布路径，但与正式站点共用 xqplayer.github.io 浏览器来源和 IndexedDB 访问范围。')}</p>}
    {error && <p role="alert" className="analysis-error">{error}</p>}
    {authResumeNotice && <p role="status" className="analysis-notice">{authResumeNotice}</p>}
    <section className="browser-pca-card"><h2>01 · {t('Import and check', '导入与检查')}</h2>
      <div className="analysis-toolbar"><Field label={t('CSV or XLSX file, up to 32 MiB', 'CSV 或 XLSX 文件，最大 32 MiB')}><input type="file" accept=".csv,.xlsx" onChange={event => { read(event.target.files?.[0]); event.target.value = ''; }} /></Field><button type="button" onClick={loadSynthetic}>{t('Load labelled SYNTHETIC R reference', '加载标记为合成的 R 参考数据')}</button></div>
      {book && <><p>{book.name} · {book.sheets.length} {t('sheets', '个工作表')} · SHA-256 <code>{sourceHash}</code></p>
        <div className="analysis-grid"><Select label={t('Sheet', '工作表')} value={String(sheet)} onChange={value => { setSheet(Number(value)); setCandidate(null); }} options={book.sheets.map((item, i) => ({ value: String(i), label: item.name }))} />
          <NumberField label={t('Header row (1-based)', '标题行（从 1 起）')} min={1} integer value={headerRow + 1} onChange={value => { setHeaderRow(value - 1); setCandidate(null); }} />
          <Select label={t('Sample ID/name column', '样品 ID/名称列')} value={sampleColumn} onChange={value => { setSampleColumn(value); setCandidate(null); }} options={columnOptions} />
          <Select label={t('Group column (optional)', '分组列（可选）')} value={groupColumn} onChange={value => { setGroupColumn(value); setCandidate(null); }} options={columnOptions} />
          <TextField label={t('Common measurement unit (optional)', '统一测量单位（可选）')} value={unit} onChange={value => { setUnit(value.slice(0, 80)); setCandidate(null); }} /></div>
        <Field label={t('Measurement columns — select explicitly (Ctrl/Command for multiple)', '测量列——明确多选（Ctrl/Command）')}><select multiple size={Math.min(8, Math.max(2, header.length))} value={featureColumns.map(String)} onChange={event => { setFeatureColumns([...event.target.selectedOptions].map(item => Number(item.value))); setCandidate(null); }}>{header.map((item, i) => <option key={i} value={i}>{i + 1}: {item ?? ''}</option>)}</select></Field>
        <DataTable rows={rows.slice(0, 6).map(row => Object.fromEntries(row.map((value, i) => [String(i + 1), value])))} caption={t('First six source rows', '前六行源数据')} t={t} />
        {book.warnings?.length > 0 && <p role="note">{book.warnings.map(w => `${w.code} ${w.address}`).join('; ')}</p>}
        <button type="button" onClick={preview}>{t('Preview selected matrix', '预览选定矩阵')}</button>
      </>}
      {candidate && <div className="analysis-notice"><strong>{candidate.dataset.samples.length} × {candidate.dataset.features.length}</strong> · {t('invalid numeric cells retained as missing', '无效数值保留为缺失值')}: {candidate.invalidCells.length}
        {candidate.invalidCells.length > 0 && <DataTable rows={candidate.invalidCells} caption={t('Invalid source cells', '无效源单元格')} t={t} />}
        <p><button type="button" onClick={accept}>{t('Confirm browser-local dataset', '确认浏览器本地数据集')}</button></p></div>}
      {dataset && <p role="status"><strong>{dataset.name}</strong> · {dataset.samples.length} {t('samples', '个样品')} × {dataset.features.length} {t('variables', '个变量')} · {t('raw matrix remains unchanged', '原始矩阵保持不变')}</p>}
    </section>
    <section className="browser-pca-card"><h2>02 · {t('Preprocessing and calculation', '预处理与计算')}</h2>
      <div className="analysis-grid"><Select label={t('Missing values', '缺失值')} value={options.missing} onChange={value => updateOption('missing', value)} options={['error', 'mean', 'median', 'drop-samples', 'drop-features']} />
        <Select label={t('Constant variables', '常量变量')} value={options.constant} onChange={value => updateOption('constant', value)} options={['error', 'drop']} />
        <Select label={t('Scaling', '标准化')} value={options.scale} onChange={value => updateOption('scale', value)} options={['none', 'uv', 'pareto']} />
        <NumberField label={t('Components (blank = numerical rank)', '主成分数（留空 = 数值秩）')} nullable integer min={1} value={options.components} onChange={value => updateOption('components', value)} /></div>
      <Check label={t('Center each variable (required for UV/Pareto)', '每个变量中心化（UV/Pareto 必需）')} value={options.center} onChange={value => updateOption('center', value)} disabled={options.scale !== 'none'} />
      <Check label={t('Include variables marked as internal standards', '包含标记为内标的变量')} value={options.includeInternalStandards} onChange={value => updateOption('includeInternalStandards', value)} />
      <p>{t('UV divides by sample SD; Pareto divides by square root of sample SD. Missing/constant exclusions and imputation are recorded. PCA is exploratory, not a significance test.', 'UV 除以样本标准差；Pareto 除以样本标准差的平方根。缺失/常量剔除及补值均留痕。PCA 为探索性分析，不是显著性检验。')}</p>
      <div className="analysis-toolbar"><button type="button" disabled={!dataset || status === 'running'} onClick={run}>{t('Run browser PCA', '运行浏览器 PCA')}</button><button type="button" disabled={status !== 'running'} onClick={cancel}>{t('Cancel calculation', '取消计算')}</button><span role="status">{status === 'running' ? t('Worker calculating; no simulated progress', 'Worker 正在计算；不模拟进度') : status === 'completed' ? t('Calculation complete', '计算完成') : status === 'cancelled' ? t('Cancelled', '已取消') : status === 'failed' ? t('Failed', '失败') : t('Ready for input', '等待输入')}</span></div>
    </section>
    <section className="browser-pca-card"><h2>02A · {t('Agents SAI analysis plan', 'Agents SAI 分析计划')}</h2>
      <p>{t('Only sample/feature counts, warning codes and source hash are sent when you request a plan. The numeric matrix stays in this browser.', '仅在请求计划时发送样品/变量数量、警告代码和源文件哈希；数值矩阵仍留在浏览器。')}</p>
      <Check label={t('Enable AI analysis', '启用 AI 分析')} value={aiEnabled} onChange={toggleAi} disabled={!AI_GATEWAY_AVAILABLE} />
      {!AI_GATEWAY_AVAILABLE && <p role="note">{t('AI planning is unavailable in this static Pages preview. Use Browser PCA directly; a separately deployed authenticated Gateway is required for online AI.', '静态 Pages 预览不提供 AI 计划。可直接运行浏览器 PCA；线上 AI 需另行部署经过认证的 Gateway。')}</p>}
      {AI_GATEWAY_AVAILABLE && !aiEnabled && <p role="note">{t('AI analysis is off. Browser PCA calculation, plots, saves and exports remain available.', 'AI 分析已关闭；浏览器 PCA 计算、绘图、保存与导出仍可使用。')}</p>}
      <TextField label={t('Analysis goal', '分析目标')} value={goal} onChange={value => setGoal(value.slice(0, 500))} />
      <button type="button" disabled={!aiEnabled || !dataset || !goal.trim() || aiBusy || status === 'running'} onClick={requestPlan}>{t('Ask AI for PCA settings', '请求 AI 推荐 PCA 参数')}</button>
      {aiPlan && <div className="analysis-notice"><p>{aiMode === 'mock' ? t('Mock plan, not GPT', 'Mock 计划，非 GPT') : t('Model plan · review before calculation', '模型计划 · 计算前请核对')} · {aiPlan.dataset_id}</p><pre>{JSON.stringify(aiPlan.preview.options, null, 2)}</pre><p>{t('PCA is exploratory. Missing or constant value policies may alter the selected matrix.', 'PCA 属于探索性分析；缺失值或常量处理策略可能改变所选矩阵。')}</p><button type="button" disabled={status === 'running'} onClick={() => runWithPlan({ schema_version: aiPlan.schema_version, algorithm: aiPlan.algorithm, dataset_id: aiPlan.dataset_id, options: aiPlan.preview.options })}>{t('Confirm settings and run in browser', '确认参数并在浏览器运行')}</button></div>}
    </section>
    {result && dataset && <section className="browser-pca-card"><h2>03 · {t('Results and scientific figures', '结果与科研图表')}</h2>
      <p>{t('Result bound to snapshot', '结果绑定快照')} <code>{dataset.id}</code> · {result.data.rank} {t('nonzero components', '个非零主成分')} · {result.provenance.algorithmVersion} · {result.provenance.library}</p>
      {(featureUnits.length > 1 || featureUnits.includes('')) && <p role="note">{t('Feature units are mixed or unspecified. Check comparability and preprocessing before interpreting PCA.', '变量单位混合或未注明；解释 PCA 前请核对可比性和预处理。')}</p>}
      {(result.preprocessing.inputCellStates.unknown || result.preprocessing.inputCellStates.unspecified || result.preprocessing.inputCellStates['original-imputed']) && <p role="note">{t('Input cell lineage includes unknown or previously imputed values; interpret separation cautiously and inspect the audit.', '输入单元格含来源未知或此前已补值的数据；请谨慎解释分离情况并查看审计。')}</p>}
      <div className="analysis-toolbar">{['scores', 'loadings', 'variance'].map(kind => <button type="button" key={kind} onClick={() => save(kind)}>{t('Export', '导出')} {kind} CSV</button>)}<button type="button" onClick={() => save('json')}>{t('Export result JSON', '导出结果 JSON')}</button><button type="button" onClick={saveLocal}>{t('Save in this browser', '保存到本浏览器')}</button><button type="button" onClick={exportArchive}>{t('Export full analysis archive', '导出完整分析档案')}</button></div>
      <p>{t('Saving is optional. This archive contains the selected numeric matrix and may be visible to others using the same browser profile. Export a backup before clearing browser data.', '保存需主动操作。分析档案含选定的数值矩阵；同一浏览器配置的其他使用者可能看到。清除浏览器数据前请导出备份。')}</p>
      <div className="analysis-notice"><p>{t('Share only the run ID, dimensions, parameters, explained variance and warnings with Agents SAI. No raw matrix or sample scores are sent. The server cannot independently verify browser calculations.', '仅向 Agents SAI 发送运行 ID、维度、参数、解释方差和警告；不发送原始矩阵或样品得分。服务端无法独立复算浏览器结果。')}</p><button type="button" disabled={!aiEnabled || aiBusy || !currentRunId} onClick={explain}>{t('Confirm sharing summary and ask AI to explain', '确认分享摘要并请求 AI 解读')}</button>{aiExplanation && <p role="status"><strong>{aiMode === 'mock' ? 'Mock · ' : 'Agents SAI · '}</strong>{aiExplanation}</p>}{CONVERSATION_CONTEXT && <p>{t('This result can be linked to your chat after confirmation; only the bounded summary is stored online.', '确认后可将此结果关联到当前对话；线上仅保存限量摘要。')} <a href={`../ai-assistant/?conversation_id=${encodeURIComponent(CONVERSATION_CONTEXT)}`}>{t('Return to conversation', '返回对话')}</a></p>}</div>
      <details><summary>{t('Preprocessing audit', '预处理审计')}</summary><pre>{JSON.stringify(result.preprocessing, null, 2)}</pre></details>
      <div className="analysis-grid"><Select label={t('Figure', '图表')} value={plot.view} onChange={value => updatePlot('view', value)} options={[{ value: 'scores', label: t('Score plot', '得分图') }, { value: 'loadings', label: t('Loading plot', '载荷图') }, { value: 'biplot', label: t('Biplot', '双标图') }, { value: 'scree', label: t('Scree plot', '碎石图') }]} />
        <Select label={t('Legend', '图例位置')} value={plot.legend} onChange={value => updatePlot('legend', value)} options={['bottom', 'right', 'hidden']} />
        <NumberField label={t('Font size (10–18)', '字体大小（10–18）')} min={10} max={18} integer value={plot.fontSize} onChange={value => updatePlot('fontSize', Math.max(10, Math.min(18, value || 12)))} />
        <TextField label={t('X axis title (optional)', 'X 轴标题（可选）')} value={plot.xTitle} onChange={value => updatePlot('xTitle', value.slice(0, 80))} />
        <TextField label={t('Y axis title (optional)', 'Y 轴标题（可选）')} value={plot.yTitle} onChange={value => updatePlot('yTitle', value.slice(0, 80))} /></div>
      <div className="analysis-toolbar"><Check label={t('Sample labels', '样品标签')} value={plot.sampleLabels} onChange={value => updatePlot('sampleLabels', value)} /><Check label={t('Variable labels', '变量标签')} value={plot.variableLabels} onChange={value => updatePlot('variableLabels', value)} /><button type="button" onClick={() => updatePlot('zoom', Math.min(4, plot.zoom * 1.5))}>{t('Zoom in', '放大')}</button><button type="button" onClick={() => updatePlot('zoom', Math.max(1, plot.zoom / 1.5))}>{t('Zoom out', '缩小')}</button><button type="button" onClick={() => updatePlot('zoom', 1)}>{t('Reset zoom', '重置缩放')}</button><span>{plot.zoom.toFixed(1)}×</span></div>
      {groups.length > 12 && <p role="note">{t('More than 12 groups: legend is abbreviated; full IDs remain in the scores table.', '超过 12 个分组：图例简化，完整 ID 保留在得分表。')}</p>}
      {groups.slice(0, 12).length > 0 && <details><summary>{t('Group colours and symbols', '分组颜色与符号')}</summary><div className="browser-pca-group-grid">{groups.slice(0, 12).map((group, i) => <div key={group}><span>{group}</span><input aria-label={`${group} ${t('colour', '颜色')}`} type="color" value={plot.groupStyles[group]?.color ?? ['#0072B2', '#D55E00', '#009E73', '#CC79A7', '#000000'][i % 5]} onChange={event => updatePlot('groupStyles', { ...plot.groupStyles, [group]: { ...plot.groupStyles[group], color: event.target.value } })} /><Select label={`${group} ${t('symbol', '符号')}`} value={plot.groupStyles[group]?.symbol ?? ['circle', 'square', 'triangle', 'diamond'][i % 4]} onChange={value => updatePlot('groupStyles', { ...plot.groupStyles, [group]: { ...plot.groupStyles[group], symbol: value } })} options={['circle', 'square', 'triangle', 'diamond']} /></div>)}</div></details>}
      <p className="browser-pca-scroll-hint">{t('Swipe horizontally to inspect the full figure.', '横向滑动可查看完整图表。')}</p>
      <BrowserPcaPlot result={result} dataset={dataset} view={plot.view} settings={plot} t={t} />
      <details><summary>{t('Complete result tables', '完整结果表')}</summary><DataTable rows={variance} caption={t('Variance spectrum', '方差谱')} t={t} /><DataTable rows={scores} caption={t('Scores', '得分')} t={t} /><DataTable rows={loadings} caption={t('Loadings', '载荷')} t={t} /></details>
    </section>}
    <section className="browser-pca-card"><h2>04 · {t('Saved browser runs', '浏览器已存任务')}</h2><p>{t('Explicit local saves only; refresh to restore. Recompute with the restored settings using Run browser PCA. Older runs remain available.', '仅保存主动选择的任务；刷新后可恢复。使用恢复的参数点击“运行浏览器 PCA”重新计算，旧任务仍保留。')}</p>{savedRuns.length ? <ul className="browser-pca-saved">{savedRuns.map(item => <li key={item.runId}><span>{item.name} · {item.savedAt} · {item.engineVersion}</span><div><button type="button" onClick={() => restoreLocal(item.runId)}>{t('Restore', '恢复')}</button><button type="button" onClick={() => deleteLocal(item.runId)}>{t('Delete', '删除')}</button></div></li>)}</ul> : <p role="status">{t('No saved runs in this browser account.', '当前浏览器账号没有已保存任务。')}</p>}</section>
  </div>;
}
