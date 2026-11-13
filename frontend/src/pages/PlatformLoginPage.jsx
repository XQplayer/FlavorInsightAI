import { useEffect, useState } from 'react';
import { ArrowRight, Fingerprint, LockKeyhole, ShieldCheck } from 'lucide-react';
import { usePlatformPreferences } from '../app/PlatformPreferences.jsx';
import { routeHref } from '../app/platformRoutes.js';
import { supabase } from '../lib/supabase.js';
import { authCallbackMessage } from '../lib/shimadzuCloud.js';
import './PlatformPages.css';

const BASE = import.meta.env.BASE_URL;
const COPY = {
  zh: { eyebrow: '以证据为基础的科研环境', statement: '从仪器信号走向可追溯的风味解析。', detail: '使用同一个账号访问数据处理和 AI 科研助手；公开页面与本地分析无需登录。', provenance: '来源清晰可见，方法可供复核。', label: '统一账号', heading: '登录后返回原功能', email: '邮箱', password: '密码', name: '姓名或小组内称呼', login: '登录', register: '提交注册申请', switchRegister: '申请账号', switchLogin: '已有账号？登录', resend: '重新发送验证邮件', signOut: '退出登录', continue: '返回原功能', home: '返回首页', local: '当前部署未连接账号服务；浏览器本地功能仍可使用。', pending: '待管理员审批', approved: '已获准使用', rejected: '申请未通过', suspended: '账号已停用', submitted: '如果该邮箱可以注册，请完成邮件验证；随后登录查看审批状态。', resent: '如可发送，新验证邮件已发出，请查看邮箱。', invalid: '登录失败，请检查邮箱、密码或邮箱验证状态。', signedIn: '当前已登录', unknown: '正在核对审批状态' },
  en: { eyebrow: 'A research environment, built for evidence', statement: 'From instrument signals to traceable flavor insight.', detail: 'One account for data processing and Agents SAI; public pages and local analysis remain open.', provenance: 'Sources stay visible. Methods stay reviewable.', label: 'UNIFIED ACCOUNT', heading: 'Sign in and return to your work', email: 'Email', password: 'Password', name: 'Name or team display name', login: 'Sign in', register: 'Request an account', switchRegister: 'Request access', switchLogin: 'Have an account? Sign in', resend: 'Resend verification email', signOut: 'Sign out', continue: 'Return to previous task', home: 'Back to home', local: 'Account service is not configured here; browser-local features remain available.', pending: 'Awaiting administrator approval', approved: 'Approved', rejected: 'Request rejected', suspended: 'Account suspended', submitted: 'If this email can be registered, complete email verification, then sign in to see the approval status.', resent: 'If eligible, a new verification email has been sent.', invalid: 'Sign-in failed. Check your email, password or verification status.', signedIn: 'Signed in', unknown: 'Checking approval status' },
};

export default function PlatformLoginPage({ onNavigate, onLoginSuccess, authSession, loginPrompt }) {
  const { language } = usePlatformPreferences();
  const t = COPY[language] ?? COPY.zh;
  const [registering, setRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState(() => authCallbackMessage(window.location.hash));
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let live = true;
    if (!supabase || !authSession?.user?.id) return undefined;
    supabase.from('profiles').select('approval_status,is_admin').eq('id', authSession.user.id).maybeSingle()
      .then(({ data }) => { if (live) setProfile(data); })
      .catch(() => { if (live) setProfile(null); });
    return () => { live = false; };
  }, [authSession?.user?.id]);

  const redirectTo = () => new URL(routeHref('login', BASE), window.location.origin).toString();
  const submit = async event => {
    event.preventDefault();
    if (!supabase || working) return;
    setWorking(true); setMessage('');
    try {
      if (registering) {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: displayName.trim() }, emailRedirectTo: redirectTo() } });
        if (error) throw error;
        setMessage(t.submitted);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        onLoginSuccess?.();
      }
    } catch { setMessage(t.invalid); }
    finally { setPassword(''); setWorking(false); }
  };
  const resend = async () => {
    if (!email.trim() || !supabase) return;
    setWorking(true); setMessage('');
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: redirectTo() } });
      if (error) throw error;
      setMessage(t.resent);
    } catch { setMessage(t.invalid); }
    finally { setWorking(false); }
  };
  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setMessage(error.message);
    else setProfile(null);
  };
  const handleHome = event => {
    if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !onNavigate) return;
    event.preventDefault(); onNavigate('home');
  };

  return <div className="platform-login platform-page"><div className="platform-login__layout">
    <section className="platform-login__story" aria-labelledby="login-brand-title"><span className="platform-login__eyebrow"><Fingerprint aria-hidden="true" />{t.eyebrow}</span><h1 id="login-brand-title">FlavorInsight AI</h1><p className="platform-login__statement">{t.statement}</p><p className="platform-login__detail">{t.detail}</p><p className="platform-login__provenance"><ShieldCheck aria-hidden="true" />{t.provenance}</p></section>
    <section className="platform-login__card" aria-labelledby="login-access-title"><span className="platform-login__card-kicker"><LockKeyhole aria-hidden="true" />{t.label}</span><h2 id="login-access-title">{t.heading}</h2>
      {loginPrompt && <p className="platform-login__status" role="status">{loginPrompt === 'expired' ? language === 'zh' ? '登录会话已过期，请重新登录。原页面位置和安全参数已暂存。' : 'Your session expired. Sign in again; the internal page and safe parameters are saved.' : language === 'zh' ? '请登录以继续刚才的操作；登录后不会自动提交。' : 'Sign in to continue. Your action will not be submitted automatically.'}</p>}
      {!supabase ? <p className="platform-login__status" role="status">{t.local}</p> : authSession ? <div className="platform-login__account"><p role="status"><strong>{t.signedIn}</strong> · {authSession.user.email}</p><p>{profile ? t[profile.approval_status] || t.unknown : t.unknown}</p><div className="platform-login__actions"><button type="button" onClick={onLoginSuccess}>{t.continue}<ArrowRight aria-hidden="true" /></button><button type="button" onClick={signOut}>{t.signOut}</button></div></div> : <><form className="platform-login__form" onSubmit={submit}>
        {registering && <label>{t.name}<input value={displayName} onChange={event => setDisplayName(event.target.value)} autoComplete="name" maxLength={80} required /></label>}
        <label>{t.email}<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></label>
        <label>{t.password}<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={registering ? 'new-password' : 'current-password'} minLength={6} required /></label>
        <button type="submit" disabled={working}>{registering ? t.register : t.login}<ArrowRight aria-hidden="true" /></button>
      </form><div className="platform-login__actions"><button type="button" onClick={() => { setRegistering(value => !value); setMessage(''); }}>{registering ? t.switchLogin : t.switchRegister}</button><button type="button" onClick={resend} disabled={working || !email.trim()}>{t.resend}</button></div></>}
      {message && <p className="platform-login__status" role="status">{message}</p>}
      <a className="platform-login__continue" href={routeHref('home', BASE)} onClick={handleHome}>{t.home}<ArrowRight aria-hidden="true" /></a>
    </section>
  </div></div>;
}
