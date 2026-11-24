import {
  accuracyChance, ailmentLabels, attackDamage, canReceivePotion, catchChance, creatures, effectiveness, freshStages, gainXp,
  givePotion, makeMember, maxHp, maxLevel, movePP, moves, readyMoves, setMember, stageLabels, statValue,
  type BattleEncounter, type BattleProgress, type BattleResult, type CreatureId, type MoveEffect, type MoveId,
  type PokemonType, type Stage, type Stages, type TeamMember,
} from './creatures';

export type BattleEffect = 'playerHit' | 'enemyHit' | 'ward' | 'heal' | 'capture' | 'escape' | 'enemyFaint' | 'playerFaint' | 'charging' | '';
export type BattleCue = 'hit' | 'heal' | 'capture' | 'miss' | 'faint' | 'switch' | 'escape';
export type BattleSide = 'ally' | 'enemy';
type Side = BattleSide;

export type MovePresentation = {
  id: MoveId;
  source: BattleSide;
  target: BattleSide;
  result: 'hit' | 'status' | 'miss' | 'immune' | 'stalled' | 'recoil';
  critical?: boolean;
  effectiveness?: number;
};

type BattlePresentation = {
  effect: BattleEffect;
  message: string;
  detail?: string;
  moveType?: PokemonType;
  move?: MovePresentation;
  capture?: 'shake' | 'break';
  cue?: BattleCue;
};

export type BattleState = {
  progress: BattleProgress;
  active: CreatureId;
  enemy: TeamMember;
  stages: Record<Side, Stages>;
  participants: CreatureId[];
  turn: number;
  escapes: number;
  trainer?: string;
  outcome?: BattleResult['outcome'];
};

export type BattleFrame = BattlePresentation & { state: BattleState; duration: number };
export type BattleCommand = { kind: 'move'; move: MoveId } | { kind: 'switch'; id: CreatureId }
  | { kind: 'potion'; id?: CreatureId } | { kind: 'ball' | 'run' };

const boosted = ['attack', 'defense', 'specialAttack', 'specialDefense', 'speed'] as const;
const tacticalPause = 1180;
const captureAttempt = 1360;
const actionBeat = 540;

export function beginBattle(encounter: BattleEncounter, progress: BattleProgress): BattleFrame {
  const lead = progress.team.find(member => member.id === progress.lead && member.hp > 0)
    ?? progress.team.find(member => member.hp > 0) ?? progress.team[0];
  const enemy = makeMember(encounter.creature, encounter.level);
  const species = creatures[enemy.id];
  const trainer = encounter.trainer?.trim() || undefined;
  const state: BattleState = {
    progress, enemy, active: lead.id, stages: { ally: freshStages(), enemy: freshStages() }, participants: [lead.id], turn: 1, escapes: 0, trainer,
    outcome: lead.hp === 0 ? 'lost' : undefined,
  };
  const introduction = encounter.trial ? `${trainer ?? '渡口守望员'}的${species.name}登场，试炼开始！`
    : trainer ? `${trainer}派出了${species.name}。切磋开始！` : `草丛里跃出了一只野生${species.name}！`;
  const message = lead.hp === 0 ? '队伍需要先恢复体力。' : introduction;
  return { state, message, duration: 0, effect: '' };
}

export const activeMember = (state: BattleState) => state.progress.team.find(member => member.id === state.active)!;
export const healthyReserves = (state: BattleState) => state.progress.team.filter(member => member.id !== state.active && member.hp > 0);
export const potionTargets = (state: BattleState) => state.progress.team.filter(canReceivePotion);
export const canUsePotion = (state: BattleState) => !state.outcome && state.progress.medicine > 0 && potionTargets(state).length > 0;
export const isTrainerBattle = (state: BattleState, trial: boolean) => Boolean(trial || state.trainer);
export const canThrowBall = (state: BattleState, trial: boolean) => !isTrainerBattle(state, trial) && !state.outcome && state.enemy.hp > 0
  && state.progress.charms > 0 && !state.progress.team.some(member => member.id === state.enemy.id);

export function battleResult(state: BattleState): BattleResult | undefined {
  if (!state.outcome) return;
  const selection = state.progress.team.find(member => member.id === state.progress.lead && member.hp > 0);
  const replacement = activeMember(state).hp > 0 ? state.active : state.progress.team.find(member => member.hp > 0)?.id;
  const lead = selection?.id ?? replacement ?? state.progress.lead;
  return { outcome: state.outcome, progress: { ...state.progress, lead }, creature: state.enemy.id };
}

function foeMove(state: BattleState, trial: boolean, random: () => number): MoveId {
  const available = readyMoves(state.enemy);
  const ally = activeMember(state);
  if (!isTrainerBattle(state, trial) && state.enemy.id === 'starly' && state.progress.team.length === 1) {
    const tutorial = state.turn % 3 === 1 ? 'growl' : state.turn % 3 === 2 ? 'tackle' : 'quick-attack';
    if (available.includes(tutorial)) return tutorial;
  }
  if (trial && state.enemy.id === 'gible') {
    const sequence: MoveId[] = ['tackle', 'bulldoze', 'tackle', 'dragon-claw'];
    const next = sequence[(state.turn - 1) % sequence.length];
    if (available.includes(next)) return next;
  }
  const setup = available.find(id => {
    const effect = moves[id].effect;
    return moves[id].category === 'status' && effect?.kind === 'stage' && (effect.target === 'self'
      ? state.stages.enemy[effect.stat] === 0 : state.stages.ally[effect.stat] > -2);
  });
  if (setup && state.turn % 4 === 1 && random() < .52) return setup;
  const byPower = available.filter(id => moves[id].power && effectiveness(id, ally.id) > 0).sort((a, b) => {
    const impact = (id: MoveId) => moves[id].power * effectiveness(id, ally.id) * (creatures[state.enemy.id].types.includes(moves[id].type) ? 1.5 : 1);
    return impact(b) - impact(a);
  });
  return byPower[Math.floor(random() * Math.min(byPower.length, 2))] ?? setup ?? available[0];
}

export function resolveBattleTurn(initial: BattleState, command: BattleCommand, trial: boolean, random = Math.random): BattleFrame[] {
  if (initial.outcome) return [];
  let state = initial;
  const frames: BattleFrame[] = [];
  const flinched = new Set<Side>();
  const acted = new Set<Side>();
  const current = (side: Side) => side === 'ally' ? activeMember(state) : state.enemy;
  const opposing = (side: Side): Side => side === 'ally' ? 'enemy' : 'ally';
  const name = (side: Side) => creatures[current(side).id].name;

  function emit(message: string, effect: BattleEffect = '', options: Partial<Pick<BattleFrame, 'detail' | 'moveType' | 'move' | 'capture' | 'cue' | 'duration'>> = {}) {
    frames.push({ state, message, duration: actionBeat, effect, ...options });
  }

  function update(side: Side, member: TeamMember) {
    const next = member.hp === 0 && member.ailment ? { ...member, ailment: undefined } : member;
    state = side === 'ally' ? { ...state, progress: setMember(state.progress, next) } : { ...state, enemy: next };
  }

  function stageChange(side: Side, stat: Stage, amount: number) {
    const before = state.stages[side][stat];
    const after = Math.min(stat === 'focus' ? 2 : 6, Math.max(-6, before + amount));
    if (before === after) return false;
    state = { ...state, stages: { ...state.stages, [side]: { ...state.stages[side], [stat]: after } } };
    return true;
  }

  function applyEffect(side: Side, target: Side, effect?: MoveEffect): string {
    if (!effect || random() >= effect.chance) return '';
    if (effect.kind === 'stage') {
      const recipient = effect.target === 'self' ? side : target;
      const stat = stageLabels[effect.stat];
      if (stageChange(recipient, effect.stat, effect.amount)) return `${name(recipient)}的${stat}${effect.amount > 0 ? '上升' : '下降'}了。`;
      return `${stat}已经${effect.amount > 0 ? '无法继续提升' : '降到最低'}。`;
    }
    if (effect.kind === 'boost') {
      const changes = boosted.map(stat => stageChange(side, stat, 1));
      return changes.some(Boolean) ? `${name(side)}的各项能力上升了。` : '';
    }
    if (effect.kind === 'flinch') {
      if (!acted.has(target)) flinched.add(target);
      return '';
    }
    const recipient = current(target);
    if (recipient.ailment || (effect.ailment === 'freeze' && creatures[recipient.id].types.includes('ice'))) return '';
    update(target, { ...recipient, ailment: effect.ailment });
    return `${name(target)}陷入${ailmentLabels[effect.ailment]}。`;
  }

  function perform(side: Side, moveId: MoveId) {
    acted.add(side);
    let member = current(side);
    const species = creatures[member.id];
    const target = opposing(side);
    const move = moves[moveId];
    const moveType = move.type;
    const scene = { id: moveId, source: side, target };
    const stall = { ...scene, target: side, result: 'stalled' } as const;
    if (flinched.has(side)) {
      emit(`${species.name}畏缩了，没能行动。`, 'ward', { move: stall, cue: 'miss', duration: tacticalPause });
      return;
    }
    if (member.ailment === 'paralysis' && random() < .25) {
      emit(`${species.name}因麻痹没能行动。`, 'ward', { move: stall, cue: 'miss', duration: tacticalPause });
      return;
    }
    if (member.ailment === 'freeze') {
      if (random() >= .2) {
        emit(`${species.name}依然被冻住了。`, 'ward', { move: stall, cue: 'miss', duration: tacticalPause });
        return;
      }
      member = { ...member, ailment: undefined };
      update(side, member);
      emit(`${species.name}从冰冻中恢复。`, 'ward', { duration: tacticalPause });
    }
    if (moveId !== 'struggle') {
      member = { ...member, pp: { ...member.pp, [moveId]: movePP(member, moveId) - 1 } };
      update(side, member);
    }
    const detail = side === 'ally' && moveId !== 'struggle' ? `${move.name} · PP ${movePP(member, moveId)}/${move.pp}` : undefined;
    const announcement = `${species.name}使出${move.name}。`;
    if (random() >= accuracyChance(move, state.stages[side].accuracy)) {
      emit(`${announcement} 攻击没有命中。`, 'ward', { moveType, move: { ...scene, result: 'miss' }, detail, cue: 'miss', duration: tacticalPause });
      return;
    }
    if (move.category === 'status') {
      const effect = move.effect;
      const recipient = effect?.kind === 'boost' || (effect?.kind === 'stage' && effect.target === 'self') ? side : target;
      emit(`${announcement} ${applyEffect(side, target, effect)}`.trim(), 'ward', { moveType, move: { ...scene, target: recipient, result: 'status' }, detail });
      return;
    }
    const victim = current(target);
    const { damage, modifier, critical } = attackDamage(member, victim, moveId, state.stages[side], state.stages[target], random);
    if (modifier === 0) {
      emit(`${announcement} 对${name(target)}没有效果。`, 'ward', { moveType, move: { ...scene, result: 'immune' }, detail, cue: 'miss', duration: tacticalPause });
      return;
    }
    const injury = Math.min(damage, victim.hp);
    update(target, { ...victim, hp: victim.hp - injury });
    const secondary = victim.hp > injury ? applyEffect(side, target, move.effect) : '';
    const result = modifier > 1 ? '效果绝佳！' : modifier < 1 ? '效果不太理想。' : '';
    const crit = critical ? '击中要害！' : '';
    const keyImpact = critical || modifier > 1 || Boolean(secondary && move.effect?.kind === 'ailment');
    emit(`${announcement} ${name(target)}受到 ${injury} 点伤害。${result}${crit}${secondary}`, side === 'ally' ? 'enemyHit' : 'playerHit',
      { moveType, move: { ...scene, result: 'hit', critical, effectiveness: modifier }, detail, cue: 'hit', duration: keyImpact ? tacticalPause : actionBeat });
    if (moveId === 'struggle') {
      const recoil = Math.max(1, Math.round(maxHp(member) / 4));
      update(side, { ...member, hp: Math.max(0, member.hp - recoil) });
      emit(`${species.name}受到了反作用力伤害。`, side === 'ally' ? 'playerHit' : 'enemyHit',
        { move: { ...scene, target: side, result: 'recoil' }, duration: 290 });
    }
  }

  function send(id: CreatureId, message: string) {
    const participants = state.participants.includes(id) ? state.participants : [...state.participants, id];
    state = { ...state, active: id, stages: { ...state.stages, ally: freshStages() }, participants };
    emit(message, '', { cue: 'switch', duration: 490 });
  }

  function reward(outcome: 'won' | 'caught') {
    const caught = outcome === 'caught';
    const enemyName = creatures[state.enemy.id].name;
    const eligible = caught ? [] : state.progress.team.filter(member => member.hp > 0 && member.level < maxLevel && state.participants.includes(member.id));
    const xp = Math.max(1, Math.floor((state.enemy.level * (trial ? 5 : 3) + 4) / Math.max(1, eligible.length)));
    const upgraded = eligible.map(member => gainXp(member, xp));
    const team = state.progress.team.map(member => upgraded.find(trained => trained.id === member.id) ?? member);
    if (caught) team.push({ ...state.enemy, xp: 0 });
    state = {
      ...state, outcome: caught ? 'caught' : 'win',
      progress: { ...state.progress, team, wins: Math.min(Number.MAX_SAFE_INTEGER, state.progress.wins + Number(!caught)), trialWon: state.progress.trialWon || trial },
    };
    const levelUp = upgraded.find(trained => trained.level > (eligible.find(member => member.id === trained.id)?.level ?? 99));
    const progress = upgraded.length ? ` ${upgraded.length > 1 ? '参战伙伴各' : creatures[upgraded[0].id].name}获得 ${xp} 点经验。` : '';
    const level = levelUp ? ` ${creatures[levelUp.id].name}升至 Lv.${levelUp.level}！` : '';
    const announcement = caught ? `${enemyName}加入了队伍！` : trial ? '通过了东渡口试炼！'
      : state.trainer ? `赢下了与${state.trainer}的切磋！` : `战胜了野生${enemyName}。`;
    emit(`${announcement}${progress}${level}`, caught ? 'capture' : 'enemyFaint', { cue: caught ? 'capture' : 'faint', duration: 0 });
  }

  function checkFaint() {
    if (state.enemy.hp === 0 && state.progress.team.some(member => member.hp > 0)) {
      reward('won');
      return true;
    }
    if (activeMember(state).hp > 0) return false;
    const reserves = healthyReserves(state);
    const fallen = name('ally');
    if (reserves.length) {
      emit(`${fallen}失去了战斗能力。${reserves.length > 1 ? '请选择接替的伙伴。' : ''}`, 'playerFaint', { cue: 'faint', duration: 530 });
      if (reserves.length === 1) send(reserves[0].id, `${creatures[reserves[0].id].name}接替了${fallen}！`);
    } else {
      state = { ...state, outcome: 'lost' };
      emit(`${fallen}失去了战斗能力。队伍需要回港口休整。`, 'playerFaint', { cue: 'faint', duration: 0 });
    }
    return true;
  }

  if (activeMember(state).hp === 0) {
    if (command.kind !== 'switch' || !healthyReserves(state).some(member => member.id === command.id)) return [];
    send(command.id, `就决定是你了，${creatures[command.id].name}！`);
    emit('选择下一步行动。', '', { duration: 0 });
    return frames;
  }

  if (command.kind === 'move') {
    const ally = activeMember(state);
    if (!readyMoves(ally).includes(command.move)) return [];
    const enemyMove = foeMove(state, trial, random);
    const delta = moves[command.move].priority - moves[enemyMove].priority;
    const speed = statValue(ally, 'speed', state.stages.ally.speed) - statValue(state.enemy, 'speed', state.stages.enemy.speed);
    const allyFirst = delta !== 0 ? delta > 0 : speed !== 0 ? speed > 0 : random() < .5;
    const actions: [Side, MoveId][] = allyFirst ? [['ally', command.move], ['enemy', enemyMove]] : [['enemy', enemyMove], ['ally', command.move]];
    for (const [side, move] of actions) {
      perform(side, move);
      if (checkFaint()) break;
    }
  } else {
    if (command.kind === 'switch') {
      if (!healthyReserves(state).some(member => member.id === command.id)) return [];
      send(command.id, `${name('ally')}退回。派出了${creatures[command.id].name}！`);
    } else if (command.kind === 'potion') {
      const member = state.progress.team.find(ally => ally.id === (command.id ?? state.active));
      if (!member) return [];
      const progress = givePotion(state.progress, member.id);
      if (progress === state.progress) return [];
      state = { ...state, progress };
      const restored = progress.team.find(ally => ally.id === member.id)!.hp - member.hp;
      emit(`使用了伤药，${creatures[member.id].name}恢复 ${restored} 点体力。`, member.id === state.active ? 'heal' : '', { cue: 'heal' });
    } else if (command.kind === 'ball') {
      if (!canThrowBall(state, trial)) return [];
      const firstCatch = state.progress.team.length === 1;
      state = { ...state, progress: { ...state.progress, charms: state.progress.charms - 1 } };
      emit('投出了精灵球。', 'capture', { capture: 'shake', cue: 'capture', duration: captureAttempt });
      if (random() < catchChance(state.enemy, firstCatch)) reward('caught');
      else emit(`${name('enemy')}从精灵球里挣脱了！削弱体力或赋予异常状态可以提高捕捉率。`, 'capture', { capture: 'break', cue: 'miss', duration: tacticalPause });
    } else {
      if (isTrainerBattle(state, trial)) return [];
      const teamSpeed = statValue(activeMember(state), 'speed', state.stages.ally.speed);
      const foeSpeed = statValue(state.enemy, 'speed', state.stages.enemy.speed);
      const attempts = state.escapes + 1;
      const chance = Math.min(1, (Math.floor(teamSpeed * 128 / foeSpeed) + 30 * attempts) / 256);
      if (teamSpeed > foeSpeed || attempts >= 3 || random() < chance) {
        state = { ...state, outcome: 'fled' };
        emit('成功撤离了草丛。', 'escape', { cue: 'escape', duration: 0 });
      } else {
        state = { ...state, escapes: attempts };
        emit('对手挡住了退路。下一次尝试会更容易。', 'ward', { cue: 'miss', duration: tacticalPause });
      }
    }
    if (!state.outcome) {
      perform('enemy', foeMove(initial, trial, random));
      checkFaint();
    }
  }
  if (!state.outcome) {
    state = { ...state, turn: state.turn + 1 };
    const last = frames[frames.length - 1];
    emit(last?.message ?? '选择下一步行动。', '', { duration: 0 });
  }
  return frames;
}
