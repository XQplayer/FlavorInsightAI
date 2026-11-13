import { useEffect, useRef, useState } from 'react'
import { BookOpen, CircleStop, Clipboard, LockKeyhole, MessageCircle, Pencil, Plus, RotateCcw, Send, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { aiChatClient } from '../lib/aiChatClient.js'
import { supabase } from '../lib/supabase.js'
import { routeHref } from '../app/platformRoutes.js'
import './AIResearchAssistantPage.css'

const COPY = {
  zh: {
    title: 'AI 科研助手', subtitle: '围绕平台证据对话，保留数据来源与分析边界。', conversations: '会话记录', new: '新建会话', welcome: '从一个科研问题开始', prompt: '询问化合物、平台数据或已有任务。回答会区分数据库记录与 AI 解释。', send: '发送', stop: '停止生成', placeholder: '输入科研问题…', sources: '数据来源', copy: '复制回答', copied: '已复制', retry: '重新提问', delete: '删除会话', rename: '重命名会话', stopped: '生成已停止；未完成回答不会作为完整结果保存。', interrupted: '上次回答未完成', empty: '暂无会话', modeMock: '本地 Mock · 非 GPT 回答', modeReal: 'OpenAI 模型', unavailable: 'AI 服务暂不可用', knowledge: '科研知识库尚未连接', tool: '正在查询平台数据', failed: '请求失败', usage: '本次用量', signInRequired: '请先登录', signIn: '登录现有账号', signOut: '退出登录', email: '邮箱', password: '密码', authFailed: '登录失败，请检查邮箱和密码。', questions: ['查询 CAS 141-78-6，并介绍它的风味特征。', '半定量与绝对定量有什么区别？', '如何核对 GC-MS 任务的 QC 状态？'],
  },
  en: {
    title: 'AI Research Assistant', subtitle: 'Discuss platform evidence with traceable sources and clear scientific limits.', conversations: 'Conversations', new: 'New conversation', welcome: 'Start with a research question', prompt: 'Ask about compounds, platform data, or accessible tasks. Database records and AI interpretation are distinguished.', send: 'Send', stop: 'Stop generating', placeholder: 'Ask a research question…', sources: 'Sources', copy: 'Copy answer', copied: 'Copied', retry: 'Ask again', delete: 'Delete conversation', rename: 'Rename conversation', stopped: 'Generation stopped; the unfinished answer is not saved as complete.', interrupted: 'Previous response was incomplete', empty: 'No conversations yet', modeMock: 'Local Mock · not a GPT answer', modeReal: 'OpenAI model', unavailable: 'AI service unavailable', knowledge: 'Research knowledge base is not connected', tool: 'Querying platform data', failed: 'Request failed', usage: 'Usage', signInRequired: 'Sign in to chat', signIn: 'Sign in', signOut: 'Sign out', email: 'Email', password: 'Password', authFailed: 'Sign-in failed. Check your email and password.', questions: ['Look up CAS 141-78-6 and describe its recorded flavor.', 'How does semi-quantification differ from absolute quantification?', 'How can I check the QC state of a GC-MS task?'],
  },
}

function initialContext(language) {
  const params = new URLSearchParams(window.location.search)
  const cas = params.get('cas')
  const taskId = params.get('task_id')
  if (cas && /^\d{2,7}-\d{2}-\d$/.test(cas)) return language === 'en' ? `Look up CAS ${cas} and explain its platform evidence.` : `查询 CAS ${cas} 并说明平台证据。`
  if (taskId && /^[0-9a-f-]{36}$/i.test(taskId)) return language === 'en' ? `Interpret the available results, semi-quantitative units, limitations and QC for my task ${taskId}. Use get_analysis_summary first; report unavailable evidence explicitly.` : `解读我的任务 ${taskId} 的已有结果、半定量单位、限制和 QC。请先调用 get_analysis_summary；缺失证据要明确说明。`
  return ''
}

function MarkdownAnswer({ text }) {
  return <div className="ai-research-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ href, children }) => href?.startsWith('https://') ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>, img: () => null }}>{text}</ReactMarkdown></div>
}

export default function AIResearchAssistantPage({ language = 'zh', onRequireAuth, resumeIntent }) {
  const t = COPY[language] || COPY.zh
  const taskContext = new URLSearchParams(window.location.search).get('task_id')
  const [configuration, setConfiguration] = useState(null)
  const [conversationId, setConversationId] = useState(null)
  const [conversations, setConversations] = useState([])
  const [messages, setMessages] = useState([])
  const [analysisLinks, setAnalysisLinks] = useState([])
  const [draft, setDraft] = useState(() => initialContext(language))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [usage, setUsage] = useState(null)
  const [authSession, setAuthSession] = useState(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const abortRef = useRef(null)
  const requestEpoch = useRef(0)
  const authIdentity = useRef(undefined)
  const endRef = useRef(null)
  const handledResume = useRef(null)

  useEffect(() => {
    if (resumeIntent?.action !== 'assistant.send' || handledResume.current === resumeIntent) return
    handledResume.current = resumeIntent
    setDraft(resumeIntent.draft?.text || '')
  }, [resumeIntent])

  useEffect(() => {
    let live = true
    const load = async epoch => {
      try {
        const config = await aiChatClient.session()
        const list = await aiChatClient.list()
        if (live && requestEpoch.current === epoch) {
          setConfiguration(config)
          setConversations(list.conversations || [])
          const selected = new URLSearchParams(window.location.search).get('conversation_id')
          if (selected && (list.conversations || []).some(item => item.id === selected)) {
            const history = await aiChatClient.get(selected)
            if (live && requestEpoch.current === epoch) { setConversationId(selected); setMessages(history.messages || []); setAnalysisLinks(history.analysis_links || []) }
          }
        }
      } catch (value) { if (live && requestEpoch.current === epoch && (authIdentity.current !== 'guest' || !supabase)) setError(value.message) }
    }
    if (!supabase) load(requestEpoch.current)
    const listener = supabase?.auth.onAuthStateChange((_event, session) => {
      setAuthSession(session || null)
      setAuthReady(true)
      const next = session?.user?.id || 'guest'
      const previous = authIdentity.current
      authIdentity.current = next
      if (previous === undefined && _event === 'INITIAL_SESSION') {
        if (!session) setError('')
        else window.setTimeout(() => { if (live) load(requestEpoch.current) }, 0)
        return
      }
      if (previous === next) return
      const epoch = ++requestEpoch.current
      abortRef.current?.abort()
      setBusy(false); setConfiguration(null); setConversations([]); setConversationId(null)
      setMessages([]); setAnalysisLinks([]); setError(''); setUsage(null)
      const url = new URL(window.location.href)
      url.searchParams.delete('conversation_id')
      window.history.replaceState(window.history.state, '', url)
      if (session) window.setTimeout(() => { if (live) load(epoch) }, 0)
    })
    return () => { live = false; abortRef.current?.abort(); listener?.data.subscription.unsubscribe() }
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' }) }, [messages])

  const refreshList = () => {
    const epoch = requestEpoch.current
    return aiChatClient.list().then(value => {
      if (requestEpoch.current === epoch) setConversations(value.conversations || [])
    }).catch(() => {})
  }
  const selectUrl = id => {
    const url = new URL(window.location.href)
    if (id) url.searchParams.set('conversation_id', id)
    else url.searchParams.delete('conversation_id')
    window.history.replaceState(window.history.state, '', url)
  }
  const clearConversation = () => { requestEpoch.current++; abortRef.current?.abort(); setBusy(false); setConversationId(null); setMessages([]); setAnalysisLinks([]); setError(''); setUsage(null); selectUrl(null) }
  const newConversation = async () => {
    try {
      if (!supabase && configuration?.mode !== 'mock') throw new Error(language === 'zh' ? '当前部署未连接账号服务，无法创建私人会话。' : 'Account service is unavailable; private conversations cannot be created.')
      if (supabase && !(await onRequireAuth?.('assistant.conversation'))) return
    }
    catch (value) { setError(value.message); return }
    clearConversation()
    const epoch = requestEpoch.current
    try { const created = await aiChatClient.create(); if (epoch === requestEpoch.current) { setConversationId(created.id); selectUrl(created.id); await refreshList() } }
    catch (value) { if (epoch === requestEpoch.current) setError(value.message) }
  }
  const openConversation = async id => {
    const epoch = ++requestEpoch.current
    if (busy) abortRef.current?.abort()
    setBusy(false); setError('')
    try {
      const result = await aiChatClient.get(id)
      if (epoch === requestEpoch.current) { setConversationId(id); setMessages(result.messages || []); setAnalysisLinks(result.analysis_links || []); setUsage(null); selectUrl(id) }
    } catch (value) { if (epoch === requestEpoch.current) setError(value.message) }
  }
  const deleteConversation = async id => {
    try {
      await aiChatClient.remove(id)
      if (conversationId === id) clearConversation()
      refreshList()
    } catch (value) { setError(value.message) }
  }
  const renameConversation = async item => {
    const title = window.prompt(t.rename, item.title)
    if (title == null || title.trim() === item.title) return
    try { await aiChatClient.rename(item.id, title.trim()); await refreshList() }
    catch (value) { setError(value.message) }
  }
  const send = async (question = draft) => {
    const text = question.trim()
    if (!text || busy) return
    try {
      if (!supabase && configuration?.mode !== 'mock') throw new Error(language === 'zh' ? '当前部署未连接账号服务，无法发送真实 GPT 消息。' : 'Account service is unavailable; live GPT messages cannot be sent.')
      if (supabase && !(await onRequireAuth?.('assistant.send', { text }))) { setDraft(text); return }
    } catch (value) { setDraft(text); setError(value.message); return }
    setError(''); setUsage(null); setBusy(true); setDraft('')
    const controller = new AbortController()
    const epoch = ++requestEpoch.current
    abortRef.current = controller
    const assistantIndex = messages.length + 1
    setMessages(current => [...current, { role: 'user', content: text }, { role: 'assistant', content: '', sources: [], toolEvents: [] }])
    try {
      let id = conversationId
      if (!id) { const created = await aiChatClient.create(); id = created.id; if (epoch !== requestEpoch.current) return; setConversationId(id); selectUrl(id) }
      for await (const event of aiChatClient.send(id, text, controller.signal)) {
        if (epoch !== requestEpoch.current) return
        if (event.type === 'delta') setMessages(current => current.map((item, index) => index === assistantIndex ? { ...item, content: item.content + event.text } : item))
        if (event.type === 'tool') setMessages(current => current.map((item, index) => index === assistantIndex ? { ...item, toolEvents: [...(item.toolEvents || []), event] } : item))
        if (event.type === 'done') setMessages(current => current.map((item, index) => index === assistantIndex ? { ...item, sources: event.sources || [] } : item))
        if (event.type === 'usage') setUsage(event)
      }
      if (epoch === requestEpoch.current) await refreshList()
    } catch (value) {
      if (epoch === requestEpoch.current) {
        setError(value.name === 'AbortError' ? t.stopped : value.message)
        setMessages(current => current.map((item, index) => index === assistantIndex ? { ...item, status: value.name === 'AbortError' ? 'interrupted' : 'failed' } : item))
      }
    } finally { if (epoch === requestEpoch.current) { setBusy(false); abortRef.current = null } }
  }
  const retry = () => {
    const lastUser = [...messages].reverse().find(item => item.role === 'user')
    if (lastUser) send(lastUser.content)
  }
  const copyAnswer = async text => { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1600) }

  return <section className="ai-research-page" aria-labelledby="ai-research-title">
    <header className="ai-research-header"><div><p className="ai-research-eyebrow">FLAVORINSIGHT AI / RESEARCH</p><h1 id="ai-research-title">{t.title}</h1><p>{t.subtitle}</p>{configuration?.mode === 'openai' && configuration?.history_persistence !== 'supabase' && <p role="alert">{language === 'en' ? 'Conversation history is temporary on this server.' : '当前服务的会话记录仅为临时保存。'}</p>}{conversationId && <a href={`../data-analysis/?conversation_id=${encodeURIComponent(conversationId)}`}>{language === 'en' ? 'Open Browser PCA in this conversation' : '在当前会话中打开浏览器 PCA'}</a>}</div><span className={`ai-research-mode ${configuration?.mode === 'mock' ? 'is-mock' : ''}`}>{authReady && supabase && !authSession && configuration?.mode !== 'mock' ? t.signInRequired : configuration?.mode === 'mock' ? t.modeMock : configuration?.mode === 'openai' ? t.modeReal : t.unavailable}</span></header>
    {authReady && supabase && !authSession && <div className="ai-research-auth"><LockKeyhole size={18} aria-hidden="true" /><strong>{t.signInRequired}</strong><p>{language === 'en' ? 'You can browse this page. Sign in only when creating a private conversation or sending a message.' : '可以先浏览页面；创建私人会话或发送消息时再登录。'}</p><button type="button" onClick={() => onRequireAuth?.('assistant.conversation')?.catch(value => setError(value.message))}>{t.signIn}</button></div>}
    {authSession && <div className="ai-research-account"><span>{authSession.user.email}</span><a href={routeHref('login', import.meta.env.BASE_URL)}>{language === 'en' ? 'Account' : '账号'}</a></div>}
    {taskContext && /^[0-9a-f-]{36}$/i.test(taskContext) && <div className="ai-research-task-context" role="note"><strong>{language === 'en' ? 'Task interpretation' : '任务 AI 解读'} · {taskContext.slice(0, 8)}</strong><span>{configuration?.private_task_tools_enabled
      ? language === 'en' ? 'The server checks task access and sends only a bounded retained-result excerpt. Missing or expired results remain explicitly unavailable; no raw workbook is sent.' : '服务端核验任务权限，只发送限量的已留存结果摘录。结果缺失或过期会明确标示；不发送原始工作簿。'
      : language === 'en' ? 'Private task interpretation is not enabled. You can still ask about public compound evidence.' : '私有任务解读尚未开放；仍可查询公开化合物证据。'}</span></div>}
    {analysisLinks.length > 0 && <div className="ai-research-task-context" role="note"><strong>{language === 'en' ? 'Linked browser analyses' : '已关联的浏览器分析'}</strong>{analysisLinks.map(link => <span key={link.result_id}>{link.analysis_id} / {link.result_id} · {language === 'en' ? 'client-validated summary' : '客户端校验摘要'}</span>)}</div>}
    <div className="ai-research-layout">
      <aside className="ai-research-history" aria-label={t.conversations}><div className="ai-research-history-head"><h2>{t.conversations}</h2><button type="button" onClick={newConversation}><Plus size={16} />{t.new}</button></div><ul>{conversations.length ? conversations.map(item => <li key={item.id}><button type="button" className={conversationId === item.id ? 'active' : ''} onClick={() => openConversation(item.id)} aria-current={conversationId === item.id ? 'page' : undefined} title={item.last_activity_at || item.created_at}><MessageCircle size={15} /><span>{item.title}</span></button><button className="ai-research-action" type="button" aria-label={`${t.rename}: ${item.title}`} onClick={() => renameConversation(item)}><Pencil size={14} /></button><button className="ai-research-delete" type="button" aria-label={`${t.delete}: ${item.title}`} onClick={() => deleteConversation(item.id)}><Trash2 size={15} /></button></li>) : <li className="ai-research-empty-history">{t.empty}</li>}</ul><div className="ai-research-knowledge"><BookOpen size={16} /><span>{t.knowledge}</span></div></aside>
      <div className="ai-research-thread"><div className="ai-research-messages" role="log" aria-live="polite" aria-relevant="additions text">
        {!messages.length && <div className="ai-research-welcome"><span className="ai-research-symbol">FI</span><h2>{t.welcome}</h2><p>{t.prompt}</p><div className="ai-research-suggestions">{t.questions.map(question => <button key={question} type="button" onClick={() => { setDraft(question); send(question) }} disabled={Boolean(authSession) && (!configuration || configuration.mode === 'disabled')}>{question}</button>)}</div></div>}
        {messages.map((item, index) => <article className={`ai-research-message ${item.role}`} key={item.message_id || `${index}-${item.role}`}><div className="ai-research-avatar">{item.role === 'user' ? (language === 'en' ? 'You' : '你') : 'AI'}</div><div className="ai-research-message-body">{item.role === 'assistant' && (item.toolEvents || item.tool_events)?.length > 0 && <div className="ai-research-tool-events">{(item.toolEvents || item.tool_events).map((event, eventIndex) => <span key={`${event.name}-${eventIndex}`}>{t.tool}: {event.name} · {event.status}</span>)}</div>}{item.role === 'assistant' ? <MarkdownAnswer text={item.content || (busy ? '…' : '')} /> : <p>{item.content}</p>}{item.status && item.status !== 'completed' && <small role="status">{t.interrupted}: {item.status}</small>}{item.sources?.length > 0 && <div className="ai-research-sources"><strong>{t.sources}</strong>{item.sources.map((source, sourceIndex) => source.url?.startsWith('https://') ? <a href={source.url} target="_blank" rel="noopener noreferrer" key={`${source.url}-${sourceIndex}`}>{source.dataset || source.type || 'Source'}</a> : <span key={`${source.type}-${sourceIndex}`}>{source.dataset || source.type || 'Source'}</span>)}</div>}{item.role === 'assistant' && item.content && <button className="ai-research-copy" type="button" onClick={() => copyAnswer(item.content)}><Clipboard size={14} />{copied ? t.copied : t.copy}</button>}</div></article>)}<div ref={endRef} />
      </div>
      <div className="ai-research-composer"><div className="ai-research-status">{error && <p role="alert">{t.failed}: {error} <button type="button" onClick={retry} disabled={busy}><RotateCcw size={14} />{t.retry}</button></p>}{usage && configuration?.mode === 'openai' && <small>{t.usage}: {usage.input_tokens} / {usage.output_tokens} tokens{usage.estimated_cost_usd == null ? '' : ` · $${usage.estimated_cost_usd}`}</small>}</div><form onSubmit={event => { event.preventDefault(); send() }}><label htmlFor="ai-research-input" className="sr-only">{t.placeholder}</label><textarea id="ai-research-input" value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send() } }} placeholder={t.placeholder} maxLength={configuration?.limits?.input_characters || 4000} rows="3" disabled={Boolean(authSession) && (!configuration || configuration.mode === 'disabled')} />{busy ? <button className="ai-research-submit stop" type="button" onClick={() => abortRef.current?.abort()}><CircleStop size={17} />{t.stop}</button> : <button className="ai-research-submit" type="submit" disabled={!draft.trim() || Boolean(authSession) && (!configuration || configuration.mode === 'disabled')}><Send size={17} />{t.send}</button>}</form></div></div>
    </div>
  </section>
}
