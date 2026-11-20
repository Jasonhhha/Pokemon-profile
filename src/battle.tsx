import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Backpack, BookOpen, CircleDot, Cross, DoorOpen, Flame, Leaf, Mountain, Snowflake, Sparkles, Swords, Waves, Wind, X, Zap } from 'lucide-react';
import { BattleScenery } from './battle-scenery';
import { BattleMotion, battleBeat, stances } from './battle-motion';
import { BattleSprite } from './battle-sprite';
import { CreatureSprite } from './creature-art';
import {
  activeMember, battleResult, beginBattle, canThrowBall, canUsePotion, healthyReserves, isTrainerBattle, resolveBattleTurn,
  type BattleCommand, type BattleCue, type BattleFrame,
} from './battle-turn';
import {
  ailmentLabels, creatures, effectiveness, maxHp, movePP, moves, potionHp, readyMoves, stageLabels, typeLabels,
  type BattleEncounter, type BattleProgress, type BattleResult, type Move, type MoveId, type PokemonType, type TeamMember,
} from './creatures';
import './battle.css';

export { CreatureSprite } from './creature-art';
export { creatures, givePotion, healTeam, initialBattleProgress, maxHp, maxLevel, migrateBattleProgress, movePP, moves, starterId, typeColors, typeLabels, xpToNext } from './creatures';
export type { Ailment, BattleEncounter, BattleProgress, BattleResult, CreatureId, MoveId, PokemonType, TeamMember } from './creatures';
export type { BattleCue } from './battle-turn';

const elementIcons = { water: Waves, flying: Wind, electric: Zap, grass: Leaf, ice: Snowflake, ground: Mountain, fire: Flame, ghost: Sparkles };
const categories = { physical: '物理', special: '特殊', status: '变化' } as const;
const historyLimit = 12;

type Announcement = { id: number; turn: number; message: string; detail?: string };
type HpChange = { value: number; before: number; after: number; beat: number; delay: number };

function hpChange(before: TeamMember | undefined, after: TeamMember, beat: number, delay: number): HpChange | undefined {
  if (!before || before.id !== after.id || before.hp === after.hp) return;
  return { value: after.hp - before.hp, before: before.hp / maxHp(before), after: after.hp / maxHp(after), beat, delay };
}

function cueTime(frame: BattleFrame) {
  if (frame.cue === 'hit' || frame.capture === 'shake' || frame.cue === 'switch' || frame.cue === 'heal') return battleBeat(frame).contact;
  return 0;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(preference.matches);
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  return reduced;
}

function recordAnnouncement(history: Announcement[], frame: BattleFrame): Announcement[] {
  const { message, detail, state: { turn } } = frame;
  if (history.some(entry => entry.turn === turn && entry.message === message && entry.detail === detail)) return history;
  const id = (history.at(-1)?.id ?? 0) + 1;
  return [...history.slice(1 - historyLimit), { id, turn, message, detail }];
}

function TypeIcon({ type }: { type: PokemonType }) {
  const Icon = elementIcons[type as keyof typeof elementIcons] ?? Swords;
  return <Icon size={14} aria-hidden="true" />;
}

function Status({ member, enemy = false, change }: { member: TeamMember; enemy?: boolean; change?: HpChange }) {
  const species = creatures[member.id];
  const total = maxHp(member);
  const ratio = member.hp / total;
  return <div className={`battle-status ${enemy ? 'battle-status--enemy' : 'battle-status--ally'}`}>
    <div className="battle-status-name"><strong>{species.name}</strong><span>LV.{member.level}</span></div>
    <div className="battle-hp"><span>HP</span><div className="battle-hp-track" role="meter" aria-label={`${species.name}体力`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={member.hp}>
      {change && <span key={change.beat} className="battle-hp-trail" data-shift={change.value > 0 ? 'heal' : 'damage'}
        style={{ '--hp-before': `${change.before * 100}%`, '--hp-after': `${change.after * 100}%`, '--impact-delay': `${change.delay}ms` } as CSSProperties} />}
      <i style={{ width: `${ratio * 100}%`, transitionDelay: `${change?.delay ?? 0}ms`, '--impact-delay': `${change?.delay ?? 0}ms` } as CSSProperties}
        data-low={ratio <= 0.25} data-was-low={change && change.before <= 0.25} />
    </div><span className="battle-hp-value">
      {change?.delay ? <span className="battle-hp-reading" key={change.beat} style={{ '--impact-delay': `${change.delay}ms` } as CSSProperties}>
        <span className="battle-hp-number--previous" aria-hidden="true">{member.hp - change.value}/{total}</span>
        <span className="battle-hp-number--current">{member.hp}/{total}</span>
      </span> : `${member.hp}/${total}`}
    </span></div>
    <div className="battle-status-meta">
      <span style={{ '--element-color': species.color } as CSSProperties}><TypeIcon type={species.elementKey} />{species.element}</span>
      {member.ailment && <span className="battle-condition" data-ailment={member.ailment}>{ailmentLabels[member.ailment]}</span>}
    </div>
  </div>;
}

function Combatant({ member, enemy = false, change, note, beat, delay, frame, reduced, recalled }: {
  member: TeamMember; enemy?: boolean; change?: HpChange; note?: string; beat: number; delay: number;
  frame: BattleFrame; reduced: boolean; recalled?: TeamMember;
}) {
  return <div className={`battle-combatant ${enemy ? 'battle-combatant--enemy' : 'battle-combatant--ally'}`}
    data-stance={stances[member.id]} data-ailment={member.ailment}>
    <div className="battle-pedestal" />
    {recalled && !reduced && <div className="battle-recalled" aria-hidden="true"><CreatureSprite id={recalled.id} back={recalled.id !== 'drifloon'} /></div>}
    <div className="battle-pose" key={member.id}><BattleSprite id={member.id} side={enemy ? 'enemy' : 'ally'}
      frame={frame} frozen={member.ailment === 'freeze'} reduced={reduced} /></div>
    {(change || note) && <div key={beat} className="battle-hit-note" aria-hidden="true"
      data-tone={change?.value ? change.value > 0 ? 'heal' : 'damage' : 'status'} style={{ '--impact-delay': `${delay}ms` } as CSSProperties}>
      {change && <strong>{change.value < 0 ? '−' : '+'}{Math.abs(change.value)}</strong>}
      {note && <span>{note}</span>}
    </div>}
  </div>;
}

function describeEffect(move: Move) {
  const effect = move.effect;
  if (!effect) return move.highCritical ? '较易击中要害' : '';
  const chance = effect.chance < 1 ? `${Math.round(effect.chance * 100)}% 概率` : '';
  switch (effect.kind) {
    case 'stage': {
      const target = effect.target === 'self' ? '自身' : '对手的';
      return `${chance}${effect.amount > 0 ? '提升' : '降低'}${target}${stageLabels[effect.stat]} ${Math.abs(effect.amount)} 级`;
    }
    case 'flinch': return `先行动时有 ${chance}使对手畏缩`;
    case 'ailment': return `${chance}使对手陷入${ailmentLabels[effect.ailment]}`;
    case 'boost': return `${chance}提升自身攻击、防御、特攻、特防和速度`;
  }
}

function MoveButton({ id, member, opponent, disabled, active, onPick }: {
  id: MoveId; member: TeamMember; opponent: TeamMember; disabled: boolean; active?: boolean; onPick: (id: MoveId) => void;
}) {
  const move = moves[id];
  const remaining = movePP(member, id);
  const modifier = effectiveness(id, opponent.id);
  const type = id === 'struggle' ? '无属性' : typeLabels[move.type];
  const accuracy = move.accuracy === null ? '必中' : `命中 ${move.accuracy}%`;
  const matchup = !modifier ? '无效' : modifier > 1 ? '效果绝佳' : modifier < 1 ? '效果减弱' : '';
  const description = [type, categories[move.category], id === 'struggle' ? '招式 PP 耗尽时可用' : `PP ${remaining}/${move.pp}`,
    move.power && `威力 ${move.power}`, accuracy, move.priority > 0 && `优先度 +${move.priority}`, matchup && `${matchup}（×${modifier}）`,
    id === 'struggle' ? '使用者受到反作用力伤害' : describeEffect(move)].filter(Boolean).join(' · ');
  return <button type="button" className="battle-move" data-type={move.type} data-matchup={modifier > 1 ? 'strong' : modifier < 1 ? 'weak' : undefined} data-playing={active || undefined}
    onClick={() => onPick(id)} disabled={disabled || remaining === 0} aria-label={move.name}
    title={description} aria-description={description}>
    <span className="battle-move-name"><TypeIcon type={move.type} /><strong>{move.name}</strong><small>{type}</small></span>
    <span className="battle-move-meta">{id === 'struggle' ? <span>耗尽 PP 时可用</span> : <span>PP {remaining}/{move.pp}</span>}<span>{matchup || (move.priority ? '先制' : move.power ? `威力 ${move.power}` : categories[move.category])}</span></span>
  </button>;
}

export function BattleOverlay({ encounter, progress, night = false, onResolve, onFinish, onCue }: {
  encounter: BattleEncounter;
  progress: BattleProgress;
  night?: boolean;
  onResolve?: (result: BattleResult) => void;
  onFinish: (result: BattleResult) => void;
  onCue?: (cue: BattleCue) => void;
}) {
  const [{ frame, previous, serial }, setPresentation] = useState<{ frame: BattleFrame; previous?: BattleFrame; serial: number }>(
    () => ({ frame: beginBattle(encounter, progress), serial: 0 }),
  );
  const [switching, setSwitching] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [announcements, setAnnouncements] = useState(() => recordAnnouncement([], frame));
  const historyId = useId();
  const overlay = useRef<HTMLElement>(null);
  const returnButton = useRef<HTMLButtonElement>(null);
  const historyTrigger = useRef<HTMLButtonElement>(null);
  const historyClose = useRef<HTMLButtonElement>(null);
  const currentCue = useRef(onCue);
  const playedFrame = useRef<BattleFrame>(undefined);
  currentCue.current = onCue;
  const queue = useRef<BattleFrame[]>([]);
  const gate = useRef(false);
  const committed = useRef(false);
  const dismissed = useRef(false);
  const state = frame.state;
  const lead = activeMember(state);
  const trial = Boolean(encounter.trial);
  const trainerBattle = isTrainerBattle(state, trial);
  const title = trial ? '高地试炼' : trainerBattle ? '训练家切磋' : '野外战斗';
  const canAct = !frame.duration && !state.outcome;
  const isComplete = Boolean(state.outcome);
  const reduced = useReducedMotion();
  const contact = reduced ? 0 : battleBeat(frame).contact;
  const previousLead = previous && activeMember(previous.state);
  const allyChange = isComplete ? undefined : hpChange(previousLead, lead, serial, contact);
  const enemyChange = isComplete ? undefined : hpChange(previous?.state.enemy, state.enemy, serial, contact);
  const recalled = frame.cue === 'switch' && previousLead && previousLead.id !== lead.id && previousLead.hp > 0 ? previousLead : undefined;
  const move = frame.move;
  const firstSentence = move && contact ? frame.message.indexOf('。 ') + 1 : 0;
  const reaction = move?.result === 'miss' ? '未命中' : move?.result === 'immune' ? '无效'
    : move?.critical ? '击中要害' : (move?.effectiveness ?? 1) > 1 ? '效果绝佳'
      : (move?.effectiveness ?? 1) < 1 ? '效果减弱' : undefined;
  const captureStatus = frame.capture === 'shake' ? '捕捉中' : frame.capture === 'break' ? '挣脱' : state.outcome === 'caught' ? '捕捉成功' : undefined;
  const reserves = healthyReserves(state);
  const available = readyMoves(lead);
  const displayedMoves: readonly MoveId[] = available[0] === 'struggle' ? available : creatures[lead.id].moves;

  const nextFrame = useCallback(() => {
    const next = queue.current.shift();
    if (!next) return;
    // The idle frame keeps displaying the previous announcement while accepting input.
    if (next.duration || next.state.outcome) setAnnouncements(history => recordAnnouncement(history, next));
    setPresentation(current => ({ frame: next, previous: current.frame, serial: current.serial + 1 }));
  }, []);

  useEffect(() => { overlay.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    if (historyOpen) historyClose.current?.focus({ preventScroll: true });
  }, [historyOpen]);
  useEffect(() => {
    if (historyOpen) return;
    const focused = document.activeElement;
    const inBattle = focused === document.body || overlay.current?.contains(focused);
    if (isComplete && inBattle && focused !== historyTrigger.current) returnButton.current?.focus({ preventScroll: true });
    else if (canAct && focused === document.body) overlay.current?.focus({ preventScroll: true });
  }, [canAct, historyOpen, isComplete]);
  useEffect(() => {
    if (!frame.duration) return;
    const timer = window.setTimeout(nextFrame, frame.duration);
    return () => clearTimeout(timer);
  }, [frame, nextFrame]);
  useEffect(() => {
    const cue = frame.cue;
    if (!cue || playedFrame.current === frame) return;
    const timer = window.setTimeout(() => {
      playedFrame.current = frame;
      currentCue.current?.(cue);
    }, reduced ? 0 : cueTime(frame));
    return () => clearTimeout(timer);
  }, [frame, reduced]);
  useLayoutEffect(() => {
    if (canAct) gate.current = false;
  }, [canAct]);
  useLayoutEffect(() => {
    if (committed.current) return;
    const result = battleResult(state);
    if (!result) return;
    committed.current = true;
    onResolve?.(result);
  }, [state, onResolve]);

  function act(command: BattleCommand) {
    if (!canAct || gate.current) return;
    const sequence = resolveBattleTurn(state, command, trial);
    if (!sequence.length) return;
    gate.current = true;
    setSwitching(false);
    queue.current = sequence;
    nextFrame();
  }

  function close() {
    if (dismissed.current) return;
    const result = battleResult(state);
    if (result) {
      dismissed.current = true;
      onFinish(result);
    }
  }

  function closeHistory() {
    setHistoryOpen(false);
    historyTrigger.current?.focus({ preventScroll: true });
  }

  return <section ref={overlay} className="battle-overlay" aria-label={title} tabIndex={-1} onKeyDown={event => {
    if (historyOpen && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeHistory();
      return;
    }
    if (historyOpen || event.altKey || event.ctrlKey || event.metaKey || event.repeat || switching) return;
    if (!/^[1-4]$/.test(event.key)) return;
    const id = displayedMoves[Number(event.key) - 1];
    if (id) {
      event.preventDefault();
      act({ kind: 'move', move: id });
    }
  }}>
    <div className="battle-topline"><span><Swords size={15} />{title}{state.trainer && ` · ${state.trainer}`}</span>
      <div className="battle-topline-tools"><span>回合 {String(state.turn).padStart(2, '0')}</span>
        <button type="button" className="battle-history-trigger" ref={historyTrigger} aria-expanded={historyOpen} aria-controls={historyId}
          onClick={() => { if (historyOpen) closeHistory(); else { setSwitching(false); setHistoryOpen(true); } }}><BookOpen size={14} aria-hidden="true" />对战记录</button>
      </div>
    </div>
    <div className="battle-arena" data-area={encounter.area ?? 'harbor'} data-night={night || undefined} data-effect={frame.effect} data-outcome={state.outcome}
      data-move-type={frame.moveType} data-move={move?.id} data-reaction={move?.result} data-capture={frame.capture} data-cue={frame.cue}
      style={{ '--impact-delay': `${contact}ms`, '--capture-duration': `${frame.duration}ms` } as CSSProperties}>
      <BattleScenery area={encounter.area} night={night} />
      <Status member={state.enemy} change={enemyChange} enemy />
      <Combatant member={state.enemy} enemy change={enemyChange} note={move?.target === 'enemy' ? reaction : undefined}
        beat={serial} delay={contact} frame={frame} reduced={reduced} />
      <Combatant member={lead} change={allyChange} note={move?.target === 'ally' ? reaction : undefined}
        beat={serial} delay={contact} frame={frame} reduced={reduced} recalled={recalled} />
      <BattleMotion frame={frame} reduced={reduced} />
      <Status member={lead} change={allyChange} />
      {captureStatus && <div className="battle-capture-state" key={serial} aria-hidden="true">
        <span>{captureStatus}</span>{frame.capture === 'shake' && <div className="battle-capture-pulses"><i /><i /><i /></div>}
      </div>}
    </div>
    <aside id={historyId} className="battle-history" hidden={!historyOpen} aria-labelledby={`${historyId}-title`}>
      <header className="battle-history-header"><h3 id={`${historyId}-title`}>对战记录</h3>
        <button type="button" className="battle-history-close" ref={historyClose} aria-label="关闭对战记录" onClick={closeHistory}><X size={16} aria-hidden="true" /></button>
      </header>
      <ol className="battle-history-list" tabIndex={0} aria-label="最近的对战回合">{[...announcements].reverse().map(entry => <li key={entry.id}>
        <span className="battle-history-turn">回合 {String(entry.turn).padStart(2, '0')}</span>
        <div><p>{entry.message}</p>{entry.detail && <small className="battle-history-detail">{entry.detail}</small>}</div>
      </li>)}</ol>
    </aside>
    <div className="battle-console" data-ready={canAct}>
      <p className="battle-text" role="status" aria-live={historyOpen ? 'off' : 'polite'}><Sparkles size={14} aria-hidden="true" />
        <span>{firstSentence ? <>{frame.message.slice(0, firstSentence)}
          <span key={serial} className="battle-followup" style={{ '--impact-delay': `${contact}ms` } as CSSProperties}>{frame.message.slice(firstSentence)}</span></> : frame.message}</span>
      </p>
      {isComplete ? <div className="battle-finish"><button ref={returnButton} type="button" onClick={close}>返回原野</button></div> : <>
        <div className="battle-moves" aria-label="可用招式">
          {displayedMoves.map(id => <MoveButton key={id} id={id} member={lead} opponent={state.enemy} disabled={!canAct}
            active={move?.source === 'ally' && move.id === id && move.result !== 'stalled'}
            onPick={move => act({ kind: 'move', move })} />)}
        </div>
        <div className="battle-utilities" aria-label="战斗操作">
          <button type="button" onClick={() => act({ kind: 'potion' })} disabled={!canAct || !canUsePotion(state)} aria-label="使用伤药" title={`恢复最多 ${potionHp} HP`}><Cross size={15} /><span>伤药</span><small>×{state.progress.medicine}</small></button>
          <button type="button" onClick={() => act({ kind: 'ball' })} disabled={!canAct || !canThrowBall(state, trial)} aria-label="投掷精灵球" title={trainerBattle ? '无法捕捉训练家的宝可梦' : '削弱体力会提高捕捉率'}><CircleDot size={15} /><span>精灵球</span><small>×{state.progress.charms}</small></button>
          <div className="battle-switch">
            <button type="button" onClick={() => setSwitching(value => !value)} aria-expanded={switching && canAct} aria-label="更换出场伙伴" disabled={!canAct || !reserves.length}><Backpack size={14} /><span>换人</span></button>
            {switching && canAct && <div className="battle-reserves">{reserves.map(member => <button type="button" key={member.id} onClick={() => act({ kind: 'switch', id: member.id })}>{creatures[member.id].name}<span>{member.hp}/{maxHp(member)} HP</span></button>)}</div>}
          </div>
          <button type="button" onClick={() => act({ kind: 'run' })} disabled={!canAct || trainerBattle} title={trainerBattle ? '训练家对战中无法撤退' : '尝试逃离本场对战'}><DoorOpen size={15} /><span>撤退</span></button>
        </div>
      </>}
    </div>
  </section>;
}
