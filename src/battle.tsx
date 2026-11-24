import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Backpack, BookOpen, CircleDot, Cross, DoorOpen, Flame, Leaf, Mountain, Snowflake, Sparkles, Swords, Waves, Wind, X, Zap } from 'lucide-react';
import { BattleScenery } from './battle-scenery';
import { BattleMotion, battleBeat, stances } from './battle-motion';
import { BattleSprite } from './battle-sprite';
import { describeMove } from './battle-move-info';
import { checkpointTurn, recordAnnouncement, resumeFrame, type BattleCheckpoint } from './battle-checkpoint';
import {
  activeMember, battleResult, beginBattle, canThrowBall, canUsePotion, healthyReserves, isTrainerBattle, potionTargets, resolveBattleTurn,
  type BattleCommand, type BattleCue, type BattleFrame, type BattleState,
} from './battle-turn';
import {
  ailmentLabels, creatures, maxHp, potionHp, readyMoves, stageLabels,
  type BattleEncounter, type BattleProgress, type BattleResult, type CreatureId, type MoveId, type PokemonType, type Stages, type TeamMember,
} from './creatures';
import './battle.css';

export { CreatureSprite } from './creature-art';
export { creatures, givePotion, healTeam, initialBattleProgress, maxHp, maxLevel, migrateBattleProgress, movePP, moves, starterId, typeColors, typeLabels, xpToNext } from './creatures';
export type { Ailment, BattleEncounter, BattleProgress, BattleResult, CreatureId, MoveId, PokemonType, TeamMember } from './creatures';
export type { BattleCue } from './battle-turn';

const elementIcons = { water: Waves, flying: Wind, electric: Zap, grass: Leaf, ice: Snowflake, ground: Mountain, fire: Flame, ghost: Sparkles };
type HpChange = { value: number; before: number; after: number; beat: number; delay: number };
type PartyAction = 'potion' | 'switch' | 'replacement';

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
  const still = reduced || member.ailment === 'freeze' || member.hp === 0 || (enemy && frame.state.outcome === 'caught');
  return <div className={`battle-combatant ${enemy ? 'battle-combatant--enemy' : 'battle-combatant--ally'}`}
    data-stance={stances[member.id]} data-ailment={member.ailment}>
    <div className="battle-pedestal" />
    {recalled && !reduced && <div className="battle-recalled" aria-hidden="true"><BattleSprite id={recalled.id} side="ally" still /></div>}
    <div className="battle-pose" key={member.id}><BattleSprite id={member.id} side={enemy ? 'enemy' : 'ally'} still={still} /></div>
    {(change || note) && <div key={beat} className="battle-hit-note" aria-hidden="true"
      data-tone={change?.value ? change.value > 0 ? 'heal' : 'damage' : 'status'} style={{ '--impact-delay': `${delay}ms` } as CSSProperties}>
      {change && <strong>{change.value < 0 ? '−' : '+'}{Math.abs(change.value)}</strong>}
      {note && <span>{note}</span>}
    </div>}
  </div>;
}

function MoveButton({ id, info, disabled, active, onPick }: {
  id: MoveId; info: ReturnType<typeof describeMove>; disabled: boolean; active?: boolean; onPick: (id: MoveId) => void;
}) {
  const { move, remaining, modifier, type, matchup, description } = info;
  return <button type="button" className="battle-move" data-type={move.type} data-matchup={modifier > 1 ? 'strong' : modifier < 1 ? 'weak' : undefined} data-playing={active || undefined}
    onClick={() => onPick(id)} disabled={disabled || remaining === 0} aria-label={move.name}
    title={description} aria-description={description}>
    <span className="battle-move-name"><TypeIcon type={move.type} /><strong>{move.name}</strong><small>{type}</small></span>
    <span className="battle-move-meta">{id === 'struggle' ? <span>耗尽 PP 时可用</span> : <span>PP {remaining}/{move.pp}</span>}<span>{matchup || (move.priority ? '先制' : move.power ? `威力 ${move.power}` : info.category)}</span></span>
  </button>;
}

function stageSummary(stages: Stages) {
  return (Object.keys(stageLabels) as (keyof Stages)[]).filter(stat => stages[stat] !== 0)
    .map(stat => `${stageLabels[stat]} ${stages[stat] > 0 ? '+' : '−'}${Math.abs(stages[stat])}`).join(' · ');
}

function BattleParty({ action, members, active, stock, onCancel, onPick }: {
  action: PartyAction; members: TeamMember[]; active: CreatureId; stock: number; onCancel: () => void; onPick: (id: CreatureId) => void;
}) {
  const titleId = useId();
  const first = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => { first.current?.focus({ preventScroll: true }); }, [action]);
  const healing = action === 'potion';
  const title = healing ? '给谁使用伤药？' : action === 'replacement' ? '选择接替的伙伴' : '更换出场伙伴';
  return <section className="battle-party" aria-labelledby={titleId}>
    <header><h3 id={titleId}>{title}</h3>
      {healing && <small>伤药 ×{stock}</small>}
      {action !== 'replacement' && <button type="button" className="battle-party-back" onClick={onCancel}>返回</button>}
    </header>
    <div className="battle-party-list">{members.map((member, index) => {
      const hp = maxHp(member);
      const after = Math.min(hp, member.hp + potionHp);
      const status = member.ailment && ailmentLabels[member.ailment];
      return <button ref={index === 0 ? first : undefined} className="battle-party-option" type="button" key={member.id}
        onClick={() => onPick(member.id)} aria-label={`${creatures[member.id].name}，等级 ${member.level}，HP ${member.hp}/${hp}${status ? '，' + status : ''}${healing ? '，恢复至 ' + after : ''}`}>
        <span className="battle-party-portrait" aria-hidden="true"><BattleSprite id={member.id} side="enemy" still /></span>
        <span className="battle-party-details"><b>{creatures[member.id].name}</b><small>{status ?? (member.id === active ? '在场' : `Lv.${member.level}`)}</small>
          <span className="battle-party-hp" aria-hidden="true"><i style={{ width: `${member.hp / hp * 100}%` }} /></span>
          <span className="battle-party-values">{healing ? `HP ${member.hp} → ${after}` : `HP ${member.hp}/${hp}`}</span>
        </span>
      </button>;
    })}</div>
  </section>;
}

export function BattleOverlay({ encounter, progress, checkpoint, night = false, onCheckpoint, onPresent, onResolve, onFinish, onCue, onSpeciesCry }: {
  encounter: BattleEncounter;
  progress: BattleProgress;
  checkpoint?: BattleCheckpoint;
  night?: boolean;
  onCheckpoint?: (next: BattleCheckpoint) => void;
  onPresent?: (state: BattleState) => void;
  onResolve?: (result: BattleResult) => void;
  onFinish: (result: BattleResult) => void;
  onCue?: (cue: BattleCue) => void;
  onSpeciesCry?: (id: CreatureId) => (() => void) | undefined;
}) {
  const [{ frame, previous, serial }, setPresentation] = useState<{ frame: BattleFrame; previous?: BattleFrame; serial: number }>(
    () => ({ frame: checkpoint ? resumeFrame(checkpoint) : beginBattle(encounter, progress), serial: 0 }),
  );
  const [partyAction, setPartyAction] = useState<'potion' | 'switch'>();
  const [reference, setReference] = useState<'history' | 'moves'>();
  const [announcements, setAnnouncements] = useState(() => checkpoint?.history ?? recordAnnouncement([], frame));
  const historyId = useId();
  const overlay = useRef<HTMLElement>(null);
  const returnButton = useRef<HTMLButtonElement>(null);
  const historyTrigger = useRef<HTMLButtonElement>(null);
  const moveTrigger = useRef<HTMLButtonElement>(null);
  const historyClose = useRef<HTMLButtonElement>(null);
  const potionTrigger = useRef<HTMLButtonElement>(null);
  const switchTrigger = useRef<HTMLButtonElement>(null);
  const currentCue = useRef(onCue);
  const playedFrame = useRef<BattleFrame>(undefined);
  currentCue.current = onCue;
  const queue = useRef<BattleFrame[]>([]);
  const gate = useRef(false);
  const committed = useRef(false);
  const dismissed = useRef(false);
  const stopVoice = useRef<(() => void) | undefined>(undefined);
  const state = frame.state;
  const lead = activeMember(state);
  const trial = Boolean(encounter.trial);
  const trainerBattle = isTrainerBattle(state, trial);
  const title = trial ? '东渡口试炼' : trainerBattle ? '训练家切磋' : '野外战斗';
  const canAct = !frame.duration && !state.outcome;
  const choosing: PartyAction | undefined = canAct ? lead.hp === 0 ? 'replacement' : partyAction : undefined;
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
  const moveInfo = displayedMoves.map(id => ({ id, info: describeMove(id, lead, state.enemy, state.stages.ally.accuracy) }));
  const stageRows = [{ member: lead, stages: state.stages.ally }, { member: state.enemy, stages: state.stages.enemy }]
    .map(({ member, stages }) => ({ name: creatures[member.id].name, summary: stageSummary(stages) })).filter(row => row.summary);
  const referenceTitle = reference === 'moves' ? '招式资料' : '对战记录';

  const nextFrame = useCallback(() => {
    const next = queue.current.shift();
    if (!next) return;
    // The idle frame keeps displaying the previous announcement while accepting input.
    if (next.duration || next.state.outcome) setAnnouncements(history => recordAnnouncement(history, next));
    setPresentation(current => ({ frame: next, previous: current.frame, serial: current.serial + 1 }));
  }, []);

  useEffect(() => {
    if (!overlay.current?.contains(document.activeElement)) overlay.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => () => stopVoice.current?.(), []);
  useEffect(() => {
    const entrance = serial === 0 && frame.state.turn === 1 && !frame.state.outcome;
    if (!entrance && frame.cue !== 'switch') return;
    const timer = window.setTimeout(() => {
      stopVoice.current?.();
      stopVoice.current = onSpeciesCry?.(entrance ? frame.state.enemy.id : frame.state.active);
    }, entrance ? 80 : contact);
    return () => window.clearTimeout(timer);
  }, [frame, serial, onSpeciesCry, contact]);
  useEffect(() => {
    if (reference) historyClose.current?.focus({ preventScroll: true });
  }, [reference]);
  useEffect(() => {
    if (reference) return;
    const focused = document.activeElement;
    const inBattle = focused === document.body || overlay.current?.contains(focused);
    if (isComplete && inBattle && focused !== historyTrigger.current && focused !== moveTrigger.current) returnButton.current?.focus({ preventScroll: true });
    else if (canAct && focused === document.body) overlay.current?.focus({ preventScroll: true });
  }, [canAct, reference, isComplete]);
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
  useLayoutEffect(() => { onPresent?.(state); }, [state, onPresent]);
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
    if (reference === 'moves') setReference(undefined);
    stopVoice.current?.();
    if (checkpoint) onCheckpoint?.(checkpointTurn(checkpoint, sequence));
    setPartyAction(undefined);
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

  function closeReference() {
    setReference(undefined);
    (reference === 'moves' ? moveTrigger : historyTrigger).current?.focus({ preventScroll: true });
  }

  function toggleReference(next: 'history' | 'moves') {
    if (reference === next) closeReference();
    else { setPartyAction(undefined); setReference(next); }
  }

  function closeParty() {
    const trigger = partyAction === 'potion' ? potionTrigger : switchTrigger;
    setPartyAction(undefined);
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  }

  function selectPotion() {
    const targets = potionTargets(state);
    if (targets.length === 1 && targets[0].id === state.active) act({ kind: 'potion', id: state.active });
    else setPartyAction('potion');
  }

  return <section ref={overlay} className="battle-overlay" aria-label={title} tabIndex={-1} onKeyDown={event => {
    if (reference && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeReference();
      return;
    }
    if (choosing && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (choosing !== 'replacement') closeParty();
      return;
    }
    if (reference || event.altKey || event.ctrlKey || event.metaKey || event.repeat || choosing) return;
    if (!/^[1-4]$/.test(event.key)) return;
    const id = displayedMoves[Number(event.key) - 1];
    if (id) {
      event.preventDefault();
      act({ kind: 'move', move: id });
    }
  }}>
    <div className="battle-topline"><span><Swords size={15} />{title}{state.trainer && ` · ${state.trainer}`}</span>
      <div className="battle-topline-tools"><span>回合 {String(state.turn).padStart(2, '0')}</span>
        <button type="button" className="battle-history-trigger" ref={moveTrigger} aria-label="招式资料" aria-expanded={reference === 'moves'} aria-controls={historyId}
          onClick={() => toggleReference('moves')}><Swords size={14} aria-hidden="true" />招式</button>
        <button type="button" className="battle-history-trigger" ref={historyTrigger} aria-label="对战记录" aria-expanded={reference === 'history'} aria-controls={historyId}
          onClick={() => toggleReference('history')}><BookOpen size={14} aria-hidden="true" /><span><span className="battle-log-prefix">对战</span>记录</span></button>
      </div>
    </div>
    <div className="battle-arena" data-night={night || undefined} data-effect={frame.effect} data-outcome={state.outcome}
      data-replacing={choosing === 'replacement' || undefined}
      data-move-type={frame.moveType} data-move={move?.id} data-reaction={move?.result} data-capture={frame.capture} data-cue={frame.cue}
      style={{ '--impact-delay': `${contact}ms`, '--capture-duration': `${frame.duration}ms` } as CSSProperties}>
      <BattleScenery night={night} />
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
    <aside id={historyId} className="battle-history" hidden={!reference} aria-labelledby={`${historyId}-title`}>
      <header className="battle-history-header"><h3 id={`${historyId}-title`}>{referenceTitle}</h3>
        <button type="button" className="battle-history-close" ref={historyClose} aria-label={`关闭${referenceTitle}`} onClick={closeReference}><X size={16} aria-hidden="true" /></button>
      </header>
      {reference === 'moves' ? <div className="battle-move-reference" tabIndex={0} aria-label={`${creatures[lead.id].name}的招式与能力`}>
        {stageRows.map((row, index) => <p className="battle-stage-summary" key={index}><b>{row.name}</b> {row.summary}</p>)}
        <dl>{moveInfo.map(({ id, info }) => <div key={id}><dt><TypeIcon type={info.move.type} />{info.move.name}</dt><dd>{info.description}</dd></div>)}</dl>
      </div> : <ol className="battle-history-list" tabIndex={0} aria-label="最近的对战回合">{[...announcements].reverse().map(entry => <li key={entry.id}>
        <span className="battle-history-turn">回合 {String(entry.turn).padStart(2, '0')}</span>
        <div><p>{entry.message}</p>{entry.detail && <small className="battle-history-detail">{entry.detail}</small>}</div>
      </li>)}</ol>}
    </aside>
    <div className="battle-console" data-ready={canAct} data-choosing={choosing}>
      <p className="battle-text" role="status" aria-live={reference ? 'off' : 'polite'}><Sparkles size={14} aria-hidden="true" />
        <span>{firstSentence ? <>{frame.message.slice(0, firstSentence)}
          <span key={serial} className="battle-followup" style={{ '--impact-delay': `${contact}ms` } as CSSProperties}>{frame.message.slice(firstSentence)}</span></> : frame.message}</span>
      </p>
      {isComplete ? <div className="battle-finish"><button ref={returnButton} type="button" onClick={close}>返回环城</button></div> : <>
        <div className="battle-moves" aria-label="可用招式" inert={Boolean(choosing)}>
          {moveInfo.map(({ id, info }) => <MoveButton key={id} id={id} info={info} disabled={!canAct}
            active={move?.source === 'ally' && move.id === id && move.result !== 'stalled'}
            onPick={move => act({ kind: 'move', move })} />)}
        </div>
        <div className="battle-utilities" aria-label="战斗操作" inert={Boolean(choosing)}>
          <button type="button" ref={potionTrigger} onClick={selectPotion} disabled={!canAct || !canUsePotion(state)} aria-label="使用伤药" title={`恢复最多 ${potionHp} HP`}><Cross size={15} /><span>伤药</span><small>×{state.progress.medicine}</small></button>
          <button type="button" onClick={() => act({ kind: 'ball' })} disabled={!canAct || !canThrowBall(state, trial)} aria-label="投掷精灵球" title={trainerBattle ? '无法捕捉训练家的宝可梦' : '削弱体力会提高捕捉率'}><CircleDot size={15} /><span>精灵球</span><small>×{state.progress.charms}</small></button>
          <button type="button" ref={switchTrigger} onClick={() => setPartyAction('switch')} aria-expanded={choosing === 'switch'} aria-label="更换出场伙伴" disabled={!canAct || !reserves.length}><Backpack size={14} /><span>换人</span></button>
          <button type="button" onClick={() => act({ kind: 'run' })} disabled={!canAct || trainerBattle} title={trainerBattle ? '训练家对战中无法撤退' : '尝试逃离本场对战'}><DoorOpen size={15} /><span>撤退</span></button>
        </div>
      </>}
      {choosing && <BattleParty key={choosing} action={choosing} members={choosing === 'potion' ? potionTargets(state) : reserves}
        active={lead.id} stock={state.progress.medicine} onCancel={closeParty}
        onPick={id => act(choosing === 'potion' ? { kind: 'potion', id } : { kind: 'switch', id })} />}
    </div>
  </section>;
}
