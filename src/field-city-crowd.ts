import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, type Texture } from 'three';
import { createTraveler } from './field-travelers';
import { ringAngle, ringPosition, ringXDelta } from './field-ring-space';
import type { Direction } from './field';

const walking = [
  { role: 'commuter', from: 8.05, to: 13.88, z: 11.25, pace: .85, offset: 1.75, scale: .94 },
  { role: 'courier', from: 15.36, to: 24.27, z: 11.24, pace: 1.12, offset: 10.33, scale: .88 },
  { role: 'resident', from: 8.00, to: 11.16, z: 14.58, pace: .75, offset: 2.2, scale: .94 },
  { role: 'commuter', from: 25.77, to: 31.76, z: 10.59, pace: .85, offset: 7.35, scale: .88 },
  { role: 'resident', from: 27.22, to: 31.54, z: 14.12, pace: .76, offset: 4.0, scale: .91 },
  { role: 'courier', from: 37.92, to: 42.51, z: 11.46, pace: .78, offset: 8.40, scale: .89 },
] as const;

export function buildCityCrowd(shadow: Texture, polar = false) {
  const group = new Group();
  const patch = new PlaneGeometry(1, 1);
  patch.rotateX(-Math.PI / 2);
  const patchPaint = new MeshBasicMaterial({ map: shadow, transparent: true, opacity: .68, depthWrite: false, toneMapped: false });
  const cast = walking.map(route => {
    const traveler = createTraveler(route.role);
    const local = new Group();
    local.scale.setScalar(route.scale * (polar ? .91 : 1));
    local.add(traveler.model);
    const shade = new Mesh(patch, patchPaint);
    shade.position.y = .034;
    shade.scale.set(.75, 1, .62);
    local.add(shade);
    group.add(local);
    return { route, traveler, local, drift: 0 };
  });

  return {
    group,
    update(time: number, playerX: number, playerZ: number, calm: boolean, mobile: boolean, panorama = false) {
      for (const entry of cast) {
        const { route, traveler, local } = entry;
        const { from, to, z, pace, offset } = route;
        const span = to - from;
        const crossing = span / pace;
        const layover = 1.35;
        const cycle = (time / 1000 + offset) % (2 * (crossing + layover));
        const onReturn = cycle >= crossing + layover;
        const clock = onReturn ? cycle - crossing - layover : cycle;
        const phase = Math.min(1, clock / crossing);
        const rounded = phase < .09 ? phase * phase / .18 : phase > .91 ? .91 - (1 - phase) * (1 - phase) / .18 : phase - .045;
        const progress = Math.min(1, rounded / .91);
        const x = from + span * (onReturn ? 1 - progress : progress);
        const waiting = clock >= crossing;
        const facing: Direction = waiting ? 'down' : onReturn ? 'left' : 'right';
        const across = polar ? ringXDelta(playerX, x) : x - playerX;
        const distance = Math.hypot(across, z - playerZ);
        const separation = distance < .89 && !calm ? (z < playerZ ? -.29 : .29) * (1 - distance / .89) : 0;
        entry.drift = calm ? 0 : entry.drift + (separation - entry.drift) * .17;
        const mapX = calm ? from + span * .37 : x, mapZ = z + entry.drift;
        const position = polar ? ringPosition(mapX, mapZ) : { x: mapX, z: mapZ };
        local.position.set(position.x, 0, position.z);
        local.rotation.y = polar ? ringAngle(mapX) : 0;
        const offsetX = Math.abs(polar ? ringXDelta(playerX, mapX) : mapX - playerX);
        local.visible = panorama || offsetX < (mobile ? 12 : 20) && Math.abs(z - playerZ) < 10;
        if (local.visible) traveler.pose({ facing: calm ? 'down' : facing, time, phase: waiting || calm ? undefined : (x * 1.2 + offset) % 1, reduced: calm });
      }
    },
    dispose() {
      cast.forEach(entry => entry.traveler.dispose());
      patch.dispose(); patchPaint.dispose();
    },
  };
}
