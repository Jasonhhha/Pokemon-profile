import { mazeFloors } from './fortress-maze';
import type { FortressInteriorFrame, FortressRoom } from './field-fortress-state';

export type Puddle = {
  x: number;
  z: number;
  w: number;
  d: number;
  angle: number;
  cos: number;
  sin: number;
  outline: [number, number, number][];
};

function shoreline(angle: number) {
  return 0.79 + 0.08 * Math.sin(angle * 3 + 0.7) + 0.056 * Math.sin(angle * 7 - 0.3) + 0.035 * Math.cos(angle * 11);
}

function pools(survey: number[][]): Puddle[] {
  return survey.map(([x, z, w, d, angle]) => {
    const cos = Math.cos(angle),
      sin = Math.sin(angle);
    const outline: Puddle['outline'] = Array.from({ length: 56 }, (_, i) => {
      const a = (i * 2 * Math.PI) / 56,
        r = shoreline(a);
      const dx = w * r * Math.cos(a),
        dz = -d * r * Math.sin(a);
      return [x + cos * dx + sin * dz, z - sin * dx + cos * dz, 0.025];
    });
    return { x, z, w, d, angle, cos, sin, outline };
  });
}

export const palacePuddles: Record<FortressRoom, Puddle[]> = {
  sluice: pools([
    [8.1, 15.4, 1.09, 0.41, 0.26],
    [9, 13.8, 0.7, 0.27, -0.6],
    [7.55, 11.2, 0.45, 1.1, 0.13],
    [8.63, 8.1, 1.03, 0.34, -0.18],
    [7.72, 6.58, 0.52, 0.26, 0.2],
    [8.92, 4.72, 0.53, 0.46, 0.4],
    [13.46, 8.6, 0.31, 0.71, 0.08],
    [3.47, 13.4, 0.32, 0.46, 0.15],
  ]),
  aqueduct: pools([
    [23.6, 36.5, 1.46, 0.51, -0.25],
    [9.56, 28.48, 0.94, 0.46, 0.31],
    [31.79, 24.48, 0.77, 0.31, 0.12],
    [25.11, 17.61, 0.94, 0.5, -0.42],
    [9.51, 24.43, 0.65, 0.48, 0.17],
    [39.24, 14.55, 0.81, 0.39, -0.3],
  ]),
  catacomb: [],
  seal: pools([
    [5.8, 16.5, 0.98, 0.48, 0.41],
    [11, 17.6, 1.04, 0.36, -0.37],
    [8.25, 13.91, 0.86, 0.31, 0.21],
    [8.98, 12.4, 0.43, 0.65, -0.24],
    [2.54, 5.34, 0.22, 0.46, -0.12],
    [2.39, 10.63, 0.18, 0.39, 0.21],
    [14.43, 8.56, 0.24, 0.38, -0.26],
    [12.43, 12.49, 0.37, 0.19, 0.18],
  ]),
};

// The water plane's second UV axis points toward negative local Z.
export function puddleUV(pool: Puddle, x: number, z: number) {
  const dx = x - pool.x,
    dz = z - pool.z;
  return [(pool.cos * dx - pool.sin * dz) / pool.w, -(pool.sin * dx + pool.cos * dz) / pool.d] as const;
}

function atContact(room: FortressRoom, x: number, z: number) {
  return palacePuddles[room].find((pool) => {
    if (Math.abs(x - pool.x) + Math.abs(z - pool.z) > 1.42 * Math.max(pool.w, pool.d)) return false;
    const [u, v] = puddleUV(pool, x, z);
    return Math.hypot(u, v) <= shoreline(Math.atan2(v, u));
  });
}

export const soleLife = 4.5;
export const rippleLife = 0.74;
export const rippleReach = 0.43;
export const wetMarkCapacity = 24;
export type WetMark = {
  x: number;
  z: number;
  at: number;
  bearing: number;
  strength: number;
  slot: number;
  pool?: Puddle;
};

const direction = {
  up: [0, -1, 0],
  down: [0, 1, Math.PI],
  left: [-1, 0, -Math.PI / 2],
  right: [1, 0, Math.PI / 2],
} as const;

export function createSoleContact() {
  let previousFoot = -1,
    previousFraction = -1;
  return (frame: FortressInteriorFrame, reset = false) => {
    if (reset || frame.reduced || frame.gaitPhase === undefined) previousFoot = previousFraction = -1;
    if (frame.reduced || frame.gaitPhase === undefined) return;
    const foot = Number(frame.gaitPhase >= 0.5),
      fraction = (frame.gaitPhase * 2) % 1;
    const landed = fraction >= 0.43 && (foot !== previousFoot || previousFraction < 0.43);
    previousFoot = foot;
    previousFraction = fraction;
    if (!landed) return;
    const [dx, dz, bearing] = direction[frame.facing],
      side = foot ? 0.103 : -0.103;
    // Recover the point of contact even if a slow frame skips the exact instant the sole lands.
    return {
      foot,
      bearing,
      x: frame.x + dx * (0.43 - fraction) - dz * side,
      z: frame.y + dz * (0.43 - fraction) + dx * side,
    };
  };
}

export function createWetFootfalls() {
  const marks: WetMark[] = [];
  const wetness = [0, 0],
    lastWet = [-Infinity, -Infinity];
  const contact = createSoleContact();
  let previousTime = -Infinity;
  let floor: FortressRoom | undefined,
    next = 0;
  return {
    marks,
    advance(frame: FortressInteriorFrame) {
      const time = frame.now / 1000;
      const reset = floor !== frame.room || time < previousTime || time - previousTime > soleLife || frame.reduced;
      if (reset) {
        marks.length = 0;
        next = 0;
        wetness.fill(0);
        floor = frame.room;
      }
      previousTime = time;
      const strike = contact(frame, reset);
      if (!strike) return;
      const { x, z, bearing, foot } = strike;
      const pool = atContact(frame.room, x, z);
      const strength = pool ? 1 : wetness[foot] * Math.max(0, 1 - (time - lastWet[foot]) / 10);
      if (!(strength > 0.075)) return;
      if (pool) {
        wetness[foot] = 1;
        lastWet[foot] = time;
      } else {
        wetness[foot] *= 0.55;
        if (frame.room === 'aqueduct' && mazeFloors.aqueduct.tiles[Math.floor(z)]?.[Math.floor(x)] !== 'stone') return;
      }
      const slot = next;
      next = (next + 1) % wetMarkCapacity;
      const mark: WetMark = { x, z, at: time, bearing, strength, pool, slot };
      marks[slot] = mark;
      return mark;
    },
  };
}
