import type { Bay, Form, Stone } from './fortress-palace-architecture';
import type { MazeRoom } from './fortress-maze';

type XYZ = [x: number, y: number, z: number];
const axis = 24.5;
export const crownLevel = 10.35;
export const crownRadius = 12.2;
export const crownRise = 6.45;
export const suspendedHeight = 10.1;
export const collectorGates = [10.25, 38.75] as const;

export function royalMonument(room: MazeRoom): Bay[] {
  const bays: Bay[] = [];
  let current: Bay;
  function bay(x: number, z: number, high: number, radius: number, overhead = false) {
    current = { x, z, high, radius, parts: [], overhead };
    bays.push(current);
  }
  function put(
    form: Form,
    finish: Stone,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    yaw = 0,
    roll = 0,
    pitch = 0,
  ) {
    current.parts.push({ form, finish, x, y, z, w, h, d, yaw, roll, pitch });
  }
  function box(stone: Stone, p: XYZ, w: number, h: number, d: number, yaw = 0) {
    put('box', stone, ...p, w, h, d, yaw);
  }
  function beam(a: XYZ, b: XYZ, w: number, d: number, stone: Stone) {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      dz = b[2] - a[2],
      horizontal = Math.hypot(dx, dz);
    put(
      'box',
      stone,
      (a[0] + b[0]) / 2,
      (a[1] + b[1]) / 2,
      (a[2] + b[2]) / 2,
      w,
      Math.hypot(horizontal, dy),
      d,
      Math.atan2(dx, dz),
      0,
      Math.atan2(horizontal, dy),
    );
  }
  if (room === 'aqueduct') {
    // The collector carries two high-level channels. The central stair passes through the gap between its piers.
    for (const x of collectorGates) {
      const side = x < axis ? -1 : 1;
      bay(x, -0.4, 17, 8.0);
      box('basalt', [x, 3.4, -2.24], 9.9, 9.48, 1.22);
      box('royal', [x, 4.27, -1.54], 8.1, 6.9, 0.34);
      for (const sign of [-1, 1]) {
        const column = x + sign * 4.9;
        box('body', [column, 3.85, -0.72], 1.62, 9.8, 2.81);
        box('bright', [column, 5.98, -0.62], 1.98, 0.33, 3.03);
        box('basalt', [column, 8.3, -0.5], 2.06, 0.68, 3.14);
        box('bronze', [column, 8.75, -0.39], 2.16, 0.16, 3.21);
      }
      put('arch', 'bright', x, 4.45, -0.53, 4.28, 4.45, 1.57);
      put('arch', 'copper', x, 4.45, 0.31, 4.28, 4.45, 0.19);
      // Two dark man-sized wicket gates at the base give scale to the intake drum above them.
      for (const sign of [-1, 1]) {
        box('basalt', [x + sign * 2.54, 1.22, -0.04], 1.39, 3.1, 0.34);
        put('arch', 'trim', x + sign * 2.54, 2.26, 0.17, 0.67, 0.77, 0.27);
      }
      put('ring', 'basalt', x, 4.8, -0.93, 3.27, 3.27, 2.18);
      put('ring', 'copper', x, 4.8, -0.56, 3.01, 3.01, 0.79);
      for (let k = -3; k <= 3; k++) {
        const offset = k * 0.76,
          tall = 2 * Math.sqrt(2.56 ** 2 - offset ** 2);
        box('iron', [x + offset, 4.8, -0.5], 0.16, tall, 0.29);
      }
      box('basalt', [x, 9.7, -0.73], 12.18, 1.06, 4.15);
      box('bright', [x, 10.28, -0.74], 12.54, 0.33, 4.43);
      box('copper', [x, 10.52, 0.85], 12.54, 0.17, 0.75);
      box('royal', [x, 10.51, -0.69], 12.26, 0.26, 2.23);
      for (const far of [-1, 1]) box('trim', [x, 10.91, -0.74 + far * 1.83], 12.45, 0.75, 0.51);
      const tower = x + side * 5.59;
      box('dark', [tower, 7.26, -3.1], 3.03, 17.32, 4.38);
      box('bright', [tower, 12.42, -3.1], 3.38, 0.48, 4.67);
      box('copper', [tower, 14.14, -3.1], 3.29, 0.35, 4.58);
      put('column', 'basalt', tower, 15.53, -3.1, 1.78, 2.53, 1.78);
      put('column', 'copper', tower, 16.96, -3.1, 1.96, 0.34, 1.96);
      box('royal', [tower + side * 0.58, 7.2, -0.77], 0.45, 12.32, 0.34);
      // The feeder conduits are genuinely above the external perimeter of the court.
      const outer = axis + side * 22.26;
      for (const [z, length] of [
        [8.35, 17.1],
        [25.35, 16.9],
        [41.55, 15.5],
      ]) {
        bay(outer, z, 8.0, length * 0.55);
        box('basalt', [outer, 6.85, z], 2.01, 0.78, length);
        box('body', [outer, 7.41, z], 2.3, 0.38, length + 0.14);
        box('royal', [outer, 7.61, z], 1.57, 0.12, length);
        for (const bank of [-1, 1]) box('copper', [outer + bank * 0.97, 7.82, z], 0.24, 0.58, length);
      }
    }
    for (const side of [-1, 1]) {
      const x = axis + side * 22.26;
      for (const z of [3, 22, 41]) {
        bay(x, z, 7.1, 2.2);
        box('dark', [x, 2.27, z], 2.07, 6.64, 2.56);
        box('bright', [x, 4.82, z], 2.42, 0.41, 2.95);
      }
      for (const z of [12.5, 31.5]) {
        bay(x, z, 6.76, 9.7);
        put('arch', 'trim', x, 2.41, z, 8.63, 3.21, 1.24, Math.PI / 2);
      }
    }
    for (const sign of [-1, 1]) {
      const x = axis + sign * 6.5;
      bay(x, 2.04, 12.6, 2.82);
      box('basalt', [x, 9.77, 0.89], 2.78, 3.07, 3.96);
      box('trim', [x, 10.49, 2.2], 3.12, 1.26, 1.26);
      box('copper', [x, 10.72, 2.61], 2.51, 0.78, 0.59);
      box('royal', [x, 10.65, 2.92], 1.91, 0.36, 0.14);
      box('bright', [x, 10.41, 2.96], 2.69, 0.18, 0.43);
      box('copper', [x + sign * 2.03, 10.53, -0.73], 3.49, 0.74, 1.77);
      for (const dx of [-1.1, 1.1]) box('basalt', [x + dx, -0.26, 3.25], 0.32, 1.55, 1.49);
    }
    // A stepped valve house stands higher than either wing. Its upper wheel is visible above the transverse arches.
    bay(axis, -3.32, 20.3, 7.1);
    for (const s of [-1, 1]) {
      box('basalt', [axis + s * 4.49, 8.4, -3.64], 2.92, 18.28, 4.12);
      box('bright', [axis + s * 4.49, 14.66, -3.58], 3.22, 0.67, 4.4);
      box('copper', [axis + s * 4.49, 16.22, -3.4], 3.32, 0.22, 4.52);
      beam([axis + s * 6.45, 10.31, -2.77], [axis + s * 3.57, 15.12, -2.77], 0.94, 1.01, 'body');
    }
    box('basalt', [axis, 13.47, -4.0], 8.6, 8.0, 2.8);
    put('column', 'gilt', axis, 13.3, -1.78, 0.36, 0.18, 0.36, 0, 0, Math.PI / 2);
    box('royal', [axis, 13.5, -2.54], 6.48, 7.26, 0.23);
    put('ring', 'gilt', axis, 13.3, -1.97, 3.21, 3.21, 1.51);
    put('ring', 'bright', axis, 13.3, -1.91, 2.79, 2.79, 0.61);
    put('arch', 'bright', axis, 14.8, -2.35, 4.3, 3.5, 0.82);
    box('trim', [axis, 17.67, -3.53], 9.87, 0.8, 3.63);
  } else {
    const segments = 32,
      sector = (2 * Math.PI) / segments;
    const point = (a: number, r: number, h: number): XYZ => [axis + Math.cos(a) * r, h, axis + Math.sin(a) * r * 0.94];
    // A clear axial opening divides two stone tribunals. All seating is carried above the side aisles.
    for (let k = 0; k < segments; k++) {
      const a = k * sector,
        b = (k + 1) * sector,
        mid = (a + b) * 0.5,
        side = Math.cos(mid);
      const rim = (r: number, h: number, radial: number, thickness: number, finish: Stone, overlap = 0.06) => {
        const p = point(a, r, h),
          q = point(b, r, h),
          yaw = -Math.atan2(q[2] - p[2], q[0] - p[0]);
        box(
          finish,
          [(p[0] + q[0]) / 2, h, (p[2] + q[2]) / 2],
          Math.hypot(q[0] - p[0], q[2] - p[2]) + overlap,
          thickness,
          radial,
          yaw,
        );
      };
      const [x, , z] = point(mid, 12, 7.0);
      bay(x, z, 8.1, 4.9, true);
      if (Math.abs(side) > 0.39) {
        for (let tier = 0; tier < 3; tier++) {
          const r = 11.2 + tier * 1.18,
            h = 4.43 + tier * 0.79;
          rim(r, h, 1.36, 0.63, 'basalt');
          rim(r, h + 0.37, 1.3, 0.16, 'trim');
          rim(r - 0.58, h + 0.04, 0.095, 0.08, 'gilt');
        }
        if (k % 2 === 0) {
          beam(point(a, 13.71, 6.27), point(a, 10.88, 4.02), 0.29, 0.32, 'gilt');
          beam(point(a, 13.83, 6.2), point(a, 12.11, 3.35), 0.54, 0.7, 'basalt');
        }
      }
      bay(x, z, crownLevel + 1.0, 3.2, true);
      rim(crownRadius, crownLevel - 0.26, 1.05, 0.62, 'basalt');
      rim(crownRadius - 0.44, crownLevel + 0.01, 0.21, 0.18, 'gilt');
      rim(crownRadius + 0.39, crownLevel + 0.19, 0.21, 0.21, 'bright');
      if (k % 4 === 0) {
        const foot = point(a, crownRadius, 8.1),
          head = point(a, crownRadius, crownLevel - 0.4);
        beam(foot, head, 1.0, 1.13, 'basalt');
        const face = point(a, crownRadius - 0.46, 8.87);
        box('gilt', face, 0.28, 1.32, 0.22, -a);
      }
    }
    // The load of the drum is resolved at four existing pier foundations, leaving the routes below uninterrupted.
    for (const dx of [-1, 1])
      for (const dz of [-1, 1]) {
        const base: XYZ = [axis + dx * 11, 5.55, axis + dz * 9.5];
        const seat: XYZ = [axis + dx * 8.65, crownLevel - 0.23, axis + dz * 7.98];
        bay(base[0], base[2], crownLevel + 0.5, 4.9, true);
        beam(base, seat, 1.12, 1.21, 'basalt');
        beam([base[0] - dx * 0.52, base[1], base[2]], [seat[0] - dx * 0.48, seat[1], seat[2]], 0.2, 1.1, 'gilt');
        beam(base, [axis + dx * 11.32, crownLevel - 0.24, axis + dz * 3.97], 0.95, 1.0, 'basalt');
      }
    // Eight meridian ribs terminate in a bronze compression collar around the open oculus.
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4,
        base = point(a, crownRadius, crownLevel);
      bay(base[0], base[2], crownLevel + crownRise, 7, true);
      const spring = (v: number, offset = 0): XYZ =>
        point(a, (crownRadius + offset) * Math.cos(v), crownLevel + crownRise * Math.sin(v));
      for (let n = 0; n < 5; n++) {
        const lo = (n * 1.31) / 5,
          hi = ((n + 1) * 1.31) / 5;
        beam(spring(lo), spring(hi), 0.51, 0.48, 'basalt');
        beam(spring(lo, -0.18), spring(hi, -0.18), 0.103, 0.51, 'gilt');
      }
    }
    bay(axis, axis, crownLevel + crownRise + 1.2, 4.1, true);
    const opening = crownRadius * Math.cos(1.31),
      crown = crownLevel + crownRise * Math.sin(1.31);
    put('ring', 'gilt', axis, crown, axis, opening, opening * 0.94, 1.16, 0, 0, Math.PI / 2);
    for (const side of [-1, 1]) {
      beam(
        [axis + side * 2.9, crown - 0.1, axis],
        [axis + side * 2.9, suspendedHeight + 0.2, axis],
        0.12,
        0.12,
        'gilt',
      );
    }
  }
  // The retaining wall is recessed behind the rooms. Its deep transfer beams read as the city foundations overhead.
  for (const sign of [-1, 1]) {
    const x = axis + sign * 24.82;
    for (const z of [-1, 19, 39]) {
      bay(x, z, 19.45, 12.0);
      box('basalt', [x, 2.23, z], 2.85, 11.82, 20.2);
      box('basalt', [x, 14.59, z], 2.85, 2.63, 20.2);
      for (const end of [-1, 1]) {
        box('basalt', [x, 10.61, z + end * 7.5], 2.91, 7.63, 5.29);
        box('body', [x - sign * 1.53, 10.36, z + end * 5.38], 0.71, 8.25, 0.98);
        box('gilt', [x - sign * 1.54, 12.28, z + end * 5.38], 0.83, 0.17, 1.25);
      }
      box('dark', [x + sign * 2.4, 10.27, z], 0.79, 7.24, 10.65);
      put('arch', 'trim', x - sign * 1.38, 9.14, z, 4.53, 3.8, 0.86, Math.PI / 2);
      put('arch', room === 'catacomb' ? 'gilt' : 'copper', x - sign * 1.83, 9.14, z, 4.48, 3.77, 0.18, Math.PI / 2);
      for (const f of [-1, 0, 1]) box('royal', [x + sign * 1.69, 10.43, z + f * 2.19], 0.18, 3.88, 1.2);
      box('dark', [x, 15.63, z], 3.15, 1.02, 20.25);
      box('body', [x, 16.43, z], 3.53, 0.67, 20.38);
    }
  }
  for (const [x, span, high] of [
    [8.7, 18.0, 18.8],
    [24.5, 14.0, 21.7],
    [40.3, 18.0, 18.8],
  ]) {
    bay(x, -9.64, high, span * 0.54);
    box('basalt', [x, high * 0.43, -10.61], span, high * 1.12, 2.06);
    box('dark', [x, high - 0.9, -10.26], span + 0.42, 0.89, 2.46);
    box('trim', [x, high - 0.23, -10.28], span + 0.54, 0.38, 2.68);
  }
  for (const z of [-7.54, 36.85]) {
    bay(axis, z, 21.06, 26, true);
    const transoms =
      z < 0
        ? [[axis, 52.8]]
        : [
            [axis - 17.8, 17.4],
            [axis + 17.8, 17.4],
          ];
    for (const [x, span] of transoms) {
      box('basalt', [x, 19.92, z], span, 1.46, 1.82);
      box('dark', [x, 20.83, z], span + 0.24, 0.46, 2.12);
    }
    for (const sign of [-1, 1]) {
      const x = axis + sign * 24.9;
      box('dark', [x, 9.73, z], 2.78, 20.61, 3.14);
      beam([x, 14.65, z], [x - sign * 5.27, 19.41, z], 1.13, 1.6, 'basalt');
    }
  }
  return bays;
}

export const highSluices = [18, 31] as const;
// Uniform gate velocity and gravitational acceleration describe a continuous free jet into the north tailrace.
export function sluiceVeil(x: number, across: number, travel: number): XYZ {
  const lip = 10.72,
    bed = -1.02;
  const width = (0.93 + 0.18 * travel) * (1 - 0.11 * Math.abs(across));
  return [
    x + across * width,
    lip + (bed - lip) * travel * travel,
    2.96 + 0.82 * travel - 0.085 * across * across * travel,
  ];
}
export const collectorSpokes = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
