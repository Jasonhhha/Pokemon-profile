import {
  BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial,
  TorusGeometry, Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildCityArchitecture } from './field-city-models';
import { bendCityGeometry, ringAngle, ringPosition } from './field-ring-space';

type Point = [x: number, y: number, z: number];

const stone = new MeshStandardMaterial({ color: 0xc0ae92, roughness: .89 });
const cream = new MeshStandardMaterial({ color: 0xe1cda9, roughness: .79 });
const shadow = new MeshStandardMaterial({ color: 0x787f75, roughness: .9 });
const pier = new MeshStandardMaterial({ color: 0x8a9690, roughness: .88 });
const teal = new MeshStandardMaterial({ color: 0x4c7577, metalness: .34, roughness: .47 });
const ink = new MeshStandardMaterial({ color: 0x2d4650, metalness: .28, roughness: .59 });
const copper = new MeshStandardMaterial({ color: 0xb19769, metalness: .42, roughness: .51 });
const glass = new MeshStandardMaterial({ color: 0x7caba4, roughness: .33, metalness: .12 });
const timber = new MeshStandardMaterial({ color: 0x916e53, roughness: .88 });
const dryTimber = new MeshStandardMaterial({ color: 0xb89d71, roughness: .85 });
const tile = new MeshStandardMaterial({ color: 0x9a6e54, roughness: .82 });
const seaBrick = new MeshStandardMaterial({ color: 0xac7359, roughness: .93 });
const bathStone = new MeshStandardMaterial({ color: 0xc8a784, roughness: .87 });
const charcoalSlate = new MeshStandardMaterial({ color: 0x44555d, metalness: .12, roughness: .66 });
const lantern = new MeshStandardMaterial({
  color: 0xe3c288, emissive: 0xffc16c, emissiveIntensity: .015, roughness: .35,
});
const innerGlass = new MeshStandardMaterial({
  color: 0x7a9a92, emissive: 0xe7b46c, emissiveIntensity: 0, metalness: .08, roughness: .38,
});

const origin = new Vector3();
const up = new Vector3(0, 1, 0);
const end = new Vector3();
const flatBox = new BoxGeometry(1, 1, 1);
const rod = new CylinderGeometry(1, 1, 1, 9);

class Monument {
  private readonly pieces = new Map<MeshStandardMaterial, BufferGeometry[]>();

  private bake(geometry: BufferGeometry, material: MeshStandardMaterial, configure: (object: Mesh) => void) {
    const object = new Mesh(geometry, material);
    configure(object);
    object.updateMatrix();
    const part = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    part.applyMatrix4(object.matrix);
    const bucket = this.pieces.get(material) ?? [];
    bucket.push(part);
    this.pieces.set(material, bucket);
  }

  box(material: MeshStandardMaterial, at: Point, size: Point, yaw = 0, pitch = 0) {
    this.bake(flatBox, material, object => {
      object.position.set(...at);
      object.scale.set(...size);
      object.rotation.set(pitch, yaw, 0);
    });
  }

  tier(material: MeshStandardMaterial, top: number, bottom: number, from: number, to: number, sides = 12) {
    const geometry = new CylinderGeometry(top, bottom, to - from, sides);
    this.bake(geometry, material, object => {
      object.position.y = (from + to) / 2;
      object.rotation.y = Math.PI / sides;
    });
    geometry.dispose();
  }

  beam(material: MeshStandardMaterial, a: Point, b: Point, radius: number) {
    origin.set(...a);
    end.set(...b).sub(origin);
    const height = end.length();
    if (!height) return;
    this.bake(rod, material, object => {
      object.position.copy(origin).addScaledVector(end, .5);
      object.scale.set(radius, height, radius);
      object.quaternion.setFromUnitVectors(up, end.normalize());
    });
  }

  ring(material: MeshStandardMaterial, at: Point, radius: number, thickness: number, rotation: Point = [0, 0, 0]) {
    const geometry = new TorusGeometry(radius, thickness, 7, 36);
    this.bake(geometry, material, object => {
      object.position.set(...at);
      object.rotation.set(...rotation);
    });
    geometry.dispose();
  }

  finish() {
    const group = new Group();
    for (const [material, parts] of this.pieces) {
      const geometry = mergeGeometries(parts);
      parts.forEach(part => part.dispose());
      if (!geometry) continue;
      geometry.computeBoundingSphere();
      const mesh = new Mesh(geometry, material);
      mesh.castShadow = material !== lantern && material !== innerGlass;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }
}

const radial = (angle: number, radius: number, height: number, sideways = 0): Point => [
  Math.sin(angle) * radius + Math.cos(angle) * sideways,
  height,
  Math.cos(angle) * radius - Math.sin(angle) * sideways,
];

function caisson(kit: Monument) {
  kit.tier(shadow, 2.51, 2.43, -1.52, -.62, 28);
  kit.tier(pier, 2.57, 2.49, -.64, -.20, 28);
  kit.tier(stone, 2.60, 2.58, -.23, -.083, 28);
  kit.tier(cream, 2.59, 2.59, -.086, .014, 28);
  kit.tier(pier, 2.32, 2.40, .013, .109, 28);
  kit.ring(ink, [0, .048, 0], 2.53, .018, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 20; i++) {
    const angle = i * Math.PI / 10;
    const thick = i % 5 === 0;
    kit.box(thick ? cream : stone, radial(angle, 2.44, .20), [thick ? .146 : .074, thick ? .33 : .238, .109], angle);
    kit.box(copper, radial(angle, 2.44, thick ? .37 : .345), [thick ? .171 : .086, .039, .117], angle);
    const next = angle + Math.PI / 10;
    if (!thick) {
      kit.beam(ink, radial(angle, 2.435, .173), radial(next, 2.435, .173), .016);
      kit.beam(ink, radial(angle, 2.435, .271), radial(next, 2.435, .271), .017);
    }
  }
  kit.tier(stone, 1.77, 1.85, .097, .244, 12);
  kit.tier(cream, 1.67, 1.77, .242, .390, 12);
  kit.tier(stone, 1.57, 1.68, .388, .574, 12);
}

function tidalShaft(kit: Monument) {
  kit.tier(seaBrick, 1.33, 1.56, .57, 1.87);
  for (const [height, radius] of [[.90, 1.527], [1.149, 1.479], [1.514, 1.416]]) {
    kit.tier(bathStone, radius - .009, radius, height, height + .056);
  }
  kit.tier(cream, 1.47, 1.48, 1.66, 1.84);
  kit.tier(cream, 1.36, 1.45, 1.83, 2.02);
  kit.tier(bathStone, .92, 1.30, 1.98, 6.18);
  for (const [height, radius] of [[2.699, 1.250], [3.721, 1.153], [4.740, 1.058]]) {
    kit.tier(cream, radius - .008, radius, height, height + .036);
  }
  kit.tier(cream, .97, 1.01, 5.91, 6.12);
  kit.tier(pier, 1.17, .99, 6.12, 6.36);
  kit.tier(cream, 1.20, 1.19, 6.36, 6.51);
  for (let direction = 0; direction < 8; direction++) {
    const a = direction * Math.PI / 4;
    const major = direction % 2 === 0;
    const foot = major ? 1.635 : 1.486;
    kit.beam(shadow, radial(a, foot, .63), radial(a, major ? 1.015 : .954, 5.96), major ? .102 : .058);
    kit.beam(cream, radial(a, foot + .027, .67), radial(a, 1.023, 5.83), major ? .062 : .037);
    if (major) {
      kit.box(shadow, radial(a, 1.429, 1.096), [.46, 1.20, .131], a);
      kit.box(ink, radial(a, 1.512, 1.072), [.329, .964, .067], a);
      kit.box(innerGlass, radial(a, 1.550, 1.207), [.243, .481, .041], a);
      kit.box(cream, radial(a, 1.518, 1.59), [.202, .074, .064], a);
      for (const x of [-.155, .155]) kit.beam(copper, radial(a, 1.556, 1.48, x), radial(a, 1.556, .595, x), .021);
      kit.box(cream, radial(a, 1.62, .581), [.489, .087, .274], a);
    }
    const windowAngle = a + Math.PI / 8;
    for (let row = 0; row < 3; row++) {
      const y = 2.35 + row * 1.068;
      const wallR = 1.28 - (y - 1.99) * .089;
      const pane = (direction + row) % 4 === 0 ? innerGlass : glass;
      kit.box(shadow, radial(windowAngle, wallR -.008, y + .23), [.239, .681, .236], windowAngle);
      kit.box(ink, radial(windowAngle, wallR + .106, y + .211), [.186, .569, .056], windowAngle);
      kit.box(pane, radial(windowAngle, wallR + .143, y + .22), [.137, .474, .031], windowAngle);
      kit.box(copper, radial(windowAngle, wallR + .152, y + .123), [.151, .023, .037], windowAngle);
      kit.box(cream, radial(windowAngle, wallR + .06, y - .091), [.253, .071, .186], windowAngle);
      kit.box(cream, radial(windowAngle, wallR + .09, y + .560), [.085, .085, .088], windowAngle);
    }
  }
}

function observatoryCrown(kit: Monument) {
  kit.tier(ink, 1.154, 1.109, 6.48, 6.60, 16);
  kit.tier(copper, 1.205, 1.195, 6.58, 6.66, 16);
  kit.tier(teal, 1.082, 1.105, 6.63, 7.66, 16);
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8;
    kit.box(i % 4 === 1 ? innerGlass : glass, radial(a, 1.091, 7.116), [.346, .706, .076], a);
    kit.box(ink, radial(a, 1.141, 7.22), [.324, .030, .032], a);
    kit.box(copper, radial(a, 1.143, 6.884), [.322, .037, .037], a);
    kit.beam(copper, radial(a - Math.PI / 16, 1.120, 6.63), radial(a - Math.PI / 16, 1.108, 7.63), .026);
    kit.beam(ink, radial(a, 1.112, 6.397), radial(a + Math.PI / 8, 1.112, 6.397), .025);
  }
  kit.tier(copper, 1.18, 1.185, 7.62, 7.717, 16);
  kit.tier(ink, 1.209, 1.197, 7.70, 7.807, 16);
  kit.tier(charcoalSlate, .87, 1.21, 7.80, 8.117, 16);
  kit.tier(charcoalSlate, .315, .87, 8.10, 8.622, 16);
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    kit.beam(ink, radial(angle, 1.182, 7.807), radial(angle, .853, 8.113), .012);
    kit.beam(ink, radial(angle, .854, 8.116), radial(angle, .318, 8.601), .010);
  }
  kit.tier(copper, .272, .386, 8.60, 8.702, 12);
  kit.tier(ink, .144, .18, 8.69, 8.97, 10);
  kit.tier(copper, .124, .145, 8.92, 9.046, 12);
  kit.tier(copper, .012, .049, 9.96, 10.186, 9);
}

function tidalDial() {
  const kit = new Monument();
  kit.ring(ink, [0, 9.474, 0], .493, .024, [Math.PI / 2, 0, 0]);
  kit.ring(copper, [0, 9.474, 0], .512, .032, [.205, 0, -.412]);
  kit.ring(copper, [0, 9.474, 0], .510, .028, [0, Math.PI / 2, .216]);
  kit.tier(lantern, .184, .184, 9.349, 9.596, 16);
  kit.tier(lantern, .020, .184, 9.593, 9.74, 16);
  kit.tier(lantern, .184, .020, 9.206, 9.350, 16);
  kit.beam(ink, [0, 8.98, 0], [0, 10.0, 0], .028);
  const group = kit.finish();
  group.name = 'Orbit dial';
  return group;
}

function observatory() {
  const kit = new Monument();
  caisson(kit);
  tidalShaft(kit);
  observatoryCrown(kit);
  const group = kit.finish();
  group.name = 'Central tidal observatory';
  group.userData.parcel = 'ring-observatory';
  group.scale.y = 1.13;
  return group;
}

function placeAlongRing(group: Group, x: number, z: number, name: string, parcel?: string) {
  const center = ringPosition(x, z);
  group.position.set(center.x, 0, center.z);
  group.rotation.y = ringAngle(x);
  group.name = name;
  if (parcel) group.userData.parcel = parcel;
  return group;
}

function tideGate() {
  const kit = new Monument();
  kit.box(shadow, [0, .109, 0], [1.065, .218, .750]);
  kit.box(pier, [0, .245, 0], [1.016, .079, .779]);
  kit.box(ink, [0, .812, .004], [.54, 1.02, .309]);
  for (let slat = -3; slat <= 3; slat++) {
    kit.box(teal, [slat * .055, .810, .174], [.041, .928, .032]);
  }
  kit.box(copper, [0, 1.362, .103], [.668, .078, .292]);
  kit.box(ink, [0, 1.475, .049], [.634, .17, .367]);
  kit.box(cream, [0, 1.521, .055], [.657, .061, .394]);
  kit.ring(copper, [0, 1.348, .273], .134, .019);
  kit.beam(teal, [0, 1.238, .273], [0, 1.462, .273], .013);
  kit.beam(teal, [-.116, 1.348, .273], [.116, 1.348, .273], .013);
  for (const side of [-1, 1]) {
    const x = side * .32;
    kit.box(stone, [x, .996, -.015], [.334, 1.53, .512]);
    kit.box(cream, [x, .368, .015], [.365, .081, .549]);
    kit.box(cream, [x, 1.676, -.015], [.388, .14, .554]);
    kit.box(teal, [x, 1.789, -.015], [.397, .103, .568]);
    kit.box(ink, [x, 1.904, -.015], [.273, .149, .375]);
    kit.box(copper, [x, 1.994, -.015], [.290, .043, .392]);
    kit.box(teal, [x, 2.032, -.015], [.216, .046, .326]);
    kit.box(cream, [x, .972, .245], [.168, .600, .061]);
    kit.box(ink, [x, 1.03, .284], [.130, .422, .037]);
    kit.box(innerGlass, [x, 1.064, .313], [.085, .320, .025]);
    kit.box(copper, [x, 1.056, .331], [.113, .026, .029]);
    kit.beam(teal, [x, 2.032, -.019], [x, 2.276, -.019], .021);
    kit.beam(lantern, [x, 2.117, -.019], [x, 2.207, -.019], .066);
  }
  return placeAlongRing(kit.finish(), 35, 2, 'Inner tidal floodgate', 'ring-tide-gate');
}

function tideGateApron() {
  const kit = new Monument();
  kit.box(pier, [0, .023, 0], [.625, .045, .382]);
  kit.box(ink, [-.087, .173, -.014], [.275, .261, .237]);
  kit.box(teal, [-.087, .308, -.014], [.295, .037, .262]);
  kit.box(stone, [-.151, .188, .112], [.105, .075, .021]);
  kit.box(copper, [-.029, .194, .113], [.021, .087, .022]);
  for (const x of [-.273, 0, .273]) {
    kit.beam(ink, [x, .059, .149], [x, .390, .149], .020);
    kit.beam(copper, [x, .360, .149], [x, .395, .149], .033);
  }
  for (const y of [.161, .324]) kit.beam(ink, [-.273, y, .149], [.273, y, .149], .016);
  for (const x of [-.270, .270]) kit.beam(ink, [x, .305, -.181], [x, .305, .140], .014);
  return placeAlongRing(kit.finish(), 36.50, 1.50, 'Floodgate fenced service apron', 'ring-tide-apron');
}

function breakwater() {
  const kit = new Monument();
  for (let index = 0; index < 18; index++) {
    const x = .4 + index * .206;
    const a = ringAngle(x);
    const position = ringPosition(x, 4.42);
    const level = -.36 + .047 * Math.sin(index * 2.4);
    kit.box(index % 4 ? pier : shadow, [position.x, level, position.z], [.212, .75, .394], a);
    kit.box(index % 4 ? stone : cream, [position.x, level + .419, position.z], [.218, .095, .359], a);
    if (index % 3 > 0) continue;
    kit.box(cream, [position.x, level + .535, position.z], [.104, .233, .324], a);
  }
  const tower = ringPosition(.45, 4.42);
  kit.beam(ink, [tower.x, .166, tower.z], [tower.x, 1.04, tower.z], .053);
  kit.beam(copper, [tower.x, .909, tower.z], [tower.x, 1.039, tower.z], .106);
  kit.beam(lantern, [tower.x, 1.032, tower.z], [tower.x, 1.232, tower.z], .094);
  kit.beam(ink, [tower.x, 1.23, tower.z], [tower.x, 1.29, tower.z], .110);
  const group = kit.finish();
  group.name = 'Outer pilots’ breakwater and range light';
  return group;
}

function piledDeck(kit: Monument, length: number, width: number) {
  kit.box(shadow, [0, -.168, 0], [length + .057, .254, width + .064]);
  kit.box(timber, [0, -.023, 0], [length + .085, .073, width + .084]);
  const count = Math.ceil(length * 6);
  for (let board = 0; board < count; board++) {
    const x = length * ((board + .5) / count - .5);
    kit.box(board % 3 ? dryTimber : timber, [x, .023, 0], [length / count - .009, .045, width]);
  }
  for (const x of [-.43, 0, .43]) for (const side of [-1, 1]) {
    const z = side * width * .411;
    kit.beam(timber, [x * length, -.91, z], [x * length, .198, z], .072);
    kit.beam(ink, [x * length, -.253, z], [x * length, -.307, z], .079);
  }
  for (const side of [-1, 1]) {
    const z = side * width * .453;
    kit.beam(timber, [-length * .469, -.282, z], [length * .455, -.282, z], .044);
    kit.beam(timber, [-length * .424, -.76, z], [0, -.171, z], .042);
    kit.beam(timber, [0, -.81, z], [length * .433, -.171, z], .042);
  }
}

function servicePier() {
  const kit = new Monument();
  piledDeck(kit, 2.63, 1.367);
  kit.box(tile, [-.65, .483, -.059], [.89, .889, .759]);
  kit.box(stone, [-.65, .163, -.059], [.928, .121, .80]);
  kit.box(ink, [-.65, .486, .326], [.448, .671, .055]);
  kit.box(teal, [-.65, .499, .363], [.365, .604, .031]);
  for (const x of [-.761, -.65, -.538]) kit.box(ink, [x, .479, .382], [.016, .521, .019]);
  kit.box(ink, [-.65, .94, 0], [.937, .092, .831]);
  for (const side of [-1, 1]) kit.box(teal, [-.65, .988, side * .215], [1.015, .053, .458], 0, side * .275);
  kit.beam(copper, [-1.163, 1.055, 0], [-.137, 1.055, 0], .033);
  const post: Point = [.64, .207, .02];
  const head: Point = [.64, 1.933, .02];
  const hook: Point = [1.263, 1.75, .629];
  kit.box(shadow, [.64, .101, .02], [.333, .11, .303]);
  kit.beam(ink, post, head, .081);
  kit.beam(copper, [.64, 1.843, .02], hook, .052);
  kit.beam(teal, [.64, 1.48, .02], [1.043, 1.781, .434], .034);
  kit.beam(ink, hook, [1.263, .99, .629], .016);
  kit.ring(copper, [1.263, .94, .629], .063, .015, [0, .75, 0]);
  kit.beam(ink, [.326, .286, -.552], [.945, .286, -.552], .154);
  for (const x of [.344, .928]) kit.beam(copper, [x, .286, -.552], [x + .025, .286, -.552], .172);
  for (const x of [-1.09, 1.072]) {
    kit.beam(ink, [x, .053, .559], [x, .295, .559], .044);
    kit.beam(copper, [x, .294, .559], [x, .338, .559], .062);
  }
  return placeAlongRing(kit.finish(), 3.13, 19.90, 'Outer boatyard and lifting crane', 'ring-boat-yard');
}

function pilotsStation() {
  const kit = new Monument();
  piledDeck(kit, 1.60, 1.08);
  kit.box(stone, [0, .523, -.082], [1.199, .966, .768]);
  kit.box(cream, [0, .975, -.080], [1.257, .095, .807]);
  kit.box(ink, [0, 1.083, -.064], [1.388, .149, .894]);
  kit.box(teal, [0, 1.194, -.091], [1.201, .103, .704]);
  kit.box(copper, [0, 1.257, -.094], [1.14, .045, .660]);
  kit.box(teal, [-.284, .471, .329], [.303, .651, .087]);
  kit.box(ink, [.275, .650, .335], [.419, .371, .064]);
  kit.box(innerGlass, [.275, .662, .375], [.326, .279, .034]);
  kit.box(teal, [.275, .660, .393], [.028, .282, .013]);
  kit.box(cream, [.269, .479, .371], [.521, .062, .154]);
  kit.beam(ink, [.428, 1.18, -.172], [.428, 1.865, -.172], .034);
  kit.beam(copper, [.224, 1.720, -.172], [.618, 1.720, -.172], .023);
  kit.beam(lantern, [.428, 1.781, -.172], [.428, 1.849, -.172], .068);
  kit.beam(ink, [-.601, .05, .431], [-.601, .334, .431], .047);
  return placeAlongRing(kit.finish(), .97, 7.05, 'Pilots’ watch and signal station', 'ring-pilot-house');
}

function boardingSpur() {
  const kit = new Monument();
  for (const side of [-1, 1]) {
    const x = side * .722;
    for (const z of [-.514, .055, .617]) {
      kit.box(pier, [x, .043, z], [.174, .085, .153]);
      kit.beam(ink, [x, .076, z], [x, .309, z], .056);
      kit.beam(copper, [x, .265, z], [x, .301, z], .072);
      kit.beam(teal, [x, .311, z], [x, .337, z], .069);
    }
    kit.beam(ink, [x, .225, -.496], [x, .225, .055], .017);
    kit.beam(ink, [x, .225, .055], [x, .225, .60], .018);
    kit.box(timber, [side * .83, -.097, .572], [.143, .334, .257]);
    kit.box(cream, [side * .83, .058, .572], [.171, .053, .248]);
  }
  for (const z of [-.535, -.365, -.196]) kit.box(copper, [0, .017, z], [.09, .024, .085]);
  kit.box(timber, [0, .018, .575], [1.176, .028, .069]);
  kit.box(copper, [0, .032, .589], [.416, .019, .032]);
  kit.beam(ink, [.654, .062, -.474], [.654, .870, -.474], .039);
  kit.box(teal, [.653, .728, -.474], [.308, .259, .061]);
  kit.box(copper, [.653, .728, -.439], [.273, .221, .025]);
  kit.box(ink, [.653, .737, -.416], [.243, .184, .022]);
  kit.beam(cream, [.574, .708, -.400], [.725, .708, -.400], .014);
  kit.beam(cream, [.593, .742, -.399], [.691, .742, -.399], .014);
  kit.beam(cream, [.650, .732, -.399], [.650, .791, -.399], .013);
  kit.box(ink, [.653, .728, -.517], [.243, .184, .038]);
  kit.beam(cream, [.650, .663, -.544], [.650, .782, -.544], .014);
  kit.beam(cream, [.650, .782, -.544], [.601, .731, -.544], .013);
  kit.beam(cream, [.650, .782, -.544], [.702, .731, -.544], .013);
  kit.beam(ink, [-.718, .16, .579], [-.718, .602, .579], .033);
  kit.beam(lantern, [-.718, .590, .579], [-.718, .713, .579], .062);
  kit.beam(copper, [-.718, .710, .579], [-.718, .753, .579], .073);
  return placeAlongRing(kit.finish(), 37.50, 15.50, 'East ferry boarding jetty');
}

function abutmentRail() {
  const kit = new Monument();
  for (const x of [-.718, 0, .718]) {
    kit.box(pier, [x, .040, 0], [.178, .080, .169]);
    kit.beam(ink, [x, .055, 0], [x, .445, 0], .038);
    kit.beam(copper, [x, .419, 0], [x, .450, 0], .056);
  }
  for (const y of [.188, .362]) kit.beam(ink, [-.717, y, 0], [.718, y, 0], .023);
  return placeAlongRing(kit.finish(), 39.51, 14.22, 'Stone bridge abutment rail');
}

const maxArcEdge = .82;

function subdivideArcEdges(geometry: BufferGeometry) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = source.attributes.position;
  let hasLongEdges = false;
  for (let i = 0; i < position.count && !hasLongEdges; i += 3) {
    const a = position.getX(i);
    const b = position.getX(i + 1);
    const c = position.getX(i + 2);
    hasLongEdges = Math.max(a, b, c) - Math.min(a, b, c) > maxArcEdge;
  }
  if (!hasLongEdges) {
    if (source !== geometry) source.dispose();
    return geometry;
  }

  // Arc bending derives normals from the final faces. Only interpolate the authored data it preserves.
  const attributes = ['position', ...Object.keys(source.attributes).filter(name => name !== 'position' && name !== 'normal')];
  const streams = attributes.map(name => ({ name, attribute: source.attributes[name], values: [] as number[] }));
  const read = (index: number) => {
    const vertex: number[] = [];
    for (const { attribute } of streams) {
      const offset = index * attribute.itemSize;
      for (let component = 0; component < attribute.itemSize; component++) vertex.push(attribute.array[offset + component]);
    }
    return vertex;
  };
  const emit = (vertex: number[]) => {
    let offset = 0;
    for (const { attribute, values } of streams) {
      for (let component = 0; component < attribute.itemSize; component++) values.push(vertex[offset++]);
    }
  };
  const split = (a: number[], b: number[], c: number[]) => {
    const ab = Math.abs(a[0] - b[0]);
    const bc = Math.abs(b[0] - c[0]);
    const ca = Math.abs(c[0] - a[0]);
    const longest = Math.max(ab, bc, ca);
    if (longest <= maxArcEdge) {
      emit(a);
      emit(b);
      emit(c);
      return;
    }
    const [left, right, opposite] = longest === ab ? [a, b, c] : longest === bc ? [b, c, a] : [c, a, b];
    const halfway = left.map((value, part) => (value + right[part]) / 2);
    split(left, halfway, opposite);
    split(halfway, right, opposite);
  };
  for (let i = 0; i < position.count; i += 3) {
    const a = position.getX(i);
    const b = position.getX(i + 1);
    const c = position.getX(i + 2);
    if (Math.max(a, b, c) - Math.min(a, b, c) > maxArcEdge) {
      split(read(i), read(i + 1), read(i + 2));
      continue;
    }
    for (const { attribute, values } of streams) {
      const offset = i * attribute.itemSize;
      const end = offset + attribute.itemSize * 3;
      for (let component = offset; component < end; component++) values.push(attribute.array[component]);
    }
  }

  const tessellated = new BufferGeometry();
  for (const { name, attribute, values } of streams) {
    tessellated.setAttribute(name, new Float32BufferAttribute(values, attribute.itemSize, attribute.normalized));
  }
  if (source !== geometry) source.dispose();
  return tessellated;
}

export function buildRingArchitecture() {
  const architecture = buildCityArchitecture({ skyline: false });
  const city = new Group();
  city.name = 'Tidebound ring architecture';
  for (const parcel of [...architecture.children]) {
    if (parcel.userData.parcel) {
      parcel.traverse(piece => {
        if (!(piece instanceof Mesh)) return;
        const original = piece.geometry;
        piece.geometry = subdivideArcEdges(original);
        if (original !== piece.geometry) original.dispose();
      });
      city.add(bendCityGeometry(parcel));
    }
    parcel.traverse(piece => {
      if (piece instanceof Mesh) piece.geometry.dispose();
    });
  }
  const monument = observatory();
  const dial = tidalDial();
  monument.add(dial);
  city.add(monument, tideGate(), tideGateApron(), breakwater(), servicePier(), pilotsStation(), boardingSpur(), abutmentRail());
  city.userData.update = (time: number, darkness: number) => {
    dial.rotation.y = time * .000046;
    updateRingArchitecture(darkness);
  };
  return city;
}

export function updateRingArchitecture(darkness: number) {
  const night = Math.max(0, Math.min(1, darkness));
  lantern.emissiveIntensity = .015 + night * 1.03;
  innerGlass.emissiveIntensity = night * .46;
}
