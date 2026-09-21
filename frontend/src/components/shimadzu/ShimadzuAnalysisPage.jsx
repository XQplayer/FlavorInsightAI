import { useEffect, useMemo, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
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
  UserCheck,
  UserRound,
  LogOut,
  History,
  Moon,
} from 'lucide-react'
import { createShimadzuApi, getEnginePresentation, getMonitorStageIndex, getStageProgress } from '../../lib/shimadzuApi'
import { assertWorkbookFile, browserEnginePresentation } from '../../lib/shimadzuBrowserContract'
import { createShimadzuWorkerClient } from '../../lib/shimadzuWorkerClient'
import { authCallbackMessage, createShimadzuCloud, shimadzuAuthRedirect } from '../../lib/shimadzuCloud'
import { createShimadzuTaskStore } from '../../lib/shimadzuTaskStore'
import { prioritizeShimadzuIssues } from '../../lib/shimadzuIssues'
import { analyticsEnabled, supabase } from '../../lib/supabase'
import './ShimadzuAnalysisPage.css'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const API_BASE = (import.meta.env.VITE_FEMA_API_URL || 'http://127.0.0.1:8787').replace(/\/$/, '')
const THEME_STORAGE_KEY = 'shimadzu-analysis-theme'
const textFor = (language, zh, en) => language === 'en' ? en : zh
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
const PROCESS_RAIL = [...WORKFLOW, { index: 7, short: '结果包', label: '结果包与审计', description: '封装结果、质量证据与任务记录，供下载和复核。', enShort: 'Result package', enLabel: 'Result package and audit', enDescription: 'Package results, quality evidence, and task records for download and review.' }]
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

const APPROVAL_LABELS = { pending: '等待管理员审批', approved: '已获准使用', rejected: '申请未通过', suspended: '账号已停用' }
const APPROVAL_LABELS_EN = { pending: 'Awaiting administrator approval', approved: 'Approved', rejected: 'Request rejected', suspended: 'Account suspended' }

function AccountPanel({ cloud, session, profile, loading, error, onRefresh, language }) {
  const [registering, setRegistering] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [pendingUsers, setPendingUsers] = useState([])
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState(() => authCallbackMessage(window.location.hash))
  const [bootstrapCode, setBootstrapCode] = useState('')

  useEffect(() => {
    if (!profile?.is_admin) return
    cloud.pendingUsers().then(setPendingUsers).catch(value => setMessage(value.message))
  }, [cloud, profile?.is_admin])

  const authenticate = async event => {
    event.preventDefault()
    setWorking(true); setMessage('')
    try {
      if (registering) {
        const redirectTo = shimadzuAuthRedirect(window.location.origin, import.meta.env.BASE_URL)
        await cloud.signUp(email.trim(), password, displayName.trim(), redirectTo)
        setMessage(textFor(language, '注册申请已提交。请打开最新的验证邮件；验证完成后还需等待管理员审批。', 'Registration submitted. Open the latest verification email, then wait for administrator approval.'))
      } else {
        await cloud.signIn(email.trim(), password)
        setMessage(textFor(language, '登录成功，正在读取账号权限。', 'Signed in. Loading account permissions.'))
      }
      await onRefresh()
    } catch (value) { setMessage(value.message) } finally { setWorking(false) }
  }

  const resendConfirmation = async () => {
    if (!email.trim()) {
      setMessage(textFor(language, '请先填写注册邮箱，再重新发送验证邮件。', 'Enter the registration email before requesting a new verification message.'))
      return
    }
    setWorking(true); setMessage('')
    try {
      const redirectTo = shimadzuAuthRedirect(window.location.origin, import.meta.env.BASE_URL)
      await cloud.resendSignup(email.trim(), redirectTo)
      setMessage(textFor(language, '新的验证邮件已发送。请只使用最新邮件中的链接，之前的链接可能已经失效。', 'A new verification email was sent. Use only the newest link; earlier links may have expired.'))
    } catch (value) { setMessage(value.message) } finally { setWorking(false) }
  }

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
      <form onSubmit={authenticate} className="shimadzu-auth-form">
        {registering && <input aria-label={textFor(language, '姓名', 'Name')} placeholder={textFor(language, '姓名或小组内称呼', 'Name or team display name')} value={displayName} onChange={event => setDisplayName(event.target.value)} required />}
        <input aria-label={textFor(language, '邮箱', 'Email')} type="email" placeholder={textFor(language, '邮箱', 'Email')} value={email} onChange={event => setEmail(event.target.value)} required />
        <input aria-label={textFor(language, '密码', 'Password')} type="password" minLength="6" placeholder={textFor(language, '密码（至少 6 位）', 'Password (at least 6 characters)')} value={password} onChange={event => setPassword(event.target.value)} required />
        <button type="submit" disabled={working}>{working ? <Loader2 className="spin" /> : <UserCheck />}{registering ? textFor(language, '提交注册申请', 'Submit registration') : textFor(language, '登录', 'Sign in')}</button>
        <button type="button" className="text" onClick={() => { setRegistering(value => !value); setMessage('') }}>{registering ? textFor(language, '已有账号，返回登录', 'Already registered? Sign in') : textFor(language, '没有账号，申请使用', 'Request an account')}</button>
        <button type="button" className="text" disabled={working} onClick={resendConfirmation}>{textFor(language, '验证链接失效？重新发送验证邮件', 'Verification link expired? Send a new email')}</button>
      </form>
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
      {profile?.is_admin && pendingUsers.length > 0 && <div className="shimadzu-approval-queue"><h3>{textFor(language, '待审批账号', 'Accounts awaiting approval')}</h3>{pendingUsers.map(user => <div key={user.id}><span>{user.display_name || user.id}</span><button type="button" disabled={working} onClick={() => review(user.id, 'approved')}>{textFor(language, '批准', 'Approve')}</button><button type="button" disabled={working} onClick={() => review(user.id, 'rejected')}>{textFor(language, '拒绝', 'Reject')}</button></div>)}</div>}
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

function WorkspaceTabs({ language }) {
  return <nav className="shimadzu-workspace-tabs" aria-label={textFor(language, '任务工作区', 'Task workspace')}><a className="active" href="#monitor-overview" aria-current="page">Overview</a><a href="#stage-details">Stages</a><a href="#run-log">Logs</a></nav>
}

function TaskDeskEntry({ count, language }) {
  return <a className="shimadzu-deck-utility-link" href="#task-workbench"><History aria-hidden="true" /><span>{textFor(language, '任务台', 'Task desk')}</span>{count > 0 && <b>{count}</b>}</a>
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
          return <div key={item.id} role="row"><div><strong>{item.name}</strong><small>{new Date(item.created_at).toLocaleString('zh-CN', { hour12: false })}</small></div><span className={`shimadzu-job-badge ${visibleStatus}`}>{STATUS_LABELS[visibleStatus] || visibleStatus}</span><span>步骤 {item.current_stage}/7 · {item.progress}%</span>{interrupted ? <button type="button" onClick={() => onMarkInterrupted(item)}>确认中断</button> : downloadable ? <button type="button" onClick={() => onDownload(item)}><CloudDownload />重新下载</button> : <small>{item.status === 'complete' || item.status === 'expired' ? '结果已过期' : '暂无结果'}</small>}</div>
        })}
      </div>
    </section>
  )
}

function HistoryPanel({ jobs, interruptedJobIds, onDownload, onMarkInterrupted, onDownloadInput, onDeleteResult, isAdmin = false, language }) {
  if (!jobs.length) return <section id="task-workbench" className="shimadzu-history shimadzu-history-empty" aria-labelledby="history-title"><div className="shimadzu-region-heading"><div><h2 id="history-title"><History />{textFor(language, '任务台', 'Task desk')}</h2><p>{textFor(language, '当前没有可查看的历史任务。完成登录并运行分析后，任务、结果下载和失败原因会集中显示在这里。', 'No task history is available. After sign-in and analysis, tasks, result downloads, and failure reasons will appear here.')}</p></div><span>{textFor(language, '暂无记录', 'No records')}</span></div></section>
  return (
    <section id="task-workbench" className="shimadzu-history shimadzu-reveal" aria-labelledby="history-title">
      <div className="shimadzu-region-heading"><div><h2 id="history-title"><History />{isAdmin ? textFor(language, '管理员任务台', 'Administrator task desk') : textFor(language, '最近任务', 'Recent tasks')}</h2><p>{isAdmin ? textFor(language, '可查看所有用户运行状态，并下载原始工作簿与结果证据。', 'View every user task and download raw workbooks and result evidence.') : textFor(language, '任务与 QC 摘要保留 90 天；结果包完成后保留 7 天。', 'Task and QC summaries are retained for 90 days; completed result packages for 7 days.')}</p></div><span>{isAdmin ? textFor(language, '管理员可见', 'Administrator view') : textFor(language, '私有记录', 'Private records')}</span></div>
      <div className="shimadzu-history-table" role="table">
        {jobs.map(item => {
          const downloadable = item.result_path && new Date(item.result_expires_at) > new Date()
          const interrupted = interruptedJobIds.has(item.id)
          const visibleStatus = interrupted ? 'interrupted' : item.status
          const issue = Array.isArray(item.stage_summary) ? [...item.stage_summary].reverse().find(entry => entry?.type === 'error' || entry?.type === 'interrupted') : null
          return <div key={item.id} role="row"><div><strong>{localizedTaskName(item.name, language)}</strong><small>{isAdmin ? `${textFor(language, '用户', 'User')} ${item.user_id} · ` : ''}{new Date(item.created_at).toLocaleString(language === 'en' ? 'en-US' : 'zh-CN', { hour12: false })}</small>{issue && <small className="shimadzu-history-error"><b>{issue.code || textFor(language, '任务异常', 'Task exception')}</b>{issue.message || textFor(language, '请打开任务查看详细日志。', 'Open the task for detailed logs.')}</small>}</div><span className={`shimadzu-job-badge ${visibleStatus}`}>{statusLabel(visibleStatus, language)}</span><span>{textFor(language, '步骤', 'Stage')} {item.current_stage}/7 · {item.progress}%</span><div className="shimadzu-history-actions">{interrupted ? <button type="button" onClick={() => onMarkInterrupted(item)}>{textFor(language, '确认中断', 'Confirm interruption')}</button> : downloadable ? <button type="button" onClick={() => onDownload(item)}><CloudDownload />{textFor(language, '重新下载', 'Download again')}</button> : <small>{item.status === 'complete' || item.status === 'expired' ? textFor(language, '结果已过期', 'Result expired') : textFor(language, '暂无结果', 'No result')}</small>}{isAdmin && item.raw_path && <button type="button" onClick={() => onDownloadInput(item)}><Download />{textFor(language, '原始文件', 'Raw files')}</button>}{downloadable && onDeleteResult && <button type="button" className="danger" onClick={() => onDeleteResult(item)}>{textFor(language, '删除结果', 'Delete result')}</button>}</div></div>
        })}
      </div>
    </section>
  )
}

void HistoryPanelLegacy

const stageStatus = (job, index) => job?.stages?.[index]?.status || 'pending'

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
    name: localizedTaskName(task.name, language),
    status,
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

const FilePicker = ({ label, hint, file, onChange, inputRef, templateHref, templateLabel, language }) => (
  <div className={`shimadzu-upload-slot${file ? ' has-file' : ''}`}>
    <label className="shimadzu-file-picker">
      <input ref={inputRef} type="file" accept=".xlsx" onChange={event => onChange(event.target.files?.[0] || null)} />
      <span className="shimadzu-file-icon">{file ? <FileCheck2 aria-hidden="true" /> : <FileSpreadsheet aria-hidden="true" />}</span>
      <span className="shimadzu-file-copy">
        <strong>{file?.name || label}</strong>
        <small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · ${textFor(language, '已准备', 'Ready')}` : hint}</small>
      </span>
      <span className="shimadzu-file-action">{file ? textFor(language, '更换文件', 'Replace file') : textFor(language, '选择文件', 'Choose file')}</span>
    </label>
    <TemplateLink href={templateHref}>{templateLabel}</TemplateLink>
  </div>
)

function WorkflowMap({ job, language }) {
  const activeIndex = job?.stages?.findIndex(stage => stage.status === 'running') ?? -1
  return (
    <section className="shimadzu-workflow shimadzu-workflow-dock shimadzu-reveal" aria-labelledby="workflow-title">
      <div className="shimadzu-section-intro">
        <div>
          <h2 id="workflow-title">{textFor(language, '分析思路与七步流程', 'Analysis logic and seven-stage workflow')}</h2>
          <p>{textFor(language, '先保留原始证据，再逐步收敛化合物与平行样品，最后计算浓度、统计质量并输出作图矩阵。任何阶段未通过门禁，后续步骤都会停止。', 'Preserve source evidence first, then refine compounds and replicate samples before calculating concentrations, QC statistics, and plot-ready matrices. A failed gate stops downstream stages.')}</p>
        </div>
        <div className="shimadzu-method-principles" aria-label={textFor(language, '分析原则', 'Analysis principles')}>
          <span><ShieldCheck />{textFor(language, '原始证据不覆盖', 'Source evidence is preserved')}</span>
          <span><Layers3 />{textFor(language, '每步独立输出', 'Independent stage outputs')}</span>
          <span><Gauge />{textFor(language, 'QC 门禁后推进', 'Advance after QC gates')}</span>
        </div>
      </div>
      <div className="shimadzu-flow-track" role="list" aria-label={textFor(language, '岛津气质分析流程图', 'Shimadzu GC-MS analysis workflow')}>
        {PROCESS_RAIL.map((sourceStage, position) => {
          const stage = localizedStage(sourceStage, language)
          const status = stage.index === 7
            ? (job?.status === 'complete' ? 'PASS' : job?.status === 'failed' ? 'FAIL' : job?.status === 'cancelled' ? 'WARN' : job?.status === 'saving' ? 'running' : 'pending')
            : stageStatus(job, stage.index)
          const isActive = stage.index === 7 ? job?.status === 'saving' : activeIndex === stage.index
          return (
            <div key={stage.index} className={`shimadzu-flow-node state-${status}${isActive ? ' active' : ''}`} role="listitem" data-testid="workflow-node" aria-current={isActive ? 'step' : undefined}>
              <div className="shimadzu-flow-node-head">
                <span className="shimadzu-flow-marker"><StageMark status={status} /></span>
                <span className="shimadzu-flow-index">{String(stage.index).padStart(2, '0')}</span>
              </div>
              <strong>{stage.short}</strong>
              <small>{stage.description}</small>
              {position < PROCESS_RAIL.length - 1 && <ChevronRight className="shimadzu-flow-arrow" aria-hidden="true" />}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function StageRail({ job, language }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <aside className={'shimadzu-stage-rail' + (expanded ? ' expanded' : '')} aria-label={textFor(language, '当前任务步骤导航', 'Current task stage navigation')}>
      <button type="button" className="shimadzu-stage-rail-toggle" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}><ChevronRight aria-hidden="true" /><span>{expanded ? textFor(language, '收起步骤', 'Collapse stages') : textFor(language, '展开步骤', 'Expand stages')}</span></button>
      <ol>
        {PROCESS_RAIL.map(sourceStage => {
          const stage = localizedStage(sourceStage, language)
          const runtime = job?.stages?.[stage.index] || {}
          const status = stage.index === 7
            ? (job?.status === 'complete' ? 'PASS' : job?.status === 'failed' ? 'FAIL' : job?.status === 'cancelled' ? 'WARN' : job?.status === 'saving' ? 'running' : 'pending')
            : runtime.status || 'pending'
          return <li key={stage.index} className={'state-' + status} aria-label={`${stage.label}: ${statusLabel(status, language)}`}><span className="shimadzu-stage-rail-marker"><StageMark status={status} /></span><span className="shimadzu-stage-rail-index">{String(stage.index).padStart(2, '0')}</span><span className="shimadzu-stage-rail-label">{stage.short}</span></li>
        })}
      </ol>
    </aside>
  )
}

function LiveMonitor({ job, capabilities, engine: engineOverride, language }) {
  const engine = engineOverride || getEnginePresentation(capabilities)
  const selectedIndex = getMonitorStageIndex(job, WORKFLOW.length)
  const stage = localizedStage(WORKFLOW[selectedIndex], language)
  const liveStage = job?.stages?.[selectedIndex]
  const log = [...(job?.stages || [])].reverse().find(item => item.log_tail)?.log_tail
  const monitorState = !job ? 'standby' : job.status
  const title = !job
    ? textFor(language, '等待输入文件', 'Waiting for input files')
    : job.status === 'complete'
      ? textFor(language, '完整性验证已通过', 'Completeness verification passed')
      : job.status === 'saving'
        ? textFor(language, '计算完成，正在保存私有结果包', 'Processing complete; saving the private result package')
      : job.status === 'waiting_review'
          ? `${textFor(language, '等待复核', 'Awaiting review')}: ${stage.label}`
        : job.status === 'failed'
          ? textFor(language, '流程已在异常节点停止', 'The workflow stopped at an exception')
          : job.status === 'cancelled'
            ? textFor(language, '分析已取消，审计包可供下载', 'Analysis cancelled; the audit package is available')
            : `${textFor(language, '正在执行', 'Running')}: ${stage.label}`
  return (
    <section id="monitor-overview" className={'shimadzu-monitor' + (job ? ' shimadzu-reveal' : '') + ' state-' + monitorState} aria-labelledby="monitor-title">
      <div className="shimadzu-monitor-toolbar">
        <div className="shimadzu-monitor-title" role="status" aria-live="polite">
          <span className="shimadzu-live-dot" />
          <div><h2 id="monitor-title">{textFor(language, '实时分析监控', 'Live analysis monitor')}</h2><p>{title}</p></div>
        </div>
        <span className="shimadzu-engine-chip"><Activity />{engine.chip}</span>
      </div>
      <div className="shimadzu-monitor-body">
        <div className="shimadzu-current-work">
          <p className="shimadzu-monitor-label">{job?.status === 'running' ? textFor(language, '本阶段工作范围', 'Current stage scope') : textFor(language, '当前工作内容', 'Current work')}</p>
          <h3>{job ? stage.label : textFor(language, '上传文件后建立分析任务', 'Upload files to create an analysis task')}</h3>
          <ul>
            {(job ? stage.work : language === 'en' ? ['Validate two .xlsx files', 'Read sample and internal-standard parameters', 'Create stage 0 through stage 6 work directories'] : ['校验两个 .xlsx 文件', '读取样品与内标参数', '建立步骤 0 至步骤 6 作业目录']).map((item, index) => (
              <li key={item} className={job?.status === 'running' && index === 0 ? 'working' : ''}>
                {job?.status === 'running' && index === 0
                  ? <Loader2 className="spin" />
                  : ['complete', 'waiting_review'].includes(job?.status)
                    ? <Check />
                    : <Circle />}
                {item}
              </li>
            ))}
          </ul>
          <div className="shimadzu-monitor-metadata">
            <span>{textFor(language, '节点', 'Node')} <strong>{job ? `${selectedIndex + 1}/7` : '0/7'}</strong></span>
            <span>{textFor(language, '门禁', 'Gate')} <strong>{liveStage?.can_advance === false ? textFor(language, '停止', 'Stop') : liveStage?.can_advance === true ? textFor(language, '可推进', 'May advance') : textFor(language, '待检查', 'Pending')}</strong></span>
            <span>{textFor(language, '刷新', 'Refresh')} <strong>1.5 s</strong></span>
          </div>
        </div>
        <div id="run-log" className="shimadzu-console">
          <div className="shimadzu-console-heading"><TerminalSquare /><span>{textFor(language, '运行日志', 'Run log')}</span><small>{job?.updated_at ? new Date(job.updated_at).toLocaleTimeString(language === 'en' ? 'en-US' : 'zh-CN', { hour12: false }) : textFor(language, '尚未启动', 'Not started')}</small></div>
          <pre aria-live="polite">{log || (job ? textFor(language, '任务已建立，等待分析引擎输出。', 'Task created; waiting for analysis-engine output.') : textFor(language, '系统处于待机状态。\n选择两个模板或正式工作簿后开始分析。', 'The system is standing by.\nChoose two templates or production workbooks to start analysis.'))}</pre>
        </div>
      </div>
    </section>
  )
}

export default function ShimadzuAnalysisPage({ embedded = false, language = 'zh', theme: controlledTheme, onNavigate, onHome }) {
  const api = useMemo(() => createShimadzuApi(API_BASE), [])
  const cloud = useMemo(() => createShimadzuCloud(supabase), [])
  const taskStore = useMemo(() => typeof document === 'undefined' ? null : createShimadzuTaskStore(), [])
  const pageRef = useRef(null)
  const rawInputRef = useRef(null)
  const samplesInputRef = useRef(null)
  const workerClientRef = useRef(null)
  const resultUrlRef = useRef('')
  const partialResultUrlRef = useRef('')
  const activeJobIdRef = useRef('')
  const cloudSyncRef = useRef(Promise.resolve())
  const taskSyncRef = useRef(Promise.resolve())
  const stageSummaryRef = useRef([])
  const taskScopeRef = useRef('local')
  const resumeFromStageRef = useRef(0)
  const restoreScopeRef = useRef('')
  const [reducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [standaloneTheme, setTheme] = useState(() => {
    try {
      return window.localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
    } catch {
      return 'dark'
    }
  })
  const theme = controlledTheme ?? standaloneTheme
  const [rawFile, setRawFile] = useState(null)
  const [samplesFile, setSamplesFile] = useState(null)
  const [name, setName] = useState(() => textFor(language, '岛津气质分析', 'Shimadzu GC-MS analysis'))
  const localizedName = localizedTaskName(name, language)
  const [mode, setMode] = useState('continuous')
  const [enableCvScreening, setEnableCvScreening] = useState(false)
  const [cvThreshold, setCvThreshold] = useState('30')
  const [enableClassification, setEnableClassification] = useState(true)
  const [enableWaterDetectionThreshold, setEnableWaterDetectionThreshold] = useState(true)
  const [job, setJob] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [history, setHistory] = useState([])
  const [cloudLoading, setCloudLoading] = useState(analyticsEnabled)
  const [cloudError, setCloudError] = useState('')
  const [activeTaskId, setActiveTaskId] = useState('')
  const [recoveryChecked, setRecoveryChecked] = useState(false)
  const [recoveryNotice, setRecoveryNotice] = useState('')
  const goHome = () => {
    if (onNavigate) onNavigate?.('home')
    else onHome?.()
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Theme switching remains available even when browser storage is blocked.
    }
  }, [theme])

  const refreshCloud = async (knownSession = undefined) => {
    if (!cloud.configured) return
    setCloudLoading(true); setCloudError('')
    try {
      const activeSession = knownSession === undefined ? await cloud.session() : knownSession
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

  useGSAP(() => {
    const revealTargets = gsap.utils.toArray('.shimadzu-reveal')
    const heroTargets = gsap.utils.toArray('.shimadzu-hero-animate')

    if (reducedMotion) {
      gsap.set([...heroTargets, ...revealTargets, '.shimadzu-flow-node'], { autoAlpha: 1, x: 0, y: 0, clearProps: 'transform' })
      return
    }

    gsap.timeline({ defaults: { duration: 0.76, ease: 'power3.out' } })
      .from(heroTargets, { autoAlpha: 0, y: 20, stagger: 0.08 })
      .from('.shimadzu-workflow', { autoAlpha: 0, y: 24 }, '-=0.34')
      .from('.shimadzu-flow-node', { autoAlpha: 0, y: 12, stagger: 0.055, duration: 0.58 }, '-=0.46')

    revealTargets
      .filter(element => !element.classList.contains('shimadzu-workflow'))
      .forEach((element, index) => {
        gsap.from(element, {
          autoAlpha: 0,
          y: 26,
          duration: 0.82,
          ease: 'power3.out',
          scrollTrigger: {
            id: `shimadzu-reveal-${index}`,
            trigger: element,
            start: 'clamp(top 90%)',
            once: true,
          },
        })
      })

    ScrollTrigger.refresh()
  }, { scope: pageRef, dependencies: [Boolean(job), reducedMotion], revertOnUpdate: true })

  const progress = getStageProgress(job)
  const engineBase = browserEnginePresentation()
  const engine = language === 'en'
    ? { ...engineBase, title: 'Browser analysis engine ready', detail: 'Processing runs on this device; raw workbooks are not uploaded.', chip: 'ENGINE BROWSER' }
    : engineBase
  const canAnalyze = !cloud.configured || profile?.approval_status === 'approved'
  const fileReadiness = useMemo(() => {
    const missing = []
    if (!rawFile) missing.push(textFor(language, '岛津原始工作簿', 'Shimadzu raw workbook'))
    if (!samplesFile) missing.push(textFor(language, '样品与内标信息表', 'Sample and internal-standard sheet'))
    if (missing.length) {
      return {
        ready: false,
        buttonLabel: missing.length === 2 ? textFor(language, '请先添加两个 Excel 文件', 'Add both Excel files first') : `${textFor(language, '请添加', 'Add ')}${missing[0]}`,
        message: `${textFor(language, '还缺少：', 'Missing: ')}${missing.join(language === 'en' ? ', ' : '、')}`,
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
  const startFeedback = useMemo(() => {
    if (submitting) return { buttonLabel: textFor(language, '正在建立任务', 'Creating task'), message: textFor(language, '正在读取文件并建立分析任务。', 'Reading files and creating the analysis task.') }
    if (!fileReadiness.ready) return fileReadiness
    if (!canAnalyze) return { buttonLabel: textFor(language, '等待账号审批后开始', 'Await account approval'), message: textFor(language, '文件已准备，可以开始分析。当前账号还需通过管理员审批。', 'Files are ready. The account still requires administrator approval before analysis can start.') }
    if (!cvReadiness.valid) return cvReadiness
    return { ...fileReadiness, message: `${fileReadiness.message} ${cvReadiness.message}` }
  }, [canAnalyze, cvReadiness, fileReadiness, language, submitting])
  const canStart = fileReadiness.ready && cvReadiness.valid && canAnalyze && !submitting
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
    setJob(jobFromStoredTask(task, 'running', language))
    if (restored) setRecoveryNotice(textFor(language, '已从当前浏览器恢复任务，正在重新验证已完成步骤。', 'Task restored from this browser; revalidating completed stages.'))
    try {
      const result = await workerClientRef.current.run({
        rawBytes: task.rawBytes,
        sampleBytes: task.sampleBytes,
        rawName: task.rawName,
        sampleName: task.sampleName,
        name: task.name,
        mode: task.mode,
        enableCvScreening: taskEnableCvScreening,
        cvThreshold: taskCvThreshold,
        enableClassification: taskEnableClassification,
        enableWaterDetectionThreshold: taskEnableWaterDetectionThreshold,
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
          partialArchiveFileName: value.fileName || `${task.name}_部分结果.zip`,
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
          partialArchiveFileName: value.fileName || `${task.name}_部分结果.zip`,
        } : {}),
      }).catch(() => {})
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
      const taskEnableWaterDetectionThreshold = enableWaterDetectionThreshold
      const task = {
        id: crypto.randomUUID(), scope, userId: session?.user?.id || '', name: localizedName.trim() || textFor(language, '岛津气质分析', 'Shimadzu GC-MS analysis'), mode,
        enableCvScreening: taskEnableCvScreening, cvThreshold: taskCvThreshold, enableClassification: taskEnableClassification,
        enableWaterDetectionThreshold: taskEnableWaterDetectionThreshold,
        status: 'running', nextStage: 0, stageSummary: [], rawName: rawFile.name, sampleName: samplesFile.name,
        rawSize: rawFile.size, sampleSize: samplesFile.size, rawBytes, sampleBytes,
      }
      if (cloud.configured) {
        await cloud.createJob({
          id: task.id, userId: task.userId, name: task.name, mode,
          sourceNames: {
            raw: { name: rawFile.name, size: rawFile.size },
            sample_info: { name: samplesFile.name, size: samplesFile.size },
            cv: { enableCvScreening: taskEnableCvScreening, threshold: taskCvThreshold },
            classification: { enabled: taskEnableClassification, source: 'PubChem SMARTS' },
            waterDetectionThreshold: { enabled: taskEnableWaterDetectionThreshold, source: 'local evidence database' },
          },
        })
        cloudJobId = task.id
        try {
          await cloud.uploadInputs({ userId: task.userId, jobId: task.id, rawBytes, sampleBytes })
        } catch (value) {
          setCloudError(`${textFor(language, '原始工作簿云端留存失败，分析仍会继续：', 'Cloud retention of raw workbooks failed; analysis will continue: ')}${value.message}`)
        }
      }
      await taskStore.save(task)
      await runTask(task)
    } catch (value) {
      setError(value.message)
      if (cloud.configured && cloudJobId) await cloud.updateJob(cloudJobId, { status: 'failed', stage_summary: [{ type: 'error', code: value.code || 'TASK_PREPARATION_FAILED', message: value.message, at: new Date().toISOString() }] }).catch(() => {})
      setSubmitting(false)
    }
  }

  const restoreActiveTask = async scope => {
    setRecoveryChecked(false)
    try {
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
      setEnableCvScreening(taskEnableCvScreening)
      setCvThreshold(String(taskCvThreshold))
      setEnableClassification(taskEnableClassification)
      setEnableWaterDetectionThreshold(taskEnableWaterDetectionThreshold)
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
      queueMicrotask(() => setRecoveryChecked(true))
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
    workerClientRef.current?.cancel()
  }

  const retryJob = async () => {
    setError('')
    const task = await taskStore.load(taskScopeRef.current)
    if (!task) {
      setError(textFor(language, '本地恢复数据已不存在，请重新选择两个输入文件。', 'Local recovery data is no longer available. Select both input files again.'))
      return
    }
    await taskStore.update(task.scope, { status: 'running', error: null })
    if (cloud.configured) await cloud.updateJob(task.id, { status: 'running' }).catch(value => setCloudError(value.message))
    await runTask({ ...task, status: 'running', error: null }, { restored: true })
  }

  const downloadCloudResult = async item => {
    setCloudError('')
    try {
      const url = await cloud.downloadUrl(item.result_path)
      window.location.assign(url)
    } catch (value) { setCloudError(`${textFor(language, '无法建立下载链接：', 'Could not create the download link: ')}${value.message}`) }
  }

  const downloadCloudInput = async item => {
    setCloudError('')
    try {
      const url = await cloud.downloadInputUrl(item.raw_path)
      window.location.assign(url)
    } catch (value) { setCloudError(`${textFor(language, '无法建立原始工作簿下载链接：', 'Could not create the raw-workbook download link: ')}${value.message}`) }
  }

  const deleteCloudResult = async item => {
    if (!window.confirm('仅删除这个结果 ZIP，任务记录和质量日志会保留。继续吗？')) return
    setCloudError('')
    try {
      await cloud.deleteResult({ jobId: item.id, path: item.result_path })
      setHistory(await cloud.listJobs())
    } catch (value) { setCloudError(`${textFor(language, '结果 ZIP 删除失败：', 'Result ZIP deletion failed: ')}${value.message}`) }
  }

  const markInterrupted = async item => {
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
              <TaskDeskEntry count={history.length} />
              <a className="shimadzu-deck-utility-link" href="#account-panel"><UserRound aria-hidden="true" /><span>{!cloud.configured ? '本地模式' : session ? '已登录' : '账号登录'}</span></a>
            </div>
          </div>
        </div>
      </header>
      )}

      <ContentElement className="shimadzu-main">
        {embedded && (
          <div className="shimadzu-embedded-intro">
            <span className="shimadzu-product-kicker">GC–MS FLAVOR PROCESSING / BROWSER WORKER</span>
            <h1>{language === 'en' ? 'Instrument data processing' : '仪器数据处理平台'}</h1>
            <p>{language === 'en' ? 'Configure, validate, monitor and export a traceable Shimadzu GC–MS processing task.' : '配置、预检、监控并导出可追溯的岛津 GC–MS 处理任务。'}</p>
          </div>
        )}
        {error && <div className="shimadzu-alert" role="alert"><AlertCircle /><span><strong>{textFor(language, '当前操作未完成', 'The current operation did not complete')}</strong>{error}</span></div>}
        {cloudError && <div className="shimadzu-alert cloud" role="alert"><AlertCircle /><span><strong>{textFor(language, '云端服务提示', 'Cloud service notice')}</strong>{cloudError}</span></div>}
        {recoveryNotice && <div className="shimadzu-recovery-notice" role="status" aria-live="polite"><RotateCcw /><span><strong>{textFor(language, '浏览器任务恢复', 'Browser task recovery')}</strong>{recoveryNotice}</span></div>}
        <section className="shimadzu-workbench-region shimadzu-configuration-region" aria-labelledby="analysis-output-configuration-title">
          <div className="shimadzu-region-heading shimadzu-workbench-heading"><div><span className="shimadzu-region-index">01</span><h2 id="analysis-output-configuration-title">{textFor(language, '分析流程与数据导出配置', 'Analysis workflow and data export configuration')}</h2><p>{textFor(language, '确认当前可运行的分析边界、执行位置与结果字段。', 'Confirm the available analysis scope, execution location, and exported fields.')}</p></div><span>{job ? textFor(language, '任务参数已锁定', 'Task parameters locked') : textFor(language, '连续执行 · 本地优先', 'Continuous run · Local first')}</span></div>
          <details className="shimadzu-configuration-details" open={!job}>
            <summary>{job ? textFor(language, '配置已折叠，展开查看本次任务参数', 'Configuration collapsed; expand to view task parameters') : textFor(language, '配置当前处理任务', 'Configure this processing task')}</summary>
            <div className="shimadzu-configuration-grid">
              <div className="shimadzu-capability-grid" role="list" aria-label={textFor(language, '当前分析能力', 'Current analysis capabilities')}>
                <div role="listitem"><span>{textFor(language, '分析类型', 'Analysis type')}</span><strong>GC–MS</strong><small>{textFor(language, '当前可用 · GC-O、GC-IMS、GC×GC-MS 规划中', 'Available now · GC-O, GC-IMS, and GC×GC-MS are planned')}</small></div>
                <div role="listitem"><span>{textFor(language, '仪器', 'Instrument')}</span><strong>Shimadzu</strong><small>{textFor(language, '当前可运行 · 其他厂商适配规划中', 'Available now · Other vendors are planned')}</small></div>
                <div role="listitem"><span>{textFor(language, '执行与留存', 'Execution and retention')}</span><strong>{textFor(language, '浏览器本地连续执行', 'Continuous local browser execution')}</strong><small>{cloud.configured ? textFor(language, '原始文件不上传；结果可选云端留存', 'Raw files stay local; optional cloud result retention') : textFor(language, '本地模式；完成后立即下载结果', 'Local mode; download results immediately after completion')}</small></div>
              </div>
              <div className="shimadzu-settings" aria-labelledby="settings-title">
                <div className="shimadzu-region-heading"><div><h3 id="settings-title">{textFor(language, '数据导出', 'Data export')}</h3><p>{textFor(language, '分析参数依据已确认的科研规则执行。', 'Analysis parameters follow the confirmed scientific rules.')}</p></div></div>
                {!job && <label className="shimadzu-field"><span>{textFor(language, '任务名称', 'Task name')}</span><input value={localizedName} maxLength={120} onChange={event => setName(event.target.value)} /></label>}
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
                  <fieldset className="shimadzu-cv-field" aria-describedby="cv-screening-help">
                    <legend>{textFor(language, 'CV 筛查', 'CV screening')}</legend>
                    <label className="shimadzu-cv-toggle">
                      <input type="checkbox" checked={enableCvScreening} onChange={event => setEnableCvScreening(event.target.checked)} />
                      <span><strong>{textFor(language, '启用 CV 筛查', 'Enable CV screening')}</strong><small>{textFor(language, '默认关闭；仍计算 Mean、SD 和 CV，但不筛查结果。', 'Off by default; mean, SD, and CV are still calculated without filtering results.')}</small></span>
                    </label>
                    <label className="shimadzu-field shimadzu-cv-threshold"><span>{textFor(language, 'CV 阈值 (%)', 'CV threshold (%)')}</span><input type="number" min="0" max="1000" step="1" inputMode="decimal" value={cvThreshold} disabled={!enableCvScreening} onChange={event => setCvThreshold(event.target.value)} aria-describedby="cv-screening-help" /></label>
                    <p id="cv-screening-help" className="shimadzu-cv-help">{cvReadiness.message}</p>
                  </fieldset>
                )}
                <dl className="shimadzu-parameter-list"><div><dt>{textFor(language, '身份与结构', 'Identity and structure')}</dt><dd>{enableClassification ? textFor(language, '开启（PubChem + SMARTS）', 'On (PubChem + SMARTS)') : textFor(language, '关闭', 'Off')}</dd></div><div><dt>{textFor(language, '水中觉察阈值', 'Water detection threshold')}</dt><dd>{enableWaterDetectionThreshold ? textFor(language, '开启（本地证据库）', 'On (local evidence database)') : textFor(language, '关闭（不导出阈值列）', 'Off (threshold columns omitted)')}</dd></div><div><dt>{textFor(language, '估算参考 OAV', 'Estimated reference OAV')}</dt><dd>{textFor(language, '关闭', 'Off')}</dd></div><div><dt>{textFor(language, 'CV 筛查', 'CV screening')}</dt><dd>{enableCvScreening ? (language === 'en' ? `On (${cvReadiness.threshold ?? '—'}%)` : `启用（${cvReadiness.threshold ?? '—'}%）`) : textFor(language, '关闭', 'Off')}</dd></div><div><dt>{textFor(language, '响应因子', 'Response factor')}</dt><dd>1</dd></div><div><dt>{textFor(language, '内标参数', 'Internal-standard parameters')}</dt><dd>{textFor(language, '按样品表', 'From sample sheet')}</dd></div></dl>
              </div>
            </div>
          </details>
        </section>

        <section className="shimadzu-workbench-region shimadzu-import-region" aria-labelledby="data-import-preflight-title">
          <div className="shimadzu-region-heading shimadzu-workbench-heading"><div><span className="shimadzu-region-index">02</span><h2 id="data-import-preflight-title">{textFor(language, '数据导入与运行前检查', 'Data import and preflight checks')}</h2><p>{textFor(language, '导入两个工作簿，并在运行前确认文件、字段、Worker 与联网补充条件。', 'Import two workbooks and confirm files, fields, Worker readiness, and online enrichment before running.')}</p></div><span>{textFor(language, '2 个 Excel 文件', '2 Excel files')}</span></div>
          {!job ? (
            <form className="shimadzu-setup" onSubmit={submit}>
              <div className="shimadzu-input-region" aria-labelledby="input-title">
                <div className="shimadzu-region-heading"><div><h3 id="input-title">{textFor(language, '输入文件与模板', 'Input files and templates')}</h3><p>{textFor(language, '正式文件和示例模板采用相同字段结构；阶段 00 将核对工作表、样品映射、平行、矩阵、内标与参数。', 'Production files and templates share the same field structure. Stage 00 validates worksheets, sample mapping, replicates, matrices, internal standards, and parameters.')}</p></div></div>
                <div className="shimadzu-upload-grid">
                  <FilePicker language={language} inputRef={rawInputRef} label={textFor(language, '岛津原始工作簿', 'Shimadzu raw workbook')} hint={textFor(language, '包含 Peak Table、Similarity Search Results 与 Hit #', 'Contains Peak Table, Similarity Search Results, and Hit #')} file={rawFile} onChange={setRawFile} templateHref={api.templateUrl('raw-example')} templateLabel={textFor(language, '下载原始工作簿示例', 'Download raw-workbook example')} />
                  <FilePicker language={language} inputRef={samplesInputRef} label={textFor(language, '样品与内标信息表', 'Sample and internal-standard sheet')} hint={textFor(language, '包含样品分组、形态、内标浓度、添加量与体系', 'Contains sample groups, form, standard concentration, spike amount, and system volume')} file={samplesFile} onChange={setSamplesFile} templateHref={api.templateUrl('sample-info')} templateLabel={textFor(language, '下载样品信息模板', 'Download sample-information template')} />
                </div>
                <div className="shimadzu-upload-note"><Upload /><span>{textFor(language, '仅接受 .xlsx，每个文件不超过 50 MB。原始文件不上传云端；活动任务会临时保存在当前浏览器，刷新或重新打开后自动恢复。页面关闭期间不会继续计算。', 'Only .xlsx files up to 50 MB each are accepted. Raw files are not uploaded; active tasks are temporarily stored in this browser and recover after refresh or reopening. Processing does not continue while the page is closed.')}</span></div>
              </div>
              <aside className="shimadzu-settings shimadzu-preflight-panel" aria-labelledby="preflight-title">
                <div className="shimadzu-region-heading"><div><h3 id="preflight-title">{textFor(language, '运行前检查', 'Preflight checks')}</h3><p>{textFor(language, '门禁未通过时不会创建任务。', 'A task is not created unless all gates pass.')}</p></div></div>
                <div className="shimadzu-runtime-status" role="list" aria-label={textFor(language, '处理运行时状态', 'Processing runtime status')}>
                  <div role="listitem"><span className={engine.state}><ShieldCheck aria-hidden="true" /></span><div><strong>{textFor(language, '浏览器 Worker', 'Browser Worker')}</strong><small>{engine.title} · {engine.detail}</small></div></div>
                  <div role="listitem"><span className="standby"><CloudDownload aria-hidden="true" /></span><div><strong>{textFor(language, '本地联网代理', 'Local network proxy')}</strong><small>{language === 'en' ? `Connects to ${API_BASE} as needed for templates and structural enrichment` : `按需连接 ${API_BASE}，用于模板与结构补充`}</small></div></div>
                </div>
                <AnalysisReadinessStrip language={language} fileReadiness={fileReadiness} cvReadiness={cvReadiness} engine={engine} />
                <button className="shimadzu-run-button" type="submit" disabled={!canStart}>{submitting ? <Loader2 className="spin" /> : <Play />}{startFeedback.buttonLabel}</button>
                <p className={`shimadzu-run-readiness${fileReadiness.ready && cvReadiness.valid && canAnalyze ? ' ready' : ''}`} role="status" aria-live="polite">{startFeedback.message}</p>
                {cloud.configured && !canAnalyze && <p className="shimadzu-run-gate"><ShieldCheck />{textFor(language, '登录且通过管理员审批后开放计算。', 'Sign in and obtain administrator approval to enable processing.')}</p>}
              </aside>
            </form>
          ) : (
            <div className="shimadzu-import-summary"><FileCheck2 aria-hidden="true" /><div><strong>{textFor(language, '输入已锁定并进入处理流程', 'Inputs locked and processing started')}</strong><p>{rawFile?.name || textFor(language, '岛津原始工作簿', 'Shimadzu raw workbook')} · {samplesFile?.name || textFor(language, '样品与内标信息表', 'Sample and internal-standard sheet')}. {textFor(language, '任务恢复时会重新验证已完成步骤。', 'Completed stages are revalidated when a task is restored.')}</p></div></div>
          )}
        </section>

        <section className="shimadzu-workbench-region shimadzu-monitor-results-region" aria-labelledby="process-monitor-results-title">
          <div className="shimadzu-region-heading shimadzu-workbench-heading"><div><span className="shimadzu-region-index">03</span><h2 id="process-monitor-results-title">{textFor(language, '过程监控与结果', 'Process monitoring and results')}</h2><p>{textFor(language, '沿 00–07 流程查看总体进度、联网补充、门禁状态、错误证据和结果包。', 'Follow the 00–07 rail for overall progress, online enrichment, gate status, error evidence, and result packages.')}</p></div><div className="shimadzu-status-legend" aria-label={textFor(language, '状态图例', 'Status legend')}><span className="PASS">PASS</span><span className="WARN">WARN</span><span className="REVIEW">REVIEW</span><span className="FAIL">FAIL</span></div></div>
          <WorkflowMap job={job} language={language} />
          {!job ? (
            <div className="shimadzu-overview-grid">
              <LiveMonitor job={null} capabilities={null} engine={engine} language={language} />
              <HistoryPanel language={language} jobs={history} interruptedJobIds={interruptedJobIds} onDownload={downloadCloudResult} onMarkInterrupted={markInterrupted} onDownloadInput={downloadCloudInput} onDeleteResult={deleteCloudResult} isAdmin={profile?.is_admin === true} />
            </div>
          ) : (
            <>
            <div className={'shimadzu-job-workspace state-' + job.status}>
              <StageRail job={job} language={language} />
              <section className="shimadzu-job-bar shimadzu-reveal">
                <div className="shimadzu-job-identity"><span className={`shimadzu-job-badge ${job.status}`}>{statusLabel(job.status, language)}</span><div><h2>{localizedTaskName(job.name, language) || localizedName}</h2><code>{job.id}</code></div></div>
                <div className="shimadzu-job-progress"><div><span>{textFor(language, '总流程', 'Overall workflow')}</span><strong>{progress.completed} / {progress.total || 7}</strong></div><div className="shimadzu-progress-track"><span style={{ '--progress': progress.completed / (progress.total || 7) }} /></div></div>
                <div className="shimadzu-job-actions">
                  {job.status === 'waiting_review' && <button type="button" className="primary" onClick={continueJob}><ChevronRight />{textFor(language, '复核完成，继续', 'Review complete; continue')}</button>}
                  {job.status === 'running' && <button type="button" onClick={cancelJob}><AlertCircle />{textFor(language, '取消分析', 'Cancel analysis')}</button>}
                  {job.status === 'failed' && <button type="button" className="primary" onClick={retryJob}><RotateCcw />{textFor(language, '重新运行', 'Rerun')}</button>}
                  {job.status === 'cancelled' && <button type="button" className="primary" onClick={retryJob}><RotateCcw />{textFor(language, '重新运行', 'Rerun')}</button>}
                  {job.status === 'saving' && <span className="shimadzu-saving"><Loader2 className="spin" />{textFor(language, '正在保存结果', 'Saving results')}</span>}
                  {job.status === 'complete' && <a className="primary" href={job.downloadUrl} download={job.resultFileName}><Download />{textFor(language, '下载结果包', 'Download result package')}</a>}
                  {job.status === 'cancelled' && job.partialDownloadUrl && <a className="primary" href={job.partialDownloadUrl} download={job.partialArchiveFileName}><Download />{textFor(language, '下载取消审计与部分结果', 'Download cancellation audit and partial results')}</a>}
                  {['failed', 'cancelled', 'complete', 'interrupted'].includes(job.status) && <button type="button" onClick={reset}><RotateCcw />{textFor(language, '新任务', 'New task')}</button>}
                </div>
              </section>
              {job.error && <div className="shimadzu-inline-error" role="alert"><AlertCircle /><div><p><strong>{job.error.code}</strong>{job.error.message}</p>{job.error.details?.stage !== undefined && <small>{job.status === 'cancelled' ? textFor(language, '取消于步骤', 'Cancelled before stage') : textFor(language, '失败步骤', 'Failed stage')}: {Number(job.error.details.stage) + 1} / 7</small>}{job.error.details?.issues?.length > 0 && <ul>{prioritizeShimadzuIssues(job.error.details.issues, 4).map((issue, index) => <li key={`${issue.code || 'issue'}-${index}`}>{issue.code || textFor(language, '质量门禁问题', 'Quality-gate issue')}{issue.sampleName ? ` · ${issue.sampleName}` : ''}{issue.cas ? ` · CAS ${issue.cas}` : ''}</li>)}</ul>}{job.partialDownloadUrl && <a href={job.partialDownloadUrl} download={job.partialArchiveFileName}><Download />{job.status === 'cancelled' ? textFor(language, '下载取消审计与部分结果', 'Download cancellation audit and partial results') : textFor(language, '下载已完成步骤与错误证据', 'Download completed stages and error evidence')}</a>}</div></div>}
              <WorkspaceTabs language={language} />
              <LiveMonitor job={job} capabilities={null} engine={engine} language={language} />
              <AnalysisSummary job={job} language={language} />
              <section id="stage-details" className="shimadzu-stage-detail shimadzu-reveal" aria-labelledby="detail-title">
                <div className="shimadzu-region-heading"><div><h2 id="detail-title">{textFor(language, '步骤状态与处理计数', 'Stage status and processing counts')}</h2><p>{textFor(language, '各步骤的运行状态、警告和待复核项会保留到最终报告。', 'Stage status, warnings, and review items are retained in the final report.')}</p></div></div>
                <ol>
                  {WORKFLOW.map(sourceStage => {
                    const stage = localizedStage(sourceStage, language)
                    const runtime = job.stages?.[stage.index] || {}
                    const status = runtime.status || 'pending'
                    return <li key={stage.index} className={`state-${status}`}><span className="shimadzu-stage-status"><StageMark status={status} /></span><div><p><b>{String(stage.index).padStart(2, '0')}</b><strong>{stage.label}</strong></p><small>{stage.description}</small></div><div className="shimadzu-stage-result"><span>{statusLabel(status, language)}</span>{Object.keys(runtime.counts || {}).length > 0 && <small>{Object.entries(runtime.counts).slice(0, 3).map(([key, value]) => `${key} ${value}`).join(' · ')}</small>}</div></li>
                  })}
                </ol>
              </section>
            </div>
            <HistoryPanel language={language} jobs={history} interruptedJobIds={interruptedJobIds} onDownload={downloadCloudResult} onMarkInterrupted={markInterrupted} onDownloadInput={downloadCloudInput} onDeleteResult={deleteCloudResult} isAdmin={profile?.is_admin === true} />
            </>
          )}
          <AccountPanel language={language} cloud={cloud} session={session} profile={profile} loading={cloudLoading} error={cloudError} onRefresh={refreshCloud} />
        </section>
      </ContentElement>
    </div>
  )
}
