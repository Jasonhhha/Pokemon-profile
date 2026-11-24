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
  const stone = new MeshStandardMaterial({ color: 0xb0bcad, map: grainMap, roughness: 0.85, side: DoubleSide });
  const wet = new MeshStandardMaterial({
    color: 0x546e71,
    map: grainMap,
    roughness: 0.29,
    metalness: 0.19,
    side: DoubleSide,
  });
  const pale = new MeshStandardMaterial({ color: 0xb9bb9d, map: grainMap, roughness: 0.69, side: DoubleSide });
  const floor = new MeshStandardMaterial({ color: 0x93a39d, map: grainMap, roughness: 0.55, metalness: 0.11 });
  const iron = new MeshStandardMaterial({ color: 0x384c52, roughness: 0.52, metalness: 0.39 });
  const bronze = new MeshStandardMaterial({ color: 0xb18a51, roughness: 0.48, metalness: 0.43 });
  const patina = new MeshStandardMaterial({ color: 0x528178, map: grainMap, roughness: 0.5, metalness: 0.28 });
  const dark = new MeshStandardMaterial({ color: 0x26393f, roughness: 0.88 });
  const glass = new MeshBasicMaterial({ color: 0xffd89b });
  const sealLight = new MeshBasicMaterial({ color: 0x88f3eb });
  const seaGlass = new MeshBasicMaterial({ color: 0x738f8d });
  const windows: Point[] = [];
  const geom = {
    cube: new BoxGeometry(),
    ashlar: new RoundedBoxGeometry(1, 1, 1, 1, 0.033),
    column: new CylinderGeometry(1, 1, 1, 16),
    nut: new CylinderGeometry(1, 1, 1, 6),
    torus: new TorusGeometry(1, 0.072, 6, 32),
    wideArch: voussoir(1.61, 1.99, Math.PI / 13 - 0.014, 0.52),
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
    list.push({ matrix: placer.matrix.clone(), shade });
  }
  function box(m: Material, x: number, y: number, z: number, w: number, h: number, d: number, shade = 1) {
    const shape = (m === stone || m === pale || m === wet || m === floor) && h > 0.065 ? geom.ashlar : geom.cube;
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
  function pier(x: number, z: number, h: number) {
    box(wet, x, 0.18, z, 0.88, 0.37, 0.85);
    box(pale, x, 0.4, z, 0.78, 0.11, 0.76);
    for (let i = 0; i < 6; i++)
      box(
        stone,
        x,
        0.52 + ((i + 0.5) * (h - 0.72)) / 6,
        z,
        0.66,
        (h - 0.72) / 6 - 0.022,
        0.68,
        0.76 + grain(i + z + x) * 0.17,
      );
    box(pale, x, h - 0.12, z, 0.85, 0.17, 0.8);
    box(wet, x, h + 0.005, z, 0.91, 0.092, 0.88);
  }
  function doorway(z: number, x = 8.5, threshold = true) {
    for (const offset of [-1, 1]) {
      pier(x + offset * 1.82, z, 1.85);
      box(dark, x + offset * 1.95, 1, z + 0.04, 0.21, 1.9, 0.54);
    }
    for (let i = 0; i < 13; i++) {
      const turn = -Math.PI / 2 + ((i + 0.5) * Math.PI) / 13;
      put(
        geom.wideArch,
        i === 6 ? pale : stone,
        [x, 1.85, z],
        [1, i === 6 ? 1.037 : 1, 1],
        [0, 0, turn],
        0.8 + 0.19 * grain(i + z),
      );
    }
    if (threshold) box(dark, x, 0.03, z - 0.3, 3.12, 0.12, 0.67);
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
      box(iron, x, 0.3, z, 0.075, 0.64, 0.075);
      cyl(bronze, x, 0.62, z, 0.064, 0.055);
      box(patina, x, 0.036, z, 0.145, 0.07, 0.14);
    }
    box(bronze, x, 0.63, (z1 + z2) / 2, 0.065, 0.06, z2 - z1 + 0.06);
    box(iron, x, 0.37, (z1 + z2) / 2, 0.042, 0.041, z2 - z1);
  }
  function lamp(x: number, z: number, y = 2.37) {
    cyl(bronze, x, y - 0.26, z, 0.145, 0.09);
    cyl(glass, x, y, z, 0.127, 0.43);
    for (const a of [0, Math.PI / 2, Math.PI, 1.5 * Math.PI])
      box(iron, x + Math.cos(a) * 0.127, y, z + Math.sin(a) * 0.127, 0.026, 0.46, 0.026);
    cyl(iron, x, y + 0.252, z, 0.176, 0.084);
    cyl(bronze, x, y + 0.32, z, 0.09, 0.055);
    for (const offset of [-0.12, 0.12]) cyl(bronze, x, y + offset, z, 0.134, 0.018);
  }
  function pressureValve(x: number, z: number, side: number) {
    const y = 1.25;
    box(iron, x - side * 0.16, 0.66, z - 0.17, 0.39, 1.15, 0.43);
    cyl(patina, x, y, z - 0.08, 0.26, 0.43, [Math.PI / 2, 0, 0]);
    cyl(bronze, x, y, z + 0.19, 0.13, 0.21, [Math.PI / 2, 0, 0]);
    put(geom.torus, bronze, [x, y, z + 0.34], [0.39, 0.39, 0.66]);
    for (let i = 0; i < 5; i++) {
      const a = (i * tau) / 5;
      beam(patina, [x, y, z + 0.34], [x + Math.sin(a) * 0.35, y + Math.cos(a) * 0.35, z + 0.34], 0.037, 0.044);
    }
    cyl(iron, x, y, z + 0.365, 0.085, 0.12, [Math.PI / 2, 0, 0]);
    const gx = x - side * 0.27,
      gy = y + 0.54;
    cyl(iron, gx, gy, z + 0.06, 0.22, 0.14, [Math.PI / 2, 0, 0]);
    cyl(pale, gx, gy, z + 0.14, 0.173, 0.035, [Math.PI / 2, 0, 0]);
    for (let i = -2; i <= 2; i++) {
      const a = i * 0.58;
      put(
        geom.cube,
        iron,
        [gx + Math.sin(a) * 0.139, gy + Math.cos(a) * 0.139, z + 0.161],
        [0.012, 0.04, 0.007],
        [0, 0, -a],
      );
    }
    beam(iron, [gx, gy, z + 0.171], [gx + 0.082, gy + 0.085, z + 0.171], 0.016, 0.016);
    cyl(bronze, gx, gy, z + 0.182, 0.025, 0.017, [Math.PI / 2, 0, 0]);
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
  function ring(x: number, y: number, z: number, r: number, material: Material, tube = 0.035) {
    put(geom.torus, material, [x, y, z], [r, r, tube / 0.072], [-Math.PI / 2, 0, 0]);
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
    wall(8.5, 1.53, 14.8, 5.9);
    for (const side of [-1, 1]) {
      const x = 8.5 + side * 6.77;
      wall(x, 9.55, 15.7, 5.62, true);
      for (const z of [4.2, 8.6, 13.2, 16.7]) {
        pier(x - side * 0.34, z, 4.91);
        sideNiche(x - side * 0.3, z - 1.14, -side);
        lamp(x - side * 0.81, z, 2.36);
        lamps.push([x - side * 0.95, 2.36, z]);
      }
      const pipeX = x - side * 0.65;
      for (const y of [0.94, 3.22]) {
        const r = y > 2 ? 0.145 : 0.23;
        cyl(patina, pipeX, y, 9.7, r, 15.0, [Math.PI / 2, 0, 0]);
        for (let z = 2.5; z < 17.1; z += 1.78) {
          cyl(bronze, pipeX, y, z, r * 1.23, 0.076, [Math.PI / 2, 0, 0]);
          box(iron, x - side * 0.37, y, z, 0.6, r * 0.72, 0.12);
        }
      }
      for (const z of [7.1, 13.24]) {
        const valveX = x - side * 1.06;
        pressureValve(valveX, z, side);
        cyl(patina, (pipeX + valveX) / 2, 1.04, z, 0.12, Math.abs(pipeX - valveX), [0, 0, Math.PI / 2]);
      }
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
      for (const z of [5.25, 9.4, 14.3]) {
        const px = 8.5 + side * 3.17;
        box(wet, px, -0.92, z, 0.72, 1.78, 0.76);
        cyl(iron, px, -0.03, z, 0.33, 0.17);
        cyl(bronze, px, 0.097, z, 0.211, 0.1);
      }
    }
    for (const x of [4.42, 12.58]) doorway(7.57, x, false);
    for (let n = 0; n < 4; n++) box(wet, 8.5, -0.11 - n * 0.145, 18.1 + n * 0.27, 3.1, 0.26, 0.3);
    flagstones(8.5, 10.5, 3, 15);
    doorway(2.96);
    box(dark, 8.5, 1.37, 2.66, 2.96, 2.79, 0.12);
    for (let i = 0; i < 7; i++) box(i % 2 ? wet : iron, 8.5, 0.255 - i * 0.054, 3.18 + i * 0.159, 2.83, 0.15, 0.17);
    for (const x of [6.37, 10.63]) {
      box(iron, x, 1.53, 2.94, 0.24, 2.72, 0.25);
      cyl(bronze, x, 2.96, 2.94, 0.19, 0.14);
      lamp(x, 3.11, 1.67);
    }
    // Slender transverse girders leave the centre of the playable aisle visible.
    for (const z of [4.3, 9.0, 14.0]) {
      for (const s of [-1, 1]) {
        const x = 8.5 + s * 6.1;
        beam(iron, [x, 4.28, z], [x - s * 2.6, 5.0, z], 0.17, 0.25);
        beam(patina, [x, 3.61, z], [x - s * 1.75, 4.76, z], 0.09, 0.14);
        box(bronze, x - s * 1.55, 4.73, z, 0.25, 0.28, 0.29);
      }
    }
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
    wall(8.5, -0.85, 16.8, 7.1);
    for (const side of [-1, 1]) {
      const x = 8.5 + side * 8;
      wall(x, 8.65, 18.8, 6.44, true);
      for (const z of [2.1, 6.5, 10.8, 15.0]) {
        pier(x - side * 0.4, z, 5.75);
        sideNiche(x - side * 0.32, z + 1.28, -side);
        lamp(x - side * 0.85, z, 3.12);
        lamps.push([x - side * 0.85, 3.12, z]);
      }
      for (const offset of [2.4, 5.2]) {
        const bx = 8.5 + side * offset;
        pier(bx, -0.5, 5.6);
        lamp(bx, 0.05, 3.02);
      }
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
      cyl(iron, x, 0.68, z, 0.33, 1.11);
      for (const h of [0.22, 1.15]) cyl(bronze, x, h, z, 0.39, 0.11);
      cyl(patina, x, 1.44, z, 0.28, 0.45);
      cyl(sealLight, x, 1.49, z, 0.288, 0.118);
      cyl(bronze, x, 1.69, z, 0.36, 0.12);
      ring(x, 1.77, z, 0.22, sealLight);
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
      lamp(x, 15.29, 1.02);
    }
    for (const [x, z, w, d, a] of [
      [5.8, 16.5, 0.98, 0.48, 0.41],
      [11.0, 17.6, 1.04, 0.36, -0.37],
      [8.25, 13.91, 0.86, 0.31, 0.21],
      [8.98, 12.4, 0.43, 0.65, -0.24],
    ])
      puddles.push({ x, z, w, d, angle: a });
    // The sealed flood door at the back reads across the chamber.
    cyl(iron, 8.5, 3.05, -0.47, 2.75, 0.23, [Math.PI / 2, 0, 0]);
    for (const [radius, m] of [
      [2.57, bronze],
      [2.26, patina],
      [1.42, iron],
    ] as const) {
      put(geom.torus, m, [8.5, 3.05, -0.28], [radius, radius, 0.74]);
    }
    cyl(patina, 8.5, 3.05, -0.21, 1.12, 0.16, [Math.PI / 2, 0, 0]);
    put(geom.torus, bronze, [8.5, 3.05, -0.08], [0.89, 0.89, 0.85]);
    cyl(wet, 8.5, 3.05, -0.092, 0.68, 0.15, [Math.PI / 2, 0, 0]);
    cyl(patina, 8.5, 3.05, 0.055, 0.37, 0.15, [Math.PI / 2, 0, 0]);
    cyl(bronze, 8.5, 3.05, 0.146, 0.149, 0.1, [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 6; i++) {
      const a = (i * tau) / 6;
      const dx = Math.sin(a),
        dy = Math.cos(a);
      beam(
        bronze,
        [8.5 + dx * 0.46, 3.05 + dy * 0.46, -0.009],
        [8.5 + dx * 0.79, 3.05 + dy * 0.79, -0.009],
        0.097,
        0.15,
      );
      put(geom.cube, pale, [8.5 + dx * 1.34, 3.05 + dy * 1.34, -0.054], [0.14, 0.25, 0.1], [0, 0, -a], 0.78);
    }
    for (let i = 0; i < 12; i++) {
      const a = (i * tau) / 12;
      put(
        geom.nut,
        bronze,
        [8.5 + Math.sin(a) * 2.4, 3.05 + Math.cos(a) * 2.4, -0.24],
        [0.075, 0.069, 0.075],
        [Math.PI / 2, 0, 0],
      );
      put(
        geom.cube,
        patina,
        [8.5 + Math.sin(a) * 1.87, 3.05 + Math.cos(a) * 1.87, -0.25],
        [0.095, 0.65, 0.1],
        [0, 0, -a],
      );
    }
  }
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
  return {
    group,
    lamps,
    puddles,
    dispose() {
      for (const shape of Object.values(geom)) shape.dispose();
      for (const m of [stone, wet, pale, floor, iron, bronze, patina, dark, glass, sealLight, seaGlass, shaftMaterial])
        m.dispose();
      group.traverse(o => {
        if (o instanceof InstancedMesh) o.dispose();
      });
      grainMap.dispose();
      shaftGeometry.dispose();
      for (const g of customGeometry) g.dispose();
      surround?.dispose();
    },
  };
}
