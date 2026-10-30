import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, BrainCircuit, CircleAlert, Database, FlaskConical, RefreshCw } from 'lucide-react';

import { createAnalysisClient } from '../analysis/client.mjs';
import { createDatasetStore } from '../analysis/storage.mjs';
import { usePlatformPreferences } from '../app/PlatformPreferences.jsx';
import { routeHref } from '../app/platformRoutes.js';
import './AIModelsPage.css';

const TABS = [
  ['overview', '概览', 'Overview'],
  ['training', '模型训练', 'Model Training'],
  ['evaluation', '模型评价', 'Model Evaluation'],
  ['prediction', '预测应用', 'Prediction'],
  ['experiments', '实验记录', 'Experiments'],
];
const TRAINING_STEPS = [
  ['数据集选择', 'Dataset'],
  ['目标变量', 'Target'],
  ['特征选择', 'Features'],
  ['预处理', 'Preprocessing'],
  ['模型配置', 'Model'],
  ['验证', 'Validation'],
  ['训练', 'Train'],
];
const BASE = import.meta.env.BASE_URL;

function RouteLink({ route, onNavigate, children, className }) {
  const onClick = event => {
    if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !onNavigate) return;
    event.preventDefault();
    onNavigate(route);
  };
  return <a className={className} href={routeHref(route, BASE)} onClick={onClick}>{children}</a>;
}

function useModelWorkspaceState() {
  const [store] = useState(() => createDatasetStore());
  const [client] = useState(() => createAnalysisClient());
  const [snapshots, setSnapshots] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [dataset, setDataset] = useState(null);
  const [datasetError, setDatasetError] = useState('');
  const [service, setService] = useState({ status: 'checking', capabilities: null });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [stored, health] = await Promise.allSettled([store.list(), client.health()]);
    if (stored.status === 'fulfilled') {
      setSnapshots(stored.value);
      setDatasetError('');
    } else {
      setSnapshots([]);
      setDatasetError(stored.reason?.message || 'LOCAL_STORAGE_UNAVAILABLE');
    }
    setService(health.status === 'fulfilled'
      ? { status: health.value.capabilities.runtimeReady ? 'ready' : 'not-ready', capabilities: health.value.capabilities }
      : { status: 'offline', capabilities: null });
    setLoading(false);
  }, [client, store]);

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) return undefined;
    let active = true;
    store.load(selectedId).then(entry => {
      if (!active) return;
      if (!entry) throw new Error('PROJECT_NOT_FOUND');
      setDataset(entry.dataset);
      setDatasetError('');
    }).catch(error => {
      if (!active) return;
      setDataset(null);
      setDatasetError(error?.message || 'PROJECT_LOAD_FAILED');
    });
    return () => { active = false; };
  }, [selectedId, store]);

  const selectDataset = id => {
    setSelectedId(id);
    setDataset(null);
    setDatasetError('');
  };

  return { snapshots, selectedId, selectDataset, dataset, datasetError, service, loading, refresh };
}

function StatusCard({ label, value, detail, tone }) {
  return <div className={`ai-models__status-card ai-models__status-card--${tone}`}>
    <span>{label}</span><strong>{value}</strong><small>{detail}</small>
  </div>;
}

function SectionCard({ title, children, className = '' }) {
  return <section className={`ai-models__card ${className}`}><h2>{title}</h2>{children}</section>;
}

export default function AIModelsPage({ onNavigate }) {
  const { language } = usePlatformPreferences();
  const tr = (zh, en) => language === 'zh' ? zh : en;
  const [tab, setTab] = useState('overview');
  const [taskType, setTaskType] = useState('classification');
  const state = useModelWorkspaceState();
  const selectedSnapshot = useMemo(() => state.snapshots.find(item => item.id === state.selectedId), [state.snapshots, state.selectedId]);
  const includedSamples = state.dataset?.samples.filter(sample => sample.include !== false) ?? [];
  const groups = [...new Set(includedSamples.map(sample => sample.group).filter(Boolean))];
  const methods = state.service.capabilities?.methods ?? [];
  const openTab = next => setTab(next);
  const onTabKeyDown = (event, index) => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    else return;
    event.preventDefault();
    openTab(TABS[next][0]);
    document.getElementById(`ai-models-tab-${TABS[next][0]}`)?.focus();
  };

  return <div className="ai-models">
    <div className="ai-models__breadcrumb">
      <RouteLink route="home" onNavigate={onNavigate}>{tr('科研工作台', 'Research workspace')}</RouteLink>
      <span aria-hidden="true">/</span><span>{tr('智能模型', 'AI Models')}</span>
    </div>
    <header className="ai-models__header">
      <div className="ai-models__heading">
        <span className="ai-models__eyebrow"><BrainCircuit size={17} aria-hidden="true" /> {tr('模型实验工作区', 'MODEL EXPERIMENT WORKSPACE')}</span>
        <h1>{tr('智能模型与预测评价', 'AI Model Studio')}</h1>
        <p>{tr('在现有项目快照上设计可追溯的模型实验。当前为 Beta 框架；训练、模型持久化与新样本预测尚未开放。', 'Plan traceable model experiments from existing project snapshots. This Beta workspace does not yet run training, persist models, or predict new samples.')}</p>
      </div>
      <div className="ai-models__header-actions">
        <span className="ai-models__beta">Beta · {tr('框架测试中', 'Framework preview')}</span>
        <button type="button" onClick={state.refresh} disabled={state.loading}><RefreshCw size={16} aria-hidden="true" />{tr('刷新状态', 'Refresh status')}</button>
      </div>
    </header>

    <div className="ai-models__status-grid" aria-label={tr('当前工作区状态', 'Current workspace status')}>
      <StatusCard label={tr('当前数据集', 'Dataset')} value={selectedSnapshot?.name ?? tr('未选择', 'Not selected')}
        detail={selectedSnapshot ? `${selectedSnapshot.samples} ${tr('样品', 'samples')} · ${selectedSnapshot.features} ${tr('特征', 'features')}` : state.datasetError ? tr('本地快照读取失败', 'Local snapshot read failed') : `${state.snapshots.length} ${tr('个本地快照可选', 'local snapshots available')}`} tone={selectedSnapshot ? 'neutral' : 'muted'} />
      <StatusCard label={tr('本地计算服务', 'Local compute service')}
        value={state.loading ? tr('检查中', 'Checking') : state.service.status === 'ready' ? tr('可连接', 'Connected') : state.service.status === 'not-ready' ? tr('运行环境未就绪', 'Runtime not ready') : tr('离线', 'Offline')}
        detail={tr('读取现有分析服务 /health；不代表模型训练已开放', 'Existing analysis /health; model training is not enabled')} tone={state.service.status === 'ready' ? 'ready' : 'muted'} />
      <StatusCard label={tr('模型实验', 'Model experiment')} value={tr('暂无记录', 'No records')}
        detail={tr('未创建模型实验；分析运行不等于已验证模型', 'Analysis runs are not validated model experiments')} tone="muted" />
    </div>

    <div className="ai-models__tabs" role="tablist" aria-label={tr('模型工作区', 'Model workspace')}>
      {TABS.map(([id, zh, en], index) => <button key={id} type="button" role="tab" id={`ai-models-tab-${id}`}
        aria-controls={`ai-models-panel-${id}`} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1}
        onKeyDown={event => onTabKeyDown(event, index)} onClick={() => openTab(id)}>{tr(zh, en)}</button>)}
    </div>

    <div className="ai-models__panel" role="tabpanel" id={`ai-models-panel-${tab}`} aria-labelledby={`ai-models-tab-${tab}`} tabIndex={0}>
      {tab === 'overview' && <div className="ai-models__overview-grid">
        <SectionCard title={tr('从数据到可验证模型', 'From data to a validated model')} className="ai-models__card--lead">
          <p>{tr('模型工作区沿用数据分析的本地项目快照，不重复建立数据集。首先检查生物学单位、目标变量、特征和划分策略，再决定是否适合建模。', 'Model Studio reads the existing browser-local analysis snapshots. Review biological units, targets, features and split design before any future model training.')}</p>
          <RouteLink route="analysis" onNavigate={onNavigate} className="ai-models__text-link">{tr('前往数据分析管理快照', 'Manage snapshots in Data Analysis')} <ArrowRight size={16} aria-hidden="true" /></RouteLink>
        </SectionCard>
        <SectionCard title={tr('当前可用边界', 'Current capability boundary')}>
          <ul className="ai-models__check-list">
            <li>{tr('可读取本机已保存的数据分析快照', 'Read existing local analysis snapshots')}</li>
            <li>{tr('可查看本地计算服务真实状态', 'Inspect real local compute-service state')}</li>
            <li>{tr('训练、模型评价与新样本推理尚未接通', 'Training, evaluation and new-sample inference are not connected')}</li>
          </ul>
        </SectionCard>
        <SectionCard title={tr('方法与验证原则', 'Methods and validation')} className="ai-models__card--wide">
          <p>{tr('现有 PLS-DA / OPLS-DA 属于数据分析引擎，包含独立样本单位检查及嵌套交叉验证。模型工作区尚未完成其训练产物、外部测试与持久化适配，不能把分析结果当作可部署预测模型。', 'Existing PLS-DA / OPLS-DA belong to the analysis engine with independent-unit checks and nested cross-validation. Their outputs are not yet adapted into persisted, externally validated prediction models.')}</p>
        </SectionCard>
      </div>}

      {tab === 'training' && <div className="ai-models__training-grid">
        <div className="ai-models__training-main">
          <SectionCard title={tr('实验配置', 'Experiment setup')}>
            <p>{tr('按顺序核对数据集、目标、特征、预处理、模型配置和验证。训练入口在科学门禁与模型服务完成前保持关闭。', 'Review dataset, target, features, preprocessing, model configuration and validation in order. Training stays unavailable until scientific gates and a model service are implemented.')}</p>
            <ol className="ai-models__step-list">{TRAINING_STEPS.map(([zh, en], index) => <li key={zh}><span>{index + 1}</span>{tr(zh, en)}</li>)}</ol>
          </SectionCard>
          <SectionCard title={tr('选择现有项目快照', 'Select an existing project snapshot')}>
            <label htmlFor="ai-models-dataset">{tr('数据集快照', 'Dataset snapshot')}</label>
            <select id="ai-models-dataset" value={state.selectedId} onChange={event => state.selectDataset(event.target.value)} disabled={state.loading || !!state.datasetError}>
              <option value="">{tr('请选择本地快照', 'Select a local snapshot')}</option>
              {state.snapshots.map(item => <option key={item.id} value={item.id}>{item.name} · {item.samples} × {item.features}</option>)}
            </select>
            {state.datasetError && <p className="ai-models__error" role="alert">{tr('无法读取本地项目快照，请在数据分析页核对浏览器存储。', 'Could not read local snapshots. Check browser storage in Data Analysis.')} ({state.datasetError})</p>}
            {!state.datasetError && !state.snapshots.length && <p>{tr('本机尚无已保存快照。请先在数据分析工作台导入并保存数据。', 'No saved snapshots in this browser. Import and save data in Data Analysis first.')}</p>}
            {state.dataset && <p className="ai-models__snapshot-id">{tr('快照 ID', 'Snapshot ID')}: <code>{state.dataset.id}</code></p>}
          </SectionCard>
          <SectionCard title={tr('任务与目标变量', 'Task and target')}>
            <fieldset className="ai-models__task-options"><legend>{tr('任务类型', 'Task type')}</legend>
              <label><input type="radio" name="model-task" checked={taskType === 'classification'} onChange={() => setTaskType('classification')} /><span><strong>{tr('分类', 'Classification')}</strong><small>{tr('以样品分组作为候选目标', 'Use sample groups as a candidate target')}</small></span></label>
              <label><input type="radio" name="model-task" checked={taskType === 'regression'} onChange={() => setTaskType('regression')} /><span><strong>{tr('回归', 'Regression')}</strong><small>{tr('需要显式数值型目标变量', 'Requires an explicit numeric target')}</small></span></label>
            </fieldset>
            <p>{taskType === 'classification'
              ? (state.dataset ? tr(`当前快照包含 ${groups.length} 个非空分组；分组不代表独立生物学单位。`, `${groups.length} non-empty groups in this snapshot; groups do not prove biological independence.`) : tr('选择快照后显示真实分组状态。', 'Select a snapshot to inspect actual group state.'))
              : tr('现有数据集契约没有通用数值目标字段；回归训练待扩展目标变量映射后开放。', 'The current dataset contract has no generic numeric target field. Regression awaits an explicit target mapping.')}</p>
          </SectionCard>
          <SectionCard title={tr('特征与方法', 'Features and methods')}>
            <p>{state.dataset ? tr(`当前快照包含 ${state.dataset.features.length} 个特征。后续将提供特征筛选及单位一致性检查。`, `This snapshot contains ${state.dataset.features.length} features. Feature selection and unit checks are not yet enabled.`) : tr('选择快照后显示特征数量。', 'Select a snapshot to view feature count.')}</p>
            <div className="ai-models__method-list">
              <div><strong>PLS-DA</strong><span>{methods.includes('plsda') ? tr('现有分析引擎可用，模型训练适配中', 'Analysis engine available; model adapter pending') : tr('现有分析引擎当前不可用', 'Analysis engine unavailable')}</span></div>
              <div><strong>OPLS-DA</strong><span>{methods.includes('oplsda') ? tr('现有分析引擎可用，模型训练适配中', 'Analysis engine available; model adapter pending') : tr('现有分析引擎当前不可用', 'Analysis engine unavailable')}</span></div>
              <div><strong>{tr('通用回归 / 随机森林', 'Regression / Random Forest')}</strong><span>{tr('未实现', 'Not implemented')}</span></div>
            </div>
          </SectionCard>
        </div>
        <aside className="ai-models__training-aside">
          <h2><CircleAlert size={19} aria-hidden="true" />{tr('训练前必须核对', 'Required before training')}</h2>
          <ul>
            <li>{tr('按独立生物学单位划分训练与测试，技术重复不得泄漏。', 'Split by independent biological unit; technical repeats must not leak.')}</li>
            <li>{tr('预处理和特征选择仅在训练折内拟合。', 'Fit preprocessing and feature selection inside training folds only.')}</li>
            <li>{tr('调参与性能评价使用分离的验证层。', 'Separate hyperparameter tuning from performance assessment.')}</li>
            <li>{tr('小样本须明确标注探索性结论。', 'Flag small-sample results as exploratory.')}</li>
          </ul>
          <button type="button" disabled aria-describedby="ai-models-training-disabled">{tr('开始训练', 'Start training')}</button>
          <p id="ai-models-training-disabled">{tr('模型训练服务与实验存储未实现，当前不可运行。', 'Model training service and experiment storage are not implemented.')}</p>
        </aside>
      </div>}

      {tab === 'evaluation' && <div className="ai-models__overview-grid">
        <SectionCard title={tr('分类模型评价', 'Classification evaluation')}>
          <p>{tr('未来展示 Balanced Accuracy、Macro-F1、混淆矩阵、交叉验证结果、特征贡献与验证说明。', 'Reserved for Balanced Accuracy, Macro-F1, confusion matrix, cross-validation results, feature contribution and validation notes.')}</p>
        </SectionCard>
        <SectionCard title={tr('回归模型评价', 'Regression evaluation')}>
          <p>{tr('未来展示 R²、RMSE、MAE、预测值与实测值、残差和特征贡献。', 'Reserved for R², RMSE, MAE, predicted versus observed values, residuals and feature contribution.')}</p>
        </SectionCard>
        <div className="ai-models__empty ai-models__empty--wide" role="status"><FlaskConical size={27} aria-hidden="true" /><strong>{tr('暂无真实模型评价结果', 'No real model evaluation results')}</strong><p>{tr('只有经训练并完成独立验证的模型才会在此显示指标与图表。现有数据分析运行不会自动转成模型评价。', 'Metrics and charts appear only after training and independent validation are implemented. Existing analysis runs are not converted into model evaluations.')}</p></div>
      </div>}

      {tab === 'prediction' && <div className="ai-models__overview-grid">
        <SectionCard title={tr('预测应用流程', 'Prediction workflow')} className="ai-models__card--lead">
          <ol className="ai-models__plain-steps"><li>{tr('选择已验证并持久化的模型', 'Choose a validated, persisted model')}</li><li>{tr('导入新样本并核对特征与单位', 'Import new samples; check features and units')}</li><li>{tr('查看预测、不确定性与适用范围', 'Review predictions, uncertainty and applicability')}</li><li>{tr('导出带溯源信息的结果', 'Export traceable results')}</li></ol>
        </SectionCard>
        <div className="ai-models__empty"><BrainCircuit size={27} aria-hidden="true" /><strong>{tr('预测暂不可用', 'Prediction unavailable')}</strong><p>{tr('尚无可部署模型，也没有模型持久化与推理服务。PLS-DA / OPLS-DA 分析结果不能直接用于任意新样本。', 'No deployable model, persistence layer or inference service exists. PLS-DA / OPLS-DA analysis results cannot directly predict arbitrary new samples.')}</p><button type="button" disabled>{tr('导入新样本', 'Import new samples')}</button></div>
      </div>}

      {tab === 'experiments' && <div className="ai-models__overview-grid">
        <SectionCard title={tr('模型实验记录', 'Model experiment records')} className="ai-models__card--wide">
          <div className="ai-models__empty"><Database size={27} aria-hidden="true" /><strong>{tr('尚无模型实验', 'No model experiments yet')}</strong><p>{tr('未来将沿用现有项目快照，记录实验 ID、数据集版本、算法与参数、特征、划分与随机种子、依赖环境、验证结果、时间和导出记录。当前不将数据分析运行冒充模型实验。', 'Future records will link to existing snapshots and capture experiment ID, dataset version, algorithm and parameters, features, split and seed, environment, validation, time and exports. Analysis runs are not presented as model experiments.')}</p><RouteLink route="analysis" onNavigate={onNavigate} className="ai-models__text-link">{tr('查看现有分析项目', 'View analysis projects')} <ArrowRight size={16} aria-hidden="true" /></RouteLink></div>
        </SectionCard>
      </div>}
    </div>
  </div>;
}
