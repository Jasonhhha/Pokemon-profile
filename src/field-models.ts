import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type XYZ = [x: number, y: number, z: number];
type Paint = THREE.MeshStandardMaterial;
type ScenePart = THREE.Mesh<THREE.BufferGeometry, Paint>;
type Finish = 'limestone' | 'plaster' | 'timber' | 'enamel';

const material = (color: number, roughness = .84, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

const stone = material(0xe4cda3);
const sandstone = material(0xb5a282);
const wharfStone = material(0xdac7a6);
const plaster = material(0xf0d9b2);
const slate = material(0x596b71);
const blue = material(0x356670);
const agedGold = material(0xb78b53, .52, .30);
const paleGold = material(0xe8c684, .48, .16);
const wood = material(0x8f654b);
const darkWood = material(0x584a3a);
const paleWood = material(0xbe9268);
const red = material(0xb95c4b);
const teal = material(0x5b8a81, .66, .10);
const yellowLamp = new THREE.MeshStandardMaterial({
  color: 0xffd685, emissive: 0xfba35a, emissiveIntensity: .37, roughness: .52,
});

const projectedFinish = new Map<Paint, { kind: Finish; density: number }>();
for (const paint of [stone, sandstone, wharfStone]) projectedFinish.set(paint, { kind: 'limestone', density: 1.52 });
projectedFinish.set(plaster, { kind: 'plaster', density: 1.1 });
for (const paint of [wood, darkWood, paleWood]) projectedFinish.set(paint, { kind: 'timber', density: 1.18 });
for (const paint of [blue, teal]) projectedFinish.set(paint, { kind: 'enamel', density: 1.24 });
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
const ball = new THREE.IcosahedronGeometry(1, 0);
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

function interpolate(from: XYZ, to: XYZ, t: number): XYZ {
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t];
}

function beacon() {
  const group = new THREE.Group();
  const head = 3.15;
  const shaft = head - .52;
  piece(group, octagon, wharfStone, [0, -.48, 0], [.97, .88, .97], [0, Math.PI / 8, 0]);
  piece(group, octagon, stone, [0, -.055, 0], [1.01, .088, 1.01], [0, Math.PI / 8, 0]);
  piece(group, octagon, sandstone, [0, .12, 0], [.77, .24, .77], [0, Math.PI / 8, 0]);
  piece(group, octagon, stone, [0, .256, 0], [.70, .12, .70], [0, Math.PI / 8, 0]);
  piece(group, upright, plaster, [0, .30 + shaft / 2, 0], [.64, shaft, .64], [0, Math.PI / 8, 0]);
  const stripeLevels = [shaft * .36, shaft * .67];
  for (const band of stripeLevels) {
    const radius = .64 * (1 - (band - .095) / shaft * .17) + .013;
    piece(group, towerBand, red, [0, .30 + band, 0], [radius, .19, radius], [0, Math.PI / 8, 0]);
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
    [cornice + .067, .75, .058, darkWood],
    [head + .285, .66, .113, darkWood],
  ] as [number, number, number, Paint][]) {
    piece(group, octagon, paint, [0, y, 0], [radius, height, radius], [0, Math.PI / 8, 0]);
  }
  piece(group, octagon, slate, [0, head, 0], [.48, .54, .48], [0, Math.PI / 8, 0]);
  piece(group, octagon, yellowLamp, [0, head + .016, 0], [.494, .36, .494], [0, Math.PI / 8, 0]);
  for (let i = 0; i < 8; i++) {
    const theta = i * Math.PI / 4 + Math.PI / 8;
    const x = Math.cos(theta);
    const z = Math.sin(theta);
    box(group, darkWood, x * .496, head, z * .496, .047, .53, .047);
    box(group, agedGold, x * .719, cornice + .13, z * .719, .036, .22, .036);
    const next = theta + Math.PI / 4;
    beam(group, agedGold, [x * .719, cornice + .22, z * .719], [Math.cos(next) * .719, cornice + .22, Math.sin(next) * .719], .022);
  }
  piece(group, peak, red, [0, head + .567, 0], [.72, .48, .72], [0, Math.PI / 8, 0]);
  piece(group, octagon, darkWood, [0, head + .331, 0], [.729, .054, .729], [0, Math.PI / 8, 0]);
  piece(group, upright, agedGold, [0, head + .83, 0], [.037, .24, .037]);
  piece(group, ball, paleGold, [0, head + .978, 0], [.065, .085, .065]);
  group.userData.lightY = head;
  return group;
}

const boatStations: [x: number, width: number, height: number][] = [
  [-1.23, .09, -.10], [-.88, .35, -.21], [-.36, .42, -.24], [.40, .38, -.24], [1.19, .04, .025],
];

function boat(variant: number) {
  const group = new THREE.Group();
  const rows = boatStations;
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
      const inner = outline.map(([x, y, z]): XYZ => [x, y, z * .95]).reverse();
      panel(shape, wood, inner);
      beam(shape, variant ? teal : paleWood, a, b, .07, true);
      beam(shape, paleWood, interpolate(a, d, .35), interpolate(b, c, .35), .032);
    }
  }
  for (let row = 0; row < rows.length - 1; row++) {
    const [x0, w0] = rows[row], [x1, w1] = rows[row + 1];
    const width0 = w0 * .74, width1 = w1 * .74;
    panel(shape, darkWood, [[x0, -.515, -width0], [x0, -.515, width0], [x1, -.515, width1], [x1, -.515, -width1]]);
    if (row) box(shape, paleWood, x0, -.486, 0, .059, .053, width0 * 1.9);
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

export function buildHarborProp(kind: 'beacon' | 'boat', variant = 0): THREE.Object3D {
  const key = kind + '-' + variant;
  let model = fieldModels.get(key);
  if (!model) {
    model = batch(kind === 'beacon' ? beacon() : boat(variant));
    model.name = key;
    fieldModels.set(key, model);
  }
  return model.clone();
}
