import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Backpack, Check, ChevronDown, ChevronRight, Compass, Copy, ExternalLink, Flag, Heart, House, Leaf, Mail, MapPin, Maximize, Moon, MountainSnow, Pause, Pencil, Play, RotateCcw, Save, Send, Snowflake, Sparkles, Sun, Volume2, VolumeX, Waves, X } from 'lucide-react';
import { createGame, type GameControls } from './game';
import { drawTrainer, drawYixuan } from './art';
import { pokemonData, regionIds, regions, type Destination, type PokemonId, type RegionId, isPokemon } from './world';

type Profile = { name: string; title: string; bio: string; location: string; email: string; github: string };
type ModalType = Destination | 'yixuan' | 'edit' | 'backpack' | null;
const defaults: Profile = {
  name: '王禹浩', title: '金融风险管理硕士 · 量化研究', bio: 'UCL 金融风险管理硕士，专注量化研究与机器学习。用 Python / R 构建模型，也在探索 RAG 与金融 Agent。', location: '中国', email: '2239429402@qq.com', github: '',
};
const legacyDefaults: Profile = {
  name: '小屿', title: '设计师、创造者、终身玩家', bio: '在数字世界里，建造一些有趣的东西。\n保持好奇，也保持一点点孩子气。', location: '中国 · 杭州', email: '', github: '',
};
function readStored<T,>(key: string, fallback: T, validate: (value: unknown) => value is T): T {
  try {
    const raw = localStorage.getItem(key);
    const value: unknown = raw ? JSON.parse(raw) : fallback;
    return validate(value) ? value : fallback;
  } catch { return fallback; }
}
function useSaved<T,>(key: string, initial: T, validate: (value: unknown) => value is T) {
  const [value, setValue] = useState<T>(() => readStored(key, initial, validate));
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Browsing still works when storage is unavailable. */ } }, [key, value]);
  return [value, setValue] as const;
}

function TrainerAvatar({ className = '', size = 4, yixuan = false }: { className?: string; size?: number; yixuan?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) { ctx.clearRect(0, 0, 16 * size, 20 * size); if (yixuan) drawYixuan(ctx, 0, 0, size); else drawTrainer(ctx, 0, 0, size); }
  }, [size, yixuan]);
  return <canvas className={`trainer-sprite ${className}`} ref={ref} width={16 * size} height={20 * size} aria-label="戴红色帽子的像素训练家" role="img" />;
}

function IconButton({ label, children, onClick, className = '', pressed }: { label: string; children: ReactNode; onClick: () => void; className?: string; pressed?: boolean }) {
  return <button className={`icon-button ${className}`} onClick={onClick} title={label} aria-label={label} aria-pressed={pressed}>{children}</button>;
}

function Dialog({ title, eyebrow, children, onClose, wide = false }: { title: string; eyebrow: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const first = ref.current?.querySelector<HTMLElement>('button, input, a[href], textarea');
    first?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key === 'Tab') {
        const focusable = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, a[href], select') ?? []).filter(el => el.getClientRects().length > 0);
        const firstItem = focusable[0]; const lastItem = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === firstItem) { event.preventDefault(); lastItem?.focus(); }
        else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem?.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = bodyOverflow; document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [onClose]);
  return <div className="dialog-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={ref} className={`dialog ${wide ? 'dialog-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <header className="dialog-heading"><div><div className="eyebrow">{eyebrow}</div><h2 id="dialog-title">{title}</h2></div><IconButton label="关闭" onClick={onClose}><X size={21} /></IconButton></header>
      {children}
    </div>
  </div>;
}

function useMusic() {
  const [playing, setPlaying] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (!playing) return;
    const context = new AudioContext(); audio.current = context;
    void context.resume();
    const master = context.createGain(); master.gain.value = 0.035; master.connect(context.destination);
    const melody = [659, 0, 523, 587, 659, 784, 659, 0, 587, 0, 494, 523, 587, 659, 523, 0, 440, 523, 659, 784, 698, 659, 587, 0, 523, 587, 659, 523, 392, 440, 494, 587];
    let beat = 0;
    const note = () => {
      const freq = melody[beat % melody.length];
      if (freq) {
        const oscillator = context.createOscillator(); const envelope = context.createGain();
        oscillator.type = 'square'; oscillator.frequency.value = freq;
        envelope.gain.setValueAtTime(0, context.currentTime); envelope.gain.linearRampToValueAtTime(0.65, context.currentTime + 0.014); envelope.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.21);
        oscillator.connect(envelope); envelope.connect(master); oscillator.start(); oscillator.stop(context.currentTime + 0.23);
        oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
      }
      beat++;
    };
    note(); const timer = window.setInterval(note, 240);
    const handleVisibility = () => { if (document.hidden) void context.suspend(); else void context.resume(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', handleVisibility); void context.close(); audio.current = null; };
  }, [playing]);
  return [playing, () => setPlaying(v => !v)] as const;
}

const regionIcons = { twinleaf: House, verity: Waves, coronet: MountainSnow };
const badges = [
  { id: 'about', name: '初次见面', description: '到访训练家的小屋', icon: House },
  { id: 'projects', name: '湖畔记录员', description: '探访湖畔观测站', icon: Sparkles },
  { id: 'contact', name: '远方来信', description: '打开小镇邮箱', icon: Mail },
  { id: 'friend', name: '宝可梦之友', description: '认识一位宝可梦伙伴', icon: Heart },
];

function Projects() {
  const [active, setActive] = useState('notes');
  const projects = [
    { id: 'notes', num: '01', name: '基本面因子研究', caption: '复现券商研报，使用 OpenFE 与遗传规划挖掘合成因子。', tag: 'XINHUA AM · QUANT', icon: Pencil, label: 'OPENFE + GP', metric: 'IC · RankIC · ALPHA', note: '清洗全市场财务数据，完成因子筛选与回测。' },
    { id: 'focus', num: '02', name: '集成 EWRLS', caption: '带领四人小组研究双重下降现象，并用集成学习加速模型。', tag: 'UCL · MACHINE LEARNING', icon: Leaf, label: 'EWRLS ENSEMBLE', metric: 'DOUBLE DESCENT', note: 'Python 建模，分配子模型至计算机集群。' },
  ];
  return <>
    <p className="dialog-intro">量化研究、机器学习与数据建模项目。<span className="demo-label">PROJECT LOG</span></p>
    <div className="project-tabs" role="tablist" aria-label="简历项目">{projects.map(project => <button key={project.id} role="tab" aria-selected={active === project.id} onClick={() => setActive(project.id)} className={active === project.id ? 'active' : ''}><span>{project.num}</span>{project.name}<ArrowUpRight size={15} /></button>)}</div>
    {projects.filter(p => p.id === active).map(project => <div key={project.id} className="project-detail">
      <div className="project-preview" data-project={project.id}>
        <div className="research-preview"><span className="pixel">{project.label}</span><strong>{project.metric}</strong><p>{project.note}</p><div className="research-bars"><i /><i /><i /><i /><i /></div></div>
      </div>
      <div className="project-caption"><div><span className="eyebrow">{project.tag}</span><h3>{project.name}</h3><p>{project.caption}</p></div><project.icon size={26} strokeWidth={1.5} /></div>
    </div>)}
  </>;
}

export default function App() {
  const [profile, setProfile] = useSaved<Profile>('yu-world-profile', defaults, (value): value is Profile =>
    typeof value === 'object' && value !== null && Object.keys(defaults).every(key => typeof (value as Record<string, unknown>)[key] === 'string'));
  const [visited, setVisited] = useSaved<string[]>('yu-world-badges', [], (value): value is string[] =>
    Array.isArray(value) && new Set(value).size === value.length && value.every(id => badges.some(badge => badge.id === id)));
  const [partner, setPartner] = useSaved<PokemonId>('yu-world-partner', 'gible', isPokemon);
  const [night, setNight] = useSaved('yu-world-night', false, (value): value is boolean => typeof value === 'boolean');
  const [region, setRegion] = useState<RegionId>('twinleaf');
  const [modal, setModal] = useState<ModalType>(null);
  const [playing, toggleMusic] = useMusic();
  const [toast, setToast] = useState('');
  const [ready, setReady] = useState(false);
  const [dialogue, setDialogue] = useState(0);
  const [draft, setDraft] = useState(profile);
  const [contactMessage, setContactMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [mapMenu, setMapMenu] = useState(false);
  const gameContainer = useRef<HTMLDivElement>(null);
  const controls = useRef<GameControls | null>(null);
  const modalRef = useRef(modal); modalRef.current = modal;
  const showToast = useCallback((message: string) => setToast(message), []);
  const open = useCallback((destination: ModalType) => {
    setModal(destination);
    if (destination && destination !== 'edit' && destination !== 'backpack') {
      const badge = isPokemon(destination) ? 'friend' : destination;
      setVisited(current => current.includes(badge) ? current : [...current, badge]);
    }
  }, [setVisited]);
  const close = useCallback(() => setModal(null), []);
  const openRef = useRef(open); openRef.current = open;
  useEffect(() => {
    if (profile.name === legacyDefaults.name && profile.title === legacyDefaults.title && profile.bio === legacyDefaults.bio && profile.email === legacyDefaults.email) setProfile(defaults);
  }, [profile, setProfile]);
  useEffect(() => {
    if (!gameContainer.current) return;
    const game = createGame({ parent: gameContainer.current,
      onReady: api => {
        controls.current = api;
        setReady(true);
        api.setPaused(Boolean(modalRef.current));
        // Keep the map keyboard-ready as soon as the scene is available.
        requestAnimationFrame(() => { if (!modalRef.current) gameContainer.current?.focus({ preventScroll: true }); });
      },
      onInteract: destination => openRef.current(destination),
      onNpc: id => openRef.current(id),
      onWalk: () => setDialogue(value => (value + 1) % 3),
      onRegion: id => { setRegion(id); setDialogue(0); setMapMenu(false); },
    });
    return () => { controls.current = null; game.destroy(true); };
  }, []);
  useEffect(() => { controls.current?.setPaused(Boolean(modal)); }, [modal, ready]);
  useEffect(() => { controls.current?.setNight(night); }, [night, ready]);
  useEffect(() => { controls.current?.setPartner(partner); }, [partner, ready]);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 2800); return () => clearTimeout(timer); } }, [toast]);
  const dialogues = regions[region].dialogue;
  const selectedPokemon = modal && isPokemon(modal) ? pokemonData[modal] : null;
  const edit = () => { setDraft(profile); setFormError(''); open('edit'); };
  const saveProfile = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.title.trim()) { setFormError('请填写昵称和身份。'); return; }
    if (draft.github && !/^https:\/\/(www\.)?github\.com\/[\w.-]+\/?$/.test(draft.github)) { setFormError('请输入完整的 GitHub 个人主页地址。'); return; }
    setProfile({ ...draft, name: draft.name.trim(), title: draft.title.trim() }); close(); showToast('训练家资料已保存');
  };
  const copyEmail = async () => { try { await navigator.clipboard.writeText(profile.email); showToast('邮箱地址已复制'); } catch { showToast('复制失败，请手动选择邮箱地址'); } };
  const mailto = `mailto:${profile.email}?subject=${encodeURIComponent(`来自像素小镇的一封信`)}&body=${encodeURIComponent(contactMessage)}`;

  return <div className={`app ${night ? 'is-night' : ''}`}>
    <header className="topbar">
      <a className="brand" href="#" onClick={event => { event.preventDefault(); close(); }} aria-label="返回小镇"><span className="pokeball-mark" /><span>TRAINER'S LOG<span className="brand-edition">PERSONAL EDITION</span></span></a>
      <nav className="main-nav" aria-label="主导航"><button className={!modal ? 'active' : ''} onClick={close}><Compass size={16} />小镇</button><button className={modal === 'about' ? 'active' : ''} onClick={() => open('about')}><span className="nav-trainer"><TrainerAvatar size={1} /></span>训练家</button><button className={modal === 'backpack' ? 'active' : ''} onClick={() => open('backpack')}><Backpack size={16} />冒险背包<span className="nav-count">{visited.length}</span></button></nav>
      <div className="topbar-end"><span className="online-status"><i />冒险进行中</span><span className="top-divider" /><IconButton label={playing ? '关闭背景音乐' : '播放背景音乐'} pressed={playing} onClick={toggleMusic}>{playing ? <Volume2 size={18} /> : <VolumeX size={18} />}</IconButton><IconButton label={night ? '切换到白天' : '切换到夜晚'} pressed={night} onClick={() => setNight(value => !value)}>{night ? <Moon size={18} /> : <Sun size={18} />}</IconButton></div>
    </header>

    <main>
      <div className="world-heading"><div><div className="eyebrow"><span className="tiny-cross">+</span> A LITTLE WORLD, A LOT OF ME</div><h1>YU'S WORLD<span className="title-dot">.</span><span className="title-spark">✦</span></h1></div><div className="world-heading-note"><span>生活是一场开放世界的冒险。</span><span className="pixel">MAKE GOOD THINGS. STAY CURIOUS.</span></div></div>

      <div className="world-layout">
        <aside className="profile-sidebar">
          <div className="sidebar-heading"><span className="eyebrow">TRAINER PROFILE</span><IconButton label="编辑个人资料" onClick={edit}><Pencil size={14} /></IconButton></div>
          <div className="portrait-scene"><div className="portrait-grid" /><div className="portrait-sun" /><div className="portrait-grass grass-one" /><div className="portrait-grass grass-two" /><TrainerAvatar size={4} /><img className="portrait-partner" src={pokemonData[partner].asset} alt={pokemonData[partner].name} /><div className="portrait-ground" /><span className="trainer-number pixel">NO. {pokemonData[partner].number}</span><span className="portrait-level pixel">LV. 24</span></div>
          <div className="profile-intro"><span className="mini-label">PLAYER 01</span><h2>嗨，我是{profile.name}<span className="greeting-dot">.</span></h2><p className="profile-role">{profile.title}</p><p className="profile-bio">{profile.bio}</p><div className="location"><MapPin size={13} />{profile.location || '世界的某个角落'}<span className="small-diamond" /><span>保持探索中</span></div></div>
          <div className="skill-tags"><span><i className="red" />QUANT RESEARCH</span><span><i className="green" />MACHINE LEARNING</span><span><i className="yellow" />PYTHON + R</span></div>
          <div className="party-section"><div className="section-label"><span>我的冒险搭档</span><span className="pixel">SINNOH PARTY</span></div><div className="party-list">{(['gible', 'riolu', 'piplup'] as const).map((id, index) => <button key={id} onClick={() => open(id)} aria-label={`查看${pokemonData[id].name}`} className={`party-member ${partner === id ? 'partner-active' : ''}`}><img src={pokemonData[id].asset} alt="" /><span>{pokemonData[id].name}</span><div className="pokemon-hp"><i style={{ width: `${100 - index * 8}%` }} /></div>{partner === id && <span className="partner-dot" />}</button>)}</div></div>
          <button className="contact-button" onClick={() => controls.current?.travel('contact')}><Mail size={16} /><span>来打个招呼</span><ArrowUpRight size={17} /></button>
          <span className="sidebar-footer"><span className="pixel">SAVE FILE 001</span><span><span className="save-dot" />已自动存档</span></span>
        </aside>

        <section className="world-area" aria-label="互动神奥地图" data-region={region}>
          <div className="region-navigation" role="group" aria-label="神奥地区">
            {regionIds.map(id => {
              const RegionIcon = regionIcons[id];
              return <button key={id} className="region-tab" aria-pressed={region === id} disabled={!ready} onClick={() => controls.current?.changeRegion(id)}><RegionIcon size={17} /><span>{regions[id].name}<small className="pixel">{regions[id].english}</small></span><span className="region-number pixel">{regions[id].number}</span></button>;
            })}
          </div>
          <div className="map-toolbar"><div className="map-title"><MapPin size={16} /><strong>{regions[region].name}</strong><span className="map-title-divider">/</span><span>{regions[region].subtitle}</span></div><div className="map-weather">{region === 'coronet' ? <Snowflake size={15} /> : night ? <Moon size={14} /> : <Sun size={15} />}<span>{region === 'coronet' ? '飘雪 · −4°C' : night ? '晴夜 · 12°C' : region === 'verity' ? '微风 · 16°C' : '晴朗 · 18°C'}</span><span className="pixel">{night ? '21:08' : '08:12'}</span></div></div>
          <div className="map-shell">
            <div className="game-canvas" ref={gameContainer} role="application" tabIndex={0} aria-label="宝可梦像素小镇，方向键或 WASD 移动，点击地图寻路，E 或空格互动" />
            {!ready && <div className="map-loading"><span className="pokeball-mark" /><span className="pixel">LOADING YOUR WORLD...</span></div>}
            <div className="map-corner-label"><i /><span className="pixel">{regions[region].english}</span></div>
            <div className="map-tools"><IconButton label="缩放地图" onClick={() => controls.current?.zoom()}><Maximize size={16} /></IconButton></div>
          <div className="map-travel"><button className="map-travel-toggle" aria-expanded={mapMenu} onClick={() => setMapMenu(value => !value)}><Compass size={15} /><span>目的地</span><ChevronDown size={13} /></button>{mapMenu && <div className="travel-menu">{[['about', '我的小屋'], ['projects', '湖畔观测站'], ['contact', '山顶信号站']] .map(([id, label]) => <button key={id} onClick={() => { controls.current?.travel(id as Destination); setMapMenu(false); }}>{label}<ArrowRight size={13} /></button>)}</div>}</div>
          </div>
          <div className="dialogue-box"><div className="dialogue-avatar"><TrainerAvatar size={2} /></div><div className="dialogue-copy"><span>{profile.name}<span className="dialogue-role">神奥训练家</span></span><p>{dialogues[dialogue]}</p></div><IconButton label="下一句对话" onClick={() => setDialogue(value => (value + 1) % dialogues.length)}><ChevronRight size={20} /></IconButton></div>
          <div className="world-status"><div className="world-location"><span className="pixel">{regions[region].number}</span><span>神奥地区</span><ChevronRight size={11} /><strong>{regions[region].name}</strong></div><div className="world-exploration"><span>探索进度</span><div className="exploration-segments">{badges.map(badge => <i key={badge.id} className={visited.includes(badge.id) ? 'filled' : ''} />)}</div><span className="pixel">{visited.length}/4</span></div></div>
          <div className="mobile-controls" aria-label="移动控制"><div className="dpad"><IconButton label="向上移动" onClick={() => controls.current?.move('up')} className="dpad-up"><ArrowUp size={20} /></IconButton><IconButton label="向左移动" onClick={() => controls.current?.move('left')} className="dpad-left"><ArrowLeft size={20} /></IconButton><span /><IconButton label="向右移动" onClick={() => controls.current?.move('right')} className="dpad-right"><ArrowRight size={20} /></IconButton><IconButton label="向下移动" onClick={() => controls.current?.move('down')} className="dpad-down"><ArrowDown size={20} /></IconButton></div><button className="action-control" onClick={() => controls.current?.interact()} aria-label="与附近的人物或建筑互动">A</button></div>
        </section>
      </div>

      <section className="destinations" aria-label="小镇目的地"><div className="destination-intro"><Flag size={17} /><div><span>每一站，都有新发现</span><span className="pixel">THE ADVENTURE IS YOURS.</span></div></div>{[{ id: 'about', number: '01', name: '我的小屋', detail: '关于我和我的故事', icon: House }, { id: 'projects', number: '02', name: '湖畔观测站', detail: '记录研究与实验的现场', icon: Sparkles }, { id: 'contact', number: '03', name: '山顶信号站', detail: '让新的故事从这里开始', icon: Mail }].map(place => <button key={place.id} className={`destination destination-${place.id}`} onClick={() => controls.current?.travel(place.id as Destination)} disabled={!ready}><span className="destination-icon"><place.icon size={22} strokeWidth={1.5} /></span><span className="destination-text"><span><small className="pixel">{place.number}</small>{place.name}{visited.includes(place.id) && <Check size={12} />}</span><span>{place.detail}</span></span><ArrowUpRight size={17} /></button>)}</section>
      <footer className="page-footer"><span>用热爱建造，用好奇心探索。<Heart size={11} /></span><span className="pixel">© 2026 YU'S WORLD <span>·</span> CONTINUE THE ADVENTURE <ArrowUpRight size={12} /></span></footer>
    </main>

    {modal === 'about' && <Dialog title={`很高兴认识你，我是${profile.name}。`} eyebrow="01 / THE TRAINER'S HOME" onClose={close}>
      <div className="about-portrait"><TrainerAvatar size={5} /><img src={pokemonData[partner].asset} alt={pokemonData[partner].name} /><span className="pixel">SINNOH ROUTE 201.<br />KEEP EXPLORING.</span></div>
      <div className="about-body"><p className="about-title">{profile.title}</p><p className="preline">{profile.bio}</p><div className="about-location"><MapPin size={15} />{profile.location || '世界的某个角落'}</div><div className="about-skills"><div><span className="pixel">01</span><h3>教育背景</h3><p>伦敦大学学院金融风险管理硕士。</p></div><div><span className="pixel">02</span><h3>量化研究</h3><p>新华资产管理量化实习，完成因子研究与回测。</p></div><div><span className="pixel">03</span><h3>技术栈</h3><p>Python、R、PyTorch，以及 RAG 与金融 Agent。</p></div></div><button className="secondary-button" onClick={edit}><Pencil size={15} />编辑训练家资料</button></div>
    </Dialog>}
    {modal === 'projects' && <Dialog title="湖畔观测站" eyebrow="02 / LAKE VERITY FIELD STATION" onClose={close} wide><Projects /></Dialog>}
    {modal === 'contact' && <Dialog title="给小镇寄一封信" eyebrow="03 / YOU'VE GOT A FRIEND" onClose={close}>
      <div className="mail-illustration"><Mail size={54} strokeWidth={1} /><span className="pixel">HELLO, NEW FRIEND.</span></div><p className="dialog-intro">关于有趣的想法、合作，或者只是说声你好。</p>
      {profile.email ? <><div className="email-row"><Mail size={16} /><a href={`mailto:${profile.email}`}>{profile.email}</a><IconButton label="复制邮箱" onClick={copyEmail}><Copy size={15} /></IconButton></div><label className="field-label" htmlFor="contact-message">想对我说的话</label><textarea id="contact-message" className="message-input" value={contactMessage} onChange={e => setContactMessage(e.target.value)} placeholder="嗨，我在你的像素小镇里逛了逛……" maxLength={2000} /><a className="primary-button full-width" href={mailto}><Send size={15} />打开邮件草稿<ExternalLink size={14} /></a></> : <div className="contact-empty"><p>小镇的邮箱地址还没有设置。</p><button className="primary-button" onClick={edit}><Pencil size={15} />设置联系方式</button></div>}
      {profile.github && <a className="github-link" href={profile.github} target="_blank" rel="noreferrer">GITHUB<span>{profile.github.split('/').filter(Boolean).pop()}</span><ArrowUpRight size={15} /></a>}
    </Dialog>}
    {modal === 'edit' && <Dialog title="训练家资料" eyebrow="EDIT YOUR SAVE FILE" onClose={close}>
      <form onSubmit={saveProfile} className="profile-form"><div className="form-pair"><label>昵称<input value={draft.name} maxLength={12} required onChange={e => setDraft({ ...draft, name: e.target.value })} /></label><label>所在地<input value={draft.location} maxLength={30} onChange={e => setDraft({ ...draft, location: e.target.value })} /></label></div><label>身份<input value={draft.title} required maxLength={45} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label><label>关于我<textarea value={draft.bio} maxLength={180} rows={3} onChange={e => setDraft({ ...draft, bio: e.target.value })} /></label><label>邮箱<input type="email" value={draft.email} maxLength={120} placeholder="hello@example.com" onChange={e => setDraft({ ...draft, email: e.target.value })} /></label><label>GitHub<input type="url" value={draft.github} maxLength={100} placeholder="https://github.com/username" onChange={e => setDraft({ ...draft, github: e.target.value })} /></label>{formError && <p role="alert" className="form-error">{formError}</p>}<div className="form-actions"><span><Save size={12} />保存在当前浏览器</span><button className="primary-button" type="submit"><Check size={16} />保存资料</button></div></form>
    </Dialog>}
    {modal === 'backpack' && <Dialog title="我的冒险背包" eyebrow="LITTLE MOMENTS, BIG MEMORIES" onClose={close}>
      <div className="backpack-summary"><Backpack size={34} strokeWidth={1.3} /><div><span className="pixel">{visited.length} / 4</span><p>枚小镇纪念徽章</p></div><span className="completion-label">{visited.length === 4 ? '小镇探索完成' : '冒险仍在继续'}</span></div><div className="badge-list">{badges.map(badge => <div key={badge.id} className={`badge-item ${visited.includes(badge.id) ? 'unlocked' : ''}`}><div className="badge-icon"><badge.icon size={25} strokeWidth={1.5} /></div><div><h3>{badge.name}</h3><p>{badge.description}</p></div>{visited.includes(badge.id) ? <Check size={17} /> : <span className="pixel">???</span>}</div>)}</div>
    </Dialog>}
    {modal === 'yixuan' && <Dialog title="韩怡萱" eyebrow="YU'S GIRLFRIEND · SINNOH ADVENTURE" onClose={close}>
      <div className="npc-card"><div className="npc-card-art"><TrainerAvatar size={3} yixuan /><img src={`${import.meta.env.BASE_URL}assets/sylveon.png`} alt="仙子伊布" /></div><p className="dialog-intro">这是我的女朋友韩怡萱。她和仙子伊布一起住在双叶镇，等着和你一起开始神奥地区的冒险。</p><div className="npc-card-meta"><span className="pixel">MY FAVORITE TRAINER.</span><span>韩怡萱 · 仙子伊布同行</span></div></div>
    </Dialog>}
    {selectedPokemon && <Dialog title={selectedPokemon.name} eyebrow={`POKÉDEX / NO. ${selectedPokemon.number}`} onClose={close}>
      <div className="pokemon-detail" style={{ '--pokemon-color': selectedPokemon.color } as React.CSSProperties}><span className="pokemon-number pixel">#{selectedPokemon.number}</span><img src={selectedPokemon.asset} alt={selectedPokemon.name} /><div><span className="pixel">{selectedPokemon.english}</span><span className="pokemon-type">{selectedPokemon.type}</span></div></div><p className="pokemon-habitat"><MapPin size={14} />{selectedPokemon.habitat}</p><h3 className="pokemon-personality">{selectedPokemon.personality}</h3><p className="pokemon-description">{selectedPokemon.description}</p><div className="pokemon-skills">{selectedPokemon.skills.map((skill, index) => <span key={skill}><small className="pixel">0{index + 1}</small>{skill}</span>)}</div><button className="primary-button full-width" disabled={partner === modal} onClick={() => { setPartner(modal as PokemonId); showToast(`${selectedPokemon.name}成为了你的同行伙伴`); }}>{partner === modal ? <Check size={16} /> : <Heart size={16} />}{partner === modal ? '正在一起冒险' : '选择为同行伙伴'}</button>
    </Dialog>}
    {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
  </div>;
}
