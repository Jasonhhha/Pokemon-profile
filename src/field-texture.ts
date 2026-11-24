import type { RoomId } from './field-layout';

export type GroundMaterial = 'meadow' | 'thicket' | 'dirt' | 'pavers' | 'sand' | 'water' | 'shallows' | 'wood' | 'drop' | 'void';

const grain = {
  meadow: [2.7, 3.2, 3.2],
  thicket: [1.4, 2.4, 3.2],
  dirt: [3.9, 3.5, 2.2],
  pavers: [4.5, 4.1, 4.0],
  sand: [3.0, 2.9, 2.2],
  water: [1.4, 1.5, 2.4],
  shallows: [1.8, 2.0, 2.4],
  wood: [1.8, 1.7, 1.7],
  drop: [2.4, 2.8, 4.0],
  void: [0, 0, 0],
} satisfies Record<GroundMaterial, number[]>;

export function noise(x: number, y: number, salt = 0) {
  let seed = Math.imul(x + 107, 374761393) ^ Math.imul(y + 211, 668265263) ^ Math.imul(salt + 1, 1449088463);
  seed = Math.imul(seed ^ (seed >>> 13), 1274126177);
  return ((seed ^ (seed >>> 16)) >>> 0) / 4294967296;
}

function sampleNoise(x: number, y: number, scale: number, salt = 0) {
  const tx = Math.floor(x / scale);
  const ty = Math.floor(y / scale);
  const u = (x % scale) / scale;
  const v = (y % scale) / scale;
  const top = noise(tx, ty, salt) * (1 - u) + noise(tx + 1, ty, salt) * u;
  const bottom = noise(tx, ty + 1, salt) * (1 - u) + noise(tx + 1, ty + 1, salt) * u;
  return top * (1 - v) + bottom * v;
}

export function textureGround(
  ctx: CanvasRenderingContext2D,
  room: RoomId,
  materials: GroundMaterial[][],
  tileSize: number,
) {
  const { width, height } = ctx.canvas;
  const frame = ctx.getImageData(0, 0, width, height);
  const channels = frame.data;
  for (let y = 0; y < height; y++) {
    const row = materials[Math.floor(y / tileSize)];
    for (let x = 0; x < width; x++) {
      const material = row[Math.floor(x / tileSize)];
      if (material === 'void') continue;
      const amounts = grain[material];
      const fleck = Math.round((noise(x, y, 12) - .5) * 4) * .9;
      const broad = sampleNoise(x, y, 34, 7) - .5;
      const fine = sampleNoise(x, y * 2, 7, 11) - .5;
      const band = ((x + y) % 4 === 1 ? -1 : (x + y) % 4 === 2 ? 1 : 0) * .75;
      const depth = material === 'water' ? Math.sin(x * .05 + y * .031) * .3
        : material === 'drop' ? Math.sin(y * .062 - x * .017) * .6
        : 0;
      const texture = fleck + broad * 3 + fine * 1.5 + band + depth;
      const shade = material === 'water' || material === 'shallows' || material === 'drop'
        ? 0
        : localLight(room, x, y);
      const index = (y * width + x) * 4;
      channels[index] += texture * amounts[0] + shade * 1.25;
      channels[index + 1] += texture * amounts[1] + shade;
      channels[index + 2] += texture * amounts[2] + shade * .58;
    }
  }
  ctx.putImageData(frame, 0, 0);
}

function localLight(room: RoomId, x: number, y: number) {
  if (room === 'home') {
    const sunlitQuay = Math.max(0, 1 - Math.abs(y - 204) / 96) * 9;
    return sunlitQuay - 3 + 2 * Math.cos((x - 150) / 95);
  }
  if (room === 'lab') {
    const clearing = Math.max(0, 1 - Math.abs(x + y * .56 - 244) / 68) * 13;
    return clearing + Math.max(0, 1 - Math.abs(y - 209) / 47) * 4 - 10;
  }
  return Math.cos((y - 160) / 92) * 9 + Math.cos((x - 407) / 107) * 3 - 4;
}
