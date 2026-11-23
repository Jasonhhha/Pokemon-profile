import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { FieldArea, Prop } from './field-layout';

type XYZ = [x: number, y: number, z: number];
type Paint = THREE.MeshStandardMaterial;
type ScenePart = THREE.Mesh<THREE.BufferGeometry, Paint>;
type Finish = 'limestone' | 'plaster' | 'timber' | 'ceramic' | 'enamel';

const material = (color: number, roughness = .84, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

const stone = material(0xe4cda3);
const sandstone = material(0xb5a282);
const masonry = [material(0xceb897), material(0xdac7a6), material(0xbcaa8d)];
const plaster = material(0xf0d9b2);
const slate = material(0x596b71);
const blue = material(0x356670);
const deepBlue = material(0x32474a);
const glass = material(0x75a6a5, .34, .08);
const skyGlass = material(0xadc8b8, .32, .04);
const darkGlass = material(0x4f6b79, .39, .10);
const agedGold = material(0xb78b53, .52, .30);
const paleGold = material(0xe8c684, .48, .16);
const bronze = material(0x635d4c, .55, .21);
const iron = material(0x445553, .52, .22);
const wood = material(0x8f654b);
const darkWood = material(0x584a3a);
const paleWood = material(0xbe9268);
const red = material(0xb95c4b);
const teal = material(0x5b8a81, .66, .10);
const yellowLamp = new THREE.MeshStandardMaterial({
  color: 0xffd685, emissive: 0xfba35a, emissiveIntensity: .37, roughness: .52,
});
const glazedRoof = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .73, metalness: .05, side: THREE.DoubleSide });

const projectedFinish = new Map<Paint, { kind: Finish; density: number }>();
for (const paint of [stone, sandstone, ...masonry]) projectedFinish.set(paint, { kind: 'limestone', density: 1.52 });
projectedFinish.set(plaster, { kind: 'plaster', density: 1.1 });
for (const paint of [wood, darkWood, paleWood]) projectedFinish.set(paint, { kind: 'timber', density: 1.18 });
for (const paint of [blue, deepBlue, teal]) projectedFinish.set(paint, { kind: 'enamel', density: 1.24 });
projectedFinish.set(glazedRoof, { kind: 'ceramic', density: 1.55 });
const finishes = new Map<Finish, THREE.CanvasTexture>();

function grainAt(x: number, y: number) {
  const value = Math.imul(x + 213, 7109891) ^ Math.imul(y + 31, 2156123);
  return ((Math.imul(value ^ (value >>> 11), 513481) >>> 0) % 4096) / 4096;
}

function finishMap(kind: Finish) {
  const cached = finishes.get(kind);
  if (cached) return cached;
  const image = document.createElement('canvas');
  const size = 128;
  image.width = image.height = size;
  const ctx = image.getContext('2d')!;
  const pixels = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const angle = x / size * 2 * Math.PI;
    const vertical = y / size * 2 * Math.PI;
    const fleck = grainAt(x, y) - .5;
    const cloud = Math.sin(angle * 2 + vertical * 3) + .5 * Math.cos(angle * 5 - vertical * 2);
    let texture: number;
    if (kind === 'timber') {
      const rings = Math.sin(vertical * 26 + Math.sin(angle * 2) * 1.8 + Math.sin(angle * 4 - vertical) * .42);
      texture = 239 + rings * 7 + 4.3 * cloud + fleck * 8;
    } else if (kind === 'limestone') {
      texture = 242 + cloud * 7 + fleck * 14 - (fleck < -.475 ? 12 : 0);
    } else if (kind === 'plaster') {
      texture = 247 + cloud * 3.1 + fleck * 11;
    } else if (kind === 'ceramic') {
      texture = 245 + 3.5 * Math.sin(angle * 10 + vertical * 2) + cloud * 4 + fleck * 10;
    } else {
      texture = 245 + cloud * 3.8 + fleck * 5;
    }
    const i = (y * size + x) * 4;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = texture;
    pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const map = new THREE.CanvasTexture(image);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 3;
  finishes.set(kind, map);
  return map;
}

function projectFinish(geometry: THREE.BufferGeometry, paint: Paint) {
  const finish = projectedFinish.get(paint);
  if (!finish || typeof document === 'undefined') {
    geometry.deleteAttribute('uv');
    return;
  }
  const points = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const uv = new Float32Array(points.count * 2);
  for (let i = 0; i < points.count; i++) {
    const [x, y, z] = [Math.abs(normals.getX(i)), Math.abs(normals.getY(i)), Math.abs(normals.getZ(i))];
    const top = y >= x && y >= z;
    const u = top || z >= x ? points.getX(i) : points.getZ(i);
    const v = top ? points.getZ(i) : points.getY(i);
    uv[i * 2] = u * finish.density;
    uv[i * 2 + 1] = v * finish.density;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (!paint.map) {
    paint.map = finishMap(finish.kind);
    paint.needsUpdate = true;
  }
}

const cube = new THREE.BoxGeometry(1, 1, 1);
const octagon = new THREE.CylinderGeometry(1, 1, 1, 8, 1);
const towerBand = new THREE.CylinderGeometry(1, 1, 1, 7, 1);
const upright = new THREE.CylinderGeometry(.83, 1, 1, 7, 1);
const disk = new THREE.CylinderGeometry(1, 1, 1, 16, 1);
const ball = new THREE.IcosahedronGeometry(1, 0);
const foliage = new THREE.IcosahedronGeometry(1, 1);
const peak = new THREE.ConeGeometry(1, 1, 8, 1);

const archProfile = new THREE.Shape();
archProfile.moveTo(-.5, 0);
archProfile.lineTo(.5, 0);
archProfile.lineTo(.5, .69);
archProfile.bezierCurveTo(.50, .94, .24, 1, 0, 1);
archProfile.bezierCurveTo(-.24, 1, -.50, .94, -.5, .69);
archProfile.closePath();
const archPanel = new THREE.ExtrudeGeometry(archProfile, { depth: 1, bevelEnabled: false, curveSegments: 6 });

const bevelProfile = new THREE.Shape();
bevelProfile.moveTo(-.46, -.46);
bevelProfile.lineTo(.46, -.46);
bevelProfile.lineTo(.46, .46);
bevelProfile.lineTo(-.46, .46);
bevelProfile.closePath();
const bevelBox = new THREE.ExtrudeGeometry(bevelProfile, { depth: .92, bevelThickness: .04, bevelSize: .04, bevelSegments: 1, steps: 1 });
bevelBox.translate(0, 0, -.46);

function piece(group: THREE.Group, geometry: THREE.BufferGeometry, paint: Paint, pos: XYZ, scale: XYZ, rotation?: XYZ) {
  const part = new THREE.Mesh(geometry, paint);
  part.position.set(...pos);
  part.scale.set(...scale);
  if (rotation) part.rotation.set(...rotation);
  group.add(part);
  return part;
}

function box(group: THREE.Group, paint: Paint, x: number, y: number, z: number, w: number, h: number, d: number, beveled = false) {
  return piece(group, beveled ? bevelBox : cube, paint, [x, y, z], [w, h, d]);
}

function beam(group: THREE.Group, paint: Paint, from: XYZ, to: XYZ, radius: number, round = false) {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const axis = end.clone().sub(start);
  const midpoint = start.clone().addScaledVector(axis, .5);
  const part = piece(group, round ? upright : cube, paint, [midpoint.x, midpoint.y, midpoint.z], [radius, axis.length(), radius]);
  part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
  return part;
}

function panel(group: THREE.Group, paint: Paint, rows: readonly XYZ[], colors?: readonly THREE.Color[]) {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const tint: number[] = [];
  for (let i = 1; i < rows.length - 1; i++) {
    for (const j of [0, i, i + 1]) {
      positions.push(...rows[j]);
      const color = colors?.[j];
      if (color) tint.push(color.r, color.g, color.b);
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (tint.length) geometry.setAttribute('color', new THREE.Float32BufferAttribute(tint, 3));
  geometry.computeVertexNormals();
  return piece(group, geometry, paint, [0, 0, 0], [1, 1, 1]);
}

function frame(group: THREE.Group, x: number, y: number, z: number, rotation = 0) {
  const local = new THREE.Group();
  local.position.set(x, y, z);
  local.rotation.y = rotation;
  group.add(local);
  return local;
}

function windowSash(group: THREE.Group, x: number, y: number, z: number, w: number, h: number, rotation = 0, shutters = false, square = false) {
  const window = frame(group, x, y, z, rotation);
  if (square) {
    box(window, sandstone, 0, h / 2, .016, w, h, .049, true);
    box(window, deepBlue, 0, h / 2, .046, w - .096, h - .108, .033, true);
    box(window, glass, 0, h / 2, .065, w - .170, h - .169, .014);
    box(window, stone, 0, h + .009, .046, w + .105, .063, .092, true);
  } else {
    piece(window, archPanel, sandstone, [0, 0, 0], [w, h, .033]);
    piece(window, archPanel, deepBlue, [0, .058, .033], [w - .095, h - .111, .024]);
    piece(window, archPanel, glass, [0, .094, .054], [w - .17, h - .179, .012]);
  }
  box(window, blue, 0, h * .53, .074, .035, h * .71, .03);
  box(window, blue, 0, h * .46, .074, w - .14, .039, .03);
  box(window, skyGlass, -w * .24, h * .64, .073, .058, h * .16, .018);
  box(window, stone, 0, .010, .088, w + .16, .094, .16, true);
  if (shutters) {
    for (const side of [-1, 1]) {
      const leaf = frame(window, side * (w / 2 + .122), .303, .017, side * .18);
      box(leaf, blue, 0, 0, 0, .21, .58, .057, true);
      for (let r = 0; r < 5; r++) box(leaf, teal, 0, -.19 + r * .095, .03, .17, .023, .022);
    }
  }
}

function portal(group: THREE.Group, x: number, z: number, trim: Paint) {
  const door = frame(group, x, .13, z);
  piece(door, archPanel, sandstone, [0, 0, 0], [.93, 1.38, .051]);
  piece(door, archPanel, stone, [0, .028, .045], [.81, 1.28, .026]);
  piece(door, archPanel, trim, [0, .076, .073], [.69, 1.17, .027]);
  piece(door, archPanel, darkGlass, [0, .80, .102], [.52, .32, .012]);
  box(door, trim, 0, .86, .12, .04, .18, .031);
  box(door, paleGold, .11, .52, .121, .055, .044, .066, true);
  for (const side of [-1, 1]) {
    box(door, blue, side * .19, .425, .104, .145, .514, .027, true);
    for (let layer = 0; layer < 3; layer++) {
      box(door, masonry[layer], side * .437, .137 + layer * .197, .020, .14, .17, .099, true);
    }
  }
  box(door, sandstone, 0, 1.361, .047, .148, .127, .091, true);
  box(door, sandstone, 0, -.057, .128, 1.00, .102, .29, true);
  box(door, stone, 0, -.099, .247, 1.08, .074, .23, true);
}

function dormer(group: THREE.Group, x: number, y: number, z: number, trim: Paint) {
  const trimSide = new THREE.Group();
  trimSide.position.set(x, y, z);
  group.add(trimSide);
  box(trimSide, sandstone, 0, .095, -.015, .65, .46, .28, true);
  piece(trimSide, disk, paleGold, [0, .153, .146], [.195, .05, .195], [Math.PI / 2, 0, 0]);
  piece(trimSide, disk, darkGlass, [0, .153, .182], [.149, .025, .149], [Math.PI / 2, 0, 0]);
  box(trimSide, trim, 0, .151, .201, .043, .285, .035);
  panel(trimSide, glazedRoof, [[-.41, .31, .23], [0, .57, .21], [.40, .31, .227], [.34, .34, -.39], [-.33, .34, -.39]],
    Array.from({ length: 5 }, () => new THREE.Color(0x825142)));
  beam(trimSide, paleGold, [-.376, .32, .226], [0, .568, .212], .031);
  beam(trimSide, paleGold, [0, .568, .212], [.371, .32, .226], .031);
}

function interpolate(from: XYZ, to: XYZ, t: number): XYZ {
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t];
}

type RoofCover = 'terracotta' | 'seam' | 'slate';

function roofSlope(group: THREE.Group, corners: [lowerLeft: XYZ, lowerRight: XYZ, ridgeLeft: XYZ, ridgeRight: XYZ], hue: number, cover: RoofCover) {
  const [left, right, peakLeft, peakRight] = corners;
  const ground = new THREE.Color(hue);
  const cap = (u: number, t: number, lift = 0): XYZ => {
    const point = interpolate(interpolate(left, right, u), interpolate(peakLeft, peakRight, u), t);
    point[1] += lift;
    return point;
  };
  const rows = cover === 'seam' ? 1 : cover === 'terracotta' ? 7 : 6;
  const tiles = cover === 'seam' ? 8 : cover === 'terracotta' ? 13 : 10;
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : .48;
    for (let c = -1; c < tiles; c++) {
      const u = Math.max(0, (c + offset) / tiles);
      const v = Math.min(1, (c + offset + .980) / tiles);
      if (u >= v) continue;
      const value = ((r * 17 + c * 29 + 63) & 15) / 15;
      const paint = ground.clone().multiplyScalar(.83 + value * .24 + r * .024);
      const lower = paint.clone().multiplyScalar(.84);
      const top = r / rows;
      const bottom = (r + 1) / rows;
      const bounds = [cap(u, top, .021), cap(v, top, .021), cap(v, bottom, .008), cap(u, bottom, .008)];
      panel(group, glazedRoof, bounds, [lower, lower, paint, paint]);
      if (cover === 'terracotta') {
        panel(group, glazedRoof, [cap(u, top, .006), cap(v, top, .006), bounds[1], bounds[0]], [lower, lower, paint, paint]);
      }
    }
  }
  if (cover === 'seam') for (let fold = 1; fold < tiles; fold++) {
    const pos = fold / tiles;
    beam(group, teal, cap(pos, .015, .034), cap(pos, .988, .031), .032, true);
  }
}

function hippedRoof(group: THREE.Group, top: number, width: number, depth: number, rise: number, hue: number, trim: Paint, cover: RoofCover, hip = .55) {
  const x = width / 2;
  const front = .23;
  const back = front - depth;
  const middle = (front + back) / 2;
  const p: XYZ = [-x, top, front];
  const q: XYZ = [x, top, front];
  const r: XYZ = [x, top, back];
  const s: XYZ = [-x, top, back];
  const left: XYZ = [-x * hip, top + rise, middle];
  const right: XYZ = [x * hip, top + rise, middle];
  const base = new THREE.Color(hue);
  panel(group, glazedRoof, [p, q, right, left], [base, base, base, base]);
  panel(group, glazedRoof, [r, s, left, right], [base, base, base, base]);
  roofSlope(group, [p, q, left, right], hue, cover);
  roofSlope(group, [r, s, right, left], hue, cover);
  const side = base.clone().multiplyScalar(.83);
  const glint = base.clone().multiplyScalar(.94);
  panel(group, glazedRoof, [q, r, right], [side, side, glint]);
  panel(group, glazedRoof, [s, p, left], [glint, side, glint]);
  for (const [start, end] of [[p, q], [q, r], [r, s], [s, p]] as [XYZ, XYZ][]) beam(group, trim, start, end, .105);
  const fascia = trim === darkWood ? wood : trim === deepBlue ? blue : teal;
  box(group, trim, 0, top - .071, front - .029, width, .148, .121, true);
  box(group, fascia, 0, top - .107, front + .020, width - .023, .061, .045, true);
  for (let bracket = -.5 * width + .23; bracket < .5 * width - .17; bracket += .397) {
    box(group, trim, bracket, top - .156, front - .044, .066, .086, .19, true);
  }
  for (const [start, end] of [[p, left], [s, left], [q, right], [r, right], [left, right]] as [XYZ, XYZ][]) {
    beam(group, trim, start, end, .062, true);
  }
  beam(group, fascia, [left[0] + .035, left[1] + .046, middle], [right[0] - .035, right[1] + .046, middle], .042, true);
}

function gabledObservatory(group: THREE.Group, top: number, hue: number) {
  const x = 2.18;
  const front = .24;
  const back = -2.82;
  const height = top + .77;
  const a: XYZ = [-x, top, front];
  const b: XYZ = [x, top, front];
  const c: XYZ = [x, top, back];
  const d: XYZ = [-x, top, back];
  const face: XYZ = [0, height, front];
  const far: XYZ = [0, height, back];
  const color = new THREE.Color(hue);
  const shades = [color, color, color, color];
  panel(group, plaster, [[-2.02, top - .03, .041], [2.02, top - .03, .041], [0, height - .058, .041]]);
  panel(group, plaster, [[2.02, top - .03, -2.57], [-2.02, top - .03, -2.57], [0, height - .058, -2.57]]);
  panel(group, glazedRoof, [b, c, far, face], shades);
  panel(group, glazedRoof, [d, a, face, far], shades);
  roofSlope(group, [b, c, face, far], hue, 'slate');
  roofSlope(group, [d, a, far, face], hue, 'slate');
  for (const [start, end] of [[a, face], [face, b], [c, far], [far, d], [a, d], [b, c], [face, far]] as [XYZ, XYZ][]) {
    beam(group, slate, start, end, .080);
  }
  piece(group, disk, agedGold, [0, top + .27, .080], [.219, .074, .219], [Math.PI / 2, 0, 0]);
  piece(group, disk, darkGlass, [0, top + .27, .129], [.175, .033, .175], [Math.PI / 2, 0, 0]);
  box(group, agedGold, 0, top + .27, .145, .33, .023, .025);
  box(group, agedGold, 0, top + .27, .149, .024, .33, .026);
}

function chimney(group: THREE.Group, x: number, y: number, z: number) {
  box(group, sandstone, x, y, z, .38, .72, .39, true);
  box(group, stone, x, y + .31, z, .47, .11, .48, true);
  box(group, slate, x, y + .385, z, .31, .058, .32, true);
  box(group, deepBlue, x, y + .416, z, .20, .014, .21);
}

function stationAnnex(group: THREE.Group, tower: boolean) {
  const x = 1.43;
  const z = -2.25;
  const y = tower ? 2.35 : 2.54;
  piece(group, octagon, sandstone, [x, 1.60, z], [.60, 2.5, .60], [0, Math.PI / 8, 0]);
  piece(group, octagon, agedGold, [x, y + .04, z], [.63, .10, .63], [0, Math.PI / 8, 0]);
  piece(group, octagon, tower ? darkGlass : glass, [x, y + .24, z], [.53, .41, .53], [0, Math.PI / 8, 0]);
  for (let j = 0; j < 8; j++) {
    const angle = Math.PI / 4 * j + Math.PI / 8;
    box(group, agedGold, x + Math.cos(angle) * .53, y + .25, z + Math.sin(angle) * .53, .047, .44, .047);
  }
  piece(group, octagon, slate, [x, y + .48, z], [.64, .105, .64], [0, Math.PI / 8, 0]);
  piece(group, foliage, tower ? slate : teal, [x, y + .56, z], [.62, .38, .62], [0, .31, 0]);
  const end: XYZ = [x - .52, y + .90, z + .30];
  const start: XYZ = [x + .11, y + .59, z + .06];
  beam(group, agedGold, start, end, .167, true);
  piece(group, ball, paleGold, end, [.093, .093, .093]);
}

function archiveEmblem(group: THREE.Group) {
  box(group, stone, 0, 1.669, .083, .51, .214, .094, true);
  piece(group, disk, agedGold, [0, 1.663, .142], [.089, .030, .089], [Math.PI / 2, 0, 0]);
  piece(group, disk, deepBlue, [0, 1.663, .161], [.064, .015, .064], [Math.PI / 2, 0, 0]);
  box(group, paleGold, 0, 1.663, .176, .119, .026, .021).rotation.z = .74;
  box(group, paleGold, 0, 1.663, .173, .026, .090, .016).rotation.z = .74;
}

function warehousePorch(group: THREE.Group) {
  for (const x of [-.82, .82]) {
    box(group, sandstone, x, .071, .54, .20, .14, .20, true);
    box(group, darkWood, x, .723, .54, .092, 1.34, .097, true);
    box(group, wood, x, 1.32, .54, .153, .11, .153, true);
    beam(group, wood, [x, 1.15, .54], [x, 1.42, .29], .064);
  }
  box(group, darkWood, 0, 1.44, .48, 1.94, .123, .17, true);
  box(group, wood, 0, 1.454, .31, 1.96, .092, .53, true).rotation.x = -.16;
  for (let panel = -4; panel <= 4; panel++) {
    const x = panel * .207;
    box(group, panel % 3 === 0 ? sandstone : teal, x, 1.505, .312, .202, .043, .497, true).rotation.x = -.16;
  }
}

function masonrySkirt(group: THREE.Group) {
  for (const side of [-1, 1]) for (let course = 0; course < 2; course++) {
    let span = .58;
    for (const length of course === 0 ? [.44, .47, .45] : [.34, .45, .56]) {
      const x = side * (span + length / 2);
      box(group, masonry[(Math.round(span * 100) + course) % 3], x, .352 + course * .103, .061, length - .013, .098, .054, true);
      span += length;
    }
  }
}

function building(prop: Prop, area: FieldArea) {
  const group = new THREE.Group();
  const clinic = prop.kind === 'cottage' && prop.variant === 1;
  const station = prop.kind === 'station';
  const observatory = station && area !== 'harbor';
  const summit = station && area === 'summit';
  const color = clinic ? 0x5b9292 : area === 'grove' ? 0x6c8d82 : area === 'summit' ? 0x626f80 : prop.variant === 2 ? 0x718688 : 0xb06b50;
  const eave = clinic ? deepBlue : observatory ? slate : darkWood;
  const bodyHeight = observatory ? 1.81 : 1.74;
  box(group, sandstone, 0, .084, -1.25, 4.34, .168, 2.78, true);
  box(group, stone, 0, .17, -1.25, 4.17, .104, 2.71, true);
  box(group, plaster, 0, .20 + bodyHeight / 2, -1.27, 4.08, bodyHeight, 2.60, true);
  box(group, masonry[1], 0, .29, -1.26, 4.13, .18, 2.64, true);
  box(group, sandstone, 0, bodyHeight + .14, -1.27, 4.16, .14, 2.67, true);
  masonrySkirt(group);
  for (const side of [-1, 1]) {
    for (let row = 0; row < 5; row++) {
      const y = .45 + .265 * row;
      box(group, masonry[row % masonry.length], side * (row % 2 ? 1.93 : 1.88), y, .035, row % 2 ? .25 : .34, .19, .082, true);
      box(group, masonry[(row + 1) % masonry.length], side * 2.035, y, -.20, .061, .196, row % 2 ? .41 : .30, true);
    }
    windowSash(group, side * 1.26, .55, .064, summit ? .68 : .78, summit ? .93 : .82, 0, !observatory && !clinic, clinic || summit);
    windowSash(group, side * 2.046, .62, -1.28, .77, .67, side * Math.PI / 2, false, observatory || clinic);
    if (!station && !clinic) {
      box(group, wood, side * 1.23, .51, .18, .81, .09, .16, true);
      piece(group, foliage, teal, [side * 1.23, .59, .16], [.32, .10, .11]);
    }
  }
  portal(group, 0, .046, blue);
  if (clinic) {
    box(group, stone, 0, 1.66, .17, .86, .30, .10, true);
    box(group, paleGold, 0, 1.66, .228, .59, .24, .057, true);
    box(group, red, 0, 1.661, .264, .072, .190, .035, true);
    box(group, red, 0, 1.661, .269, .181, .071, .028, true);
    box(group, teal, 0, 1.48, .20, 1.15, .082, .42, true);
  } else if (station && area === 'harbor') {
    warehousePorch(group);
  } else if (area === 'harbor' && !prop.variant) {
    archiveEmblem(group);
  }
  if (summit) gabledObservatory(group, bodyHeight + .19, color);
  else hippedRoof(group, bodyHeight + .19, 4.53, 3.15, observatory ? .78 : .97, color, eave, clinic ? 'seam' : observatory || prop.variant === 2 ? 'slate' : 'terracotta', clinic ? .72 : station && !observatory ? .69 : .53);
  if (observatory) stationAnnex(group, area === 'summit');
  else chimney(group, clinic ? -.83 : .94, bodyHeight + 1.02, -1.85);
  if (!clinic && !summit) dormer(group, -.47, bodyHeight + .40, -.027, blue);
  return group;
}

function beacon(area: FieldArea) {
  const group = new THREE.Group();
  const commercial = area === 'harbor';
  const head = commercial ? 3.15 : 2.85;
  const shaft = head - .52;
  const body = commercial ? plaster : masonry[1];
  const stripe = commercial ? red : blue;
  const patina = commercial ? darkWood : slate;
  if (commercial) {
    piece(group, octagon, masonry[1], [0, -.48, 0], [.97, .88, .97], [0, Math.PI / 8, 0]);
    piece(group, octagon, stone, [0, -.055, 0], [1.01, .088, 1.01], [0, Math.PI / 8, 0]);
  }
  piece(group, octagon, sandstone, [0, .12, 0], [.77, .24, .77], [0, Math.PI / 8, 0]);
  piece(group, octagon, stone, [0, .256, 0], [.70, .12, .70], [0, Math.PI / 8, 0]);
  piece(group, upright, body, [0, .30 + shaft / 2, 0], [.64, shaft, .64], [0, Math.PI / 8, 0]);
  const stripeLevels = [shaft * .36, shaft * .67];
  for (const band of stripeLevels) {
    const radius = .64 * (1 - (band - .095) / shaft * .17) + .013;
    piece(group, towerBand, stripe, [0, .30 + band, 0], [radius, .19, radius], [0, Math.PI / 8, 0]);
    piece(group, towerBand, paleGold, [0, .199 + band, 0], [radius + .006, .030, radius + .006], [0, Math.PI / 8, 0]);
  }
  const entrance = frame(group, 0, .23, .56);
  piece(entrance, archPanel, stone, [0, 0, 0], [.48, .80, .071]);
  piece(entrance, archPanel, blue, [0, .047, .062], [.36, .68, .029]);
  box(entrance, paleGold, .074, .31, .096, .047, .041, .035, true);

  const cornice = head - .38;
  for (const [y, radius, height, paint] of [
    [cornice - .123, .64, .12, sandstone],
    [cornice, .77, .124, stone],
    [cornice + .067, .75, .058, patina],
    [head + .285, .66, .113, patina],
  ] as [number, number, number, Paint][]) {
    piece(group, octagon, paint, [0, y, 0], [radius, height, radius], [0, Math.PI / 8, 0]);
  }
  piece(group, octagon, slate, [0, head, 0], [.48, .54, .48], [0, Math.PI / 8, 0]);
  piece(group, octagon, commercial ? yellowLamp : darkGlass, [0, head + .016, 0], [.494, .36, .494], [0, Math.PI / 8, 0]);
  for (let i = 0; i < 8; i++) {
    const theta = i * Math.PI / 4 + Math.PI / 8;
    const x = Math.cos(theta);
    const z = Math.sin(theta);
    box(group, patina, x * .496, head, z * .496, .047, .53, .047);
    box(group, agedGold, x * .719, cornice + .13, z * .719, .036, .22, .036);
    const next = theta + Math.PI / 4;
    beam(group, agedGold, [x * .719, cornice + .22, z * .719], [Math.cos(next) * .719, cornice + .22, Math.sin(next) * .719], .022);
  }
  piece(group, peak, commercial ? red : slate, [0, head + .567, 0], [.72, .48, .72], [0, Math.PI / 8, 0]);
  piece(group, octagon, patina, [0, head + .331, 0], [.729, .054, .729], [0, Math.PI / 8, 0]);
  piece(group, upright, agedGold, [0, head + .83, 0], [.037, .24, .037]);
  piece(group, ball, paleGold, [0, head + .978, 0], [.065, .085, .065]);
  group.userData.lightY = head;
  return group;
}

function gate() {
  const group = new THREE.Group();
  for (const x of [-.91, .91]) {
    box(group, slate, x, .095, 0, .62, .19, .71, true);
    box(group, sandstone, x, .24, 0, .52, .13, .57, true);
    box(group, stone, x, .41, 0, .44, .21, .46, true);
    for (let course = 0; course < 5; course++) {
      box(group, masonry[course % masonry.length], x, .64 + course * .25, 0, .422, .244, .435, true);
    }
    box(group, stone, x, 1.83, 0, .56, .16, .56, true);
    box(group, slate, x, 1.938, 0, .61, .10, .60, true);
    box(group, agedGold, x, 1.56, .245, .235, .233, .058, true);
    box(group, paleGold, x, 1.56, .280, .124, .127, .03, true);
  }
  box(group, slate, 0, 2.053, 0, 2.56, .27, .62, true);
  box(group, masonry[1], 0, 2.176, 0, 2.64, .15, .69, true);
  box(group, stone, 0, 2.27, -.016, 2.40, .083, .57, true);
  box(group, agedGold, 0, 2.058, .333, .26, .257, .047, true).rotation.z = Math.PI / 4;
  box(group, paleGold, 0, 2.058, .364, .147, .149, .029, true).rotation.z = Math.PI / 4;
  for (const x of [-.69, -.40, .40, .69]) box(group, sandstone, x, 2.062, .345, .16, .035, .035);
  return group;
}

function lamp() {
  const group = new THREE.Group();
  const y = 1.53;
  piece(group, octagon, sandstone, [0, .085, 0], [.16, .17, .16]);
  piece(group, upright, bronze, [0, .24, 0], [.101, .22, .101]);
  piece(group, upright, iron, [0, .80, 0], [.035, 1.06, .035]);
  piece(group, octagon, agedGold, [0, 1.205, 0], [.055, .054, .055]);
  piece(group, octagon, bronze, [0, y - .185, 0], [.16, .08, .16]);
  box(group, yellowLamp, 0, y, 0, .20, .27, .20, true);
  for (const x of [-.12, .12]) for (const z of [-.12, .12]) {
    beam(group, iron, [x, y - .14, z], [x * .84, y + .157, z * .84], .032);
  }
  piece(group, octagon, bronze, [0, y + .151, 0], [.161, .062, .161]);
  piece(group, peak, iron, [0, y + .230, 0], [.16, .15, .16], [0, Math.PI / 8, 0]);
  piece(group, ball, paleGold, [0, y + .32, 0], [.033, .040, .033]);
  group.userData.lightY = y;
  return group;
}

const oakColors = [material(0x547752), material(0x62865c), material(0x77955e), material(0x89a167)];
const pineColors = {
  harbor: [0x39615a, 0x4e7966, 0x688b70],
  grove: [0x365c55, 0x4a7060, 0x63856f],
  summit: [0x4e6c70, 0x69858a, 0x90a895],
};
const pineFacet = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .91 });
const bark = material(0x6a5543);
const moss = material(0x75835e);

function oak(variant: number) {
  const group = new THREE.Group();
  const twist = .18 + variant * .19;
  const h = 1 + variant * .09;
  beam(group, bark, [0, .02, 0], [-.09, 1.27 * h, .04], .13, true);
  for (const [x, z] of [[-.23, .05], [.22, .16], [-.06, -.18]]) {
    beam(group, bark, [x, .05, z], [-.03, .30, .015], .09, true);
  }
  const tufts = [
    [-.09, 1.50, .06, .68, .61, .65, 0],
    [-.66, 1.57, -.10, .52, .51, .52, 1],
    [.48, 1.65, .12, .50, .53, .53, 1],
    [.12, 1.79, -.46, .49, .58, .45, 1],
    [-.28, 2.02, .11, .66, .57, .58, 2],
    [.32, 2.08, -.10, .56, .56, .57, 2],
    [.02, 2.41, -.16, .51, .40, .43, 3],
  ];
  for (const [x, y, z, sx, sy, sz, tint] of tufts) {
    piece(group, foliage, oakColors[(tint + variant % 2) % oakColors.length], [x, y * h, z], [sx, sy, sz], [twist, x * 2 + twist, z * 2]);
  }
  return group;
}

function pineBough(radius: number, height: number, phase: number, hue: number) {
  const points: number[] = [];
  const colors: number[] = [];
  const edges = 10;
  const color = new THREE.Color(hue);
  const face = (corners: XYZ[], side: number) => {
    const shade = Math.cos(side * 1.38 + phase) * .07;
    for (const corner of corners) {
      const tone = color.clone().multiplyScalar(.86 + shade + Math.max(0, corner[1]) / height * .29);
      points.push(...corner);
      colors.push(tone.r, tone.g, tone.b);
    }
  };
  const leafRing = Array.from({ length: edges }, (_, i): XYZ => {
    const angle = i * (2 * Math.PI / edges) + phase;
    const spread = radius * (.90 + Math.sin(i * 3.61 + phase) * .14);
    return [Math.cos(angle) * spread, -.018 * (i % 5), Math.sin(angle) * spread * .93];
  });
  const shoulderRing = leafRing.map(([x, y, z]): XYZ => [x * .51 - .06, height * .53 - y, z * .52]);
  for (let i = 0; i < edges; i++) {
    const j = (i + 1) % edges;
    const left = leafRing[i];
    const right = leafRing[j];
    const shoulder = shoulderRing[i];
    const nextShoulder = shoulderRing[j];
    face([left, shoulder, right, right, shoulder, nextShoulder], i);
    face([shoulder, [-.10, height, -.03], nextShoulder], i);
    face([right, [0, -.11, 0], left], i);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function pine(area: FieldArea, variant: number) {
  const group = new THREE.Group();
  const height = 1 + (variant - 1) * .11;
  const shades = pineColors[area];
  beam(group, bark, [0, 0, 0], [-.05, 2.44 * height, .03], .094, true);
  for (const [r, b, y, tint] of [[.91, .86, .68, 0], [.73, .80, 1.17, 0], [.56, .77, 1.62, 1], [.42, .74, 2.05, 1], [.26, .69, 2.45, 2]]) {
    const phase = variant * .69 + y * .51;
    piece(group, pineBough(r, b * height, phase, shades[tint]), pineFacet, [Math.sin(phase * 1.8) * .065, y * height, Math.cos(phase) * .060], [1, 1, 1]);
  }
  for (const [side, y, z, radius] of [[1, 1.10, .30, .36], [-1, 1.48, -.17, .30], [1, 1.92, -.19, .22]]) {
    const phase = variant * .61 + y;
    piece(group, pineBough(radius, .48 * height, phase, shades[1]), pineFacet, [side * (2.3 - y) * .44, y * height, z], [1.06, 1, .79]);
  }
  return group;
}

const rockColors = {
  harbor: [material(0x868e7d), material(0x959c87), material(0xafae98)],
  grove: [material(0x677c73), material(0x829384), material(0x99a18a)],
  summit: [material(0x777f91), material(0x9f9ca6), material(0xc6b9b7)],
};

function rock(area: FieldArea, variant: number) {
  const group = new THREE.Group();
  const dims = .8 + variant * .17;
  const shades = rockColors[area];
  piece(group, ball, shades[0], [-.12, .174, .03], [.61 * dims, .29 * dims, .37 * dims], [.03, variant * .87, .13]);
  piece(group, ball, shades[1], [-.12, .27 * dims, -.03], [.54 * dims, .26 * dims, .36 * dims], [.21, variant * .87, .05]);
  piece(group, ball, shades[2], [.17, .30 * dims, -.08], [.28 * dims, .15 * dims, .22 * dims], [0, variant * .45, .26]);
  if (area !== 'summit') piece(group, ball, moss, [-.19, .42 * dims, .16], [.24 * dims, .045, .12 * dims], [.20, .21, .10]);
  return group;
}

function boat(variant: number) {
  const group = new THREE.Group();
  const rows: [x: number, width: number, height: number][] = [[-1.23, .09, -.10], [-.88, .35, -.21], [-.36, .42, -.24], [.40, .38, -.24], [1.19, .04, .025]];
  const shape = frame(group, 0, 0, 0, variant ? -.11 : .18);
  const reach = (row: number, side: number, lower: boolean): XYZ => {
    const [x, width, y] = rows[row];
    return [x + (lower ? -.06 * Math.sign(x) : 0), lower ? -.625 : y, width * side * (lower ? .69 : 1)];
  };
  for (const side of [-1, 1]) {
    for (let row = 0; row < rows.length - 1; row++) {
      const a = reach(row, side, false);
      const b = reach(row + 1, side, false);
      const c = reach(row + 1, side, true);
      const d = reach(row, side, true);
      const outline = side === 1 ? [a, d, c, b] : [b, c, d, a];
      panel(shape, side === 1 ? wood : darkWood, outline);
      beam(shape, variant ? teal : paleWood, a, b, .07, true);
      beam(shape, paleWood, interpolate(a, d, .35), interpolate(b, c, .35), .032);
    }
  }
  for (const [x, w] of [[-.77, .49], [-.25, .64], [.41, .44]]) box(shape, paleWood, x, -.342, 0, .15, .052, w, true);
  box(shape, wood, -.09, -.495, 0, 1.75, .059, .38);
  if (variant) {
    beam(shape, darkWood, [-.43, -.30, -.45], [.79, -.44, .25], .041, true);
    box(shape, paleWood, .72, -.435, .192, .21, .052, .10, true).rotation.y = -.45;
  } else {
    const cloth = new THREE.MeshStandardMaterial({ color: 0xe8cd9f, roughness: .89, side: THREE.DoubleSide });
    const ribbon = new THREE.MeshStandardMaterial({ color: 0xbf6b58, roughness: .91, side: THREE.DoubleSide });
    beam(shape, darkWood, [-.20, -.45, 0], [-.20, 1.24, 0], .04, true);
    beam(shape, paleWood, [-.21, .033, 0], [.78, .055, .03], .027, true);
    panel(shape, cloth, [[-.19, 1.19, .012], [-.19, .102, .024], [.75, .125, .09], [.31, .60, .13]]);
    panel(shape, ribbon, [[-.19, .47, .027], [-.19, .33, .027], [.57, .35, .107], [.47, .47, .137]]);
    beam(shape, paleWood, [-.211, 1.27, 0], [.042, 1.26, -.02], .033, true);
  }
  return group;
}

function fence(variant: number) {
  const group = new THREE.Group();
  const length = variant + 1;
  const start = -.43;
  const tail = start + length - .11;
  for (const height of [.30, .61]) {
    box(group, wood, (tail + start) / 2, height, 0, tail - start, .13, .11, true);
    box(group, paleWood, (tail + start) / 2, height + .042, .008, tail - start, .026, .119);
  }
  for (let i = 0; i <= 2 * length; i++) {
    const x = start + i / (2 * length) * (tail - start);
    box(group, darkWood, x, .364, 0, .108, .71, .133, true);
    box(group, paleWood, x, .729, 0, .132, .072, .145, true);
    box(group, agedGold, x, .58, .077, .041, .046, .032);
  }
  return group;
}

function crate(variant: number) {
  const group = new THREE.Group();
  for (const [x, h, z, rotate] of [[-.203, .44, .027, -.11], [.22, .36 + variant * .1, -.15, .16]]) {
    const bin = frame(group, x, 0, z, rotate);
    box(bin, wood, 0, h / 2, 0, .42, h, .42, true);
    for (const dx of [-.167, .167]) {
      box(bin, paleWood, dx, h / 2, .213, .058, h, .046, true);
      box(bin, paleWood, dx, h / 2, -.213, .058, h, .046, true);
    }
    for (const y of [.08, h - .075]) box(bin, darkWood, 0, y, .218, .38, .041, .037);
    beam(bin, paleWood, [-.158, .092, .22], [.154, h - .069, .22], .049);
    box(bin, darkWood, 0, h + .004, 0, .30, .016, .067, true);
  }
  return group;
}

function winch() {
  const group = new THREE.Group();
  box(group, sandstone, 0, .066, 0, .82, .13, .58, true);
  for (const x of [-.23, .23]) {
    box(group, wood, x, .298, 0, .12, .51, .16, true);
    box(group, paleWood, x, .547, 0, .151, .091, .19, true);
  }
  piece(group, disk, bronze, [0, .384, 0], [.137, .43, .137], [0, 0, Math.PI / 2]);
  piece(group, disk, agedGold, [-.238, .384, 0], [.16, .056, .16], [0, 0, Math.PI / 2]);
  piece(group, disk, agedGold, [.238, .384, 0], [.16, .056, .16], [0, 0, Math.PI / 2]);
  for (let i = 0; i < 5; i++) {
    piece(group, disk, paleWood, [-.15 + i * .057, .384, 0], [.143, .036, .143], [0, 0, Math.PI / 2]);
  }
  beam(group, bronze, [.264, .389, 0], [.294, .515, -.167], .06, true);
  beam(group, wood, [.288, .515, -.167], [.414, .515, -.167], .069, true);
  return group;
}

function sign(variant: number) {
  const group = new THREE.Group();
  const direction = variant ? -1 : 1;
  box(group, sandstone, 0, .07, 0, .24, .14, .21, true);
  box(group, darkWood, 0, .59, 0, .083, 1.10, .095, true);
  box(group, paleWood, 0, 1.138, 0, .12, .105, .115, true);
  box(group, darkWood, 0, .937, .039, .80, .255, .086, true);
  box(group, blue, 0, .937, .085, .735, .197, .036, true);
  box(group, paleGold, -.09 * direction, .935, .109, .36, .04, .029);
  beam(group, stone, [.105 * direction, 1.003, .115], [.233 * direction, .938, .115], .037);
  beam(group, stone, [.233 * direction, .938, .115], [.105 * direction, .871, .115], .037);
  return group;
}

const pennant = new THREE.MeshStandardMaterial({ color: 0xc5755b, roughness: .87, side: THREE.DoubleSide });

function banner() {
  const group = new THREE.Group();
  beam(group, darkWood, [-.15, .02, 0], [-.15, 1.47, 0], .046, true);
  piece(group, ball, paleGold, [-.15, 1.496, 0], [.051, .055, .051]);
  panel(group, pennant, [[-.13, 1.403, .023], [-.13, 1.07, .025], [.42, 1.09, .023], [.33, 1.22, .045], [.47, 1.39, .061]]);
  box(group, paleGold, .016, 1.239, .047, .06, .142, .026, true);
  return group;
}

const flowerColors = [material(0xd58e73), material(0xdfc883), material(0xddd5b8)];
const flowerLeaf = material(0x778b5e);

function flowers(variant: number) {
  const group = new THREE.Group();
  for (const [x, z, height] of [[-.28, .10, .22], [-.11, -.13, .29], [.06, .05, .19], [.21, -.08, .25], [.30, .14, .19]]) {
    beam(group, flowerLeaf, [x, .01, z], [x + .017, height, z], .024, true);
    piece(group, ball, flowerLeaf, [x + .022, height * .5, z + .055], [.08, .021, .043], [.32, x, z]);
    piece(group, ball, flowerColors[variant % flowerColors.length], [x + .017, height, z], [.073, .036, .071], [.34, z, .12]);
    piece(group, ball, paleGold, [x + .017, height + .029, z], [.028, .014, .028]);
  }
  return group;
}

function makeProp(prop: Prop, area: FieldArea) {
  const variant = prop.variant ?? 0;
  switch (prop.kind) {
    case 'cottage':
    case 'station': return building(prop, area);
    case 'beacon': return beacon(area);
    case 'lamp': return lamp();
    case 'arch': return gate();
    case 'oak': return oak(variant);
    case 'pine': return pine(area, variant);
    case 'rock': return rock(area, variant);
    case 'boat': return boat(variant);
    case 'flowers': return flowers(variant);
    case 'fence': return fence(variant);
    case 'crate': return crate(variant);
    case 'winch': return winch();
    case 'sign': return sign(variant);
    case 'banner': return banner();
  }
}

function batch(source: THREE.Group) {
  source.updateMatrixWorld(true);
  const groups = new Map<Paint, THREE.BufferGeometry[]>();
  source.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const part = object as ScenePart;
    const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
    geometry.applyMatrix4(part.matrixWorld);
    projectFinish(geometry, part.material);
    const stack = groups.get(part.material) ?? [];
    stack.push(geometry);
    groups.set(part.material, stack);
  });
  const model = new THREE.Group();
  for (const [paint, geometries] of groups) {
    const combined = mergeGeometries(geometries);
    geometries.forEach(geometry => geometry.dispose());
    if (!combined) continue;
    combined.computeBoundingSphere();
    const mesh = new THREE.Mesh(combined, paint);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    model.add(mesh);
  }
  model.userData = { ...source.userData };
  return model;
}

const fieldModels = new Map<string, THREE.Group>();

export function buildFieldProp(prop: Prop, area: FieldArea): THREE.Object3D {
  const zone = prop.kind === 'cottage' || prop.kind === 'station' || prop.kind === 'beacon' || prop.kind === 'rock' || prop.kind === 'pine' ? area : '';
  const key = `${prop.kind}:${zone}:${prop.variant ?? 0}`;
  let model = fieldModels.get(key);
  if (!model) {
    model = batch(makeProp(prop, area));
    model.name = key;
    fieldModels.set(key, model);
  }
  return model.clone();
}
