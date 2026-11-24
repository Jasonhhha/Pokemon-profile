import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  ShaderMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createWaterRelief } from './fortress-relief';
import { carvedDrum, createTideDial } from './fortress-tide-dial';
import type { FortressRoom } from './field-fortress-state';

const tau = Math.PI * 2;
function grain(n: number) {
  const v = Math.sin(n * 127.13 + 0.824) * 43758.545;
  return v - Math.floor(v);
}

function mineralTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const pixels = ctx.createImageData(128, 128);
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      const grainEdge = Math.sin((x * tau) / 32 + Math.sin((y * tau) / 64) * 0.52);
      const vein = Math.cos((x * tau) / 128 + Math.sin((y * tau) / 128) * 2.0) * Math.sin((y * tau) / 64);
      const fleck = grain(y * 128 + x);
      const tone = 223 + 8 * vein + 3 * grainEdge + (fleck - 0.5) * 48 - (fleck < 0.034 ? 42 : 0);
      const i = (y * 128 + x) * 4;
      pixels.data[i] = tone;
      pixels.data[i + 1] = tone + 2;
      pixels.data[i + 2] = tone + 3;
      pixels.data[i + 3] = 255;
    }
  ctx.putImageData(pixels, 0, 0);
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  map.wrapS = map.wrapT = RepeatWrapping;
  return map;
}

// A true masonry wedge, with an intrados, extrados and two exposed end faces.
function voussoir(inner: number, outer: number, span: number, depth: number) {
  const vertices: number[] = [];
  const uvs: number[] = [];
  const count = 3;
  function at(r: number, i: number, z: number) {
    const a = (i / count - 0.5) * span;
    return [r * Math.sin(a), r * Math.cos(a), z];
  }
  function quad(a: number[], b: number[], c: number[], d: number[]) {
    vertices.push(...a, ...b, ...d, ...b, ...c, ...d);
    uvs.push(0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1);
  }
  const near = depth / 2,
    far = -near;
  for (let i = 0; i < count; i++) {
    const a = at(inner, i, near),
      b = at(inner, i + 1, near),
      c = at(outer, i + 1, near),
      d = at(outer, i, near);
    const e = at(inner, i, far),
      f = at(inner, i + 1, far),
      g = at(outer, i + 1, far),
      h = at(outer, i, far);
    quad(a, b, c, d);
    quad(f, e, h, g);
    quad(d, c, g, h);
    quad(e, f, b, a);
    if (!i) quad(e, a, d, h);
    if (i === count - 1) quad(b, f, g, c);
  }
  const geom = new BufferGeometry();
  geom.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geom.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geom.computeVertexNormals();
  return geom;
}

type Instance = { matrix: Matrix4; shade: number };
type Point = [number, number, number];

export function buildFortressStonework(room: FortressRoom) {
  const group = new Group();
  const grainMap = mineralTexture();
  const relief = createWaterRelief();
  const stone = new MeshStandardMaterial({ color: 0x9a9883, map: grainMap, roughness: 0.85, side: DoubleSide });
  const wet = new MeshStandardMaterial({
    color: 0x445c58,
    map: grainMap,
    roughness: 0.29,
    metalness: 0.19,
    side: DoubleSide,
  });
  const pale = new MeshStandardMaterial({ color: 0xd2c49d, map: grainMap, roughness: 0.69, side: DoubleSide });
  const floor = new MeshStandardMaterial({ color: 0xa29e86, map: grainMap, roughness: 0.55, metalness: 0.11 });
  const iron = new MeshStandardMaterial({ color: 0x384c52, roughness: 0.52, metalness: 0.39 });
  const bronze = new MeshStandardMaterial({ color: 0xb18a51, roughness: 0.48, metalness: 0.43 });
  const patina = new MeshStandardMaterial({ color: 0x528178, map: grainMap, roughness: 0.5, metalness: 0.28 });
  const dark = new MeshStandardMaterial({ color: 0x26393f, roughness: 0.88 });
  const glass = new MeshBasicMaterial({ color: 0xffd89b });
  const sealLight = new MeshBasicMaterial({ color: 0x719686 });
  const serpentine = new MeshStandardMaterial({ color: 0x728078, map: grainMap, roughness: 0.62, metalness: 0.09 });
  const weathered = new MeshStandardMaterial({ color: 0xaa9a79, map: grainMap, roughness: 0.7 });
  const seaGlass = new MeshBasicMaterial({ color: 0x738f8d });
  const windows: Point[] = [];
  const geom = {
    cube: new BoxGeometry(),
    shaft: carvedDrum(
      [
        [0, 1],
        [0.035, 1],
        [0.1, 0.92],
        [0.38, 0.91],
        [0.73, 0.86],
        [0.96, 0.8],
        [1, 0.82],
      ],
      16,
      0.069,
    ),
    bell: carvedDrum(
      [
        [0, 0.55],
        [0.16, 0.62],
        [0.23, 0.68],
        [0.5, 0.68],
        [0.88, 1.02],
        [1, 1.04],
      ],
      12,
      0.13,
    ),
    largeArch: voussoir(0.965, 1.13, Math.PI / 15 - 0.012, 0.23),
    fineArch: voussoir(0.982, 1.017, Math.PI / 15 - 0.01, 0.27),
    panel: relief.geometry,
    ashlar: new RoundedBoxGeometry(1, 1, 1, 1, 0.033),
    column: new CylinderGeometry(1, 1, 1, 16),
    nut: new CylinderGeometry(1, 1, 1, 6),
    torus: new TorusGeometry(1, 0.072, 6, 32),
    niche: voussoir(0.64, 0.85, Math.PI / 9 - 0.023, 0.3),
  };
  const sets = new Map<BufferGeometry, Map<Material, Instance[]>>();
  const placer = new Object3D();
  function put(shape: BufferGeometry, material: Material, p: Point, s: Point, rot: Point = [0, 0, 0], shade = 1) {
    placer.position.set(...p);
    placer.scale.set(...s);
    placer.rotation.set(...rot);
    placer.updateMatrix();
    let mats = sets.get(shape);
    if (!mats) sets.set(shape, (mats = new Map()));
    let list = mats.get(material);
    if (!list) mats.set(material, (list = []));
    const outer = Math.min(1, Math.max(0, (Math.abs(p[0] - 8.5) - 5) / 12));
    const depth = Math.min(1, Math.max(0, -p[2] / 15));
    list.push({ matrix: placer.matrix.clone(), shade: shade * (1 - 0.57 * outer) * (1 - 0.32 * depth) });
  }
  function box(m: Material, x: number, y: number, z: number, w: number, h: number, d: number, shade = 1) {
    const distant = Math.abs(x - 8.5) > 12 || z < -7;
    const shape =
      !distant && (m === stone || m === pale || m === wet || m === floor) && h > 0.065 ? geom.ashlar : geom.cube;
    put(shape, m, [x, y, z], [w, h, d], [0, 0, 0], shade);
  }
  function cyl(m: Material, x: number, y: number, z: number, r: number, h: number, rot: Point = [0, 0, 0]) {
    put(geom.column, m, [x, y, z], [r, h, r], rot);
  }
  function beam(m: Material, a: Point, b: Point, w: number, d: number) {
    const v = new Vector3(...b).sub(new Vector3(...a));
    placer.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), v.clone().normalize());
    const rot: Point = [placer.rotation.x, placer.rotation.y, placer.rotation.z];
    put(geom.cube, m, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [w, v.length(), d], rot);
  }
  function wall(x: number, z: number, length: number, height: number, side = false) {
    const course = 0.48,
      width = 1.15;
    box(dark, x, height / 2 - 0.8, z, side ? 0.42 : length, height, side ? length : 0.42);
    for (let row = 0; row < height / course; row++) {
      const stride = side ? z : x;
      for (let c = 0; c <= Math.ceil(length / width); c++) {
        const lo = Math.max(0, (c - (row % 2) * 0.5) * width),
          hi = Math.min(length, (c + 1 - (row % 2) * 0.5) * width);
        if (hi - lo < 0.12) continue;
        const mid = stride - length / 2 + (hi + lo) * 0.5;
        const y = (row + 0.5) * course - 0.8;
        const m = y < 0.52 ? wet : stone;
        const shade = 0.71 + 0.27 * grain(row * 151 + c * 19 + x * 11 + z);
        box(
          m,
          side ? x : mid,
          y,
          side ? mid : z,
          side ? 0.49 : hi - lo - 0.023,
          course - 0.027,
          side ? hi - lo - 0.023 : 0.49,
          shade,
        );
      }
    }
    const cap = height - 0.74;
    box(pale, x, cap, z, side ? 0.68 : length + 0.14, 0.17, side ? length + 0.14 : 0.68, 0.83);
    box(patina, x, 0.45, z, side ? 0.54 : length, 0.065, side ? length : 0.54, 0.86);
  }
  function sideNiche(x: number, z: number, sign: number) {
    box(dark, x - sign * 0.08, 1.36, z, 0.06, 2.12, 1.31);
    if (z > 2 && z < 15 && (sign > 0 ? z < 8 : z > 8)) {
      box(seaGlass, x + sign * 0.015, 1.53, z, 0.021, 1.2, 1.07, 0.7);
      box(iron, x + sign * 0.038, 1.68, z, 0.039, 0.052, 1.09);
      windows.push([x + sign * 0.073, 1.58, z]);
    }
    for (let i = 0; i < 9; i++) {
      const angle = -Math.PI / 2 + ((i + 0.5) * Math.PI) / 9;
      placer.rotation.set(0, Math.PI / 2, 0);
      placer.rotateZ(angle);
      put(
        geom.niche,
        pale,
        [x, 1.72, z],
        [1, 1, 1],
        [placer.rotation.x, placer.rotation.y, placer.rotation.z],
        0.77 + grain(i + z) * 0.18,
      );
    }
    for (const dz of [-0.73, 0.73]) box(stone, x, 0.89, z + dz, 0.27, 1.67, 0.2);
    for (let bar = -2; bar <= 2; bar++) box(iron, x + sign * 0.03, 1.29, z + bar * 0.205, 0.1, 1.9, 0.044);
    box(bronze, x + sign * 0.04, 1.08, z, 0.085, 0.07, 1.22);
    box(wet, x, 0.23, z, 0.37, 0.15, 1.68);
  }
  function rail(x: number, z1: number, z2: number) {
    for (let z = z1; z < z2 + 0.01; z += 1) {
      box(wet, x, 0.085, z, 0.22, 0.15, 0.21);
      put(geom.bell, weathered, [x, 0.14, z], [0.102, 0.29, 0.102]);
      cyl(pale, x, 0.46, z, 0.13, 0.061);
      cyl(bronze, x, 0.52, z, 0.08, 0.052);
    }
    box(bronze, x, 0.52, (z1 + z2) / 2, 0.068, 0.057, z2 - z1 + 0.08);
  }
  // Drum, echinus and abacus sit on a stepped plinth. Rings of flutes give the capitals a water-lily profile.
  function palaceColumn(x: number, z: number, top: number, base: number, radius: number, alternate = false) {
    const foot = radius * 2.82;
    box(wet, x, base + 0.14, z, foot, 0.28, foot, 0.82);
    box(stone, x, base + 0.34, z, foot * 0.9, 0.14, foot * 0.9, 0.87);
    cyl(pale, x, base + 0.46, z, radius * 1.26, 0.115);
    cyl(wet, x, base + 0.6, z, radius * 1.11, 0.15);
    cyl(bronze, x, base + 0.695, z, radius * 1.02, 0.048);
    const shoulder = top - 0.76;
    put(
      geom.shaft,
      alternate ? serpentine : weathered,
      [x, base + 0.71, z],
      [radius, shoulder - base - 0.71, radius],
      [0, z * 0.27, 0],
    );
    cyl(pale, x, shoulder, z, radius * 0.88, 0.13);
    put(
      geom.bell,
      alternate ? stone : pale,
      [x, shoulder + 0.07, z],
      [radius * 1.36, 0.52, radius * 1.36],
      [0, 0.17, 0],
    );
    cyl(stone, x, top - 0.145, z, radius * 1.42, 0.1);
    box(pale, x, top - 0.046, z, radius * 2.9, 0.12, radius * 2.9, 0.96);
    if (!alternate)
      for (let i = 0; i < 8; i++) {
        const a = (i * tau) / 8;
        put(
          geom.nut,
          bronze,
          [x + Math.cos(a) * radius * 0.945, base + 0.71, z + Math.sin(a) * radius * 0.945],
          [0.026, 0.04, 0.026],
        );
      }
  }
  function vaultArch(x: number, z: number, radius: number, spring: number, alongZ = false, ornate = false) {
    const key = Math.floor(z * 11 + x * 7);
    for (let i = 0; i < 15; i++) {
      const a = -Math.PI / 2 + ((i + 0.5) * Math.PI) / 15;
      placer.rotation.set(0, alongZ ? Math.PI / 2 : 0, 0);
      placer.rotateZ(a);
      const turn: Point = [placer.rotation.x, placer.rotation.y, placer.rotation.z];
      const extent = radius * (i === 7 ? 1.027 : 1);
      put(
        geom.largeArch,
        i === 7 ? pale : stone,
        [x, spring, z],
        [extent, extent, radius],
        turn,
        0.73 + 0.23 * grain(key + i),
      );
      if (ornate) put(geom.fineArch, weathered, [x, spring, z], [radius, radius, radius], turn, 1.02);
    }
  }
  function capitalLamp(x: number, z: number, y: number, scale = 1) {
    const r = 0.24 * scale;
    cyl(wet, x, y - 0.2 * scale, z, r, 0.39 * scale);
    put(geom.bell, bronze, [x, y - 0.03 * scale, z], [r * 1.35, 0.18 * scale, r * 1.35]);
    cyl(glass, x, y + 0.126 * scale, z, r * 0.77, 0.037 * scale);
    for (let i = 0; i < 5; i++) {
      const a = (tau * i) / 5;
      put(
        geom.nut,
        bronze,
        [x + Math.sin(a) * r * 0.98, y + 0.16 * scale, z + Math.cos(a) * r * 0.98],
        [0.024, 0.09, 0.024],
      );
    }
    lamps.push([x, y + 0.18 * scale, z]);
  }
  // Weathering is strongest in the waterline course. These fallen pieces are outside every walking route.
  function fallenColumn(x: number, z: number, angle: number) {
    put(geom.shaft, serpentine, [x, -0.62, z], [0.39, 1.74, 0.39], [Math.PI / 2 + 0.13, 0, angle], 0.76);
    put(geom.bell, weathered, [x + 0.63, -0.47, z - 0.86], [0.48, 0.49, 0.48], [-0.76, 0.42, 0.95], 0.72);
    for (let i = 0; i < 6; i++) {
      const a = grain(i + x) * tau,
        r = 0.4 + grain(i + z) * 0.74;
      put(
        geom.ashlar,
        wet,
        [x + Math.sin(a) * r, -0.52 + grain(i) * 0.06, z + Math.cos(a) * r],
        [0.15 + grain(i + 3) * 0.29, 0.1 + grain(i + 4) * 0.21, 0.18 + grain(i + 8) * 0.21],
        [0.15, a, 0.23],
        0.66,
      );
    }
  }
  function carvedStele(x: number, z: number, base: number, w: number, h: number) {
    box(wet, x, base + 0.12, z, w * 1.18, 0.24, 0.62, 0.85);
    box(pale, x, base + 0.29, z, w * 1.09, 0.13, 0.55, 0.88);
    box(stone, x, base + 0.36 + h / 2, z, w, h, 0.47, 0.9);
    put(geom.panel, relief.material, [x, base + 0.36 + h / 2, z + 0.302], [w * 0.88, h * 0.92, 1]);
    box(serpentine, x, base + h + 0.42, z, w * 1.08, 0.13, 0.57);
    box(pale, x, base + h + 0.53, z, w * 1.19, 0.1, 0.63, 0.88);
    for (const side of [-1, 1]) box(pale, x + side * w * 0.48, base + 0.36 + h * 0.5, z + 0.055, 0.07, h, 0.43, 0.72);
  }
  function wornBorders(from: number, to: number) {
    for (const side of [-1, 1]) {
      const x = 8.5 + side * 1.32;
      box(wet, x, 0.02, (from + to) / 2, 0.168, 0.017, to - from, 0.87);
      box(bronze, x + side * 0.079, 0.031, (from + to) / 2, 0.023, 0.019, to - from, 0.83);
      for (let z = from + 0.24; z < to - 0.12; z += 0.52)
        put(geom.cube, pale, [x, 0.035, z], [0.074, 0.011, 0.074], [0, Math.PI / 4, 0], 0.66 + grain(z) * 0.2);
    }
  }
  function lintel(x: number, z: number, bottom: number, span: number) {
    box(stone, x, bottom + 0.15, z, span, 0.3, 0.73, 0.86);
    box(pale, x, bottom + 0.36, z, span + 0.21, 0.13, 0.84, 0.88);
    box(wet, x, bottom + 0.52, z, span + 0.1, 0.18, 0.76);
    for (let i = -4; i <= 4; i++) {
      const offset = i * (span / 10);
      put(geom.cube, bronze, [x + offset, bottom + 0.175, z + 0.371], [0.12, 0.13, 0.018], [0, 0, Math.PI / 4], 0.88);
    }
  }
  function reflectedHall(seal: boolean) {
    const axis = 8.5;
    const rows = seal ? [-16, -11, -6, -1, 4, 9, 14, 19] : [-16.5, -11.5, -6.5, -1.5, 3.5, 8.5, 13.5, 18.5];
    const offsets = seal ? [7.66, 12.6, 17.54] : [3.05, 7.95, 12.85, 17.75];
    for (const side of [-1, 1]) {
      for (let aisle = 0; aisle < offsets.length; aisle++) {
        const x = axis + side * offsets[aisle];
        const sprung = (seal ? 5.55 : 4.18) + (aisle === 0 ? 0 : -0.34);
        const base = seal ? 0.09 + aisle * 0.48 : -0.87;
        for (let bay = 0; bay < rows.length; bay++) {
          const z = rows[bay];
          palaceColumn(x, z, sprung, base, seal ? 0.53 : aisle === 0 ? 0.435 : 0.48, (bay + aisle) % 3 === 1);
          if (bay < rows.length - 1) vaultArch(x, z + 2.5, 2.5, sprung, true, aisle === 0);
          if (aisle < offsets.length - 1) {
            const radius = (offsets[aisle + 1] - offsets[aisle]) * 0.5;
            vaultArch(x + side * radius, z, radius, sprung, false, aisle === 0 && bay % 2 === 0);
          }
          if (aisle === 0 && bay % 2 === 1 && z < 17) capitalLamp(x - side * 0.84, z, 0.35, seal ? 1.04 : 0.9);
        }
      }
      wall(axis + side * (offsets.at(-1)! + 2.24), 0.45, 38.0, 7.2, true);
    }
    for (const z of rows.slice(0, seal ? 3 : 4)) {
      if (!seal) vaultArch(axis, z, offsets[0], 4.18, false, true);
    }
    wall(axis, -17.52, 39.6, 9.6);
    // Recessed bays are genuinely several metres deep behind the inner rows.
    for (const side of [-1, 1])
      for (const z of [-12.8, -2.8, 7.2, 17.2]) {
        const x = axis + side * (offsets.at(-1)! + 1.87);
        sideNiche(x, z, -side);
      }
  }
  function flagstones(x: number, z: number, w: number, length: number) {
    box(dark, x, -0.205, z, w, 0.39, length);
    const courses = Math.ceil(length / 0.63),
      long = length / courses;
    const cols = Math.max(1, Math.round(w / 1.03)),
      tile = w / cols;
    for (let row = 0; row < courses; row++)
      for (let col = 0; col <= cols; col++) {
        const lo = Math.max(0, (col - (row % 2) * 0.5) * tile),
          hi = Math.min(w, (col + 1 - (row % 2) * 0.5) * tile);
        if (hi - lo < 0.1) continue;
        const seed = grain(row * 19 + col * 317 + x * 131 + z);
        box(
          floor,
          x - w / 2 + (lo + hi) * 0.5,
          -0.021,
          z - length / 2 + (row + 0.5) * long,
          hi - lo - 0.016,
          0.067,
          long - 0.017,
          0.78 + seed * 0.21,
        );
      }
  }
  function brassBand(x: number, z: number, w: number) {
    box(bronze, x, 0.021, z, w, 0.019, 0.055);
    for (let offset = -w / 2 + 0.13; offset < w / 2; offset += 0.3)
      put(geom.nut, iron, [x + offset, 0.036, z], [0.023, 0.014, 0.023]);
  }
  const customGeometry: BufferGeometry[] = [];
  function basinSurround() {
    const points: number[] = [],
      uv: number[] = [],
      tints: number[] = [];
    const lower = new Color(0x82928e),
      upper = new Color(0xc3bba0);
    const shade = new Color();
    const angleCount = 72,
      cx = 8.5,
      cz = 6.5,
      rim = 6.28;
    function point(i: number, ring: number) {
      const a = (i * tau) / angleCount,
        dx = Math.sin(a),
        dz = Math.cos(a);
      const wall = Math.min(
        7.97 / Math.max(0.001, Math.abs(dx)),
        (dz < 0 ? 7.28 : 13.3) / Math.max(0.001, Math.abs(dz)),
      );
      const r = rim + ((wall - rim) * ring) / 4;
      return [cx + dx * r, -0.82, cz + dz * r];
    }
    function vertex(p: number[]) {
      points.push(...p);
      uv.push(p[0] * 0.55, p[2] * 0.55);
      tints.push(shade.r, shade.g, shade.b);
    }
    for (let row = 0; row < 4; row++)
      for (let i = 0; i < angleCount; i++) {
        const a = point(i, row),
          b = point(i + 1, row),
          c = point(i + 1, row + 1),
          d = point(i, row + 1);
        const mx = (a[0] + b[0] + c[0] + d[0]) * 0.25,
          mz = (a[2] + b[2] + c[2] + d[2]) * 0.25;
        for (const v of [a, b, c, d]) {
          v[0] += (mx - v[0]) * 0.022;
          v[2] += (mz - v[2]) * 0.022;
        }
        shade.copy(lower).lerp(upper, 0.26 + grain(i * 19 + row * 47) * 0.48);
        for (const v of [a, c, b, a, d, c]) vertex(v);
      }
    const paving = new BufferGeometry();
    paving.setAttribute('position', new Float32BufferAttribute(points, 3));
    paving.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    paving.setAttribute('color', new Float32BufferAttribute(tints, 3));
    paving.computeVertexNormals();
    const pavingFinish = new MeshStandardMaterial({
      color: 0x697a79,
      map: grainMap,
      vertexColors: true,
      roughness: 0.72,
      metalness: 0.1,
      side: DoubleSide,
    });
    const pavingMesh = new Mesh(paving, pavingFinish);
    pavingMesh.receiveShadow = true;
    group.add(pavingMesh);
    customGeometry.push(paving);
    return pavingFinish;
  }
  let surround: MeshStandardMaterial | undefined;
  const lamps: Point[] = [];
  const puddles: { x: number; z: number; w: number; d: number; angle: number }[] = [];
  if (room === 'sluice') {
    reflectedHall(false);
    carvedStele(4.74, 0.65, -0.53, 1.45, 2.02);
    carvedStele(12.26, 0.65, -0.53, 1.45, 2.02);
    wornBorders(3.15, 17.88);
    box(dark, 8.5, -2.78, -1.95, 3.41, 0.19, 10.2, 0.66);
    fallenColumn(1.7, 9.57, -0.43);
    fallenColumn(15.05, 3.7, 0.32);
    for (const x of [5.43, 11.57]) capitalLamp(x, -6.51, 1.08, 1.25);
    lintel(8.5, -11.5, 7.61, 7.5);
    for (const side of [-1, 1]) {
      const x = 8.5 + side * 4.07;
      box(wet, x, 0.29, -9.45, 0.91, 2.13, 1.2);
      box(pale, x, 1.38, -9.45, 1.16, 0.12, 1.34);
    }
    for (const side of [-1, 1]) {
      flagstones(8.5 + side * 5, 10.5, 1, 11);
      for (const z of [6.5, 12.5]) {
        const crossing = 8.5 + side * 3;
        flagstones(crossing, z, 3, 1);
        brassBand(crossing, z - 0.38, 3);
        brassBand(crossing, z + 0.38, 3);
        for (let k = -5; k <= 5; k++) box(iron, crossing + k * 0.24, 0.024, z, 0.028, 0.025, 0.56);
      }
      for (const [a, b] of [
        [5.1, 5.9],
        [7.12, 11.88],
        [13.1, 15.9],
      ])
        rail(8.5 + side * 1.48, a, b);
    }
    for (let n = 0; n < 4; n++) box(wet, 8.5, -0.11 - n * 0.145, 18.1 + n * 0.27, 3.1, 0.26, 0.3);
    flagstones(8.5, 10.5, 3, 15);
    // A sunken processional passage recedes under several archivolts beyond the traversable landing.
    for (let n = 0; n < 17; n++) {
      const z = 3.13 - n * 0.4,
        h = -0.055 - n * 0.106;
      box(n % 4 === 0 ? wet : stone, 8.5, h - 0.085, z, 3.02, 0.17, 0.413, 0.94);
      box(pale, 8.5, h, z + 0.15, 2.97, 0.035, 0.055, 0.8);
    }
    for (const side of [-1, 1]) {
      const x = 8.5 + side * 1.85;
      for (let tier = 0; tier < 4; tier++) {
        box(wet, x + side * tier * 0.36, -0.18 + tier * 0.14, 0.23, 0.4, 0.5, 6.2, 0.82);
        box(pale, x + side * tier * 0.36, 0.1 + tier * 0.14, 0.23, 0.45, 0.071, 6.2, 0.72);
      }
    }
    for (const z of [1.64, -2.67, -6.95]) {
      for (const side of [-1, 1]) palaceColumn(8.5 + side * 1.85, z, 2.9, -0.41, 0.34);
      vaultArch(8.5, z, 1.85, 2.9, false, true);
    }
    for (const side of [-1, 1])
      for (const depth of [0, 1, 2]) {
        const z = 1.2 - depth * 2.44,
          h = -0.45 - depth * 0.63,
          x = 8.5 + side * 1.35;
        box(wet, x, h + 0.06, z, 0.28, 0.46, 0.34, 0.79);
        capitalLamp(x, z, h + 0.39, 0.65);
      }
    box(stone, 8.5, -1.91, -6.23, 3.0, 0.25, 5.58, 0.83);
    for (const side of [-1, 1]) {
      box(wet, 8.5 + side * 1.62, -1.24, -4.9, 0.31, 1.26, 7.96, 0.91);
      box(pale, 8.5 + side * 1.62, -0.58, -4.9, 0.39, 0.1, 7.96, 0.81);
    }
    capitalLamp(6.66, 3.27, 0.31);
    capitalLamp(10.34, 3.27, 0.31);
    for (const [x, z, w, d, a] of [
      [8.1, 15.4, 1.09, 0.41, 0.26],
      [9, 13.8, 0.7, 0.27, -0.6],
      [7.55, 11.2, 0.45, 1.1, 0.13],
      [8.63, 8.1, 1.03, 0.34, -0.18],
      [6.42, 6.45, 0.52, 0.26, 0.2],
      [8.92, 4.72, 0.53, 0.46, 0.4],
      [13.46, 8.6, 0.31, 0.71, 0.08],
      [3.47, 12.4, 0.32, 0.46, 0.15],
    ])
      puddles.push({ x, z, w, d, angle: a });
  } else {
    reflectedHall(true);
    carvedStele(3.44, -3.26, 0.55, 1.71, 2.42);
    carvedStele(13.56, -3.26, 0.55, 1.71, 2.42);
    wornBorders(11.05, 17.88);
    fallenColumn(-1.36, 6.9, 0.7);
    lintel(8.5, -4.84, 9.17, 8.08);
    for (const side of [-1, 1]) {
      const px = 8.5 + side * 2.64;
      box(wet, px, 1.86, -4.89, 0.92, 1.22, 0.88);
      box(pale, px, 2.48, -4.89, 1.06, 0.16, 0.98);
      put(geom.ashlar, weathered, [px - side * 0.105, 2.76, -4.9], [0.42, 0.81, 0.59], [0, 0, side * 0.25], 0.93);
      cyl(bronze, px - side * 0.18, 3.12, -4.8, 0.19, 0.32, [Math.PI / 2, 0, 0]);
    }
    // Stepwell terraces rise from the deep seal basin to galleries above, with narrow dry landings between flights.
    for (const side of [-1, 1])
      for (let n = 0; n < 7; n++) {
        const x = 8.5 + side * (6.64 + n * 0.53),
          h = -0.62 + n * 0.28;
        for (const [z, d] of [
          [2.3, 6.4],
          [9.1, 6.9],
          [15.7, 5.9],
        ] as const) {
          box(n % 3 === 0 ? stone : wet, x, (h - 1.46) * 0.5, z, 0.63, h + 1.46, d, 0.86);
          box(pale, x, h + 0.013, z, 0.65, 0.058, d, 0.78);
        }
      }
    for (let n = 0; n < 9; n++) {
      const z = -0.06 - 0.49 * n,
        h = -0.59 + n * 0.24;
      for (const side of [-1, 1]) {
        const w = 5.73 + n * 0.075,
          x = 8.5 + side * (w / 2 + 0.13);
        box(n % 3 === 0 ? stone : weathered, x, (h - 1.46) * 0.5, z, w, h + 1.46, 0.54, 0.87);
        box(pale, x, h + 0.02, z + 0.13, w, 0.075, 0.22, 0.8);
      }
      box(patina, 8.5, h - 0.16, z, 0.22, 0.21, 0.57);
      if (n === 2 || n === 6)
        for (let badge = -6; badge <= 6; badge++) {
          if (!badge) continue;
          put(
            geom.cube,
            bronze,
            [8.5 + badge * 0.72, h - 0.095, z + 0.273],
            [0.083, 0.083, 0.016],
            [0, 0, Math.PI / 4],
            0.83,
          );
        }
    }
    box(wet, 8.5, 1.06, -5.35, 13.9, 0.61, 2.85, 0.82);
    for (const x of [5.14, 11.86]) {
      palaceColumn(x, -4.82, 5.42, 1.25, 0.65);
      palaceColumn(x, -7.94, 5.42, 0.37, 0.56, true);
      capitalLamp(x, -3.89, 1.9, 1.2);
    }
    vaultArch(8.5, -4.82, 3.36, 5.42, false, true);
    vaultArch(8.5, -7.94, 3.36, 5.42, false, true);
    // The opening behind the calendar continues through two more bays into a dark sanctuary.
    for (const z of [-10.8, -14.0]) {
      for (const x of [6.21, 10.79]) palaceColumn(x, z, 3.19, -0.28, 0.4, true);
      vaultArch(8.5, z, 2.29, 3.19, false, true);
    }
    surround = basinSurround();
    box(dark, 8.5, -2.17, 9.2, 16.0, 0.4, 20.4);
    const cx = 8.5,
      cz = 6.5;
    // Concentric, segmented courses retain the water below the observation walk.
    const count = 48;
    for (let level = 0; level < 3; level++)
      for (let i = 0; i < count; i++) {
        const a = ((i + (level % 2) * 0.5) * tau) / count,
          radius = 6.11;
        const x = cx + Math.sin(a) * radius,
          z = cz + Math.cos(a) * radius;
        put(
          geom.cube,
          level === 2 ? pale : wet,
          [x, -1.75 + level * 0.4, z],
          [0.81, 0.393, level === 2 ? 0.53 : 0.45],
          [0, a, 0],
          0.75 + grain(i + level * 23) * 0.2,
        );
      }
    const sealBand = new TorusGeometry(4.44, 0.032, 8, 112);
    sealBand.rotateX(-Math.PI / 2);
    const suspended = new Mesh(sealBand, patina);
    suspended.position.set(cx, -0.29, cz);
    group.add(suspended);
    customGeometry.push(sealBand);
    for (let i = 0; i < 48; i++) {
      const a = (i * tau) / 48;
      put(
        geom.cube,
        i % 4 ? bronze : sealLight,
        [cx + Math.sin(a) * 4.44, -0.275, cz + Math.cos(a) * 4.44],
        [i % 4 ? 0.05 : 0.09, 0.033, i % 4 ? 0.08 : 0.16],
        [0, a, 0],
      );
    }
    for (const a of [-2.32, 2.32, -1.04, 1.04]) {
      const x = cx + Math.sin(a) * 5.85,
        z = cz + Math.cos(a) * 5.85;
      cyl(wet, x, -0.74, z, 0.62, 1.6);
      cyl(pale, x, 0.1, z, 0.55, 0.13);
      put(geom.shaft, serpentine, [x, 0.17, z], [0.35, 0.94, 0.35], [0, a * 0.5, 0]);
      cyl(bronze, x, 0.23, z, 0.385, 0.08);
      put(geom.bell, pale, [x, 1.07, z], [0.37, 0.34, 0.37], [0, a, 0]);
      box(wet, x, 1.44, z, 0.77, 0.099, 0.75);
      cyl(patina, x, 1.56, z, 0.22, 0.18);
      put(geom.torus, bronze, [x, 1.83, z], [0.238, 0.238, 0.33], [0, a * 0.65, 0]);
      cyl(sealLight, x, 1.59, z, 0.226, 0.056);
      for (let j = 0; j < 3; j++) box(bronze, x, 0.47 + j * 0.15, z + 0.325, 0.07, 0.044, 0.024);
      const tailX = cx + Math.sin(a) * 4.44,
        tailZ = cz + Math.cos(a) * 4.44;
      cyl(bronze, tailX, -0.28, tailZ, 0.14, 0.09);
      cyl(iron, tailX, -0.223, tailZ, 0.062, 0.028);
      beam(bronze, [x, 0.97, z], [tailX, -0.29, tailZ], 0.046, 0.046);
      for (let j = 0; j < 8; j++) {
        const t = j / 7;
        put(
          geom.torus,
          iron,
          [x + (tailX - x) * t, 1.05 - 1.3 * t - 0.13 * Math.sin(Math.PI * t), z + (tailZ - z) * t],
          [0.1, 0.13, 0.1],
          [(t * Math.PI) / 2, a + ((j % 2) * Math.PI) / 2, 0.5],
        );
      }
    }
    flagstones(8.5, 17, 9, 4);
    flagstones(8.5, 13, 3, 4);
    for (const x of [7.04, 9.96]) rail(x, 11.06, 14.94);
    for (const z of [11.21, 14.8, 17.72]) brassBand(8.5, z, 2.85);
    for (const x of [6.19, 10.81]) {
      cyl(wet, x, 0.3, 15.29, 0.39, 0.61);
      cyl(bronze, x, 0.66, 15.29, 0.34, 0.12);
      capitalLamp(x, 15.29, 0.89, 0.79);
    }
    for (const [x, z, w, d, a] of [
      [5.8, 16.5, 0.98, 0.48, 0.41],
      [11.0, 17.6, 1.04, 0.36, -0.37],
      [8.25, 13.91, 0.86, 0.31, 0.21],
      [8.98, 12.4, 0.43, 0.65, -0.24],
    ])
      puddles.push({ x, z, w, d, angle: a });
  }
  const dial = createTideDial(room);
  group.add(dial.group);
  // Pale light transmitted through the water outside the grates catches suspended mist.
  const shafts: number[] = [],
    coordinates: number[] = [];
  for (const [x, y, z] of windows) {
    const side = x < 8.5 ? 1 : -1;
    for (let i = 0; i < 4; i++) {
      const dz = (i - 1.5) * 0.22,
        width = 0.08 + 0.023 * (i % 2);
      const a = [x, y + 0.31, z + dz - width],
        b = [x, y + 0.31, z + dz + width];
      const c = [x + side * 3.15, -0.48, z + dz + 0.89 + width * 2],
        d = [x + side * 3.15, -0.48, z + dz + 0.89 - width * 2];
      shafts.push(...a, ...b, ...d, ...b, ...c, ...d);
      coordinates.push(0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1);
    }
  }
  const shaftGeometry = new BufferGeometry();
  shaftGeometry.setAttribute('position', new Float32BufferAttribute(shafts, 3));
  shaftGeometry.setAttribute('uv', new Float32BufferAttribute(coordinates, 2));
  const shaftMaterial = new ShaderMaterial({
    depthWrite: false,
    transparent: true,
    blending: AdditiveBlending,
    side: DoubleSide,
    vertexShader: `varying vec2 rayUV;void main(){rayUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 rayUV;void main(){float soft=sin(rayUV.x*3.141593)*pow(1.-rayUV.y,1.45);
      gl_FragColor=vec4(.27,.47,.46,.075*soft);
      #include <colorspace_fragment>
    }`,
  });
  const mist = new Mesh(shaftGeometry, shaftMaterial);
  mist.renderOrder = 4;
  group.add(mist);
  for (const [shape, mats] of sets)
    for (const [mat, instances] of mats) {
      const mesh = new InstancedMesh(shape, mat, instances.length);
      instances.forEach(({ matrix, shade }, i) => {
        mesh.setMatrixAt(i, matrix);
        mesh.setColorAt(i, new Color(shade, shade, shade));
      });
      mesh.receiveShadow = true;
      mesh.castShadow = mat !== glass && mat !== sealLight;
      group.add(mesh);
    }
  // Fade only near-camera masonry that would screen the traveler on the narrow galleries.
  // The same architecture remains solid in the distance and keeps casting its normal shadows.
  const walker = { value: new Vector3() };
  for (const finish of [stone, pale, wet, weathered, serpentine, bronze, patina]) {
    finish.onBeforeCompile = shader => {
      shader.uniforms.palaceWalker = walker;
      shader.vertexShader =
        'varying vec3 palaceWorld;\n' +
        shader.vertexShader.replace(
          '#include <project_vertex>',
          `
        #include <project_vertex>
        #ifdef USE_INSTANCING
          palaceWorld=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;
        #else
          palaceWorld=(modelMatrix*vec4(transformed,1.)).xyz;
        #endif
      `,
        );
      shader.fragmentShader =
        'uniform vec3 palaceWalker;varying vec3 palaceWorld;\n' +
        shader.fragmentShader.replace(
          '#include <clipping_planes_fragment>',
          `
        #include <clipping_planes_fragment>
        vec3 eye=cameraPosition-palaceWalker;
        float depth=dot(palaceWorld-palaceWalker,eye)/max(.01,dot(eye,eye));
        float width=mix(.81,2.15,clamp(depth,0.,1.));
        vec3 nearRay=palaceWalker+eye*clamp(depth,0.,1.);
        float radial=length((palaceWorld-nearRay)*vec3(1.,.59,.70));
        float cut=(1.-smoothstep(width,width+.42,radial))*smoothstep(.022,.109,depth);
        cut=max(cut,1.-smoothstep(1.35,2.58,distance(palaceWorld,cameraPosition)));
        cut*=smoothstep(.09,.55,palaceWorld.y)*step(0.,cameraPosition.y);
        if(cut>fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715)))))discard;
      `,
        );
    };
  }
  return {
    group,
    lamps,
    puddles,
    update(resonance: number, time: number, x: number, z: number) {
      walker.value.set(x, 0.91, z);
      dial.update(resonance, time);
      sealLight.color.setRGB(0.11 + 0.18 * resonance, 0.22 + 0.26 * resonance, 0.18 + 0.22 * resonance);
    },
    dispose() {
      for (const shape of Object.values(geom)) shape.dispose();
      for (const m of [
        stone,
        wet,
        pale,
        floor,
        iron,
        bronze,
        patina,
        dark,
        glass,
        sealLight,
        seaGlass,
        shaftMaterial,
        serpentine,
        weathered,
      ])
        m.dispose();
      group.traverse(o => {
        if (o instanceof InstancedMesh) o.dispose();
      });
      relief.dispose();
      dial.dispose();
      grainMap.dispose();
      shaftGeometry.dispose();
      for (const g of customGeometry) g.dispose();
      surround?.dispose();
    },
  };
}
