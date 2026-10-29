import { useState } from 'react';
import { FlaskConical, RefreshCw } from 'lucide-react';
import { usePlatformPreferences } from '../app/PlatformPreferences.jsx';
import useWorkbench from '../analysis/useWorkbench.js';
import { serviceError } from '../analysis/client.mjs';
import { createDataset } from '../analysis/dataset.mjs';
import { exportProject, exportDatasetCsv, exportDatasetXlsx } from '../analysis/exports.mjs';
import ImportPanel from '../components/analysis/ImportPanel.jsx';
import GroupEditor from '../components/analysis/GroupEditor.jsx';
import RecipePanel from '../components/analysis/RecipePanel.jsx';
import AnalysisPanel from '../components/analysis/AnalysisPanel.jsx';
import ResultsPanel from '../components/analysis/ResultsPanel.jsx';
import { downloadFile } from '../analysis/download.mjs';
import { Select } from '../components/analysis/Controls.jsx';
import synthetic from '../../../services/analysis/tests/fixtures/synthetic-3groups.json';
import '../styles/analysis.css';
export default function DataAnalysisPage({
  onNavigate
}) {
  const {
      language
    } = usePlatformPreferences(),
    t = (en, zh) => language === 'zh' ? zh : en,
    w = useWorkbench(),
    [tab, setTab] = useState('data'),
    [project, setProject] = useState('');
  const tabs = [['data', t('Data & groups', '数据与分组')], ['preprocess', t('Preprocess', '预处理')], ['analysis', t('Analysis', '分析')], ['results', t('Results', '结果')]],
    available = w.health?.capabilities?.runtimeReady ? w.health.capabilities.methods : [],
    busy = !!w.active;
  const attempt = fn => {
    try {
      fn();
    } catch (e) {
      w.setError(e);
    }
  };
  const replace = (d, s) => {
    if ((w.dataset || w.dirty) && !window.confirm(t('Replace project context? Saved snapshots remain. Pending metadata draft will be discarded.', '替换项目上下文？已保存快照保留，待应用草稿将丢弃。'))) return;
    attempt(() => {
      w.replace(d, s);
      setTab('data');
    });
  };
  const exportData = type => attempt(() => {
    if (type === 'project') downloadFile('analysis-project.json', exportProject(w.dataset, {
      schemaVersion: 1,
      recipe: w.recipe,
      analysis: w.analysis,
      runs: w.runs
    }));
    if (type === 'csv') downloadFile('source-matrix.csv', exportDatasetCsv(w.dataset), 'text/csv;charset=utf-8');
    if (type === 'xlsx') downloadFile('source-matrix.xlsx', exportDatasetXlsx(w.dataset), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });
  const start = bound => {
    w.run(bound);
    setTab('results');
  };
  return <div className="analysis-workbench">
  <header className="analysis-header">
    <div>
      <span className="analysis-eyebrow">
        <FlaskConical size={18} aria-hidden="true" /> {t('Local research workbench · Beta', '本地科研工作台 · Beta')}
      </span>
      <h1>
        {t('Data analysis', '数据分析')}
      </h1>
      <p>
        {w.dataset?.name || t('No project loaded', '尚未加载项目')}
      </p>
      {w.dataset && <code>
        {t('Snapshot', '快照')}: {w.dataset.id}
      </code>}
    </div>
    <div className="analysis-service-card">
      <span className="analysis-service-label">{t('LOCAL COMPUTE', '本地计算')}</span>
      <p role="status" className={available.length ? 'is-ready' : 'is-offline'}>
        {t('Compute service', '计算服务')}: {available.length ? t('Ready', '已就绪') : t('Offline / unavailable', '离线 / 不可用')}
      </p>
      <button onClick={w.connect}>
        <RefreshCw size={16} aria-hidden="true" />
        {t('Reconnect', '重新连接')}
      </button>
      {w.dataset && <p>
        {w.saveState === 'saved' ? t('Snapshot/settings/runs saved locally', '快照/设置/运行已本地保存') : w.saveState === 'failed' ? t('Local save failed — export a backup', '本地保存失败——请导出备份') : t('Saving locally', '正在本地保存')}
      </p>}
    </div>
  </header>
 <p className="analysis-notice analysis-scope-note">
    {t('Observed-only inference is separate from exploratory preprocessing. AI identification and flavor prediction remain planned; no production AI model is deployed.', '仅实测推断与探索性预处理独立。未知物辅助鉴定与风味预测仍为规划，未部署生产 AI 模型。')}
  </p>
 {w.error && <div role="alert" className="analysis-error">
    {serviceError(w.error, language)} <button onClick={() => w.setError(null)}>
      {t('Dismiss', '关闭')}
    </button>
  </div>}
 <div className="analysis-toolbar analysis-project-actions" aria-label={t('Project actions', '项目操作')}>
    <button disabled={busy} onClick={() => replace(null)}>
      {t('New / clear project context', '新建 / 清空项目上下文')}
    </button>
    <button disabled={busy} onClick={() => replace(createDataset({
        ...synthetic,
        id: crypto.randomUUID(),
        provenance: {
          ...synthetic.provenance,
          independenceConfirmed: false,
          groupedIndependenceConfirmed: false
        }
      }))}>
      {t('Load SYNTHETIC example (not scientific evidence)', '加载合成示例（非科学证据）')}
    </button>
    <button onClick={() => onNavigate?.('resources')}>
      {t('Public external analysis references','公共外部分析参考')}
    </button>
    <button disabled={busy} onClick={() => onNavigate?.('processing')}>
      {t('Data processing', '数据处理')}
    </button>
    {w.dataset && <>
      <button onClick={() => exportData('project')}>
        {t('Export portable project', '导出便携项目')}
      </button>
      <button onClick={() => exportData('csv')}>CSV</button>
      <button onClick={() => exportData('xlsx')}>XLSX</button>
    </>}
  </div>
 <details className="analysis-snapshots">
    <summary onClick={w.refresh}>
      {t('Saved local snapshots', '已保存本地快照')}
    </summary>
    <div className="analysis-toolbar">
      <Select label={t('Snapshot to restore', '待恢复快照')} value={project} onChange={setProject} options={[{
          value: '',
          label: t('Choose saved snapshot', '选择已保存快照')
        }, ...w.saved.map(p => ({
          value: p.id,
          label: `${p.name} · ${p.savedAt} · ${p.id}`
        }))]} />
      <button disabled={busy || !project} onClick={() => {
          if (!w.dataset || window.confirm(t('Replace context and discard pending draft?', '替换上下文并放弃待应用草稿？'))) w.load(project);
        }}>
        {t('Restore snapshot', '恢复快照')}
      </button>
    </div>
  </details>
 {busy && <div className="analysis-notice" role="status">
    {w.active.status} · {Math.max(0, Math.floor((w.clock - Date.parse(w.active.createdAt)) / 1000))} {t('seconds elapsed (no fabricated progress)', '秒已用时（无虚构百分比）')} <button onClick={w.cancel}>
      {t('Cancel active job', '取消当前任务')}
    </button>
  </div>}
 {w.dirty && <p role="status" className="analysis-notice">
    {t('Pending metadata draft: apply or explicitly discard it before running.', '元数据草稿待应用：运行前请应用或明确放弃。')}
  </p>}
 <div className="analysis-workflow-layout">
 <nav className="analysis-tabs" role="tablist" aria-label={t('Analysis workflow', '分析流程')}>
    {tabs.map(([id, label], i) => <button role="tab" id={`analysis-tab-${id}`} aria-controls={`analysis-panel-${id}`} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} key={id} onKeyDown={e => {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
          e.preventDefault();
          const index = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
          setTab(tabs[index][0]);
          document.getElementById(`analysis-tab-${tabs[index][0]}`)?.focus();
        }
      }} onClick={() => setTab(id)}>
      <span className="analysis-tab-index">{String(i + 1).padStart(2, '0')}</span><span>{label}</span>
    </button>)}
  </nav>
 <div className="analysis-stage-panel" role="tabpanel" id={`analysis-panel-${tab}`} aria-labelledby={`analysis-tab-${tab}`} tabIndex={0}>
 <div hidden={tab !== 'data'}>
      <fieldset disabled={busy}>
        <ImportPanel key={w.contextId} onReplace={replace} onError={w.setError} t={t} />
        {w.dataset && <GroupEditor key={w.dataset.id} dataset={w.dataset} dirty={w.dirty} onDataset={w.editDataset} onDirty={w.setDirty} onError={w.setError} t={t} />}
      </fieldset>
    </div>
 {w.dataset ? <>
      {tab === 'preprocess' && <fieldset disabled={busy}>
        <RecipePanel dataset={w.dataset} recipe={w.recipe} onChange={w.setRecipe} onPreview={() => start({
            dataset: w.dataset,
            recipe: w.recipe,
            analysis: {
              method: 'preprocess'
            }
          })} disabled={busy || w.dirty || !available.includes('preprocess')} t={t} />
      </fieldset>}
      {tab === 'analysis' && <fieldset disabled={busy}>
        <AnalysisPanel dataset={w.dataset} analysis={w.analysis} onChange={w.setAnalysis} available={available} onRun={() => start()} disabled={busy || w.dirty} t={t} />
      </fieldset>}
      {tab === 'results' && <ResultsPanel key={w.contextId} runs={w.runs} dataset={w.dataset} recipe={w.recipe} analysis={w.analysis} onRetry={start} disabled={busy || w.dirty || !available.length} t={t} />}
    </> : tab !== 'data' && <p>
      {t('Import data or load the clearly labelled synthetic example first.', '请先导入数据或加载明确标注的合成示例。')}
    </p>}
 </div>
 </div>
</div>;
}
