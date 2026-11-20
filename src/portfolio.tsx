import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowUpRight, Check, Copy, FlaskConical, Github, GraduationCap, Layers3, Mail, MapPin, Pencil, Send, X } from 'lucide-react';

export type Profile = { name: string; title: string; bio: string; location: string; email: string; github: string };
export const defaultProfile: Profile = {
  name: '王禹浩',
  title: '金融风险管理硕士 · 量化研究',
  bio: 'UCL 金融风险管理硕士，专注量化研究与机器学习。用 Python / R 构建模型，也在探索 RAG 与金融 Agent。',
  location: '中国',
  email: '2239429402@qq.com',
  github: '',
};

export function loadProfile(): Profile {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem('yu-world-profile') ?? 'null');
    if (stored && typeof stored === 'object' && Object.keys(defaultProfile).every(key => typeof (stored as Record<string, unknown>)[key] === 'string')) {
      const profile = stored as Profile;
      if (profile.name.trim() && profile.title.trim() && !(profile.name === '小屿' && profile.title === '设计师、创造者、终身玩家' && !profile.email)) {
        return { ...profile, github: validGithub(profile.github) ? profile.github : '' };
      }
    }
  } catch { /* The published profile is available even when browser storage is blocked. */ }
  return defaultProfile;
}

const validGithub = (value: string) => /^https:\/\/(www\.)?github\.com\/[\w.-]+\/?$/.test(value);

export function Panel({ title, label, children, close }: { title: string; label: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} className="panel" aria-labelledby="panel-title"
    onCancel={event => { event.preventDefault(); close(); }}
    onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <article className="panel-inner">
      <header className="panel-heading">
        <div><span className="pixel panel-label">{label}</span><h2 id="panel-title">{title}</h2></div>
        <button type="button" className="icon-button" aria-label="关闭" onClick={close}><X size={20} /></button>
      </header>
      {children}
    </article>
  </dialog>;
}

export function About({ profile, edit }: { profile: Profile; edit: () => void }) {
  return <>
    <p className="about-role">{profile.title}</p>
    <p className="panel-copy">{profile.bio}</p>
    {profile.location && <p className="about-location"><MapPin size={16} />{profile.location}</p>}
    <div className="about-details">
      <div><GraduationCap size={20} /><h3>教育背景</h3><p>伦敦大学学院金融风险管理硕士。</p></div>
      <div><FlaskConical size={19} /><h3>量化研究</h3><p>新华资产管理量化实习，开展基本面因子研究与回测。</p></div>
      <div><Layers3 size={18} /><h3>技术方向</h3><p>Python、R、PyTorch，以及 RAG 与金融 Agent。</p></div>
    </div>
    <button type="button" className="subtle-button" onClick={edit}><Pencil size={15} />编辑个人资料</button>
  </>;
}

export function Research() {
  return <div className="research-list">
    <article><span className="pixel">XINHUA AM / QUANT</span><h3>基本面因子研究</h3>
      <p>复现券商研报，清洗全市场财务数据，使用 OpenFE 与遗传规划挖掘、筛选并回测合成因子。</p>
      <div className="research-tags"><span>OpenFE</span><span>遗传规划</span><span>IC / RankIC</span></div>
    </article>
    <article><span className="pixel">UCL / MACHINE LEARNING</span><h3>集成 EWRLS</h3>
      <p>带领四人小组研究双重下降现象，用 Python 实现集成模型，将子模型分配至计算机集群并行运行。</p>
      <div className="research-tags"><span>Python</span><span>集成学习</span><span>Double Descent</span></div>
    </article>
  </div>;
}

export function Contact({ profile, edit }: { profile: Profile; edit: () => void }) {
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState('');
  const validEmail = /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(profile.email);
  const address = `mailto:${profile.email}`;
  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(profile.email);
      setFeedback('邮箱已复制');
    } catch {
      setFeedback('请选中邮箱地址进行复制。');
    }
  }
  return <>
    <p className="panel-copy">欢迎聊聊量化研究、机器学习和有趣的合作。</p>
    {validEmail ? <>
      <div className="email-line"><Mail size={17} /><a href={address}>{profile.email}</a><button type="button" className="icon-button" onClick={copyEmail} aria-label="复制邮箱"><Copy size={16} /></button></div>
      <p className="copy-feedback" role="status">{feedback}</p>
      <label className="form-label" htmlFor="message">留言</label>
      <textarea id="message" maxLength={2000} rows={4} placeholder="嗨，我从潮汐群岛路过……" value={message} onChange={event => setMessage(event.target.value)} />
      <a className="primary-button" href={`${address}?subject=${encodeURIComponent('来自潮汐群岛')}&body=${encodeURIComponent(message)}`}><Send size={16} />打开邮件草稿</a>
    </> : <button type="button" className="subtle-button" onClick={edit}><Pencil size={15} />设置邮箱</button>}
    {profile.github && <a className="subtle-button" href={profile.github} target="_blank" rel="noreferrer"><Github size={17} />GitHub <ArrowUpRight size={14} /></a>}
  </>;
}

export function ProfileForm({ profile, save }: { profile: Profile; save: (profile: Profile) => void }) {
  const [draft, setDraft] = useState(profile);
  const [error, setError] = useState('');
  const set = (key: keyof Profile, value: string) => setDraft(current => ({ ...current, [key]: value }));
  function submit(event: FormEvent) {
    event.preventDefault();
    const result = { ...draft, name: draft.name.trim(), title: draft.title.trim(), email: draft.email.trim(), github: draft.github.trim() };
    if (!result.name || !result.title) { setError('请填写昵称和身份。'); return; }
    if (result.github && !validGithub(result.github)) { setError('请输入完整的 GitHub 个人主页地址。'); return; }
    save(result);
  }
  return <form className="profile-form" onSubmit={submit}>
    <div className="form-pair"><label>昵称<input value={draft.name} onChange={e => set('name', e.target.value)} maxLength={12} required /></label>
    <label>所在地<input value={draft.location} onChange={e => set('location', e.target.value)} maxLength={30} /></label></div>
    <label>身份<input value={draft.title} onChange={e => set('title', e.target.value)} maxLength={45} required /></label>
    <label>关于我<textarea value={draft.bio} onChange={e => set('bio', e.target.value)} maxLength={180} rows={3} /></label>
    <label>邮箱<input type="email" value={draft.email} onChange={e => set('email', e.target.value)} maxLength={120} /></label>
    <label>GitHub<input type="url" value={draft.github} onChange={e => set('github', e.target.value)} maxLength={100} placeholder="https://github.com/username" /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="profile-form-actions"><span>保存在当前浏览器</span><button type="submit" className="primary-button"><Check size={17} />保存资料</button></div>
  </form>;
}
