import { fortressDial, fortressRooms, type FortressRoom } from './field-fortress-state';

type Point3 = { x: number; y: number; z: number };
type Landing = {
  x: number;
  half: number;
  z: number;
  depth: number;
  base: number;
  rise: number;
  steps: number;
  tile: { x: number; y: number };
};
export const hallStairs: Record<'sluice' | 'seal', Landing[]> = {
  sluice: [
    { x: 8.5, half: 1.51, z: 3.33, depth: -6.8, base: -0.04, rise: -1.696, steps: 17, tile: fortressRooms.sluice.down },
    { x: 8.5, half: 1.55, z: 17.95, depth: 1.08, base: 0.02, rise: -0.435, steps: 4, tile: fortressRooms.sluice.up },
  ],
  seal: [
    { x: 8.5, half: 1.24, z: 17.94, depth: 2.75, base: 0.025, rise: 1.13, steps: 10, tile: fortressRooms.seal.up },
  ],
};

export const sealVolume = { x: 8.5, y: -0.65, z: 6.5, width: 4.74, height: 5.65, depth: 4.55 };

export function stairTread(stair: Landing, index: number) {
  const near = stair.z + (stair.depth * index) / stair.steps;
  const far = near + stair.depth / stair.steps;
  return {
    z: Math.min(near, far),
    depth: Math.abs(far - near),
    y: stair.base + (stair.rise * index) / (stair.steps - 1),
  };
}

// Six shallow transverse treads lift visitors above the cistern while the elevator remains flush with the lower walk.
export const viewingSteps = [-1, 1].flatMap((side) =>
  Array.from({ length: 7 }, (_, i) => {
    const width = i === 6 ? 1.02 : 0.164,
      distance = i === 6 ? 7.0 : 5.52 + 0.164 * (i + 0.5);
    return { x: 8.5 + side * distance, width, top: (Math.min(i, 5) + 1) * 0.121, nose: side };
  }),
);

export function hallSupport(room: 'sluice' | 'seal', x: number, z: number) {
  if (room === 'sluice' && z >= 5 && z < 16) {
    const upper = viewingSteps.find((step) => Math.abs(x - step.x) <= step.width / 2 + 0.000001);
    if (upper) return upper.top;
  }
  for (const stair of hallStairs[room]) {
    const progress = (z - stair.z) / stair.depth;
    if (Math.abs(x - stair.x) <= stair.half && progress >= 0 && progress < 1) {
      return stairTread(stair, Math.floor(progress * stair.steps)).y;
    }
  }
  return 0;
}

export function pickPalacePortal(
  room: FortressRoom,
  origin: Point3,
  dir: Point3,
  openFloor: boolean,
  dialRadius = 1.31,
) {
  if (room !== 'sluice' && room !== 'seal') return;
  if (room === 'sluice') {
    if (dir.y < -0.00001) {
      let first = Infinity,
        balcony;
      for (const step of viewingSteps) {
        const t = (step.top - origin.y) / dir.y,
          x = origin.x + t * dir.x,
          z = origin.z + t * dir.z;
        if (t >= 0 && t < first && z >= 5 && z < 16 && Math.abs(x - step.x) <= step.width / 2) {
          first = t;
          balcony = { x, y: z };
        }
      }
      if (balcony) return balcony;
    }
    const hit = (0.05 - origin.y) / dir.y,
      cx = fortressDial.x + 0.5,
      cz = fortressDial.y + 0.5;
    if (hit >= 0 && Math.hypot(origin.x + dir.x * hit - cx, origin.z + dir.z * hit - cz) <= dialRadius)
      return { x: cx, y: cz };
  }
  for (const stair of hallStairs[room]) {
    // Pick the horizontal tread first. A low viewing angle can reveal its vertical riser instead.
    for (let i = 0; i < stair.steps; i++) {
      const tread = stairTread(stair, i);
      const hit = (tread.y - origin.y) / dir.y;
      if (hit >= 0 && Number.isFinite(hit) && Math.abs(origin.x + dir.x * hit - stair.x) <= stair.half) {
        const z = origin.z + dir.z * hit;
        if (z >= tread.z && z <= tread.z + tread.depth) return { x: stair.tile.x + 0.5, y: stair.tile.y + 0.5 };
      }
      if (i === 0) continue;
      const previous = stairTread(stair, i - 1),
        joint = stair.depth < 0 ? tread.z + tread.depth : tread.z;
      const riser = (joint - origin.z) / dir.z;
      if (riser < 0 || !Number.isFinite(riser) || Math.abs(origin.x + dir.x * riser - stair.x) > stair.half) continue;
      const y = origin.y + dir.y * riser;
      if (y >= Math.min(previous.y, tread.y) && y <= Math.max(previous.y, tread.y))
        return { x: stair.tile.x + 0.5, y: stair.tile.y + 0.5 };
    }
  }
  if (room !== 'seal' || openFloor) return;
  const v = sealVolume;
  const x = (origin.x - v.x) / v.width,
    y = (origin.y - v.y) / v.height,
    z = (origin.z - v.z) / v.depth;
  const dx = dir.x / v.width,
    dy = dir.y / v.height,
    dz = dir.z / v.depth;
  const a = dx * dx + dy * dy + dz * dz,
    b = x * dx + y * dy + z * dz,
    c = x * x + y * y + z * z - 1;
  const d = b * b - a * c;
  if (d < 0 || a < 1e-12) return;
  for (const hit of [(-b - Math.sqrt(d)) / a, (-b + Math.sqrt(d)) / a]) {
    if (hit >= 0 && y + dy * hit >= 0)
      return { x: fortressRooms.seal.down.x + 0.5, y: fortressRooms.seal.down.y + 0.5 };
  }
}
