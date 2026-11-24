import { isMazeRoom, mazeFieldMap, mazeFloors, type MazePoint, type MazeRoom } from './fortress-maze';
import type { FieldLocation } from './field-layout';

export type MazeTrail = Record<MazeRoom, number[]>;
export const newMazeTrail = (): MazeTrail => ({ aqueduct: [], catacomb: [] });

export function restoreMazeTrail(value: unknown, shortcuts: readonly MazeRoom[]): MazeTrail {
  const result = newMazeTrail();
  if (!value || typeof value !== 'object') return result;
  for (const room of ['aqueduct', 'catacomb'] as const) {
    const input = (value as Partial<MazeTrail>)[room];
    if (!Array.isArray(input)) continue;
    const map = mazeFieldMap(room, shortcuts.includes(room));
    result[room] = [...new Set(input.filter(id => Number.isInteger(id) && id >= 0 && map.walkable[Math.floor(id / map.width)]?.[id % map.width]))];
  }
  return result;
}

export function recordMazeStep(trail: MazeTrail, location: FieldLocation) {
  const room = location.fortressRoom;
  if (!isMazeRoom(room)) return trail;
  const id = location.y * mazeFloors[room].width + location.x;
  return trail[room].includes(id) ? trail : { ...trail, [room]: [...trail[room], id] };
}

// The rubbing records nearby surfaces. A stone wall or closed portcullis hides the cells behind it.
export function surveyedCells(room: MazeRoom, walked: readonly number[], shortcutOpen: boolean) {
  const { tiles, width, height } = mazeFloors[room];
  const seen = new Set<number>();
  for (const id of walked) {
    const x = id % width, y = Math.floor(id / width);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const col = x + dx, row = y + dy;
      if (col < 0 || row < 0 || col >= width || row >= height || dx * dx + dy * dy > 10) continue;
      const span = Math.max(Math.abs(dx), Math.abs(dy));
      let clear = true;
      for (let i = 1; i < span; i++) {
        const tile = tiles[y + Math.round(dy * i / span)][x + Math.round(dx * i / span)];
        if (tile === 'wall' || tile === 'gate' && !shortcutOpen) { clear = false; break; }
      }
      if (clear) seen.add(row * width + col);
    }
  }
  return seen;
}

export function knownWalkway(room: MazeRoom, from: MazePoint, point: MazePoint, walked: readonly number[], open: boolean) {
  const map = mazeFieldMap(room, open);
  const steps = new Set(walked);
  steps.add(from.y * map.width + from.x);
  if (!steps.has(point.y * map.width + point.x)) return;
  return {
    ...map, walkable: map.walkable.map((row, y) => row.map((passable, x) => passable && steps.has(y * map.width + x))),
  };
}
