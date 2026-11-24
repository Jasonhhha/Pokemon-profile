import type { CreatureId } from './creatures';
import type { Direction } from './field';
import type { FieldMap } from './field-layout';

export type FortressRoom = 'sluice' | 'seal';
export type FortressPhase = 'submerged' | 'rising' | 'draining' | 'open';
export type FortressView = { phase: FortressPhase; lift: number; drain: number; cinematic: boolean };
export type FortressInteriorFrame = {
  room: FortressRoom;
  x: number;
  y: number;
  facing: Direction;
  stride: number;
  gaitPhase?: number;
  now: number;
  reduced: boolean;
  inspecting: boolean;
  companionId?: CreatureId;
  companionImage?: HTMLCanvasElement;
  companionX?: number;
  companionY?: number;
};

export const fortressPier = { x: 3, y: 12 };
export const fortressRooms = {
  sluice: { name: '排水闸廊', english: 'SLUICE GALLERY', floor: '地下一层' },
  seal: { name: '深潮封印池', english: 'PELAGIC VAULT', floor: '地下二层' },
};
export const sleepingFortress: FortressView = { phase: 'submerged', lift: 0, drain: 0, cinematic: false };
export const openFortress: FortressView = { phase: 'open', lift: 1, drain: 1, cinematic: false };
export const isFortressRoom = (value: unknown): value is FortressRoom => value === 'sluice' || value === 'seal';

export function fortressSequence(elapsed: number, reduced: boolean): FortressView {
  const rise = reduced ? 450 : 4700;
  const empty = reduced ? 640 : 5100;
  if (elapsed < rise) return { phase: 'rising', lift: reduced ? .52 : elapsed / rise, drain: 0, cinematic: true };
  if (elapsed < rise + empty) return { phase: 'draining', lift: 1, drain: reduced ? .55 : (elapsed - rise) / empty, cinematic: true };
  return elapsed < rise + empty + (reduced ? 200 : 1250) ? { ...openFortress, cinematic: true } : openFortress;
}

function interiorMap(room: FortressRoom): FieldMap {
  const width = 17, height = 20;
  const walkable = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => {
    if (room === 'seal') return y >= 11 && y <= 18 && (x >= 7 && x <= 9 || y >= 15 && x >= 4 && x <= 12);
    if (y < 3 || y > 17 || x < 3 || x > 13) return false;
    if (y <= 4 || y >= 16) return x >= 7 && x <= 9;
    return x >= 7 && x <= 9 || y === 6 || y === 12 || x === 3 || x === 13;
  }));
  return { width, height, walkable, grass: walkable.map(row => row.map(() => false)), npcs: [], exits: [],
    spawn: { x: 8, y: room === 'sluice' ? 16 : 17 } };
}

export const fortressMaps = { sluice: interiorMap('sluice'), seal: interiorMap('seal') };
