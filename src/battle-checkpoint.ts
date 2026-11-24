import { beginBattle, type BattleFrame, type BattleState } from './battle-turn';
import { creatures, freshStages, maxLevel, migrateBattleProgress, type BattleEncounter, type BattleProgress, type CreatureId } from './creatures';
import type { FieldArea, FieldLocation } from './field';

type Announcement = { id: number; turn: number; message: string; detail?: string };
type FieldEncounter = BattleEncounter & { area: FieldArea };
export type BattleCheckpoint = {
  version: 1;
  encounter: FieldEncounter;
  state: BattleState;
  history: Announcement[];
};

const historyLimit = 12;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isSpecies = (value: unknown): value is CreatureId => typeof value === 'string' && Object.hasOwn(creatures, value);
const integer = (value: unknown, minimum: number): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;

export function recordAnnouncement(history: Announcement[], frame: BattleFrame): Announcement[] {
  const { message, detail, state: { turn } } = frame;
  if (history.some(entry => entry.turn === turn && entry.message === message && entry.detail === detail)) return history;
  const id = (history.at(-1)?.id ?? 0) + 1;
  return [...history.slice(1 - historyLimit), { id, turn, message, detail }];
}

export function beginCheckpoint(encounter: FieldEncounter, progress: BattleProgress): BattleCheckpoint {
  const frame = beginBattle(encounter, progress);
  return { version: 1, encounter, state: frame.state, history: recordAnnouncement([], frame) };
}

export function checkpointTurn(checkpoint: BattleCheckpoint, frames: BattleFrame[]): BattleCheckpoint {
  const last = frames.at(-1);
  if (!last) return checkpoint;
  // Commit the entire decided turn together. Reopening during an effect must never replay its cost or roll.
  const history = frames.filter(frame => frame.duration || frame.state.outcome).reduce(recordAnnouncement, checkpoint.history);
  return { ...checkpoint, state: last.state, history };
}

export function resumeFrame(checkpoint: BattleCheckpoint): BattleFrame {
  const latest = checkpoint.history.at(-1);
  const { state } = checkpoint;
  const effect = state.outcome === 'win' ? 'enemyFaint' : state.outcome === 'lost' ? 'playerFaint'
    : state.outcome === 'caught' ? 'capture' : state.outcome === 'fled' ? 'escape' : '';
  return { state, message: latest?.message ?? '选择下一步行动。', detail: latest?.detail, duration: 0, effect };
}

function readStages(raw: unknown) {
  const stages = freshStages();
  if (!isRecord(raw)) return stages;
  for (const key of Object.keys(stages) as (keyof typeof stages)[]) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isSafeInteger(value)) {
      stages[key] = key === 'focus' ? Math.max(0, Math.min(2, value)) : Math.max(-6, Math.min(6, value));
    }
  }
  return stages;
}

function readHistory(raw: unknown, turn: number): Announcement[] {
  if (!Array.isArray(raw)) return [];
  const history: Announcement[] = [];
  for (const entry of raw.slice(-historyLimit)) {
    if (!isRecord(entry) || !integer(entry.turn, 1) || entry.turn > turn || typeof entry.message !== 'string' || !entry.message) continue;
    history.push({ id: history.length + 1, turn: entry.turn, message: entry.message.slice(0, 320),
      detail: typeof entry.detail === 'string' ? entry.detail.slice(0, 140) : undefined });
  }
  return history;
}

export function restoreBattleCheckpoint(raw: unknown, location: FieldLocation): BattleCheckpoint | undefined {
  if (!isRecord(raw) || raw.version !== 1 || !isRecord(raw.encounter) || !isRecord(raw.state)) return;
  const entry = raw.encounter;
  if (location.wallPassage || location.room || location.fortressRoom || entry.area !== location.area || !isSpecies(entry.creature)
    || !integer(entry.level, 1) || entry.level > maxLevel) return;
  const encounter: FieldEncounter = { area: location.area, creature: entry.creature, level: entry.level,
    trial: entry.trial === true || undefined, trainer: typeof entry.trainer === 'string' ? entry.trainer.trim().slice(0, 64) || undefined : undefined };
  const saved = raw.state;
  const progress = migrateBattleProgress(saved.progress);
  const enemy = migrateBattleProgress({ team: [saved.enemy] })?.team[0];
  if (!progress || !enemy || enemy.id !== encounter.creature || enemy.level !== encounter.level
    || !isSpecies(saved.active) || !progress.team.some(member => member.id === saved.active) || !integer(saved.turn, 1)) return;
  const outcome = saved.outcome;
  const survivors = progress.team.some(member => member.hp > 0);
  if (outcome !== undefined && outcome !== 'win' && outcome !== 'caught' && outcome !== 'fled' && outcome !== 'lost') return;
  if ((outcome === 'lost') !== !survivors || outcome === 'win' && enemy.hp > 0 || !outcome && enemy.hp === 0) return;
  if ((outcome === 'caught' || outcome === 'fled') && (encounter.trainer || encounter.trial)) return;
  if (outcome === 'caught' && !progress.team.some(member => member.id === enemy.id)) return;
  const participants = Array.isArray(saved.participants)
    ? saved.participants.filter((id): id is CreatureId => isSpecies(id) && progress.team.some(member => member.id === id)) : [];
  const stages = isRecord(saved.stages) ? saved.stages : {};
  const state: BattleState = { progress, enemy, active: saved.active, turn: saved.turn, outcome, trainer: encounter.trainer,
    participants: [...new Set([...participants, saved.active])], stages: { ally: readStages(stages.ally), enemy: readStages(stages.enemy) },
    escapes: integer(saved.escapes, 0) ? Math.min(2, saved.escapes) : 0 };
  return { version: 1, encounter, state, history: readHistory(raw.history, state.turn) };
}
