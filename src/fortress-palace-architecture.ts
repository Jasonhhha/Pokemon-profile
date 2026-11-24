import { crownLevel, crownRise, crownRadius, royalMonument, suspendedHeight } from './fortress-palace-monuments';
import {
  catacombLift,
  mazeFloors,
  palaceBays,
  palaceElevation,
  palacePiers,
  processionalStairs,
  type MazeRoom,
} from './fortress-maze';

export type Stone =
  | 'body'
  | 'trim'
  | 'bright'
  | 'dark'
  | 'bronze'
  | 'iron'
  | 'jade'
  | 'lamp'
  | 'ice'
  | 'royal'
  | 'basalt'
  | 'gilt'
  | 'copper';
export type Form = 'box' | 'shaft' | 'capital' | 'arch' | 'column' | 'orb' | 'ring' | 'spike' | 'lid';
export type PalacePart = {
  form: Form;
  finish: Stone;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  yaw: number;
  roll: number;
  pitch: number;
};
export type Bay = { x: number; z: number; high: number; radius: number; overhead?: boolean; parts: PalacePart[] };
const built: Partial<Record<MazeRoom, Bay[]>> = {};

export function palaceArchitecture(room: MazeRoom): Bay[] {
  if (built[room]) return built[room]!;
  const bays: Bay[] = [],
    cold = room === 'catacomb',
    floor = mazeFloors[room];
  let bay!: Bay;
  const group = (x: number, z: number, high: number, radius = 2) => {
    bay = { x, z, high, radius, parts: [] };
    bays.push(bay);
  };
  const part = (
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
  ) => {
    bay.parts.push({ form, finish, x, y, z, w, h, d, yaw, roll, pitch });
  };
  const box = (finish: Stone, x: number, y: number, z: number, w: number, h: number, d: number) =>
    part('box', finish, x, y, z, w, h, d);
  function pier(x: number, z: number, order: number) {
    const base = palaceElevation(room, x, z),
      height = (cold ? 5.15 : 4.87) + (order === 1 ? 0.75 : 0);
    group(x, z, base + height + 1.45, 1.55);
    bay.overhead = true;
    box('dark', x, -0.4, z, 1.73, 1.04, 1.73);
    box('body', x, base + 0.11, z, 1.58, 0.23, 1.58);
    part('column', 'bright', x, base + 0.35, z, 0.72, 0.23, 0.72);
    part('column', 'bronze', x, base + 0.505, z, 0.61, 0.1, 0.61);
    part('shaft', 'trim', x, base + 0.55, z, 0.55, height, 0.55);
    part('column', 'bronze', x, base + height + 0.5, z, 0.49, 0.14, 0.49);
    part('capital', 'bright', x, base + height + 0.57, z, 0.67, 0.79, 0.67);
    box('trim', x, base + height + 1.41, z, 1.59, 0.22, 1.59);
    box('bronze', x, base + height + 1.55, z, 1.68, 0.08, 1.68);
    if (order === 1)
      for (const side of [-1, 1]) {
        box('bronze', x + side * 0.63, base + 1.4, z, 0.12, 0.09, 0.46);
        part('orb', 'lamp', x + side * 0.71, base + 1.68, z, 0.12, 0.22, 0.12);
      }
  }
  function arcade(x: number, z: number, y: number, span: number, yaw: number, height: number, major = false) {
    group(x, z, y + height * 1.32, span * 0.58);
    bay.overhead = true;
    const rx = (span - 0.5) / 2;
    part('arch', major ? 'bright' : 'body', x, y, z, rx, height, major ? 0.68 : 0.48, yaw);
    part(
      'arch',
      major ? 'bronze' : 'trim',
      x + Math.sin(yaw) * 0.28,
      y + 0.04,
      z + Math.cos(yaw) * 0.28,
      rx * 0.982,
      height * 0.984,
      0.08,
      yaw,
    );
  }
  for (const xi of palacePiers) for (const zi of palaceBays) pier(xi + 0.5, zi + 0.5, xi === 19 || xi === 29 ? 1 : 0);
  for (const xi of palacePiers)
    for (let j = 1; j < palaceBays.length; j++) {
      const a = palaceBays[j - 1] + 0.5,
        b = palaceBays[j] + 0.5;
      const central = xi === 19 || xi === 29,
        y =
          (cold ? 6.23 : 5.95) +
          (central ? 0.75 : 0) +
          Math.min(palaceElevation(room, xi, a), palaceElevation(room, xi, b));
      arcade(xi + 0.5, (a + b) / 2, y, b - a, Math.PI / 2, 1.75, central);
    }
  // The hydraulic gate and the crown drum each own a clear axial sight line.
  for (const z of cold ? [6.5] : [28.5])
    arcade(24.5, z, (cold ? 6.93 : 6.65) + palaceElevation(room, 24.5, z), 10, 0, 2.85, true);
  for (const [x, pz, yaw] of [
    [24.5, 2.48, 0],
    [2.48, 24.5, Math.PI / 2],
    [46.52, 24.5, -Math.PI / 2],
  ]) {
    const side = yaw !== 0;
    for (let k = -3; k <= 3; k++) {
      const cx = x + (side ? 0 : k * 6.0),
        cz = pz + (side ? k * 6.0 : 0),
        sy = palaceElevation(room, cx, cz);
      group(cx, cz, sy + 5.0, 3.4);
      if (side || k !== 0) part('box', 'dark', cx, 1.75, cz, 6.12, 6.25, 0.43, yaw);
      part('arch', 'trim', cx, sy + 2.04, cz + 0.05, 2.18, 2.05, 0.67, yaw);
      for (const d of [-1, 1])
        part('box', 'body', cx + d * (side ? 0 : 2.78), 1.2, cz + d * (side ? 2.78 : 0), 0.74, 4.5, 0.94, yaw);
    }
  }
  // The clerestory belongs to the rock chamber beyond the headwall. Each slit has a deep sill.
  for (let i = -6; cold && i <= 6; i++) {
    const x = 24.5 + i * 3.88,
      z = -0.36;
    group(x, z, 15.8, 2.56);
    box('dark', x, i === 0 ? 10.94 : 6.52, z, 3.96, i === 0 ? 8.68 : 17.52, 1.19);
    box('trim', x, 8.67, z + 0.72, 3.93, 0.24, 0.4);
    box('bronze', x, 8.92, z + 0.73, 3.93, 0.078, 0.51);
    for (const side of [-1, 1]) {
      box('body', x + side * 1.47, 10.62, z + 0.64, 0.53, 4.67, 0.86);
      box('bright', x + side * 1.47, 12.96, z + 0.65, 0.72, 0.2, 1.0);
    }
    part('arch', 'trim', x, 11.28, z + 0.69, 1.22, 1.47, 0.63);
    box('royal', x, 10.78, z + 0.69, 1.42, 2.75, 0.1);
    for (const dx of [-0.42, 0, 0.42]) {
      box(i % 3 === 0 ? 'jade' : 'bronze', x + dx, 10.96, z + 0.76, 0.064, 1.67, 0.08);
    }
    box('body', x, 13.68, z + 0.44, 3.93, 0.31, 1.1);
  }
  // The distant headwall closes the perspective. Its machinery lives behind three open arcades.
  group(24.5, 1.78, 15.6, 13.0);
  for (const sign of [-1, 1]) box('dark', 24.5 + sign * 7.23, 3.39, 1.28, 8.94, 10.4, 1.1);
  box('dark', 24.5, 7.64, 1.28, 5.64, 1.9, 1.1);
  for (const sign of [-1, 1]) {
    const x = 24.5 + sign * 6.6;
    box('body', x, 3.43, 1.93, 3.3, 9.1, 1.78);
    box('bright', x, 6.96, 2.13, 3.58, 0.32, 1.97);
    box('bronze', x, 7.28, 2.13, 3.69, 0.14, 2.04);
    for (const dx of [-0.86, 0.86]) {
      part('shaft', 'trim', x + dx, 2.09, 2.98, 0.29, 4.22, 0.29);
      part('capital', 'bright', x + dx, 6.28, 2.98, 0.36, 0.52, 0.36);
    }
    part('arch', 'bright', 24.5 + sign * 8.84, 3.67, 2.05, 2.04, 2.34, 0.64);
    for (const dx of [-1.26, -0.87, -0.43, 0, 0.43, 0.87, 1.26])
      box('iron', 24.5 + sign * 8.84 + dx, 3.07, 2.04, 0.076, 4.46, 0.15);
    part('column', 'dark', x, 7.85, 2.1, 1.46, 0.95, 1.24);
    if (cold) {
      part('spike', 'ice', x, 8.15, 2.1, 0.93, 3.54, 0.87);
      for (const dx of [-0.61, 0.61]) part('spike', 'jade', x + dx, 8.08, 2.1, 0.43, 2.6, 0.4);
    } else {
      part('orb', 'royal', x, 8.83, 2.1, 1.17, 1.4, 1.17);
      part('ring', 'bronze', x, 8.91, 2.1, 1.47, 1.47, 0.92, sign * 0.55);
      part('column', 'bronze', x, 10.4, 2.1, 0.26, 0.77, 0.26);
    }
  }
  part('arch', 'bright', 24.5, 5.63, 2.47, 3.75, 3.6, 0.92);
  part('arch', 'bronze', 24.5, 5.68, 3.0, 3.68, 3.58, 0.13);
  for (const side of [-1, 1]) {
    const x = 24.5 + side * 3.77;
    part('shaft', 'trim', x, 0.64, 2.62, 0.66, 5.25, 0.7);
    part('capital', 'bright', x, 5.62, 2.62, 0.82, 0.77, 0.82);
  }
  box('royal', 24.5, 8.89, 1.96, 6.65, 5.26, 0.47);
  part('ring', 'bronze', 24.5, 8.58, 2.77, 2.56, 2.56, 1.07);
  part('ring', 'bright', 24.5, 8.58, 2.81, 2.11, 2.11, 0.61);
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    part('box', 'bronze', 24.5 + 2.25 * Math.cos(a), 8.58 + 2.25 * Math.sin(a), 2.93, 0.34, 0.095, 0.14, 0, a);
  }
  part('orb', 'jade', 24.5, 8.58, 2.94, 0.53, 0.67, 0.44);
  if (cold) {
    for (const [x, z] of [
      [16.5, 17.5],
      [32.5, 31.5],
    ]) {
      group(x, z, 2.2, 2.35);
      box('dark', x, -0.24, z, 3.5, 1.6, 2.49);
      box('bright', x, 0.69, z, 3.24, 0.26, 2.15);
      box('royal', x, 1.09, z, 2.81, 0.55, 1.51);
      part('lid', 'trim', x, 1.4, z, 1.36, 0.72, 0.81);
      for (const dx of [-1, 1]) box('bronze', x + dx, 1.05, z + 0.777, 0.07, 0.48, 0.048);
    }
  }
  if (cold) {
    // Four stone shoulders support the round crossing high above its open ambulatory.
    for (const x of [13.5, 35.5])
      for (const z of [14.5, 33.5]) {
        group(x, z, 9.6, 2.65);
        box('royal', x, 3.58, z, 1.71, 6.97, 1.67);
        for (const dx of [-0.74, 0.74]) {
          part('shaft', 'bright', x + dx, 0.3, z + 0.71, 0.31, 6.27, 0.3);
          part('capital', 'bronze', x + dx, 6.52, z + 0.71, 0.39, 0.65, 0.39);
        }
        box('trim', x, 7.29, z, 2.17, 0.35, 2.15);
        box('bronze', x, 7.56, z, 2.37, 0.165, 2.29);
      }
    // A gimballed armillary is suspended from the drum, clear of the central processional stairs.
    group(24.5, 24.5, suspendedHeight + 2, 5.2);
    bay.overhead = true;
    part('ring', 'basalt', 24.5, suspendedHeight - 0.18, 24.5, 3.07, 3.07, 0.91, 0, 0, Math.PI / 2);
    part('orb', 'royal', 24.5, suspendedHeight, 24.5, 0.7, 0.73, 0.7);
    for (const side of [-1, 1]) {
      part('spike', 'ice', 24.5 + side * 1.13, suspendedHeight - 0.28, 24.5, 0.3, 1.05, 0.31, side * 0.54, side * 0.32);
    }
  }
  function gate(x: number, z: number, down: boolean) {
    const b = palaceElevation(room, x, z),
      h = down ? 2.45 : 1.86,
      span = down ? 2.65 : 2.29;
    group(x, z, b + h + 3.1, 3.17);
    if (!down) bay.overhead = true;
    for (const side of [-1, 1]) {
      const cx = x + side * span;
      box('dark', cx, b + 0.15, z, 0.91, 0.3, 1.55);
      part('shaft', 'bright', cx, b + 0.3, z, 0.4, h, 0.45);
      part('capital', 'bronze', cx, b + h + 0.3, z, 0.48, 0.36, 0.52);
      part('orb', 'lamp', cx, b + 1.21, z + 0.52, 0.16, 0.25, 0.14);
    }
    if (cold) {
      // Thicker lintels and paired radial stone fans distinguish the entrance to the royal necropolis.
      for (const side of [-1, 1]) {
        const cx = x + side * span;
        box('royal', cx, b + h + 0.7, z, 1.23, 0.9, 1.18);
        box('bright', cx, b + h + 1.21, z, 1.53, 0.17, 1.34);
        part('spike', 'ice', cx, b + h + 1.29, z, 0.32, 1.28, 0.34);
      }
      box('trim', x, b + h + 1.11, z, span * 2 + 1.63, 0.6, 1.03);
      box('bronze', x, b + h + 1.49, z, span * 2 + 1.79, 0.11, 1.13);
      box('royal', x, b + h + 1.73, z, span * 2 + 0.78, 0.36, 0.83);
      for (let i = -3; i <= 3; i++) {
        const len = 0.56 + (3 - Math.abs(i)) * 0.24,
          angle = i * 0.28;
        part('box', 'bright', x + Math.sin(angle) * 0.77, b + h + 1.93 + len * 0.41, z, 0.23, len, 0.45, 0, -angle);
      }
      part('orb', 'jade', x, b + h + 1.49, z + 0.64, 0.26, 0.26, 0.13);
      return;
    }
    part('arch', 'bright', x, b + h + 0.6, z, span - 0.11, 1.72, 0.84);
    part('arch', 'bronze', x, b + h + 0.65, z + 0.43, span - 0.1, 1.71, 0.09);
    part('ring', 'copper', x, b + h + 2.67, z + 0.41, 0.3, 0.3, 0.47);
    part('orb', 'jade', x, b + h + 2.67, z + 0.37, 0.19, 0.19, 0.08);
  }
  const descending = processionalStairs(room);
  for (const [n, step] of descending.entries()) {
    group(24.5, step.z, step.top + 1, 3.1);
    box(n % 4 === 0 ? 'trim' : 'body', 24.5, step.top - 0.13, step.z, 4.56, 0.26, 0.51);
    box('bright', 24.5, step.top + 0.015, step.z + 0.214, 4.51, 0.038, 0.063);
    if (n % 5 === 1) {
      for (const side of [-1, 1]) {
        const x = 24.5 + side * 2.43;
        box('dark', x, step.top + 1.3, step.z, 0.67, 3.41, 0.68);
        part('shaft', 'trim', x, step.top + 0.17, step.z, 0.32, 2.54, 0.34);
        part('capital', 'bright', x, step.top + 2.67, step.z, 0.41, 0.49, 0.42);
        part('orb', 'lamp', x - side * 0.23, step.top + 1.6, step.z + 0.28, 0.11, 0.16, 0.11);
      }
      part('arch', 'trim', 24.5, step.top + 3.18, step.z, 2.39, 1.63, 0.58);
    }
  }
  for (const sign of [-1, 1]) {
    group(24.5 + sign * 2.84, -1.8, 5.0, 6.8);
    box('dark', 24.5 + sign * 2.84, 1.25, -1.8, 0.63, 7.0, 12.4);
  }
  group(24.5, -7.24, 3.4, 3.2);
  box('royal', 24.5, 0.31, -7.24, 5.12, 5.34, 0.4);
  part('ring', 'jade', 24.5, 0.6, -7.02, 0.85, 0.85, 0.51);
  gate(24.5, 5.34, true);
  gate(24.5, 43.7, false);
  for (const [x, z] of [
    [16.5, 17.5],
    [32.5, 17.5],
    [16.5, 31.5],
    [32.5, 31.5],
  ]) {
    if (cold && ((x === 16.5 && z === 17.5) || (x === 32.5 && z === 31.5))) continue;
    group(x, z, cold ? 4.85 : 3.75, 2.2);
    box('dark', x, -0.48, z, 3.15, 1.3, 3.15);
    box('bright', x, 0.26, z, 2.75, 0.29, 2.75);
    part('column', 'bronze', x, 0.53, z, 1.08, 0.24, 1.08);
    if (cold) {
      part('spike', 'ice', x, 0.63, z, 0.95, 3.65, 0.87);
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        part(
          'spike',
          k % 2 ? 'ice' : 'jade',
          x + 0.93 * Math.cos(a),
          0.48,
          z + 0.9 * Math.sin(a),
          0.29 + 0.047 * k,
          1.3 + 0.29 * (k % 3),
          0.31,
          a,
          0.21 * Math.cos(a),
          -0.21 * Math.sin(a),
        );
      }
      part('ring', 'bronze', x, 1.1, z, 1.15, 0.99, 0.73, 0.16, 0, -Math.PI * 0.44);
    } else {
      part('column', 'trim', x, 1.12, z, 0.6, 1.05, 0.6);
      part('column', 'bronze', x, 1.76, z, 0.84, 0.23, 0.84);
      for (const k of [-1, 1]) part('arch', 'bronze', x, 1.79, z, 0.86, 1.07, 0.15, (Math.PI * k) / 4);
      part('orb', 'jade', x, 1.98, z, 0.39, 0.43, 0.39);
    }
  }
  const { x, y } = floor.instrument,
    sx = x + 0.5,
    sz = y + 0.5;
  group(sx, sz, 2.12, 1.18);
  box('dark', sx, -0.52, sz, 1.3, 1.51, 1.26);
  box('trim', sx, 0.25, sz, 1.36, 0.13, 1.29);
  part('column', 'trim', sx, 0.56, sz, 0.51, 0.77, 0.51);
  part('column', 'bronze', sx, 0.99, sz, 0.68, 0.12, 0.68);
  part('ring', 'bronze', sx, 1.28, sz, 0.52, 0.52, 0.59, 0, 0, -0.32);
  part('orb', 'jade', sx, 1.21, sz, 0.216, 0.218, 0.215);
  if (cold) {
    const x = catacombLift.x + 0.5,
      z = catacombLift.y + 0.5;
    group(x, z, 2.6, 1.35);
    box('dark', x, 0.04, z, 1.26, 0.09, 1.18);
    for (let k = -4; k <= 4; k++) box('bronze', x + k * 0.128, 0.109, z, 0.066, 0.036, 1.09);
    for (const side of [-1, 1]) {
      box('iron', x - 0.65, 1.28, z + side * 0.47, 0.12, 2.5, 0.15);
      part('orb', 'jade', x - 0.65, 1.5, z + side * 0.47, 0.11, 0.19, 0.11);
    }
    box('bright', x - 0.65, 2.58, z, 0.2, 0.17, 1.21);
  }
  bays.push(...royalMonument(room));
  built[room] = bays;
  return bays;
}

type VaultPanel = { vertices: [number, number, number][]; shade: number; z: number; x: number };
const ceilings: Partial<Record<MazeRoom, VaultPanel[]>> = {};
export function palaceVault(room: MazeRoom) {
  if (ceilings[room]) return ceilings[room]!;
  const result: VaultPanel[] = [],
    cold = room === 'catacomb';
  for (const [axis, span, spring, rise] of [
    [9.5, 6.3, 5.76, 2.82],
    [24.5, 5.07, 6.83, 3.8],
    [39.5, 6.3, 5.76, 2.82],
  ]) {
    for (let row = 0; row < 17; row++)
      for (let i = 0; i < 14; i++) {
        const z = 0.64 + row * 2.78,
          dz = 2.78,
          period = (row + i) % 5;
        // Narrow slits in selected crowns admit light from the maintenance level overhead.
        if (row % 4 === 2 && i >= 6 && i <= 7) continue;
        if (
          cold &&
          Math.hypot(
            (axis + span * Math.cos(((i + 0.5) * Math.PI) / 14) - 24.5) / crownRadius,
            (z + dz * 0.5 - 24.5) / (crownRadius * 0.94),
          ) < 1.08
        )
          continue;
        const at = (slice: number, y: number): [number, number, number] => {
          const a = (slice * Math.PI) / 14;
          return [axis + span * Math.cos(a), y, spring + rise * Math.sin(a) + (cold ? 0.3 : 0)];
        };
        result.push({
          x: axis + span * Math.cos(((i + 0.5) * Math.PI) / 14),
          z: z + dz * 0.5,
          vertices: [
            at(i + 0.009, z + 0.013),
            at(i + 0.991, z + 0.013),
            at(i + 0.991, z + dz - 0.013),
            at(i + 0.009, z + dz - 0.013),
          ],
          shade: 0.69 + 0.049 * period + (row % 4 === 0 ? 0.14 : 0),
        });
      }
  }
  if (cold) {
    const segments = 32,
      rings = 6;
    const dome = (longitude: number, latitude: number): [number, number, number] => {
      const a = (longitude * 2 * Math.PI) / segments,
        b = (latitude * Math.PI) / (2 * rings);
      return [
        24.5 + crownRadius * Math.cos(a) * Math.cos(b),
        24.5 + crownRadius * 0.94 * Math.sin(a) * Math.cos(b),
        crownLevel + crownRise * Math.sin(b),
      ];
    };
    for (let row = 0; row < rings; row++)
      for (let s = 0; s < segments; s++) {
        if (row === rings - 1) continue; // The oculus opens onto the ancient shaft above.
        const vertices = [
          dome(s + 0.015, row + 0.025),
          dome(s + 0.015, row + 0.974),
          dome(s + 0.985, row + 0.974),
          dome(s + 0.985, row + 0.025),
        ];
        result.push({
          x: (vertices[0][0] + vertices[2][0]) / 2,
          z: (vertices[0][1] + vertices[2][1]) / 2,
          vertices,
          shade: 0.63 + 0.055 * ((row + s) % 4) + (s % 4 === 0 ? 0.18 : 0),
        });
      }
  }
  ceilings[room] = result;
  return result;
}
