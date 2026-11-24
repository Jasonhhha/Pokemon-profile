import type { FortressInteriorFrame } from './field-fortress-state';
import { mazeFloors, type MazeRoom } from './fortress-maze';

type Frame = Pick<FortressInteriorFrame, 'now' | 'x' | 'y' | 'companionX' | 'companionY' | 'reduced'>;
type Pontoon = {
  x: number;
  z: number;
  height: number;
  velocity: number;
  loaded: boolean;
  bankX: number;
  bankZ: number;
};
type Wake = { x: number; z: number; time: number; strength: number };

export function createPontoonMotion(room: MazeRoom) {
  const { tiles, width, height } = mazeFloors[room];
  const cells: Pontoon[] = [];
  const grid: (Pontoon | undefined)[][] = Array.from({ length: height }, () => Array(width));
  for (let z = 0; z < height; z++)
    for (let x = 0; x < width; x++) {
      if (tiles[z][x] !== 'bridge') continue;
      const banks = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].filter(([dx, dz]) => tiles[z + dz]?.[x + dx] === 'channel');
      const [dx, dz] = banks[(x + z) % banks.length] ?? [1, 0];
      const cell = {
        x: x + 0.5,
        z: z + 0.5,
        height: 0,
        velocity: 0,
        loaded: false,
        bankX: x + 0.5 + 0.49 * dx,
        bankZ: z + 0.5 + 0.49 * dz,
      };
      cells.push(cell);
      grid[z][x] = cell;
    }
  const wakes: Wake[] = Array.from({ length: 4 }, () => ({ x: 0, z: 0, time: -Infinity, strength: 0 }));
  let previousTime = -Infinity;
  let nextWake = 0;

  // Spread weight onto neighboring rafts as a foot crosses their joint.
  function weight(px: number, pz: number, cell: Pontoon) {
    const radius = Math.hypot(px - cell.x, pz - cell.z);
    const u = Math.max(0, Math.min(1, (radius - 0.11) / 0.86));
    return 1 - u * u * (3 - 2 * u);
  }
  return {
    cells,
    wakes,
    surfaceAt(x: number, z: number) {
      return grid[Math.floor(z)]?.[Math.floor(x)]?.height ?? 0;
    },
    update(frame: Frame) {
      const elapsed = (frame.now - previousTime) / 1000;
      const snap = !Number.isFinite(elapsed) || elapsed < 0 || elapsed > 0.35;
      previousTime = frame.now;
      const dt = snap ? 0 : elapsed;
      const drag = 5.2,
        frequency = 9.4;
      const decay = Math.exp(-drag * dt),
        cosine = Math.cos(frequency * dt),
        sine = Math.sin(frequency * dt);
      if (snap || frame.reduced) for (const wake of wakes) wake.time = -Infinity;
      let changed = false;
      for (const cell of cells) {
        const player = weight(frame.x, frame.y, cell);
        const friend =
          frame.companionX === undefined || frame.companionY === undefined
            ? 0
            : weight(frame.companionX, frame.companionY, cell);
        const target = frame.reduced ? 0 : -0.047 * player - 0.009 * friend;
        const last = cell.height;
        if (snap || frame.reduced) {
          cell.height = target;
          cell.velocity = 0;
        } else {
          // Exact damped spring solution for a held load. It remains stable at low frame rates.
          const offset = last - target,
            speed = cell.velocity;
          cell.height = target + decay * (offset * cosine + ((speed + drag * offset) * sine) / frequency);
          cell.velocity =
            decay *
            (speed * cosine - ((drag * speed + (drag * drag + frequency * frequency) * offset) * sine) / frequency);
          if (Math.abs(cell.velocity) < 0.00008 && Math.abs(cell.height - target) < 0.000017) {
            cell.height = target;
            cell.velocity = 0;
          }
        }
        const loaded = player + friend * 0.2 >= (cell.loaded ? 0.22 : 0.53);
        if (!snap && !frame.reduced && loaded !== cell.loaded) {
          const wake = wakes[nextWake];
          Object.assign(wake, { x: cell.bankX, z: cell.bankZ, time: frame.now * 0.001, strength: loaded ? 1 : 0.52 });
          nextWake = (nextWake + 1) % wakes.length;
        }
        cell.loaded = loaded;
        changed ||= Math.abs(last - cell.height) > 1e-8;
      }
      return changed;
    },
  };
}
