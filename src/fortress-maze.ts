import type { FieldLocation, FieldMap } from './field-layout';

export type MazeRoom = 'aqueduct' | 'catacomb';
export type MazeTile = 'wall' | 'channel' | 'stone' | 'bridge' | 'ice' | 'grate' | 'gate';
export type MazePoint = { x: number; y: number };
type Landmark = MazePoint & { name: string; kind: 'turbine' | 'gauge' | 'sarcophagus' | 'prism' };
export const catacombLift = { x: 9, y: 36 } as const;
export const palaceLayout = 2;
export const palaceWidth = 49;
export const palaceCrossings = [10, 24, 36] as const;
export const palaceAisles = [9, 24, 39] as const;
export const palacePiers = [6, 13, 19, 29, 35, 42] as const;
export const palaceBays = [6, 14, 20, 28, 33, 41] as const;
export function palaceElevation(room: MazeRoom, x: number, z: number) {
  const north = Math.max(0, Math.min(12, Math.floor((14 - z) * 2)));
  const south = Math.max(0, Math.min(10, Math.floor((z - 38) * 2)));
  return north * (room === 'catacomb' ? 0.158 : 0.132) + south * 0.091;
}

export function processionalStairs(room: MazeRoom) {
  const head = palaceElevation(room, 24.5, 4);
  return Array.from({ length: 22 }, (_, index) => ({ z: 3.75 - index * 0.5, top: head - (index + 1) * 0.146 }));
}

function floor(cold: boolean) {
  const instrument = { x: cold ? 40 : 8, y: 24 };
  const tiles: MazeTile[][] = Array.from({ length: 49 }, (_, z) =>
    Array.from({ length: 49 }, (_, x) => {
      if (x < 3 || x > 45 || z < 3 || z > 45 || (x === instrument.x && z === instrument.y)) return 'wall';
      if (palacePiers.some((v) => v === x) && palaceBays.some((v) => v === z)) return 'wall';
      const aisle = palaceAisles.some((a) => Math.abs(x - a) <= (a === 24 ? 2 : 1));
      const crossing = palaceCrossings.some((a) => Math.abs(z - a) <= 1);
      const outer = (x === 4 || x === 44) && z >= 9 && z <= 37;
      const terrace = ((z >= 4 && z <= 7) || (z >= 40 && z <= 44)) && x >= 8 && x <= 40;
      const court =
        Math.abs(x - 24) + Math.abs(z - 24) <= 7 || (Math.abs(x - (cold ? 39 : 9)) <= 3 && Math.abs(z - 24) <= 3);
      if (z < 4 || z > 44 || x < 4 || x > 44) return 'channel';
      const radius = Math.hypot(x - 24, z - 24);
      const ambulatory = cold && radius >= 8.1 && radius <= 10.2;
      if (ambulatory || (aisle && z >= 6 && z <= 42) || terrace || court || outer) {
        return cold && Math.abs(x - 24) > 8 && (z === 18 || z === 29 || z === 30) ? 'ice' : 'stone';
      }
      if (crossing && x >= 4 && x <= 44) return 'bridge';
      return 'channel';
    }),
  );
  return {
    tiles,
    instrument,
    width: 49,
    height: 49,
    up: { x: 24, y: 43 },
    down: { x: 24, y: 5 },
    switch: { x: cold ? 39 : 9, y: 24 },
    gate: { x: cold ? 38 : 10, y: 24 },
    switchName: cold ? '星图校准盘' : '分水仪',
    gateName: cold ? '冰脉导光环' : '蓄水庭水位尺',
    landmarks: (cold
      ? [
          { x: 16, y: 18, kind: 'sarcophagus', name: '先民石棺' },
          { x: 32, y: 18, kind: 'prism', name: '冰纹方尖碑' },
          { x: 24, y: 5, kind: 'prism', name: '北阶封印门' },
        ]
      : [
          { x: 16, y: 18, kind: 'turbine', name: '西池叶轮' },
          { x: 32, y: 18, kind: 'turbine', name: '东池叶轮' },
          { x: 24, y: 5, kind: 'gauge', name: '北阶水门' },
        ]) as Landmark[],
  };
}
export const mazeFloors = { aqueduct: floor(false), catacomb: floor(true) };
export function isMazeRoom(value: unknown): value is MazeRoom {
  return value === 'aqueduct' || value === 'catacomb';
}
function collision(room: MazeRoom): FieldMap {
  const { width, height, tiles, up } = mazeFloors[room];
  const walkable = tiles.map((row) => row.map((tile) => tile !== 'wall' && tile !== 'channel'));
  return { width, height, walkable, grass: tiles.map((row) => row.map(() => false)), spawn: up, exits: [], npcs: [] };
}
const maps = { aqueduct: collision('aqueduct'), catacomb: collision('catacomb') };
export function mazeFieldMap(room: MazeRoom, _open = false) {
  return maps[room];
}

function migratedPoint(room: MazeRoom, x: number, y: number) {
  const plan = mazeFloors[room],
    legacy =
      room === 'aqueduct'
        ? ([
            [4, 19, plan.up],
            [18, 3, plan.down],
            [16, 8, plan.switch],
            [8, 17, plan.gate],
          ] as const)
        : ([
            [18, 19, plan.up],
            [4, 3, plan.down],
            [6, 8, plan.switch],
            [14, 15, plan.gate],
            [3, 6, catacombLift],
          ] as const);
  for (const [ox, oy, dest] of legacy) if (x === ox && y === oy) return dest;
  const cx = 4 + ((x - 2) * 40) / 18,
    cy = 4 + ((y - 2) * 40) / 18;
  let closest = plan.up,
    distance = Infinity;
  for (let z = 4; z < 45; z++)
    for (let col = 4; col < 45; col++) {
      if (!maps[room].walkable[z][col]) continue;
      const cost = (col - cx) ** 2 + (z - cy) ** 2;
      if (cost < distance) {
        distance = cost;
        closest = { x: col, y: z };
      }
    }
  return closest;
}

export function migratePalaceLocation(location: FieldLocation, version: unknown): FieldLocation {
  if (
    version === palaceLayout ||
    !isMazeRoom(location.fortressRoom) ||
    location.x < 0 ||
    location.y < 0 ||
    location.x >= 23 ||
    location.y >= 23
  )
    return location;
  return { ...location, ...migratedPoint(location.fortressRoom, location.x, location.y) };
}
export function migratePalaceTrail(value: unknown, version: unknown) {
  if (version === palaceLayout || !value || typeof value !== 'object') return value;
  const result: Record<MazeRoom, number[]> = { aqueduct: [], catacomb: [] };
  for (const room of ['aqueduct', 'catacomb'] as const) {
    const ids = (value as Record<MazeRoom, unknown>)[room];
    if (!Array.isArray(ids)) continue;
    for (const id of new Set(ids))
      if (Number.isInteger(id) && id >= 0 && id < 23 * 23) {
        const point = migratedPoint(room, id % 23, Math.floor(id / 23));
        result[room].push(point.y * palaceWidth + point.x);
      }
  }
  return result;
}
