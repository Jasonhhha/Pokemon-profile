import { suspendedHeight } from './fortress-palace-monuments';
import { palaceElevation, type MazeRoom } from './fortress-maze';
import type { FortressInteriorFrame } from './field-fortress-state';
import type { PalacePart } from './fortress-palace-architecture';

type Node = { x: number; z: number; h: number; run: number };
export const palaceWorks = [
  [16.5, 17.5],
  [32.5, 17.5],
  [16.5, 31.5],
  [32.5, 31.5],
] as const;
const routes: Partial<Record<MazeRoom, Node[][]>> = {};
export function palaceConductors(room: MazeRoom) {
  if (routes[room]) return routes[room]!;
  const branch = room === 'catacomb' ? 40.5 : 8.5,
    result: Node[][] = [];
  for (const side of [-1, 1]) {
    const x = 24.5 + side * 1.78,
      start = 5.31,
      joint = 24.5 + side * 0.31,
      first = 24.5 + side * Math.sqrt(4.33 ** 2 - 1.78 ** 2);
    const paths = [
      [
        [x, start],
        [x, 20.45],
      ],
      [
        [x, 28.54],
        [x, 43.44],
      ],
      [
        [branch, joint],
        [24.5 + Math.sign(branch - 24.5) * 4.27, joint],
      ],
    ];
    for (const corners of paths) {
      const [a, b] = corners,
        span = Math.hypot(b[0] - a[0], b[1] - a[1]),
        count = Math.ceil(span * 2);
      const line = Array.from({ length: count + 1 }, (_, i) => {
        const u = i / count,
          xx = a[0] + (b[0] - a[0]) * u,
          zz = a[1] + (b[1] - a[1]) * u;
        return {
          x: xx,
          z: zz,
          h: palaceElevation(room, xx, zz) + 0.03,
          run: zz - start + (xx - x) * 0.29 + side * 0.75,
        };
      });
      result.push(line);
    }
    const count = 96;
    result.push(
      Array.from({ length: count + 1 }, (_, i) => {
        const a = (i / count) * 2 * Math.PI,
          r = side < 0 ? 4.15 : 4.38;
        return { x: 24.5 + Math.cos(a) * r, z: 24.5 + Math.sin(a) * r, h: 0.03, run: first + r * a };
      }),
    );
  }
  routes[room] = result;
  return result;
}
export function worksPower(frame: FortressInteriorFrame, index: number, travel = 0) {
  if (index === 0 || index === 3) return 0.62;
  if (!frame.shortcutOpen) return 0.12;
  const age = frame.reduced ? 2 : Math.min(2, Math.max(0, (frame.gateAge ?? 2) - 0.1 * index - travel));
  return 0.12 + 0.8 * Math.min(1, age / 1.11);
}

export function wheelAngle(frame: FortressInteriorFrame, index: number, seconds: number) {
  if (frame.reduced) return index * 0.43;
  const main = index === 0 || index === 3;
  const t = frame.gateAge - 0.1 * index,
    ramp = 1.11;
  let result = seconds * (main ? 0.41 : 0.13);
  if (!main && frame.shortcutOpen) {
    if (!Number.isFinite(t)) result = seconds * 0.72;
    else if (t > 0) result += 0.59 * (t < ramp ? (t * t) / (2 * ramp) : t - ramp / 2);
  }
  return result + index * 0.43;
}

export const palaceArmillary: PalacePart[] = [
  {
    form: 'ring',
    finish: 'bronze',
    x: 24.5,
    y: suspendedHeight - 0.07,
    z: 24.5,
    w: 3.07,
    h: 3.07,
    d: 0.87,
    yaw: -0.26,
    roll: 0.12,
    pitch: 1.17,
  },
  {
    form: 'ring',
    finish: 'bright',
    x: 24.5,
    y: suspendedHeight,
    z: 24.5,
    w: 2.77,
    h: 2.77,
    d: 0.63,
    yaw: 0.59,
    roll: -0.37,
    pitch: 0.31,
  },
  {
    form: 'ring',
    finish: 'bronze',
    x: 24.5,
    y: suspendedHeight,
    z: 24.5,
    w: 2.51,
    h: 2.51,
    d: 0.49,
    yaw: -0.87,
    roll: 0.56,
    pitch: -0.63,
  },
];

export function armillaryRotation(frame: FortressInteriorFrame, index: number, seconds: number) {
  const ring = palaceArmillary[index],
    bus = frame.power?.bus ?? 0.78,
    phase = frame.power?.phase ?? 0.45;
  const aligned = frame.shortcutOpen ? Math.min(1, Math.max(0, frame.gateAge) / 1.3) : 0;
  const angle = (frame.reduced ? 0 : seconds) * (0.11 + index * 0.032) * (index === 1 ? -1 : 1);
  return [ring.pitch + aligned * (index - 1) * 0.2, ring.yaw + angle + phase * 0.13, ring.roll + bus * 0.11] as const;
}

// Twin bronze channels carry the same bus beneath the gallery flags toward the lift and viewing terraces.
export const sluiceConduits = [-1, 1].flatMap((side) => {
  const bends = [
    [8.5 + side * 0.39, 3.4],
    [8.5 + side * 0.39, 5.53],
    [8.5 + side * 2.22, 5.53],
    [8.5 + side * 2.22, 11.49],
    [8.5 + side * 5.2, 11.49],
  ];
  let run = 0;
  return bends.slice(1).flatMap(([x, z], i) => {
    const [ax, az] = bends[i],
      dx = x - ax,
      dz = z - az,
      length = Math.hypot(dx, dz),
      parts = Math.ceil(length / 0.73);
    const strips = Array.from({ length: parts }, (_, j) => ({
      x: ax + (dx * (j + 0.5)) / parts,
      z: az + (dz * (j + 0.5)) / parts,
      w: Math.abs(dx) / parts,
      d: Math.abs(dz) / parts,
      band: (run + j) % 12,
    }));
    run += parts;
    return strips;
  });
});
export function sluiceCurrent(time: number, bus: number, phase: number, band: number) {
  const wave = Math.max(0, Math.cos(time * 1.55 - (band * Math.PI) / 6 - phase * 2.1));
  return bus * (0.37 + 0.63 * wave ** 6);
}
