import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DynamicDrawUsage,
  FogExp2,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  Scene,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
  type Material,
  type Raycaster,
  type Texture,
} from 'three';
import { createFrostFootfalls } from './fortress-maze-frost';
import { createPontoonMotion } from './fortress-pontoons';
import { carvedDrum } from './fortress-tide-dial';
import { buildFortressWater } from './fortress-water';
import type { FortressInteriorFrame } from './field-fortress-state';
import { catacombLift, mazeFloors, type MazePoint, type MazeRoom } from './fortress-maze';

import {
  archStone,
  createMazeMaterials,
  crystalShape,
  funeraryLid,
  noise,
  stairSign,
  tau,
} from './fortress-maze-materials';
import { channelSurface, cisternMirror, outfalls, type Outfall } from './fortress-maze-water';

type Triple = [number, number, number];
export function buildMazeRoom3D(room: MazeRoom, glow: Texture) {
  const plan = mazeFloors[room],
    frost = room === 'catacomb';
  const scene = new Scene(),
    atmosphere = frost ? 0x182b3b : 0x203631;
  scene.background = new Color(atmosphere);
  scene.fog = new FogExp2(atmosphere, frost ? 0.04 : 0.038);
  const palette = createMazeMaterials(frost);
  const { ground, face, chalk, dark, brass, iron, wallCap, wet, wood, jade, ice, gem, glowGlass, amberGlass, mats } =
    palette;
  const blocks = new BoxGeometry(),
    round = new CylinderGeometry(1, 1, 1, 12),
    oct = new CylinderGeometry(1, 0.91, 1, 8);
  const ring = new TorusGeometry(1, 0.092, 6, 24),
    curve = archStone(),
    icicle = crystalShape(),
    lid = funeraryLid();
  const screen = new PlaneGeometry(1, 1);
  const lateralDrum = new CylinderGeometry(1, 1, 1, 12).rotateZ(Math.PI / 2);
  const axialDrum = new CylinderGeometry(1, 1, 1, 12).rotateX(Math.PI / 2);
  const flute = carvedDrum(
    [
      [0, 1],
      [0.045, 1],
      [0.14, 0.88],
      [0.76, 0.79],
      [0.94, 0.75],
      [1, 0.79],
    ],
    10,
    0.085,
  );
  const capital = carvedDrum(
    [
      [0, 0.61],
      [0.19, 0.71],
      [0.37, 0.66],
      [0.84, 0.98],
      [1, 1.01],
    ],
    9,
    0.106,
  );
  const geometries = [flute, capital, lid, blocks, round, oct, ring, curve, icicle, screen, lateralDrum, axialDrum];
  const pontoons = createPontoonMotion(room);
  let activeBridge: { x: number; z: number } | undefined;
  type Stamp = { pose: Matrix4; brightness: number; bridge?: { x: number; z: number } };
  const bridgeParts: { instance: InstancedMesh; index: number; rest: Matrix4; x: number; z: number }[] = [];
  const bridgeBatches = new Set<InstancedMesh>();
  const batches = new Map<BufferGeometry, Map<Material, Stamp[]>>();
  const placer = new Object3D(),
    color = new Color();
  function place(g: BufferGeometry, m: Material, p: Triple, s: Triple, r: Triple = [0, 0, 0], brightness = 1) {
    placer.position.set(...p);
    placer.scale.set(...s);
    placer.rotation.set(...r);
    placer.updateMatrix();
    let group = batches.get(g);
    if (!group) {
      group = new Map();
      batches.set(g, group);
    }
    let set = group.get(m);
    if (!set) {
      set = [];
      group.set(m, set);
    }
    set.push({ pose: placer.matrix.clone(), brightness, bridge: activeBridge });
  }
  const box = (m: Material, x: number, y: number, z: number, w: number, h: number, d: number, shade = 1) =>
    place(blocks, m, [x, y, z], [w, h, d], [0, 0, 0], shade);
  const touchTargets: Mesh[] = [];
  const destinations = new Map<Mesh, MazePoint>();
  function touchTarget(point: MazePoint, shape: BufferGeometry, position: Triple, size: Triple) {
    const target = new Mesh(shape, iron);
    target.position.set(...position);
    target.scale.set(...size);
    target.updateMatrixWorld();
    touchTargets.push(target);
    destinations.set(target, { x: point.x + 0.5, y: point.y + 0.5 });
  }
  const lamps: Triple[] = [];
  function lamp(x: number, y: number, z: number, scale = 0.75) {
    place(oct, iron, [x, y + 0.12 * scale, z], [0.19 * scale, 0.24 * scale, 0.19 * scale]);
    place(round, brass, [x, y + 0.35 * scale, z], [0.061 * scale, 0.44 * scale, 0.061 * scale]);
    place(oct, brass, [x, y + 0.56 * scale, z], [0.15 * scale, 0.1 * scale, 0.15 * scale]);
    place(oct, glowGlass, [x, y + 0.69 * scale, z], [0.1 * scale, 0.22 * scale, 0.1 * scale]);
    place(oct, iron, [x, y + 0.83 * scale, z], [0.16 * scale, 0.055 * scale, 0.16 * scale]);
    lamps.push([x, y + 0.7 * scale, z]);
  }
  const walk = (x: number, y: number) => {
    const tile = plan.tiles[y]?.[x];
    return tile !== undefined && tile !== 'wall' && tile !== 'channel';
  };
  const stoneFloor = (x: number, y: number) => {
    const tile = plan.tiles[y]?.[x];
    return walk(x, y) && tile !== 'bridge' && tile !== 'gate';
  };
  const channel = channelSurface(room);
  scene.add(channel);
  let tick = 0;
  const mirror = frost ? undefined : cisternMirror(channel, () => tick);
  if (mirror) scene.add(mirror);
  const pools = frost
    ? undefined
    : buildFortressWater(room, [
        { x: 4.78, z: 18.54, w: 0.51, d: 0.34, angle: -0.25 },
        { x: 3.56, z: 15.48, w: 0.44, d: 0.26, angle: 0.31 },
        { x: 6.79, z: 8.48, w: 0.57, d: 0.25, angle: 0.12 },
        { x: 11.53, z: 9.61, w: 0.44, d: 0.31, angle: -0.42 },
        { x: 15.48, z: 7.43, w: 0.51, d: 0.33, angle: 0.17 },
        { x: 18.64, z: 5.22, w: 0.43, d: 0.31, angle: -0.3 },
      ]);
  if (pools) scene.add(pools.group);
  const frostSteps = frost ? createFrostFootfalls() : undefined;
  if (frostSteps) scene.add(frostSteps.mesh);
  for (let y = 0; y < plan.height; y++)
    for (let x = 0; x < plan.width; x++) {
      const tile = plan.tiles[y][x],
        key = x + 31 * y,
        cx = x + 0.5,
        cz = y + 0.5;
      const tint = 0.87 + 0.13 * noise(key);
      if (tile === 'wall') {
        const near = walk(x - 1, y) || walk(x + 1, y) || walk(x, y - 1) || walk(x, y + 1);
        const boundary = x < 2 || y < 2 || x > plan.width - 3 || y > plan.height - 3;
        const height = boundary ? 0.32 : near ? 0.64 : 0.81;
        const variation = height + noise(key) * 0.07;
        box(dark, cx, -0.54 + variation * 0.5, cz, 0.993, variation + 1.1, 0.993, tint);
        box(wallCap, cx, variation - 0.004, cz, 0.994, 0.18, 0.994, tint);
        if (near && !boundary) {
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            if (!walk(x + dx, y + dy)) continue;
            box(
              face,
              cx + 0.456 * dx,
              variation + 0.063,
              cz + 0.456 * dy,
              dx ? 0.083 : 0.97,
              0.07,
              dy ? 0.083 : 0.97,
              tint,
            );
          }
        }
        if (!near && !boundary && key % 7 === 0) {
          box(wallCap, cx, variation + 0.15, cz, 0.88, 0.25, 0.88, tint);
          if (frost && key % 3 === 0)
            place(icicle, gem, [cx, variation + 0.29, cz], [0.22, 0.45, 0.22], [0.15, key, 0.12]);
        }
        continue;
      }
      if (tile === 'channel') {
        if (frost && key % 8 === 0) {
          const size = 0.2 + noise(key) * 0.19;
          place(oct, ice, [cx, -1.05 + noise(key * 3) * 0.04, cz], [size, 0.14, size * 1.15], [0, key * 0.71, 0], 0.83);
        }
        continue;
      }
      if (tile === 'gate' || (x === plan.up.x && y === plan.up.y) || (x === plan.down.x && y === plan.down.y)) continue;
      if (tile === 'bridge') {
        activeBridge = { x: cx, z: cz };
        const alongX = walk(x - 1, y) && walk(x + 1, y);
        const yaw = alongX ? 0 : Math.PI / 2;
        for (let slat = 0; slat < 6; slat++) {
          const off = (slat - 2.5) / 6;
          place(
            blocks,
            wood,
            [cx + Math.cos(yaw) * off, -0.033, cz + Math.sin(yaw) * off],
            [0.149, 0.067, 0.89],
            [0, -yaw, 0],
            tint * (0.86 + 0.14 * noise(key + slat)),
          );
        }
        for (const side of [-1, 1]) {
          place(
            round,
            dark,
            [cx - Math.sin(yaw) * side * 0.34, -0.18, cz + Math.cos(yaw) * side * 0.34],
            [0.14, 0.98, 0.14],
            alongX ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0],
          );
          place(
            blocks,
            iron,
            [cx - Math.sin(yaw) * side * 0.4, 0.014, cz + Math.cos(yaw) * side * 0.4],
            [0.94, 0.026, 0.032],
            [0, -yaw, 0],
          );
        }
        activeBridge = undefined;
        continue;
      }
      box(face, cx, frost ? -0.57 : -0.34, cz, 0.998, frost ? 1.06 : 0.6, 0.998, tint);
      box(tile === 'ice' ? ice : ground, cx, -0.055, cz, 0.99, 0.11, 0.99, tint);
      if (tile === 'grate') {
        box(iron, cx, 0.003, cz, 0.84, 0.026, 0.84);
        for (let k = 0; k < 7; k++) box(brass, cx - 0.35 + k * 0.117, 0.029, cz, 0.035, 0.035, 0.76, 0.76);
      }
      // Raised pale banks trace real drop-offs. Their breaks coincide with the pontoon crossings.
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const neighbor = plan.tiles[y + dy]?.[x + dx];
        if (neighbor !== 'channel') continue;
        box(chalk, cx + dx * 0.46, -0.005, cz + dy * 0.46, dx ? 0.095 : 0.99, 0.092, dy ? 0.095 : 0.99, tint);
        if (!frost && key % 13 === 0) lamp(cx + dx * 0.4, 0.04, cz + dy * 0.4, 0.5);
      }
      if (tile === 'ice') {
        for (let k = 0; k < 4; k++) {
          const angle = noise(key + k) * 0.9 - 0.45;
          place(
            blocks,
            chalk,
            [cx - 0.29 + k * 0.17, 0.005, cz - 0.08 + 0.16 * Math.sin(k + key)],
            [0.23, 0.009, 0.013],
            [0, angle, 0],
            0.9,
          );
        }
      }
    }
  // The north and side walls retain their full vaults. The camera-facing wall is cut just above the foundation.
  function gallery(cx: number, cz: number, yaw: number, bay: number, low: boolean) {
    const sin = Math.sin(yaw),
      cos = Math.cos(yaw);
    const part = (
      g: BufferGeometry,
      m: Material,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      shade = 1,
    ) => place(g, m, [cx + x * cos + z * sin, y, cz - x * sin + z * cos], [w, h, d], [0, yaw, 0], shade);
    const cube = (m: Material, x: number, y: number, z: number, w: number, h: number, d: number, shade = 1) =>
      part(blocks, m, x, y, z, w, h, d, shade);
    const lit = bay % 3 === 1;
    cube(wet, 0, -0.18, -0.25, 3.05, 1.45, 1.02);
    cube(face, 0, 0.42, -0.04, 3.02, 0.16, 0.93, 0.94);
    if (low) {
      cube(wallCap, 0, 0.56, -0.1, 2.98, 0.17, 0.82);
      cube(wet, 1.5, 0.08, -0.03, 0.66, 1.17, 1.38);
      cube(face, 1.5, 0.66, -0.02, 0.66, 0.14, 1.36);
      if (frost) cube(ice, 1.49, 0.747, 0.33, 0.53, 0.037, 0.25, 0.74);
      return;
    }
    cube(wet, 0, 1.67, -0.55, 3.04, 3.45, 0.42, 0.76);
    cube(dark, 0, 0.42, 0.29, 2.41, 0.21, 0.65);
    cube(face, 0, 0.545, 0.34, 2.26, 0.068, 0.54);
    const spring = frost ? 1.84 : 1.64;
    if (frost) {
      cube(iron, 0, 1.02, -0.18, 1.48, 0.94, 0.13, 0.65);
      cube(chalk, 0, 1.535, -0.12, 1.65, 0.12, 0.23);
      cube(face, 0, 0.66, -0.03, 1.73, 0.17, 0.4);
      part(oct, wallCap, 0, 1.22, 0.056, 0.45, 0.26, 0.22);
      if (bay % 2 === 0) {
        part(ring, brass, 0, 1.25, 0.218, 0.23, 0.23, 0.19);
        cube(jade, 0, 1.23, 0.219, 0.044, 0.27, 0.027);
      } else {
        for (const dx of [-0.4, -0.19, 0.19, 0.4]) cube(chalk, dx, 1.05, -0.07, 0.046, 0.46, 0.035, 0.81);
      }
    } else {
      for (const dx of [-0.76, -0.57, -0.38, -0.19, 0, 0.19, 0.38, 0.57, 0.76])
        cube(iron, dx, 1.13, -0.09, 0.048, 1.19, 0.062, 0.83);
      cube(brass, 0, 1.28, -0.075, 1.65, 0.075, 0.082, 0.77);
      part(lateralDrum, iron, 0, 0.92, 0.16, 2.36, 0.14, 0.14);
      for (const dx of [-0.91, 0.51]) part(lateralDrum, brass, dx, 0.92, 0.16, 0.104, 0.173, 0.173);
      if (lit) {
        part(axialDrum, iron, 0.62, 1.57, 0.06, 0.27, 0.27, 0.53);
        part(ring, brass, 0.62, 1.57, 0.33, 0.27, 0.27, 0.36);
        for (let n = -1; n <= 1; n++) cube(iron, 0.62 + n * 0.1, 1.57, 0.33, 0.036, 0.41, 0.04);
      }
    }
    // Continuous vault courses and stepped piers tie adjoining bays into one structure.
    part(curve, face, 0, spring, -0.015, 1.13, 0.79, 0.45);
    part(curve, chalk, 0, spring, 0.204, 1.075, 0.77, 0.15, 0.84);
    cube(dark, 1.5, 1.46, -0.04, 0.76, 3.0, 0.88);
    cube(face, 1.5, 0.57, 0.13, 0.82, 0.19, 1.12);
    part(flute, chalk, 1.5, 0.64, 0.34, 0.3, 1.32, 0.25, 0.91);
    part(capital, chalk, 1.5, spring + 0.11, 0.34, 0.355, 0.24, 0.29, 0.86);
    cube(face, 1.5, spring + 0.36, 0.14, 0.76, 0.23, 1.03);
    cube(chalk, 1.5, spring + 0.53, 0.13, 0.88, 0.11, 1.15, 0.88);
    cube(face, 0, 2.93, -0.16, 3.03, 0.3, 0.74);
    cube(wallCap, 0, 3.1, -0.17, 3.08, 0.16, 0.89);
    if (lit) {
      const x = cx + 0.53 * sin + 1.5 * cos,
        z = cz + 0.53 * cos - 1.5 * sin;
      lamp(x, 1.34, z, 0.78);
    }
  }
  for (let k = 0; k < 7; k++) {
    const bay = 2.5 + 3 * k;
    gallery(bay, 1.26, 0, k, false);
    gallery(1.23, bay, Math.PI / 2, k + 2, false);
    gallery(21.77, bay, -Math.PI / 2, k + 1, false);
    gallery(bay, 21.77, Math.PI, k, true);
  }
  const pierSites = frost
    ? [
        [7.83, 5.79, 1.41],
        [14.78, 10.7, 1.91],
        [16.52, 13.6, 1.54],
        [11.55, 16.4, 0.77],
      ]
    : [
        [9.35, 6.74, 1.46],
        [9.42, 19.22, 1.7],
        [19.8, 16.97, 2.18],
        [15.42, 5.35, 1.52],
      ];
  for (const [x, z, h] of pierSites) {
    const base = plan.tiles[Math.floor(z)][Math.floor(x)] === 'wall' ? 0.77 : -0.49;
    if (frost && base < 0) box(wet, x, -0.83, z, 0.62, 0.68, 0.62);
    box(wet, x, base + 0.08, z, 0.67, 0.32, 0.67);
    place(oct, chalk, [x, base + 0.27, z], [0.36, 0.14, 0.36], [0, 0.39, 0], 0.92);
    place(flute, face, [x, base + 0.32, z], [0.27, h, 0.27]);
    place(capital, chalk, [x, base + 0.26 + h, z], [0.33, 0.25, 0.33]);
    box(wallCap, x, base + 0.57 + h, z, 0.71, 0.13, 0.71);
    if (frost) place(icicle, gem, [x + 0.16, base + 0.59 + h, z + 0.13], [0.12, 0.29, 0.11], [0.21, x, -0.18]);
  }
  const apron = new Mesh(new PlaneGeometry(72, 72), wet);
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(11.5, -1.28, 11.5);
  apron.receiveShadow = true;
  const apronUV = apron.geometry.attributes.uv;
  for (let i = 0; i < apronUV.count; i++) apronUV.setXY(i, apronUV.getX(i) * 36, apronUV.getY(i) * 36);
  scene.add(apron);
  const moving: Group[] = [];
  function mesh(parent: Group, g: BufferGeometry, m: Material, p: Triple, s: Triple, r: Triple = [0, 0, 0]) {
    const item = new Mesh(g, m);
    item.position.set(...p);
    item.scale.set(...s);
    item.rotation.set(...r);
    item.castShadow = item.receiveShadow = true;
    parent.add(item);
    return item;
  }
  function batchMovingParts(assembly: Group) {
    const sets = new Map<BufferGeometry, Map<Material, Mesh[]>>();
    for (const object of [...assembly.children]) {
      if (!(object instanceof Mesh) || Array.isArray(object.material)) continue;
      let byMaterial = sets.get(object.geometry);
      if (!byMaterial) {
        byMaterial = new Map();
        sets.set(object.geometry, byMaterial);
      }
      let parts = byMaterial.get(object.material);
      if (!parts) {
        parts = [];
        byMaterial.set(object.material, parts);
      }
      parts.push(object);
    }
    for (const [geometry, materials] of sets)
      for (const [material, parts] of materials) {
        if (parts.length < 2) continue;
        const combined = new InstancedMesh(geometry, material, parts.length);
        parts.forEach((part, i) => {
          part.updateMatrix();
          combined.setMatrixAt(i, part.matrix);
          assembly.remove(part);
        });
        combined.castShadow = combined.receiveShadow = true;
        combined.computeBoundingSphere();
        assembly.add(combined);
      }
  }
  function arch(x: number, z: number, y: number, radius: number, rise: number, depth: number) {
    const jamb = radius * 0.22;
    for (const side of [-1, 1]) {
      box(face, x + side * (radius + jamb * 0.5), y * 0.51, z, jamb, y * 1.02, depth);
      box(chalk, x + side * (radius + jamb * 0.5), y - 0.025, z, jamb * 1.35, 0.13, depth * 1.13);
      box(dark, x + side * (radius + jamb * 0.5), 0.075, z, jamb * 1.42, 0.15, depth * 1.2);
    }
    place(curve, chalk, [x, y, z], [radius, rise, depth]);
  }
  function stairs(p: MazePoint, down: boolean) {
    const x = p.x + 0.5,
      z = p.y + 0.5;
    const trim = down ? jade : brass;
    for (let k = 0; k < 7; k++) {
      const level = (k - 3) * 0.027 * (down ? -1 : 1);
      box(k === 0 ? trim : ground, x, level - 0.113, z + 0.42 - k * 0.14, 0.93, 0.224, 0.145, 0.93 + k * 0.008);
      box(k === 0 ? trim : chalk, x, level - 0.02, z + 0.479 - k * 0.14, 0.91, 0.038, 0.025);
    }
    for (const side of [-1, 1]) {
      box(dark, x + side * 0.52, -0.17, z, 0.17, 0.67, 1.13);
      box(chalk, x + side * 0.52, 0.172, z, 0.2, 0.07, 1.17);
    }
    const name = down ? (frost ? '↓ B4' : '↓ B3') : frost ? '↑ B2' : '↑ B1';
    const sign = stairSign(name, down);
    mats.push(sign);
    if (!down) {
      // The return stair is a hatch with side rails. The open landing remains visible from both sides.
      for (const side of [-1, 1]) {
        const railX = x + side * 0.51;
        for (const dz of [-0.39, 0.36]) place(oct, iron, [railX, 0.31, z + dz], [0.071, 0.36, 0.071]);
        place(axialDrum, brass, [railX, 0.51, z - 0.02], [0.047, 0.047, 0.88]);
      }
      const markerX = x + 0.65,
        markerZ = z - 0.57;
      box(wet, markerX, 0.3, markerZ, 0.16, 0.66, 0.16);
      box(brass, markerX, 0.66, markerZ, 0.22, 0.1, 0.19);
      box(iron, markerX, 0.815, markerZ, 0.67, 0.29, 0.092);
      place(screen, sign, [markerX, 0.817, markerZ + 0.049], [0.624, 0.257, 1]);
      touchTarget(p, blocks, [markerX, 0.815, markerZ], [0.67, 0.29, 0.12]);
      lamp(x - 0.58, 0.18, z - 0.47, 0.65);
      return;
    }
    const head = z - 1.69,
      spring = 1.29,
      radius = 0.86,
      rise = 0.76;
    arch(x, head, spring, radius, rise, 0.46);
    const plate = spring + rise * 0.99,
      front = 0.232;
    box(iron, x, plate, head + front, 0.84, 0.31, 0.094);
    place(screen, sign, [x, plate + 0.005, head + front + 0.051], [0.81, 0.286, 1]);
    touchTarget(p, blocks, [x, plate, head + front], [0.87, 0.34, 0.15]);
    for (const side of [-1, 1]) {
      const jambX = x + side * (radius * 1.11);
      box(trim, jambX, spring * 0.6, head + front, 0.079, spring * 0.64, 0.048);
      lamp(jambX, spring + 0.04, head, 0.61);
      box(iron, x + side * 0.401, 0.009, z - 1.05, 0.061, 0.022, 0.91);
    }
  }
  stairs(plan.up, false);
  stairs(plan.down, true);

  const outlets: Outfall[] = [];
  if (!frost) {
    const headings = [
      [7.86, 13.21],
      [9.48, 13.21],
      [11.1, 13.21],
      [12.72, 13.21],
    ];
    for (const [x, z] of headings) {
      box(wet, x, -0.1, z, 0.45, 1.12, 0.71);
      box(brass, x, 0.17, z, 0.47, 0.075, 0.74);
      box(chalk, x, 0.47, z, 0.52, 0.12, 0.8);
    }
    for (let i = 0; i < headings.length - 1; i++) {
      const [bx, bz] = headings[i],
        mid = bx + 0.81;
      place(curve, face, [mid, 0.48, bz], [0.693, 0.48, 0.62]);
      place(curve, chalk, [mid, 0.48, bz + 0.31], [0.676, 0.45, 0.102], [0, 0, 0], 0.91);
      box(wet, mid, 1.09, bz, 1.64, 0.16, 0.76);
      for (const side of [-1, 1]) {
        if (i === 2 && side === 1) {
          for (const offset of [-0.56, 0.56]) box(face, mid + offset, 1.24, bz + 0.314, 0.51, 0.23, 0.15);
        } else box(face, mid, 1.24, bz + side * 0.314, 1.64, 0.23, 0.15);
      }
    }
    // Excess water passes over a chipped lip and falls back into the same cistern.
    const trough = new Mesh(new PlaneGeometry(5.02, 0.48), channel.material);
    trough.rotation.x = -Math.PI / 2;
    trough.position.set(10.31, 1.179, 13.21);
    trough.renderOrder = 2;
    scene.add(trough);
    geometries.push(trough.geometry);
    for (const x of [7.73, 12.86]) box(face, x, 1.25, 13.21, 0.13, 0.23, 0.79);
    const pipeX = 7.9,
      pipeZ = 12.83;
    place(round, iron, [pipeX, 0.4, pipeZ], [0.19, 1.61, 0.19]);
    for (const level of [-0.22, 0.4, 1.13]) place(round, brass, [pipeX, level, pipeZ], [0.214, 0.09, 0.214]);
    place(axialDrum, iron, [pipeX, 1.18, 13.03], [0.183, 0.183, 0.48]);
    const ex = 11.91,
      ez = 13.62;
    box(chalk, ex, 1.094, ez, 0.69, 0.13, 0.38);
    outlets.push({ x: ex, y: 1.181, z: ez + 0.12, dx: 0, dz: 1, width: 0.51, reach: 0.58 });
    for (const [x, z, dx, dz] of [
      [5.31, 1.91, 0, 1],
      [21.09, 8.6, -1, 0],
      [21.09, 17.6, -1, 0],
    ]) {
      const yaw = Math.atan2(dx, dz);
      place(axialDrum, iron, [x, 0.97, z], [0.38, 0.38, 0.58], [0, yaw, 0]);
      place(ring, brass, [x + dx * 0.27, 0.97, z + dz * 0.27], [0.355, 0.355, 0.42], [0, yaw, 0]);
      place(axialDrum, wet, [x + dx * 0.283, 0.97, z + dz * 0.283], [0.295, 0.295, 0.03], [0, yaw, 0], 0.49);
      outlets.push({ x: x + 0.3 * dx, y: 0.77, z: z + 0.3 * dz, dx, dz, width: 0.47, reach: 0.7 });
    }
    const turbine = plan.landmarks.find((p) => p.kind === 'turbine')!;
    const x = turbine.x + 0.64,
      z = turbine.y + 0.37;
    channel.material.uniforms.wheel.value.set(x, z);
    for (const dz of [-0.67, 0.64]) {
      place(oct, dark, [x, -0.19, z + dz], [0.38, 0.85, 0.33], [0, Math.PI / 8, 0]);
      box(brass, x, 0.22, z + dz, 0.44, 0.13, 0.22);
    }
    place(round, iron, [x, 0.18, z], [0.13, 1.68, 0.13], [Math.PI / 2, 0, 0]);
    const axle = new Group();
    axle.position.set(x, 0.18, z);
    for (const dz of [-0.36, 0.36]) {
      mesh(axle, ring, brass, [0, 0, dz], [0.83, 0.83, 0.63]);
      mesh(axle, ring, iron, [0, 0, dz], [0.59, 0.59, 0.46]);
      for (let k = 0; k < 4; k++) mesh(axle, blocks, iron, [0, 0, dz], [0.077, 1.58, 0.09], [0, 0, (k * Math.PI) / 4]);
    }
    for (let k = 0; k < 10; k++) {
      const a = (k * tau) / 10;
      mesh(axle, blocks, wood, [Math.sin(a) * 0.79, Math.cos(a) * 0.79, 0], [0.29, 0.09, 0.81], [0, 0, -a + 0.31]);
    }
    mesh(axle, axialDrum, iron, [0, 0, 0.458], [0.34, 0.34, 0.1]);
    mesh(axle, ring, brass, [0, 0, 0.515], [0.263, 0.263, 0.25]);
    for (let tooth = 0; tooth < 12; tooth++) {
      const a = (tooth * tau) / 12;
      mesh(axle, blocks, brass, [0.342 * Math.cos(a), 0.342 * Math.sin(a), 0.466], [0.084, 0.084, 0.115], [0, 0, a]);
      mesh(axle, axialDrum, iron, [0.819 * Math.cos(a), 0.819 * Math.sin(a), 0.408], [0.033, 0.033, 0.058]);
    }
    mesh(axle, axialDrum, brass, [0, 0, 0.538], [0.134, 0.134, 0.109]);
    scene.add(axle);
    moving.push(axle);
    for (const mark of plan.landmarks.filter((p) => p.kind === 'gauge')) {
      const x = mark.x + 0.5,
        z = mark.y + 0.5;
      box(dark, x, -0.04, z, 0.57, 0.73, 0.54);
      box(chalk, x, 0.68, z, 0.25, 1.38, 0.2);
      box(iron, x, 0.66, z + 0.111, 0.18, 1.13, 0.04);
      place(round, brass, [x + 0.174, 0.41, z + 0.071], [0.021, 1.36, 0.021]);
      place(oct, jade, [x + 0.174, -0.248, z + 0.071], [0.101, 0.103, 0.101]);
      box(brass, x + 0.106, 1.072, z + 0.05, 0.199, 0.046, 0.077);
      for (let k = 0; k < 8; k++)
        box(k % 2 ? brass : chalk, x - 0.031, 0.2 + k * 0.126, z + 0.141, k % 2 ? 0.083 : 0.13, 0.025, 0.021);
      place(ring, brass, [x, 1.33, z + 0.04], [0.18, 0.18, 0.23]);
    }
    for (const [x, z] of [
      [12.56, 4.39],
      [19.76, 13.15],
      [5.4, 9.63],
    ]) {
      place(oct, dark, [x, -0.14, z], [0.55, 0.81, 0.51], [0, 0.39, 0]);
      place(round, iron, [x, 0.13, z + 0.25], [0.33, 0.54, 0.33], [Math.PI / 2, 0, 0]);
      place(ring, brass, [x, 0.13, z + 0.54], [0.3, 0.3, 0.39]);
      box(dark, x, 0.54, z, 0.98, 0.15, 1.1);
    }
  } else {
    for (const relic of plan.landmarks) {
      const x = relic.x + 0.5,
        z = relic.y + 0.5;
      if (relic.kind === 'sarcophagus') {
        box(wet, x, -0.455, z, 0.94, 1.34, 1.59);
        box(chalk, x, 0.245, z, 0.93, 0.089, 1.56);
        box(face, x, 0.401, z, 0.81, 0.26, 1.37);
        place(lid, chalk, [x, 0.522, z], [1, 1, 1]);
        for (const dz of [-0.395, 0.395]) {
          box(iron, x, 0.739, z + dz, 0.53, 0.022, 0.061);
          for (const side of [-1, 1]) {
            place(ring, brass, [x + side * 0.414, 0.418, z + dz], [0.06, 0.067, 0.068], [0, Math.PI / 2, 0]);
            box(brass, x + side * 0.401, 0.517, z + dz, 0.037, 0.131, 0.065);
          }
        }
        place(ring, brass, [x, 0.767, z - 0.035], [0.184, 0.184, 0.14], [-Math.PI / 2, 0, 0]);
        place(ring, iron, [x, 0.77, z - 0.035], [0.129, 0.129, 0.13], [-Math.PI / 2, 0, 0]);
        for (let k = 0; k < 3; k++)
          place(blocks, brass, [x, 0.769, z - 0.035], [0.19, 0.017, 0.026], [0, (k * Math.PI) / 3, 0]);
        place(icicle, gem, [x + 0.27, 0.536, z - 0.52], [0.17, 0.32, 0.17], [0.13, 1.88, -0.08]);
        const lampX = x - 0.325,
          lampZ = z + 0.535;
        place(oct, brass, [lampX, 0.624, lampZ], [0.095, 0.066, 0.095]);
        place(oct, amberGlass, [lampX, 0.718, lampZ], [0.062, 0.125, 0.062]);
        place(oct, iron, [lampX, 0.804, lampZ], [0.095, 0.041, 0.095]);
      } else {
        place(oct, dark, [x, -0.56, z], [0.7, 1.13, 0.71], [0, 0.48, 0]);
        for (let k = 0; k < 7; k++) {
          const a = k * 2.4,
            r = k === 0 ? 0 : 0.2 + 0.2 * noise(k + z);
          const height = (k === 0 ? 1.9 : 0.54 + 1.04 * noise(k * 2)) * (relic.x === 17 ? 1.23 : 1);
          place(
            icicle,
            gem,
            [x + r * Math.sin(a), -0.07, z + r * Math.cos(a)],
            [0.34 + 0.15 * noise(k), height, 0.36 + 0.1 * noise(k + 1)],
            [0.12 + 0.27 * Math.cos(a), a, 0.11 + 0.27 * Math.sin(a)],
          );
        }
        place(ring, brass, [x, -0.03, z], [0.55, 0.55, 0.4], [-Math.PI / 2, 0, 0]);
      }
    }
    const fissures = [
      [8.18, 4.25, 1.21],
      [10.32, 3.63, 1.66],
      [15.25, 11.65, 1.17],
      [18.86, 12.54, 1.02],
      [3.48, 14.24, 1.31],
      [7.09, 19.27, 1.09],
    ];
    for (const [x, z, size] of fissures) {
      place(oct, wet, [x, -0.72, z], [0.65, 0.82, 0.59], [0, x * 0.42, 0]);
      for (let k = 0; k < 4; k++) {
        const a = 1.9 * k + x * 0.36,
          spread = k ? 0.24 : 0;
        place(
          icicle,
          gem,
          [x + spread * Math.cos(a), -0.39, z + spread * Math.sin(a)],
          [(0.38 - k * 0.052) * size, (1.0 - k * 0.19) * size, (0.37 - k * 0.042) * size],
          [0.12 + 0.28 * Math.sin(a), a, -0.12 + 0.3 * Math.cos(a)],
          0.86 + 0.04 * k,
        );
      }
    }
    // Glacial shelves expose faceted ice below the floor. Their silhouette follows the actual chasm.
    for (let y = 2; y < plan.height - 2; y++)
      for (let x = 2; x < plan.width - 2; x++) {
        if (!stoneFloor(x, y)) continue;
        const k = x + 31 * y;
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          if (plan.tiles[y + dz][x + dx] !== 'channel' || noise(k + 2 * dx + dz) > 0.43) continue;
          const yaw = Math.atan2(dx, dz),
            cx = x + 0.5 + dx * 0.491,
            cz = y + 0.5 + dz * 0.491;
          place(blocks, ice, [cx, -0.099, cz], [0.6 + 0.26 * noise(k + 19), 0.109, 0.077], [0, yaw, 0], 0.76);
          for (let j = 0; j < 3; j++) {
            const offset = (j - 1) * 0.21 + 0.042 * noise(k + j);
            const scale = 0.08 + 0.12 * noise(k + j * 2);
            place(
              icicle,
              gem,
              [cx + dz * offset, -0.16, cz - dx * offset],
              [scale, 0.2 + 0.34 * noise(k + j * 11), scale * 0.73],
              [Math.PI - 0.038, yaw, -0.05 + 0.09 * noise(k + j)],
              0.72 + j * 0.05,
            );
          }
        }
      }
    for (const [x, z] of [
      [14.5, 9.48],
      [4.46, 13.58],
      [17.48, 5.4],
      [8.4, 18.02],
    ]) {
      box(wet, x, -0.51, z, 0.83, 1.22, 1.3);
      box(face, x, 0.13, z, 0.87, 0.17, 1.42);
      place(lid, chalk, [x, 0.216, z], [0.91, 0.87, 0.92]);
      box(iron, x, 0.426, z, 0.11, 0.029, 0.68);
      box(brass, x, 0.444, z - 0.16, 0.23, 0.019, 0.07);
    }
  }

  const cascades = outlets.length ? outfalls(outlets) : undefined;
  if (cascades) {
    scene.add(cascades);
    cascades.renderOrder = 4;
    outlets.forEach((lip, i) =>
      channel.material.uniforms.release.value[i].set(
        lip.x + lip.dx * lip.reach * Math.sin(1.24),
        lip.z + lip.dz * lip.reach * Math.sin(1.24),
      ),
    );
  }
  const switchPosition = plan.switch;
  const sx = switchPosition.x + 0.9,
    sz = switchPosition.y + 0.78;
  const signal = new MeshStandardMaterial({
    color: 0xd9b477,
    emissive: 0xd79340,
    emissiveIntensity: 0.52,
    roughness: 0.38,
  });
  const liftCore = new MeshStandardMaterial({
    color: 0x425950,
    emissive: 0x77c1a7,
    emissiveIntensity: 0.035,
    roughness: 0.29,
  });
  mats.push(signal, liftCore);
  if (frost) {
    const x = catacombLift.x + 0.5,
      z = catacombLift.y + 0.5;
    touchTarget(catacombLift, blocks, [x - 0.43, 0.63, z], [0.18, 0.48, 0.26]);
    box(wet, x, 0.012, z, 0.91, 0.034, 0.94);
    for (let k = -3; k <= 3; k++) box(iron, x + k * 0.115, 0.037, z, 0.078, 0.026, 0.83, 0.86 + (k % 2) * 0.065);
    for (const dz of [-0.385, 0.385]) box(brass, x, 0.059, z + dz, 0.86, 0.024, 0.046);
    place(ring, brass, [x, 0.06, z], [0.212, 0.212, 0.16], [-Math.PI / 2, 0, 0]);
    place(oct, liftCore, [x, 0.061, z], [0.106, 0.021, 0.106]);
    for (const dz of [-0.32, 0.32]) {
      box(wet, x - 0.5, 0.82, z + dz, 0.21, 1.75, 0.2);
      box(brass, x - 0.389, 0.83, z + dz, 0.057, 1.57, 0.078);
      for (let link = 0; link < 8; link++) {
        const y = 0.24 + link * 0.172;
        place(ring, iron, [x - 0.358, y, z + dz], [0.064, 0.1, 0.075], [0, link % 2 ? Math.PI / 4 : -Math.PI / 4, 0]);
      }
      place(lateralDrum, brass, [x - 0.405, 1.64, z + dz], [0.19, 0.146, 0.146]);
    }
    box(brass, x - 0.477, 1.55, z, 0.215, 0.105, 0.83);
    box(iron, x - 0.419, 0.58, z, 0.14, 0.4, 0.24);
    box(liftCore, x - 0.334, 0.61, z, 0.041, 0.18, 0.068);
  }
  box(dark, sx, 0.084, sz, 0.46, 0.17, 0.44);
  box(chalk, sx, 0.193, sz, 0.39, 0.085, 0.39);
  box(face, sx, 0.46, sz, 0.25, 0.47, 0.24);
  box(iron, sx, 0.7, sz, 0.3, 0.15, 0.29);
  place(axialDrum, brass, [sx, 0.71, sz + 0.007], [0.145, 0.145, 0.34]);
  const switchWheel = new Group();
  switchWheel.position.set(sx, 0.71, sz + 0.19);
  mesh(switchWheel, ring, brass, [0, 0, 0], [0.31, 0.31, 0.34]);
  for (let i = 0; i < 3; i++)
    mesh(switchWheel, blocks, iron, [0, 0, 0.008], [0.55, 0.037, 0.065], [0, 0, (i * Math.PI) / 3]);
  mesh(switchWheel, round, signal, [0, 0, 0.075], [0.1, 0.072, 0.1], [Math.PI / 2, 0, 0]);
  mesh(switchWheel, axialDrum, brass, [0.226, 0.199, 0.076], [0.036, 0.036, 0.2]);
  mesh(switchWheel, axialDrum, iron, [0.226, 0.199, 0.139], [0.046, 0.046, 0.14]);
  scene.add(switchWheel);
  touchTarget(plan.switch, axialDrum, [sx, 0.71, sz + 0.19], [0.335, 0.335, 0.15]);
  // Give the control and its remote gate the same segmented brass medallion.
  const landing = plan.gate;
  for (const [x, z] of [
    [sx, sz + 0.35],
    [landing.x + (frost ? 0.76 : -0.31), landing.y + (frost ? 1.19 : 0.57)],
  ]) {
    place(ring, brass, [x, 0.026, z], [0.2, 0.2, 0.17], [-Math.PI / 2, 0, 0]);
    for (let k = 0; k < 3; k++)
      place(blocks, brass, [x, 0.026, z], [0.29, 0.025, 0.029], [0, (k * Math.PI) / 3, 0], 0.84);
  }
  const port = new Group(),
    gx = plan.gate.x,
    gz = plan.gate.y;
  const cables: Mesh[] = [];
  const cableStart = new Vector3(),
    cableEnd = new Vector3(),
    cableDirection = new Vector3(),
    upVector = new Vector3(0, 1, 0);
  if (!frost) {
    port.position.set(gx, 0.008, gz + 0.5);
    mesh(port, blocks, iron, [0.5, -0.062, 0], [1.01, 0.115, 0.84]);
    for (let k = 0; k < 7; k++) mesh(port, blocks, wood, [(k + 0.5) / 7, 0.013, 0], [0.128, 0.052, 0.87]);
    for (const side of [-1, 1]) {
      mesh(port, blocks, brass, [0.5, 0.042, side * 0.39], [0.99, 0.025, 0.041]);
      box(dark, gx + 0.018, 0.15, gz + 0.5 + side * 0.48, 0.24, 0.33, 0.18);
      place(round, brass, [gx + 0.021, 0.16, gz + 0.5 + side * 0.49], [0.101, 0.2, 0.101], [Math.PI / 2, 0, 0]);
      box(iron, gx - 0.11, 0.55, gz + 0.5 + side * 0.48, 0.11, 1.1, 0.11);
      box(brass, gx - 0.11, 0.21, gz + 0.5 + side * 0.48, 0.18, 0.074, 0.18);
      place(axialDrum, brass, [gx - 0.11, 1.1, gz + 0.5 + side * 0.48], [0.092, 0.092, 0.15]);
      const cable = new Mesh(round, iron);
      cable.castShadow = true;
      scene.add(cable);
      cables.push(cable);
    }
  } else {
    port.position.set(gx + 0.5, 2.07, gz + 0.5);
    for (let k = 0; k < 6; k++) mesh(port, blocks, iron, [(k - 2.5) * 0.165, -1, 0], [0.058, 2, 0.092]);
    for (const y of [-1.73, -0.62]) mesh(port, blocks, brass, [0, y, 0], [0.96, 0.105, 0.14]);
    for (const side of [-1, 1]) {
      box(dark, gx + 0.5 + side * 0.53, 0.87, gz + 0.5, 0.2, 2.04, 0.38);
      box(chalk, gx + 0.5 + side * 0.53, 2.03, gz + 0.5, 0.29, 0.45, 0.49);
      box(iron, gx + 0.5 + side * 0.49, 1.6, gz + 0.65, 0.068, 3.18, 0.084);
      place(axialDrum, brass, [gx + 0.5 + side * 0.49, 3.07, gz + 0.58], [0.12, 0.12, 0.24]);
    }
    place(curve, chalk, [gx + 0.5, 2.24, gz + 0.5], [0.52, 0.42, 0.4]);
    box(ground, gx + 0.5, -0.18, gz + 0.5, 1.02, 0.36, 1.01);
    lamp(gx - 0.02, 0.1, gz + 0.74, 0.56);
  }
  scene.add(port);
  for (const assembly of [...moving, switchWheel, port]) batchMovingParts(assembly);

  // Recessed arches live along masonry edges, leaving the centers of passage tiles entirely clear.
  for (let y = 2; y < plan.height - 2; y++)
    for (let x = 2; x < plan.width - 2; x++) {
      if (plan.tiles[y][x] !== 'wall' || !stoneFloor(x, y + 1) || (x * 7 + y * 3) % 8 > 1) continue;
      const cx = x + 0.5,
        z = y + 1.006;
      box(dark, cx, 0.3, z, 0.5, 0.55, 0.05);
      place(curve, face, [cx, 0.41, z + 0.04], [0.239, 0.18, 0.104]);
      for (let k = -2; k <= 2; k++) box(iron, cx + k * 0.075, 0.27, z + 0.07, 0.025, 0.37, 0.037);
    }
  batches.forEach((materials, geometry) =>
    materials.forEach((items, material) => {
      const instance = new InstancedMesh(geometry, material, items.length);
      items.forEach((stamp, i) => {
        instance.setMatrixAt(i, stamp.pose);
        instance.setColorAt(i, color.setScalar(stamp.brightness));
        if (stamp.bridge) {
          bridgeParts.push({ instance, index: i, rest: stamp.pose, x: stamp.bridge.x, z: stamp.bridge.z });
          bridgeBatches.add(instance);
          instance.instanceMatrix.setUsage(DynamicDrawUsage);
        }
      });
      instance.castShadow = material !== glowGlass && material !== jade;
      instance.receiveShadow = true;
      instance.computeBoundingSphere();
      scene.add(instance);
    }),
  );

  const halo = new SpriteMaterial({
    map: glow,
    color: frost ? 0xa8dbf1 : 0xffcf91,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    opacity: 0.46,
  });
  for (const p of lamps) {
    const sprite = new Sprite(halo);
    sprite.position.set(...p);
    sprite.scale.setScalar(0.93);
    scene.add(sprite);
  }
  const sky = new HemisphereLight(frost ? 0xc2e2f4 : 0xf0e1b6, frost ? 0x4b607c : 0x4f6861, 1.33);
  scene.add(sky);
  const keyLight = new DirectionalLight(frost ? 0xcde6ff : 0xffddab, 1.68);
  keyLight.position.set(4, 15, 14);
  keyLight.target.position.set(12, 0, 10);
  keyLight.castShadow = true;
  keyLight.shadow.autoUpdate = false;
  keyLight.shadow.needsUpdate = true;
  let lastShadow = -Infinity,
    shadowX = -50,
    shadowZ = -50;
  Object.assign(keyLight.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 0.5, far: 44 });
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.normalBias = 0.027;
  keyLight.shadow.bias = -0.0002;
  keyLight.shadow.camera.updateProjectionMatrix();
  scene.add(keyLight, keyLight.target);
  const wash = new DirectionalLight(frost ? 0x729ad0 : 0x7eb5bc, 0.68);
  wash.position.set(18, 7, 1);
  wash.target.position.set(10, 0, 13);
  scene.add(wash, wash.target);
  const relicLamp = new PointLight(frost ? 0x7bcbf4 : 0xffc27b, frost ? 11.5 : 8, 5.8, 2);
  const masonryBounce = new PointLight(frost ? 0xe8ad70 : 0x75bfba, frost ? 2.6 : 4.8, 4.5, 2);
  if (frost) {
    relicLamp.position.set(17.32, 1.21, 12.13);
    masonryBounce.position.set(8.12, 1.17, 11.04);
  } else {
    relicLamp.position.set(8.91, 1.56, 8.84);
    masonryBounce.position.set(12.1, 1.78, 14.03);
  }
  scene.add(relicLamp, masonryBounce);
  const guideLight = new PointLight(frost ? 0x9dcee9 : 0xf2c996, 4.5, 7.8, 2);
  const downLight = new PointLight(frost ? 0x8abfff : 0x84ccbc, 9.5, 6.3, 2);
  downLight.position.set(plan.down.x + 0.5, 1.38, plan.down.y + 0.1);
  scene.add(guideLight, downLight);
  const deckMatrix = new Matrix4();
  return {
    scene,
    surfaceAt: pontoons.surfaceAt,
    landmarkAt(ray: Raycaster) {
      const hit = ray.intersectObjects(touchTargets, false)[0];
      return hit ? destinations.get(hit.object as Mesh) : undefined;
    },
    update(t: number, w: number, h: number, frame: FortressInteriorFrame) {
      tick = frame.now;
      jade.emissiveIntensity = 0.35 + 0.3 * (frame.resonance ?? 0);
      const shadowAge = tick - lastShadow;
      const moved = Math.abs(frame.x - shadowX) + Math.abs(frame.y - shadowZ) > 0.13;
      if (shadowAge < 0 || shadowAge > 960 || (shadowAge > 78 && (moved || frame.gateAge < 0.7))) {
        keyLight.shadow.needsUpdate = true;
        lastShadow = tick;
        shadowX = frame.x;
        shadowZ = frame.y;
      }
      liftCore.color.setHex(frame.liftUnlocked ? 0x98cbb2 : 0x425950);
      liftCore.emissiveIntensity = frame.liftUnlocked ? 0.62 : 0.035;
      frostSteps?.update(frame, h);
      if (pontoons.update(frame)) {
        for (const { instance, index, rest, x, z } of bridgeParts) {
          deckMatrix.copy(rest);
          deckMatrix.elements[13] += pontoons.surfaceAt(x, z);
          instance.setMatrixAt(index, deckMatrix);
        }
        for (const batch of bridgeBatches) batch.instanceMatrix.needsUpdate = true;
      }
      pontoons.wakes.forEach((wake, i) => {
        const age = Math.min(2, frame.now * 0.001 - wake.time);
        channel.material.uniforms.wake.value[i].set(wake.x, wake.z, age, wake.strength);
      });
      pools?.update(t, w, h, frame);
      channel.material.uniforms.clock.value = t;
      if (cascades) cascades.material.uniforms.clock.value = t;
      if (moving[0]) moving[0].rotation.z = t * 0.39;
      const age = frame.shortcutOpen ? Math.min(1, Math.max(0, (frame.gateAge ?? Infinity) / 0.53)) : 0;
      const opened = frame.reduced ? Number(frame.shortcutOpen) : age * age * (3 - 2 * age);
      switchWheel.rotation.z = -opened * Math.PI * 1.18;
      signal.color.setHex(frame.shortcutOpen ? 0x8fcbbb : 0xd9b477);
      signal.emissive.setHex(frame.shortcutOpen ? 0x3ba99c : 0xd79340);
      if (frost) {
        port.position.y = 2.07 + opened * 2.59;
      } else {
        const angle = (1 - opened) * Math.PI * 0.485;
        port.rotation.z = angle;
        cables.forEach((cable, i) => {
          const side = i * 2 - 1;
          cableStart.set(gx - 0.11, 1.1, gz + 0.5 + side * 0.48);
          cableEnd.set(gx + 0.93 * Math.cos(angle), 0.047 + 0.93 * Math.sin(angle), gz + 0.5 + side * 0.4);
          cable.position.addVectors(cableStart, cableEnd).multiplyScalar(0.5);
          cableDirection.subVectors(cableEnd, cableStart);
          cable.scale.set(0.016, cableDirection.length(), 0.016);
          cable.quaternion.setFromUnitVectors(upVector, cableDirection.normalize());
        });
      }
      guideLight.position.set(frame.x + 0.98, 3.1, frame.y + 1.14);
      if (frost) gem.emissiveIntensity = 0.4 + 0.07 * Math.sin(t * 0.68);
    },
    dispose() {
      scene.traverse((node) => {
        if (node instanceof InstancedMesh) node.dispose();
      });
      keyLight.shadow.dispose();
      halo.dispose();
      apron.geometry.dispose();
      channel.geometry.dispose();
      channel.material.uniforms.shore.value.dispose();
      channel.material.dispose();
      frostSteps?.dispose();
      pools?.dispose();
      mirror?.geometry.dispose();
      mirror?.dispose();
      cascades?.geometry.dispose();
      cascades?.material.dispose();
      palette.disposeMaps();
      for (const material of mats) {
        if (material instanceof MeshBasicMaterial && material.map) material.map.dispose();
        material.dispose();
      }
      geometries.forEach((g) => g.dispose());
    },
  };
}
