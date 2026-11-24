import { sealVolume } from './fortress-portals';
import type { PowerPoint } from './fortress-power-paths';

export const thronePalette = {
  basalt: '#42494a', edgeStone: '#787569', blackIron: '#303e41', patina: '#52665f',
  bronze: '#8b704c', rubbedBronze: '#b09464', porcelain: '#b6b5a1', recess: '#223438',
};
export type ThroneFinish = keyof typeof thronePalette;
export type ThroneFace = { points: PowerPoint[]; finish: ThroneFinish; normal: PowerPoint; center: PowerPoint };
type Section = [radius: number, elevation: number, z: number, halfWidth: number, halfDepth: number];
export const pressAxis = { x: sealVolume.x, z: sealVolume.z - 3.10, y: 3.63 };

// Each curved cheek is a structural rib with a bevelled octagonal cross section.
const sections: Section[] = [
  [4.89, -.59, -1.05, .57, .68], [4.96, .42, -1.20, .52, .62],
  [4.96, 1.64, -1.44, .58, .62], [4.55, 2.46, -1.92, .54, .58],
  [3.96, 2.94, -2.22, .48, .56], [3.09, 3.18, -2.48, .43, .51],
  [2.07, 3.30, -2.69, .37, .48], [1.19, 3.40, -2.87, .30, .39],
];
const tau = Math.PI * 2;
const sub = (a: PowerPoint, b: PowerPoint): PowerPoint => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: PowerPoint, b: PowerPoint) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function cross(a: PowerPoint, b: PowerPoint): PowerPoint {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function mean(points: PowerPoint[]): PowerPoint {
  const value: PowerPoint = [0, 0, 0];
  for (const p of points) { value[0] += p[0]; value[1] += p[1]; value[2] += p[2]; }
  return [value[0] / points.length, value[1] / points.length, value[2] / points.length];
}
function face(output: ThroneFace[], points: PowerPoint[], finish: ThroneFinish, inside: PowerPoint) {
  const center = mean(points);
  const normal = cross(sub(points[1], points[0]), sub(points[2], points[0]));
  const magnitude = Math.hypot(...normal);
  if (magnitude < .000001) return;
  const sign = dot(normal, sub(center, inside)) < 0 ? -1 : 1;
  if (sign < 0) points.reverse();
  output.push({ points, finish, center, normal: [normal[0] * sign / magnitude, normal[1] * sign / magnitude, normal[2] * sign / magnitude] });
}
function connect(output: ThroneFace[], a: PowerPoint[], b: PowerPoint[], finishes: ThroneFinish[], cap = false) {
  const inside = mean([...a, ...b]);
  for (let i = 0; i < a.length; i++) {
    const next = (i + 1) % a.length;
    face(output, [a[i], a[next], b[next], b[i]], finishes[i % finishes.length], inside);
  }
  if (cap) { face(output, [...a], finishes[0], inside); face(output, [...b], finishes[0], inside); }
}

function rectAt(x: number, y: number, z: number, w: number, d: number): PowerPoint[] {
  return [[x - w, y, z - d], [x + w, y, z - d], [x + w, y, z + d], [x - w, y, z + d]];
}
function foundation(out: ThroneFace[], x: number, z: number, low: number, high: number, w: number, d: number, finish: ThroneFinish) {
  connect(out, rectAt(x, low, z, w, d), rectAt(x, high, z, w, d), [finish], true);
}
const bevel = [[-1, -.72], [-.78, -1], [.78, -1], [1, -.72], [1, .72], [.78, 1], [-.78, 1], [-1, .72]] as const;

function ribPoint(side: number, i: number, width: number, depth: number): PowerPoint {
  const [r, y, z, halfW, halfD] = sections[i];
  const a = sections[Math.max(0, i - 1)], b = sections[Math.min(sections.length - 1, i + 1)];
  const length = Math.hypot(b[1] - a[1], b[0] - a[0]);
  const outward = (b[1] - a[1]) / length, up = (a[0] - b[0]) / length;
  return [sealVolume.x + side * (r + outward * halfW * width), y + up * halfW * width, sealVolume.z + z + halfD * depth];
}
function interpolate(a: PowerPoint, b: PowerPoint, t: number): PowerPoint {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// The bearing faces look out across the observation bridge. The rear edges stay below the service galleries.
function bearing(out: ThroneFace[], x: number, y: number, z: number, radius: number) {
  const ring = (r: number, depth: number, sides: number): PowerPoint[] =>
    Array.from({ length: sides }, (_, i) => [x + r * Math.cos(tau * i / sides), y + r * Math.sin(tau * i / sides), z + depth]);
  const outer = ring(radius, .15, 20), inner = ring(radius * .76, .15, 20), dark = ring(radius * .76, .058, 20);
  connect(out, ring(radius * 1.07, -.12, 16), ring(radius * 1.07, .05, 16), ['blackIron'], true);
  connect(out, ring(radius, .05, 20), outer, ['bronze']);
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length, inside: PowerPoint = [x, y, z];
    face(out, [outer[i], outer[j], inner[j], inner[i]], i % 5 ? 'bronze' : 'rubbedBronze', inside);
    const angle = tau * (i + .5) / outer.length;
    face(out, [inner[i], inner[j], dark[j], dark[i]], 'blackIron', [x + radius * Math.cos(angle), y + radius * Math.sin(angle), z]);
  }
  // Six tapered cast spokes cross the sunken recess. Faceted bosses catch the chamber light.
  for (let i = 0; i < 6; i++) {
    const angle = tau * i / 6;
    const spoke = (r: number, w: number, depth: number): PowerPoint =>
      [x + r * Math.cos(angle) - w * Math.sin(angle), y + r * Math.sin(angle) + w * Math.cos(angle), z + depth];
    const section = (r: number, w: number) => [spoke(r, -w, .07), spoke(r, w, .07), spoke(r, w, .16), spoke(r, -w, .16)];
    connect(out, section(radius * .18, radius * .065), section(radius * .80, radius * .093), ['bronze', 'rubbedBronze', 'patina', 'blackIron']);
  }
  connect(out, ring(radius * .31, .14, 12), ring(radius * .27, .21, 12), ['bronze'], true);
  connect(out, ring(radius * .16, .21, 6), ring(radius * .13, .25, 6), ['rubbedBronze'], true);
}

function clevis(out: ThroneFace[], side: number) {
  const point = (r: number, h: number, z: number): PowerPoint => [sealVolume.x + side * r, h, sealVolume.z + z];
  const bar = (a: PowerPoint[], b: PowerPoint[]) => connect(out, a, b, ['basalt', 'patina', 'rubbedBronze', 'blackIron'], true);
  const cross = (r: number, h: number, z: number, w: number, thickness: number): PowerPoint[] =>
    [point(r - w, h, z - thickness), point(r + w, h, z - thickness), point(r + w, h, z + thickness), point(r - w, h, z + thickness)];
  // Forward heel and two separated cast lugs transmit the reaction to the plinth.
  foundation(out, sealVolume.x + side * 4.45, sealVolume.z + .59, -.68, -.45, .58, .64, 'basalt');
  foundation(out, sealVolume.x + side * 4.45, sealVolume.z + .59, -.45, -.23, .54, .60, 'bronze');
  for (const lane of [-.24, .24]) {
    bar(cross(4.43 + lane, -.23, .55, .19, .45), cross(4.67 + lane, 1.32, -.37, .14, .25));
    bar(cross(4.67 + lane, 1.32, -.37, .14, .25), cross(4.85 + lane, 1.94, -.75, .15, .24));
  }
  const at = point(4.57, 1.65, -.43);
  bearing(out, at[0], at[1], at[2], .80);
}

function backboard(out: ThroneFace[]) {
  const center = sealVolume.x, rear = sealVolume.z - 4.42;
  // Three intake recesses are cut through the ashlar screen behind the captive.
  // The reveals and deep back face keep the ice silhouette legible against the machinery.
  const bays = [{ offset: -2.21, half: 1.00, top: 3.22 }, { offset: 0, half: 1.18, top: 2.65 }, { offset: 2.21, half: 1.00, top: 3.22 }];
  for (const { offset, half, top } of bays) {
    const x = center + offset, z = rear + Math.abs(offset) * .10, bottom = -.56;
    const opening = half * .63, shoulder = .91, crest = top - .48;
    const profile = [[-opening, bottom + .19], [-opening, shoulder], [-opening * .87, shoulder + .39],
      [-opening * .49, crest - .19], [0, crest], [opening * .49, crest - .19],
      [opening * .87, shoulder + .39], [opening, shoulder], [opening, bottom + .19]];
    const at = (u: number, y: number, depth: number): PowerPoint => [x + u, y, z + depth - y * .057];
    const inside = at(0, 1.14, -.42);
    const front = (u: number, y: number) => at(u, y, .20);
    const niche = profile.map(([u, h]) => at(u * .97, h, -.18));
    face(out, niche, 'recess', at(0, 1.14, -.66));
    for (let i = 0; i < profile.length - 1; i++) {
      const [u, h] = profile[i], [v, k] = profile[i + 1];
      face(out, [front(u, h), front(v, k), niche[i + 1], niche[i]], i < 4 ? 'blackIron' : 'edgeStone', inside);
      if (i > 0 && i < profile.length - 2) {
        face(out, [front(u, h), front(v, k), front(v, top), front(u, top)], 'basalt', inside);
        // Separate wedge-shaped voussoirs follow the pointed recess.
        const expand = (a: number, b: number) => at(a * 1.12, b + .091, .223);
        face(out, [at(u, h, .223), at(v, k, .223), expand(v, k), expand(u, h)], i % 3 === 1 ? 'edgeStone' : 'patina', inside);
      }
    }
    for (const side of [-1, 1]) {
      const inner = side * opening, outer = side * half;
      face(out, [front(outer, bottom), front(inner, bottom), front(inner, top), front(outer, top)], 'basalt', inside);
      const stile = [at(outer * .88, bottom + .10, .212), at(outer * .95, bottom + .10, .212),
        at(outer * .95, top - .12, .212), at(outer * .88, top - .12, .212)];
      face(out, stile, 'edgeStone', inside);
      face(out, [front(outer, bottom), front(outer, top), at(outer, top, -.32), at(outer, bottom, -.32)], 'blackIron', inside);
    }
    face(out, [front(-opening, bottom), front(opening, bottom), front(opening, bottom + .19), front(-opening, bottom + .19)], 'edgeStone', inside);
    face(out, [front(-half, top), front(half, top), at(half, top, -.32), at(-half, top, -.32)], 'bronze', inside);
    for (let i = -1; i <= 1; i++) {
      const u = opening * i * .43;
      face(out, [at(u - .035, bottom + .41, -.15), at(u + .035, bottom + .41, -.15),
        at(u + .035, shoulder + .33 - Math.abs(i) * .15, -.15), at(u - .035, shoulder + .33 - Math.abs(i) * .15, -.15)], 'patina', inside);
    }
  }
}
function cradle() {
  const out: ThroneFace[] = [];
  backboard(out);
  for (const side of [-1, 1]) {
    clevis(out, side);
    const footX = sealVolume.x + side * 4.71, footZ = sealVolume.z - 1.10;
    foundation(out, footX, footZ, -.68, -.44, .70, .91, 'basalt');
    foundation(out, footX, footZ, -.44, -.33, .72, .93, 'edgeStone');
    foundation(out, footX, footZ, -.33, -.08, .61, .82, 'basalt');
    foundation(out, footX, footZ, -.08, .03, .64, .84, 'bronze');
    for (let i = 0; i < sections.length - 1; i++) {
      const a = bevel.map(([w, d]) => ribPoint(side, i, w, d));
      const b = bevel.map(([w, d]) => ribPoint(side, i + 1, w, d));
      connect(out, a, b, ['blackIron', 'basalt', 'blackIron', 'bronze', 'bronze', i % 2 ? 'patina' : 'basalt', 'rubbedBronze', 'blackIron'], i === sections.length - 2);
      // Deeply inset panels leave an exposed raised spine running through the castings.
      const p = [ribPoint(side, i, -.63, 1.016), ribPoint(side, i, .64, 1.016),
        ribPoint(side, i + 1, .64, 1.016), ribPoint(side, i + 1, -.63, 1.016)];
      const inside = mean([...a, ...b]);
      const inset = [interpolate(p[0], p[3], .11), interpolate(p[1], p[2], .11), interpolate(p[1], p[2], .87), interpolate(p[0], p[3], .87)];
      face(out, inset, 'recess', inside);
      const spine = [ribPoint(side, i, .34, 1.03), ribPoint(side, i, .46, 1.03), ribPoint(side, i + 1, .46, 1.03), ribPoint(side, i + 1, .34, 1.03)];
      face(out, spine, 'bronze', inside);
      if (i === 4 || i === 6) {
        const at = ribPoint(side, i, -.10, 1.04);
        bearing(out, at[0], at[1], at[2], i === 4 ? .35 : .23);
      }
    }
  }
  return out;
}

function sector(out: ThroneFace[], start: number, end: number, inner: number, outer: number,
  base: number, top: number, front: ThroneFinish, cap: ThroneFinish) {
  const p = (r: number, a: number, y: number): PowerPoint => [r * Math.cos(a), y, r * Math.sin(a)];
  const spans = 4;
  for (let i = 0; i < spans; i++) {
    const a = start + (end - start) * i / spans, b = start + (end - start) * (i + 1) / spans;
    const lower = [p(inner, a, base), p(outer, a, base), p(outer, b, base), p(inner, b, base)];
    const upper = [p(inner, a, top), p(outer, a, top), p(outer, b, top), p(inner, b, top)];
    const inside = mean([...lower, ...upper]);
    face(out, [...upper], cap, inside); face(out, [...lower], 'blackIron', inside);
    face(out, [lower[1], lower[2], upper[2], upper[1]], front, inside);
    face(out, [lower[0], lower[3], upper[3], upper[0]], 'recess', inside);
    if (i === 0) face(out, [lower[0], lower[1], upper[1], upper[0]], 'rubbedBronze', inside);
    if (i === spans - 1) face(out, [lower[2], lower[3], upper[3], upper[2]], 'rubbedBronze', inside);
  }
}

function governor(count: number, inner: number, outer: number, height: number, front: ThroneFinish) {
  const out: ThroneFace[] = [];
  for (let i = 0; i < count; i++) {
    const start = tau * (i + .055) / count, end = tau * (i + .945) / count;
    sector(out, start, end, inner, outer, -height / 2, height / 2, front, 'bronze');
    sector(out, start + .042, end - .042, outer - .082, outer + .025, height * .12, height * .30, 'rubbedBronze', 'rubbedBronze');
  }
  return out;
}
function outlet() {
  const local: ThroneFace[] = [];
  for (let i = 0; i < 8; i++) {
    const a = tau * i / 8, b = tau * (i + 1) / 8;
    sector(local, a + .014, b - .014, .64, .98, .91, 1.14, 'bronze', 'basalt');
    sector(local, a + .143, b - .143, .67, .85, 1.14, 3.16, 'patina', 'blackIron');
    sector(local, a + .016, b - .016, .64, .98, 3.12, 3.28, 'bronze', 'basalt');
  }
  const place = ([x, y, z]: PowerPoint): PowerPoint => [pressAxis.x + x, pressAxis.y + y, pressAxis.z + z];
  return local.map(f => ({ ...f, points: f.points.map(place), center: place(f.center) }));
}
let castings: { pressureCheeks: ThroneFace[]; lowerGovernor: ThroneFace[]; upperGovernor: ThroneFace[] } | undefined;
export function pressureThroneGeometry() {
  return castings ??= {
    pressureCheeks: [...cradle(), ...outlet()],
    lowerGovernor: governor(6, .82, 1.54, .265, 'patina'),
    upperGovernor: governor(8, .72, 1.20, .22, 'blackIron'),
  };
}
export function governorPose(phase: number, load: number, upper: boolean) {
  return {
    angle: (upper ? -tau / 8 : tau / 6) * phase,
    elevation: pressAxis.y + (upper ? .46 + .16 * load : -.10 - .12 * load),
  };
}

// The rotor has inertia; the luminous current can reach the shaft before the bronze has changed speed.
export function createGovernorDrive() {
  let last = -Infinity, phase = .45, speed = 0, lift = 0;
  return (now: number, bus: number, reduced: boolean) => {
    const wantedSpeed = .035 + .34 * bus;
    const dt = (now - last) / 1000;
    last = now;
    if (reduced || dt < 0 || dt > 2) {
      phase = reduced ? .45 : ((now / 1000) * wantedSpeed) % 24;
      speed = wantedSpeed;
      lift = bus;
    } else if (dt > 0) {
      // Integrate the exponential spin-down exactly, including on a slow frame.
      const carried = Math.exp(-dt / 1.26);
      // Six- and eight-part crowns both regain their exact orientation after 24 segment pitches.
      phase = (phase + wantedSpeed * dt + (speed - wantedSpeed) * 1.26 * (1 - carried)) % 24;
      speed = wantedSpeed + (speed - wantedSpeed) * carried;
      lift += (bus - lift) * (1 - Math.exp(-dt / .32));
    }
    return { phase, lift };
  };
}
