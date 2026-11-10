import { useEffect, useRef, useState } from 'react'
import { BookOpen, CircleStop, Clipboard, MessageCircle, Plus, RotateCcw, Send, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { aiChatClient } from '../lib/aiChatClient.js'
import './AIResearchAssistantPage.css'

const COPY = {
  zh: {
    title: 'AI 科研助手', subtitle: '围绕平台证据对话，保留数据来源与分析边界。', conversations: '会话记录', new: '新建会话', welcome: '从一个科研问题开始', prompt: '询问化合物、平台数据或已有任务。回答会区分数据库记录与 AI 解释。', send: '发送', stop: '停止生成', placeholder: '输入科研问题…', sources: '数据来源', copy: '复制回答', copied: '已复制', retry: '重新提问', delete: '删除会话', empty: '暂无会话', modeMock: '本地 Mock · 非 GPT 回答', modeReal: 'OpenAI 模型', unavailable: 'AI 服务暂不可用', knowledge: '科研知识库尚未连接', tool: '正在查询平台数据', failed: '请求失败', usage: '本次用量', questions: ['查询 CAS 141-78-6，并介绍它的风味特征。', '半定量与绝对定量有什么区别？', '如何核对 GC-MS 任务的 QC 状态？'],
  },
  en: {
    title: 'AI Research Assistant', subtitle: 'Discuss platform evidence with traceable sources and clear scientific limits.', conversations: 'Conversations', new: 'New conversation', welcome: 'Start with a research question', prompt: 'Ask about compounds, platform data, or accessible tasks. Database records and AI interpretation are distinguished.', send: 'Send', stop: 'Stop generating', placeholder: 'Ask a research question…', sources: 'Sources', copy: 'Copy answer', copied: 'Copied', retry: 'Ask again', delete: 'Delete conversation', empty: 'No conversations yet', modeMock: 'Local Mock · not a GPT answer', modeReal: 'OpenAI model', unavailable: 'AI service unavailable', knowledge: 'Research knowledge base is not connected', tool: 'Querying platform data', failed: 'Request failed', usage: 'Usage', questions: ['Look up CAS 141-78-6 and describe its recorded flavor.', 'How does semi-quantification differ from absolute quantification?', 'How can I check the QC state of a GC-MS task?'],
  },
}

function initialContext(language) {
  try {
    const pcaPrompt = sessionStorage.getItem('flavor-pca-explanation')
    if (pcaPrompt) { sessionStorage.removeItem('flavor-pca-explanation'); return pcaPrompt }
  } catch { /* Context can be entered manually if session storage is blocked. */ }
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

export default function AIResearchAssistantPage({ language = 'zh', onNavigate }) {
  const t = COPY[language] || COPY.zh
  const taskContext = new URLSearchParams(window.location.search).get('task_id')
  const [configuration, setConfiguration] = useState(null)
  const [conversationId, setConversationId] = useState(null)
  const [conversations, setConversations] = useState([])
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState(() => initialContext(language))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [usage, setUsage] = useState(null)
  const abortRef = useRef(null)
  const endRef = useRef(null)

  useEffect(() => {
    let live = true
    aiChatClient.session().then(async config => {
      if (!live) return
      setConfiguration(config)
      const list = await aiChatClient.list()
      if (live) setConversations(list.conversations || [])
    }).catch(value => { if (live) setError(value.message) })
    return () => { live = false; abortRef.current?.abort() }
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' }) }, [messages])

  const refreshList = () => aiChatClient.list().then(value => setConversations(value.conversations || [])).catch(() => {})
  const newConversation = () => { abortRef.current?.abort(); setBusy(false); setConversationId(null); setMessages([]); setError(''); setUsage(null) }
  const openConversation = async id => {
    if (busy) abortRef.current?.abort()
    setBusy(false); setError('')
    try {
      const result = await aiChatClient.get(id)
      setConversationId(id); setMessages(result.messages || []); setUsage(null)
    } catch (value) { setError(value.message) }
  }
  const deleteConversation = async id => {
    try {
      await aiChatClient.remove(id)
      if (conversationId === id) newConversation()
      refreshList()
    } catch (value) { setError(value.message) }
  }
  const send = async (question = draft, retry = false) => {
    const text = question.trim()
    if (!text || busy) return
    setError(''); setUsage(null); setBusy(true); setDraft('')
    const controller = new AbortController()
    abortRef.current = controller
    const assistantIndex = retry ? messages.length - 1 : messages.length + 1
    if (retry) setMessages(current => [...current.slice(0, -1), { role: 'assistant', content: '', sources: [], toolEvents: [] }])
    else setMessages(current => [...current, { role: 'user', content: text }, { role: 'assistant', content: '', sources: [], toolEvents: [] }])
    try {
      let id = conversationId
      if (!id) { const created = await aiChatClient.create(); id = created.id; setConversationId(id) }
      for await (const event of aiChatClient.send(id, text, controller.signal)) {
        if (event.type === 'delta') setMessages(current => current.map((item, index) => index === assistantIndex ? { ...item, content: item.content + event.text } : item))
        if (event.type === 'tool') setMessages(current => current.map((item, index) => index === assistantIndex ? { ...item, toolEvents: [...(item.toolEvents || []), event] } : item))
        if (event.type === 'done') setMessages(current => current.map((item, index) => index === assistantIndex ? { ...item, sources: event.sources || [] } : item))
        if (event.type === 'usage') setUsage(event)
      }
      await refreshList()
    } catch (value) {
      if (value.name !== 'AbortError') setError(value.message)
    } finally { setBusy(false); abortRef.current = null }
  }
  const retry = () => {
    const lastUser = [...messages].reverse().find(item => item.role === 'user')
    if (lastUser) send(lastUser.content, messages.at(-1)?.role === 'assistant')
  }
  const copyAnswer = async text => { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1600) }
  const planPca = () => {
    const question = draft.trim() || [...messages].reverse().find(item => item.role === 'user')?.content || ''
    try { sessionStorage.setItem('flavor-pca-prompt', question.slice(0, 4000)) }
    catch { /* The analysis page can still accept the question directly. */ }
    onNavigate?.('analysis')
  }

  return <section className="ai-research-page" aria-labelledby="ai-research-title">
    <header className="ai-research-header"><div><p className="ai-research-eyebrow">FLAVORINSIGHT AI / RESEARCH</p><h1 id="ai-research-title">{t.title}</h1><p>{t.subtitle}</p></div><span className={`ai-research-mode ${configuration?.mode === 'mock' ? 'is-mock' : ''}`}>{configuration?.mode === 'mock' ? t.modeMock : configuration?.mode === 'openai' ? t.modeReal : t.unavailable}</span></header>
    {taskContext && /^[0-9a-f-]{36}$/i.test(taskContext) && <div className="ai-research-task-context" role="note"><strong>{language === 'en' ? 'Task interpretation' : '任务 AI 解读'} · {taskContext.slice(0, 8)}</strong><span>{language === 'en' ? 'The server checks task access and sends only a bounded retained-result excerpt. Missing or expired results remain explicitly unavailable; no raw workbook is sent.' : '服务端核验任务权限，只发送限量的已留存结果摘录。结果缺失或过期会明确标示；不发送原始工作簿。'}</span></div>}
    {import.meta.env.VITE_AI_PCA_ENABLED === 'true' && <div className="ai-research-task-context"><strong>{language === 'en' ? 'PCA analysis' : 'PCA 分析'}</strong><span>{import.meta.env.VITE_ANALYSIS_API_URL
      ? language === 'en' ? 'Confirm parameters in the workbench before hosted R computation. The matrix is stored with your private task; only a bounded result excerpt is sent to GPT after a separate Send action.' : '请先在工作台确认参数，再由线上 R 服务计算。矩阵随私有任务保存；仅在单独点击发送后，才会把有限结果摘要提供给 GPT。'
      : language === 'en' ? 'Use your local dataset to inspect and confirm parameters before real R computation. Raw values stay in the analysis workbench.' : '使用本地数据检查并确认参数后，由真实 R 引擎计算；原始矩阵保留在分析工作台。'}</span><button type="button" onClick={planPca}>{language === 'en' ? 'Plan PCA with my data' : '用我的数据规划 PCA'}</button></div>}
    {draft.startsWith('请仅依据以下用户主动提供的') && <div className="ai-research-task-context" role="note">{language === 'en' ? 'A bounded local R result excerpt is ready. Review the draft and press Send to share it with the AI service. The gateway has not independently rechecked this result.' : '有限的本地 R 结果摘要已准备好。请检查输入框并点击“发送”，才会分享给 AI 服务；Gateway 未独立复核该结果。'}</div>}
    <div className="ai-research-layout">
      <aside className="ai-research-history" aria-label={t.conversations}><div className="ai-research-history-head"><h2>{t.conversations}</h2><button type="button" onClick={newConversation}><Plus size={16} />{t.new}</button></div><ul>{conversations.length ? conversations.map(item => <li key={item.id}><button type="button" className={conversationId === item.id ? 'active' : ''} onClick={() => openConversation(item.id)} aria-current={conversationId === item.id ? 'page' : undefined}><MessageCircle size={15} /><span>{item.title}</span></button><button className="ai-research-delete" type="button" aria-label={`${t.delete}: ${item.title}`} onClick={() => deleteConversation(item.id)}><Trash2 size={15} /></button></li>) : <li className="ai-research-empty-history">{t.empty}</li>}</ul><div className="ai-research-knowledge"><BookOpen size={16} /><span>{t.knowledge}</span></div></aside>
      <div className="ai-research-thread"><div className="ai-research-messages" role="log" aria-live="polite" aria-relevant="additions text">
        {!messages.length && <div className="ai-research-welcome"><span className="ai-research-symbol">FI</span><h2>{t.welcome}</h2><p>{t.prompt}</p><div className="ai-research-suggestions">{t.questions.map(question => <button key={question} type="button" onClick={() => { setDraft(question); send(question) }} disabled={!configuration || configuration.mode === 'disabled'}>{question}</button>)}</div></div>}
        {messages.map((item, index) => <article className={`ai-research-message ${item.role}`} key={`${index}-${item.role}`}><div className="ai-research-avatar">{item.role === 'user' ? (language === 'en' ? 'You' : '你') : 'AI'}</div><div className="ai-research-message-body">{item.role === 'assistant' && item.toolEvents?.length > 0 && <div className="ai-research-tool-events">{item.toolEvents.map((event, eventIndex) => <span key={`${event.name}-${eventIndex}`}>{t.tool}: {event.name} · {event.status}</span>)}</div>}{item.role === 'assistant' ? <MarkdownAnswer text={item.content || (busy ? '…' : '')} /> : <p>{item.content}</p>}{item.sources?.length > 0 && <div className="ai-research-sources"><strong>{t.sources}</strong>{item.sources.map((source, sourceIndex) => source.url?.startsWith('https://') ? <a href={source.url} target="_blank" rel="noopener noreferrer" key={`${source.url}-${sourceIndex}`}>{source.dataset || source.type || 'Source'}</a> : <span key={`${source.type}-${sourceIndex}`}>{source.dataset || source.type || 'Source'}</span>)}</div>}{item.role === 'assistant' && item.content && <button className="ai-research-copy" type="button" onClick={() => copyAnswer(item.content)}><Clipboard size={14} />{copied ? t.copied : t.copy}</button>}</div></article>)}<div ref={endRef} />
      </div>
      <div className="ai-research-composer"><div className="ai-research-status">{error && <p role="alert">{t.failed}: {error} <button type="button" onClick={retry} disabled={busy}><RotateCcw size={14} />{t.retry}</button></p>}{usage && configuration?.mode === 'openai' && <small>{t.usage}: {usage.input_tokens} / {usage.output_tokens} tokens{usage.estimated_cost_usd == null ? '' : ` · $${usage.estimated_cost_usd}`}</small>}</div><form onSubmit={event => { event.preventDefault(); send() }}><label htmlFor="ai-research-input" className="sr-only">{t.placeholder}</label><textarea id="ai-research-input" value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send() } }} placeholder={t.placeholder} maxLength={configuration?.limits?.input_characters || 4000} rows="3" disabled={!configuration || configuration.mode === 'disabled'} />{busy ? <button className="ai-research-submit stop" type="button" onClick={() => abortRef.current?.abort()}><CircleStop size={17} />{t.stop}</button> : <button className="ai-research-submit" type="submit" disabled={!draft.trim() || !configuration || configuration.mode === 'disabled'}><Send size={17} />{t.send}</button>}</form></div></div>
    </div>
  </section>
}
