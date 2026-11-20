import {
  BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial,
} from 'three';
import { cityTerraces, type CityTerrace } from './field-city-layout';
import { RING_PERIOD, ringPosition, ringRadius } from './field-ring-space';

type Point = [x: number, y: number, z: number];
type Finish = 'brick' | 'slate' | 'trim' | 'glass' | 'lit';
type Face = 'front' | 'side' | 'roof';
type Materials = Record<Finish, MeshStandardMaterial>;

const blends = {
  wharf: ['#a76755', '#915241', '#af785b', '#946347'],
  shops: ['#a2614d', '#b17752', '#a9745d', '#885a49'],
  garden: ['#aa765d', '#aa654f', '#c2906c', '#986654'],
} as const;
const buffBricks = ['#bd956c', '#b89b75', '#c6a77d', '#c19a73'];

const cream = new Color('#e0c9a6');
const sand = new Color('#b9a18b');
const damp = new Color('#887967');
const roofInk = new Color('#4d5961');
const roofTeal = new Color('#465e64');
const deep = new Color('#324143');
const brass = new Color('#b88f61');
const glass = new Color('#729498');
const honey = new Color('#be9f73');
const hedge = new Color('#698465');
const doors = [new Color('#3f5b55'), new Color('#615044'), new Color('#65525c'), new Color('#3c5369'), new Color('#5b613f')];

const numerals = [
  ['111','101','101','101','111'], ['010','110','010','010','111'], ['111','001','111','100','111'],
  ['111','001','111','001','111'], ['101','101','111','001','001'], ['111','100','111','001','111'],
  ['111','100','111','101','111'], ['111','001','010','010','010'], ['111','101','111','101','111'],
  ['111','101','111','001','111'],
];

const letters: Record<string, readonly string[]> = {
  A: ['010','101','111','101','101'], C: ['111','100','100','100','111'], E: ['111','100','110','100','111'],
  F: ['111','100','110','100','100'], I: ['111','010','010','010','111'], L: ['100','100','100','100','111'],
  M: ['101','111','111','101','101'], O: ['111','101','101','101','111'], P: ['110','101','110','100','100'],
  R: ['110','101','110','101','101'], S: ['011','100','010','001','110'], T: ['111','010','010','010','010'],
  W: ['101','101','111','111','101'], Y: ['101','101','010','010','010'],
};

const tint = (color: Color, strength: number) => color.clone().multiplyScalar(strength);
function noise(index: number, salt: number) {
  const n = Math.imul(index + 67, 374761393) ^ Math.imul(salt + 129, 668265263);
  return ((Math.imul(n ^ (n >>> 13), 1274126177) ^ (n >>> 16)) >>> 0) / 4294967296;
}

function patterned(kind: 'brick' | 'slate') {
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: kind === 'brick' ? .95 : .83, side: DoubleSide });
  material.customProgramCacheKey = () => `ring-terrace-${kind}`;
  material.onBeforeCompile = shader => {
    shader.vertexShader = `attribute vec2 terraceCoord; varying vec2 terracePoint;\n${shader.vertexShader}`.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n terracePoint = terraceCoord;');
    shader.fragmentShader = `varying vec2 terracePoint;\n${shader.fragmentShader}`.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 p = terracePoint / vec2(${kind === 'brick' ? '.244, .104' : '.188, .123'});
      p.x += .5 * mod(floor(p.y), 2.0);
      float distanceToJoint = min(fract(p.x), 1.0 - fract(p.x));
      float distanceToCourse = min(fract(p.y), 1.0 - fract(p.y));
      vec2 footprint = fwidth(terracePoint);
      float visibleGrain = 1.0 - smoothstep(.03, .097, max(footprint.x, footprint.y));
      float joint = 1.0 - smoothstep(.011, .080, distanceToJoint);
      float course = 1.0 - smoothstep(.014, .073, distanceToCourse);
      float n = fract(sin(dot(floor(p), vec2(41.13, 113.38))) * 43758.5453) - .5;
      diffuseColor.rgb *= 1.0 + n * ${kind === 'brick' ? '.15' : '.12'} * visibleGrain;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * ${kind === 'brick' ? '1.43' : '.71'},
        visibleGrain * max(course, joint * ${kind === 'brick' ? '.79' : '.50'}) * ${kind === 'brick' ? '.46' : '.49'});
    `);
  };
  return material;
}

function finishes(): Materials {
  return {
    brick: patterned('brick'),
    slate: patterned('slate'),
    trim: new MeshStandardMaterial({ vertexColors: true, roughness: .77, side: DoubleSide }),
    glass: new MeshStandardMaterial({ vertexColors: true, roughness: .38, metalness: .12, side: DoubleSide }),
    lit: new MeshStandardMaterial({ vertexColors: true, roughness: .43, emissive: 0xeab175, emissiveIntensity: 0, side: DoubleSide }),
  };
}

class FaceAccumulator {
  readonly position: number[] = [];
  readonly color: number[] = [];
  readonly coord: number[] = [];
}

class TerraceBuilder {
  private readonly surfaces: Record<Finish, FaceAccumulator> = {
    brick: new FaceAccumulator(), slate: new FaceAccumulator(), trim: new FaceAccumulator(),
    glass: new FaceAccumulator(), lit: new FaceAccumulator(),
  };
  private readonly direction: -1 | 1;
  private readonly baseline: number;

  constructor(private readonly lot: CityTerrace) {
    this.direction = lot.facing === 'inner' ? 1 : -1;
    this.baseline = this.direction > 0 ? lot.z : lot.z + lot.depth;
  }

  triangle(a: Point, b: Point, c: Point, finish: Finish, color: Color, face: Face = 'front') {
    const bucket = this.surfaces[finish];
    for (const [x, y, z] of [a, b, c]) {
      const row = this.baseline + z * this.direction;
      const world = ringPosition(this.lot.x + x, row);
      bucket.position.push(world.x, y, world.z);
      bucket.color.push(color.r, color.g, color.b);
      const tangent = x * ringRadius(row) * Math.PI * 2 / RING_PERIOD;
      bucket.coord.push((face === 'side' ? z * .48 : tangent) + this.lot.x * .31, face === 'roof' ? z * .53 : y);
    }
  }

  quad(a: Point, b: Point, c: Point, d: Point, finish: Finish, color: Color, face: Face = 'front') {
    this.triangle(a, b, c, finish, color, face);
    this.triangle(c, b, d, finish, color, face);
  }

  facade(left: number, right: number, bottom: number, top: number, z: number, finish: Finish, color: Color) {
    if (right <= left || top <= bottom) return;
    const segments = Math.max(1, Math.ceil((right - left) * 4));
    for (let i = 0; i < segments; i++) {
      const x = left + (right - left) * i / segments, end = left + (right - left) * (i + 1) / segments;
      this.quad([x, top, z], [x, bottom, z], [end, top, z], [end, bottom, z], finish, color);
    }
  }

  roof(left: number, right: number, a: [y: number, z: number], b: [y: number, z: number], finish: Finish, color: Color) {
    const segments = Math.max(1, Math.ceil((right - left) * 4));
    for (let i = 0; i < segments; i++) {
      const x = left + (right - left) * i / segments, end = left + (right - left) * (i + 1) / segments;
      this.quad([x, ...a], [x, ...b], [end, ...a], [end, ...b], finish, color, 'roof');
    }
  }

  box(left: number, right: number, base: number, top: number, front: number, back: number, finish: Finish, color: Color) {
    this.facade(left, right, base, top, front, finish, color);
    this.facade(left, right, base, top, back, finish, tint(color, .92));
    this.roof(left, right, [top, front], [top, back], finish, color);
    const side = tint(color, .88);
    for (const x of [left, right]) {
      this.quad([x, top, front], [x, base, front], [x, top, back], [x, base, back], finish, side, 'side');
    }
  }

  cylinder(x: number, z: number, bottom: number, top: number, radius: number, finish: Finish, color: Color, sides = 8) {
    const point = (i: number, y: number): Point => {
      const angle = i * Math.PI * 2 / sides;
      return [x + Math.cos(angle) * radius, y, z + Math.sin(angle) * radius * 2.5];
    };
    for (let i = 0; i < sides; i++) {
      const paint = tint(color, .82 + .18 * (i % 4) / 3);
      this.quad(point(i, top), point(i, bottom), point(i + 1, top), point(i + 1, bottom), finish, paint);
      this.triangle([x, top, z], point(i, top), point(i + 1, top), finish, color, 'roof');
    }
  }

  finish(materials: Materials) {
    const group = new Group();
    group.name = `Terrace ${this.lot.id}`;
    group.userData.parcel = this.lot.id;
    for (const [key, attributes] of Object.entries(this.surfaces)) {
      if (!attributes.position.length) continue;
      const name = key as Finish;
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(attributes.position, 3));
      geometry.setAttribute('color', new Float32BufferAttribute(attributes.color, 3));
      geometry.setAttribute('terraceCoord', new Float32BufferAttribute(attributes.coord, 2));
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      const mesh = new Mesh(geometry, materials[name]);
      mesh.castShadow = name === 'brick' || name === 'slate';
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }
}

type Side = { at: number; front: boolean };
function surfacePoint(side: Side, amount: number) {
  return side.at + (side.front ? -amount : amount);
}

function plaque(builder: TerraceBuilder, text: string, x: number, y: number, side: Side, scale: number) {
  const spacing = scale * 4;
  const length = text.length * spacing - scale;
  const left = x - length / 2;
  builder.facade(left - scale * 1.4, left + length + scale * 1.4, y - scale * 3.4, y + scale * 3.4, side.at, 'trim', deep);
  for (let char = 0; char < text.length; char++) {
    const value = text[char];
    const glyph = numerals[Number(value)] ?? letters[value];
    if (!glyph) continue;
    for (let row = 0; row < glyph.length; row++) for (let column = 0; column < glyph[row].length; column++) {
      if (glyph[row][column] !== '1') continue;
      const at = left + char * spacing + column * scale;
      const down = y + (2.5 - row) * scale;
      builder.facade(at, at + scale * .95, down - scale * .96, down, surfacePoint(side, .0025), 'trim', tint(cream, 1.06));
    }
  }
}

function sash(builder: TerraceBuilder, side: Side, x: number, y: number, width: number, height: number, warm: boolean, surround = true) {
  const left = x - width / 2, right = x + width / 2;
  const foot = y - height / 2, crown = y + height / 2;
  const at = surfacePoint(side, .006);
  const jamb = surfacePoint(side, .013);
  const frame = surfacePoint(side, .020);
  builder.facade(left - .018, right + .018, foot - .022, crown + .028, at, 'trim', deep);
  builder.facade(left + .018, right - .018, foot + .019, crown - .020, jamb, warm ? 'lit' : 'glass', warm ? honey : glass);
  for (const pos of [left + .008, x - .006, right - .019]) {
    builder.facade(pos, pos + .011, foot + .008, crown - .008, frame, 'trim', cream);
  }
  for (const level of [foot + .008, y - .006, crown - .024]) builder.facade(left + .008, right - .008, level, level + .016, frame, 'trim', cream);
  const lip = surfacePoint(side, .080);
  builder.box(left - .031, right + .031, foot - .059, foot - .018, Math.min(at, lip), Math.max(at, lip), 'trim', cream);
  if (surround) {
    builder.facade(left - .040, right + .040, crown + .022, crown + .079, jamb, 'trim', cream);
    builder.facade(x - .030, x + .030, crown + .049, crown + .105, frame, 'trim', tint(cream, 1.06));
  }
}

function baySash(builder: TerraceBuilder, side: Side, x: number, width: number, wall: Color, warm: boolean) {
  const left = x - width * .5, right = x + width * .5;
  const head = .897, foot = .246;
  const face = surfacePoint(side, .096);
  const wing = width * .17;
  const faceSide = { ...side, at: face };
  builder.facade(left + wing, right - wing, foot, head, face, 'brick', wall);
  for (const [wallAt, faceAt] of [[left, left + wing], [right, right - wing]]) {
    builder.quad([wallAt, head, side.at], [wallAt, foot, side.at], [faceAt, head, face], [faceAt, foot, face], 'trim', sand);
  }
  builder.roof(left - .023, right + .023, [head + .116, side.at], [head + .031, surfacePoint(side, .138)], 'slate', roofInk);
  builder.box(left - .012, right + .012, foot - .065, foot - .015, Math.min(face, side.at), Math.max(face, side.at), 'trim', cream);
  sash(builder, faceSide, x, .582, width * .62, .462, warm, false);
}

function fanlight(builder: TerraceBuilder, side: Side, x: number, y: number, width: number, height: number, warm: boolean) {
  const top = (angle: number, radius: number, at: number): Point => [x + Math.cos(angle) * width * radius, y + Math.sin(angle) * height * radius, at];
  for (let sector = 0; sector < 8; sector++) {
    const from = sector * Math.PI / 8, to = (sector + 1) * Math.PI / 8;
    const frame = surfacePoint(side, .022);
    const pane = surfacePoint(side, .014);
    builder.quad(top(from, 1.10, frame), top(from, .85, frame), top(to, 1.10, frame), top(to, .85, frame), 'trim', cream);
    builder.triangle([x, y, pane], top(from, .87, pane), top(to, .87, pane), warm ? 'lit' : 'glass', warm ? honey : glass);
    if (sector % 2 === 0) builder.triangle([x, y, frame], top(from, .87, frame), top(from + .035, .87, frame), 'trim', cream);
  }
}

function entrance(builder: TerraceBuilder, side: Side, center: number, width: number, door: Color, number: number, primary: boolean) {
  const left = center - width * .5, right = center + width * .5;
  const doorFace = surfacePoint(side, .021);
  const facade = surfacePoint(side, .011);
  const top = primary ? .831 : .753;
  builder.facade(left - .032, right + .032, .072, top + .047, facade, 'trim', darkStone);
  builder.facade(left + .013, right - .013, .10, top - .018, doorFace, 'trim', door);
  for (const x of [left - .024, right - .001]) {
    builder.facade(x, x + .025, .11, top + .031, surfacePoint(side, .029), 'trim', cream);
  }
  for (const y of [.219, .491]) {
    builder.facade(left + .039, right - .039, y, y + .139, surfacePoint(side, .026), 'trim', tint(door, .78));
    builder.facade(left + .044, right - .043, y + .106, y + .135, surfacePoint(side, .028), 'trim', tint(door, 1.22));
  }
  builder.facade(right - .056, right - .033, .455, .484, surfacePoint(side, .031), 'trim', brass);
  builder.facade(left - .040, right + .040, top -.018, top + .071, surfacePoint(side, .026), 'trim', cream);
  if (primary) fanlight(builder, side, center, top + .057, width * .53, .106, number % 3 === 0);
  const sill = surfacePoint(side, primary ? .21 : .12);
  const threshold = surfacePoint(side, primary ? .138 : .095);
  builder.box(left - .040, right + .041, 0, .078, Math.min(sill, side.at), Math.max(sill, side.at), 'trim', sand);
  builder.box(left - .026, right + .027, .077, .117, Math.min(threshold, side.at), Math.max(threshold, side.at), 'trim', cream);
  plaque(builder, String(number), center, top - .202, { ...side, at: surfacePoint(side, .032) }, primary ? .011 : .009);
}

const darkStone = new Color('#a3917a');

function doorwayRails(builder: TerraceBuilder, left: number, right: number, center: number, width: number, face: number, key: number) {
  const gate = width * .51;
  const verge = Math.max(.052, face - .27);
  for (const [from, to] of [[left + .075, center - gate - .038], [center + gate + .038, right - .074]]) {
    if (to - from < .096) continue;
    builder.box(from, to, 0, .061, verge, verge + .109, 'trim', sand);
    const total = Math.ceil((to - from) * 15);
    for (let step = 0; step <= total; step++) {
      const x = from + (to - from) * step / total;
      const end = step === 0 || step === total;
      const post = end ? .014 : .007;
      builder.box(x - post, x + post, .058, end ? .303 : .267, verge + .026, verge + .063, 'trim', deep);
      if (end) builder.facade(x - .018, x + .018, .284, .312, verge + .025, 'trim', brass);
    }
    builder.box(from, to, .233, .252, verge + .025, verge + .068, 'trim', deep);
    if (key % 3 !== 1) {
      builder.box(from + .026, to - .022, .061, .142, verge + .110, verge + .245, 'trim', tint(cream, .91));
      for (let leaf = 0; leaf < 3; leaf++) {
        const x = from + (to - from) * (leaf + .5) / 3;
        const height = .188 + noise(key, leaf + 34) * .083;
        builder.cylinder(x, verge + .176, .139, height, .037, 'trim', tint(hedge, .88 + noise(key, leaf + 58) * .27), 5);
      }
    }
  }
}

function shop(builder: TerraceBuilder, left: number, right: number, face: number, style: CityTerrace['style'], choice: number, number: number) {
  const side = { at: face, front: true };
  const color = doors[(choice + (style === 'wharf' ? 0 : 2)) % doors.length];
  const width = right - left;
  const x = (left + right) / 2;
  const frosted = choice % 3 === 0;
  builder.facade(left + .047, right - .047, .058, .946, face - .014, 'trim', color);
  for (const [from, to] of [[left + .098, x - .115], [x + .114, right - .098]]) {
    const center = (from + to) / 2;
    sash(builder, side, center, .508, (to - from) * .9, .490, frosted, false);
  }
  builder.facade(x - .084, x + .084, .092, .742, face - .027, 'trim', deep);
  builder.facade(x - .054, x + .054, .365, .698, face - .030, frosted ? 'lit' : 'glass', frosted ? honey : glass);
  plaque(builder, String(number), x, .279, { at: face - .033, front: true }, .010);
  builder.facade(left + .037, right - .037, .876, .955, face - .034, 'trim', cream);
  const signs = style === 'wharf' ? ['ROPE','COAL','SAIL'] : ['TEA','POST','COAL','LOOM','WATERS'];
  plaque(builder, signs[choice % signs.length], x, 1.026, { at: face - .037, front: true }, .018);
  builder.roof(left + .035, right - .036, [1.155, face + .007], [1.085, face - .203], 'trim', tint(color, .89));
  builder.facade(left + .035, right - .036, 1.040, 1.084, face - .203, 'trim', color);
  builder.box(x - width * .20, x + width * .20, 0, .067, face - .131, face + .016, 'trim', sand);
}

function attic(builder: TerraceBuilder, left: number, right: number, front: number, ridge: number, back: number, eave: number, peak: number, shade: Color, wall: Color, alternate: boolean, raisedGable: boolean) {
  const inset = .017;
  const upper = tint(shade, 1.05);
  builder.roof(left - inset, right + inset, [eave, front], [peak, ridge], 'slate', shade);
  builder.roof(left - inset, right + inset, [peak, ridge], [eave, back], 'slate', tint(shade, .91));
  for (const x of [left, right]) builder.triangle([x, eave, front + .024], [x, eave, back - .030], [x, peak, ridge], 'brick', tint(wall, .91), 'side');
  builder.box(left - .024, right + .024, peak - .037, peak + .018, ridge - .035, ridge + .035, 'trim', upper);
  for (const side of [front, back]) builder.box(left - inset, right + inset, eave - .051, eave, side - .034, side + .034, 'trim', roofInk);
  if (raisedGable) {
    builder.roof(left - .017, left + .037, [eave + .035, front], [peak + .074, ridge], 'trim', sand);
    builder.roof(left - .017, left + .037, [peak + .074, ridge], [eave + .035, back], 'trim', tint(sand, .90));
  }
  if (!alternate) return;
  const middle = (left + right) / 2, w = (right - left) * .25;
  const opening = front + (ridge - front) * .47;
  const bottom = eave + (peak - eave) * .43;
  const top = Math.min(peak - .078, bottom + .215);
  const lip = opening + (ridge - opening) * .43;
  builder.box(middle - w / 2, middle + w / 2, bottom, top, opening - .016, lip, 'brick', wall);
  builder.triangle([middle - w * .58, top, opening - .041], [middle + w * .58, top, opening - .041], [middle, top + .068, opening - .041], 'trim', cream);
  builder.quad([middle - w * .58, top, opening - .06], [middle, top + .072, opening - .06],
    [middle - w * .58, top, lip], [middle, top + .072, lip], 'slate', shade, 'roof');
  builder.quad([middle, top + .072, opening - .06], [middle + w * .58, top, opening - .06],
    [middle, top + .072, lip], [middle + w * .58, top, lip], 'slate', upper, 'roof');
  sash(builder, { front: true, at: opening - .018 }, middle, bottom + .095, w * .55, .115, false, false);
}

function chimney(builder: TerraceBuilder, x: number, z: number, y: number, w: number, wall: Color, pots: boolean, prominent: boolean) {
  const tip = Math.min(2.95, y + (prominent ? .243 : .171));
  builder.box(x - w, x + w, y - .20, tip, z - .125, z + .126, 'brick', tint(wall, .76));
  builder.box(x - w - .022, x + w + .022, tip - .030, tip + .019, z - .151, z + .152, 'trim', darkStone);
  const chimneyTop = tip + (prominent ? .139 : .103);
  for (const at of pots ? [x - w * .49, x + w * .49] : [x]) {
    builder.cylinder(at, z, tip + .016, chimneyTop, pots ? w * .34 : w * .48, 'trim', tint(wall, .87));
    builder.cylinder(at, z, chimneyTop - .019, chimneyTop + .009, pots ? w * .39 : w * .54, 'trim', tint(wall, .97));
  }
}

function quoins(builder: TerraceBuilder, side: Side, x: number, index: number, end: number) {
  for (let y = .213, course = 0; y < end - .19; y += .185, course++) {
    const width = (course + index) % 2 ? .048 : .075;
    builder.facade(x, x + width, y, y + .079, surfacePoint(side, .021), 'trim', tint(cream, course % 2 ? .99 : .91));
  }
}

function house(builder: TerraceBuilder, lot: CityTerrace, index: number) {
  const pitch = lot.width / lot.homes;
  const unit = Math.round(lot.x * 13 + lot.z * 31) + index * 11;
  const left = pitch * index + .055, right = pitch * (index + 1) - .055;
  const span = right - left;
  const prominent = (index === 0 && lot.style !== 'wharf') || index === lot.homes - 1 && noise(unit, 45) > .52;
  const facade = (lot.style === 'wharf' ? .391 : .436) + (index % 3) * .028;
  const back = lot.depth - .198 - (index % 3) * .032;
  const isBuff = (index + Math.floor(lot.x / 3)) % 4 === 0;
  const wall = new Color(isBuff ? buffBricks[(index + Math.floor(lot.z)) % buffBricks.length] : blends[lot.style][index % blends[lot.style].length]);
  const roofShape = index % 2 ? roofTeal : roofInk;
  const roofColor = tint(roofShape, .93 + noise(unit, 17) * .28);
  const near = { at: facade, front: true };
  const far = { at: back, front: false };
  const eave = 1.741 + (index % 3) * .067 + noise(unit, 13) * .093 + (prominent ? .115 : 0);
  const crest = 2.268 + [0, .19, .068][index % 3] + noise(unit, 19) * .074 + (prominent ? .187 : 0);
  const ridge = facade + (back - facade) * (.46 + (index % 3) * .058);
  const shopfront = lot.style === 'shops' || lot.style === 'wharf' && index % 3 === 0;
  const bookNumber = Math.round(lot.x * 2) + 3 + 2 * index;
  const middle = (left + right) / 2;
  builder.box(left, right, 0, eave, facade, back, 'brick', wall);
  builder.box(left - .018, right + .018, .014, .177, facade - .034, back + .037, 'trim', damp);
  builder.box(left - .014, right + .014, 1.079, 1.128, facade - .035, back + .031, 'trim', tint(cream, .90));
  builder.box(left - .020, right + .020, eave - .089, eave - .021, facade - .054, back + .056, 'trim', cream);
  attic(builder, left, right, facade - .072, ridge, back + .059, eave + .012, crest, roofColor, wall,
    lot.style !== 'wharf' && index % 3 === 1, prominent || isBuff);
  chimney(builder, left + span * (index % 2 ? .27 : .70), ridge + .022, crest,
    Math.min(.087, span * .115), wall, index % 3 !== 1, prominent);

  const entranceX = left + span * (index % 3 === 2 ? .70 : .27);
  const nearSash = left + span * (index % 3 === 2 ? .28 : .69);
  const door = doors[(unit + index) % doors.length];
  if (shopfront) shop(builder, left, right, facade, lot.style, index, bookNumber);
  else {
    entrance(builder, near, entranceX, span * .228, door, bookNumber, true);
    if (lot.style === 'garden' && index % 2 === 0) baySash(builder, near, nearSash, span * .315, wall, true);
    else sash(builder, near, nearSash, .622, span * .224, .460, index % 2 === 0);
    doorwayRails(builder, left, right, entranceX, span * .27, facade, unit);
  }
  const backDoor = left + span * .29;
  entrance(builder, far, backDoor, span * .211, tint(door, .89), bookNumber, false);
  if (prominent && lot.style !== 'wharf') baySash(builder, far, left + span * .68, span * .312, wall, index % 2 === 0);
  else sash(builder, far, left + span * .67, .638, span * .236, .452, index % 2 === 1);

  for (const side of [near, far]) {
    if (prominent) quoins(builder, side, left + .010, index, eave);
    for (const [pane, offset] of [[0,.284],[1,.694]]) {
      sash(builder, side, left + span * offset, eave - .458, span * .210, .43,
        (index + pane + (side.front ? 0 : 1)) % 3 === 0);
    }
    const rainAt = side.front ? facade - .050 : back + .039;
    builder.cylinder(right - .028, rainAt, .171, eave - .048, Math.min(.015, span * .028), 'trim', deep, 5);
    if (index % 3 === 0) plaque(builder, String(bookNumber), middle, eave - .120, { ...side, at: surfacePoint(side, .047) }, .012);
  }
}

export function buildRingTerraces() {
  const group = new Group();
  group.name = 'Victorian harbour terraces';
  const materials = finishes();
  for (const lot of cityTerraces) {
    const builder = new TerraceBuilder(lot);
    const buildingIds: string[] = [];
    for (let index = 0; index < lot.homes; index++) {
      house(builder, lot, index);
      buildingIds.push(`${lot.id}-${index + 1}`);
    }
    const row = builder.finish(materials);
    row.userData.buildingIds = buildingIds;
    group.add(row);
  }
  return {
    group,
    update(_time: number, darkness: number) {
      const evening = Math.max(0, Math.min(1, darkness));
      materials.lit.emissiveIntensity = .018 + evening * .62;
    },
  };
}
