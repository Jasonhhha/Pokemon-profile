import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, type Texture } from 'three';
import { createTraveler } from './field-travelers';
import { ringAngle, ringPosition, ringRadius, ringXDelta, wrapRingX } from './field-ring-space';
import { maps } from './field-layout';
import type { Direction } from './field';

type Waypoint = readonly [column: number, row: number];

const walking = [
  { role: 'commuter', points: [[8.32, 11.30], [13.47, 11.30]], speed: 1.57, offset: 1.75, scale: .94 },
  { role: 'courier', points: [[15.36, 11.29], [19.52, 11.29], [19.52, 12.39], [21.54, 12.39], [21.54, 11.29], [24.27, 11.29]], speed: 1.92, offset: 10.33, scale: .88 },
  { role: 'resident', points: [[8.37, 14.56], [11.21, 14.56]], speed: 1.32, offset: 2.20, scale: .94 },
  { role: 'commuter', points: [[25.77, 10.59], [31.76, 10.59]], speed: 1.52, offset: 7.35, scale: .88 },
  { role: 'courier', points: [[37.92, 11.46], [42.51, 11.46]], speed: 1.64, offset: 8.40, scale: .89 },
  { role: 'courier', points: [[4.47, 35.52], [9.48, 35.52], [9.48, 33.67]], speed: 1.64, offset: 2.60, scale: .91 },
  { role: 'resident', points: [[17.35, 38.53], [21.55, 38.53], [21.55, 36.53], [20.38, 36.53]], speed: 1.31, offset: 7.20, scale: .94 },
  { role: 'commuter', points: [[23.53, 33.53], [24.51, 33.53], [24.51, 35.52], [23.46, 35.52]], speed: 1.61, offset: 4.40, scale: .93 },
  { role: 'resident', points: [[32.34, 36.53], [36.54, 36.53], [36.54, 38.46]], speed: 1.38, offset: 1.80, scale: .89 },
  { role: 'resident', points: [[14.52, 32.48], [14.52, 34.48], [15.64, 34.48]], speed: 1.25, offset: 4.67, scale: .92 },
] as const;

const canStand = (x: number, z: number) => maps.harbor.walkable[Math.floor(z)]?.[Math.floor(wrapRingX(x))] === true;

type Leg = { start: Waypoint; dx: number; dz: number; distance: number; length: number };

function compileRoute(points: readonly Waypoint[]) {
  const legs: Leg[] = [];
  let distance = 0;
  for (let i = 1; i < points.length; i++) {
    const start = points[i - 1], end = points[i];
    const dx = ringXDelta(start[0], end[0]), dz = end[1] - start[1];
    const length = Math.hypot(dx * ringRadius((start[1] + end[1]) / 2) * Math.PI / 20, dz * .48);
    const samples = Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) * 6);
    for (let j = 0; j <= samples; j++) {
      const t = j / Math.max(1, samples);
      if (!canStand(start[0] + t * dx, start[1] + t * dz)) return;
    }
    if (length > .005) {
      legs.push({ start, dx, dz, distance, length });
      distance += length;
    }
  }
  return distance ? { legs, distance } : undefined;
}

function paceAlong(phase: number) {
  const soft = .10;
  if (phase < soft) return phase ** 2 / (2 * soft * (1 - soft));
  if (phase > 1 - soft) return 1 - (1 - phase) ** 2 / (2 * soft * (1 - soft));
  return (phase - soft * .5) / (1 - soft);
}

export function buildCityCrowd(shadow: Texture) {
  const group = new Group();
  const patch = new PlaneGeometry(1, 1);
  patch.rotateX(-Math.PI / 2);
  const patchPaint = new MeshBasicMaterial({ map: shadow, transparent: true, opacity: .68, depthWrite: false, toneMapped: false });
  const cast = walking.flatMap(spec => {
    const route = compileRoute(spec.points);
    if (!route) return [];
    const traveler = createTraveler(spec.role);
    const local = new Group();
    local.scale.setScalar(spec.scale * .91);
    local.add(traveler.model);
    const shade = new Mesh(patch, patchPaint);
    shade.position.y = .034;
    shade.scale.set(.75, 1, .62);
    local.add(shade);
    group.add(local);
    return [{ spec, route, traveler, local, drift: 0 }];
  });

  return {
    group,
    update(time: number, playerX: number, playerZ: number, calm: boolean, mobile: boolean, panorama = false) {
      for (const entry of cast) {
        const { spec, route, traveler, local } = entry;
        const crossing = route.distance / spec.speed;
        const pause = spec.role === 'resident' ? 1.8 : 1.25;
        const cycle = (time / 1000 + spec.offset) % (2 * (crossing + pause));
        const returning = cycle >= crossing + pause;
        const clock = returning ? cycle - crossing - pause : cycle;
        const waiting = clock >= crossing;
        const fraction = paceAlong(Math.min(1, clock / crossing));
        const progress = calm ? .37 : returning ? 1 - fraction : fraction;
        const distance = progress * route.distance;
        const leg = route.legs.find(item => distance <= item.distance + item.length) ?? route.legs.at(-1)!;
        const at = (distance - leg.distance) / leg.length;
        const x = leg.start[0] + leg.dx * at;
        const z = leg.start[1] + leg.dz * at;
        const delta = ringXDelta(playerX, x);
        const room = Math.hypot(delta * ringRadius(z) * Math.PI / 20, (z - playerZ) * .48);
        const nudge = room < 1.09 && !calm && leg.dx ? (z < playerZ ? -.22 : .22) * (1 - room / 1.09) : 0;
        entry.drift += (nudge - entry.drift) * (calm ? 1 : .20);
        const mapZ = canStand(x, z + entry.drift) ? z + entry.drift : z;
        const position = ringPosition(x, mapZ);
        const forward = returning ? -1 : 1;
        const facing: Direction = calm || waiting ? 'down' : leg.dx
          ? leg.dx * forward > 0 ? 'right' : 'left'
          : leg.dz * forward > 0 ? 'down' : 'up';
        local.position.set(position.x, 0, position.z);
        local.rotation.y = ringAngle(x);
        local.visible = panorama || Math.abs(delta) < (mobile ? 12 : 20) && Math.abs(z - playerZ) < 10;
        if (local.visible) traveler.pose({ facing, time, phase: waiting || calm ? undefined
          : ((returning ? route.distance - distance : distance) / .71 + spec.offset) % 1, reduced: calm });
      }
    },
    dispose() {
      cast.forEach(entry => entry.traveler.dispose());
      patch.dispose();
      patchPaint.dispose();
    },
  };
}
