import { PalaceSection } from './palace-section';
import { RampartAtlas } from './rampart-atlas';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Backpack, BookMarked, BookOpen, Castle, Check, Compass, Crosshair, DoorOpen, Flag, Github, Heart, House, Mail, Map, MapPin, Maximize, Minimize, Moon, Orbit, Plus, Radio, Sun, Volume2, VolumeX, Waves, Zap } from 'lucide-react';
import { createField, fieldAreas, type Direction, type EncounterKind, type FieldArea, type FieldEvent } from './field';
import { BattleOverlay, type BattleEncounter, type BattleResult } from './battle';
import { beginCheckpoint, type BattleCheckpoint } from './battle-checkpoint';
import type { BattleState } from './battle-turn';
import { CreatureSprite } from './creature-art';
import { creatures, givePotion, healTeam, maxHp, potionHp, type CreatureId } from './creatures';
import { addSeen, areas, chooseEncounter, deepestVisited, recordCourt, saveKey, type AdventureSave } from './adventure';
import { areaIcons, HpBar, Pokedex, RouteAtlas, TeamPanel } from './adventure-menu';
import { fortressLiftStops, fortressPier, fortressRooms, openFortress, sleepingFortress, type RoarPhase } from './field-fortress-state';
import { rooms } from './field-rooms';
import { isMazeRoom, mazeFloors, type MazePoint } from './fortress-maze';
import { MazeAtlas, MazeMinimap } from './maze-atlas';
import { quietReading, type WardReading } from './fortress-ward-service';
import { GridMonitor } from './fortress-power-monitor';
import { WardMonitor } from './ward-monitor';
import { recordMazeStep } from './fortress-survey';
import { cityDistrict } from './field-city-layout';
import { courtNotes, surveyStops, type CityStop, type CityStopId, type SurveyId } from './field-city-walks';
import { wallSection, wallPoint } from './fortress-wall-walk';
import { FieldDialogue } from './field-dialogue';
import { FieldEncounterTransition } from './field-encounter-transition';
import { About, Contact, Panel, ProfileForm, Research, loadProfile, type Profile } from './portfolio';
import { useSound } from './sound';
import { readSession, writeSession, type SaveSession, type SaveStatus } from './save-store';
import { SavePanel } from './save-panel';
import { FortressLog } from './fortress-log';

type PanelId = 'about' | 'projects' | 'contact' | 'edit' | 'map' | 'pack' | 'dex' | 'maze' | 'storage' | 'fortress-log' | 'palace-section';
type Encounter = BattleEncounter & { area: FieldArea; firstPractice?: boolean };
type Dialogue = { speaker: string; lines: string[]; index: number; choice?: { label: string; accept: () => void } };

const places = [
  { id: 'about', name: '关于我', place: '潮汐环城 · 潮汐档案屋', copy: '学习经历、量化研究方向与技术栈。', icon: House },
  { id: 'projects', name: '研究档案', place: '潮汐环城 · 市集研究室', copy: '基本面因子研究与集成 EWRLS 项目。', icon: BookOpen },
  { id: 'contact', name: '联系我', place: '潮汐环城 · 车站信号室', copy: '聊聊研究、机器学习和合作。', icon: Radio },
] as const;

const directions = {
  up: { name: '向上移动', icon: ArrowUp },
  left: { name: '向左移动', icon: ArrowLeft },
  down: { name: '向下移动', icon: ArrowDown },
  right: { name: '向右移动', icon: ArrowRight },
};

function loadNight() {
  try { return localStorage.getItem('yu-world-night') === 'true'; }
  catch { return false; }
}

export default function App() {
  const [session, setSession] = useState(readSession);
  const [version, setVersion] = useState(0);
  const [previous, setPrevious] = useState<AdventureSave | null>(null);
  const [message, setMessage] = useState('');
  function resume(next: SaveSession, before: AdventureSave) {
    setPrevious(before);
    setSession(next);
    setVersion(generation => generation + 1);
  }
  return <Expedition key={version} session={session} resume={resume} previous={previous} message={message} setMessage={setMessage}/>;
}

function Expedition({ session, resume, previous: previousSave, message, setMessage }: {
  session: SaveSession; resume: (next: SaveSession, before: AdventureSave) => void;
  previous: AdventureSave | null; message: string; setMessage: (message: string) => void;
}) {
  const [save, setSave] = useState(session.initial);
  const [fortress, setFortress] = useState(save.fortressOpened ? openFortress : sleepingFortress);
  const [liftMoving, setLiftMoving] = useState(false);
  const [roarPhase, setRoarPhase] = useState<RoarPhase>('quiet');
  const [cryPlayback, setCryPlayback] = useState<'idle' | 'loading' | 'playing' | 'unavailable'>('idle');
  const cryAttempt = useRef(0);
  const [inspectingSeal, setInspectingSeal] = useState(false);
  const [wardReading, setWardReading] = useState<WardReading>(quietReading);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(session.status);
  const commit = useCallback((next: AdventureSave) => setSaveStatus(writeSession(session, next)), [session]);
  const [profile, setProfile] = useState(loadProfile);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [parents, setParents] = useState<{ panel: PanelId; opener?: string }[]>([]);
  const outerOpener = useRef<HTMLElement | null>(null);
  const [packSelection, setPackSelection] = useState(save.battle.lead);
  const [encounter, setEncounter] = useState<Encounter | null>(() => save.pendingBattle
    ? { ...save.pendingBattle.encounter, firstPractice: Boolean(save.pendingBattle.encounter.trainer) && !save.sparWon } : null);
  const [shownBattle, setShownBattle] = useState<BattleState | undefined>(save.pendingBattle?.state);
  const [enteringBattle, setEnteringBattle] = useState(false);
  const [dialogue, setDialogue] = useState<Dialogue | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [overview, setOverview] = useState(false);
  const [night, setNight] = useState(loadNight);
  const [running, setRunning] = useState(false);
  const [arrival, setArrival] = useState<{ key: string; name: string; english: string } | null>(null);
  const [dexEntry, setDexEntry] = useState<CreatureId | 'kyurem'>();
  const [atlasStop, setAtlasStop] = useState<CityStopId>();
  const [hint, setHint] = useState('');
  const [ready, setReady] = useState(false);
  const canvas = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLElement>(null);
  const dialogueButton = useRef<HTMLButtonElement>(null);
  const controller = useRef<ReturnType<typeof createField> | null>(null);
  const directionPointer = useRef<number | null>(null);
  const current = useRef(save);
  current.current = save;
  const activeEncounter = useRef(encounter);
  activeEncounter.current = encounter;
  const visitedScene = useRef(save.location.fortressRoom ?? save.location.room ?? (save.location.wallPassage ? 'rampart' : save.location.area));
  const nightNow = useRef(night);
  nightNow.current = night;
  const locked = useRef(false);
  const area = encounter?.area ?? save.location.area;
  const room = !encounter && save.location.room ? rooms[save.location.room] : undefined;
  const floor = !encounter ? save.location.fortressRoom : undefined;
  const wall = !encounter && save.location.wallPassage === true;
  const maze = isMazeRoom(floor) ? floor : undefined;
  const fieldMapPanel = maze ? 'maze' : floor ? 'palace-section' : 'map';
  const mapTitle = wall ? '外壁长阶剖面图' : floor ? '地宫纵剖图' : '环城地图';
  const plan = maze ? mazeFloors[maze] : undefined;
  const near = (point: MazePoint) => Math.abs(save.location.x - point.x) + Math.abs(save.location.y - point.y) <= 1;
  const liftAvailable = (floor === 'sluice' || floor === 'catacomb') && near(fortressLiftStops[floor]);
  const shortcutOpen = Boolean(maze && save.shortcuts.includes(maze));
  const mazeAction = plan && (near(plan.down) ? '沿阶梯下行' : !shortcutOpen && near(plan.switch) ? '操作' + plan.switchName : undefined);
  const returnLabel = floor === 'seal' ? '返回陵宫' : floor === 'catacomb' ? '返回长庭' : floor === 'aqueduct' ? '返回水殿' : '返回下层王门';
  const interior = Boolean(floor || room || wall);
  const atPier = !interior && area === 'harbor' && Math.abs(save.location.x - fortressPier.x) + Math.abs(save.location.y - fortressPier.y) <= 1;
  const readPower = useCallback(() => controller.current?.powerReading(), []);
  const sound = useSound(encounter ? (encounter.trial || encounter.trainer ? 'trial' : 'wild') : floor === 'seal' ? 'sanctum' : floor ? 'fortress' : room ? 'interior' : area, floor, readPower);
  const scene = wall ? { name: wallSection(save.location.y), english:'WEST RAMPART' } : floor ? fortressRooms[floor] : room ?? fieldAreas[area];
  const AreaIcon = floor || wall ? Castle : room ? House : areaIcons[area];
  const overviewLabel = maze ? (overview ? '返回仪道' : '俯瞰宫殿') : overview ? '返回街道' : fortress.phase === 'open' ? '环看海宫' : '俯瞰环城';
  const areaNumber = String(areas.indexOf(area) + 1).padStart(2, '0');
  const activeBattle = encounter ? shownBattle : undefined;
  const progress = activeBattle?.progress ?? save.battle;
  const lead = progress.team.find(member => member.id === (activeBattle?.active ?? progress.lead)) ?? progress.team[0];
  const leadInfo = creatures[lead.id];
  const paused = Boolean(panel || encounter || dialogue);
  const focusField = useCallback(() => requestAnimationFrame(() => canvas.current?.focus({ preventScroll: true })), []);

  const showDialogue = useCallback((speaker: string, lines: string[], choice?: Dialogue['choice']) => {
    locked.current = true;
    controller.current?.setPaused(true);
    setDialogue({ speaker, lines, choice, index: 0 });
  }, []);
  const say = useCallback((speaker: string, ...lines: string[]) => showDialogue(speaker, lines), [showDialogue]);

  function nextLine() {
    if (!dialogue) return;
    sound.play('interact');
    if (dialogue.index + 1 < dialogue.lines.length) setDialogue({ ...dialogue, index: dialogue.index + 1 });
    else {
      setDialogue(null);
      if (dialogue.choice) dialogue.choice.accept();
      else focusField();
    }
  }

  const startEncounter = useCallback((next: Encounter) => {
    locked.current = true;
    controller.current?.setPaused(true);
    setSave(previous => ({ ...addSeen(previous, next.creature), pendingBattle: beginCheckpoint(next, previous.battle) }));
    setShownBattle(undefined);
    setEnteringBattle(!matchMedia('(prefers-reduced-motion: reduce)').matches);
    setEncounter(next);
  }, []);

  const offerBattle = useCallback((speaker: string, line: string, label: string, next: Encounter) => {
    showDialogue(speaker, [line], {
      label,
      accept: () => { sound.play('encounter'); startEncounter(next); },
    });
  }, [showDialogue, sound.play, startEncounter]);

  const openFromField = useCallback((event: FieldEvent) => {
    if (locked.current) return;
    if (event === 'guide') {
      setSave(previous => ({ ...previous, greeted: true }));
      const captureTip = current.current.battle.lead === 'piplup'
        ? '遇到姆克儿，可以先让波加曼用拍击削弱它，再投出精灵球。'
        : '先用威力较低的招式削弱野生宝可梦，再投出精灵球。';
      say('韩怡萱', '仙子伊布和我在这儿等你。外环绿廊的高草里能遇到姆克儿和小猫怪，绿廊北侧有位陪练，东渡口还有一位守望员。',
        `${captureTip}伙伴累了，就到环城大道的补给站休息。`);
    } else if (event === 'healer') {
      setSave(previous => ({ ...previous, battle: healTeam(previous.battle) }));
      say('补给员', '宝可梦的体力和招式 PP 已恢复，伤药和精灵球也补上了。一路顺风！');
    } else if (event === 'spar') {
      offerBattle('绿廊陪练', '我和利欧路在这儿练习招式。要不要打一场？第一次赢下切磋后，我会帮你的队伍休整。', '开始切磋',
        { creature: 'riolu', level: 4, trainer: '绿廊陪练', area: 'harbor', firstPractice: !current.current.sparWon });
    } else if (event === 'trial') {
      if (current.current.battle.trialWon) {
        say('东渡口守望员', '你通过了东渡口的试炼。信号灯已经点亮，随时欢迎你再回来。');
      } else if (current.current.battle.team.length < 2) {
        say('东渡口守望员', '来参加试炼吗？先在草丛里捕捉一只宝可梦，带两位伙伴来见我。');
      } else {
        offerBattle('东渡口守望员', '圆陆鲨是龙和地面双属性，特别怕冰。准备好了，就来挑战我们吧。', '开始试炼',
          { creature: 'gible', level: 6, trial: true, area: 'harbor' });
      }
    } else {
      locked.current = true;
      controller.current?.setPaused(true);
      setParents([]);
      outerOpener.current = canvas.current;
      setPanel(event);
    }
  }, [offerBattle, say]);

  const encounterIn = useCallback((nextArea: FieldArea, kind: EncounterKind) => {
    if (locked.current) return;
    const adventure = current.current;
    const progress = adventure.battle;
    if (progress.team.every(member => member.hp === 0)) {
      say('体力不足', '伙伴们需要休息。回潮汐环城的补给站恢复体力。');
      return;
    }
    const firstPartner = progress.team.length === 1 && adventure.seen.length === 1 ? progress.lead : undefined;
    sound.play('encounter');
    startEncounter(chooseEncounter(nextArea, firstPartner, nightNow.current, kind));
  }, [say, sound.play, startEncounter]);

  const inspectCourt = useCallback((id: SurveyId) => {
    if (locked.current) return;
    const note = courtNotes[id];
    const visited = current.current.courtVisits;
    const first = !visited.includes(id);
    if (first) setSave(previous => recordCourt(previous, id));
    setAtlasStop(previous => previous === id ? undefined : previous);
    const finish = first && visited.length + 1 === surveyStops.length;
    const clock = id === 'station' ? `钟面指向 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}。` : '';
    const reward = finish ? ' 四处院落已全部记入手记，背包里添了两份伤药。' : '';
    say(note.subject, `${clock}${note.note}${reward}`);
  }, [say]);

  useEffect(() => {
    if (!canvas.current) return;
    const field = createField({
      parent: canvas.current, initial: current.current.location, guideMet: current.current.greeted,
      fortressOpened: current.current.fortressOpened,
      fortressStartedAt: current.current.fortressStartedAt,
      tideDialAwake: current.current.tideDialAwake,
      gridLimited: current.current.gridLimited, onGridLoad: limited => setSave(previous => ({ ...previous, gridLimited: limited || undefined })),
      shortcuts: current.current.shortcuts, onLiftTravel: setLiftMoving,
      ward: current.current.ward, onWardReading: setWardReading,
      onWardChanged: ward => setSave(previous => ({ ...previous, ward })),
      onCryStop: () => { ++cryAttempt.current; sound.stopCry(); setCryPlayback('idle'); },
      onRoarPhase: phase => {
        setRoarPhase(phase);
        if (phase === 'quiet') setCryPlayback(state => state === 'playing' ? 'idle' : state);
      },
      onShortcut: room => setSave(previous => previous.shortcuts.includes(room) ? previous : { ...previous, shortcuts: [...previous.shortcuts, room] }),
      onDialAwake: () => setSave(previous => ({ ...previous, tideDialAwake: true })),
      onFortressSave: started => setSave(previous => {
        if (started === null) return { ...previous, fortressOpened: true, fortressStartedAt: undefined };
        return previous.fortressOpened ? previous : { ...previous, fortressStartedAt: started };
      }),
      onFortressView: (view, inspecting) => {
        setFortress(view);
        setInspectingSeal(inspecting);
        if (inspecting) setSave(previous => previous.kyuremObserved ? previous : { ...previous, kyuremObserved: true });
      },
      onReady: () => setReady(true),
      onOverview: setOverview,
      onLocation: location => {
        const key = location.fortressRoom ?? location.room ?? (location.wallPassage ? 'rampart' : location.area);
        if (visitedScene.current !== key) {
          visitedScene.current = key;
          const destination = location.wallPassage ? { name:'西栈桥外壁长阶', english:'WEST RAMPART' } : location.fortressRoom ? fortressRooms[location.fortressRoom] : location.room ? rooms[location.room] : fieldAreas[location.area];
          setArrival({ key, name: destination.name, english: destination.english });
        }
        setSave(previous => ({
          ...previous, location,
          deepestFloor: location.fortressRoom ? deepestVisited(previous.deepestFloor, location.fortressRoom) : previous.deepestFloor,
          mazeTrail: recordMazeStep(previous.mazeTrail, location), visited: previous.visited.includes(location.area) ? previous.visited : [...previous.visited, location.area],
        }));
      },
      onHint: setHint,
      onEvent: openFromField,
      onEncounter: encounterIn,
      onSurvey: inspectCourt,
      onSound: (cue, surface) => { if (cue !== 'encounter') sound.play(cue, surface); },
    });
    controller.current = field;
    field.setCompanion(current.current.battle.lead);
    field.setBeaconLit(current.current.battle.trialWon);
    field.setNight(nightNow.current);
    const frame = requestAnimationFrame(() => {
      if (!locked.current && document.activeElement === document.body && matchMedia('(pointer: fine)').matches) {
        canvas.current?.focus({ preventScroll: true });
      }
    });
    return () => { cancelAnimationFrame(frame); field.destroy(); controller.current = null; };
  }, [encounterIn, inspectCourt, openFromField, sound.play, sound.stopCry]);

  useEffect(() => {
    locked.current = paused;
    if (paused) directionPointer.current = null;
    controller.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => { controller.current?.setCompanion(save.battle.lead); }, [save.battle.lead]);
  useEffect(() => { controller.current?.setBeaconLit(progress.trialWon); }, [progress.trialWon]);
  useEffect(() => { controller.current?.setRunning(running); }, [running]);
  useEffect(() => { controller.current?.setCovered(Boolean(encounter) && !enteringBattle); }, [encounter, enteringBattle]);

  useEffect(() => {
    if (!arrival) return;
    const timer = window.setTimeout(() => setArrival(null), 1800);
    return () => window.clearTimeout(timer);
  }, [arrival]);

  useEffect(() => {
    controller.current?.setNight(night);
    try { localStorage.setItem('yu-world-night', String(night)); }
    catch { /* The display changes even when storage is unavailable. */ }
  }, [night]);

  useEffect(() => { commit(save); }, [commit, save]);

  useEffect(() => {
    function observeStorage(event: StorageEvent) {
      if (event.key !== saveKey && event.key !== null) return;
      try {
        if (localStorage.getItem(saveKey) !== session.baseline) {
          session.status = 'conflict';
          setSaveStatus('conflict');
        }
      } catch { setSaveStatus('unavailable'); }
    }
    window.addEventListener('storage', observeStorage);
    return () => window.removeEventListener('storage', observeStorage);
  }, [session]);

  useEffect(() => {
    if (!expanded) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function expandedKeys(event: KeyboardEvent) {
      const container = frame.current;
      if (!container || event.defaultPrevented || document.querySelector('dialog[open]')) return;
      if (event.key === 'Escape') {
        setExpanded(false);
        if (!locked.current) focusField();
      } else if (event.key === 'Tab') {
        const controls = Array.from(container.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]'))
          .filter(control => control.getClientRects().length > 0 && !control.closest('[inert]'));
        if (!controls.length) return;
        const index = controls.findIndex(control => control === document.activeElement);
        const next = index < 0 ? (event.shiftKey ? controls.length - 1 : 0)
          : (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
        event.preventDefault();
        controls[next].focus();
      }
    }
    window.addEventListener('keydown', expandedKeys);
    return () => { document.body.style.overflow = before; window.removeEventListener('keydown', expandedKeys); };
  }, [expanded, focusField]);

  function openPanel(next: PanelId, opener?: HTMLElement) {
    if (fortress.cinematic || liftMoving) return;
    locked.current = true;
    controller.current?.setPaused(true);
    if (panel && panel !== next) {
      setParents(history => [...history, { panel, opener: opener?.dataset.panelEntry }]);
    } else if (!panel) {
      setParents([]);
      outerOpener.current = opener ?? canvas.current;
      if (next === 'pack') setPackSelection(current.current.battle.lead);
    }
    setPanel(next);
  }

  function walkBackTo(point: MazePoint) {
    if (!maze || !controller.current) return;
    controller.current.setPaused(false);
    if (controller.current.walkRecorded(point, current.current.mazeTrail[maze])) {
      setPanel(null);
      focusField();
    } else controller.current.setPaused(true);
  }

  async function hearKyurem() {
    const attempt = ++cryAttempt.current;
    setCryPlayback('loading');
    focusField();
    const prepared = await sound.prepareCry();
    if (attempt !== cryAttempt.current) return;
    if (prepared === 'cancelled') { setCryPlayback('idle'); return; }
    if (prepared === 'unavailable') { setCryPlayback('unavailable'); return; }
    if (!controller.current?.callKyurem()) { setCryPlayback('idle'); return; }
    sound.audition();
    setCryPlayback('playing');
  }

  function hearChains() {
    if (controller.current?.pulseWard()) sound.audition('chains');
    focusField();
  }

  function openDex(id?: CreatureId, opener?: HTMLElement) {
    setDexEntry(id ?? (floor === 'seal' && save.kyuremObserved ? 'kyurem' : undefined));
    openPanel('dex', opener);
  }

  function backPanel() {
    const previous = parents.at(-1);
    if (!previous) { closePanel(); return; }
    setParents(history => history.slice(0, -1));
    setPanel(previous.panel);
    if (previous.opener) requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`dialog [data-panel-entry="${previous.opener}"]`)?.focus({ preventScroll: true });
    });
  }

  function closePanel() {
    setParents([]);
    setPanel(null);
    const opener = outerOpener.current;
    if (opener?.isConnected && opener !== canvas.current && !opener.matches(':disabled')) {
      requestAnimationFrame(() => opener.focus({ preventScroll: true }));
    } else if (encounter || dialogue) {
      requestAnimationFrame(() => {
        const target = encounter ? canvas.current?.parentElement?.querySelector<HTMLElement>('.battle-overlay') : dialogueButton.current;
        target?.focus({ preventScroll: true });
      });
    } else {
      focusField();
    }
  }

  function playField() {
    controller.current?.interact();
    if (!locked.current) focusField();
  }

  function leaveRoom() {
    controller.current?.leaveRoom();
    focusField();
  }

  function toggleRunning() {
    setRunning(value => !value);
    if (!paused) focusField();
  }

  function releaseDirection(event: ReactPointerEvent<HTMLButtonElement>) {
    if (directionPointer.current !== event.pointerId) return;
    directionPointer.current = null;
    controller.current?.hold(null);
  }

  function onFieldShortcut(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (paused || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    const key = event.key.toLowerCase();
    if (key === 'm' || key === 'q' || key === 'j') {
      event.preventDefault();
      if (key === 'j') openDex();
      else openPanel(key === 'm' ? fieldMapPanel : 'pack');
    }
  }

  function finishBattle(result: BattleResult) {
    setEncounter(null);
    setShownBattle(undefined);
    if (result.outcome === 'win' || result.outcome === 'caught') sound.play('win');
    if (result.outcome === 'lost') {
      controller.current?.setPaused(false);
      controller.current?.recoverAtClinic();
      say('补给员', '你和伙伴们回到了潮汐环城。体力和补给都已恢复，随时可以再出发。');
    } else if (encounter?.trial && result.outcome === 'win') {
      say('东渡口守望员', '东渡口的信号灯亮起来了！港口的伙伴会看见你的信号。你已经完成了环城试炼。');
    } else if (encounter?.trainer && result.outcome === 'win') {
      say(encounter.trainer, encounter.firstPractice ? '队伍已经休整好了。这两颗精灵球也带上，留给接下来的旅程。' : '这场又学到了新东西。路过这里时，还可以来找我切磋。');
    } else {
      focusField();
    }
  }

  const checkpointBattle = useCallback((pendingBattle: BattleCheckpoint) => {
    const next = { ...current.current, pendingBattle };
    current.current = next;
    setSave(next);
    commit(next);
  }, [commit]);

  const saveBattle = useCallback((result: BattleResult) => {
    const previous = current.current;
    const sparWon = result.outcome === 'win' && Boolean(activeEncounter.current?.trainer);
    const firstSpar = sparWon && !previous.sparWon;
    const battle = result.outcome === 'lost' || firstSpar ? healTeam(result.progress) : result.progress;
    const next = {
      ...previous,
      pendingBattle: undefined,
      location: result.outcome === 'lost' ? {area:'harbor' as const,x:18,y:11} : previous.location,
      sparWon: previous.sparWon || sparWon,
      battle: firstSpar ? { ...battle, charms: Math.min(Number.MAX_SAFE_INTEGER, battle.charms + 2) } : battle,
    };
    current.current = next;
    setSave(next);
    commit(next);
  }, [commit]);

  function walkTo(stop: CityStop) {
    const field = controller.current;
    if (!field) return false;
    field.setPaused(false);
    const started = field.walkToStop(stop);
    if (!started) { field.setPaused(true); return false; }
    setAtlasStop(stop.id);
    setPanel(null);
    requestAnimationFrame(() => {
      const surface = canvas.current;
      if (!surface) return;
      surface.focus({ preventScroll: true });
      const rect = surface.getBoundingClientRect();
      if (rect.bottom > innerHeight || rect.top < 0) surface.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
    return true;
  }

  function giveMedicine(id: CreatureId) {
    setSave(previous => {
      const battle = givePotion(previous.battle, id);
      return battle === previous.battle ? previous : { ...previous, battle };
    });
    sound.play('interact');
  }

  function storeProfile(next: Profile) {
    try { localStorage.setItem('yu-world-profile', JSON.stringify(next)); }
    catch { return false; }
    setProfile(next);
    backPanel();
    return true;
  }

  function closeDialogue() {
    setDialogue(null);
    focusField();
  }

  const tasks = [
    { id: 'guide', label: '与韩怡萱交谈', description: '环城大道 · 起点东侧', done: save.greeted },
    { id: 'catch', label: '捕捉一只宝可梦', description: '外环绿廊 · 高草花园', done: progress.team.length > 1 },
    { id: 'trial', label: '完成东渡口试炼', description: '带两位伙伴到东渡口', done: progress.trialWon },
  ];
  const activeTask = tasks.find(task => !task.done)?.id;
  const panelTitles: Record<PanelId, { title: string; label: string }> = {
    'palace-section': { title: '地宫纵剖图', label: 'PALACE SECTION' },
    'fortress-log': { title: '海宫勘察手记', label: 'FORTRESS SURVEY' },
    storage: { title: '冒险存档', label: 'SAVE FILE' },
    maze: { title: '地宫行迹图', label: 'SURVEY MAP' },
    about: { title: profile.name, label: 'ABOUT ME' },
    projects: { title: '研究档案', label: 'RESEARCH ARCHIVE' },
    contact: { title: '联系我', label: 'SIGNAL STATION' },
    edit: { title: '编辑个人资料', label: 'PROFILE' },
    map: { title: wall ? '外壁长阶剖面图' : '环城地图', label: wall ? 'RAMPART SECTION' : 'CITY MAP' },
    pack: { title: '伙伴与补给', label: 'BACKPACK' },
    dex: { title: '环城图鉴', label: 'FIELD POKÉDEX' },
  };

  const audioToggle = <button type="button" className="icon-button" aria-label={sound.enabled ? '关闭声音' : '开启声音'} title={sound.enabled ? '关闭声音' : '开启声音'} aria-pressed={sound.enabled} onClick={sound.toggle}>{sound.enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>;

  return <div className="app">
    <header className="topbar" inert={expanded}>
      <div className="wrap topbar-inner">
        <a href="#top" className="wordmark"><span className="brand-symbol"><Compass size={22} strokeWidth={2.4} /></span><span className="pixel">TIDEBOUND<span className="brand-period">.</span></span></a>
        <nav aria-label="主导航">
          <a className="nav-link nav-current" href="#expedition" onClick={() => { if (!paused) focusField(); }}><Compass size={16} />环城探索</a>
          <button className="nav-link" type="button" onClick={event => openPanel('projects', event.currentTarget)}><BookOpen size={16} />研究档案</button>
          <button className="nav-link" type="button" onClick={event => openPanel('about', event.currentTarget)}><House size={16} />关于我</button>
        </nav>
        <div className="top-actions">
          {!expanded && audioToggle}
          <a className="icon-button github-nav" aria-label="在 GitHub 查看仓库" title="GitHub 仓库" href="https://github.com/Jasonhhha/Pokemon-profile" target="_blank" rel="noreferrer"><Github size={18} /></a>
        </div>
      </div>
    </header>

    <main className="wrap" id="top">
      <section className="hero" aria-labelledby="site-title" inert={expanded}>
        <div className="hero-title">
          <div className="hero-kicker"><span className="live-dot" />{profile.name}的城市手记</div>
          <h1 id="site-title"><strong>潮汐环城</strong><span className="hero-english pixel">TIDEPORT RING</span></h1>
        </div>
        <p className="hero-copy">带上宝可梦走进潮汐环城。<br className="desktop-break" />沿途可以翻看我的量化研究和项目笔记。</p>
      </section>

      <div id="expedition" className="expedition">
        <section ref={frame} className={`game-frame${expanded ? ' game-expanded' : ''}`} data-island={area} data-city={area === 'harbor' && !interior || undefined} aria-label="潮汐环城游戏"
          role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined}>
          <header className="game-bar">
            <div className="area-name"><span className="area-icon"><AreaIcon size={18} /></span><strong>{scene.name}</strong><span className="area-english pixel">{scene.english}</span></div>
            <div className="game-tools">
              {expanded && audioToggle}
              {interior ? <button type="button" className="area-weather" onClick={leaveRoom} disabled={paused || liftMoving}><DoorOpen size={16} />{wall ? '沿阶返回西栈桥' : floor ? returnLabel : '离开室内'}</button> :
              <button type="button" className="area-weather" aria-label={night ? '切换到白天' : '切换到夜晚'} aria-pressed={night} title={night ? '切换到白天' : '切换到夜晚'} onClick={() => { setNight(!night); if (!paused) focusField(); }}>
                {night ? <Moon size={16} /> : <Sun size={16} />}{night ? '夜间' : '晴朗'}
              </button>}
              {((area === 'harbor' && !interior) || maze) && <button type="button" className="icon-button overview-button" aria-label={overviewLabel}
                aria-pressed={overview} title={overviewLabel} disabled={!ready || paused || fortress.cinematic || liftMoving}
                onClick={() => { controller.current?.setOverview(!overview); focusField(); }}>
                <Orbit size={17} /><span>{overviewLabel}</span>
              </button>}
              <button type="button" className="icon-button" aria-label={mapTitle} title={mapTitle} disabled={Boolean(encounter || dialogue || fortress.cinematic || liftMoving)} onClick={event => openPanel(floor ? 'palace-section' : 'map', event.currentTarget)}><Map size={17} /></button>
              <button type="button" className="icon-button" aria-label={expanded ? '还原画面' : '放大画面'} title={expanded ? '还原画面' : '放大画面'} onClick={() => { setExpanded(!expanded); if (!paused) focusField(); }}>{expanded ? <Minimize size={16} /> : <Maximize size={16} />}</button>
            </div>
          </header>

          <div className={`game-viewport${encounter && !enteringBattle ? ' game-in-battle' : ''}`} data-area={area}
            data-wall-passage={wall || undefined} data-room={floor ?? save.location.room} data-ward-phase={floor === 'seal' ? save.ward.phase : undefined} data-ward-testing={floor === 'seal' && wardReading.testing || undefined} data-lift-moving={liftMoving || undefined} data-shortcut={maze ? shortcutOpen ? 'open' : 'closed' : undefined} data-roar-phase={floor === 'seal' ? roarPhase : undefined} data-fortress-phase={fortress.phase} data-fortress-cinematic={fortress.cinematic || undefined} data-tide-dial={floor && save.tideDialAwake ? 'awake' : undefined} data-observing-seal={inspectingSeal || undefined} data-overview={overview || undefined}>
            <div className="game-canvas" ref={canvas} role="application" data-grid-load={save.gridLimited ? 'limited' : 'normal'} data-night={night && !interior} tabIndex={paused ? -1 : 0} inert={paused} onKeyDown={onFieldShortcut}
              aria-label={`游戏地图。方向键或 WASD 移动，Shift 跑步，E 键互动，M 打开${maze ? '本层行迹图' : mapTitle}，Q 打开队伍，J 打开图鉴。`} />
            {!ready && <div className="loading" role="status"><Compass size={25} />正在绘制{scene.name}…</div>}
            {ready && !encounter && !dialogue && <div className="map-coordinate" aria-hidden="true"><Crosshair size={14} />
              {area === 'harbor' && !interior && <span className="map-district">{cityDistrict(save.location.x, save.location.y)}</span>}
              <span className="pixel">{wall ? Math.max(0,-wallPoint(3,save.location.y).y).toFixed(1)+' m' : floor ? fortressRooms[floor].level : areaNumber} / {String(save.location.x).padStart(2, '0')}.{String(save.location.y).padStart(2, '0')}</span>
            </div>}
            {ready && !paused && !liftMoving && !inspectingSeal && area === 'harbor' && !room && <div className="fortress-controls">
              {fortress.cinematic ? <div className="fortress-meter">
                <Waves size={17} /><span role="status">{fortress.phase === 'rising' ? '堡体上浮' : fortress.phase === 'draining' ? '八向排水' : '水闸开启'}</span>
                <progress aria-label="堡垒升降进度" value={fortress.phase === 'rising' ? fortress.lift * .48 : .48 + fortress.drain * .52} max={1} />
              </div> : <>
                {(!maze || mazeAction) && <button type="button" className="fortress-action" onClick={() => { controller.current?.approachFortress(); focusField(); }}>
                  {floor === 'seal' ? <Waves size={16} /> : <Castle size={16} />}
                  {mazeAction ?? (wall ? '沿阶前往下层王门' : floor === 'seal' ? '靠近封印' : floor ? '前往下层' : atPier ? (fortress.phase === 'open' ? '踏上外壁长阶' : '升起堡垒') : '前往西栈桥')}
                </button>}
                {atPier && fortress.phase === 'open' && <button type="button" className="fortress-replay" onClick={() => { controller.current?.replayFortress(); focusField(); }}>重看浮升</button>}
                {liftAvailable && <button type="button" className="fortress-replay" onClick={() => { controller.current?.rideFortressLift(); focusField(); }}>乘升降台</button>}
                {floor === 'sluice' && !liftAvailable && !save.tideDialAwake && <button type="button" className="fortress-replay" onClick={() => { controller.current?.approachTideDial(); focusField(); }}>唤醒潮盘</button>}
              </>}
            </div>}
            {maze && ready && !paused && !liftMoving && <MazeMinimap room={maze} position={save.location} walked={save.mazeTrail[maze]}
              open={shortcutOpen} expand={() => openPanel('maze')} />}
            {arrival && !encounter && !dialogue && <div className="area-arrival" key={arrival.key} role="status"><span className="pixel">{arrival.english}</span><strong>{arrival.name}</strong></div>}
            {dialogue && <FieldDialogue key={dialogue.index} speaker={dialogue.speaker} line={dialogue.lines[dialogue.index]}
              action={dialogue.index + 1 < dialogue.lines.length ? '继续' : dialogue.choice?.label ?? '结束'}
              actionRef={dialogueButton} advance={nextLine} decline={dialogue.choice ? closeDialogue : undefined} />}
            {encounter && <FieldEncounterTransition kind={encounter.trial ? 'trial' : encounter.trainer ? 'trainer' : 'wild'}
              night={night} onCovered={() => setEnteringBattle(false)}>
              <BattleOverlay encounter={encounter} progress={save.battle} checkpoint={save.pendingBattle} night={night}
                onCheckpoint={checkpointBattle} onPresent={setShownBattle} onResolve={saveBattle} onFinish={finishBattle}
                onCue={sound.play} onSpeciesCry={sound.playSpeciesCry} />
            </FieldEncounterTransition>}
          </div>

          {inspectingSeal ? <div className="game-controls seal-console">
            <div className="seal-specimen"><small>#0646 · 龙 / 冰</small><strong>酋雷姆</strong></div>
            <span className="seal-caption" role="status">{wardReading.testing ? '复测中，等待锚柱回震……' : cryPlayback === 'loading' ? '正在载入叫声……' : cryPlayback === 'unavailable' ? '叫声未载入，可再试一次' : roarPhase === 'breath' ? '它压低了头……' : roarPhase === 'roar' ? '酋雷姆发出吼声' : roarPhase === 'impact' ? '冲击沿能量罩扩散' : save.ward.phase === 'stable' ? '四根锁链受力均匀，封印稳定' : save.ward.phase === 'braced' ? '绞盘已锁定，等待复测' : '能量罩稳定'}</span>
            <GridMonitor controller={controller} limited={Boolean(save.gridLimited)} disabled={paused || wardReading.testing} />
            <button type="button" className="fortress-action" disabled={paused || wardReading.testing || cryPlayback === 'loading' || cryPlayback === 'playing'} onClick={hearKyurem}><Volume2 size={15}/>听它吼叫</button>
            {save.ward.phase === 'idle' && <button type="button" className="fortress-replay" disabled={paused} onClick={() => { controller.current?.startWardSurvey(); focusField(); }}>巡查锁链</button>}
            {(save.ward.phase === 'braced' || save.ward.phase === 'stable') && <button type="button" className="fortress-replay" disabled={paused || wardReading.testing || cryPlayback === 'loading' || cryPlayback === 'playing'} onClick={hearChains}>复测封印</button>}
            <button type="button" className="fortress-replay" disabled={paused} onClick={playField}>返回观测桥</button>
          </div> : floor === 'seal' && save.ward.phase !== 'idle' ? <WardMonitor survey={save.ward} reading={wardReading}
            location={save.location} hint={hint} disabled={paused || !ready} pulse={hearChains} interact={playField} /> : <div className="game-controls">
            <div className="control-keys" role="group" aria-label="键盘操作">
              <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><small>移动</small></span>
              <span><kbd>E</kbd><small>互动</small></span>
            </div>
            <div className="game-hint" aria-live="polite"><MapPin size={15} />{encounter ? '正在战斗' : hint || fieldAreas[area].description}</div>
            <button className="interact-button" type="button" disabled={!ready || paused || fortress.cinematic || liftMoving} onClick={playField}><span className="pixel">E</span>互动</button>
          </div>}

          {!encounter && !inspectingSeal && <div className="touch-controls" role="group" aria-label="触屏操作">
            <div className="dpad">
              {(Object.keys(directions) as Direction[]).map(direction => {
                const { name, icon: Icon } = directions[direction];
                return <button type="button" key={direction} className={`dpad-${direction}`} aria-label={name} disabled={!ready || paused || fortress.cinematic || liftMoving}
                  onPointerDown={event => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    directionPointer.current = event.pointerId;
                    controller.current?.hold(direction);
                  }}
                  onPointerUp={releaseDirection}
                  onPointerCancel={releaseDirection}
                  onLostPointerCapture={releaseDirection}
                  onClick={event => { if (event.detail === 0) controller.current?.move(direction); }}>
                  <Icon size={20} />
                </button>;
              })}
              <span className="dpad-core" />
            </div>
            <div className="touch-actions">
              <button type="button" className="touch-run" aria-label="跑步" aria-pressed={running} disabled={!ready || paused || fortress.cinematic || liftMoving} onClick={toggleRunning}><Zap size={21} /></button>
              <button type="button" className="touch-action" aria-label="与附近目标互动" disabled={!ready || paused || fortress.cinematic || liftMoving} onClick={playField}>A</button>
            </div>
          </div>}
          <div className="field-dock" role="group" aria-label="冒险菜单">
            <button type="button" aria-keyshortcuts="M" disabled={Boolean(encounter || dialogue || fortress.cinematic || liftMoving)} onClick={event => openPanel(fieldMapPanel, event.currentTarget)}><Map size={16} /><span>{wall ? '外壁剖面' : maze ? '行迹图' : floor ? '地宫纵剖' : '地图'}</span><kbd aria-hidden="true">M</kbd></button>
            <button type="button" aria-keyshortcuts="Q" disabled={Boolean(encounter || dialogue || fortress.cinematic || liftMoving)} onClick={event => openPanel('pack', event.currentTarget)}><Backpack size={16} /><span>队伍与道具</span><kbd aria-hidden="true">Q</kbd></button>
            <button type="button" aria-keyshortcuts="J" disabled={Boolean(encounter || dialogue || fortress.cinematic || liftMoving)} onClick={event => openDex(undefined, event.currentTarget)}><BookMarked size={16} /><span>图鉴</span><kbd aria-hidden="true">J</kbd></button>
            <button type="button" className="field-dock-run" disabled={!ready || paused || fortress.cinematic || liftMoving} aria-pressed={running} title="也可长按 Shift 跑步" onClick={toggleRunning}><Zap size={16} /><span>跑步</span><kbd aria-hidden="true">Shift</kbd></button>
          </div>
        </section>

        <aside className="side-stack" aria-label="冒险进度" inert={expanded}>
          <section className="side-card journal">
            <div className="side-card-header"><span className="side-mark"><Flag size={16} /></span><h2>航行任务</h2><span className="journey-count pixel">{tasks.filter(task => task.done).length}/3</span></div>
            <ol className="task-list">
              {tasks.map(task => <li key={task.id} data-current={task.id === activeTask} data-done={task.done}>
                <span className="task-check">{task.done ? <Check size={13} strokeWidth={3} /> : task.id === activeTask ? <span /> : null}</span>
                <div><strong>{task.label}</strong><small>{task.description}</small></div>
              </li>)}
            </ol>
            <button type="button" className="journal-map-link" disabled={Boolean(encounter || dialogue || fortress.cinematic || liftMoving)} onClick={event => openPanel('map', event.currentTarget)}>
              <BookOpen size={14} /><span>街区手记</span><b>{save.courtVisits.length} / {surveyStops.length}</b><ArrowUpRight size={13} />
            </button>
            <button type="button" className="journal-map-link" disabled={Boolean(encounter || dialogue || fortress.cinematic || liftMoving)} onClick={event => openPanel('fortress-log', event.currentTarget)}>
              <Castle size={14}/><span>海宫勘察手记</span><b>{save.deepestFloor ? fortressRooms[save.deepestFloor].level : save.fortressOpened ? '已升起' : '西栈桥'}</b><ArrowUpRight size={13}/>
            </button>
          </section>

          <section className="side-card companion">
            <div className="side-card-header"><span className="side-mark"><Heart size={16} /></span><h2>同行宝可梦</h2><button type="button" className="icon-button" aria-label="打开背包" title="打开背包" disabled={Boolean(encounter || dialogue || fortress.cinematic || liftMoving)} onClick={event => openPanel('pack', event.currentTarget)}><Backpack size={18} /></button></div>
            <button type="button" className="lead-portrait" data-portrait={lead.id} data-resting={paused} aria-label={`查看${leadInfo.name}的图鉴`} disabled={Boolean(encounter || dialogue || fortress.cinematic || liftMoving)} onClick={event => openDex(lead.id, event.currentTarget)}>
              <span className="lead-element">{leadInfo.element}</span><CreatureSprite id={lead.id} /><span className="lead-code pixel">{leadInfo.english}</span>
            </button>
            <div className="lead-status"><strong>{leadInfo.name}</strong><span className="pixel">LV. {lead.level}</span></div>
            <div className="lead-health"><span className="pixel">HP</span><HpBar value={lead.hp} total={maxHp(lead)} /><span>{lead.hp}/{maxHp(lead)}</span></div>
            <div className="field-supplies"><span title={`回复 ${potionHp} 点体力`}><Plus size={15} />伤药 <b>{progress.medicine}</b></span><span title="捕捉野生宝可梦"><Compass size={15} />精灵球 <b>{progress.charms}</b></span></div>
          </section>
          <button type="button" className="save-status" disabled={fortress.cinematic || liftMoving} onClick={event => openPanel('storage', event.currentTarget)}>
            <span className={saveStatus === 'saved' ? 'live-dot' : 'save-offline'} />{saveStatus === 'saved' ? '进度保存在当前浏览器' : saveStatus === 'conflict' ? '另一页已有新进度' : saveStatus === 'damaged' ? '浏览器存档需要恢复' : '当前浏览器无法保存进度'}<ArrowUpRight size={13} />
          </button>
        </aside>
      </div>

      <section className="landmarks" aria-labelledby="landmarks-title" inert={expanded}>
        <div className="landmarks-heading"><div><span className="pixel">FIELD NOTES</span><h2 id="landmarks-title">城里的三个坐标</h2></div><p>也可以直接翻看我的资料与项目。</p></div>
        <div className="place-list">
          {places.map(({ id, name, place, copy, icon: Icon }) => <button type="button" key={id} data-place={id} className="place-card" onClick={event => openPanel(id, event.currentTarget)}>
            <span className="place-icon"><Icon size={23} strokeWidth={1.8} /></span>
            <span className="place-content"><small>{place}</small><strong>{name}</strong><span>{copy}</span></span>
            <ArrowUpRight className="place-arrow" size={18} />
          </button>)}
        </div>
      </section>
      <footer className="footer" inert={expanded}><span className="pixel">TIDEBOUND.</span><span>© 2026 {profile.name}</span><button type="button" onClick={event => openPanel('contact', event.currentTarget)}><Mail size={15} />联系我</button></footer>
    </main>

    {panel && <Panel title={panelTitles[panel].title} label={panelTitles[panel].label} close={closePanel} back={parents.length ? backPanel : undefined} backLabel={parents.length ? panelTitles[parents[parents.length - 1].panel].title : ''}>
      {panel === 'palace-section' && floor && <PalaceSection room={floor} power={readPower} openPlan={button => openPanel('maze', button)} openCity={button => openPanel('map', button)} />}
      {panel === 'maze' && maze && <MazeAtlas room={maze} position={save.location} walked={save.mazeTrail[maze]} open={shortcutOpen} walk={walkBackTo} />}
      {panel === 'about' && <About profile={profile} edit={opener => openPanel('edit', opener)} />}
      {panel === 'projects' && <Research />}
      {panel === 'contact' && <Contact message={message} setMessage={setMessage} profile={profile} edit={opener => openPanel('edit', opener)} />}
      {panel === 'edit' && <ProfileForm profile={profile} save={storeProfile} />}
      {panel === 'map' && wall && <RampartAtlas row={save.location.y} walk={row => {
        const field=controller.current;
        if (!field) return;
        field.setPaused(false);
        if (field.walkWallTo(row)) { setPanel(null); focusField(); }
        else field.setPaused(true);
      }}/>}
      {panel === 'map' && !wall && <RouteAtlas save={save} walkTo={walkTo} lastStop={atlasStop} />}
      {panel === 'dex' && <Pokedex save={save} entry={dexEntry} />}
      {panel === 'fortress-log' && <FortressLog save={save} chart={opener => { setAtlasStop('fortress'); openPanel('map', opener); }}
        maze={opener => openPanel('maze', opener)} dex={opener => { setDexEntry('kyurem'); openPanel('dex', opener); }}/>}
      {panel === 'storage' && <SavePanel save={save} status={saveStatus} original={session.baseline} previous={previousSave}
        retry={() => commit(current.current)} latest={() => {
          const latest = readSession();
          if (latest.status !== 'unavailable') resume(latest, current.current);
          else setSaveStatus('unavailable');
        }} apply={next => {
          const candidate = { ...session, initial: next, status: 'saved' as SaveStatus };
          const status = writeSession(candidate, next);
          if (status === 'conflict') { setSaveStatus(status); return false; }
          resume(candidate, current.current);
          return true;
        }}/>}
      {panel === 'pack' && <TeamPanel selection={packSelection} select={setPackSelection} storage={opener => openPanel('storage', opener)} progress={progress} heal={giveMedicine} inspect={openDex}
        setLead={id => setSave(previous => ({ ...previous, battle: { ...previous.battle, lead: id } }))} />}
    </Panel>}
  </div>;
}
