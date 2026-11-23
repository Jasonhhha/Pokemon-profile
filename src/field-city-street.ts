import {
  BoxGeometry, BufferGeometry, CanvasTexture, Color, CylinderGeometry, DoubleSide, DynamicDrawUsage, Float32BufferAttribute, Group, IcosahedronGeometry,
  InstancedMesh, LatheGeometry, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, RingGeometry, ShaderMaterial,
  SphereGeometry, SRGBColorSpace,
  TorusGeometry, Vector2,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { batchStaticMeshes } from './field-mesh-batch';
import { cityAlleyBarriers, cityCourtyards, cityFountainSite, cityParcels, cityTerraceAt, cityTerraces, harborHeight,
  type CityAlleyBarrier, type CityCourtyard } from './field-city-layout';
import { bendCityGeometry, ringAngle, ringCoordinates, ringPosition, ringRadius, RING_PERIOD } from './field-ring-space';
import { props, tileAt, type Prop } from './field-layout';

type Paint = MeshStandardMaterial | MeshBasicMaterial;
type Position = [number, number, number];
export type CityLamp = { x: number; z: number; height: number };

const cube = new BoxGeometry(1, 1, 1);
const drum = new CylinderGeometry(1, 1, 1, 12);
const dome = new SphereGeometry(1, 15, 9);
const rock = new IcosahedronGeometry(1, 1);
const leaf = new IcosahedronGeometry(1, 0);
const taper = new CylinderGeometry(.44, 1, 1, 4);
const rim = new TorusGeometry(1, .14, 6, 18);
const lanternPane = new CylinderGeometry(1, .72, 1, 4);
const poolProfile = new LatheGeometry([
  [.82, .014], [.985, .014], [1, .083], [.973, .101], [.938, .117], [.928, .162], [.934, .298],
  [.975, .321], [.996, .348], [.984, .384], [.947, .412], [.855, .412], [.831, .391],
  [.805, .306], [.759, .249], [.735, .220], [0, .220],
].map(([r, y]) => new Vector2(r, y)), 52);
const lance = new BufferGeometry();
lance.setAttribute('position', new Float32BufferAttribute([
  0, 0, 0, .48, .11, .29, 0, .37, .42,
  0, .37, .42, .48, .11, .29, .29, .39, .79,
  0, .37, .42, .29, .39, .79, 0, .47, 1,
  0, 0, 0, 0, .37, .42, -.48, .11, .29,
  0, .37, .42, -.29, .39, .79, -.48, .11, .29,
  0, .37, .42, 0, .47, 1, -.29, .39, .79,
], 3));
const lanceCorners = lance.attributes.position;
const lanceUv = Array.from({ length: lanceCorners.count }, (_, index) => [lanceCorners.getX(index) + .5, lanceCorners.getZ(index)]).flat();
lance.setAttribute('uv', new Float32BufferAttribute(lanceUv, 2));
lance.computeVertexNormals();
const dark = new MeshStandardMaterial({ color: 0x314b52, metalness: .23, roughness: .59 });
const bronze = new MeshStandardMaterial({ color: 0xaf885d, metalness: .44, roughness: .44 });
const bright = new MeshStandardMaterial({ color: 0xd9bd8d, metalness: .31, roughness: .58 });
const granite = new MeshStandardMaterial({ color: 0x857f77, roughness: .88 });
const limestone = new MeshStandardMaterial({ color: 0xc3b5a1, roughness: .76 });
const satin = new MeshStandardMaterial({ color: 0x628e96, metalness: .22, roughness: .46 });
const timber = new MeshStandardMaterial({ color: 0x956446, roughness: .71 });
const plank = new MeshStandardMaterial({ color: 0xb78155, roughness: .82 });
const soil = new MeshStandardMaterial({ color: 0x584a3d, roughness: 1 });
const oxblood = new MeshStandardMaterial({ color: 0x945141, roughness: .54, metalness: .18 });
const bark = new MeshStandardMaterial({ color: 0x645548, roughness: 1 });
const brickShadow = new MeshStandardMaterial({ color: 0x815d55, roughness: .94 });
const civicStone = new MeshStandardMaterial({ color: 0xd2bc9b, roughness: .83 });
const darkHedge = new MeshStandardMaterial({ color: 0x58745e, roughness: 1 });
const leaves = [0x679077, 0x547e6c, 0x779676, 0x477768, 0x82a982].map(color => new MeshStandardMaterial({ color, roughness: .95 }));
const fernLeaves = [0x668c60, 0x758d59, 0x91a075, 0xa3aa79].map(color => new MeshStandardMaterial({ color, roughness: .96, side: DoubleSide }));
const blooms = [0xdcb592, 0xbf816d, 0xd8c685, 0xb9c7ae].map(color => new MeshStandardMaterial({ color, roughness: .89 }));
const brickwork = [0xa46e53, 0xa57560, 0x966551, 0xad785d, 0x906755, 0xb17e63].map(color => new MeshStandardMaterial({ color, roughness: .96 }));
const ashlar = [0xc1ac90, 0xaf9f88, 0xbdad94, 0xb8a787, 0xcab396].map(color => new MeshStandardMaterial({ color, roughness: .91 }));
const shale = new MeshStandardMaterial({ color: 0x596269, roughness: .94 });
const cloth = new MeshStandardMaterial({ color: 0xab9777, roughness: .97 });
const patina = new MeshStandardMaterial({ color: 0x5a6963, metalness: .21, roughness: .79 });
const masonryColors = new Set([...brickwork, ...ashlar]);
const vertexMasonry = new MeshStandardMaterial({ vertexColors: true, roughness: .93 });

function noise(x: number, y: number, salt: number) {
  const n = Math.imul(x + 79, 374761393) ^ Math.imul(y + 53, 668265263) ^ Math.imul(salt + 17, 1597334677);
  return ((Math.imul(n ^ (n >>> 13), 1274126177) ^ (n >>> 18)) >>> 0) / 4294967296;
}

function put(parent: Group, geometry: BufferGeometry, material: Paint, position: Position, scale: Position, pitch = 0, roll = 0) {
  const object = new Mesh(geometry, material);
  object.position.set(...position);
  object.scale.set(...scale);
  object.rotation.set(pitch, 0, roll);
  parent.add(object);
  return object;
}

function box(parent: Group, material: Paint, x: number, y: number, z: number, width: number, height: number, depth: number, roll = 0) {
  return put(parent, cube, material, [x, y, z], [width, height, depth], 0, roll);
}

function place(parent: Group, x: number, z: number, yaw = 0) {
  const group = new Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  parent.add(group);
  return group;
}

function post(parent: Group, x: number, z: number, high = .46) {
  put(parent, drum, granite, [x, .045, z], [.119, .09, .119]);
  put(parent, drum, dark, [x, high / 2, z], [.073, high - .01, .073]);
  put(parent, drum, bronze, [x, high - .064, z], [.082, .051, .082]);
  put(parent, dome, dark, [x, high - .008, z], [.079, .048, .079]);
}

function postbox(parent: Group) {
  put(parent, drum, granite, [0, .049, 0], [.183, .098, .183]);
  put(parent, drum, dark, [0, .143, 0], [.143, .176, .143]);
  put(parent, drum, oxblood, [0, .497, 0], [.137, .62, .137]);
  put(parent, dome, oxblood, [0, .798, 0], [.151, .070, .151]);
  put(parent, drum, oxblood, [0, .785, 0], [.158, .045, .158]);
  put(parent, drum, bright, [0, .742, 0], [.141, .012, .141]);
  box(parent, dark, 0, .649, .136, .170, .048, .025);
  box(parent, bronze, 0, .678, .141, .178, .014, .025);
  box(parent, limestone, 0, .561, .145, .094, .068, .014);
  for (const x of [-.024, .024]) box(parent, dark, x, .563, .154, .026, .012, .007);
  box(parent, bronze, .064, .431, .135, .014, .040, .025);
}

function lamp(parent: Group, glass: MeshStandardMaterial, sequence: number) {
  const double = sequence % 4 === 0;
  put(parent, drum, granite, [0, .048, 0], [.116, .095, .116]);
  put(parent, drum, dark, [0, .186, 0], [.080, .293, .080]);
  put(parent, drum, dark, [0, .937, 0], [.032, 1.38, .032]);
  for (const level of [.17, .28, .41, 1.449, 1.521]) put(parent, drum, bronze, [0, level, 0], [.041, .026, .041]);
  const heads = double ? [-.269, .269] : [0];
  if (double) put(parent, taper, dark, [0, 1.675, 0], [.058, .110, .058]);
  for (const side of heads) {
    if (side) {
      const sign = Math.sign(side);
      box(parent, dark, side * .392, 1.545, 0, .21, .041, .044, sign * .49);
      box(parent, dark, side * .791, 1.637, 0, .16, .039, .043, sign * .70);
      box(parent, dark, side, 1.717, 0, .043, .108, .052);
      put(parent, rim, dark, [side * .411, 1.622, 0], [.064, .069, .065], 0, sign * .72);
    } else {
      put(parent, drum, dark, [0, 1.674, 0], [.063, .215, .063]);
      put(parent, drum, bronze, [0, 1.711, 0], [.074, .033, .074]);
    }
    box(parent, dark, side, 1.781, 0, .166, .064, .165);
    put(parent, lanternPane, glass, [side, 1.915, 0], [.126, .211, .126]).rotation.y = Math.PI / 4;
    for (const x of [-.084, .084]) for (const z of [-.081, .081]) {
      const support = box(parent, dark, side + x * .93, 1.918, z * .93, .018, .228, .017, -Math.sign(x) * .123);
      support.rotation.x = Math.sign(z) * .125;
    }
    box(parent, dark, side, 2.026, 0, .208, .034, .205);
    put(parent, taper, dark, [side, 2.083, 0], [.144, .100, .143]).rotation.y = Math.PI / 4;
    put(parent, dome, bronze, [side, 2.147, 0], [.031, .034, .031]);
  }
  return heads;
}

function tree(parent: Group, variant: number) {
  put(parent, drum, granite, [0, .065, 0], [.262, .125, .258]);
  put(parent, drum, limestone, [0, .135, 0], [.247, .065, .244]);
  put(parent, drum, soil, [0, .166, 0], [.202, .027, .202]);
  for (const x of [-.16, 0, .16]) box(parent, dark, x, .178, 0, .018, .010, .342 - .45 * Math.abs(x));
  put(parent, drum, bark, [0, .73, 0], [.096, 1.13, .085], .07, -.08);
  put(parent, drum, bark, [.113, 1.11, .02], [.054, .46, .053], .18, -.48);
  const canopy: [Position, Position][] = [
    [[-.07, 1.44, 0], [.49, .45, .42]], [[-.42, 1.49, .016], [.38, .32, .36]], [[.38, 1.48, -.123], [.38, .32, .36]],
    [[.058, 1.85, -.105], [.37, .34, .35]], [[-.214, 1.69, .212], [.34, .31, .35]], [[.231, 1.57, .262], [.31, .296, .30]],
    [[-.29, 1.50, -.24], [.323, .311, .277]], [[.257, 1.79, -.239], [.293, .28, .33]],
  ];
  canopy.forEach(([position, scale], index) => {
    const mesh = put(parent, rock, leaves[(index + variant * 2) % leaves.length], position, scale, index * .4);
    mesh.rotation.y = (variant * 13 + index * 7) / 5;
  });
}

function railing(parent: Group, length: number, high = .61) {
  for (let x = 0; x <= length + .02; x += .30) {
    const isPost = Math.round(x * 10) % 6 === 0;
    put(parent, drum, dark, [x, high * .5, 0], [isPost ? .035 : .018, high, isPost ? .035 : .018]);
    if (isPost) put(parent, dome, bronze, [x, high + .029, 0], [.047, .036, .047]);
  }
  for (const height of [.18, .41, high]) box(parent, height === high ? bronze : dark, length / 2, height, 0, length + .04, .027, .045);
}

function flowerBed(parent: Group, radius: number, index: number) {
  put(parent, drum, granite, [0, .10, 0], [radius, .20, radius * .85]);
  put(parent, drum, limestone, [0, .213, 0], [radius * 1.08, .056, radius * .91]);
  put(parent, drum, soil, [0, .242, 0], [radius * .94, .017, radius * .80]);
  for (let i = 0; i < 10; i++) {
    const angle = i * 2.4 + index;
    const distance = (.17 + i * .06) * radius;
    const x = Math.sin(angle) * distance;
    const z = Math.cos(angle) * distance;
    const height = .11 + (i % 3) * .032;
    put(parent, leaf, leaves[(i + index) % leaves.length], [x, .274 + height * .53, z], [.052, height * .49, .036], .2, i);
    put(parent, leaf, blooms[(i + index) % blooms.length], [x, .281 + height, z], [.041, .032, .041]);
  }
}

function bench(parent: Group) {
  for (const x of [-.44, .44]) {
    box(parent, dark, x, .135, 0, .083, .24, .25);
    box(parent, bronze, x, .258, .042, .093, .042, .29);
    box(parent, dark, x, .393, -.113, .052, .30, .050);
    box(parent, dark, x, .379, .021, .049, .045, .250);
  }
  for (const z of [-.106, .023, .152]) box(parent, plank, 0, .299, z, 1.16, .057, .104);
  for (const y of [.396, .495]) box(parent, timber, 0, y, -.137, 1.16, .069, .058);
}

function guidepost(parent: Group, message: string) {
  post(parent, 0, 0, .48);
  put(parent, drum, dark, [0, .82, 0], [.047, 1.24, .047]);
  box(parent, bronze, 0, 1.34, .022, .83, .265, .074);
  const canvas = document.createElement('canvas');
  canvas.width = 344;
  canvas.height = 108;
  const ink = canvas.getContext('2d')!;
  ink.fillStyle = '#304e53';
  ink.fillRect(0, 0, 344, 108);
  ink.strokeStyle = '#cda979';
  ink.lineWidth = 3;
  ink.strokeRect(5, 5, 334, 98);
  ink.textAlign = 'center';
  ink.textBaseline = 'middle';
  ink.font = '700 34px system-ui';
  ink.fillStyle = '#f5d9a8';
  ink.fillText(message, 172, 57, 301);
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  const sign = new MeshBasicMaterial({ map, toneMapped: false });
  box(parent, sign, 0, 1.34, .066, .768, .222, .013);
}

function crate(parent: Group) {
  for (let i = 0; i < 2; i++) {
    const x = i * .39 - .19;
    box(parent, timber, x, .18, -.024, .34, .35, .45);
    for (const edge of [-.143, .143]) box(parent, plank, x + edge, .18, .206, .047, .34, .026);
    box(parent, plank, x, .181, .21, .37, .048, .027, .46);
    box(parent, dark, x, .352, .027, .13, .023, .28);
  }
}

function winch(parent: Group) {
  box(parent, granite, 0, .065, 0, .66, .13, .66);
  box(parent, dark, 0, .26, 0, .47, .27, .41);
  for (const side of [-1, 1]) {
    put(parent, drum, dark, [side * .205, .394, .021], [.179, .054, .179], 0, Math.PI / 2);
    put(parent, drum, bronze, [side * .242, .394, .021], [.087, .042, .087], 0, Math.PI / 2);
  }
  for (const y of [-.098, -.061, -.024, .013, .05, .087]) put(parent, drum, bright, [y, .398, .023], [.091, .028, .091], 0, Math.PI / 2);
}

function streetPedestal(parent: Group, x: number, z: number) {
  if (x < 11) {
    box(parent, granite, 0, .058, 0, .570, .114, .379);
    post(parent, -.163, .011, .411);
    post(parent, .164, .011, .411);
    for (let pass = 0; pass < 3; pass++) {
      put(parent, rim, pass === 1 ? cloth : bright, [(pass - 1) * .074, .139 + pass * .039, -.004], [.139, .084, .115], -.96, -.112);
    }
  } else if (x > 30 || z < 12) {
    put(parent, drum, granite, [0, .054, 0], [.188, .103, .168]);
    put(parent, drum, limestone, [0, .126, 0], [.168, .036, .153]);
    put(parent, drum, patina, [0, .332, 0], [.089, .411, .088]);
    put(parent, drum, bronze, [0, .546, 0], [.123, .042, .105]);
    box(parent, dark, -.102, .490, 0, .249, .032, .062, .14);
    box(parent, bronze, .109, .467, -.009, .050, .085, .057);
    put(parent, rim, dark, [-.174, .507, -.028], [.041, .052, .037]);
  } else {
    box(parent, granite, 0, .061, 0, .534, .118, .372);
    box(parent, ashlar[3], 0, .155, 0, .492, .095, .311);
    box(parent, limestone, 0, .226, 0, .526, .038, .347);
    box(parent, soil, 0, .249, 0, .439, .016, .257);
    for (let plant = 0; plant < 4; plant++) fernSpray(parent, (plant - 1.5) * .105, .253, .013 * (plant % 2), .096, x + z + plant);
  }
}

function fixture(root: Group, native: Group, prop: Prop, glass: MeshStandardMaterial, lamps: CityLamp[], polar: boolean) {
  const { kind, variant = 0, x, y } = prop;
  if (['cottage', 'station', 'beacon', 'boat'].includes(kind)) return;
  const centerX = x + .5;
  const centerZ = y + .80;
  if (cityParcels.some(lot => centerX >= lot.x && centerX < lot.x + lot.width && centerZ >= lot.z && centerZ < lot.z + lot.depth)) return;
  if (kind === 'lamp') {
    streetLamp(native, centerX, y + .66, polar, glass, lamps, x + y);
    return;
  }
  if (kind === 'flowers') {
    const verge = streetAnchor(native, x + .19, y + .17, polar);
    flowerBed(verge, .079 + variant * .009, x + y);
    verge.scale.y = .63 + .035 * variant;
    return;
  }
  if (kind === 'rock' || kind === 'crate' || kind === 'winch') {
    const anchor = streetAnchor(native, centerX, y + .49, polar);
    if (kind === 'rock') streetPedestal(anchor, x, y);
    else if (kind === 'crate') crate(anchor);
    else winch(anchor);
    if (kind !== 'rock') anchor.scale.z = .67;
    return;
  }
  const at = place(root, centerX, centerZ);
  switch (kind) {
    case 'oak':
    case 'pine':
      tree(at, variant);
      break;
    case 'fence':
      railing(at, variant + .77);
      at.position.x -= .40;
      break;
    case 'sign':
    case 'banner':
      guidepost(at, 'CENTRAL →');
      break;
    case 'arch':
      break;
  }
}

function fountain(root: Group, polar: boolean) {
  const { x, z, width, depth } = cityFountainSite;
  const column = x + width * .5, row = z + depth * .5;
  const tangent = polar ? ringRadius(row) * Math.PI * 2 / RING_PERIOD : 1;
  const radial = polar ? .48 : 1;
  const radiusX = width * tangent * .416, radiusZ = depth * radial * .407;
  const well = streetAnchor(root, column, row, polar);
  put(well, poolProfile, limestone, [0, 0, 0], [radiusX, 1, radiusZ]);
  for (let block = 0; block < 33; block++) {
    const turn = (block + .49) * Math.PI * 2 / 33;
    const sin = Math.sin(turn), cos = Math.cos(turn);
    const basis = Math.atan2(sin * radiusZ, cos * radiusX);
    const length = Math.hypot(cos * radiusX, sin * radiusZ) * .173;
    const coping = place(well, sin * radiusX * .911, cos * radiusZ * .914, basis);
    const tone = ashlar[Math.floor(noise(block, 15, 61) * ashlar.length)];
    box(coping, tone, 0, .408, 0, length, .032, .10);
    box(coping, block % 5 === 2 ? civicStone : limestone, 0, .426, 0, length * .954, .017, .084);
    if (block % 4 === 1) box(coping, tone, 0, .232, .021, Math.max(.031, length * .49), .110, .027);
  }
  put(well, drum, granite, [0, .251, 0], [.235, .119, .228]);
  put(well, drum, civicStone, [0, .327, 0], [.19, .069, .188]);
  put(well, drum, ashlar[1], [0, .452, 0], [.126, .224, .126]);
  for (let notch = 0; notch < 8; notch++) {
    const turn = notch * Math.PI / 4;
    const at = place(well, Math.sin(turn) * .123, Math.cos(turn) * .123, turn);
    box(at, limestone, 0, .458, 0, .032, .152, .022);
  }
  put(well, drum, limestone, [0, .588, 0], [.174, .065, .168]);
  put(well, taper, bronze, [0, .674, 0], [.129, .115, .127]);
  put(well, drum, patina, [0, .732, 0], [.162, .048, .162]);
  put(well, drum, bright, [0, .762, 0], [.112, .021, .112]);
  put(well, dome, bronze, [0, .813, 0], [.084, .096, .083]);
  for (let notch = 0; notch < 6; notch++) {
    const turn = notch * Math.PI / 3;
    const spout = place(well, Math.sin(turn) * .133, Math.cos(turn) * .133, turn);
    box(spout, bronze, 0, .719, .031, .033, .035, .079);
    box(spout, dark, 0, .716, .078, .020, .020, .028);
  }
  return { x: column, z: row, radiusX, radiusZ };
}

function cutLongChords(geometry: BufferGeometry) {
  const position = geometry.attributes.position;
  const streams = Object.entries(geometry.attributes).map(([name, attribute]) => ({ name, attribute, values: [] as number[] }));
  const positionStream = streams.findIndex(stream => stream.name === 'position');
  const cellSpan = .44;
  const coordinate = (corner: number[][]) => corner[positionStream][0];
  const append = (corner: number[][]) => corner.forEach((values, index) => streams[index].values.push(...values));
  const corner = (index: number) => streams.map(({ attribute }) => {
    const begin = index * attribute.itemSize;
    return Array.from(attribute.array.slice(begin, begin + attribute.itemSize));
  });
  function divide(a: number[][], b: number[][], c: number[][]) {
    const tips = [a, b, c];
    const spans = tips.map((point, index) => Math.abs(coordinate(point) - coordinate(tips[(index + 1) % 3])));
    const wide = Math.max(...spans);
    if (wide <= cellSpan) {
      tips.forEach(append);
      return;
    }
    const index = spans.indexOf(wide);
    const start = tips[index], end = tips[(index + 1) % 3], opposite = tips[(index + 2) % 3];
    const middle = start.map((attributes, channel) => attributes.map((value, component) => (value + end[channel][component]) / 2));
    divide(start, middle, opposite);
    divide(middle, end, opposite);
  }
  let changed = false;
  for (let i = 0; i < position.count; i += 3) {
    const x = position.getX(i), y = position.getX(i + 1), z = position.getX(i + 2);
    if (Math.max(x, y, z) - Math.min(x, y, z) > cellSpan) {
      changed = true;
      divide(corner(i), corner(i + 1), corner(i + 2));
    } else {
      for (const { attribute, values } of streams) {
        const begin = i * attribute.itemSize;
        for (let component = begin; component < begin + attribute.itemSize * 3; component++) values.push(attribute.array[component]);
      }
    }
  }
  if (!changed) return geometry;
  const curves = new BufferGeometry();
  for (const { name, attribute, values } of streams) {
    curves.setAttribute(name, new Float32BufferAttribute(values, attribute.itemSize, attribute.normalized));
  }
  return curves;
}

function collapseMasonry(batch: Group) {
  const pieces: Mesh<BufferGeometry, MeshStandardMaterial>[] = [];
  for (const object of batch.children) {
    if (!(object instanceof Mesh) || !masonryColors.has(object.material)) continue;
    pieces.push(object);
  }
  if (pieces.length < 2) return;
  for (const { geometry, material } of pieces) {
    const color = new Float32Array(geometry.attributes.position.count * 3);
    const { r, g, b } = material.color;
    for (let i = 0; i < color.length; i += 3) {
      color[i] = r;
      color[i + 1] = g;
      color[i + 2] = b;
    }
    geometry.setAttribute('color', new Float32BufferAttribute(color, 3));
  }
  const merged = mergeGeometries(pieces.map(piece => piece.geometry));
  if (!merged) return;
  for (const piece of pieces) {
    batch.remove(piece);
    piece.geometry.dispose();
  }
  const masonry = new Mesh(merged, vertexMasonry);
  masonry.castShadow = masonry.receiveShadow = true;
  batch.add(masonry);
}

function fixedBatch(source: Group, polar: boolean, joinMasonry = false) {
  const merged = batchStaticMeshes(source, material => material !== soil);
  if (!polar) {
    if (joinMasonry) collapseMasonry(merged);
    return merged;
  }
  merged.traverse(part => {
    if (!(part instanceof Mesh)) return;
    const original = part.geometry;
    part.geometry = cutLongChords(original);
    if (part.geometry !== original) original.dispose();
  });
  if (joinMasonry) collapseMasonry(merged);
  const curved = bendCityGeometry(merged);
  merged.traverse(part => { if (part instanceof Mesh) part.geometry.dispose(); });
  return curved;
}

function streetAnchor(root: Group, x: number, z: number, polar: boolean, yaw = 0) {
  if (!polar) return place(root, x, z, yaw);
  const point = ringPosition(x, z);
  return place(root, point.x, point.z, yaw + ringAngle(x));
}

function streetLamp(root: Group, x: number, z: number, polar: boolean, glass: MeshStandardMaterial, lamps: CityLamp[], sequence: number) {
  const at = streetAnchor(root, x, z, polar);
  const sin = Math.sin(at.rotation.y), cos = Math.cos(at.rotation.y);
  for (const offset of lamp(at, glass, sequence)) {
    const head = offset === 0 ? { x, z } : polar
      ? ringCoordinates(at.position.x + cos * offset, at.position.z - sin * offset)
      : { x: x + offset, z };
    lamps.push({ ...head, height: 1.916 });
  }
}

function stoneSeat(group: Group, x: number, z: number, rotation = 0) {
  const parent = place(group, x, z, rotation);
  for (const side of [-.34, .34]) {
    box(parent, granite, side, .064, 0, .200, .127, .28);
    box(parent, limestone, side, .200, 0, .159, .195, .25);
  }
  box(parent, civicStone, 0, .326, 0, 1.10, .098, .347);
  box(parent, limestone, 0, .268, 0, 1.04, .035, .308);
}

function clockStand(parent: Group) {
  for (const [y, height, radius] of [[.038, .076, .21], [.102, .054, .175], [.188, .134, .139], [.75, 1.24, .053]]) {
    put(parent, drum, y < .13 ? granite : dark, [0, y, 0], [radius, height, radius]);
  }
  put(parent, drum, bronze, [0, 1.354, 0], [.071, .111, .071]);
  put(parent, drum, dark, [0, 1.627, 0], [.254, .153, .254], Math.PI / 2);
  put(parent, drum, bronze, [0, 1.627, .084], [.222, .036, .222], Math.PI / 2);
  put(parent, drum, bright, [0, 1.627, .104], [.186, .013, .186], Math.PI / 2);
  for (let hour = 0; hour < 12; hour++) {
    const turn = hour * Math.PI / 6;
    box(parent, dark, Math.sin(turn) * .154, 1.627 + Math.cos(turn) * .154, .113, .012, hour % 3 === 0 ? .03 : .017, .008, -turn);
  }
  box(parent, dark, .026, 1.669, .121, .015, .116, .011, -.53);
  box(parent, oxblood, -.029, 1.604, .124, .014, .093, .009, -1.02);
  put(parent, dome, bronze, [0, 1.897, 0], [.075, .062, .076]);
}

function courtFeature(court: CityCourtyard, polar: boolean) {
  const root = new Group();
  const { feature } = court;
  const x = feature.x + feature.width / 2, z = feature.z + feature.depth / 2;
  const center = streetAnchor(root, x, z, polar);
  switch (court.kind) {
    case 'garden': {
      put(center, drum, granite, [0, .054, 0], [.597, .106, .405]);
      put(center, drum, civicStone, [0, .199, 0], [.535, .234, .332]);
      put(center, drum, ashlar[2], [0, .325, 0], [.582, .064, .380]);
      put(center, drum, soil, [0, .365, 0], [.504, .025, .317]);
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4;
        const at = place(center, Math.sin(angle) * .534, Math.cos(angle) * .328, angle);
        box(at, limestone, 0, .201, 0, .054, .167, .043);
        box(at, granite, 0, .101, 0, .072, .061, .050);
      }
      for (let stalk = 0; stalk < 26; stalk++) {
        const angle = stalk * 2.399, radius = .11 + (stalk % 7) * .034;
        const size = .071 + noise(stalk, 19, 105) * .061;
        const up = .40 + size * .91;
        const near = Math.sin(angle) * radius * 1.44, row = Math.cos(angle) * radius * .68;
        const model = stalk % 3 === 0 ? rock : leaf;
        put(center, model, leaves[stalk % leaves.length], [near, up, row], [size * 1.71, size * 1.48, size * .89], .53 * Math.sin(angle), angle * .67);
        if (stalk % 3 === 1) put(center, leaf, blooms[stalk % blooms.length], [near, up + size * 1.06, row], [.034, .07, .029], .12, angle);
      }
      for (const [spray, at] of [-.39, -.208, .019, .166, .363].entries()) {
        fernSpray(center, at, .377, .15 - .086 * (spray % 3), .147 + spray % 2 * .019, 68 + spray);
      }
      stoneSeat(center, -.94, 0);
      stoneSeat(center, .94, 0);
      break;
    }
    case 'market': {
      box(center, granite, 0, .044, 0, .671, .088, .421);
      box(center, ashlar[3], 0, .114, 0, .613, .075, .352);
      box(center, civicStone, 0, .177, 0, .522, .059, .312);
      box(center, limestone, 0, .357, 0, .403, .303, .272);
      for (const face of [-1, 1]) {
        box(center, bronze, 0, .366, face * .144, .181, .112, .014);
        box(center, patina, 0, .366, face * .154, .146, .080, .010);
        for (let line = 0; line < 3; line++) box(center, bright, 0, .389 - .021 * line, face * .161, .103 - line * .019, .004, .004);
      }
      box(center, ashlar[0], 0, .524, 0, .468, .072, .321);
      box(center, civicStone, 0, .571, 0, .326, .034, .248);
      put(center, taper, civicStone, [0, 1.18, 0], [.181, 1.185, .153]);
      put(center, taper, patina, [0, 1.824, 0], [.077, .146, .061]);
      break;
    }
    case 'station': {
      clockStand(center);
      const cabinet = place(center, .55, -.014, -.16);
      box(cabinet, granite, 0, .058, 0, .355, .102, .27);
      box(cabinet, patina, 0, .249, 0, .292, .295, .217);
      box(cabinet, shale, 0, .411, 0, .337, .055, .259);
      box(cabinet, dark, 0, .289, .111, .221, .167, .015);
      for (const x of [-.048, .048]) put(cabinet, drum, bright, [x, .292, .119], [.019, .012, .019], Math.PI / 2);
      box(cabinet, bronze, .063, .208, .121, .044, .014, .014);
      break;
    }
    case 'wharf': {
      box(center, granite, -.45, .055, 0, 1.16, .107, .473);
      box(center, ashlar[1], -.45, .234, 0, .994, .263, .416);
      box(center, satin, -.45, .361, 0, .824, .024, .310);
      for (const side of [-.18, .18]) {
        for (let block = 0; block < 4; block++) box(center, ashlar[block], -.793 + .229 * block, .412, side, .222, .071, .066);
      }
      for (const end of [-.935, .035]) box(center, civicStone, end, .414, 0, .075, .079, .395);
      put(center, drum, granite, [.471, .059, 0], [.182, .105, .168]);
      put(center, drum, dark, [.471, .317, 0], [.098, .444, .097]);
      put(center, drum, patina, [.471, .538, 0], [.155, .093, .143]);
      put(center, rim, dark, [.466, .582, .057], [.158, .158, .158]);
      for (let i = 0; i < 4; i++) box(center, bronze, .465, .582, .062, .289, .027, .026, i * Math.PI / 4);
      box(center, bronze, .227, .560, 0, .361, .044, .055);
      put(center, drum, patina, [.086, .508, 0], [.068, .136, .061]);
      box(center, satin, .086, .440, 0, .023, .074, .022);
      const materials = place(center, .974, .071, -.12);
      timberStack(materials, .545, .333, 31);
      cargoDrum(materials, .316, -.042, .112, .317, timber);
      put(materials, rock, cloth, [-.195, .319, -.028], [.177, .069, .109], .14, .21);
      break;
    }
  }
  const merged = fixedBatch(root, false);
  merged.name = `Courtyard landmark · ${court.id}`;
  return merged;
}

function bondedWall(wall: Group, span: number, metre: number, across: number, height: number, brick: boolean, seed: number) {
  const bedding = brick ? brickShadow : granite;
  const finish = brick ? brickwork : ashlar;
  const thickness = Math.min(.124, .061 / across);
  const waist = .136;
  box(wall, bedding, 0, (height + waist) * .5, 0, span, height - waist, thickness);
  box(wall, ashlar[1], 0, .111, 0, span, .215, thickness + .036);
  box(wall, granite, 0, .042, 0, span + .005, .076, thickness + .044);
  const courses = brick ? Math.round((height - .22) / .092) : Math.max(2, Math.round((height - .18) / .15));
  const rise = (height - .211) / courses;
  for (let level = 0; level < courses; level++) {
    const stones = Math.max(1, Math.round(span * metre / (brick ? .30 : .49)));
    const phase = (level % 2) * .48 + noise(seed, level, 71) * .22;
    const cut = (index: number) => (index - phase + (noise(seed, level, index + 128) - .5) * .36) * span / stones - span * .5;
    for (let joint = 0; joint <= stones; joint++) {
      const left = Math.max(-span / 2 + .003, cut(joint) + .004 / metre);
      const right = Math.min(span / 2 - .003, cut(joint + 1) - .004 / metre);
      if ((right - left) * metre < .034) continue;
      const pick = Math.floor(noise(seed, level, joint + 211) * finish.length);
      box(wall, finish[pick], (left + right) / 2, .211 + rise * (level + .5), 0,
        right - left, rise - .009, thickness + .009 + noise(seed, level, joint + 76) * .017);
    }
  }
  const tops = Math.max(2, Math.round(span * metre / .43));
  for (let index = 0; index < tops; index++) {
    const at = ((index + .5) / tops - .5) * span;
    const stone = ashlar[Math.floor(noise(seed, index, 109) * ashlar.length)];
    box(wall, stone, at, height + .023, 0, span / tops - .009 / metre, .060, thickness + .081);
    box(wall, index % 3 === 2 ? stone : limestone, at, height + .058, 0, span / tops - .009 / metre, .019, thickness + .059);
  }
  const piers = span * metre > 6 ? Math.floor(span * metre / 2.8) : 1;
  for (let i = 0; i < piers; i++) {
    const at = piers > 1 ? ((i + .45) / piers - .5) * span : 0;
    const width = Math.min(.21 / metre, span * .46);
    box(wall, brick ? brickwork[(seed + i + brickwork.length * 100) % brickwork.length] : ashlar[1],
      at, (height + .059) * .5, 0, width, height + .059, thickness + .098);
    box(wall, civicStone, at, height + .103, 0, width + .030 / metre, .071, thickness + .103);
  }
}

function yardFence(wall: Group, span: number, metre: number, across: number, height: number) {
  const counts = Math.max(1, Math.round(span * metre / .29));
  box(wall, shale, 0, .047, 0, span, .089, Math.min(.125, .089 / across));
  for (let slot = 0; slot <= counts; slot++) {
    const x = (slot / counts - .5) * span;
    const upright = slot % 4 === 0 || slot === counts;
    const width = (upright ? .036 : .019) / metre;
    box(wall, dark, x, height * .50, 0, width, height, .031 / across);
    box(wall, upright ? bronze : dark, x, height + .025, 0, width * (upright ? 1.42 : 1.15), .046, .039 / across, upright ? 0 : .22);
    if (upright) box(wall, granite, x, .083, 0, width * 1.43, .13, .045 / across);
  }
  for (const position of [.17, height - .089]) box(wall, dark, 0, position, 0, span, .023, .029 / across);
  box(wall, patina, 0, height + .012, 0, span, .027, .035 / across);
}

function timberStack(parent: Group, wide: number, deep: number, key: number) {
  for (const x of [-wide * .29, wide * .29]) box(parent, shale, x, .047, 0, wide * .14, .093, deep);
  for (let piece = 0; piece < 4; piece++) {
    const width = wide * (.81 + noise(key, piece, 66) * .20);
    const level = .108 + piece * .063;
    box(parent, piece % 3 === 1 ? timber : plank, (piece % 2 - .5) * .052, level, (piece % 2 - .5) * .022,
      width, .047, deep * (.86 - piece * .11));
  }
  for (const x of [-wide * .26, wide * .26]) box(parent, dark, x, .318, 0, .026, .018, deep * .54);
}

function cargoDrum(parent: Group, x: number, z: number, radius: number, height: number, tone: Paint) {
  const profile = [[.02, .10, .83], [.105, .31, .96], [.39, .31, 1], [.70, .28, .94], [.92, .13, .81]];
  for (const [center, size, scale] of profile) {
    put(parent, drum, tone, [x, height * (center + size * .5), z], [radius * scale, size * height, radius * scale]);
  }
  for (const [level, scale] of [[.19, .99], [.74, .96], [.962, .86]]) {
    put(parent, drum, dark, [x, height * level, z], [radius * scale, .023, radius * scale]);
  }
  for (const length of [-.45, .45]) box(parent, timber, x + length * radius, height * 1.054, z, .013, .009, radius * .91);
}

function deliveryHandcart(parent: Group) {
  box(parent, timber, -.060, .232, 0, .665, .061, .164);
  for (const side of [-1, 1]) {
    const tire = put(parent, rim, dark, [-.085, .132, side * .117], [.108, .108, .108]);
    tire.rotation.z = side * .04;
    put(parent, drum, bronze, [-.085, .132, side * .122], [.032, .035, .032], Math.PI / 2);
    for (let spoke = 0; spoke < 4; spoke++) {
      box(parent, plank, -.085, .132, side * .118, .198, .012, .018, spoke * Math.PI / 4);
    }
    box(parent, patina, .278, .286, side * .056, .358, .024, .022, .14);
    box(parent, dark, .216, .128, side * .053, .023, .225, .024, -.285);
    box(parent, plank, -.055, .279, side * .066, .61, .039, .039);
  }
  for (const [index, x] of [-.247, -.052, .131].entries()) {
    put(parent, rock, index === 1 ? timber : cloth, [x, .316, 0], [.104, .071, .079], index * .13, -.11);
    box(parent, bright, x - .010, .372, 0, .033, .018, .042);
  }
}

function fernSpray(parent: Group, x: number, y: number, z: number, radius: number, seed: number) {
  for (let shoot = 0; shoot < 6; shoot++) {
    const angle = shoot * Math.PI / 3 + seed * .35;
    const size = radius * (.68 + noise(seed, shoot, 19) * .58);
    const twig = place(parent, x, z, angle);
    put(twig, lance, fernLeaves[(seed + shoot) % fernLeaves.length], [0, y, 0],
      [size * .63, size * 1.06, size], -.24 - (shoot % 3) * .19, (shoot % 2 - .5) * .26);
  }
}

function yardDetail(root: Group, shape: CityAlleyBarrier, polar: boolean) {
  const { x, z, width, depth, kind } = shape;
  const row = z + depth * .5;
  const tangent = polar ? ringRadius(row) * Math.PI * 2 / RING_PERIOD : 1;
  const radial = polar ? .48 : 1;
  const seed = x * 17 + z * 31;
  const across = Math.min(.94, depth * radial - .21);
  if (across < .21) return;
  const totalWidth = width * tangent;
  const slots = totalWidth > 7.5 ? 3 : totalWidth > 4.9 ? 2 : 1;
  const tangentSize = Math.min(totalWidth / slots - .29, 2.75);
  for (let i = 0; i < slots; i++) {
    const at = x + width * (i + .5) / slots;
    const anchor = streetAnchor(root, at, row, polar);
    const pattern = (seed + i * 7) % 5;
    if (kind === 'brick' && x >= 24 && x <= 26 && z >= 32 && z <= 33) {
      deliveryHandcart(anchor);
      timberStack(place(anchor, Math.min(.85, tangentSize * .32), -.011), .481, Math.min(across * .73, .21), seed + i);
    } else if (kind === 'stone' && x === 12 && z === 26) {
      const planter = place(anchor, .04, 0);
      box(planter, ashlar[2], 0, .147, 0, .787, .085, across * .53);
      box(planter, shale, 0, .189, 0, .787, .022, across * .47);
      for (let sprig = 0; sprig < 6; sprig++) fernSpray(planter, (sprig - 2.5) * .128, .201, 0, across * .26, seed + sprig);
    } else if (kind === 'iron' || kind === 'brick' && (x < 11 || x >= 26)) {
      if (pattern < 2) timberStack(anchor, Math.min(tangentSize * .68, tangent * .39), across * .95, seed + i);
      else {
        for (let j = 0; j < Math.min(3, Math.floor(tangentSize * 1.6)); j++) {
          const radius = Math.min(across * .44, .127 + j * .018);
          const each = (j - .9) * Math.min(.46, tangentSize / 4);
          cargoDrum(anchor, each, 0, radius, .36 + (j % 2) * .096, j % 2 ? patina : timber);
        }
      }
    } else {
      const total = Math.max(3, Math.round(tangentSize * 5));
      for (let j = 0; j < total; j++) {
        const left = ((j + noise(seed, i, j + 52)) / total - .5) * tangentSize * .80;
        const offset = (noise(seed, i, j + 124) - .5) * across * .31;
        const size = .05 + noise(seed, i, j + 62) * .08;
        const height = .11 + noise(seed, j, i + 19) * .25;
        if (j % 3 === 0) fernSpray(anchor, left, .131, offset, Math.min(.158, across * .29), seed + i + j);
        else {
          put(anchor, leaf, leaves[(seed + i + j) % leaves.length], [left, .128 + height * .5, offset], [size, height, size * .68], .21, (j % 5 - 2) * .19);
          if (j % 4 === 0) put(anchor, leaf, blooms[(seed + i + j) % blooms.length], [left, .129 + height, offset], [.034, .042, .034]);
        }
      }
    }
  }
}
function enclosure(spec: CityAlleyBarrier, polar: boolean) {
  const root = new Group();
  const { x, z, width, depth, kind } = spec;
  const wide = width - .11, deep = depth - .13;
  const seed = x * 37 + z * 29;
  const tangent = polar ? ringRadius(z + depth * .5) * Math.PI * 2 / RING_PERIOD : 1;
  const radial = polar ? .48 : 1;
  const center = place(root, x + width / 2, z + depth / 2);
  const base = kind === 'brick' ? brickShadow : kind === 'iron' ? shale : granite;
  box(center, base, 0, .040, 0, wide, .076, deep);
  box(center, ashlar[seed % ashlar.length], 0, .089, 0, wide + .025, .037, deep + .033);
  box(center, kind === 'iron' ? shale : soil, 0, .117, 0, wide - .09, .021, deep - .10);
  if (kind === 'hedge') {
    const columns = Math.ceil(wide * tangent * 2.34), rows = Math.ceil(deep * radial * 2.74);
    box(center, darkHedge, 0, .202, 0, wide * .92, .112, deep * .76);
    for (let i = 0; i < columns; i++) for (let j = 0; j < rows; j++) {
      const phase = noise(seed, i, j + 32);
      const at = ((i + .44 + phase * .08) / columns - .5) * wide * .91;
      const across = ((j + .5) / rows - .5) * deep * .85;
      const height = .174 + phase * .169;
      put(center, rock, phase > .64 ? darkHedge : leaves[(i + j + seed) % leaves.length], [at, .216 + height * .42, across],
        [wide / columns * .61, height, deep / rows * .46], Math.sin(i) * .021, .015 * j);
      if (phase > .70) {
        for (let blossom = 0; blossom < 3; blossom++) {
          const drift = (blossom - 1) * wide / columns * .31;
          put(center, leaf, blooms[(blossom + seed) % blooms.length], [at + drift, .251 + height * 1.26, across],
            [.023 / tangent, .022, .039 / radial]);
        }
      }
    }
  } else {
    const long = width * tangent >= depth * radial;
    const span = long ? wide : deep;
    const range = long ? deep : wide;
    const metre = long ? tangent : radial, across = long ? radial : tangent;
    const brick = kind === 'brick';
    const top = brick ? .647 + noise(seed, 15, 4) * .186 : .445 + noise(seed, 15, 5) * .114;
    for (const side of [-1, 1]) {
      const edge = side * (range / 2 - .143);
      const wall = place(center, long ? 0 : edge, long ? edge : 0, long ? 0 : Math.PI / 2);
      const height = top - (side > 0 ? .135 : 0);
      if (kind === 'iron') yardFence(wall, span - .102, metre, across, side > 0 ? .56 : .72);
      else bondedWall(wall, span - .134, metre, across, height, brick, seed + side);
    }
    for (const side of [-1, 1]) {
      const edge = side * (span / 2 - .125);
      const end = place(center, long ? edge : 0, long ? 0 : edge, long ? Math.PI / 2 : 0);
      if (kind === 'iron') yardFence(end, range - .248, across, metre, .59);
      else bondedWall(end, range - .209, across, metre, top * .77, brick, seed + side * 3);
    }
  }
  const merged = fixedBatch(root, polar, true);
  if (kind !== 'hedge') {
    const working = new Group();
    yardDetail(working, spec, polar);
    merged.add(fixedBatch(working, false));
  }
  merged.name = `Alley boundary · ${kind} ${x},${z}`;
  return merged;
}

function sconce(root: Group, x: number, z: number, glass: MeshStandardMaterial, lamps: CityLamp[], polar: boolean) {
  const at = streetAnchor(root, x, z, polar);
  post(at, 0, 0, .56);
  put(at, drum, dark, [0, .997, 0], [.039, 1.31, .039]);
  put(at, drum, bronze, [0, 1.388, 0], [.063, .051, .063]);
  put(at, drum, glass, [0, 1.541, 0], [.106, .187, .109]);
  for (const x of [-.075, .075]) for (const z of [-.052, .052]) box(at, dark, x, 1.553, z, .020, .205, .021);
  put(at, taper, dark, [0, 1.681, 0], [.137, .092, .137]);
  put(at, dome, bronze, [0, 1.735, 0], [.052, .051, .052]);
  lamps.push({ x, z, height: 1.541 });
}

function promenadeBays(root: Group, glass: MeshStandardMaterial, lamps: CityLamp[], polar: boolean) {
  const row = harborHeight - 1;
  const columns = [6, 9, 13, 16, 20, 24, 27, 30, 34];
  for (const [index, column] of columns.entries()) {
    const kind = tileAt('harbor', column, row);
    if (kind === 'water' || kind === 'shelf' || kind === 'drop') continue;
    const at = streetAnchor(root, column + .51, row + .54, polar);
    if (column < 12) mooringBay(at, column === 9);
    else if (column < 23) gardenBay(at, index);
    else if (column < 30) tradingBay(at, column === 24);
    else signalBay(at, column === 34);
    if (index % 2 === 0) sconce(root, column + .19, row + .57, glass, lamps, polar);
  }
}

function mooringBay(root: Group, withRope: boolean) {
  const rail = place(root, 0, .031);
  yardFence(rail, 1.48, 1, 1, .369);
  for (const x of [-.91, .91]) {
    box(root, ashlar[1], x, .081, 0, .245, .159, .225);
    put(root, drum, dark, [x, .235, -.035], [.086, .159, .084]);
    put(root, drum, bronze, [x, .305, -.035], [.113, .038, .091]);
  }
  if (withRope) {
    for (let loop = 0; loop < 3; loop++) {
      put(root, rim, loop % 2 ? cloth : bright, [-.909 + loop * .073, .193 + loop * .019, -.060],
        [.116, .052, .094], -Math.PI / 2 + .21 * loop, .19 * loop);
    }
    box(root, timber, .056, .089, -.036, .492, .119, .147, -.03);
  }
}

function gardenBay(root: Group, index: number) {
  const span = index === 4 ? 1.30 : .84;
  if (index !== 4) stoneSeat(root, index % 2 ? -.425 : .41, -.014);
  const position = index === 4 ? .11 : index % 2 ? .51 : -.53;
  box(root, granite, position, .047, -.006, span, .092, .27);
  box(root, limestone, position, .139, -.001, span - .095, .111, .23);
  box(root, ashlar[2], position, .203, -.004, span, .047, .262);
  box(root, soil, position, .228, -.004, span - .075, .018, .211);
  const count = Math.round(span * 7);
  for (let seedling = 0; seedling < count; seedling++) {
    const x = position + span * ((seedling + .46) / count - .5);
    const height = .077 + noise(index, seedling, 112) * .084;
    const tone = fernLeaves[(index + seedling) % fernLeaves.length];
    put(root, leaf, tone, [x, .238 + height * .61, -.004], [.060, height, .056], -.13, .31 * seedling);
    if (seedling % 3 !== 1) {
      put(root, leaf, blooms[(index + seedling) % blooms.length], [x + .017, .251 + height * 1.54, .008], [.029, .039, .032]);
    }
  }
}

function tradingBay(root: Group, withCart: boolean) {
  if (withCart) deliveryHandcart(place(root, -.34, -.018));
  else timberStack(place(root, -.41, -.017), .64, .254, 13);
  for (const [index, x] of [.33, .63, .89].entries()) {
    cargoDrum(root, x, -.014, .100 + index * .019, index ? .312 : .371, index % 2 ? patina : timber);
  }
  box(root, dark, .304, .057, -.027, 1.162, .063, .322);
  yardFence(place(root, 0, .118), 1.968, 1, 1, .405);
}

function signalBay(root: Group, withDial: boolean) {
  for (const x of [-.54, .54]) box(root, granite, x, .069, -.034, .126, .136, .233);
  box(root, timber, 0, .239, -.022, 1.241, .038, .242);
  box(root, patina, 0, .175, .04, 1.124, .086, .055);
  if (withDial) {
    put(root, drum, granite, [.91, .054, -.051], [.129, .102, .108]);
    put(root, drum, dark, [.91, .242, -.051], [.059, .342, .052]);
    put(root, drum, bronze, [.91, .423, -.024], [.132, .046, .108], -.44);
    put(root, drum, civicStone, [.91, .446, -.013], [.113, .018, .099], -.44);
    box(root, dark, .91, .458, .014, .077, .027, .011, -.21);
  } else yardFence(place(root, 0, .086), 1.503, 1, 1, .451);
}

function doorstepGoods(polar: boolean) {
  const root = new Group();
  const corner = cityTerraces.find(lot => lot.id === 'sailmakers-turn');
  if (corner?.sideFront) {
    const west = corner.sideFront === 'west';
    const boundary = west ? corner.x : corner.x + corner.width;
    const row = corner.z + .43;
    const inward = west ? 1 : -1;
    const tangent = polar ? ringRadius(row) * Math.PI * 2 / RING_PERIOD : 1;
    const stoop = streetAnchor(root, boundary + inward * .091 / tangent, row, polar, west ? -Math.PI / 2 : Math.PI / 2);
    box(stoop, granite, 0, .044, 0, .347, .080, .152);
    box(stoop, timber, 0, .167, 0, .319, .172, .126);
    box(stoop, plank, 0, .249, .006, .337, .045, .144);
    for (const x of [-.046, .073]) {
      put(stoop, rim, cloth, [x, .316, .008], [.057, .078, .047], 0, .32 + x);
      put(stoop, rim, bright, [x, .323, .031], [.041, .054, .041], 0, .37 + x);
    }
    put(stoop, leaf, patina, [-.117, .301, -.014], [.041, .09, .043], 0, -.11);
  }
  const row = cityTerraces.find(lot => lot.id === 'market-row');
  if (row) {
    const reverse = row.facing === 'outer';
    const edge = row.z + (reverse ? row.depth : 0);
    const counter = streetAnchor(root, row.x + row.width - .18, edge + (reverse ? -.19 : .19), polar, reverse ? 0 : Math.PI);
    for (const x of [-.208, .208]) {
      box(counter, patina, x, .175, 0, .034, .325, .115);
      box(counter, granite, x, .038, 0, .049, .066, .142);
    }
    box(counter, oxblood, 0, .268, 0, .468, .156, .110);
    box(counter, timber, 0, .361, 0, .521, .037, .148);
    for (const [index, x] of [-.165, 0, .165].entries()) {
      const tray = place(counter, x, .001, (index - 1) * .06);
      box(tray, plank, 0, .395, 0, .136, .041, .127);
      box(tray, timber, 0, .413, .055, .141, .024, .025);
      for (let fruit = 0; fruit < 5; fruit++) {
        const stagger = (noise(index, fruit, 61) - .5) * .054;
        const tone = index === 0 ? blooms[2] : index === 1 ? oxblood : leaves[0];
        put(tray, leaf, tone, [(fruit % 3 - 1) * .036 + stagger * .20, .426 + (fruit % 2) * .010, stagger], [.023, .024, .023]);
      }
    }
  }
  const goods = fixedBatch(root, false);
  goods.name = 'Doorstep trade goods';
  return goods;
}

export function buildCityStreet(polar = false) {
  const glass = new MeshStandardMaterial({ color: 0xe2c79d, emissive: 0xffbd66, emissiveIntensity: .12, roughness: .41 });
  const lamps: CityLamp[] = [];
  const staged = new Group();
  const native = new Group();
  for (const prop of props.harbor) {
    if (!cityTerraceAt(prop.x, prop.y)) fixture(staged, native, prop, glass, lamps, polar);
  }
  for (const [x, z, rotation] of [[14.02, 14.36, 0], [16.02, 14.36, 0], [22.01, 14.36, .03], [30.0, 14.36, -.03], [11.02, 16.31, 0]]) {
    const anchor = streetAnchor(native, x, z, polar, rotation);
    anchor.scale.z = .48;
    bench(anchor);
  }
  for (const [x, z] of [[7.4, 10.15], [19.94, 13.50], [27.27, 10.09], [23.7, 13.51]]) {
    streetLamp(native, x, z, polar, glass, lamps, Math.floor(x));
  }
  for (const [x, z] of [[4.27, 23.18], [9.28, 23.18], [14.18, 23.17], [19.22, 23.20], [24.22, 23.18], [29.25, 23.19],
    [5.28, 27.72], [11.96, 27.72], [18.23, 27.72], [24.78, 27.72], [31.68, 27.72], [34.69, 25.66]]) {
    streetLamp(native, x, z, polar, glass, lamps, Math.floor(x) + 1);
  }
  for (const [x, z, yaw] of [[8.26, 14.35, 0], [13.28, 14.00, 0], [21.20, 10.54, .10], [28.15, 13.99, 0], [33.26, 14.23, 0]]) {
    const base = place(staged, x, z, yaw);
    post(base, 0, 0, .45);
    post(base, .47, 0, .45);
  }
  const utility = place(staged, 8.19, 5.60);
  railing(utility, 1.63, .54);
  for (const x of [8.62, 9.36]) {
    const cabinet = place(staged, x, 5.48);
    box(cabinet, granite, 0, .052, 0, .55, .10, .43);
    box(cabinet, dark, 0, .404, 0, .46, .64, .34);
    box(cabinet, bronze, 0, .731, 0, .49, .049, .37);
    box(cabinet, satin, 0, .472, .178, .35, .43, .032);
    for (let i = 0; i < 5; i++) box(cabinet, dark, 0, .609 - i * .042, .197, .232, .019, .018);
    box(cabinet, bright, .135, .362, .207, .044, .124, .023);
  }
  railing(place(staged, 2.13, 7.10), 3.75, .48);
  railing(place(staged, 2.12, 8.76, Math.PI / 2), 1.65, .48);
  flowerBed(place(staged, 33.86, 7.62), .151, 3);
  flowerBed(place(staged, 33.88, 9.42), .165, 4);
  guidepost(place(staged, 7.20, 11.08, -.13), '← FERRY');
  guidepost(streetAnchor(native, 22.0, 14.12, polar, .16), 'STATION →');
  postbox(place(staged, 12.72, 14.34));
  postbox(place(staged, 33.23, 11.36, -.16));
  const pool = new Group();
  const well = fountain(pool, polar);
  const fountainSolid = fixedBatch(pool, false, true);
  fountainSolid.name = 'Greenway limestone fountain';
  const group = fixedBatch(staged, polar);
  group.name = 'City street fixtures';
  const boundaries = cityAlleyBarriers.map(spec => enclosure(spec, polar));
  const features = cityCourtyards.map(court => courtFeature(court, polar));
  for (const [index, spec] of cityAlleyBarriers.entries()) {
    if (index % 2 || spec.kind === 'hedge') continue;
    sconce(native, spec.x + (spec.width > 1 ? .29 : .56), spec.z + .52, glass, lamps, polar);
  }
  promenadeBays(native, glass, lamps, polar);
  group.add(...boundaries, ...features, fixedBatch(native, false), doorstepGoods(polar), fountainSolid);

  const waterline = .318;
  const waterGeo = new RingGeometry(0, 1, 52, 8);
  waterGeo.rotateX(-Math.PI / 2);
  const ripples = new ShaderMaterial({
    uniforms: { clock: { value: 0 }, day: { value: new Color(0x5c9590) }, night: { value: new Color(0x435d64) }, darkness: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 fieldUv;
      void main() { fieldUv = uv - .5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float clock; uniform float darkness; uniform vec3 day; uniform vec3 night; varying vec2 fieldUv;
      void main() {
        float radius = length(fieldUv);
        float phase = radius * 83.0 - clock * 3.6 + sin(fieldUv.x * 16.0 + fieldUv.y * 11.0) * .41;
        float wake = cos(phase) * (1.0 - smoothstep(.74, 2.5, fwidth(phase)));
        float reflected = sin(fieldUv.x * 8.0 - fieldUv.y * 13.0 + clock * .49) * .11 + .18;
        float falloff = 1.0 - smoothstep(.28, .51, radius);
        float surface = .72 + falloff * .12 + wake * .065 + reflected * .45;
        vec3 shade = mix(day, night, darkness) * surface;
        gl_FragColor = vec4(shade + smoothstep(.72, .99, wake) * vec3(.023, .034, .032) * falloff, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const water = streetAnchor(group, well.x, well.z, polar);
  const liquid = new Mesh(waterGeo, ripples);
  liquid.position.y = waterline;
  liquid.scale.set(well.radiusX * .821, 1, well.radiusZ * .821);
  water.add(liquid);
  const bead = new MeshBasicMaterial({ color: 0xacd0c9, transparent: true, opacity: .65, depthWrite: false, toneMapped: false });
  const droplets = new InstancedMesh(dome, bead, 24);
  droplets.instanceMatrix.setUsage(DynamicDrawUsage);
  droplets.frustumCulled = false;
  water.add(droplets);
  const dropMatrix = new Matrix4();
  function stageDroplets(stamp: number) {
    const launch = .145, reach = Math.min(well.radiusX * .45, well.radiusZ * .81);
    for (let i = 0; i < droplets.count; i++) {
      const elapsed = (stamp * 1.14 + i / 24) % 1;
      const yaw = (i % 6) * Math.PI / 3;
      const arc = .713 + Math.sin(elapsed * Math.PI) * .225 - (.713 - waterline) * elapsed ** 1.9;
      const travel = launch + (reach - launch) * elapsed;
      dropMatrix.makeScale(.010, .019 + elapsed * .009, .010).setPosition(Math.sin(yaw) * travel, arc, Math.cos(yaw) * travel);
      droplets.setMatrixAt(i, dropMatrix);
    }
    droplets.instanceMatrix.needsUpdate = true;
  }
  stageDroplets(0);
  return {
    group, lamps: polar ? lamps.map(({x,z,height}) => ({ ...ringPosition(x,z), height })) : lamps,
    occluders: [...boundaries, ...features],
    update(time: number, night: number) {
      const stamp = time / 1000;
      ripples.uniforms.clock.value = stamp;
      ripples.uniforms.darkness.value = night;
      glass.emissiveIntensity = .15 + night * .95;
      stageDroplets(stamp);
    },
  };
}
