import {
  BoxGeometry, CanvasTexture, Color, CylinderGeometry, Group, IcosahedronGeometry, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, RingGeometry, ShaderMaterial, SphereGeometry, SRGBColorSpace,
  type BufferGeometry,
} from 'three';
import { batchStaticMeshes } from './field-mesh-batch';
import { cityParcels, cityTerraceAt } from './field-city-layout';
import { bendCityGeometry, ringPosition } from './field-ring-space';
import { props, type Prop } from './field-layout';

type Paint = MeshStandardMaterial | MeshBasicMaterial;
type Position = [number, number, number];
export type CityLamp = { x: number; z: number; height: number };

const cube = new BoxGeometry(1, 1, 1);
const drum = new CylinderGeometry(1, 1, 1, 12);
const dome = new SphereGeometry(1, 15, 9);
const rock = new IcosahedronGeometry(1, 1);
const leaf = new IcosahedronGeometry(1, 0);
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
const leaves = [0x679077, 0x547e6c, 0x779676, 0x477768, 0x82a982].map(color => new MeshStandardMaterial({ color, roughness: .95 }));
const blooms = [0xdcb592, 0xbf816d, 0xd8c685, 0xb9c7ae].map(color => new MeshStandardMaterial({ color, roughness: .89 }));

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
  put(parent, drum, granite, [0, .075, 0], [.156, .15, .156]);
  put(parent, drum, dark, [0, .27, 0], [.095, .36, .095]);
  put(parent, drum, dark, [0, 1.008, 0], [.042, 1.38, .042]);
  for (const level of [.27, .38, 1.52, 1.66]) put(parent, drum, bronze, [0, level, 0], [.055, .036, .055]);
  box(parent, dark, 0, 1.68, 0, .79, .075, .074);
  const heads = sequence % 3 === 0 ? [-.34, .34] : [0];
  for (const side of heads) {
    if (side) {
      box(parent, dark, side * .87, 1.592, 0, .24, .072, .069, side * .53);
      put(parent, drum, bronze, [side, 1.79, 0], [.12, .059, .12]);
    }
    put(parent, drum, dark, [side, 1.86, 0], [.138, .048, .138]);
    put(parent, drum, glass, [side, 1.985, 0], [.112, .22, .112]);
    for (const x of [-.092, .092]) for (const z of [-.064, .064]) box(parent, dark, side + x, 1.99, z, .025, .257, .025);
    put(parent, drum, dark, [side, 2.127, 0], [.129, .058, .129]);
    put(parent, dome, bronze, [side, 2.174, 0], [.080, .046, .080]);
  }
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

function fixture(root: Group, prop: Prop, glass: MeshStandardMaterial, lamps: CityLamp[]) {
  const { kind, variant = 0, x, y } = prop;
  if (['cottage', 'station', 'beacon', 'boat'].includes(kind)) return;
  const centerX = x + .5;
  const centerZ = y + .80;
  if (cityParcels.some(lot => centerX >= lot.x && centerX < lot.x + lot.width && centerZ >= lot.z && centerZ < lot.z + lot.depth)) return;
  const at = place(root, centerX, centerZ);
  switch (kind) {
    case 'lamp':
      lamp(at, glass, x + y);
      lamps.push({ x: centerX, z: centerZ + .15, height: 1.98 });
      break;
    case 'oak':
    case 'pine':
      tree(at, variant);
      break;
    case 'rock':
      box(at, granite, 0, .111, 0, .60, .218, .57);
      box(at, limestone, 0, .221, 0, .66, .089, .62);
      flowerBed(at, .273, x + y);
      break;
    case 'fence':
      railing(at, variant + .77);
      at.position.x -= .40;
      break;
    case 'flowers':
      flowerBed(at, .18 + variant * .020, x + y);
      at.position.z -= .56;
      break;
    case 'sign':
    case 'banner':
      guidepost(at, 'CENTRAL →');
      break;
    case 'winch':
      winch(at);
      break;
    case 'crate':
      crate(at);
      break;
    case 'arch':
      break;
  }
}

function fountain(root: Group) {
  const well = place(root, 24.06, 15.40);
  put(well, drum, granite, [0, .085, 0], [1.02, .17, .991]);
  put(well, drum, limestone, [0, .24, 0], [.921, .309, .909]);
  put(well, drum, satin, [0, .393, 0], [.779, .027, .774]);
  put(well, drum, dark, [0, .412, 0], [.243, .090, .245]);
  put(well, drum, bronze, [0, .568, 0], [.130, .253, .133]);
  put(well, dome, bronze, [0, .706, 0], [.148, .09, .148]);
  // A segmented cap reads as cut stone even from the top-down camera.
  for (let i = 0; i < 12; i++) {
    const angle = (i + .50) * Math.PI / 6;
    const brick = box(well, i % 3 === 0 ? bright : limestone, Math.sin(angle) * .840, .422, Math.cos(angle) * .856, .394, .080, .153);
    brick.rotation.y = angle;
  }
  return well;
}

export function buildCityStreet(polar = false) {
  const glass = new MeshStandardMaterial({ color: 0xe2c79d, emissive: 0xffbd66, emissiveIntensity: .12, roughness: .41 });
  const lamps: CityLamp[] = [];
  const staged = new Group();
  for (const prop of props.harbor) {
    if (!cityTerraceAt(prop.x, prop.y)) fixture(staged, prop, glass, lamps);
  }
  for (const [x, z, rotation] of [[13.69, 14.08, 0], [16.28, 14.19, 0], [22.21, 14.08, .03], [30.24, 14.45, -.03], [10.72, 16.39, Math.PI / 2]]) bench(place(staged, x, z, rotation));
  for (const [x, z] of [[7.4, 10.15], [19.94, 13.76], [27.55, 10.09], [23.7, 13.77]]) {
    lamp(place(staged, x, z), glass, Math.floor(x));
    lamps.push({ x, z: z + .133, height: 1.98 });
  }
  for (const [x, z] of [[4.27, 23.18], [9.28, 23.18], [14.18, 23.17], [19.22, 23.20], [24.22, 23.18], [29.25, 23.19],
    [5.28, 27.72], [11.96, 27.72], [18.23, 27.72], [24.78, 27.72], [31.68, 27.72], [34.69, 25.66]]) {
    lamp(place(staged, x, z), glass, Math.floor(x) + 1);
    lamps.push({ x, z: z + .13, height: 1.99 });
  }
  for (const [x, z, yaw] of [[8.52, 14.35, 0], [13.10, 14.00, 0], [21.20, 10.54, .10], [28.15, 13.99, 0], [33.18, 13.87, 0]]) {
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
  guidepost(place(staged, 21.73, 14.01, .16), 'STATION →');
  postbox(place(staged, 12.72, 14.34));
  postbox(place(staged, 33.23, 11.36, -.16));
  const well = fountain(staged);
  const batches = batchStaticMeshes(staged, material => material !== soil);
  const group = polar ? bendCityGeometry(batches) : batches;
  if (polar) batches.traverse(part => { if (part instanceof Mesh) part.geometry.dispose(); });
  group.name = 'City street fixtures';

  const waterGeo = new RingGeometry(.151, .775, 48, 4);
  waterGeo.rotateX(-Math.PI / 2);
  const ripples = new ShaderMaterial({
    uniforms: { clock: { value: 0 }, day: { value: new Color(0x439a9c) }, night: { value: new Color(0x435b62) }, darkness: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 fieldUv;
      void main() { fieldUv = uv - .5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float clock; uniform float darkness; uniform vec3 day; uniform vec3 night; varying vec2 fieldUv;
      void main() {
        float radius = length(fieldUv);
        float ripple = .5 + .5 * cos(radius * 155.0 - clock * 4.8);
        float surface = .72 + .18 * ripple + .42 * pow(ripple, 13.0) * (1.0 - darkness * .42);
        gl_FragColor = vec4(mix(day, night, darkness) * surface, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const liquid = new Mesh(waterGeo, ripples);
  const center = polar ? ringPosition(well.position.x, well.position.z) : well.position;
  const waterScale = polar ? .62 : 1;
  liquid.position.set(center.x, .415, center.z);
  liquid.scale.setScalar(waterScale);
  group.add(liquid);
  const jets = new Group();
  jets.position.set(center.x, .711, center.z);
  jets.scale.setScalar(waterScale);
  const bead = new MeshBasicMaterial({ color: 0xb6dfd8, transparent: true, opacity: .68, depthWrite: false, toneMapped: false });
  const drops = Array.from({ length: 18 }, () => put(jets, dome, bead, [0, 0, 0], [.018, .039, .018]));
  group.add(jets);
  return {
    group, lamps: polar ? lamps.map(({x,z,height}) => ({ ...ringPosition(x,z), height })) : lamps,
    update(time: number, night: number) {
      const stamp = time / 1000;
      ripples.uniforms.clock.value = stamp;
      ripples.uniforms.darkness.value = night;
      glass.emissiveIntensity = .15 + night * .95;
      for (let i = 0; i < drops.length; i++) {
        const elapsed = (stamp * 1.04 + i / 18) % 1;
        const yaw = i / 18 * Math.PI * 2;
        const arc = Math.sin(elapsed * Math.PI) * .46 - .292 * elapsed;
        drops[i].position.set(Math.cos(yaw) * elapsed * .61, arc, Math.sin(yaw) * elapsed * .61);
      }
    },
  };
}
