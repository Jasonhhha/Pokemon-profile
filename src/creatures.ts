export const typeLabels = {
  normal: '一般', fighting: '格斗', flying: '飞行', poison: '毒', ground: '地面', rock: '岩石', bug: '虫', ghost: '幽灵', steel: '钢',
  fire: '火', water: '水', grass: '草', electric: '电', psychic: '超能力', ice: '冰', dragon: '龙', dark: '恶',
};
export type PokemonType = keyof typeof typeLabels;
export const typeColors: Record<PokemonType, string> = {
  normal: '#d4d2ba', fighting: '#f0967e', flying: '#afc8f1', poison: '#d5a7ec', ground: '#e3c280', rock: '#cbb28d', bug: '#c2d77d', ghost: '#b5a5e9',
  steel: '#c4d3d5', fire: '#f0a274', water: '#84ccea', grass: '#a7cb72', electric: '#f0d975', psychic: '#f1a6c6', ice: '#a9dfd7', dragon: '#baa8f0', dark: '#c3b5a9',
};

export type Ailment = 'paralysis' | 'freeze';
export const ailmentLabels = { paralysis: '麻痹', freeze: '冰冻' } as const;
export type Stat = 'attack' | 'defense' | 'specialAttack' | 'specialDefense' | 'speed';
export type Stage = Stat | 'accuracy' | 'focus';
export type Stages = Record<Stage, number>;
export const stageLabels: Record<Stage, string> = {
  attack: '攻击', defense: '防御', specialAttack: '特攻', specialDefense: '特防', speed: '速度', accuracy: '命中率', focus: '要害命中率',
};

export type MoveEffect =
  | { kind: 'stage'; stat: Stage; amount: number; target: 'self' | 'foe'; chance: number }
  | { kind: 'flinch'; chance: number }
  | { kind: 'ailment'; ailment: Ailment; chance: number }
  | { kind: 'boost'; chance: number };

export type Move = {
  name: string;
  english: string;
  type: PokemonType;
  category: 'physical' | 'special' | 'status';
  power: number;
  accuracy: number | null;
  pp: number;
  priority: number;
  effect?: MoveEffect;
  highCritical?: boolean;
};

function move(name: string, english: string, type: PokemonType, category: Move['category'], power: number, pp: number, accuracy: Move['accuracy'], options: Partial<Pick<Move, 'priority' | 'effect' | 'highCritical'>> = {}): Move {
  return { name, english, type, category, power, pp, accuracy, priority: 0, ...options };
}

// Data checked against PokéAPI's Black/White learnsets and move change history.
export const moves = {
  pound: move('拍击', 'Pound', 'normal', 'physical', 40, 35, 100),
  'bubble-beam': move('泡沫光线', 'Bubble Beam', 'water', 'special', 65, 20, 100,
    { effect: { kind: 'stage', stat: 'speed', amount: -1, target: 'foe', chance: .1 } }),
  peck: move('啄', 'Peck', 'flying', 'physical', 35, 35, 100),
  growl: move('叫声', 'Growl', 'normal', 'status', 0, 40, 100,
    { effect: { kind: 'stage', stat: 'attack', amount: -1, target: 'foe', chance: 1 } }),
  tackle: move('撞击', 'Tackle', 'normal', 'physical', 50, 35, 100),
  'quick-attack': move('电光一闪', 'Quick Attack', 'normal', 'physical', 40, 30, 100, { priority: 1 }),
  'wing-attack': move('翅膀攻击', 'Wing Attack', 'flying', 'physical', 60, 35, 100),
  leer: move('瞪眼', 'Leer', 'normal', 'status', 0, 30, 100,
    { effect: { kind: 'stage', stat: 'defense', amount: -1, target: 'foe', chance: 1 } }),
  bite: move('咬住', 'Bite', 'dark', 'physical', 60, 25, 100, { effect: { kind: 'flinch', chance: .3 } }),
  spark: move('电光', 'Spark', 'electric', 'physical', 65, 20, 100,
    { effect: { kind: 'ailment', ailment: 'paralysis', chance: .3 } }),
  'water-gun': move('水枪', 'Water Gun', 'water', 'special', 40, 25, 100),
  'aqua-jet': move('水流喷射', 'Aqua Jet', 'water', 'physical', 40, 20, 100, { priority: 1 }),
  astonish: move('惊吓', 'Astonish', 'ghost', 'physical', 30, 15, 100, { effect: { kind: 'flinch', chance: .3 } }),
  gust: move('起风', 'Gust', 'flying', 'special', 40, 35, 100),
  'focus-energy': move('聚气', 'Focus Energy', 'normal', 'status', 0, 30, null,
    { effect: { kind: 'stage', stat: 'focus', amount: 2, target: 'self', chance: 1 } }),
  'ominous-wind': move('奇异之风', 'Ominous Wind', 'ghost', 'special', 60, 5, 100, { effect: { kind: 'boost', chance: .1 } }),
  'force-palm': move('发劲', 'Force Palm', 'fighting', 'physical', 60, 10, 100,
    { effect: { kind: 'ailment', ailment: 'paralysis', chance: .3 } }),
  feint: move('佯攻', 'Feint', 'normal', 'physical', 30, 10, 100, { priority: 2 }),
  screech: move('刺耳声', 'Screech', 'normal', 'status', 0, 40, 85,
    { effect: { kind: 'stage', stat: 'defense', amount: -2, target: 'foe', chance: 1 } }),
  'sand-attack': move('泼沙', 'Sand Attack', 'ground', 'status', 0, 15, 100,
    { effect: { kind: 'stage', stat: 'accuracy', amount: -1, target: 'foe', chance: 1 } }),
  bulldoze: move('重踏', 'Bulldoze', 'ground', 'physical', 60, 20, 100,
    { effect: { kind: 'stage', stat: 'speed', amount: -1, target: 'foe', chance: 1 } }),
  'dragon-claw': move('龙爪', 'Dragon Claw', 'dragon', 'physical', 80, 15, 100),
  'powder-snow': move('细雪', 'Powder Snow', 'ice', 'special', 40, 25, 100,
    { effect: { kind: 'ailment', ailment: 'freeze', chance: .1 } }),
  'razor-leaf': move('飞叶快刀', 'Razor Leaf', 'grass', 'physical', 55, 25, 95, { highCritical: true }),
  'ice-shard': move('冰砾', 'Ice Shard', 'ice', 'physical', 40, 30, 100, { priority: 1 }),
  struggle: move('挣扎', 'Struggle', 'normal', 'physical', 50, 1, null),
};
export type MoveId = keyof typeof moves;

export type Species = {
  name: string;
  english: string;
  number: number;
  types: readonly PokemonType[];
  element: string;
  elementKey: PokemonType;
  color: string;
  asset: string;
  description: string;
  moves: readonly MoveId[];
  stats: Record<Stat | 'hp', number>;
  captureRate: number;
};

function species(name: string, english: string, number: number, types: readonly [PokemonType, ...PokemonType[]], filename: string, description: string,
  moves: readonly [MoveId, MoveId, MoveId, MoveId], [hp, attack, defense, specialAttack, specialDefense, speed]: [number, number, number, number, number, number], captureRate: number): Species {
  const [elementKey] = types;
  return { name, english, number, types, element: types.map(type => typeLabels[type]).join(' / '), elementKey, color: typeColors[elementKey],
    asset: `${import.meta.env.BASE_URL}assets/${filename}.png`, description, moves, stats: { hp, attack, defense, specialAttack, specialDefense, speed }, captureRate };
}

export const creatures = {
  piplup: species('波加曼', 'Piplup', 393, ['water'], 'piplup', '潮汐环城的第一位伙伴，常在渡口的栈桥下练习潜水。',
    ['pound', 'bubble-beam', 'peck', 'growl'], [53, 51, 53, 61, 56, 40], 45),
  starly: species('姆克儿', 'Starly', 396, ['normal', 'flying'], 'starly', '清晨会从潮汐环城的屋顶飞向外环的高草。',
    ['tackle', 'quick-attack', 'wing-attack', 'growl'], [40, 55, 30, 30, 30, 60], 255),
  shinx: species('小猫怪', 'Shinx', 403, ['electric'], 'shinx', '太阳下山后，偶尔能看到它的尾尖在草里发亮。',
    ['tackle', 'spark', 'bite', 'leer'], [45, 65, 34, 40, 34, 45], 235),
  buizel: species('泳圈鼬', 'Buizel', 418, ['water'], 'sinnoh/buizel', '住在雾杉小径水流较慢的地方，时常露出橙色尾巴。',
    ['quick-attack', 'water-gun', 'aqua-jet', 'growl'], [55, 65, 35, 60, 30, 85], 190),
  drifloon: species('飘飘球', 'Drifloon', 425, ['ghost', 'flying'], 'sinnoh/drifloon', '喜欢顺着杉林的雾气漂到观测站屋檐下。',
    ['astonish', 'gust', 'ominous-wind', 'focus-energy'], [90, 50, 34, 60, 44, 70], 125),
  riolu: species('利欧路', 'Riolu', 447, ['fighting'], 'riolu', '观测站的人常听见它在清晨练习步法。',
    ['quick-attack', 'force-palm', 'feint', 'screech'], [40, 70, 40, 35, 40, 60], 75),
  gible: species('圆陆鲨', 'Gible', 443, ['dragon', 'ground'], 'gible', '喜欢躲在高地风塔附近的岩缝里。',
    ['tackle', 'bulldoze', 'dragon-claw', 'sand-attack'], [58, 70, 45, 40, 45, 42], 45),
  snover: species('雪笠怪', 'Snover', 459, ['grass', 'ice'], 'sinnoh/snover', '远看像一棵矮杉，风大的时候才会匆匆挪窝。',
    ['powder-snow', 'razor-leaf', 'ice-shard', 'leer'], [60, 62, 50, 62, 60, 40], 120),
};

export type CreatureId = keyof typeof creatures;
export const starterId = 'piplup';
export type TeamMember = { id: CreatureId; level: number; xp: number; hp: number; pp?: Partial<Record<MoveId, number>>; ailment?: Ailment };
export type BattleProgress = {
  team: TeamMember[];
  lead: CreatureId;
  medicine: number;
  charms: number;
  wins: number;
  trialWon: boolean;
};
export type BattleEncounter = { creature: CreatureId; level: number; trial?: boolean; trainer?: string; area?: 'harbor' | 'grove' | 'summit' };
export type BattleResult = { outcome: 'win' | 'caught' | 'fled' | 'lost'; progress: BattleProgress; creature: CreatureId };

const supplies = { medicine: 3, charms: 4 };
const trainingIv = 15;
export const potionHp = 20;
export const maxLevel = 100;

const scaledStat = (base: number, level: number) => Math.floor((2 * base + trainingIv) * level / 100);
export const maxHp = ({ id, level }: Pick<TeamMember, 'id' | 'level'>) => scaledStat(creatures[id].stats.hp, level) + level + 10;
export const xpToNext = (level: number) => 6 + 2 * level;

export function makeMember(id: CreatureId, level: number): TeamMember {
  return { id, level, hp: maxHp({ id, level }), xp: 0 };
}

export function initialBattleProgress(): BattleProgress {
  return { team: [makeMember(starterId, 5)], lead: starterId, ...supplies, wins: 0, trialWon: false };
}

export function healTeam(progress: BattleProgress): BattleProgress {
  const team = progress.team.map(member => ({ id: member.id, level: member.level, xp: member.xp, hp: maxHp(member) }));
  return { ...progress, team, medicine: Math.max(progress.medicine, supplies.medicine), charms: Math.max(progress.charms, supplies.charms) };
}

const legacy = {
  mosswick: { id: 'piplup', baseHp: 28 }, brineling: { id: 'buizel', baseHp: 21 }, cinderfin: { id: 'shinx', baseHp: 20 },
  gustwing: { id: 'starly', baseHp: 24 }, cloudhorn: { id: 'snover', baseHp: 33 },
} as const satisfies Record<string, { id: CreatureId; baseHp: number }>;

function isCreatureId(value: unknown): value is CreatureId {
  return typeof value === 'string' && Object.hasOwn(creatures, value);
}

function oldSpecies(value: unknown) {
  return typeof value === 'string' && Object.hasOwn(legacy, value) ? legacy[value as keyof typeof legacy] : undefined;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function migrateBattleProgress(value: unknown): BattleProgress | null {
  if (typeof value !== 'object' || !value || !('team' in value) || !Array.isArray(value.team)) return null;
  const stored = value as Partial<BattleProgress>;
  const team = new Map<CreatureId, TeamMember>();
  const migrated = new Set<CreatureId>();
  for (const raw of value.team as unknown[]) {
    if (!raw || typeof raw !== 'object') continue;
    const entry = raw as Partial<TeamMember>;
    const previous = oldSpecies(entry.id);
    const id = previous?.id ?? entry.id;
    const level = entry.level;
    if (!isCreatureId(id) || !isCount(level) || level < 1 || level > maxLevel) continue;
    if (team.has(id) && (previous || !migrated.has(id))) continue;
    const member = makeMember(id, level);
    if (level < maxLevel && isCount(entry.xp)) member.xp = Math.min(entry.xp, xpToNext(level) - 1);
    if (isCount(entry.hp)) {
      const available = maxHp(member);
      const scaled = previous && entry.hp ? Math.max(1, Math.round(entry.hp * available / (previous.baseHp + 2 * level))) : entry.hp;
      member.hp = Math.min(available, scaled);
    }
    if (member.hp > 0 && (entry.ailment === 'paralysis' || entry.ailment === 'freeze')) member.ailment = entry.ailment;
    if (entry.pp && typeof entry.pp === 'object') {
      const pp: TeamMember['pp'] = {};
      for (const moveId of creatures[id].moves) {
        const count = entry.pp[moveId];
        if (isCount(count)) pp[moveId] = Math.min(count, moves[moveId].pp);
      }
      member.pp = pp;
    }
    team.set(id, member);
    if (previous) migrated.add(id);
    else migrated.delete(id);
  }
  const members = [...team.values()];
  if (!members.length) return null;
  const rawLead = oldSpecies(stored.lead)?.id ?? stored.lead;
  const lead = isCreatureId(rawLead) && team.has(rawLead) ? rawLead : members[0].id;
  return {
    team: members, lead,
    medicine: isCount(stored.medicine) ? stored.medicine : supplies.medicine,
    charms: isCount(stored.charms) ? stored.charms : supplies.charms,
    wins: isCount(stored.wins) ? stored.wins : 0,
    trialWon: stored.trialWon === true,
  };
}

export function setMember(progress: BattleProgress, member: TeamMember): BattleProgress {
  return { ...progress, team: progress.team.map(existing => existing.id === member.id ? member : existing) };
}

export function canReceivePotion(member: TeamMember) {
  return member.hp > 0 && member.hp < maxHp(member);
}

export function givePotion(progress: BattleProgress, id: CreatureId): BattleProgress {
  if (progress.medicine <= 0) return progress;
  const member = progress.team.find(candidate => candidate.id === id);
  if (!member || !canReceivePotion(member)) return progress;
  const hp = Math.min(member.hp + potionHp, maxHp(member));
  return setMember({ ...progress, medicine: progress.medicine - 1 }, { ...member, hp });
}

export function gainXp(member: TeamMember, amount: number): TeamMember {
  let { level, xp, hp } = member;
  xp += amount;
  while (xp >= xpToNext(level) && level < maxLevel) {
    xp -= xpToNext(level);
    level++;
    if (hp) hp += maxHp({ id: member.id, level }) - maxHp({ id: member.id, level: level - 1 });
  }
  return { ...member, level, hp, xp: level === maxLevel ? 0 : Math.min(xp, xpToNext(level) - 1) };
}

export function movePP(member: TeamMember, id: MoveId) {
  return member.pp?.[id] ?? moves[id].pp;
}

export function readyMoves(member: TeamMember): readonly MoveId[] {
  const available = creatures[member.id].moves.filter(id => movePP(member, id) > 0);
  return available.length > 0 ? available : ['struggle'];
}

const matchups: Record<PokemonType, Partial<Record<PokemonType, number>>> = {
  normal: { rock: .5, ghost: 0, steel: .5 },
  fighting: { normal: 2, flying: .5, poison: .5, rock: 2, bug: .5, ghost: 0, steel: 2, psychic: .5, ice: 2, dark: 2 },
  flying: { fighting: 2, rock: .5, bug: 2, steel: .5, grass: 2, electric: .5 },
  poison: { poison: .5, ground: .5, rock: .5, ghost: .5, steel: 0, grass: 2 },
  ground: { flying: 0, poison: 2, rock: 2, bug: .5, steel: 2, fire: 2, grass: .5, electric: 2 },
  rock: { fighting: .5, flying: 2, ground: .5, bug: 2, steel: .5, fire: 2, ice: 2 },
  bug: { fighting: .5, flying: .5, poison: .5, ghost: .5, steel: .5, fire: .5, grass: 2, psychic: 2, dark: 2 },
  ghost: { normal: 0, ghost: 2, steel: .5, psychic: 2, dark: .5 },
  steel: { rock: 2, steel: .5, fire: .5, water: .5, electric: .5, ice: 2 },
  fire: { rock: .5, bug: 2, steel: 2, fire: .5, water: .5, grass: 2, ice: 2, dragon: .5 },
  water: { ground: 2, rock: 2, fire: 2, water: .5, grass: .5, dragon: .5 },
  grass: { flying: .5, poison: .5, ground: 2, rock: 2, bug: .5, steel: .5, fire: .5, water: 2, grass: .5, dragon: .5 },
  electric: { flying: 2, ground: 0, water: 2, grass: .5, electric: .5, dragon: .5 },
  psychic: { fighting: 2, poison: 2, steel: .5, psychic: .5, dark: 0 },
  ice: { flying: 2, ground: 2, steel: .5, fire: .5, water: .5, grass: 2, ice: .5, dragon: 2 },
  dragon: { steel: .5, dragon: 2 },
  dark: { fighting: .5, ghost: 2, steel: .5, psychic: 2, dark: .5 },
};

export function effectiveness(move: MoveId, defender: CreatureId) {
  if (move === 'struggle' || moves[move].category === 'status') return 1;
  return creatures[defender].types.reduce((multiplier, type) => multiplier * (matchups[moves[move].type][type] ?? 1), 1);
}

export function freshStages(): Stages {
  return { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, focus: 0 };
}

const stageMultiplier = (stage: number) => stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);

export function statValue(member: TeamMember, stat: Stat, stage: number) {
  const base = scaledStat(creatures[member.id].stats[stat], member.level) + 5;
  const status = stat === 'speed' && member.ailment === 'paralysis' ? .25 : 1;
  return Math.max(1, Math.floor(base * stageMultiplier(stage) * status));
}

export function accuracyChance(move: Move, stage: number) {
  if (move.accuracy === null) return 1;
  return Math.min(1, move.accuracy / 100 * (3 + Math.max(0, stage)) / (3 - Math.min(0, stage)));
}

export function attackDamage(from: TeamMember, to: TeamMember, moveId: MoveId, attacker: Stages, defender: Stages, random: () => number) {
  const move = moves[moveId];
  const modifier = effectiveness(moveId, to.id);
  if (!move.power || modifier === 0) return { damage: 0, modifier, critical: false };
  const criticalStage = Math.min(4, attacker.focus + Number(Boolean(move.highCritical)));
  const critical = random() >= 1 - [1 / 16, 1 / 8, 1 / 4, 1 / 3, 1 / 2][criticalStage];
  const attackStat = move.category === 'special' ? 'specialAttack' : 'attack';
  const defenseStat = move.category === 'special' ? 'specialDefense' : 'defense';
  const attack = statValue(from, attackStat, critical ? Math.max(0, attacker[attackStat]) : attacker[attackStat]);
  const defense = statValue(to, defenseStat, critical ? Math.min(0, defender[defenseStat]) : defender[defenseStat]);
  const base = Math.floor((Math.floor(2 * from.level / 5) + 2) * move.power * attack / defense / 50) + 2;
  const sameType = moveId !== 'struggle' && creatures[from.id].types.includes(move.type) ? 1.5 : 1;
  const variance = 85 + Math.floor(random() * 16);
  const rolled = Math.floor(base * (critical ? 2 : 1) * variance / 100);
  const boosted = Math.floor(rolled * sameType);
  return { damage: Math.max(1, Math.floor(boosted * modifier)), modifier, critical };
}

export function catchChance(member: TeamMember, firstCatch = false) {
  const max = maxHp(member);
  const status = member.ailment === 'freeze' ? 2.5 : member.ailment === 'paralysis' ? 1.5 : 1;
  const health = (3 * max - 2 * member.hp) / (3 * max);
  const base = health * creatures[member.id].captureRate / 255 * status;
  return Math.min(1, base * 1.23 + (firstCatch ? .12 : 0));
}
