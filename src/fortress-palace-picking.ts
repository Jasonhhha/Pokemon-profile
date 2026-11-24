import { processionalSign } from './fortress-palace-sign';
import {
  catacombLift,
  mazeFieldMap,
  mazeFloors,
  palaceElevation,
  processionalStairs,
  type MazeRoom,
} from './fortress-maze';

type V = { x: number; y: number; z: number };
const landings = (['aqueduct', 'catacomb'] as const).map((room) => {
  const rows = Array.from({ length: 97 }, (_, i) => i / 2);
  return {
    heights: [...new Set(rows.map((z) => palaceElevation(room, 0, z + 0.25)))].sort((a, b) => b - a),
    risers: rows
      .map((z) => ({ z, north: palaceElevation(room, 0, z - 0.001), south: palaceElevation(room, 0, z + 0.001) }))
      .filter((riser) => riser.north !== riser.south),
  };
});

export function palaceFloorRay(room: MazeRoom, from: V, ray: V) {
  if (ray.y >= -0.00001) return;
  const map = mazeFieldMap(room),
    profile = landings[room === 'aqueduct' ? 0 : 1];
  let first = Infinity,
    best: { x: number; y: number } | undefined;
  for (const h of profile.heights) {
    const t = (h - from.y) / ray.y,
      x = from.x + t * ray.x,
      z = from.z + t * ray.z;
    if (t < 0 || palaceElevation(room, x, z) !== h || !map.walkable[Math.floor(z)]?.[Math.floor(x)]) continue;
    first = t;
    best = { x, y: z };
    break;
  }
  if (Math.abs(ray.z) < 0.00001) return best;
  for (const face of profile.risers) {
    const t = (face.z - from.z) / ray.z;
    if (t < 0 || t >= first) continue;
    const h = from.y + t * ray.y,
      x = from.x + t * ray.x;
    if (h < Math.min(face.north, face.south) || h > Math.max(face.north, face.south)) continue;
    const z = face.z + (face.north > face.south ? -0.001 : 0.001);
    if (!map.walkable[Math.floor(z)]?.[Math.floor(x)]) continue;
    first = t;
    best = { x, y: z };
  }
  return best;
}

function intersectBox(from: V, ray: V, x: number, y: number, z: number, halfX: number, halfY: number, halfZ: number) {
  let near = 0,
    far = Infinity;
  for (const [origin, delta, center, half] of [
    [from.x, ray.x, x, halfX],
    [from.y, ray.y, y, halfY],
    [from.z, ray.z, z, halfZ],
  ]) {
    if (Math.abs(delta) < 1e-7) {
      if (Math.abs(origin - center) > half) return Infinity;
      continue;
    }
    const a = (center - half - origin) / delta,
      b = (center + half - origin) / delta;
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
    if (near > far) return Infinity;
  }
  return near;
}

export function palaceLandmarkRay(room: MazeRoom, from: V, ray: V, cutEntrance = false) {
  const plan = mazeFloors[room];
  let first = Infinity,
    result: { x: number; y: number } | undefined;
  const record = (t: number, x: number, z: number) => {
    if (t >= 0 && t < first) {
      first = t;
      result = { x, y: z };
    }
  };
  for (const [tile, down] of [
    [plan.up, false],
    [plan.down, true],
  ] as const) {
    if (!down && cutEntrance) continue;
    const x = tile.x + 0.5,
      z = down ? 5.34 : 43.7,
      alt = palaceElevation(room, x, z),
      span = down ? 2.65 : 2.29,
      height = down ? 2.45 : 1.86;
    const spring = alt + height + 0.6;
    const capture = (t: number) => record(t, x, tile.y + 0.5);
    for (const side of [-1, 1])
      capture(intersectBox(from, ray, x + side * span, alt + (height + 0.58) / 2, z, 0.57, (height + 0.58) / 2, 0.67));
    const board = processionalSign(room, down);
    capture(intersectBox(from, ray, board.x, board.y, board.z, board.w / 2, board.h / 2, 0.12));
    if (room === 'catacomb') {
      capture(intersectBox(from, ray, x, alt + height + 1.41, z, span + 0.85, 0.58, 0.61));
      capture(intersectBox(from, ray, x, alt + height + 2.37, z, 1.04, 0.54, 0.31));
    } else if (Math.abs(ray.z) > 1e-7) {
      for (const face of [-0.43, 0.0, 0.47]) {
        const t = (z + face - from.z) / ray.z,
          dx = from.x + ray.x * t - x,
          dy = from.y + ray.y * t - spring;
        if (dy < 0) continue;
        const r = (dx / (span - 0.11)) ** 2 + (dy / 1.72) ** 2;
        if (r >= 0.96 && r < 1.63) capture(t);
      }
      capture(intersectBox(from, ray, x, alt + height + 2.65, z + 0.41, 0.34, 0.39, 0.27));
    }
  }
  if (ray.y < -0.00001) {
    for (const stair of processionalStairs(room)) {
      const t = (stair.top - from.y) / ray.y;
      if (t >= 0 && Math.abs(from.x + t * ray.x - 24.5) < 2.28 && Math.abs(from.z + t * ray.z - stair.z) <= 0.252)
        record(t, plan.down.x + 0.5, plan.down.y + 0.5);
    }
  }
  const control = plan.instrument;
  record(
    intersectBox(from, ray, control.x + 0.5, 0.84, control.y + 0.5, 0.78, 0.84, 0.7),
    plan.switch.x + 0.5,
    plan.switch.y + 0.5,
  );
  if (room === 'catacomb') {
    const x = catacombLift.x + 0.5,
      z = catacombLift.y + 0.5;
    record(intersectBox(from, ray, x, 0.1, z, 0.68, 0.11, 0.61), x, z);
    for (const side of [-1, 1]) record(intersectBox(from, ray, x - 0.65, 1.31, z + side * 0.47, 0.11, 1.3, 0.15), x, z);
    record(intersectBox(from, ray, x - 0.65, 2.58, z, 0.13, 0.13, 0.61), x, z);
  }
  return result;
}
