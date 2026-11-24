import { outerWall, wallFacesCamera } from './palace-overlook';
import { processionalSign, stairFace } from './fortress-palace-sign';
import { behindTraveller } from './fortress-palace-camera';
import { collectorSpokes, highSluices, sluiceVeil, suspendedHeight } from './fortress-palace-monuments';
import { addRiserLayers } from './fortress-risers-2d';
import { createFrostCloud } from './fortress-frost-contact';
import {
  armillaryRotation,
  palaceArmillary,
  palaceConductors,
  palaceWorks,
  wheelAngle,
  worksPower,
} from './fortress-palace-current';
import type { FortressInteriorFrame } from './field-fortress-state';
import { mazeFieldMap, mazeFloors, palaceElevation, palaceBays, palacePiers, type MazeRoom } from './fortress-maze';
import { palaceArchitecture, palaceVault, type PalacePart, type Stone } from './fortress-palace-architecture';
import { palaceFloorRay, palaceLandmarkRay } from './fortress-palace-picking';
import { drawWetGround2D } from './fortress-wet-ground-2d';
import {
  addRasterActors,
  loop,
  noise,
  projection,
  tau,
  type Layer,
  type RasterPaint,
  type Projection,
  type Vertex,
} from './fortress-raster-space';

const frostClouds = new WeakMap<CanvasRenderingContext2D, ReturnType<typeof createFrostCloud>>();

export function pickFortressMaze2D(
  ctx: CanvasRenderingContext2D,
  frame: FortressInteriorFrame,
  px: number,
  py: number,
) {
  if (frame.room !== 'aqueduct' && frame.room !== 'catacomb') return;
  const cam = projection(ctx, frame),
    ground = cam.atHeight(px, py, 0);
  if (!cam.eye || !cam.clipDepth || !ground) return;
  const [x, y, z] = cam.eye,
    side = cam.clipDepth(ground.x, ground.y, 0) > 0 ? 1 : -1;
  const ray = { x: (ground.x - x) * side, y: -y * side, z: (ground.y - z) * side };
  const cutEntrance = behindTraveller(cam.eye, frame.x, frame.y, 24.5, 43.7);
  return palaceLandmarkRay(frame.room, { x, y, z }, ray, cutEntrance) ?? palaceFloorRay(frame.room, { x, y, z }, ray);
}

const warm: Record<Stone, [string, string, string]> = {
  body: ['#97a297', '#697b75', '#455f60'],
  trim: ['#c1bda5', '#958f77', '#667675'],
  bright: ['#d3cdb0', '#b5ab8d', '#808b7e'],
  dark: ['#647675', '#455a5c', '#304749'],
  bronze: ['#caa876', '#98815f', '#635f50'],
  iron: ['#718281', '#566766', '#3e5052'],
  jade: ['#b6e7cf', '#78afa3', '#428a84'],
  lamp: ['#ffe4a4', '#e0ae65', '#938461'],
  ice: ['#c2e4e8', '#86b8c7', '#5c8b9d'],
  royal: ['#69918b', '#49726e', '#335854'],
  basalt: ['#55666b', '#384e52', '#22383f'],
  gilt: ['#d5b97f', '#aa8751', '#6d604d'],
  copper: ['#be9d73', '#986e49', '#645340'],
};
const cold: typeof warm = {
  ...warm,
  basalt: ['#455666', '#2e3e51', '#202c3b'],
  body: ['#94a7b5', '#76899b', '#4f6478'],
  trim: ['#b3c2c8', '#889ca8', '#6e8193'],
  bright: ['#d3dcda', '#aab9bf', '#8395a0'],
  dark: ['#657887', '#445969', '#2e4355'],
  lamp: ['#d2f7fc', '#a4dbef', '#72a2b9'],
  bronze: ['#b4aa8f', '#878a83', '#69767c'],
};

function depthPalettes(colors: typeof warm, air: number[]) {
  return Array.from({ length: 12 }, (_, i) => {
    const amount = 0.035 + 0.61 * (i / 11) ** 1.65;
    return Object.fromEntries(
      Object.entries(colors).map(([stone, facets]) => [
        stone,
        facets.map((color) => {
          const rgb = Number.parseInt(color.slice(1), 16);
          const channels = [rgb >> 16, (rgb >> 8) & 255, rgb & 255];
          return 'rgb(' + channels.map((v, j) => Math.round(v * (1 - amount) + air[j] * amount)).join(' ') + ')';
        }),
      ]),
    ) as typeof warm;
  });
}
const warmDepth = depthPalettes(warm, [55, 72, 71]),
  coldDepth = depthPalettes(cold, [49, 62, 80]);

type StoneFace = { corners: Vertex[]; outward: Vertex; center: Vertex; shade: 0 | 1 | 2 };
const boxFaces = new WeakMap<PalacePart, StoneFace[]>();

function drawPart(v: PalacePart, p: RasterPaint, colors: typeof warm, eye?: readonly number[]) {
  const { face, stroke } = p,
    [top, light, shade] = colors[v.finish],
    c = Math.cos(v.yaw),
    s = Math.sin(v.yaw);
  const roll = Math.cos(v.roll),
    sinRoll = Math.sin(v.roll),
    pitch = Math.cos(v.pitch),
    sinPitch = Math.sin(v.pitch);
  const world = (x: number, z: number, y: number): Vertex => {
    const tx = x * roll - y * sinRoll,
      ty = x * sinRoll + y * roll,
      tz = ty * sinPitch + z * pitch;
    return [v.x + c * tx + s * tz, v.z - s * tx + c * tz, v.y + ty * pitch - z * sinPitch];
  };
  const disc = (r: number, y: number, count = 10): Vertex[] =>
    Array.from({ length: count }, (_, i) =>
      world(Math.cos((tau * i) / count) * v.w * r, Math.sin((tau * i) / count) * v.d * r, y),
    );
  if (v.form === 'box') {
    let facets = boxFaces.get(v);
    if (!facets) {
      const slab = (h: number) => [
        world(-v.w / 2, -v.d / 2, h),
        world(v.w / 2, -v.d / 2, h),
        world(v.w / 2, v.d / 2, h),
        world(-v.w / 2, v.d / 2, h),
      ];
      const bottom = slab(-v.h / 2),
        top = slab(v.h / 2);
      const facelets = [bottom, top, ...bottom.map((a, i) => [a, bottom[(i + 1) % 4], top[(i + 1) % 4], top[i]])];
      facets = facelets.map((corners) => {
        const center: Vertex = [0, 0, 0];
        for (const [x, z, h] of corners) {
          center[0] += x * 0.25;
          center[1] += z * 0.25;
          center[2] += h * 0.25;
        }
        const outward: Vertex = [center[0] - v.x, center[1] - v.z, center[2] - v.y];
        const length = Math.hypot(...outward) || 1;
        const light = (-outward[0] * 0.39 + outward[1] * 0.32 + outward[2] * 0.86) / length;
        return { corners, center, outward, shade: light > 0.59 ? 0 : light > -0.22 ? 1 : 2 };
      });
      boxFaces.set(v, facets);
    }
    for (const f of facets) {
      const [x, z, h] = f.center,
        [nx, nz, ny] = f.outward;
      if (eye && nx * (eye[0] - x) + nz * (eye[2] - z) + ny * (eye[1] - h) <= 0) continue;
      face(f.corners, colors[v.finish][f.shade]);
    }
    return;
  }
  if (v.form === 'arch') {
    for (let i = 0; i < 11; i++) {
      const a = ((i + 0.025) * Math.PI) / 11,
        b = ((i + 0.975) * Math.PI) / 11;
      const corner = (angle: number, r: number, d: number): Vertex =>
        world(Math.cos(angle) * v.w * r, d, Math.sin(angle) * v.h * (r === 1 ? 1 : i === 5 ? 1.41 : 1.26));
      const n = v.d * 0.5;
      face([corner(a, 1, -n), corner(b, 1, -n), corner(b, 1, n), corner(a, 1, n)], shade);
      face([corner(a, 1.24, -n), corner(b, 1.24, -n), corner(b, 1.24, n), corner(a, 1.24, n)], top);
      face([corner(a, 1, n), corner(b, 1, n), corner(b, 1.24, n), corner(a, 1.24, n)], i % 4 === 1 ? top : light);
    }
    return;
  }
  if (v.form === 'ring') {
    const arc = Array.from({ length: 28 }, (_, i) =>
      world(Math.cos((tau * i) / 28) * v.w, 0, Math.sin((tau * i) / 28) * v.h),
    );
    stroke([...arc, arc[0]], light, 0.105 * v.w);
    return;
  }
  if (v.form === 'orb' || v.form === 'spike') {
    const ring = disc(0.93, v.form === 'orb' ? 0 : v.h * 0.14, 7),
      apex = world(0, 0, v.h),
      bottom = world(0, 0, v.form === 'orb' ? -v.h : 0);
    for (let i = 0; i < 7; i++) {
      const j = (i + 1) % 7;
      face([ring[i], ring[j], bottom], shade);
      face([ring[i], ring[j], apex], i % 3 === 0 ? top : i % 3 === 1 ? light : shade);
    }
    return;
  }
  if (v.form === 'lid') {
    const bottom = [world(-v.w, -v.d, 0), world(v.w, -v.d, 0), world(v.w, v.d, 0), world(-v.w, v.d, 0)];
    const crown = [
      world(-0.67 * v.w, -0.62 * v.d, 0.63 * v.h),
      world(0.67 * v.w, -0.62 * v.d, 0.63 * v.h),
      world(0.67 * v.w, 0.62 * v.d, 0.63 * v.h),
      world(-0.67 * v.w, 0.62 * v.d, 0.63 * v.h),
    ];
    for (let i = 0; i < 4; i++)
      face([bottom[i], bottom[(i + 1) % 4], crown[(i + 1) % 4], crown[i]], i % 2 ? shade : light);
    face(crown, top);
    return;
  }
  const shaft = v.form === 'shaft',
    cap = v.form === 'capital';
  const foot = shaft || cap ? 0 : -v.h / 2;
  const rows = shaft
    ? [
        [0, 1],
        [0.08, 0.91],
        [0.9, 0.72],
        [1, 0.79],
      ]
    : cap
      ? [
          [0, 0.63],
          [0.27, 0.7],
          [0.8, 0.97],
          [1, 1],
        ]
      : [
          [0, 1],
          [1, 1],
        ];
  let previous = disc(rows[0][1], foot);
  for (const [y, r] of rows.slice(1)) {
    const next = disc(r, foot + y * v.h);
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 10;
      face([previous[i], previous[j], next[j], next[i]], i < 2 ? shade : i === 4 ? top : light);
    }
    previous = next;
  }
  face(previous, top);
  if (shaft)
    for (const n of [1, 2, 3, 4]) {
      const angle = (n * Math.PI) / 5;
      stroke(
        [
          world(0.89 * v.w * Math.cos(angle), 0.89 * v.d * Math.sin(angle), v.h * 0.1),
          world(0.73 * v.w * Math.cos(angle), 0.73 * v.d * Math.sin(angle), v.h * 0.87),
        ],
        shade,
        0.026,
      );
    }
}

export function drawFortressMaze2D(frame: FortressInteriorFrame, room: MazeRoom, cam: Projection, p: RasterPaint) {
  const { ctx, point, top, face, stroke } = p,
    { width, height } = ctx.canvas;
  const icy = room === 'catacomb',
    colors = icy ? cold : warm,
    haze = icy ? coldDepth : warmDepth,
    map = mazeFieldMap(room),
    plan = mazeFloors[room];
  const t = frame.reduced ? 0 : frame.now / 1000,
    level = icy ? -1.12 : -1.02;
  const ambient = ctx.createLinearGradient(0, 0, 0, height);
  ambient.addColorStop(0, icy ? '#253b50' : '#344b48');
  ambient.addColorStop(1, icy ? '#142b3c' : '#193841');
  ctx.fillStyle = ambient;
  ctx.fillRect(0, 0, width, height);
  top(1, 1, 47, 47, level, icy ? '#55748b' : '#3e6970');
  const visible = (x: number, z: number, r = 1, h = 0) => {
    const at = point(x, z, h),
      pad = cam.scale * r * 1.65;
    return at.x >= -pad && at.x <= width + pad && at.y >= -pad && at.y <= height + pad;
  };
  for (const panel of palaceVault(room)) {
    if (frame.palaceView || panel.z > frame.y - 0.1 || !visible(panel.x, panel.z, 3.7, 8.3)) continue;
    const [a, b, c] = panel.vertices.slice(0, 3).map((v) => point(...v));
    if ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) < 0) continue;
    const f = Math.round(panel.shade * (icy ? 78 : 84));
    face(panel.vertices, icy ? `rgb(${f - 10} ${f + 7} ${f + 17})` : `rgb(${f} ${f + 5} ${f - 2})`);
  }
  for (let i = 0; i < 980; i++) {
    const x = 3 + 43 * noise(i + 53),
      z = 3 + 43 * noise(i * 7 + 911);
    if (map.walkable[Math.floor(z)]?.[Math.floor(x)] || !visible(x, z, 0.8)) continue;
    const dx = 0.31 + 0.27 * noise(i + 271),
      phase = icy ? 0 : 0.11 * Math.sin(t * 0.91 + i * 2.13);
    stroke(
      [
        [x - dx, z, level + 0.017],
        [x + 0.04, z + phase, level + 0.019],
        [x + dx, z + 0.024, level + 0.017],
      ],
      i % 3 ? (icy ? '#91b0bf67' : '#b4d2bb5c') : icy ? '#294e6b' : '#31616c',
      0.025,
    );
  }
  for (const bay of palaceArchitecture(room))
    if (bay.parts.some((v) => v.form === 'shaft') && visible(bay.x, bay.z, 4, 0)) {
      const foot = point(bay.x, bay.z, level),
        toe = point(bay.x, bay.z, level - 3.5);
      const g = ctx.createLinearGradient(foot.x, foot.y, toe.x, toe.y);
      g.addColorStop(0, icy ? '#41566c7e' : '#2b474e93');
      g.addColorStop(1, '#2f525500');
      face(
        [
          [bay.x - 0.57, bay.z, level],
          [bay.x + 0.57, bay.z, level],
          [bay.x + 0.44, bay.z, level - 3.5],
          [bay.x - 0.44, bay.z, level - 3.5],
        ],
        g,
      );
    }
  const floorColors = icy ? ['#8c9eaa', '#91a5ae', '#8499a5', '#a1b0b4'] : ['#a7a894', '#aab09b', '#a5a18e', '#bbb7a0'];
  for (let z = 3; z < 46; z++)
    for (let x = 3; x < 46; x++) {
      if (!map.walkable[z][x] || !visible(x + 0.5, z + 0.5, 1.35, palaceElevation(room, x, z))) continue;
      const bridge = plan.tiles[z][x] === 'bridge';
      for (let k = 0; k < 2; k++) {
        const zz = z + k * 0.5,
          h = palaceElevation(room, x + 0.5, zz + 0.25),
          end = zz + 0.5;
        if (!map.walkable[z + 1]?.[x] || palaceElevation(room, x, zz + 0.78) < h)
          face(
            [
              [x, end, bridge ? -0.32 : level],
              [x + 1, end, bridge ? -0.32 : level],
              [x + 1, end, h],
              [x, end, h],
            ],
            colors.body[2],
          );
        if (!map.walkable[z]?.[x - 1])
          face(
            [
              [x, zz, level],
              [x, end, level],
              [x, end, h],
              [x, zz, h],
            ],
            colors.dark[1],
          );
        if (!map.walkable[z]?.[x + 1])
          face(
            [
              [x + 1, zz, level],
              [x + 1, end, level],
              [x + 1, end, h],
              [x + 1, zz, h],
            ],
            colors.dark[1],
          );
        top(x, zz, 1.006, 0.505, h - 0.011, colors.body[2]);
        top(
          x + 0.014,
          zz + 0.015,
          0.973,
          0.468,
          h,
          plan.tiles[z][x] === 'ice' ? '#9bc2cd' : floorColors[(x * 5 + z * 3 + k) % 4],
        );
        if (x === 22 || x === 26 || x === 8 || x === 40)
          top(x + 0.481, zz + 0.012, 0.045, 0.48, h + 0.006, colors.bronze[0]);
        if ((z === 12 || z === 13 || z === 38 || z === 40) && x >= 22 && x <= 26)
          top(x + 0.04, end - 0.062, 0.92, 0.035, h + 0.01, colors.bright[0]);
      }
    }
  for (const xi of palacePiers)
    for (const zi of palaceBays) {
      const x = xi + 0.5,
        z = zi + 0.5;
      if (!visible(x, z, 2.3)) continue;
      const h = palaceElevation(room, x, z) + 0.014;
      p.groundGlow(x + 0.49, z - 0.34, 2.39, 1.1, icy ? 'rgba(19,34,56,.38)' : 'rgba(29,39,35,.41)', h);
      p.groundGlow(x + 0.08, z, 1.06, 0.71, 'rgba(24,31,36,.36)', h + 0.001);
    }
  const bus = frame.power?.bus ?? 0.78,
    phase = frame.power?.phase ?? 0.45;
  for (const line of palaceConductors(room)) {
    const vertices: Vertex[] = line.map((n) => [n.x, n.z, n.h]);
    stroke(vertices, colors.bronze[1], 0.15);
    stroke(vertices, icy ? '#5898a3' : '#527e73', 0.086);
    for (let i = 1; i < line.length; i++) {
      const n = line[i],
        beat = Math.max(0, Math.cos(n.run * 0.79 - t * 1.28 - phase * 2.3)) ** 10;
      if (beat > 0.2 && visible(n.x, n.z, 0.6, n.h))
        stroke(
          [vertices[i - 1], vertices[i]],
          'rgba(157,230,209,' + beat * bus * (frame.shortcutOpen ? 0.85 : 0.6) + ')',
          0.071,
        );
    }
  }
  if (!icy) drawWetGround2D(frame, p);
  const layers: Layer[] = [];
  addRiserLayers(layers, frame, room, cam, p);
  for (const g of palaceArchitecture(room)) {
    if (wallFacesCamera(outerWall(g.x,g.z),frame.palaceView)) continue;
    if (
      (g.overhead && cam.eye && behindTraveller(cam.eye, frame.x, frame.y, g.x, g.z)) ||
      !visible(g.x, g.z, g.radius + g.high, 0.3 * g.high)
    )
      continue;
    const air = haze[Math.min(11, Math.floor(Math.hypot(g.x - frame.x, g.z - frame.y) / 4.25))];
    layers.push({
      z: cam.depth(g.x, g.z),
      draw() {
        for (const v of g.parts) drawPart(v, p, air, cam.eye);
      },
    });
  }
  for (const down of [false, true]) {
    const board = processionalSign(room, down);
    if (
      !visible(board.x, board.z, 1, board.y) ||
      (!down && cam.eye && behindTraveller(cam.eye, frame.x, frame.y, board.x, board.z))
    )
      continue;
    layers.push({
      z: cam.depth(board.x, board.z + 0.04),
      draw() {
        const x = board.x - board.w / 2,
          y = board.y + board.h / 2,
          z = board.z + 0.026;
        const a = point(x, z, y),
          b = point(x + board.w, z, y),
          c = point(x, z, y - board.h);
        if (cam.clipDepth && cam.clipDepth(x, z, y) < 0.25) return;
        const img = stairFace(board.text, down);
        ctx.save();
        ctx.transform(
          (b.x - a.x) / img.width,
          (b.y - a.y) / img.width,
          (c.x - a.x) / img.height,
          (c.y - a.y) / img.height,
          a.x,
          a.y,
        );
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      },
    });
  }
  if (!icy) {
    for (const gate of highSluices)
      layers.push({
        z: cam.depth(gate, 3.77),
        draw() {
          const pointAt = (u: number, v: number): Vertex => {
            const [x, y, z] = sluiceVeil(gate, u, v);
            return [x, z, y];
          };
          const left = Array.from({ length: 17 }, (_, i) => pointAt(-1, i / 16)),
            right = Array.from({ length: 17 }, (_, i) => pointAt(1, 1 - i / 16));
          face([...left, ...right], '#a2d1c3cb');
          for (let i = 0; i < 3; i++) {
            const age = (t * 0.7 + i / 3) % 1,
              ring = loop(gate, 3.78, 0.42 + age * 1.12, 0.16 + age * 0.57, level + 0.012 + i * 0.002, 22);
            stroke([...ring, ring[0]], 'rgba(201,225,207,' + 0.63 * (1 - age) + ')', 0.055);
          }
          for (let i = 0; i < 12; i++) {
            const a = (t * 0.43 + i * 0.279) % 1,
              u = -0.93 + 0.165 * i;
            stroke(
              [pointAt(u, a), pointAt(u, Math.min(1, a + 0.08 + (i % 3) * 0.045))],
              i % 3 ? '#e6f2d9cc' : '#6caaa5c4',
              0.045,
            );
          }
        },
      });
    layers.push({
      z: cam.depth(24.5, -1.51),
      draw() {
        for (const spoke of collectorSpokes) {
          const a = spoke + t * 0.055;
          stroke(
            [
              [24.5 - Math.sin(a) * 0.63, -1.68, 13.3 + Math.cos(a) * 0.63],
              [24.5 - Math.sin(a) * 2.7, -1.68, 13.3 + Math.cos(a) * 2.7],
            ],
            colors.gilt[0],
            0.18,
          );
        }
      },
    });
  }
  if (icy && visible(24.5, 24.5, 5.1, suspendedHeight))
    layers.push({
      z: cam.depth(24.5, 24.5) + 0.02,
      draw() {
        palaceArmillary.forEach((ring, i) => {
          const [pitch, yaw, roll] = armillaryRotation(frame, i, t);
          drawPart({ ...ring, pitch, yaw, roll }, p, colors, cam.eye);
        });
      },
    });
  if (!icy)
    for (const [i, [x, z]] of palaceWorks.entries()) {
      if (!visible(x, z, 3.8, 1.6)) continue;
      const angle = wheelAngle(frame, i, t);
      layers.push({
        z: cam.depth(x, z + 0.82),
        draw() {
          const wheel = (a: number, r: number, axial: number): Vertex => [
            x + Math.cos(a) * r,
            z + 0.8 + axial,
            1.68 + Math.sin(a) * r,
          ];
          for (const axial of [-0.115, 0.115]) {
            const metal = Array.from({ length: 29 }, (_, j) => wheel((j * tau) / 28, 0.83, axial));
            stroke(metal, axial < 0 ? colors.bronze[2] : colors.bronze[0], 0.093);
          }
          for (let j = 0; j < 8; j++) {
            const a = (j * Math.PI) / 4 + angle;
            stroke([wheel(a, 0, 0.08), wheel(a, 0.79, 0.08)], colors.bronze[1], 0.059);
            face(
              [
                wheel(a - 0.16, 0.62, -0.15),
                wheel(a + 0.16, 0.72, -0.15),
                wheel(a + 0.16, 0.72, 0.15),
                wheel(a - 0.16, 0.62, 0.15),
              ],
              colors.jade[1],
            );
          }
          const at = (u: number, side: number): Vertex => [
            x + side * 0.21 * (0.19 + 0.81 * Math.sqrt(worksPower(frame, i, 0.657 * u ** 0.85))) * (1 + 0.3 * u),
            z + 1.06 + 0.91 * Math.sin(u * 1.24),
            1.1 - 2.12 * u ** 1.7,
          ];
          const l = Array.from({ length: 10 }, (_, n) => at(n / 9, -1)),
            r = Array.from({ length: 10 }, (_, n) => at(1 - n / 9, 1));
          face([...l, ...r], '#a3d7ccba');
          for (let j = 0; j < 4; j++) {
            const age = (t * 0.72 + 0.21 * j) % 1;
            stroke([at(age, -0.75 + 0.48 * j), at(Math.min(1, age + 0.17), -0.75 + 0.48 * j)], '#e2f5dec2', 0.029);
          }
        },
      });
    }
  if (visible(24.5, 2.95, 3.5, 8.6))
    layers.push({
      z: cam.depth(24.5, 2.96) + 0.03,
      draw() {
        const tilt = (icy ? -1 : 1) * (0.12 + bus * 0.61 + phase * 0.07);
        for (const [a, long] of [
          [0.27, 1.88],
          [-0.81, 1.14],
        ])
          stroke(
            [
              [24.5, 3.13, 8.58],
              [24.5 - Math.sin(tilt + a) * long, 3.13, 8.58 + Math.cos(tilt + a) * long],
            ],
            colors.bronze[0],
            0.093,
          );
      },
    });
  const x = plan.instrument.x + 0.5,
    z = plan.instrument.y + 0.5;
  layers.push({
    z: cam.depth(x, z) + 0.51,
    draw() {
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 4 + (frame.shortcutOpen ? 0.87 : 0);
        stroke(
          [
            [x + Math.cos(a) * 0.37, z + 0.08, 1.22 + Math.sin(a) * 0.37],
            [x - Math.cos(a) * 0.37, z + 0.08, 1.22 - Math.sin(a) * 0.37],
          ],
          colors.bronze[0],
          0.047,
        );
      }
    },
  });
  if (icy) {
    let cloud = frostClouds.get(ctx);
    if (!cloud) {
      cloud = createFrostCloud();
      frostClouds.set(ctx, cloud);
    }
    cloud.advance(frame);
    for (const chip of cloud.particles) {
      const t = frame.now * 0.001 - chip.at,
        fade = Math.max(0, 1 - t / (chip.mist ? 0.68 : 0.34));
      const x = chip.x + chip.vx * t,
        z = chip.z + chip.vz * t,
        h = chip.y + chip.vy * t + (chip.mist ? 0.09 : -2.35) * t * t;
      layers.push({
        z: cam.depth(x, z) + 0.015,
        draw() {
          const pixel = point(x, z, Math.max(0.028, h)),
            r = Math.max(0.75, cam.scale * (chip.mist ? 0.11 + 0.2 * t : 0.032));
          if (chip.mist) {
            const g = ctx.createRadialGradient(pixel.x, pixel.y, 0, pixel.x, pixel.y, r);
            g.addColorStop(0, `rgba(165,210,225,${fade * 0.27})`);
            g.addColorStop(1, 'rgba(165,210,225,0)');
            ctx.fillStyle = g;
            ctx.fillRect(pixel.x - r, pixel.y - r, 2 * r, 2 * r);
          } else {
            ctx.fillStyle = `rgba(205,241,247,${fade * 0.8})`;
            ctx.beginPath();
            ctx.moveTo(pixel.x - r, pixel.y);
            ctx.lineTo(pixel.x, pixel.y - r * 0.7);
            ctx.lineTo(pixel.x + r, pixel.y);
            ctx.lineTo(pixel.x, pixel.y + r * 0.7);
            ctx.fill();
          }
        },
      });
    }
  }
  addRasterActors(layers, frame, cam, ctx, true, (x, z) => palaceElevation(room, x, z));
  layers.sort((a, b) => a.z - b.z).forEach((l) => l.draw());
}
