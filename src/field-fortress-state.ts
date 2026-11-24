import type { CreatureId } from './creatures';
import type { Direction } from './field';
import type { FieldMap } from './field-layout';
import { wardWalkway, type WardSurvey } from './fortress-ward-service';
import { catacombLift, isMazeRoom, mazeFieldMap, mazeFloors, type MazeRoom } from './fortress-maze';

import type { GridReading } from './fortress-power';

export type FortressRoom = 'sluice' | MazeRoom | 'seal';
export type RoarPhase = 'quiet' | 'breath' | 'roar' | 'impact';
export const kyuremTiming = { voice: .46, impact: .78, decay: 2.6 };
export type FortressPhase = 'submerged' | 'rising' | 'draining' | 'open';
export type FortressView = { phase: FortressPhase; lift: number; drain: number; cinematic: boolean };
export type FortressInteriorFrame = {
  room: FortressRoom;
  x: number;
  y: number;
  facing: Direction;
  palaceView?: import('./palace-overlook').PalaceOrbit;
  stride: number;
  gaitPhase?: number;
  now: number;
  reduced: boolean;
  inspecting: boolean;
  resonance: number;
  power?: GridReading;
  shortcutOpen: boolean;
  liftUnlocked: boolean;
  liftPassage?: { down: boolean; fraction: number };
  gateAge: number;
  roarAge: number;
  ward?: WardSurvey;
  wardAdjustmentAge?: number;
  wardSettledAge?: number;
  companionId?: CreatureId;
  companionImage?: HTMLCanvasElement;
  companionX?: number;
  companionY?: number;
};

export const fortressPier = { x: 3, y: 12 };
export const fortressLiftStops = { sluice: { x: 3, y: 12 }, catacomb: catacombLift } as const;
export const fortressDial = { x: 8, y: 8 };
export const fortressLiftDepth = 21.6;
export const fortressTiming = { rise: 8500, empty: 9500, open: 2000 };
const reducedTiming = { rise: 450, empty: 640, open: 200 };
export const fortressRooms = {
  sluice: { name: '潮枢水殿', english: 'HALL OF TIDES', floor: '地下一层', level: 'B1', up: {x:8,y:17}, down: {x:8,y:3} },
  aqueduct: { name: '御水长庭', english: 'COURT OF WATERS', floor: '地下二层', level: 'B2', up: mazeFloors.aqueduct.up, down: mazeFloors.aqueduct.down },
  catacomb: { name: '霜冠陵宫', english: 'PALACE OF RIME', floor: '地下三层', level: 'B3', up: mazeFloors.catacomb.up, down: mazeFloors.catacomb.down },
  seal: { name: '冰核封印殿', english: 'GLACIAL SANCTUM', floor: '地下四层', level: 'B4', up: {x:8,y:18}, down: {x:8,y:11} },
} as const;
export const fortressOrder: readonly FortressRoom[] = ['sluice', 'aqueduct', 'catacomb', 'seal'];
export const sleepingFortress: FortressView = { phase: 'submerged', lift: 0, drain: 0, cinematic: false };
export const openFortress: FortressView = { phase: 'open', lift: 1, drain: 1, cinematic: false };
export const isFortressRoom = (value: unknown): value is FortressRoom => value === 'sluice' || value === 'seal' || isMazeRoom(value);

export function fortressSequence(elapsed: number, reduced: boolean): FortressView {
  const { rise, empty, open } = reduced ? reducedTiming : fortressTiming;
  if (elapsed < rise) return { phase: 'rising', lift: reduced ? .52 : elapsed / rise, drain: 0, cinematic: true };
  if (elapsed < rise + empty) return { phase: 'draining', lift: 1, drain: reduced ? .55 : (elapsed - rise) / empty, cinematic: true };
  return elapsed < rise + empty + open ? { ...openFortress, cinematic: true } : openFortress;
}

export function sluiceWalk(x:number,y:number) {
  if (y<3 || y>17 || x<1 || x>15)return false;
  if (y<=4 || y>=16)return x>=7 && x<=9;
  return x>=6&&x<=10 || x<=3 || x>=13 || y===5 || y===6 || y===7 || y===11 || y===12 || y===15;
}
export function sluiceTerrace(x:number,y:number) {
  if(!sluiceWalk(x,y))return false;
  return !(x>=7&&x<=9 || y>=5&&y<=15&&(x===3||x===13||x>=3&&x<=13&&(y===6||y===12)));
}

function interiorMap(room: FortressRoom): FieldMap {
  const width = 17, height = 20;
  const walkable = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => {
    if (room === 'seal') return wardWalkway(x, y) ||
      y >= 11 && y <= 18 && (x >= 7 && x <= 9 || y >= 15 && x >= 4 && x <= 12);
    return sluiceWalk(x,y);

  }));
  return { width, height, walkable, grass: walkable.map(row => row.map(() => false)), npcs: [], exits: [],
    spawn: { x: 8, y: room === 'sluice' ? 16 : 17 } };
}

export const fortressMaps = {
  sluice: interiorMap('sluice'), aqueduct: mazeFieldMap('aqueduct'), catacomb: mazeFieldMap('catacomb'), seal: interiorMap('seal'),
};
export function fortressMapAt(room: FortressRoom, shortcuts: readonly MazeRoom[]) {
  return isMazeRoom(room) ? mazeFieldMap(room, shortcuts.includes(room)) : fortressMaps[room];
}
