import { taskIdentity, taskLabel, taskArchiveFileName } from '../../lib/taskIdentity.mjs'
import { createTaskRun, persistTaskRun } from '../../lib/shimadzuTaskLifecycle.mjs'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import {
  Activity,
  AlertCircle,
  ArrowDownToLine,
  Check,
  ChevronRight,
  Circle,
  Download,
  CloudDownload,
  FileCheck2,
  FileSpreadsheet,
  FlaskConical,
  Gauge,
  Layers3,
  Loader2,
  Play,
  RotateCcw,
  ShieldCheck,
  Sun,
  TerminalSquare,
  Upload,
  UserRound,
  LogOut,
  History,
  Moon,
} from 'lucide-react'
import { createShimadzuApi } from '../../lib/shimadzuApi'
import { assertWorkbookFile, browserEnginePresentation } from '../../lib/shimadzuBrowserContract'
import { createShimadzuWorkerClient } from '../../lib/shimadzuWorkerClient'
import { createShimadzuCloud } from '../../lib/shimadzuCloud'
import { createShimadzuTaskStore } from '../../lib/shimadzuTaskStore'
import ShimadzuFailureDetails from './ShimadzuFailureDetails.jsx'
import { analyticsEnabled, supabase } from '../../lib/supabase'
import { handoffCompletedArchive } from '../../analysis/handoff.mjs'
import { createDatasetStore } from '../../analysis/storage.mjs'
import { serviceError } from '../../analysis/client.mjs'
import { taskFeedback } from './taskFeedback.mjs'
import { deriveAnalysisConsole, isCompletedConsoleStep } from './analysisConsoleModel.mjs'
import { deriveProcessingStages, filterTaskRecords, resultAvailability } from './processingWorkspaceModel.mjs'
import './ShimadzuAnalysisPage.css'

gsap.registerPlugin(useGSAP)

const API_BASE = (import.meta.env.VITE_FEMA_API_URL || 'http://127.0.0.1:8787').replace(/\/$/, '')
const THEME_STORAGE_KEY = 'shimadzu-analysis-theme'
const textFor = (language, zh, en) => language === 'en' ? en : zh
const TaskParent = ({ record, language = 'zh' }) => {
  const identity = taskIdentity(record)
  return identity?.parentTaskId ? <small className="processing-task-parent">{textFor(language, '来源任务', 'Rerun of')} · {identity.parentTaskNumber || identity.parentTaskId}</small> : null
}
const localizedTaskName = (value, language) => ['岛津气质分析', 'Shimadzu GC-MS analysis'].includes(value)
  ? textFor(language, '岛津气质分析', 'Shimadzu GC-MS analysis')
  : value

const WORKFLOW = [
  { index: 0, short: '输入配置', label: '输入配置与清单', description: '核对工作表、样品分组、内标参数与名称映射。', work: ['读取原始工作簿与样品信息表', '匹配样品名称和三平行分组', '复算内标终浓度并建立输入清单'], enShort: 'Inputs', enLabel: 'Input configuration and inventory', enDescription: 'Validate worksheets, sample groups, internal-standard parameters, and name mappings.', enWork: ['Read the raw workbook and sample information', 'Match sample names and triplicate groups', 'Recalculate internal-standard concentration and build the input inventory'] },
  { index: 1, short: 'Hit #1', label: 'Hit #1 整理', description: '逐样品提取峰表与相似度检索中的第一候选。', work: ['定位 MC Peak Table', '匹配 Spectrum# 与 Hit #1', '保存源工作表和原始行号'], enShort: 'Hit #1', enLabel: 'Hit #1 extraction', enDescription: 'Extract each peak table and the first similarity-search candidate.', enWork: ['Locate MC Peak Table', 'Match Spectrum# to Hit #1', 'Preserve source worksheet and row numbers'] },
  { index: 2, short: '筛查', label: '化合物筛查', description: '清除无效 CAS、Si/F/Cl，并按 RI 规则处理重复峰。', work: ['执行元素与 CAS 有效性筛查', '计算单峰 RI 偏差', '合并相邻重复峰或保留最优记录'], enShort: 'Screening', enLabel: 'Compound screening', enDescription: 'Remove invalid CAS and Si/F/Cl records, then resolve duplicate peaks by RI rules.', enWork: ['Apply element and CAS validity screening', 'Calculate single-peak RI deviation', 'Merge adjacent duplicates or retain the best record'] },
  { index: 3, short: '平行处理', label: '平行峰面积处理', description: '定位内标，补建缺失内标，并按 2/3 与 1/3 规则处理。', work: ['定位配置内标与替代内标', '补建缺失内标峰面积', '执行三平行检出与缺失处理'], enShort: 'Replicates', enLabel: 'Replicate peak-area processing', enDescription: 'Locate internal standards, reconstruct missing standards, and apply 2/3 and 1/3 rules.', enWork: ['Locate configured and substitute internal standards', 'Reconstruct missing internal-standard peak areas', 'Apply triplicate detection and missing-value rules'] },
  { index: 4, short: '半定量', label: '跨样品合并与半定量', description: '跨样品按 CAS 合并，保留峰面积并计算浓度。', work: ['构建全样品 CAS 并集', '按样品内标计算半定量浓度', '记录 NA、响应因子和计算异常'], enShort: 'Semi-quant', enLabel: 'Cross-sample merge and semi-quantification', enDescription: 'Merge compounds across samples by CAS, preserve peak areas, and calculate concentrations.', enWork: ['Build the all-sample CAS union', 'Calculate semi-quantitative concentration from each sample standard', 'Record NA values, response factors, and calculation exceptions'] },
  { index: 5, short: '统计与 QC', label: '统计、CV、CAS 与 QC', description: '计算 Mean、样本 SD、CV，并按设置执行质量检查。', work: ['计算 Mean、SD 和 CV', '按需生成 CV 筛查结果', '检查 NA、重复 CAS、公式与内标回算'], enShort: 'Statistics & QC', enLabel: 'Statistics, CV, CAS, and QC', enDescription: 'Calculate mean, sample SD, and CV, then apply configured quality checks.', enWork: ['Calculate mean, SD, and CV', 'Generate CV-screened results when enabled', 'Check NA values, duplicate CAS, formulas, and standard back-calculation'] },
  { index: 6, short: '矩阵拆分', label: '按矩阵拆分', description: '输出作图准备矩阵与完整项目 CAS 清单。', work: ['按矩阵名称拆分结果', '输出三个平行与 Mean 加 SD 版本', '执行完整性验证并封装结果'], enShort: 'Matrix split', enLabel: 'Matrix-specific outputs', enDescription: 'Produce plot-ready matrices and the complete project CAS inventory.', enWork: ['Split results by matrix name', 'Export triplicate and mean-plus-SD versions', 'Verify completeness and package results'] },
]
const localizedStage = (stage, language) => language === 'en'
  ? { ...stage, short: stage.enShort, label: stage.enLabel, description: stage.enDescription, work: stage.enWork || [] }
  : stage

const STATUS_LABELS = {
  created: '等待运行', queued: '排队中', running: '处理中', saving: '云端保存中', waiting_review: '等待复核', complete: '已完成', failed: '运行失败', cancelled: '已取消', interrupted: '已中断，需重新运行',
  pending: '未开始', PASS: '通过', WARN: '警告', REVIEW: '需复核', FAIL: '失败',
}
const STATUS_LABELS_EN = {
  created: 'Ready to run', queued: 'Queued', running: 'Running', saving: 'Saving to cloud', waiting_review: 'Awaiting review', complete: 'Complete', failed: 'Failed', cancelled: 'Cancelled', interrupted: 'Interrupted; rerun required',
  pending: 'Not started', PASS: 'Pass', WARN: 'Warning', REVIEW: 'Review', FAIL: 'Fail',
}
const statusLabel = (status, language) => (language === 'en' ? STATUS_LABELS_EN : STATUS_LABELS)[status] || status

const CONSOLE_IO = [
  { input: '原始工作簿、样品与内标信息表', enInput: 'Raw workbook and sample/internal-standard sheet', output: '输入配置、输入清单和配置报告', enOutput: 'Input configuration, inventory, and configuration report' },
  { input: '已核验配置与原始峰表', enInput: 'Validated configuration and raw peak tables', output: 'Hit #1 结果清单、CAS 恢复审核表', enOutput: 'Hit #1 results and CAS recovery audit' },
  { input: 'Hit #1 整理结果', enInput: 'Hit #1 results', output: '筛查后结果清单与筛查报告', enOutput: 'Screened results and screening report' },
  { input: '筛查结果与样品内标配置', enInput: 'Screened records and sample standards', output: '组峰面积结果与补建剔除报告', enOutput: 'Group peak areas and imputation/removal report' },
  { input: '平行峰面积与内标参数', enInput: 'Replicate peak areas and standard parameters', output: '峰面积与浓度表、半定量计算报告', enOutput: 'Peak-area/concentration table and semi-quantification report' },
  { input: '半定量浓度与分组', enInput: 'Semi-quantitative concentrations and groups', output: '三平行、Mean/SD、CAS 清单与 QC 报告', enOutput: 'Triplicates, mean/SD, CAS lists, and QC report' },
  { input: '统计与 QC 结果、矩阵名称', enInput: 'Statistics/QC results and matrix names', output: '按矩阵拆分的浓度工作簿', enOutput: 'Matrix-specific concentration workbooks' },
]
const PREFLIGHT_STAGE = { label: '运行前预检与输入配置', enLabel: 'Preflight and input configuration', description: '检查文件格式与执行参数；Worker 阶段 0 进一步核对工作表、字段、样品和内标关系。', enDescription: 'Check file format and parameters; Worker stage 0 verifies worksheets, fields, samples, and internal standards.', work: ['检查 .xlsx 与文件大小', '核对参数依赖', '由 Worker 阶段 0 验证工作簿结构与样品关系'], enWork: ['Check .xlsx format and file size', 'Verify parameter dependencies', 'Validate workbook structure and sample relationships in Worker stage 0'] }
const PACKAGE_STAGE = { label: '结果包', enLabel: 'Result package', description: '保留七阶段输出、质量证据和运行记录并封装 ZIP。', enDescription: 'Package seven-stage outputs, QC evidence, and execution records into a ZIP.', work: ['等待 Worker 完成矩阵拆分', '验证并封装结果档案'], enWork: ['Wait for Worker matrix split', 'Verify and package the result archive'] }
const PACKAGE_IO = { input: '六个分析阶段及输入配置的真实产物', enInput: 'Actual outputs from input setup and six analysis stages', output: '结果 ZIP 与质量证据', enOutput: 'Result ZIP and QC evidence' }

const APPROVAL_LABELS = { pending: '等待管理员审批', approved: '已获准使用', rejected: '申请未通过', suspended: '账号已停用' }
const APPROVAL_LABELS_EN = { pending: 'Awaiting administrator approval', approved: 'Approved', rejected: 'Request rejected', suspended: 'Account suspended' }

function AccountPanel({ cloud, session, profile, loading, error, onRefresh, onRequireAuth, language }) {
  const [pendingUsers, setPendingUsers] = useState([])
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  const [bootstrapCode, setBootstrapCode] = useState('')

  useEffect(() => {
    if (!profile?.is_admin) return
    cloud.pendingUsers().then(setPendingUsers).catch(value => setMessage(value.message))
  }, [cloud, profile?.is_admin])

  const review = async (userId, status) => {
    setWorking(true); setMessage('')
    try {
      await cloud.reviewUser(userId, status)
      setPendingUsers(await cloud.pendingUsers())
      setMessage(status === 'approved' ? textFor(language, '已批准该账号。', 'Account approved.') : textFor(language, '已拒绝该账号。', 'Account rejected.'))
    } catch (value) { setMessage(value.message) } finally { setWorking(false) }
  }

  const claimAdmin = async event => {
    event.preventDefault()
    setWorking(true); setMessage('')
    try {
      await cloud.claimFirstAdmin(bootstrapCode.trim())
      setBootstrapCode('')
      setMessage(textFor(language, '管理员初始化完成。', 'Administrator setup complete.'))
      await onRefresh()
    } catch (value) { setMessage(value.message) } finally { setWorking(false) }
  }

  if (!cloud.configured) {
    return <section id="account-panel" className="shimadzu-account local"><ShieldCheck /><div><strong>{textFor(language, '本地隐私模式', 'Local privacy mode')}</strong><p>{textFor(language, '当前构建未连接云端账号；活动任务可在同一浏览器恢复，完成后请立即下载结果。', 'This build is not connected to cloud accounts. Active tasks can be restored in this browser; download results promptly after completion.')}</p></div></section>
  }

  if (loading) return <section id="account-panel" className="shimadzu-account"><Loader2 className="spin" /><div><strong>{textFor(language, '正在核验账号', 'Verifying account')}</strong><p>{textFor(language, '读取登录会话与审批状态。', 'Loading the sign-in session and approval status.')}</p></div></section>

  if (!session) return (
    <section id="account-panel" className="shimadzu-account shimadzu-reveal" aria-labelledby="account-title">
      <div className="shimadzu-account-copy"><UserRound /><div><h2 id="account-title">{textFor(language, '小组账号', 'Team account')}</h2><p>{textFor(language, '原始工作簿不会上传。登录并通过管理员审批后，可计算并保留结果 ZIP 7 天、任务记录 90 天。', 'Raw workbooks are not uploaded. After sign-in and approval, result ZIP files are retained for 7 days and task records for 90 days.')}</p></div></div>
      <button type="button" className="shimadzu-signout" onClick={() => onRequireAuth?.('processing.private')?.catch(value => setMessage(value.message))}>{textFor(language, '使用统一账号登录或申请', 'Sign in or request access')}</button>
      {(message || error) && <p className="shimadzu-account-message">{message || error}</p>}
    </section>
  )

  return (
    <section id="account-panel" className="shimadzu-account signed-in shimadzu-reveal" aria-labelledby="account-title">
      <div className="shimadzu-account-copy"><UserRound /><div><h2 id="account-title">{profile?.display_name || session.user.email}</h2><p>{session.user.email} · {(language === 'en' ? APPROVAL_LABELS_EN : APPROVAL_LABELS)[profile?.approval_status] || textFor(language, '正在建立审批档案', 'Creating approval record')}</p></div></div>
      <span className={`shimadzu-approval state-${profile?.approval_status || 'pending'}`}>{profile?.is_admin ? textFor(language, '管理员 · ', 'Administrator · ') : ''}{(language === 'en' ? APPROVAL_LABELS_EN : APPROVAL_LABELS)[profile?.approval_status] || textFor(language, '待确认', 'Pending')}</span>
      <button className="shimadzu-signout" type="button" onClick={() => cloud.signOut()}><LogOut />{textFor(language, '退出', 'Sign out')}</button>
      {(message || error) && <p className="shimadzu-account-message">{message || error}</p>}
      {profile?.approval_status === 'pending' && <form className="shimadzu-bootstrap" onSubmit={claimAdmin}><div><strong>{textFor(language, '首次部署管理员初始化', 'First-deployment administrator setup')}</strong><p>{textFor(language, '仅首位管理员使用；初始化成功后该入口不能再次认领管理员。', 'For the first administrator only; this setup cannot be claimed again after completion.')}</p></div><input aria-label={textFor(language, '管理员初始化码', 'Administrator setup code')} value={bootstrapCode} onChange={event => setBootstrapCode(event.target.value)} placeholder={textFor(language, '管理员初始化码', 'Administrator setup code')} required /><button type="submit" disabled={working}>{textFor(language, '认领管理员', 'Claim administrator')}</button></form>}
      {profile?.is_admin && <div className="shimadzu-approval-queue"><h3>{textFor(language, '待审批账号', 'Accounts awaiting approval')}</h3>{pendingUsers.length ? pendingUsers.map(user => <div key={user.id}><span>{user.display_name || user.id}</span><button type="button" disabled={working} onClick={() => review(user.id, 'approved')}>{textFor(language, '批准', 'Approve')}</button><button type="button" disabled={working} onClick={() => review(user.id, 'rejected')}>{textFor(language, '拒绝', 'Reject')}</button></div>) : <p>{textFor(language, '当前没有待审批申请。', 'No pending requests.')}</p>}</div>}
    </section>
  )
}

function AnalysisReadinessStrip({ fileReadiness, cvReadiness, engine, language }) {
  const checks = [
    { label: textFor(language, '.xlsx 已检查', '.xlsx files checked'), ready: fileReadiness.ready },
    { label: textFor(language, '单文件 ≤ 50 MB', 'Each file ≤ 50 MB'), ready: fileReadiness.ready },
    { label: textFor(language, '浏览器 Worker 就绪', 'Browser Worker ready'), ready: engine.state === 'ready' },
    { label: cvReadiness.valid ? textFor(language, '参数已确认', 'Parameters confirmed') : textFor(language, '参数需要修正', 'Parameters need correction'), ready: cvReadiness.valid },
  ]
  return (
    <section className="shimadzu-readiness-strip" aria-labelledby="readiness-title">
      <div className="shimadzu-readiness-heading"><span className="shimadzu-readiness-mark"><Activity /></span><div><h2 id="readiness-title">{textFor(language, '分析就绪状态', 'Analysis readiness')}</h2><p>{fileReadiness.ready ? textFor(language, '输入文件已通过基础检查，可以开始建立任务。', 'Input files passed basic checks and the task can be created.') : fileReadiness.message}</p></div></div>
      <div className="shimadzu-readiness-checks" role="list">
        {checks.map(check => <span key={check.label} className={check.ready ? 'ready' : ''} role="listitem"><span aria-hidden="true">{check.ready ? '✓' : '○'}</span>{check.label}</span>)}
      </div>
    </section>
  )
}

function AnalysisSummary({ job, language }) {
  const metrics = []
  for (const runtime of job?.stages || []) {
    for (const [key, value] of Object.entries(runtime.counts || {})) {
      if (value === null || value === undefined || value === '') continue
      if (!metrics.some(item => item.key === key)) metrics.push({ key, value })
    }
  }
  if (!metrics.length) return null
  return <section className="shimadzu-analysis-summary" aria-labelledby="summary-title"><div className="shimadzu-summary-heading"><h2 id="summary-title">{textFor(language, '分析摘要', 'Analysis summary')}</h2><span>{textFor(language, '来自已完成步骤的实际计数', 'Actual counts from completed stages')}</span></div><div className="shimadzu-summary-grid">{metrics.slice(0, 6).map(metric => <div key={metric.key} className="shimadzu-summary-metric"><span>{metric.key}</span><strong>{String(metric.value)}</strong></div>)}</div></section>
}

function TaskDeskEntry({ count, language }) {
  return <a className="shimadzu-deck-utility-link" href={`${import.meta.env.BASE_URL}data-processing/tasks/`}><History aria-hidden="true" /><span>{textFor(language, '任务台', 'Task desk')}</span>{count > 0 && <b>{count}</b>}</a>
}

function HistoryPanelLegacy({ jobs, interruptedJobIds, onDownload, onMarkInterrupted }) {
  if (!jobs.length) return null
  return (
    <section className="shimadzu-history shimadzu-reveal" aria-labelledby="history-title">
      <div className="shimadzu-region-heading"><div><h2 id="history-title"><History />最近任务</h2><p>任务与 QC 摘要保留 90 天；结果包完成后保留 7 天。</p></div><span>私有记录</span></div>
      <div className="shimadzu-history-table" role="table">
        {jobs.map(item => {
          const downloadable = item.result_path && new Date(item.result_expires_at) > new Date()
          const interrupted = interruptedJobIds.has(item.id)
          const visibleStatus = interrupted ? 'interrupted' : item.status
          return <div key={item.id} role="row"><div><strong>{taskLabel(item)}</strong><TaskParent record={item} /><small>{new Date(item.created_at).toLocaleString('zh-CN', { hour12: false })}</small></div><span className={`shimadzu-job-badge ${visibleStatus}`}>{STATUS_LABELS[visibleStatus] || visibleStatus}</span><span>步骤 {item.current_stage}/7 · {item.progress}%</span>{interrupted ? <button type="button" onClick={() => onMarkInterrupted(item)}>确认中断</button> : downloadable ? <button type="button" onClick={() => onDownload(item)}><CloudDownload />重新下载</button> : <small>{item.status === 'complete' || item.status === 'expired' ? '结果已过期' : '暂无结果'}</small>}</div>
        })}
      </div>
    </section>
  )
}

function HistoryPanel({ jobs, interruptedJobIds, onDownload, onMarkInterrupted, onDeleteResult, onExplain, isAdmin = false, language }) {
  if (!jobs.length) return <section className="shimadzu-history shimadzu-history-empty" aria-labelledby="history-title"><div className="shimadzu-region-heading"><div><h2 id="history-title"><History />{textFor(language, '任务台', 'Task desk')}</h2><p>{textFor(language, '当前没有可查看的历史任务。完成登录并运行分析后，任务、结果下载和失败原因会集中显示在这里。', 'No task history is available. After sign-in and analysis, tasks, result downloads, and failure reasons will appear here.')}</p></div><span>{textFor(language, '暂无记录', 'No records')}</span></div></section>
  return (
    <section className="shimadzu-history shimadzu-reveal" aria-labelledby="history-title">
      <div className="shimadzu-region-heading"><div><h2 id="history-title"><History />{isAdmin ? textFor(language, '管理员任务台', 'Administrator task desk') : textFor(language, '最近任务', 'Recent tasks')}</h2><p>{isAdmin ? textFor(language, '可查看所有用户运行状态与结果证据；原始工作簿始终只保留在运行浏览器。', 'View every user task status and retained result evidence; raw workbooks always remain in the originating browser.') : textFor(language, '任务与 QC 摘要保留 90 天；结果包完成后保留 7 天。', 'Task and QC summaries are retained for 90 days; completed result packages for 7 days.')}</p></div><span>{isAdmin ? textFor(language, '管理员可见', 'Administrator view') : textFor(language, '私有记录', 'Private records')}</span></div>
      <div className="shimadzu-history-table" role="table">
        {jobs.map(item => {
          const downloadable = item.result_path && new Date(item.result_expires_at) > new Date()
          const interrupted = interruptedJobIds.has(item.id)
          const visibleStatus = interrupted ? 'interrupted' : item.status
          const issue = Array.isArray(item.stage_summary) ? [...item.stage_summary].reverse().find(entry => entry?.type === 'error' || entry?.type === 'interrupted') : null
          return <div key={item.id} role="row"><div><strong>{taskLabel(item)}</strong><TaskParent record={item} language={language} /><small>{isAdmin ? `${textFor(language, '用户', 'User')} ${item.user_id} · ` : ''}{new Date(item.created_at).toLocaleString(language === 'en' ? 'en-US' : 'zh-CN', { hour12: false })}</small>{issue && <small className="shimadzu-history-error"><b>{issue.code || textFor(language, '任务异常', 'Task exception')}</b>{issue.message || textFor(language, '请打开任务查看详细日志。', 'Open the task for detailed logs.')}</small>}</div><span className={`shimadzu-job-badge ${visibleStatus}`}>{statusLabel(visibleStatus, language)}</span><span>{textFor(language, '步骤', 'Stage')} {item.current_stage}/7 · {item.progress}%</span><div className="shimadzu-history-actions">{interrupted ? <button type="button" onClick={() => onMarkInterrupted(item)}>{textFor(language, '确认中断', 'Confirm interruption')}</button> : downloadable ? <button type="button" onClick={() => onDownload(item)}><CloudDownload />{textFor(language, '重新下载', 'Download again')}</button> : <small>{item.status === 'complete' || item.status === 'expired' ? textFor(language, '结果已过期', 'Result expired') : textFor(language, '暂无结果', 'No result')}</small>}{item.status === 'complete' && onExplain && <button type="button" onClick={() => onExplain(item)}>{textFor(language, 'AI 解读', 'AI interpretation')}</button>}{downloadable && onDeleteResult && <button type="button" className="danger" onClick={() => onDeleteResult(item)}>{textFor(language, '删除结果', 'Delete result')}</button>}</div></div>
        })}
      </div>
    </section>
  )
}

function HistoryDisclosure(props) {
  return <details id="task-workbench" className="shimadzu-history-disclosure">
    <summary><History aria-hidden="true" />{props.isAdmin ? textFor(props.language, '管理员历史任务', 'Administrator task history') : textFor(props.language, '历史任务', 'Task history')}<span>{props.jobs.length}</span></summary>
    <HistoryPanel {...props} />
  </details>
}

void HistoryPanelLegacy

const StageMark = ({ status }) => {
  if (status === 'running') return <Loader2 className="spin" aria-hidden="true" />
  if (['PASS', 'WARN', 'REVIEW'].includes(status)) return <Check aria-hidden="true" />
  if (status === 'FAIL') return <AlertCircle aria-hidden="true" />
  return <Circle aria-hidden="true" />
}

const TemplateLink = ({ href, children }) => (
  <a className="shimadzu-template-link" href={href} download>
    <ArrowDownToLine aria-hidden="true" />
    {children}
  </a>
)

const jobFromStoredTask = (task, status = 'running', language = 'zh') => {
  const summaries = new Map((task.stageSummary || []).filter(item => Number.isInteger(item?.stage)).map(item => [item.stage, item]))
  return {
    id: task.id,
    name: task.name,
    taskIdentity: taskIdentity(task) ? { ...taskIdentity(task), taskId: task.id } : null,
    status,
    started_at: task.startedAt || null,
    next_stage: task.nextStage || 0,
    updated_at: task.savedAt || new Date().toISOString(),
    error: task.error || null,
    partialArchiveFileName: task.partialArchiveFileName || null,
    partialArchiveSha256: task.partialArchiveSha256 || null,
    partialArchiveSize: task.partialArchiveSize || null,
    stages: WORKFLOW.map(sourceStage => {
      const stage = localizedStage(sourceStage, language)
      const summary = summaries.get(stage.index)
      return summary
        ? { index: stage.index, status: summary.status || 'PASS', counts: summary.counts || {}, can_advance: true, log_tail: language === 'en' ? `${stage.label} complete` : `${stage.label}已完成` }
        : { index: stage.index, status: 'pending', counts: {} }
    }),
  }
}

function FilePicker({ label, hint, file, onChange, inputRef, templateHref, templateLabel, language }) {
  const slotRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  let invalid = false
  let fileError = ''
  if (file) {
    try { assertWorkbookFile(file) } catch (value) {
      invalid = true
      fileError = value.code === 'WORKBOOK_TOO_LARGE'
        ? textFor(language, '文件为空或超过 50 MB，请更换文件。', 'The file is empty or exceeds 50 MB. Replace it.')
        : textFor(language, '仅支持 .xlsx 工作簿，请更换文件。', 'Only .xlsx workbooks are supported. Replace the file.')
    }
  }
  const slotState = !file ? '' : invalid ? ' has-error' : ' has-file'
  useGSAP(() => {
    if (!file || invalid || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.fromTo(slotRef.current, { boxShadow: '0 0 0 0 rgb(39 120 93 / 0)' }, {
      boxShadow: '0 0 0 4px rgb(39 120 93 / .18)',
      duration: .22,
      repeat: 1,
      yoyo: true,
      clearProps: 'boxShadow',
    })
  }, { scope: slotRef, dependencies: [file, invalid], revertOnUpdate: true })
  const handleDrop = event => {
    event.preventDefault()
    setDragOver(false)
    if (event.dataTransfer.files?.[0]) onChange(event.dataTransfer.files[0])
  }
  const clearFile = () => { onChange(null); if (inputRef.current) inputRef.current.value = '' }
  return <div ref={slotRef} className={`shimadzu-upload-slot${slotState}${dragOver ? ' is-drag-over' : ''}`} onDragOver={event => { event.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}>
    <div className="shimadzu-upload-label"><strong>{label}</strong><span>{file ? invalid ? textFor(language, '未通过', 'Invalid') : textFor(language, '基础检查通过', 'Basic check passed') : textFor(language, '待上传', 'Awaiting upload')}</span></div>
    <label className="shimadzu-file-picker">
      <input ref={inputRef} type="file" accept=".xlsx" aria-label={label} aria-invalid={invalid || undefined} onChange={event => onChange(event.target.files?.[0] || null)} />
      <span className="shimadzu-file-icon">{invalid ? <AlertCircle aria-hidden="true" /> : file ? <FileCheck2 aria-hidden="true" /> : <FileSpreadsheet aria-hidden="true" />}</span>
      <span className="shimadzu-file-copy">
        <strong>{file?.name || textFor(language, '拖入或点击选择文件', 'Drop or choose a file')}</strong>
        <small role={invalid ? 'alert' : undefined}>{invalid ? fileError : file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · .xlsx · ${textFor(language, '基础检查通过，结构待检', 'Basic check passed; structure pending')}` : hint}</small>
      </span>
      <span className="shimadzu-file-action">{file ? textFor(language, '更换文件', 'Replace file') : textFor(language, '选择文件', 'Choose file')}</span>
    </label>
    {file && <button type="button" className="shimadzu-file-clear" onClick={clearFile}>{textFor(language, '清除文件', 'Clear file')}</button>}
    <TemplateLink href={templateHref}>{templateLabel}</TemplateLink>
  </div>
}

const CONSOLE_STATE_COPY = {
  pending: ['待开始', 'Waiting'], checking: ['校验中', 'Validating'], running: ['运行中', 'Running'],
  review: ['等待复核', 'Awaiting review'], blocked: ['QC 阻断', 'QC blocked'],
  failed: ['运行失败', 'Failed'], finalizing: ['保存结果中', 'Saving results'],
  complete: ['已完成', 'Complete'], stopped: ['已停止', 'Stopped'],
}
const CONSOLE_GATE_COPY = {
  pending: ['待检查', 'Pending'], checking: ['检查中', 'Checking'], review: ['需复核', 'Review required'],
  blocked: ['未通过', 'Blocked'], warning: ['有警告', 'Warnings'], passed: ['已通过', 'Passed'],
  unknown: ['未完成', 'Incomplete'],
}
const consoleCopy = (entries, key, language) => (entries[key] || entries.pending)[language === 'en' ? 1 : 0]

function AnalysisConsole({ job, engine, fileReadiness, cvReadiness, hasInputFiles, submitting, language, taskName, actions }) {
  const view = deriveAnalysisConsole({ job, fileReadiness, cvReadiness, hasInputFiles, submitting, engineState: engine.state })
  const stageView = deriveProcessingStages(job, { ready: fileReadiness.ready && cvReadiness.valid, failed: hasInputFiles && (!fileReadiness.ready || !cvReadiness.valid) })
  const [selection, setSelection] = useState({ jobId: null, index: null })
  const selectedStep = selection.jobId === (job?.id ?? null) && selection.index !== null ? selection.index : stageView.active
  const selectedStage = selectedStep === 0 ? localizedStage(PREFLIGHT_STAGE, language) : selectedStep === 7 ? localizedStage(PACKAGE_STAGE, language) : localizedStage(WORKFLOW[selectedStep], language)
  const selectedRuntime = selectedStep === 7 ? null : job?.stages?.[selectedStep]
  const selectedStatus = stageView.steps[selectedStep].status
  const io = selectedStep === 7 ? PACKAGE_IO : CONSOLE_IO[selectedStep]
  const logRef = useRef(null)
  const logJobRef = useRef(job?.id ?? null)
  const detailRef = useRef(null)

  useEffect(() => {
    const currentJobId = job?.id ?? null
    if (logJobRef.current !== currentJobId) {
      if (logRef.current) logRef.current.open = false
      logJobRef.current = currentJobId
    }
    if (view.state === 'failed' || view.state === 'blocked') {
      if (logRef.current) logRef.current.open = true
    }
  }, [view.state, job?.id])

  const selectStep = index => setSelection({ jobId: job?.id ?? null, index })
  const counts = Object.entries(selectedRuntime?.counts || {}).filter(([, value]) => value !== null && value !== undefined && value !== '')

  return <section id="monitor-overview" className={`analysis-console state-${view.state}`} aria-label={textFor(language, '分析任务控制台', 'Analysis Console')}>
    <div className="analysis-console-statusbar" role="group" aria-label={textFor(language, '当前任务状态', 'Current task state')}>
      <div className="analysis-console-status-primary" role="status" aria-live="polite">
        <span className={`analysis-console-state state-${view.state}`}><StageMark status={view.state === 'complete' ? 'PASS' : view.state === 'blocked' || view.state === 'failed' ? 'FAIL' : view.state === 'running' || view.state === 'checking' || view.state === 'finalizing' ? 'running' : 'pending'} />{consoleCopy(CONSOLE_STATE_COPY, view.state, language)}</span>
        <strong>{job ? taskLabel(job) || taskName : textFor(language, '尚未建立分析任务', 'No analysis task yet')}</strong>
        {taskIdentity(job)?.parentTaskId && <small className="processing-task-parent">{textFor(language, '来源任务', 'Rerun of')} · {taskIdentity(job).parentTaskNumber || taskIdentity(job).parentTaskId}</small>}
        {job?.id && <small title={job.id}>{textFor(language, '任务 ID', 'Task ID')} · {job.id}</small>}
      </div>
      <div className="analysis-console-stat"><span>{textFor(language, '七步进度', 'Seven-stage progress')}</span><strong>{stageView.completed}/{stageView.total}</strong><div className="shimadzu-progress-track" role="progressbar" aria-label={textFor(language, '处理进度', 'Processing progress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(stageView.completed / stageView.total * 100)}><span style={{ '--progress': stageView.completed / stageView.total }} /></div></div>
      <div className={`analysis-console-stat gate-${view.gate}`}><span>{textFor(language, '质量门禁', 'QC gate')}</span><strong>{consoleCopy(CONSOLE_GATE_COPY, view.gate, language)}</strong></div>
      <div className={`analysis-console-stat engine-${engine.state}`}><span>{textFor(language, '分析引擎', 'Analysis engine')}</span><strong>{engine.title}</strong></div>
      <div className="analysis-console-stat"><span>{textFor(language, '实际运行耗时', 'Observed run time')}</span><strong>{job?.started_at && job?.updated_at ? `${Math.max(0, Math.round((new Date(job.updated_at).getTime() - new Date(job.started_at).getTime()) / 1000))} s` : textFor(language, '暂无记录', 'No timing record')}</strong></div>
    </div>

    <nav className="analysis-console-steps" aria-label={textFor(language, '00 输入配置和 01–07 七个分析步骤', '00 input setup and 01–07 seven analysis stages')}>
      {stageView.steps.map((step, index) => {
        const label = index === 0 ? textFor(language, '运行前预检', 'Preflight') : index === 7 ? textFor(language, '结果包', 'Result package') : localizedStage(WORKFLOW[index], language).short
        return <button key={step.number} type="button" className={`analysis-console-step state-${step.status}${selectedStep === index ? ' selected' : ''}`} data-console-step={step.number} aria-pressed={selectedStep === index} onClick={() => selectStep(index)}><span className="analysis-console-step-number">{step.number}</span><span className="analysis-console-step-label">{label}</span><span className="analysis-console-step-state"><StageMark status={step.status} />{statusLabel(step.status, language)}</span></button>
      })}
    </nav>

    <section id="stage-details" ref={detailRef} className="analysis-console-detail" aria-labelledby="console-detail-title">
      <div className="analysis-console-detail-heading"><div><span>{stageView.steps[selectedStep].number} · {statusLabel(selectedStatus, language)}</span><h3 id="console-detail-title">{selectedStage.label}</h3></div>{selectedRuntime?.can_advance === false && <strong className="analysis-console-gate-alert">{textFor(language, '质量门禁已阻断', 'QC gate blocked')}</strong>}</div>
      <div className="analysis-console-detail-grid">
        <div><h4>{textFor(language, '算法说明', 'Method')}</h4><p>{selectedStage.description}</p></div>
        <div><h4>{textFor(language, '输入', 'Input')}</h4><p>{language === 'en' ? io.enInput : io.input}</p></div>
        <div><h4>{textFor(language, (selectedRuntime || selectedStep === 7) && isCompletedConsoleStep(selectedStatus) ? '输出' : '预期输出', (selectedRuntime || selectedStep === 7) && isCompletedConsoleStep(selectedStatus) ? 'Output' : 'Expected output')}</h4><p>{language === 'en' ? io.enOutput : io.output}</p></div>
      </div>
      {selectedStage && <details className="analysis-console-method"><summary>{textFor(language, '查看处理动作', 'View processing actions')}</summary><ul>{selectedStage.work.map(item => <li key={item}>{item}</li>)}</ul></details>}
      <div className="analysis-console-record"><strong>{textFor(language, '执行记录', 'Execution record')}</strong><span>{selectedRuntime?.log_tail || (selectedStep === 0 ? fileReadiness.message : selectedStep === 7 && selectedStatus === 'PASS' ? textFor(language, '结果档案已由真实任务生成。', 'The result archive was generated by the task.') : textFor(language, '此步骤尚未执行；没有运行计数或日志。', 'This stage has not run; no counts or log are available.'))}</span>{counts.length > 0 && <small>{counts.map(([key, value]) => `${key} ${value}`).join(' · ')}</small>}</div>
    </section>

    {job?.error && <ShimadzuFailureDetails error={job.error} language={language} cancelled={job.status === 'cancelled'} downloadUrl={job.partialDownloadUrl} downloadName={job.partialArchiveFileName} />}

    {actions}
    <p className="shimadzu-task-feedback" role="status" aria-live="polite" aria-atomic="true">{taskFeedback(job, language) || (submitting ? textFor(language, '正在检查输入文件。', 'Checking input files.') : textFor(language, '选择两个工作簿后建立任务。', 'Choose two workbooks to create a task.'))}</p>
    {job && <details className="analysis-console-metrics"><summary>{textFor(language, '已完成步骤的实际计数', 'Actual counts from completed stages')}</summary><AnalysisSummary job={job} language={language} /></details>}
    <details id="run-log" ref={logRef} className="shimadzu-console shimadzu-console-disclosure analysis-console-log"><summary className="shimadzu-console-heading"><TerminalSquare /><span>{textFor(language, '运行日志与步骤记录', 'Run log and stage records')}</span><small>{job?.updated_at ? new Date(job.updated_at).toLocaleTimeString(language === 'en' ? 'en-US' : 'zh-CN', { hour12: false }) : textFor(language, '尚未启动', 'Not started')}</small></summary><ol>{job?.stages?.some(stage => stage.log_tail) ? job.stages.filter(stage => stage.log_tail).map((stage, index) => <li key={stage.index ?? index}><b>{String(stage.index ?? index).padStart(2, '0')} · {statusLabel(stage.status, language)}</b><span>{stage.log_tail}</span></li>) : <li>{textFor(language, '尚无真实执行日志。', 'No execution log is available yet.')}</li>}</ol></details>
  </section>
}

function PreflightPanel({ rawFile, samplesFile, fileReadiness, cvReadiness, engine, proxyState, onRecheck, canAnalyze, authNeeded, canStart, submitting, startFeedback, language, job }) {
  const stageZero = job?.stages?.[0]
  const fileState = fileReadiness.ready ? 'PASS' : rawFile || samplesFile ? 'FAIL' : 'pending'
  const structureState = stageZero?.status === 'PASS' ? 'PASS' : stageZero?.status === 'FAIL' || job?.error?.details?.stage === 0 ? 'FAIL' : 'pending'
  const groups = [
    { title: textFor(language, '文件检查', 'File checks'), checks: [
      { label: textFor(language, '两个工作簿存在、格式与大小', 'Two workbooks, format and size'), status: fileState, detail: fileReadiness.message },
      { label: textFor(language, '工作表、字段、样品与内标关系', 'Worksheets, fields, samples and internal standards'), status: structureState, detail: structureState === 'pending' ? textFor(language, '启动后由 Worker 阶段 0 验证；当前不预先宣称通过。', 'Verified by Worker stage 0 after start; not claimed as passed yet.') : stageZero?.log_tail || job?.error?.message },
    ] },
    { title: textFor(language, '运行环境', 'Runtime'), checks: [
      { label: textFor(language, '浏览器 Worker', 'Browser Worker'), status: engine.state === 'ready' ? 'PASS' : 'FAIL', detail: engine.title },
      { label: textFor(language, '本地联网代理（按需）', 'Local network proxy (on demand)'), status: proxyState.status, detail: proxyState.message, optional: proxyState.status === 'pending' },
    ] },
    { title: textFor(language, '参数检查', 'Parameters'), checks: [
      { label: textFor(language, 'CV 数值与功能依赖', 'CV value and feature dependencies'), status: cvReadiness.valid ? 'PASS' : 'FAIL', detail: cvReadiness.message },
      { label: textFor(language, '账号与执行权限', 'Account and execution permission'), status: authNeeded ? 'pending' : canAnalyze ? 'PASS' : 'FAIL', detail: authNeeded ? textFor(language, '文件和参数可先检查；点击开始分析时再登录。', 'Check files and parameters now; sign in when starting.') : canAnalyze ? textFor(language, '当前模式允许建立任务。', 'Current mode permits task creation.') : textFor(language, '需要通过管理员审批。', 'Administrator approval is required.') },
    ] },
  ]
  return <section className="processing-preflight" aria-labelledby="preflight-title">
    <div className="processing-workspace-heading"><div><span>03</span><h2 id="preflight-title">{textFor(language, '运行前预检', 'Preflight checks')}</h2></div><button type="button" onClick={onRecheck}>{textFor(language, '重新检查', 'Recheck')}</button></div>
    <div className="processing-preflight-groups">{groups.map(group => <section key={group.title} className="processing-preflight-group"><h3>{group.title}</h3><ul>{group.checks.map(check => <li key={check.label} className={`state-${check.status}`}><StageMark status={check.status} /><div><strong>{check.label}</strong><small>{check.detail}</small></div><span>{check.optional ? textFor(language, '按需检查', 'On demand') : statusLabel(check.status, language)}</span></li>)}</ul></section>)}</div>
    <div className="processing-preflight-footer"><button className="shimadzu-run-button" type="submit" disabled={!canStart} aria-busy={submitting}>{submitting ? <Loader2 className="spin" /> : <Play />}{textFor(language, '开始分析', 'Start analysis')}</button>{!canStart && <p role="status" aria-live="polite">{submitting ? startFeedback.message : !rawFile || !samplesFile ? textFor(language, '请先上传两份 Excel 文件', 'Upload both Excel files first') : startFeedback.message}</p>}</div>
  </section>
}

function ResultsWorkspace({ job, record, selectedTaskId, language, onDownload, handoff, onOpenTasks, onExplain }) {
  const current = job && (!selectedTaskId || selectedTaskId === job.id) ? job : null
  const source = current || record
  const availability = resultAvailability(source)
  const stageStatus = index => current?.stages?.[index]?.status || (Array.isArray(record?.stage_summary) ? record.stage_summary.find(item => item.stage === index)?.status : null) || 'pending'
  const outputItems = [
    { title: textFor(language, '定性结果', 'Qualitative results'), stage: 1, detail: textFor(language, 'Hit #1 与筛查后清单', 'Hit #1 and screened compound lists') },
    { title: textFor(language, '半定量结果', 'Semi-quantitative results'), stage: 4, detail: textFor(language, '峰面积与浓度工作簿', 'Peak-area and concentration workbooks') },
    { title: textFor(language, '统计与 QC 报告', 'Statistics and QC report'), stage: 5, detail: '05_07_QC报告.xlsx' },
    { title: textFor(language, '分析矩阵', 'Analysis matrices'), stage: 6, detail: textFor(language, '按矩阵拆分的结果工作簿', 'Matrix-specific output workbooks') },
  ]
  if (!source) return <div className="processing-empty"><h2>{textFor(language, '没有可查看的任务结果', 'No task results available')}</h2><p>{selectedTaskId ? textFor(language, '所选任务不存在、无访问权限，或本地任务在刷新后已清除。', 'The selected task is unavailable, inaccessible, or its local result was cleared after refresh.') : textFor(language, '完成分析后将在此显示实际生成的结果。', 'Actual outputs appear here after analysis completes.')}</p><button type="button" onClick={onOpenTasks}>{textFor(language, '查看任务管理', 'Open task management')}</button></div>
  return <section className="processing-results" aria-labelledby="processing-results-title">
    <div className="processing-workspace-heading"><div><h2 id="processing-results-title">{textFor(language, '结果与报告', 'Results & reports')}</h2><p>{taskLabel(source)}</p><TaskParent record={source} language={language} /></div><span className={`shimadzu-job-badge ${source.status}`}>{statusLabel(source.status, language)}</span></div>
    <div className="processing-result-grid">{outputItems.map(item => {
      const status = stageStatus(item.stage)
      const generated = isCompletedConsoleStep(status)
      const label = status === 'running' ? textFor(language, '生成中', 'Generating') : status === 'FAIL' ? textFor(language, '生成失败', 'Failed') : generated && availability.downloadable ? textFor(language, '可查看', 'Available') : generated ? textFor(language, '已生成', 'Generated') : textFor(language, '未生成', 'Not generated')
      return <article key={item.stage} className="processing-result-item"><div><h3>{item.title}</h3><span className={`state-${status}`}>{label}</span></div><p>{item.detail}</p></article>
    })}</div>
    <div className="processing-result-record"><h3>{textFor(language, '运行参数与证据记录', 'Run parameters and evidence')}</h3><p>{textFor(language, '真实阶段记录、质量证据和运行参数保存在结果包内；当前页面只显示已有任务元数据。', 'Actual stage records, QC evidence, and run parameters are retained in the result archive; this page only shows available task metadata.')}</p><dl><div><dt>{textFor(language, '任务 ID', 'Task ID')}</dt><dd><code>{source.id}</code></dd></div><div><dt>{textFor(language, '结果校验', 'Archive checksum')}</dt><dd><code>{source.archiveSha256 || source.result_sha256 || textFor(language, '暂无记录', 'Unavailable')}</code></dd></div></dl></div>
    <div className="processing-result-download"><h3>{textFor(language, '完整结果包', 'Complete result package')}</h3>{availability.source === 'browser' ? <a className="primary" href={source.downloadUrl} download={source.resultFileName}><Download />{textFor(language, '下载结果 ZIP', 'Download result ZIP')}</a> : ['cloud', 'history'].includes(availability.source) ? <button type="button" onClick={() => onDownload(source)}><CloudDownload />{textFor(language, '获取私有结果包', 'Get private result package')}</button> : <p>{source.status === 'complete' ? textFor(language, '本地结果包已不在当前浏览器内；若此前未下载，请重新运行。', 'The local archive is no longer in this browser; rerun if it was not downloaded.') : textFor(language, '结果包尚未生成。', 'The result archive has not been generated yet.')}</p>}</div>
    {current?.status === 'complete' && handoff}
    {source.status === 'complete' && onExplain && record && <button type="button" onClick={() => onExplain(source)}>{textFor(language, 'AI 解读已保存的任务摘要', 'AI interpretation of saved task summary')}</button>}
  </section>
}

function PrivateWorkspacePrompt({ language, section, onSignIn }) {
  return <section className="processing-empty" role="status"><h2>{section}</h2><p>{textFor(language, '此页面可公开浏览。个人任务、日志和结果仅在登录后按账号权限读取。', 'This page is public. Personal tasks, logs and results are loaded only after sign-in and ownership checks.')}</p><button type="button" onClick={onSignIn}>{textFor(language, '登录后查看我的内容', 'Sign in to view my content')}</button></section>
}

function HistoricalRunView({ record, language, onResults }) {
  const stageSummary = Array.isArray(record.stage_summary) ? record.stage_summary : []
  const failure = [...stageSummary].reverse().find(item => item?.type === 'error' || item?.type === 'interrupted')
  return <section className="processing-historical-run" aria-label={textFor(language, '历史任务运行详情', 'Historical task run details')}>
    <div className="processing-workspace-heading"><div><h3>{taskLabel(record)}</h3><TaskParent record={record} language={language} /><p title={record.id}>{textFor(language, '任务 ID', 'Task ID')} · {record.id}</p></div><span className={`shimadzu-job-badge ${record.status}`}>{statusLabel(record.status, language)}</span></div>
    <p>{textFor(language, record.local ? '此处显示当前浏览器保留的任务摘要；关闭浏览器后不会继续计算。' : '此处显示服务端保留的任务摘要；关闭浏览器后不会继续计算。', record.local ? 'This summary is retained in this browser; processing stops when it closes.' : 'This summary is retained by the service; processing stops when the browser closes.')}</p>
    <ol>{stageSummary.filter(item => Number.isInteger(item?.stage)).map(item => <li key={item.stage}>{String(item.stage).padStart(2, '0')} · {statusLabel(item.status || 'pending', language)} · {item.message || textFor(language, '无补充日志', 'No additional log')}</li>)}</ol>
    {failure && <div className="shimadzu-inline-error" role="alert"><AlertCircle /><div><strong>{failure.code}</strong><p>{failure.message}</p></div></div>}
    <button type="button" onClick={onResults}>{textFor(language, '查看结果与 QC', 'View results and QC')}</button>
  </section>
}

function TaskManager({ history, job, session, isAdmin, interruptedJobIds, language, onOpen, onDownload, onMarkInterrupted, onDeleteResult, onExplain }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [newestFirst, setNewestFirst] = useState(true)
  const [page, setPage] = useState(1)
  const [adminTab, setAdminTab] = useState(false)
  const records = useMemo(() => {
    const cloudRecords = history.filter(item => adminTab || !isAdmin || item.user_id === session?.user?.id)
    return filterTaskRecords(job && !cloudRecords.some(item => item.id === job.id) && !adminTab ? [{ ...job, id: job.id, name: job.name, status: job.status, progress: Math.round(deriveProcessingStages(job).completed / 7 * 100), created_at: job.started_at || job.updated_at, current_stage: job.next_stage, local: true }, ...cloudRecords] : cloudRecords, { query, status, newestFirst })
  }, [adminTab, history, isAdmin, job, newestFirst, query, session?.user?.id, status])
  const visible = records.slice((page - 1) * 8, page * 8)
  const update = setter => event => { setter(event.target.value); setPage(1) }
  return <section className="processing-tasks" aria-labelledby="processing-tasks-title">
    <div className="processing-workspace-heading"><div><h2 id="processing-tasks-title">{textFor(language, '任务管理', 'Task management')}</h2><p>{textFor(language, '最近任务、私有历史记录和可用结果', 'Recent tasks, private history and available results')}</p></div><span>{records.length}</span></div>
    {isAdmin && <div className="processing-task-tabs" role="tablist" aria-label={textFor(language, '任务范围', 'Task scope')}><button type="button" role="tab" aria-selected={!adminTab} onClick={() => { setAdminTab(false); setPage(1) }}>{textFor(language, '我的任务', 'My tasks')}</button><button type="button" role="tab" aria-selected={adminTab} onClick={() => { setAdminTab(true); setPage(1) }}>{textFor(language, '管理员任务列表', 'Administrator task list')}</button></div>}
    <div className="processing-task-filters"><label>{textFor(language, '搜索任务名称', 'Search task name')}<input value={query} onChange={update(setQuery)} /></label><label>{textFor(language, '状态', 'Status')}<select value={status} onChange={update(setStatus)}>{['all', 'running', 'waiting_review', 'complete', 'failed', 'cancelled', 'expired'].map(value => <option key={value} value={value}>{value === 'all' ? textFor(language, '全部', 'All') : statusLabel(value, language)}</option>)}</select></label><label>{textFor(language, '时间排序', 'Time order')}<select value={newestFirst ? 'newest' : 'oldest'} onChange={event => { setNewestFirst(event.target.value === 'newest'); setPage(1) }}><option value="newest">{textFor(language, '最新优先', 'Newest first')}</option><option value="oldest">{textFor(language, '最早优先', 'Oldest first')}</option></select></label></div>
    {!visible.length ? <p className="processing-empty">{textFor(language, '当前范围没有符合条件的任务。', 'No tasks match this scope and filter.')}</p> : <ul className="processing-task-list">{visible.map(item => {
      const interrupted = interruptedJobIds.has(item.id)
      const downloadable = resultAvailability(item).downloadable || job?.id === item.id && resultAvailability(job).downloadable
      return <li key={item.id}><div><strong>{taskLabel(item)}</strong><TaskParent record={item} language={language} /><small>{new Date(item.created_at).toLocaleString(language === 'en' ? 'en-US' : 'zh-CN', { hour12: false })} · {statusLabel(interrupted ? 'interrupted' : item.status, language)}{Number.isFinite(item.progress) ? ` · ${Math.round(item.progress)}%` : ''}</small>{adminTab && <small>{textFor(language, '用户', 'User')} {item.user_id}</small>}</div><div className="processing-task-actions"><button type="button" onClick={() => onOpen('monitor', item.id)}>{textFor(language, '运行详情', 'Run details')}</button><button type="button" onClick={() => onOpen('results', item.id)}>{textFor(language, '结果与 QC', 'Results & QC')}</button>{item.status === 'complete' && onExplain && <button type="button" onClick={() => onExplain(item)}>{textFor(language, 'AI 解读', 'AI interpretation')}</button>}{interrupted && <button type="button" onClick={() => onMarkInterrupted(item)}>{textFor(language, '确认中断', 'Confirm interruption')}</button>}{downloadable && (!item.local || item.hasLocalArchive) && <button type="button" onClick={() => onDownload(item)}>{textFor(language, '下载', 'Download')}</button>}{downloadable && !item.local && <button type="button" className="danger" onClick={() => onDeleteResult(item)}>{textFor(language, '删除结果', 'Delete result')}</button>}</div></li>
    })}</ul>}
    <div className="processing-task-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>{textFor(language, '上一页', 'Previous')}</button><span>{page} / {Math.max(1, Math.ceil(records.length / 8))}</span><button type="button" disabled={page * 8 >= records.length} onClick={() => setPage(value => value + 1)}>{textFor(language, '下一页', 'Next')}</button></div>
  </section>
}

export default function ShimadzuAnalysisPage({ embedded = false, language = 'zh', theme: controlledTheme, onNavigate, onHome, processingView = 'new', selectedTaskId = '', onProcessingNavigate, onRequireAuth, resumeIntent }) {
  const api = useMemo(() => createShimadzuApi(API_BASE), [])
  const cloud = useMemo(() => createShimadzuCloud(supabase), [])
  const taskStore = useMemo(() => typeof document === 'undefined' ? null : createShimadzuTaskStore(), [])
  const pageRef = useRef(null)
  const previousProgressRef = useRef(0)
  const rawInputRef = useRef(null)
  const samplesInputRef = useRef(null)
  const workerClientRef = useRef(null)
  const resultUrlRef = useRef('')
  const [analysisSelection, setAnalysisSelection] = useState('')
  const [analysisHandoffBusy, setAnalysisHandoffBusy] = useState(false)
  const partialResultUrlRef = useRef('')
  const activeJobIdRef = useRef('')
  const cloudSyncRef = useRef(Promise.resolve())
  const taskSyncRef = useRef(Promise.resolve())
  const stageSummaryRef = useRef([])
  const taskScopeRef = useRef('local')
  const resumeFromStageRef = useRef(0)
  const restoreScopeRef = useRef('')
  const authIdentityRef = useRef(undefined)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [standaloneTheme, setTheme] = useState(() => {
    try {
      return window.localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
    } catch {
      return 'dark'
    }
  })
  const theme = controlledTheme ?? standaloneTheme
  const restoredDraft = resumeIntent?.action === 'processing.start' ? resumeIntent.draft || {} : null
  const [rawFile, setRawFile] = useState(null)
  const [samplesFile, setSamplesFile] = useState(null)
  const [name, setName] = useState(() => restoredDraft?.name ?? textFor(language, '岛津气质分析', 'Shimadzu GC-MS analysis'))
  const localizedName = localizedTaskName(name, language)
  const [mode, setMode] = useState(restoredDraft?.mode ?? 'continuous')
  const [enableCvScreening, setEnableCvScreening] = useState(restoredDraft?.enableCvScreening ?? false)
  const [cvThreshold, setCvThreshold] = useState(restoredDraft?.cvThreshold ?? '30')
  const [enableClassification, setEnableClassification] = useState(restoredDraft?.enableClassification ?? true)
  const [enableWaterDetectionThreshold, setEnableWaterDetectionThreshold] = useState(restoredDraft?.enableWaterDetectionThreshold ?? true)
  const [enableEstimatedReferenceOav, setEnableEstimatedReferenceOav] = useState(restoredDraft?.enableEstimatedReferenceOav ?? false)
  const [job, setJob] = useState(null)
  async function enterDataAnalysis() {
    if (analysisHandoffBusy || !onNavigate) return
    const captured = job, url = resultUrlRef.current
    const store = createDatasetStore()
    setAnalysisHandoffBusy(true)
    try {
      await handoffCompletedArchive({ job: captured, ownedUrl: url, selection: analysisSelection,
        isCurrent: () => resultUrlRef.current === url && activeJobIdRef.current === captured.id,
        store, navigate: onNavigate })
    } catch (value) { setError(serviceError(value, language)) }
    finally { setAnalysisHandoffBusy(false); await store.close() }
  }
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [cloudHistory, setHistory] = useState([])
  const [localHistory, setLocalHistory] = useState([])
  const history = useMemo(() => [
    ...cloudHistory.map(item => ({ ...localHistory.find(local => local.id === item.id), ...item, local: false })),
    ...localHistory.filter(item => !cloudHistory.some(cloudItem => cloudItem.id === item.id)),
  ], [cloudHistory, localHistory])
  const [cloudLoading, setCloudLoading] = useState(analyticsEnabled)
  const [cloudError, setCloudError] = useState('')
  const [proxyState, setProxyState] = useState({ status: 'pending', message: textFor(language, '尚未检查；联网补充时按需连接。', 'Not checked; connected when enrichment needs it.') })
  const [activeTaskId, setActiveTaskId] = useState('')
  const [recoveryChecked, setRecoveryChecked] = useState(false)
  const [recoveryNotice, setRecoveryNotice] = useState('')
  const authResumeNotice = restoredDraft ? textFor(language, '已恢复可保存的参数。文件不会跨登录保存；请重新选择两份工作簿，检查后再次点击“开始分析”。', 'Safe parameters were restored. Files are not retained across sign-in; select both workbooks again, check them, then click Start analysis.') : ''
  const goHome = () => {
    if (onNavigate) onNavigate?.('home')
    else onHome?.()
  }
  const recheckPreflight = async () => {
    setProxyState({ status: 'pending', message: textFor(language, '正在检查本地代理连接。', 'Checking the local proxy connection.') })
    try {
      const response = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(4000) })
      setProxyState(response.ok
        ? { status: 'PASS', message: textFor(language, '本地代理可连接；联网补充仍由实际任务按需执行。', 'The local proxy is reachable; task enrichment still runs on demand.') }
        : { status: 'FAIL', message: textFor(language, '本地代理未正常响应；检查服务后重新检查。', 'The local proxy did not respond normally; inspect the service and recheck.') })
    } catch {
      setProxyState({ status: 'FAIL', message: textFor(language, '无法连接本地代理；检查服务地址或网络。', 'Cannot reach the local proxy; check the service address or network.') })
    }
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Theme switching remains available even when browser storage is blocked.
    }
  }, [theme])

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncMotion = () => setReducedMotion(preference.matches)
    preference.addEventListener('change', syncMotion)
    return () => preference.removeEventListener('change', syncMotion)
  }, [])

  const refreshCloud = async (knownSession = undefined) => {
    if (!cloud.configured) return
    setCloudLoading(true); setCloudError('')
    try {
      const activeSession = knownSession === undefined ? await cloud.session() : knownSession
      const identity = activeSession?.user?.id || 'guest'
      if (authIdentityRef.current !== identity) {
        authIdentityRef.current = identity
        workerClientRef.current?.cancel()
        setJob(null); setLocalHistory([]); setActiveTaskId('')
        if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
        if (partialResultUrlRef.current) URL.revokeObjectURL(partialResultUrlRef.current)
        resultUrlRef.current = ''; partialResultUrlRef.current = ''
      }
      setSession(activeSession)
      if (!activeSession) { setProfile(null); setHistory([]); return }
      const nextProfile = await cloud.profile(activeSession.user.id)
      setProfile(nextProfile)
      setHistory(await cloud.listJobs())
    } catch (value) {
      setProfile(null); setHistory([])
      setCloudError(value.code === 'PGRST205' || value.code === '42P01' ? textFor(language, '云端数据表尚未初始化，管理员需要先应用随本次发布提供的 Supabase 迁移。', 'Cloud tables are not initialized. An administrator must apply the Supabase migration included with this release.') : value.message)
    } finally { setCloudLoading(false) }
  }

  useEffect(() => {
    if (!embedded) {
      document.title = '岛津气质分析 | HXQLab'
    }
    workerClientRef.current = createShimadzuWorkerClient()
    return () => {
      workerClientRef.current?.dispose()
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
      resultUrlRef.current = ''
      if (partialResultUrlRef.current) URL.revokeObjectURL(partialResultUrlRef.current)
    }
  }, [api, embedded])

  useEffect(() => {
    if (!cloud.configured) return undefined
    queueMicrotask(() => refreshCloud())
    return cloud.onAuthChange(nextSession => refreshCloud(nextSession))
    // cloud is stable for the lifetime of this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud])

  useGSAP((_, contextSafe) => {
    const mm = gsap.matchMedia()
    mm.add({ animate: '(prefers-reduced-motion: no-preference)', desktop: '(min-width: 769px)' }, conditions => {
      if (!conditions.animate) return
      const targets = embedded
        ? ['.shimadzu-embedded-intro', '.shimadzu-workbench-nav', '.shimadzu-configuration-region', '.shimadzu-import-region']
        : ['.shimadzu-hero-animate', '.shimadzu-workflow']
      gsap.timeline({ defaults: { duration: conditions.desktop ? .36 : .26, ease: 'power2.out' } })
        .from(targets, { autoAlpha: 0, y: conditions.desktop ? 12 : 7, stagger: .065, clearProps: 'opacity,visibility,transform' })
    })

    const details = pageRef.current?.querySelector('.shimadzu-configuration-details')
    const summary = details?.querySelector('summary')
    const panel = details?.querySelector('.shimadzu-configuration-grid')
    if (!details || !summary || !panel) return () => mm.revert()
    const toggleAdvanced = contextSafe(event => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      event.preventDefault()
      gsap.killTweensOf(panel)
      if (details.open) {
        if (panel.contains(document.activeElement)) summary.focus()
        gsap.to(panel, { height: 0, autoAlpha: 0, duration: .2, ease: 'power2.inOut', onComplete: () => {
          details.open = false
          gsap.set(panel, { clearProps: 'height,opacity,visibility,overflow' })
        } })
      } else {
        details.open = true
        gsap.fromTo(panel, { height: 0, autoAlpha: 0, overflow: 'hidden' }, { height: 'auto', autoAlpha: 1, duration: .26, ease: 'power2.out', clearProps: 'height,opacity,visibility,overflow' })
      }
    })
    summary.addEventListener('click', toggleAdvanced)
    return () => { summary.removeEventListener('click', toggleAdvanced); mm.revert() }
  }, { scope: pageRef })

  const progress = deriveProcessingStages(job)
  const engineBase = browserEnginePresentation()
  const engine = language === 'en'
    ? { ...engineBase, title: 'Browser analysis engine ready', detail: 'Processing runs on this device; raw workbooks are not uploaded.', chip: 'ENGINE BROWSER' }
    : engineBase
  const canAnalyze = !cloud.configured || profile?.approval_status === 'approved'
  const authNeeded = cloud.configured && !cloudLoading && !session
  const fileReadiness = useMemo(() => {
    const missing = []
    if (!rawFile) missing.push(textFor(language, '岛津原始工作簿', 'Shimadzu raw workbook'))
    if (!samplesFile) missing.push(textFor(language, '样品与内标信息表', 'Sample and internal-standard sheet'))
    if (missing.length) {
      return {
        ready: false,
        buttonLabel: missing.length === 2 ? textFor(language, '请先添加两个 Excel 文件', 'Add both Excel files first') : `${textFor(language, '请添加', 'Add ')}${missing[0]}`,
        message: textFor(language, '请完成上方文件导入。', 'Complete the file import above.'),
      }
    }

    const invalid = []
    try { assertWorkbookFile(rawFile) } catch { invalid.push(textFor(language, '岛津原始工作簿', 'Shimadzu raw workbook')) }
    try { assertWorkbookFile(samplesFile) } catch { invalid.push(textFor(language, '样品与内标信息表', 'Sample and internal-standard sheet')) }
    if (invalid.length) {
      return {
        ready: false,
        buttonLabel: textFor(language, '请更换不符合要求的文件', 'Replace invalid files'),
        message: language === 'en' ? `${invalid.join(', ')} failed validation; only .xlsx files up to 50 MB are accepted.` : `${invalid.join('、')}未通过检查；仅接受不超过 50 MB 的 .xlsx 文件。`,
      }
    }

    return { ready: true, buttonLabel: textFor(language, '开始分析', 'Start analysis'), message: textFor(language, '文件已准备，可以开始分析', 'Files are ready; analysis can start') }
  }, [language, rawFile, samplesFile])
  const cvReadiness = useMemo(() => {
    if (!enableCvScreening) {
      return { valid: true, threshold: 30, message: textFor(language, 'CV 筛查未启用；仍会计算 Mean、SD 和 CV，但不会筛查结果。', 'CV screening is disabled. Mean, SD, and CV are still calculated, but results are not filtered.') }
    }
    const threshold = Number(cvThreshold)
    if (cvThreshold === '' || !Number.isFinite(threshold) || threshold < 0 || threshold > 1000) {
      return { valid: false, buttonLabel: textFor(language, '请修正 CV 阈值', 'Correct the CV threshold'), message: textFor(language, 'CV 阈值必须是 0–1000% 范围内的数值。', 'The CV threshold must be a number from 0 to 1000%.') }
    }
    return { valid: true, threshold, message: language === 'en' ? `Results will be screened at CV ${threshold}%.` : `将按 CV ${threshold}% 执行筛查。` }
  }, [cvThreshold, enableCvScreening, language])

  useGSAP(() => {
    if (reducedMotion) return
    const strip = pageRef.current?.querySelector('.shimadzu-readiness-strip')
    if (strip) gsap.fromTo(strip, { autoAlpha: .65, y: 3 }, { autoAlpha: 1, y: 0, duration: .2, clearProps: 'opacity,visibility,transform' })
  }, { scope: pageRef, dependencies: [fileReadiness.ready, cvReadiness.valid, reducedMotion], revertOnUpdate: true })

  useGSAP(() => {
    const next = progress.completed / (progress.total || 7)
    const previous = previousProgressRef.current
    previousProgressRef.current = next
    const fill = pageRef.current?.querySelector('.shimadzu-progress-track span')
    if (!fill || reducedMotion || previous === next) return
    gsap.fromTo(fill, { scaleX: previous }, { scaleX: next, duration: .38, ease: 'power2.out', clearProps: 'transform' })
  }, { scope: pageRef, dependencies: [progress.completed, progress.total, reducedMotion], revertOnUpdate: true })

  useGSAP(() => {
    if (job?.status !== 'complete' || reducedMotion) return
    const result = pageRef.current?.querySelector('.shimadzu-analysis-summary')
    if (result) gsap.fromTo(result, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: .3, clearProps: 'opacity,visibility,transform' })
  }, { scope: pageRef, dependencies: [job?.status, reducedMotion], revertOnUpdate: true })

  useGSAP(() => {
    if (!error || reducedMotion) return
    const alert = pageRef.current?.querySelector('.shimadzu-alert[role="alert"]')
    if (alert) gsap.fromTo(alert, { autoAlpha: .5 }, { autoAlpha: 1, duration: .2, clearProps: 'opacity,visibility' })
  }, { scope: pageRef, dependencies: [error, reducedMotion], revertOnUpdate: true })
  const startFeedback = useMemo(() => {
    if (submitting) return { buttonLabel: textFor(language, '正在建立任务', 'Creating task'), message: textFor(language, '正在读取文件并建立分析任务。', 'Reading files and creating the analysis task.') }
    if (!fileReadiness.ready) return fileReadiness
    if (!canAnalyze && !authNeeded) return { buttonLabel: textFor(language, '等待账号审批后开始', 'Await account approval'), message: textFor(language, '文件已准备，可以开始分析。当前账号还需通过管理员审批。', 'Files are ready. The account still requires administrator approval before analysis can start.') }
    if (authNeeded) return { buttonLabel: textFor(language, '登录后开始', 'Sign in to start'), message: textFor(language, '文件和参数已准备；点击开始分析后登录，返回时需要重新选择文件。', 'Files and parameters are ready; sign in after clicking Start. Select files again on return.') }
    if (!cvReadiness.valid) return cvReadiness
    return { ...fileReadiness, message: `${fileReadiness.message} ${cvReadiness.message}` }
  }, [authNeeded, canAnalyze, cvReadiness, fileReadiness, language, submitting])
  const canStart = fileReadiness.ready && cvReadiness.valid && (authNeeded || canAnalyze) && !submitting
  const interruptedJobIds = useMemo(() => {
    if (!recoveryChecked) return new Set()
    return new Set(history
      .filter(item => ['running', 'waiting_review'].includes(item.status) && item.id !== activeTaskId)
      .map(item => item.id))
  }, [activeTaskId, history, recoveryChecked])

  const handleWorkerEvent = event => {
    const replayedStage = Number.isInteger(event.stage) && event.stage < resumeFromStageRef.current
    if (replayedStage) return
    if (event.type === 'stage-start' && recoveryNotice) setRecoveryNotice(textFor(language, '任务已恢复，正在继续未完成的分析步骤。', 'Task restored; continuing unfinished analysis stages.'))
    setJob(current => {
      if (!current) return current
      const stages = current.stages.map(stage => ({ ...stage }))
      if (Number.isInteger(event.stage) && stages[event.stage]) {
        const stageCopy = localizedStage(WORKFLOW[event.stage], language)
        if (event.type === 'stage-start') stages[event.stage] = { ...stages[event.stage], status: 'running', log_tail: language === 'en' ? stageCopy.work[0] : event.message || stageCopy.work[0] }
        if (event.type === 'stage-complete') stages[event.stage] = { ...stages[event.stage], status: event.status || 'PASS', counts: event.counts || {}, can_advance: true, log_tail: language === 'en' ? `${stageCopy.label} complete` : `${stageCopy.label}完成` }
      }
      if (event.type === 'stage-review') return { ...current, stages, status: 'waiting_review', next_stage: event.stage + 1, updated_at: new Date().toISOString() }
      return { ...current, stages, status: event.type === 'stage-start' ? 'running' : current.status, next_stage: Number.isInteger(event.stage) ? event.stage + 1 : current.next_stage, updated_at: new Date().toISOString() }
    })
    if (activeJobIdRef.current && ['stage-complete', 'stage-review'].includes(event.type)) {
      const currentStage = Math.min(7, (event.stage ?? 0) + 1)
      if (event.type === 'stage-complete') stageSummaryRef.current[event.stage] = { stage: event.stage, status: event.status || 'PASS', counts: event.counts || {} }
      const patch = {
        status: event.type === 'stage-review' ? 'waiting_review' : 'running',
        current_stage: currentStage,
        progress: Math.round(currentStage / 7 * 100),
        stage_summary: stageSummaryRef.current.filter(Boolean),
      }
      taskSyncRef.current = taskSyncRef.current
        .then(() => taskStore.update(taskScopeRef.current, {
          status: patch.status,
          nextStage: currentStage,
          stageSummary: patch.stage_summary,
        }))
        .catch(value => setError(`${textFor(language, '无法保存恢复进度：', 'Could not save recovery progress: ')}${value.message}`))
      if (event.stage === 5) patch.qc_summary = event.counts || {}
      if (cloud.configured && session?.user) {
        cloudSyncRef.current = cloudSyncRef.current
          .then(() => cloud.updateJob(activeJobIdRef.current, patch))
          .catch(value => setCloudError(`${textFor(language, '云端进度同步失败：', 'Cloud progress sync failed: ')}${value.message}`))
      }
    }
  }

  const runTask = async (task, { restored = false } = {}) => {
    const taskEnableCvScreening = typeof task.enableCvScreening === 'boolean' ? task.enableCvScreening : true
    const taskCvThreshold = Number.isFinite(Number(task.cvThreshold)) ? Number(task.cvThreshold) : 30
    const taskEnableClassification = task.enableClassification === true
    const taskEnableWaterDetectionThreshold = task.enableWaterDetectionThreshold !== false
    const taskEnableEstimatedReferenceOav = task.enableEstimatedReferenceOav === true
    setSubmitting(true)
    setError('')
    activeJobIdRef.current = task.id
    taskScopeRef.current = task.scope
    resumeFromStageRef.current = restored ? Math.max(0, Number(task.nextStage) || 0) : 0
    stageSummaryRef.current = [...(task.stageSummary || [])]
    cloudSyncRef.current = Promise.resolve()
    taskSyncRef.current = Promise.resolve()
    setActiveTaskId(task.id)
    setName(task.name)
    setMode(task.mode)
    setEnableCvScreening(taskEnableCvScreening)
    setCvThreshold(String(taskCvThreshold))
    setEnableClassification(taskEnableClassification)
    setEnableWaterDetectionThreshold(taskEnableWaterDetectionThreshold)
    setEnableEstimatedReferenceOav(taskEnableEstimatedReferenceOav)
    setJob(jobFromStoredTask(task, 'running', language))
    if (!restored) onProcessingNavigate?.('monitor', task.id)
    if (restored) setRecoveryNotice(textFor(language, '已从当前浏览器恢复任务，正在重新验证已完成步骤。', 'Task restored from this browser; revalidating completed stages.'))
    try {
      const result = await workerClientRef.current.run({
        rawBytes: task.rawBytes,
        sampleBytes: task.sampleBytes,
        rawName: task.rawName,
        sampleName: task.sampleName,
        name: task.name,
        taskIdentity: taskIdentity(task) ? { ...taskIdentity(task), taskId: task.id } : undefined,
        mode: task.mode,
        enableCvScreening: taskEnableCvScreening,
        cvThreshold: taskCvThreshold,
        enableClassification: taskEnableClassification,
        enableWaterDetectionThreshold: taskEnableWaterDetectionThreshold,
        enableEstimatedReferenceOav: taskEnableEstimatedReferenceOav,
        resumeFromStage: resumeFromStageRef.current,
        onEvent: handleWorkerEvent,
      })
      if (partialResultUrlRef.current) {
        URL.revokeObjectURL(partialResultUrlRef.current)
        partialResultUrlRef.current = ''
      }
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
      resultUrlRef.current = URL.createObjectURL(new Blob([result.archiveBytes], { type: 'application/zip' }))
      const completedResult = { next_stage: 7, updated_at: new Date().toISOString(), downloadUrl: resultUrlRef.current, resultFileName: result.fileName, archiveSha256: result.archiveSha256, archiveSize: result.archiveSize }
      setJob(current => ({ ...current, ...completedResult, status: cloud.configured ? 'saving' : 'complete' }))
      if (cloud.configured) {
        try {
          await cloudSyncRef.current
          await cloud.uploadResult({ userId: task.userId, jobId: task.id, archiveBytes: result.archiveBytes, sha256: result.archiveSha256 })
          setHistory(await cloud.listJobs())
          setJob(current => ({ ...current, ...completedResult, status: 'complete' }))
        } catch (value) {
          setCloudError(`${textFor(language, '分析已完成且可立即下载，但云端结果保存失败：', 'Analysis completed and can be downloaded now, but cloud result storage failed: ')}${value.message}`)
          await cloud.updateJob(task.id, { status: 'complete', current_stage: 7, progress: 100, completed_at: new Date().toISOString() }).catch(() => {})
          setJob(current => ({ ...current, ...completedResult, status: 'complete' }))
        }
      }
      await taskSyncRef.current
      await taskStore.saveHistory({ ...task, status: 'complete', nextStage: 7, stageSummary: stageSummaryRef.current.filter(Boolean), archiveBytes: result.archiveBytes, resultFileName: result.fileName, archiveSha256: result.archiveSha256 })
        .then(async () => setLocalHistory(await taskStore.listHistory(task.scope)))
        .catch(value => setError(`${textFor(language, '本地历史保存失败，请先下载当前结果包：', 'Local history could not be saved; download the current archive first: ')}${value.message}`))
      await taskStore.clear(task.scope)
      setActiveTaskId('')
      setRecoveryNotice('')
    } catch (value) {
      if (value.code === 'ANALYSIS_INTERRUPTED') return
      const cancelled = value.code === 'ANALYSIS_CANCELLED'
      setError(cancelled ? textFor(language, '分析已取消', 'Analysis cancelled') : value.message)
      const failure = {
        code: value.code || 'BROWSER_ANALYSIS_FAILED', message: cancelled ? textFor(language, '分析已取消', 'Analysis cancelled') : value.message, details: value.details || null,
        at: new Date().toISOString(),
      }
      let partialResult = {}
      if (value.archiveBytes) {
        if (partialResultUrlRef.current) URL.revokeObjectURL(partialResultUrlRef.current)
        partialResultUrlRef.current = URL.createObjectURL(new Blob([value.archiveBytes], { type: 'application/zip' }))
        partialResult = {
          partialDownloadUrl: partialResultUrlRef.current,
          partialArchiveFileName: value.fileName || taskArchiveFileName(task, cancelled ? 'cancelled' : 'failed'),
          partialArchiveSha256: value.archiveSha256 || null,
          partialArchiveSize: value.archiveSize || value.archiveBytes.byteLength,
        }
      }
      setJob(current => current ? { ...current, ...partialResult, status: cancelled ? 'cancelled' : 'failed', error: failure } : null)
      const nextStage = Math.max(resumeFromStageRef.current, stageSummaryRef.current.filter(Boolean).length)
      await taskSyncRef.current.catch(() => {})
      await taskStore.update(task.scope, {
        status: cancelled ? 'cancelled' : 'failed', nextStage, stageSummary: stageSummaryRef.current.filter(Boolean), error: failure,
        ...(value.archiveBytes ? {
          partialArchiveBytes: value.archiveBytes,
          partialArchiveSha256: value.archiveSha256 || null,
          partialArchiveSize: value.archiveSize || value.archiveBytes.byteLength,
          partialArchiveFileName: value.fileName || taskArchiveFileName(task, cancelled ? 'cancelled' : 'failed'),
        } : {}),
      }).catch(() => {})
      await taskStore.saveHistory({ ...task, status: cancelled ? 'cancelled' : 'failed', nextStage, stageSummary: stageSummaryRef.current.filter(Boolean), error: failure, partialArchiveBytes: value.archiveBytes, partialArchiveFileName: partialResult.partialArchiveFileName, partialArchiveSha256: value.archiveSha256 })
        .then(async () => setLocalHistory(await taskStore.listHistory(task.scope)))
        .catch(historyError => setError(`${textFor(language, '本地历史保存失败，请先下载当前证据包：', 'Local history could not be saved; download the current evidence first: ')}${historyError.message}`))
      if (cloud.configured && activeJobIdRef.current) {
        await cloudSyncRef.current.catch(() => {})
        if (value.archiveBytes) {
          await cloud.uploadResult({
            userId: task.userId, jobId: activeJobIdRef.current, archiveBytes: value.archiveBytes,
            sha256: value.archiveSha256, status: cancelled ? 'cancelled' : 'failed', currentStage: Math.max(0, nextStage), progress: Math.round(Math.min(6, nextStage) / 7 * 100),
          }).catch(uploadError => setCloudError(language === 'en'
            ? `${cancelled ? 'Cancellation audit' : 'Failed-task partial result'} storage failed: ${uploadError.message}`
            : `${cancelled ? '取消任务审计' : '失败任务的部分结果'}保存失败：${uploadError.message}`))
        }
        const stageSummary = [...stageSummaryRef.current.filter(Boolean), { type: 'error', ...failure }]
        await cloud.updateJob(activeJobIdRef.current, { status: cancelled ? 'cancelled' : 'failed', stage_summary: stageSummary }).catch(() => {})
        setHistory(await cloud.listJobs().catch(() => history))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const submit = async event => {
    event.preventDefault()
    if (!canStart) return
    if (authNeeded) {
      try {
        if (!onRequireAuth) throw new Error(textFor(language, '请从平台统一登录页进入后再启动分析。', 'Sign in through the platform account page before starting analysis.'))
        await onRequireAuth('processing.start', { name, mode, enableCvScreening, cvThreshold, enableClassification, enableWaterDetectionThreshold, enableEstimatedReferenceOav })
      } catch (value) { setError(value.message) }
      return
    }
    setSubmitting(true)
    setError('')
    const scope = cloud.configured ? session?.user?.id : 'local'
    let cloudJobId = ''
    try {
      assertWorkbookFile(rawFile)
      assertWorkbookFile(samplesFile)
      if (cloud.configured && (!session?.user || profile?.approval_status !== 'approved')) throw Object.assign(new Error(textFor(language, '当前账号尚未通过管理员审批。', 'This account has not been approved by an administrator.')), { code: 'ACCOUNT_NOT_APPROVED' })
      const [rawBytes, sampleBytes] = await Promise.all([rawFile.arrayBuffer(), samplesFile.arrayBuffer()])
      const taskEnableCvScreening = enableCvScreening
      const taskCvThreshold = cvReadiness.threshold ?? 30
      const taskEnableClassification = enableClassification
      const taskEnableEstimatedReferenceOav = enableEstimatedReferenceOav
      const taskEnableWaterDetectionThreshold = taskEnableEstimatedReferenceOav || enableWaterDetectionThreshold
      const task = createTaskRun({
        scope, userId: session?.user?.id || '', name: localizedName.trim() || textFor(language, '岛津气质分析', 'Shimadzu GC-MS analysis'), mode,
        enableCvScreening: taskEnableCvScreening, cvThreshold: taskCvThreshold, enableClassification: taskEnableClassification,
        enableWaterDetectionThreshold: taskEnableWaterDetectionThreshold, enableEstimatedReferenceOav: taskEnableEstimatedReferenceOav,
        rawName: rawFile.name, sampleName: samplesFile.name, rawSize: rawFile.size, sampleSize: samplesFile.size, rawBytes, sampleBytes,
      })
      await persistTaskRun(task, { store: taskStore, cloud })
      cloudJobId = cloud.configured ? task.id : ''
      await runTask(task)
    } catch (value) {
      setError(value.message)
      if (cloud.configured && cloudJobId) await cloud.updateJob(cloudJobId, { status: 'failed', stage_summary: [{ type: 'error', code: value.code || 'TASK_PREPARATION_FAILED', message: value.message, at: new Date().toISOString() }] }).catch(() => {})
      setSubmitting(false)
    }
  }

  const promptPrivateSignIn = () => onRequireAuth?.('processing.private')?.catch(value => setError(value.message))

  const restoreActiveTask = async scope => {
    setRecoveryChecked(false)
    try {
      taskScopeRef.current = scope
      setLocalHistory(await taskStore.listHistory(scope))
      const task = await taskStore.load(scope)
      if (!task) {
        setActiveTaskId('')
        return
      }
      taskScopeRef.current = scope
      activeJobIdRef.current = task.id
      stageSummaryRef.current = [...(task.stageSummary || [])]
      resumeFromStageRef.current = Math.max(0, Number(task.nextStage) || 0)
      taskSyncRef.current = Promise.resolve()
      setActiveTaskId(task.id)
      setName(task.name)
      setMode(task.mode)
      const taskEnableCvScreening = typeof task.enableCvScreening === 'boolean' ? task.enableCvScreening : true
      const taskCvThreshold = Number.isFinite(Number(task.cvThreshold)) ? Number(task.cvThreshold) : 30
      const taskEnableClassification = task.enableClassification === true
      const taskEnableWaterDetectionThreshold = task.enableWaterDetectionThreshold !== false
      const taskEnableEstimatedReferenceOav = task.enableEstimatedReferenceOav === true
      setEnableCvScreening(taskEnableCvScreening)
      setCvThreshold(String(taskCvThreshold))
      setEnableClassification(taskEnableClassification)
      setEnableWaterDetectionThreshold(taskEnableWaterDetectionThreshold)
      setEnableEstimatedReferenceOav(taskEnableEstimatedReferenceOav)
      if (['failed', 'cancelled'].includes(task.status)) {
        const restoredJob = jobFromStoredTask(task, task.status, language)
        if (task.partialArchiveBytes) {
          if (partialResultUrlRef.current) URL.revokeObjectURL(partialResultUrlRef.current)
          partialResultUrlRef.current = URL.createObjectURL(new Blob([task.partialArchiveBytes], { type: 'application/zip' }))
          restoredJob.partialDownloadUrl = partialResultUrlRef.current
        }
        setJob(restoredJob)
        setRecoveryNotice(task.status === 'cancelled'
          ? textFor(language, '已恢复上次取消任务及审计结果。可下载部分结果，或重新运行。', 'The cancelled task and its audit were restored. Download partial results or rerun the task.')
          : textFor(language, '已恢复上次失败任务及错误信息。可重新运行，或更换文件建立新任务。', 'The failed task and error details were restored. Rerun it or create a new task with different files.'))
        return
      }
      if (task.status === 'waiting_review') {
        setJob({ ...jobFromStoredTask(task, 'waiting_review', language), restoredPause: true })
        setRecoveryNotice(textFor(language, '已恢复到刷新前的复核节点；确认后再继续下一步。', 'Restored to the review point before refresh; confirm before continuing.'))
        return
      }
      setRecoveryChecked(true)
      await runTask(task, { restored: true })
    } catch (value) {
      setError(`${textFor(language, '无法恢复浏览器任务：', 'Could not restore the browser task: ')}${value.message}`)
    } finally {
      setRecoveryChecked(true)
    }
  }

  useEffect(() => {
    if (cloud.configured && cloudLoading) return
    if (cloud.configured && (!session?.user || profile?.approval_status !== 'approved')) {
      restoreScopeRef.current = ''
      queueMicrotask(() => { setRecoveryChecked(true); setLocalHistory([]) })
      return
    }
    const scope = cloud.configured ? session.user.id : 'local'
    if (restoreScopeRef.current === scope) return
    restoreScopeRef.current = scope
    restoreActiveTask(scope)
    // Restore runs once per authenticated scope; runTask is intentionally guarded by restoreScopeRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud.configured, cloudLoading, profile?.approval_status, session?.user?.id, taskStore])

  const continueJob = async () => {
    setError('')
    if (job?.restoredPause) {
      const task = await taskStore.load(taskScopeRef.current)
      if (!task) {
        setError(textFor(language, '本地恢复数据已不存在，请重新选择两个输入文件。', 'Local recovery data is no longer available. Select both input files again.'))
        return
      }
      await taskStore.update(task.scope, { status: 'running' })
      await runTask({ ...task, status: 'running' }, { restored: true })
      return
    }
    workerClientRef.current?.continueReview()
    setJob(current => ({ ...current, status: 'running', updated_at: new Date().toISOString() }))
    taskSyncRef.current = taskSyncRef.current
      .then(() => taskStore.update(taskScopeRef.current, { status: 'running' }))
      .catch(value => setError(`${textFor(language, '无法保存恢复进度：', 'Could not save recovery progress: ')}${value.message}`))
    if (cloud.configured && activeJobIdRef.current) cloud.updateJob(activeJobIdRef.current, { status: 'running' }).catch(value => setCloudError(value.message))
  }

  const cancelJob = () => {
    if (authNeeded) { promptPrivateSignIn(); return }
    workerClientRef.current?.cancel()
  }

  const retryJob = async () => {
    if (authNeeded) { promptPrivateSignIn(); return }
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      const parent = await taskStore.load(taskScopeRef.current)
      if (!parent) throw new Error(textFor(language, '本地恢复数据已不存在，请重新选择两个输入文件。', 'Local recovery data is no longer available. Select both input files again.'))
      const task = createTaskRun({}, { parent })
      await persistTaskRun(task, { store: taskStore, cloud, parent })
      if (partialResultUrlRef.current) { URL.revokeObjectURL(partialResultUrlRef.current); partialResultUrlRef.current = '' }
      await runTask(task)
    } catch (value) { setError(value.message) }
    finally { setSubmitting(false) }
  }

  const downloadCloudResult = async item => {
    if (authNeeded) { promptPrivateSignIn(); return }
    setCloudError('')
    try {
      if (item.hasLocalArchive) {
        const stored = await taskStore.loadHistory(taskScopeRef.current, item.id)
        if (!stored?.archiveBytes) throw new Error(textFor(language, '本地证据包已过期或不存在。', 'The local evidence archive expired or is unavailable.'))
        const url = URL.createObjectURL(new Blob([stored.archiveBytes], { type: 'application/zip' }))
        const link = document.createElement('a')
        link.href = url; link.download = stored.resultFileName || taskArchiveFileName(item, item.status)
        document.body.append(link); link.click(); link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 30000)
        return
      }
      const url = await cloud.downloadUrl(item.result_path, 'shimadzu-results', taskArchiveFileName(item, item.status))
      window.location.assign(url)
    } catch (value) { setCloudError(`${textFor(language, '无法建立下载链接：', 'Could not create the download link: ')}${value.message}`) }
  }

  const deleteCloudResult = async item => {
    if (authNeeded) { promptPrivateSignIn(); return }
    if (!window.confirm('仅删除这个结果 ZIP，任务记录和质量日志会保留。继续吗？')) return
    setCloudError('')
    try {
      await cloud.deleteResult({ jobId: item.id, path: item.result_path })
      setHistory(await cloud.listJobs())
    } catch (value) { setCloudError(`${textFor(language, '结果 ZIP 删除失败：', 'Result ZIP deletion failed: ')}${value.message}`) }
  }

  const markInterrupted = async item => {
    if (authNeeded) { promptPrivateSignIn(); return }
    setCloudError('')
    try {
      const stageSummary = Array.isArray(item.stage_summary) ? item.stage_summary : []
      await cloud.updateJob(item.id, {
        status: 'failed',
        stage_summary: [...stageSummary, { type: 'interrupted', code: 'LOCAL_INPUTS_UNAVAILABLE', message: '页面已关闭且当前浏览器没有可恢复的输入文件。', at: new Date().toISOString() }],
      })
      setHistory(await cloud.listJobs())
    } catch (value) { setCloudError(`${textFor(language, '无法更新中断状态：', 'Could not update interruption status: ')}${value.message}`) }
  }

  const reset = async () => {
    workerClientRef.current?.cancel()
    await taskSyncRef.current.catch(() => {})
    await taskStore.clear(taskScopeRef.current).catch(() => {})
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    resultUrlRef.current = ''
    if (partialResultUrlRef.current) URL.revokeObjectURL(partialResultUrlRef.current)
    partialResultUrlRef.current = ''
    activeJobIdRef.current = ''
    stageSummaryRef.current = []
    cloudSyncRef.current = Promise.resolve()
    taskSyncRef.current = Promise.resolve()
    setActiveTaskId(''); setRecoveryNotice('')
    setJob(null); setRawFile(null); setSamplesFile(null); setError('')
    onProcessingNavigate?.('new', '')
    if (rawInputRef.current) rawInputRef.current.value = ''
    if (samplesInputRef.current) samplesInputRef.current.value = ''
  }

  const ContentElement = embedded ? 'div' : 'main'

  return (
    <div ref={pageRef} className={`shimadzu-page${embedded ? ' is-embedded' : ''}`} data-ui-revision="data-control-deck-v4" data-design-seed="888a79f2" data-theme={theme} data-language={language} data-motion={reducedMotion ? 'reduced' : 'full'}>
      {/*
        THESIS: 科研分析控制舱，以任务、状态和证据为首屏主角，拒绝全站导航挤占工作区。
        OWN-WORLD: 深海军蓝操作面、冷蓝动作、青绿通过、红色失败，边框承担层级。
        STORY: 用户准备文件、确认口径、运行七步流程、观察证据并下载可复核结果。
        FIRST VIEWPORT: 最小顶栏，输入与设置并列，流程带连接监控与任务台。
        FORM: 用户锁定 C 数据控制舱；Operate 模式；seed 888a79f2。
        FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
      */}
      {!embedded && (
      <header className="shimadzu-header">
        <div className="shimadzu-deck-topbar">
          <div className="shimadzu-deck-brand" aria-label="HXQLab 岛津分析">
            <span><FlaskConical aria-hidden="true" /></span>
            <strong>HXQLab · SHIMADZU</strong>
          </div>
          <div className="shimadzu-topbar-actions">
            <button
              type="button"
              className="shimadzu-theme-toggle"
              aria-pressed={theme === 'light'}
              aria-label={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
              onClick={() => setTheme(value => value === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
              <span>{theme === 'dark' ? '浅色' : '深色'}</span>
            </button>
            <button type="button" className="shimadzu-home-link" onClick={goHome}><ChevronRight aria-hidden="true" />返回首页</button>
          </div>
        </div>
        <div className="shimadzu-hero">
          <div className="shimadzu-hero-copy shimadzu-hero-animate">
            <span className="shimadzu-product-kicker">GC–MS FLAVOR ANALYSIS / BROWSER WORKER</span>
            <h1>岛津风味数据分析控制舱</h1>
          </div>
          <div className="shimadzu-deck-utility shimadzu-hero-animate">
            <div className="shimadzu-hero-status">
              <span className={engine.state}>{engine.state === 'ready' ? <ShieldCheck /> : engine.state === 'checking' ? <Loader2 className="spin" /> : <AlertCircle />}</span>
              <div><small>ANALYSIS ENGINE</small><strong>{engine.title}</strong><p>{engine.detail}</p></div>
            </div>
            <div className="shimadzu-deck-links">
              <TaskDeskEntry count={history.length} language={language} />
              <a className="shimadzu-deck-utility-link" href={`${import.meta.env.BASE_URL}data-processing/tasks/#account-panel`}><UserRound aria-hidden="true" /><span>{!cloud.configured ? '本地模式' : session ? '已登录' : '账号登录'}</span></a>
            </div>
          </div>
        </div>
      </header>
      )}

      <ContentElement className="shimadzu-main processing-workspace-main">
        {embedded && <div className="processing-workspace-intro"><span className="shimadzu-product-kicker">GC–MS / SHIMADZU</span><h1>{processingView === 'new' ? textFor(language, '新建分析', 'New analysis') : processingView === 'monitor' ? textFor(language, '运行监控', 'Run monitor') : processingView === 'results' ? textFor(language, '结果与报告', 'Results & reports') : textFor(language, '任务管理', 'Task management')}</h1></div>}
        {error && <div className="shimadzu-alert" role="alert"><AlertCircle /><span><strong>{textFor(language, '当前操作未完成', 'The current operation did not complete')}</strong>{error}</span></div>}
        {cloudError && <div className="shimadzu-alert cloud" role="alert"><AlertCircle /><span><strong>{textFor(language, '云端服务提示', 'Cloud service notice')}</strong>{cloudError}</span></div>}
        {recoveryNotice && <div className="shimadzu-recovery-notice" role="status" aria-live="polite"><RotateCcw /><span><strong>{textFor(language, '浏览器任务恢复', 'Browser task recovery')}</strong>{recoveryNotice}</span></div>}
        {authResumeNotice && <div className="shimadzu-recovery-notice" role="status"><UserRound /><span>{authResumeNotice}</span></div>}
        {processingView === 'new' && (
        <section id="processing-import" className="shimadzu-workbench-region shimadzu-import-region" aria-labelledby="data-import-preflight-title">
          <div className="shimadzu-region-heading shimadzu-workbench-heading"><div><span className="shimadzu-region-index">01</span><h2 id="data-import-preflight-title">{textFor(language, '文件导入', 'File import')}</h2></div><span>{textFor(language, '2 个 Excel 文件', '2 Excel files')}</span></div>
          {!job ? (
            <form className="shimadzu-setup" onSubmit={submit}>
              <div className="shimadzu-input-region" aria-labelledby="input-title">
                <div className="shimadzu-region-heading"><div><h3 id="input-title">{textFor(language, '输入文件与模板', 'Input files and templates')}</h3><p>{textFor(language, '选择或拖入两份 .xlsx 工作簿；深度结构检查在启动后执行。', 'Choose or drop two .xlsx workbooks; deep structure validation runs after start.')}</p></div></div>
                <div className="shimadzu-upload-grid">
                  <FilePicker language={language} inputRef={rawInputRef} label={textFor(language, '岛津原始工作簿', 'Shimadzu raw workbook')} hint={textFor(language, '包含 Peak Table、Similarity Search Results 与 Hit #', 'Contains Peak Table, Similarity Search Results, and Hit #')} file={rawFile} onChange={setRawFile} templateHref={api.templateUrl('raw-example')} templateLabel={textFor(language, '下载原始工作簿示例', 'Download raw-workbook example')} />
                  <FilePicker language={language} inputRef={samplesInputRef} label={textFor(language, '样品与内标信息表', 'Sample and internal-standard sheet')} hint={textFor(language, '包含样品分组、形态、内标浓度、添加量与体系', 'Contains sample groups, form, standard concentration, spike amount, and system volume')} file={samplesFile} onChange={setSamplesFile} templateHref={api.templateUrl('sample-info')} templateLabel={textFor(language, '下载样品信息模板', 'Download sample-information template')} />
                </div>
                <div className="shimadzu-upload-note"><Upload /><span>{textFor(language, '每份不超过 50 MB。原始文件仅在本机处理；刷新后可恢复活动任务，关闭页面期间计算暂停。', 'Up to 50 MB each. Raw files stay on this device; active tasks can resume after refresh, and processing pauses while the page is closed.')}</span></div>
              </div>
        <section id="processing-configuration" className="shimadzu-workbench-region shimadzu-configuration-region" aria-labelledby="analysis-output-configuration-title">
          <div className="shimadzu-region-heading shimadzu-workbench-heading"><div><span className="shimadzu-region-index">02</span><h2 id="analysis-output-configuration-title">{textFor(language, '参数配置', 'Parameters')}</h2></div><span>{job ? textFor(language, '任务参数已锁定', 'Task parameters locked') : textFor(language, '连续执行 · 本地优先', 'Continuous run · Local first')}</span></div>
          {!job && <label className="shimadzu-field processing-task-name"><span>{textFor(language, '任务名称', 'Task name')}</span><input value={localizedName} maxLength={120} onChange={event => setName(event.target.value)} /></label>}
          <div className="shimadzu-capability-grid" role="list" aria-label={textFor(language, '当前分析能力', 'Current analysis capabilities')}>
                <div role="listitem"><span>{textFor(language, '分析类型', 'Analysis type')}</span><strong>GC–MS</strong><small>{textFor(language, '当前可用 · GC-O、GC-IMS、GC×GC-MS 规划中', 'Available now · GC-O, GC-IMS, and GC×GC-MS are planned')}</small></div>
                <div role="listitem"><span>{textFor(language, '仪器', 'Instrument')}</span><strong>Shimadzu</strong><small>{textFor(language, '当前可运行 · 其他厂商适配规划中', 'Available now · Other vendors are planned')}</small></div>
                <div role="listitem"><span>{textFor(language, '执行与留存', 'Execution and retention')}</span><strong>{textFor(language, '浏览器本地连续执行', 'Continuous local browser execution')}</strong><small>{cloud.configured ? textFor(language, '原始文件不上传；结果可选云端留存', 'Raw files stay local; optional cloud result retention') : textFor(language, '本地模式；完成后立即下载结果', 'Local mode; download results immediately after completion')}</small></div>
          </div>
          <details className="shimadzu-configuration-details">
            <summary><span>{textFor(language, '高级科研参数与数据导出', 'Advanced research parameters and exports')}</span><small>{textFor(language, `CAS、阈值${enableEstimatedReferenceOav ? '、OAV' : ''}${enableCvScreening ? '、CV' : ''}`, `CAS, thresholds${enableEstimatedReferenceOav ? ', OAV' : ''}${enableCvScreening ? ', CV' : ''}`)}</small></summary>
            <div className="shimadzu-configuration-grid">
              <div className="shimadzu-settings" aria-labelledby="settings-title">
                <div className="shimadzu-region-heading"><div><h3 id="settings-title">{textFor(language, '数据导出', 'Data export')}</h3><p>{textFor(language, '分析参数依据已确认的科研规则执行。', 'Analysis parameters follow the confirmed scientific rules.')}</p></div></div>
                {!job && (
                  <fieldset className="shimadzu-cv-field" aria-describedby="classification-help">
                    <legend>{textFor(language, '身份信息与结构分类', 'Identity and structural classification')}</legend>
                    <label className="shimadzu-cv-toggle">
                      <input type="checkbox" checked={enableClassification} onChange={event => setEnableClassification(event.target.checked)} />
                      <span><strong>{textFor(language, '启用 CAS 结构分类', 'Enable CAS structural classification')}</strong><small>{textFor(language, '默认开启；按 CAS 查询 PubChem SMILES，并以 SMARTS 规则写入结构分类。', 'On by default; query PubChem SMILES by CAS and apply SMARTS classification rules.')}</small></span>
                    </label>
                    <p id="classification-help" className="shimadzu-cv-help">{enableClassification ? textFor(language, '将联网补充身份与结构；无可用结构或无 SMARTS 匹配时写入 NA。', 'Identity and structure are enriched online; NA is written when no structure or SMARTS match is available.') : textFor(language, '未启用；不会执行联网结构分类。', 'Disabled; online structural classification will not run.')}</p>
                  </fieldset>
                )}
                {!job && (
                  <fieldset className="shimadzu-cv-field" aria-describedby="water-threshold-help">
                    <legend>{textFor(language, '水中觉察阈值', 'Water detection threshold')}</legend>
                    <label className="shimadzu-cv-toggle">
                      <input type="checkbox" checked={enableWaterDetectionThreshold} onChange={event => setEnableWaterDetectionThreshold(event.target.checked)} />
                      <span><strong>{textFor(language, '启用水中觉察阈值', 'Enable water detection thresholds')}</strong><small>{textFor(language, '默认开启；按 CAS 查询本地证据库并保留原始值、来源与 μg/L 归一值。', 'On by default; query local evidence by CAS and retain the raw value, source, and normalized μg/L value.')}</small></span>
                    </label>
                    <p id="water-threshold-help" className="shimadzu-cv-help">{enableWaterDetectionThreshold ? textFor(language, '将导出 3 个水中觉察阈值证据列；无可用标量证据时写入 NA。', 'Three water-threshold evidence columns are exported; NA is written when no scalar evidence is available.') : textFor(language, '未启用；不查询且不导出水中觉察阈值列。', 'Disabled; water thresholds are neither queried nor exported.')}</p>
                  </fieldset>
                )}
                {!job && (
                  <fieldset className="shimadzu-cv-field" aria-describedby={enableEstimatedReferenceOav ? 'oav-help' : undefined}>
                    <legend>{textFor(language, '估算参考 OAV', 'Estimated reference OAV')}</legend>
                    <label className="shimadzu-cv-toggle">
                      <input type="checkbox" checked={enableEstimatedReferenceOav} onChange={event => {
                        const enabled = event.target.checked
                        setEnableEstimatedReferenceOav(enabled)
                        if (enabled) setEnableWaterDetectionThreshold(true)
                      }} />
                      <span><strong>{textFor(language, '启用估算参考 OAV', 'Enable estimated reference OAV')}</strong><small>{textFor(language, '默认关闭；启用后自动使用水中觉察阈值，在第六步后导出。固体样品仅作参考性评价。', 'Off by default; enabling it requires water thresholds and exports after Stage 6. Solid samples are reference-only.')}</small></span>
                    </label>
                    {enableEstimatedReferenceOav && <details id="oav-help" className="shimadzu-parameter-help"><summary>{textFor(language, '查看参考 OAV 的计算与局限', 'View reference OAV method and limits')}</summary><p>{textFor(language, '公式：浓度（μg/mL）×1000÷水中觉察阈值（μg/L）。没有单值阈值时 OAV 写入 NA 并保留原因。此项为参考导出，不自动作为正式 QC 门禁。', 'Formula: concentration (μg/mL) × 1000 ÷ water threshold (μg/L). Missing scalar thresholds yield NA with a reason. This reference export is not an automatic QC gate.')}</p></details>}
                  </fieldset>
                )}
                {!job && (
                  <fieldset className="shimadzu-cv-field" aria-describedby={enableCvScreening ? 'cv-screening-help' : undefined}>
                    <legend>{textFor(language, 'CV 筛查', 'CV screening')}</legend>
                    <label className="shimadzu-cv-toggle">
                      <input type="checkbox" checked={enableCvScreening} onChange={event => setEnableCvScreening(event.target.checked)} />
                      <span><strong>{textFor(language, '启用 CV 筛查', 'Enable CV screening')}</strong><small>{textFor(language, '默认关闭；仍计算 Mean、SD 和 CV，但不筛查结果。', 'Off by default; mean, SD, and CV are still calculated without filtering results.')}</small></span>
                    </label>
                    {enableCvScreening && <label className="shimadzu-field shimadzu-cv-threshold"><span>{textFor(language, 'CV 阈值 (%)', 'CV threshold (%)')}</span><input type="number" min="0" max="1000" step="1" inputMode="decimal" value={cvThreshold} onChange={event => setCvThreshold(event.target.value)} aria-describedby="cv-screening-help" /></label>}
                    {enableCvScreening && <p id="cv-screening-help" className="shimadzu-cv-help">{cvReadiness.message}</p>}
                  </fieldset>
                )}
              </div>
            </div>
          </details>
        </section>

              <PreflightPanel rawFile={rawFile} samplesFile={samplesFile} fileReadiness={fileReadiness} cvReadiness={cvReadiness} engine={engine} proxyState={proxyState} onRecheck={recheckPreflight} canAnalyze={canAnalyze} authNeeded={authNeeded} canStart={canStart} submitting={submitting} startFeedback={startFeedback} language={language} job={job} />
            </form>
          ) : (
            <div className="shimadzu-import-summary"><FileCheck2 aria-hidden="true" /><div><strong>{textFor(language, '输入已锁定并进入处理流程', 'Inputs locked and processing started')}</strong><p>{rawFile?.name || textFor(language, '岛津原始工作簿', 'Shimadzu raw workbook')} · {samplesFile?.name || textFor(language, '样品与内标信息表', 'Sample and internal-standard sheet')}. {textFor(language, '任务恢复时会重新验证已完成步骤。', 'Completed stages are revalidated when a task is restored.')}</p></div></div>
          )}
        </section>

        )}
        {processingView === 'monitor' && (authNeeded ? <PrivateWorkspacePrompt language={language} section={textFor(language, '运行监控', 'Run monitor')} onSignIn={promptPrivateSignIn} /> : <section id="processing-monitor" className="shimadzu-workbench-region shimadzu-monitor-results-region" aria-labelledby="process-monitor-results-title">
          <div className="analysis-console-heading"><h2 id="process-monitor-results-title">{textFor(language, '分析任务控制台', 'Analysis Console')}</h2></div>
          {selectedTaskId && job?.id !== selectedTaskId && history.some(item => item.id === selectedTaskId) ? <HistoricalRunView record={history.find(item => item.id === selectedTaskId)} language={language} onResults={() => onProcessingNavigate?.('results', selectedTaskId)} /> : selectedTaskId && job?.id !== selectedTaskId && !cloudLoading ? <div className="processing-empty" role="status"><h3>{textFor(language, '任务不可用', 'Task unavailable')}</h3><p>{textFor(language, '所选任务不存在、无访问权限，或本地任务已经结束且未保存到云端。', 'The task is unavailable, inaccessible, or the local task ended without cloud retention.')}</p></div> : <AnalysisConsole job={selectedTaskId && job?.id !== selectedTaskId ? null : job} engine={engine} fileReadiness={fileReadiness} cvReadiness={cvReadiness} hasInputFiles={Boolean(rawFile && samplesFile)} submitting={submitting} language={language} taskName={localizedName} actions={job && (!selectedTaskId || job.id === selectedTaskId) && <div className="analysis-console-actions">
            {job.status === 'waiting_review' && <button type="button" className="primary" onClick={continueJob}><ChevronRight />{textFor(language, '复核完成，继续', 'Review complete; continue')}</button>}
            {job.status === 'running' && <button type="button" onClick={cancelJob}><AlertCircle />{textFor(language, '取消分析', 'Cancel analysis')}</button>}
            {['failed', 'cancelled'].includes(job.status) && <button type="button" className="primary" onClick={retryJob}><RotateCcw />{textFor(language, '重新运行', 'Rerun')}</button>}
            {job.status === 'saving' && <span className="shimadzu-saving"><Loader2 className="spin" />{textFor(language, '正在保存结果', 'Saving results')}</span>}
            {job.status === 'cancelled' && job.partialDownloadUrl && <a className="primary" href={job.partialDownloadUrl} download={job.partialArchiveFileName}><Download />{textFor(language, '下载取消审计与部分结果', 'Download cancellation audit and partial results')}</a>}
            {job.status === 'complete' && <button type="button" className="primary" onClick={() => onProcessingNavigate?.('results', job.id)}>{textFor(language, '查看结果与报告', 'View results and reports')}</button>}
            {['failed', 'cancelled', 'complete', 'interrupted'].includes(job.status) && <button type="button" onClick={reset}><RotateCcw />{textFor(language, '新任务', 'New task')}</button>}
          </div>} />}
        </section>)}
        {processingView === 'results' && (authNeeded ? <PrivateWorkspacePrompt language={language} section={textFor(language, '结果与报告', 'Results & reports')} onSignIn={promptPrivateSignIn} /> : <ResultsWorkspace job={job} record={history.find(item => item.id === selectedTaskId)} selectedTaskId={selectedTaskId} language={language} onDownload={downloadCloudResult} onOpenTasks={() => onProcessingNavigate?.('tasks', selectedTaskId)} onExplain={onNavigate && cloud.configured && session ? item => onNavigate('assistant', { task_id: item.id }) : null} handoff={job?.status === 'complete' && job.downloadUrl?.startsWith('blob:') && onNavigate && <div className="analysis-handoff">
          <label>{textFor(language, '进入分析的矩阵', 'Matrix for analysis')}<select aria-label={textFor(language, '进入分析的矩阵', 'Matrix for analysis')} value={analysisSelection} onChange={event => setAnalysisSelection(event.target.value)} disabled={analysisHandoffBusy}><option value="">{textFor(language, '请明确选择', 'Choose explicitly')}</option><option value="before-cv">before-cv</option><option value="after-cv">after-cv</option></select></label>
          <button type="button" className="primary" onClick={enterDataAnalysis} disabled={!analysisSelection || analysisHandoffBusy}>{textFor(language, '进入数据分析', 'Enter data analysis')}</button><p>{textFor(language, '验证七阶段与哈希并保存后进入。也可下载 ZIP，在数据分析中上传。', 'Enter after seven-stage/hash verification and local save. ZIP upload in data analysis remains available.')}</p>
        </div>} />)}
        {processingView === 'tasks' && <>{authNeeded ? <PrivateWorkspacePrompt language={language} section={textFor(language, '任务管理', 'Task management')} onSignIn={promptPrivateSignIn} /> : <TaskManager history={history} job={job} session={session} isAdmin={profile?.is_admin === true} interruptedJobIds={interruptedJobIds} language={language} onOpen={onProcessingNavigate} onDownload={downloadCloudResult} onMarkInterrupted={markInterrupted} onDeleteResult={deleteCloudResult} onExplain={onNavigate && cloud.configured && session ? item => onNavigate('assistant', { task_id: item.id }) : null} />}<AccountPanel language={language} cloud={cloud} session={session} profile={profile} loading={cloudLoading} error={cloudError} onRefresh={refreshCloud} onRequireAuth={onRequireAuth} /></>}
      </ContentElement>
    </div>
  )
}
