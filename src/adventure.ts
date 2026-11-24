import { wallMap } from './fortress-wall-walk';
import { creatures, initialBattleProgress, makeMember, migrateBattleProgress, type BattleProgress, type CreatureId } from './creatures';
import type { EncounterKind, FieldArea, FieldLocation } from './field';
import { restoreBattleCheckpoint, type BattleCheckpoint } from './battle-checkpoint';
import { rooms } from './field-rooms';
import { fortressMapAt, fortressOrder, fortressPier, isFortressRoom, type FortressRoom } from './field-fortress-state';
import { isMazeRoom, migratePalaceLocation, migratePalaceTrail, palaceLayout, type MazeRoom } from './fortress-maze';
import { newMazeTrail, recordMazeStep, restoreMazeTrail, type MazeTrail } from './fortress-survey';
import { idleWard, restoreWard, type WardSurvey } from './fortress-ward-service';
import { courtNotes, surveyStops, type SurveyId } from './field-city-walks';

export const areas = ['harbor'] as const;
export const entrance: FieldLocation = { area: 'harbor', x: 12, y: 12 };
export const saveKey = 'tidebound-save-v1';

export type AdventureSave = {
  location: FieldLocation;
  palaceLayout?: number;
  visited: FieldArea[];
  greeted: boolean;
  sparWon: boolean;
  courtVisits: SurveyId[];
  fortressOpened: boolean;
  deepestFloor?: FortressRoom;
  tideDialAwake: boolean;
  gridLimited?: boolean;
  kyuremObserved: boolean;
  ward: WardSurvey;
  shortcuts: MazeRoom[];
  mazeTrail: MazeTrail;
  fortressStartedAt?: number;
  seen: CreatureId[];
  battle: BattleProgress;
  pendingBattle?: BattleCheckpoint;
};

type WildPokemon = { creature: CreatureId; min: number; max: number; weight: number; nightWeight?: number; rustleWeight?: number };
const habitats: Record<FieldArea, readonly WildPokemon[]> = {
  harbor: [
    { creature:'starly', min:3, max:4, weight:9, rustleWeight:2 }, { creature:'shinx', min:3, max:5, weight:7, rustleWeight:6 },
    { creature:'buizel', min:4, max:5, weight:5 }, { creature:'drifloon', min:4, max:6, weight:2, nightWeight:8 },
    { creature:'riolu', min:4, max:6, weight:2, rustleWeight:7 }, { creature:'snover', min:4, max:6, weight:3 },
    { creature:'gible', min:5, max:7, weight:2, rustleWeight:7 },
  ],
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

export function deepestVisited(...floors: unknown[]) {
  return [...fortressOrder].reverse().find(room => floors.includes(room));
}

export function restoreAdventure(raw: unknown, oldPartner?: unknown): AdventureSave {
  const battle = initialBattleProgress();
  const initial: AdventureSave = { palaceLayout, location: entrance, visited: ['harbor'], greeted: false, sparWon: false, courtVisits: [], fortressOpened: false, tideDialAwake: false, kyuremObserved: false, ward: idleWard, shortcuts: [], mazeTrail: newMazeTrail(), seen: battle.team.map(member => member.id), battle };
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    if (!isCreature(oldPartner)) return initial;
    return { ...initial, seen: [oldPartner], battle: { ...battle, lead: oldPartner, team: [makeMember(oldPartner, 5)] } };
  }
  const saved = raw as Partial<AdventureSave>;
  const old = saved.location as (Omit<FieldLocation,'area'> & {area: string}) | undefined;
  const relocated = old?.area === 'grove' || old?.area === 'summit';
  const oldEncounter = saved.pendingBattle?.encounter;
  const pending = relocated && oldEncounter?.area === old.area ? {
    ...saved.pendingBattle, encounter: { ...oldEncounter, area: 'harbor', trainer: oldEncounter.trainer === '林间陪练' ? '绿廊陪练' : oldEncounter.trainer },
  } : saved.pendingBattle;
  let location = saved.location;
  if (relocated) {
    if ((old.room === 'lab' || old.room === 'tower') && rooms[old.room].map.walkable[old.y]?.[old.x]) {
      location = {area:'harbor', room:old.room, x:old.x, y:old.y};
    } else {
      const point = pending?.encounter.trial ? {x:36,y:12} : pending?.encounter.trainer ? {x:21,y:13} : old.area==='grove' ? {x:24,y:11} : {x:30,y:11};
      location = {area:'harbor', ...point};
    }
  }
  const validLocation = location && isArea(location.area) && Number.isSafeInteger(location.x) && Number.isSafeInteger(location.y) &&
    (location.room === undefined || typeof location.room === 'string' && Object.hasOwn(rooms, location.room) && rooms[location.room].area === location.area);
  const progress = migrateBattleProgress(saved?.battle) ?? battle;
  const seen = Array.isArray(saved?.seen) ? saved.seen.filter(isCreature) : [];
  const fortressOpened = saved?.fortressOpened === true;
  const shortcuts = fortressOpened && Array.isArray(saved?.shortcuts) ? [...new Set(saved.shortcuts.filter(isMazeRoom))] : [];
  const started = saved?.fortressStartedAt;
  const fortressStartedAt = !fortressOpened && typeof started === 'number' && Number.isSafeInteger(started) && started > 0
    ? Math.min(Date.now(), started) : undefined;
  let restored = validLocation && location ? migratePalaceLocation(location, saved.palaceLayout) : entrance;
  if (restored.wallPassage !== undefined && (restored.wallPassage !== true || !fortressOpened || restored.fortressRoom || restored.room || !wallMap.walkable[restored.y]?.[restored.x])) {
    restored = { area:'harbor', ...fortressPier };
  }
  if (restored.fortressRoom !== undefined && (!fortressOpened || restored.area !== 'harbor' || restored.room ||
      !isFortressRoom(restored.fortressRoom) || !fortressMapAt(restored.fortressRoom, shortcuts).walkable[restored.y]?.[restored.x])) {
    restored = { area: 'harbor', ...fortressPier };
  }
  const mazeTrail = recordMazeStep(restoreMazeTrail(migratePalaceTrail(saved.mazeTrail,saved.palaceLayout), shortcuts), restored);
  const ward = fortressOpened ? restoreWard(saved.ward) : idleWard;
  const deepestFloor = fortressOpened ? deepestVisited(saved.deepestFloor, restored.fortressRoom, ...shortcuts,
    saved.tideDialAwake && 'sluice', mazeTrail.aqueduct.length && 'aqueduct', mazeTrail.catacomb.length && 'catacomb',
    (saved.kyuremObserved || ward.phase !== 'idle') && 'seal') : undefined;
  return {
    deepestFloor, palaceLayout,
    kyuremObserved: fortressOpened && saved?.kyuremObserved === true,
    gridLimited: fortressOpened && saved.gridLimited === true || undefined,
    ward, shortcuts, mazeTrail,
    location: restored, fortressOpened, fortressStartedAt, tideDialAwake: fortressOpened && saved?.tideDialAwake === true,
    visited: ['harbor'],
    greeted: saved?.greeted === true,
    sparWon: saved?.sparWon === true,
    courtVisits: [...new Set(Array.isArray(saved?.courtVisits) ? saved.courtVisits.filter(id => typeof id === 'string' && Object.hasOwn(courtNotes, id)) : [])],
    seen: [...new Set([...seen, ...progress.team.map(member => member.id)])],
    battle: progress,
    pendingBattle: restoreBattleCheckpoint(pending, restored),
  };
}
