import { cityAlleyAt, cityCourtyardAt, cityObstacles, harborHeight, reclaimedRingQuays } from './field-city-layout';
import type { Point } from './field-pixels';
import type { FortressRoom } from './field-fortress-state';

export const TILE = 16;
export type FieldArea = 'harbor';
export type FieldEvent = 'guide' | 'about' | 'projects' | 'contact' | 'healer' | 'trial' | 'spar';
export type RoomId = 'home' | 'lab' | 'tower';
export type FieldLocation = { area: FieldArea; room?: RoomId; fortressRoom?: FortressRoom; wallPassage?: true; x: number; y: number };

type ActorStyle = 'guide' | 'researcher' | 'keeper' | 'healer' | 'trial' | 'spar';
export type Tile = 'lawn' | 'path' | 'grass' | 'shore' | 'shelf' | 'water' | 'dock' | 'stone' | 'quay' | 'drop';
type Box = [x: number, y: number, width: number, height: number];
export type Prop = { kind: 'cottage' | 'station' | 'pine' | 'oak' | 'rock' | 'lamp' | 'fence' | 'crate' | 'boat' | 'flowers' | 'beacon' | 'arch' | 'winch' | 'sign' | 'banner'; x: number; y: number; variant?: number };

export type FieldMap = {
  width: number;
  height: number;
  wrapX?: boolean;
  spawn: { x: number; y: number };
  walkable: boolean[][];
  grass: boolean[][];
  npcs: { event: FieldEvent; x: number; y: number; name: string; style: ActorStyle; solid: boolean }[];
  exits: { x: number; y: number; to: FieldLocation; side: 'left' | 'right' | 'bottom' }[];
};

export const width = 40;
export const height = 24;

export const props: Record<FieldArea, Prop[]> = {
  harbor: [
    { kind: 'beacon', x: 3, y: 8 },
    { kind: 'boat', x: 2, y: 16 },
    { kind: 'boat', x: 1, y: 10, variant: 1 },
    { kind: 'boat', x: 36, y: 7, variant: 1 },
    { kind: 'boat', x: 36, y: 17 },
    { kind: 'cottage', x: 10, y: 9 },
    { kind: 'cottage', x: 18, y: 9, variant: 1 },
    { kind: 'station', x: 30, y: 9 },
    { kind: 'cottage', x: 10, y: 20, variant: 2 },
    { kind: 'lamp', x: 6, y: 10 },
    { kind: 'lamp', x: 14, y: 10 },
    { kind: 'lamp', x: 25, y: 13 },
    { kind: 'lamp', x: 32, y: 13 },
    { kind: 'lamp', x: 38, y: 13 },
    { kind: 'winch', x: 6, y: 14 },
    { kind: 'crate', x: 7, y: 10, variant: 1 },
    { kind: 'fence', x: 14, y: 9, variant: 1 },
    { kind: 'fence', x: 22, y: 9, variant: 2 },
    { kind: 'fence', x: 13, y: 17, variant: 2 },
    { kind: 'flowers', x: 9, y: 10 },
    { kind: 'flowers', x: 16, y: 10, variant: 1 },
    { kind: 'flowers', x: 8, y: 15, variant: 2 },
    { kind: 'flowers', x: 13, y: 14, variant: 1 },
    { kind: 'flowers', x: 11, y: 10, variant: 2 },
    { kind: 'flowers', x: 23, y: 15 },
    ...trees('oak', [[7, 5], [12, 4], [14, 7], [16, 4], [22, 6], [24, 8], [24, 4], [27, 6], [30, 18], [29, 21], [25, 22], [23, 20], [20, 21], [18, 22], [15, 21], [7, 20], [5, 21]]),
    ...trees('rock', [[20, 11], [23, 17], [8, 17], [6, 18], [7, 8], [24, 9], [32, 14], [30, 16]]),
  ],

};

function trees(kind: 'oak' | 'pine' | 'rock', entries: Point[]): Prop[] {
  return entries.map(([x, y], index) => ({ kind, x, y, variant: index % 3 }));
}

const paths: Record<FieldArea, Box[]> = {
  harbor: [[5, 11, 35, 3], [9, 10, 3, 2], [17, 10, 3, 2], [29, 9, 3, 3], [9, 13, 3, 6], [7, 13, 2, 2]],
};

const grass: Record<FieldArea, Box[]> = {
  harbor: [[15, 14, 6, 4], [26, 15, 8, 3], [33, 3, 5, 3]],
};

export const harborside = [8, 8, 7, 7, 6, 6, 6, 6, 6, 6, 5, 5, 5, 6, 6, 6, 7, 8, 8, 8, 7, 6, 6, 6];
export const causeway = { left: 32, right: 38, top: 11, bottom: 13 } as const;
export const tidalInlet = [
  [37, 39], [37, 39], [36, 39], [36, 39], [36, 38], [36, 38],
  [35, 38], [35, 38], [34, 38], [34, 37], [34, 37], [34, 37],
  [34, 37], [34, 37], [33, 38], [34, 38], [34, 38], [34, 38],
  [33, 39], [33, 39], [32, 39], [32, 39], [31, 39], [31, 39],
] as const;
const inBoxes = (x: number, y: number, boxes: Box[]) => boxes.some(([left, top, w, h]) => x >= left && y >= top && x < left + w && y < top + h);
export const onCauseway = (x: number, y: number) => y >= causeway.top && y <= causeway.bottom && x >= causeway.left && x <= causeway.right;

export function tileAt(area: FieldArea, x: number, y: number): Tile {
  if (area === 'harbor') {
    if ((x === 0 || x === width - 1) && y >= 11 && y <= 13) return 'quay';
    if (x === 37 && y >= 14 && y <= 16) return 'quay';
    if (reclaimedRingQuays.some(([column, row, width, depth]) => x >= column && x < column + width && y >= row && y < row + depth)) {
      if (cityCourtyardAt(x, y)?.kind === 'garden') return 'lawn';
      if (cityAlleyAt(x, y)) return 'path';
      return 'quay';
    }
    if (y >= height) return 'water';
    if (y >= 11 && y <= 13 && x >= 1 && x < 7) return 'dock';
    if ((y === 7 && x >= 2 && x <= 5) || (y === 8 && x >= 2 && x <= 4)) return 'quay';
    if (onCauseway(x, y)) return 'quay';
    const inlet = tidalInlet[y];
    if (inlet && x >= inlet[0] && x <= inlet[1]) return x === inlet[0] || x === inlet[1] && x < width - 1 ? 'shelf' : 'water';
    const shore = harborside[y];
    if (x < shore - 2) return 'water';
    if (x < shore - 1) return 'shelf';
    if (x < shore) return 'shore';
  }
  if (inBoxes(x, y, paths[area])) {
    if (area === 'harbor' && (x >= 7 && x <= 22 && y >= 11 && y <= 13 || x >= 9 && x <= 11 && y >= 14 && y <= 16)) return 'quay';
    if (area === 'harbor' && x >= 29 && y >= 11 && y <= 13) return 'quay';
    return 'path';
  }
  if (inBoxes(x, y, grass[area])) return 'grass';
  return 'lawn';
}

function footprint({ x, y, kind, variant = 0 }: Prop): Box | undefined {
  if (kind === 'cottage' || kind === 'station') return [x - 2, y - 3, 5, 4];
  if (kind === 'fence') return [x, y, variant + 1, 1];
  if (kind !== 'flowers' && kind !== 'boat' && kind !== 'arch') return [x, y, 1, 1];
}

function makeData(area: FieldArea, spawn: Point, npcs: FieldMap['npcs'], exits: FieldMap['exits']): FieldMap {
  const obstacles = props[area].map(footprint).filter((box): box is Box => Boolean(box));
  if (area === 'harbor') obstacles.push(...cityObstacles);
  const rows = area === 'harbor' ? harborHeight : height;
  const tiles = Array.from({ length: rows }, (_, y) => Array.from({ length: width }, (_, x) => tileAt(area, x, y)));
  const walkable = tiles.map((row, y) => row.map((tile, x) => {
    if (exits.some(exit => exit.x === x && exit.y === y)) return true;
    const seam = area === 'harbor' && y >= 11 && y <= 13;
    return y > 0 && y < rows - 1 && (seam || x > 0 && x < width - 1) &&
      tile !== 'water' && tile !== 'shelf' && tile !== 'drop' && !inBoxes(x, y, obstacles);
  }));
  return { width, height: rows, wrapX: area === 'harbor', spawn: { x: spawn[0], y: spawn[1] }, walkable, grass: tiles.map(row => row.map(tile => tile === 'grass')), npcs, exits };
}

export const maps: Record<FieldArea, FieldMap> = {
  harbor: makeData('harbor', [12, 12], [
    { event: 'guide', x: 14, y: 12, name: '韩怡萱', style: 'guide', solid: true },
    { event: 'about', x: 10, y: 10, name: '禹浩', style: 'researcher', solid: true },
    { event: 'healer', x: 18, y: 10, name: '补给站医师', style: 'healer', solid: true },
    { event: 'projects', x: 24, y: 10, name: '市集研究员', style: 'researcher', solid: true },
    { event: 'contact', x: 30, y: 10, name: '车站信号员', style: 'keeper', solid: true },
    { event: 'spar', x: 21, y: 14, name: '绿廊陪练', style: 'spar', solid: true },
    { event: 'trial', x: 36, y: 13, name: '东渡口守望员', style: 'trial', solid: true },
  ], []),
};
