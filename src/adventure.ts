import { creatures, initialBattleProgress, makeMember, migrateBattleProgress, type BattleProgress, type CreatureId } from './creatures';
import type { EncounterKind, FieldArea, FieldLocation } from './field';
import { rooms } from './field-rooms';
import { fortressMapAt, fortressPier, isFortressRoom } from './field-fortress-state';
import { isMazeRoom, type MazeRoom } from './fortress-maze';
import { newMazeTrail, recordMazeStep, restoreMazeTrail, type MazeTrail } from './fortress-survey';
import { courtNotes, surveyStops, type SurveyId } from './field-city-walks';

export const areas = ['harbor', 'grove', 'summit'] as const;
export const entrance: FieldLocation = { area: 'harbor', x: 12, y: 12 };
export const saveKey = 'tidebound-save-v1';

export type AdventureSave = {
  location: FieldLocation;
  visited: FieldArea[];
  greeted: boolean;
  sparWon: boolean;
  courtVisits: SurveyId[];
  fortressOpened: boolean;
  tideDialAwake: boolean;
  kyuremObserved: boolean;
  shortcuts: MazeRoom[];
  mazeTrail: MazeTrail;
  fortressStartedAt?: number;
  seen: CreatureId[];
  battle: BattleProgress;
};

type WildPokemon = { creature: CreatureId; min: number; max: number; weight: number; nightWeight?: number; rustleWeight?: number };
const habitats: Record<FieldArea, readonly WildPokemon[]> = {
  harbor: [{ creature: 'starly', min: 3, max: 4, weight: 7, rustleWeight: 1 }, { creature: 'shinx', min: 3, max: 5, weight: 3, rustleWeight: 9 }],
  grove: [
    { creature: 'buizel', min: 4, max: 5, weight: 5, rustleWeight: 1 },
    { creature: 'drifloon', min: 4, max: 6, weight: 2, nightWeight: 6 },
    { creature: 'riolu', min: 5, max: 6, weight: 2, rustleWeight: 9 },
  ],
  summit: [{ creature: 'snover', min: 5, max: 7, weight: 5, rustleWeight: 1 }, { creature: 'gible', min: 5, max: 7, weight: 3, rustleWeight: 9 }],
};

export function speciesIn(area: FieldArea) {
  return habitats[area].map(entry => entry.creature);
}

export function chooseEncounter(area: FieldArea, firstPartner: CreatureId | undefined, night: boolean, kind: EncounterKind) {
  const list = habitats[area];
  if (firstPartner && area === 'harbor' && kind === 'grass') {
    return { creature: firstPartner === 'starly' ? 'shinx' as const : 'starly' as const, level: 3, area };
  }
  const weights = list.map(entry => {
    const ordinary = night ? entry.nightWeight ?? entry.weight : entry.weight;
    return kind === 'rustle' ? entry.rustleWeight ?? ordinary : ordinary;
  });
  let roll = Math.random() * weights.reduce((sum, value) => sum + value, 0);
  const match = list.find((_, index) => {
    roll -= weights[index];
    return roll < 0;
  }) ?? list[0];
  const level = kind === 'rustle' ? match.max : match.min + Math.floor(Math.random() * (match.max - match.min + 1));
  return { creature: match.creature, level, area };
}

function isArea(value: unknown): value is FieldArea {
  return typeof value === 'string' && areas.some(area => area === value);
}

function isCreature(value: unknown): value is CreatureId {
  return typeof value === 'string' && Object.hasOwn(creatures, value);
}

export function addSeen(save: AdventureSave, id: CreatureId): AdventureSave {
  return save.seen.includes(id) ? save : { ...save, seen: [...save.seen, id] };
}

export function recordCourt(save: AdventureSave, court: SurveyId): AdventureSave {
  if (save.courtVisits.includes(court)) return save;
  const courtVisits = [...save.courtVisits, court];
  const battle = courtVisits.length === surveyStops.length
    ? { ...save.battle, medicine: Math.min(Number.MAX_SAFE_INTEGER, save.battle.medicine + 2) }
    : save.battle;
  return { ...save, courtVisits, battle };
}

export function loadAdventure(): AdventureSave {
  const battle = initialBattleProgress();
  const initial: AdventureSave = { location: entrance, visited: ['harbor'], greeted: false, sparWon: false, courtVisits: [], fortressOpened: false, tideDialAwake: false, kyuremObserved: false, shortcuts: [], mazeTrail: newMazeTrail(), seen: battle.team.map(member => member.id), battle };
  try {
    const stored = localStorage.getItem(saveKey);
    if (stored === null) {
      const oldPartner: unknown = JSON.parse(localStorage.getItem('yu-world-partner') ?? 'null');
      if (!isCreature(oldPartner)) return initial;
      return { ...initial, seen: [oldPartner], battle: { ...battle, lead: oldPartner, team: [makeMember(oldPartner, 5)] } };
    }
    const saved: Partial<AdventureSave> | null = JSON.parse(stored);
    const location = saved?.location;
    const validLocation = location && isArea(location.area) && Number.isSafeInteger(location.x) && Number.isSafeInteger(location.y) &&
      (location.room === undefined || typeof location.room === 'string' && Object.hasOwn(rooms, location.room) && rooms[location.room].area === location.area);
    const visited = Array.isArray(saved?.visited) ? saved.visited.filter(isArea) : [];
    const progress = migrateBattleProgress(saved?.battle) ?? battle;
    const seen = Array.isArray(saved?.seen) ? saved.seen.filter(isCreature) : [];
    const fortressOpened = saved?.fortressOpened === true;
    const shortcuts = fortressOpened && Array.isArray(saved?.shortcuts) ? [...new Set(saved.shortcuts.filter(isMazeRoom))] : [];
    const started = saved?.fortressStartedAt;
    const fortressStartedAt = !fortressOpened && typeof started === 'number' && Number.isSafeInteger(started) && started > 0
      ? Math.min(Date.now(), started) : undefined;
    let restored = validLocation ? location : entrance;
    if (restored.fortressRoom !== undefined && (!fortressOpened || restored.area !== 'harbor' || restored.room ||
        !isFortressRoom(restored.fortressRoom) || !fortressMapAt(restored.fortressRoom, shortcuts).walkable[restored.y]?.[restored.x])) {
      restored = { area: 'harbor', ...fortressPier };
    }
    return {
      kyuremObserved: fortressOpened && saved?.kyuremObserved === true,
      shortcuts, mazeTrail: recordMazeStep(restoreMazeTrail(saved?.mazeTrail, shortcuts), restored),
      location: restored, fortressOpened, fortressStartedAt, tideDialAwake: fortressOpened && saved?.tideDialAwake === true,
      visited: [...new Set<FieldArea>(['harbor', ...visited, validLocation ? location.area : 'harbor'])],
      greeted: saved?.greeted === true,
      sparWon: saved?.sparWon === true,
      courtVisits: [...new Set(Array.isArray(saved?.courtVisits) ? saved.courtVisits.filter(id => typeof id === 'string' && Object.hasOwn(courtNotes, id)) : [])],
      seen: [...new Set([...seen, ...progress.team.map(member => member.id)])],
      battle: progress,
    };
  } catch { return initial; }
}
