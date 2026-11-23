import {
  BufferGeometry, CanvasTexture, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, SRGBColorSpace,
} from 'three';
import { cityTerraces, outerRingStart, type CityTerrace } from './field-city-layout';
import { RING_PERIOD, ringPosition, ringRadius } from './field-ring-space';

type Point = [x: number, y: number, z: number];
type RoofFinish = 'slate' | 'tile';
type Finish = 'brick' | 'ashlar' | RoofFinish | 'trim' | 'glass' | 'lit' | 'sign';
type Face = 'front' | 'side' | 'roof';
type Materials = Record<Finish, MeshStandardMaterial>;
type Opening = { left: number; right: number; bottom: number; top: number };
type Side = { at: number; front: boolean; openings?: Opening[] };
type UV = [number, number];

const blends = {
  wharf: ['#88604e', '#754f43', '#996849', '#886959'],
  shops: ['#875149', '#af6b47', '#904e3d', '#734c4a'],
  garden: ['#b98e59', '#d4b383', '#b58f68', '#cfaa6e'],
} as const;
const buffBricks = ['#bd956c', '#b89b75', '#c6a77d', '#c19a73'];

const cream = new Color('#e0c9a6');
const sand = new Color('#b9a18b');
const damp = new Color('#887967');
const roofInk = new Color('#4d5961');
const roofTeal = new Color('#465e64');
const roofClay = new Color('#95664f');
const deep = new Color('#324143');
const brass = new Color('#b88f61');
const glass = new Color('#516967');
const honey = new Color('#ad8d60');
const skyReflection = new Color('#b9d0c9');
const paneDark = new Color('#283d40');
const oldIvory = new Color('#baaa8d');
const iron = new Color('#273237');
const signIvory = new Color('#fff3d9');
const hedge = new Color('#698465');
const doors = [new Color('#3f5b55'), new Color('#615044'), new Color('#65525c'), new Color('#3c5369'), new Color('#5b613f')];
const shopPaint = ['#365849', '#945338', '#6b3944', '#375963', '#604553'].map(color => new Color(color));

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

const signDesigns = [
  { name: 'ROPE', service: 'CORDAGE', icon: '◇', paint: '#60534b' },
  { name: 'COAL', service: 'FUEL & OIL', icon: '●', paint: '#463b46' },
  { name: 'SAIL', service: 'CANVAS', icon: '▲', paint: '#375b68' },
  { name: 'TEA', service: 'LEAF & INFUSION', icon: '◆', paint: '#4b6450' },
  { name: 'POST', service: 'POST & PARCEL', icon: '✦', paint: '#7e4841' },
  { name: 'MALT', service: 'GRAIN STORE', icon: '✧', paint: '#866248' },
  { name: 'LOOM', service: 'WOVEN GOODS', icon: '■', paint: '#645067' },
  { name: 'WATERS', service: 'SALT MERCHANT', icon: '≈', paint: '#375864' },
] as const;
type ShopName = typeof signDesigns[number]['name'];
const signsByStyle: Record<'wharf' | 'shops', readonly ShopName[]> = { wharf: ['ROPE', 'COAL', 'SAIL'], shops: ['TEA', 'POST', 'MALT', 'LOOM', 'WATERS'] };
const featuredShops = new Set(['seafarer-place', 'sailmakers-yard', 'sailmakers-turn', 'market-row', 'salt-market-arcade', 'salt-market-corner']);

function vendorName(lot: CityTerrace, address: number) {
  const wharf = lot.style === 'wharf';
  const vendors = wharf ? signsByStyle.wharf : signsByStyle.shops;
  const index = wharf ? Math.floor(address / 3) + Math.floor(lot.x * 2 + lot.z) : address;
  return vendors[index % vendors.length];
}

function signMaterial() {
  if (typeof document === 'undefined') return new MeshStandardMaterial({ color: 0x6c5738, side: DoubleSide });
  const image = document.createElement('canvas');
  image.width = 512;
  image.height = signDesigns.length * 96;
  const paint = image.getContext('2d')!;
  for (const [index, sign] of signDesigns.entries()) {
    const y = index * 96;
    const grain = paint.createLinearGradient(0, y, 0, y + 96);
    grain.addColorStop(0, sign.paint);
    grain.addColorStop(.78, sign.paint);
    grain.addColorStop(1, '#293735');
    paint.fillStyle = grain;
    paint.fillRect(0, y, 512, 96);
    paint.strokeStyle = '#e1bf80';
    paint.lineWidth = 4;
    paint.strokeRect(7, y + 6, 498, 84);
    paint.strokeStyle = '#967648';
    paint.lineWidth = 1;
    paint.strokeRect(16, y + 13, 480, 70);
    paint.fillStyle = '#fae7b7';
    paint.textAlign = 'center';
    paint.font = `700 ${sign.name.length > 5 ? 52 : 64}px Georgia, serif`;
    paint.letterSpacing = '3px';
    paint.fillText(sign.name, 256, y + 65, 325);
    paint.font = '500 13px sans-serif';
    paint.letterSpacing = '2px';
    paint.fillText(sign.service, 256, y + 80);
    paint.font = '27px Georgia, serif';
    paint.fillText(sign.icon, 49, y + 57);
    paint.fillText(sign.icon, 464, y + 57);
  }
  const atlas = new CanvasTexture(image);
  atlas.colorSpace = SRGBColorSpace;
  atlas.anisotropy = 2;
  return new MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: .86, side: DoubleSide });
}

const tint = (color: Color, strength: number) => color.clone().multiplyScalar(strength);
function noise(index: number, salt: number) {
  const n = Math.imul(index + 67, 374761393) ^ Math.imul(salt + 129, 668265263);
  return ((Math.imul(n ^ (n >>> 13), 1274126177) ^ (n >>> 16)) >>> 0) / 4294967296;
}

const surfacePatterns = {
  brick: { spacing: '.218, .086', roughness: .95, fleck: '.32', joint: '.86', mortar: '1.29', weight: '.48', lip: '.16', roll: '0.0' },
  ashlar: { spacing: '.423, .172', roughness: .91, fleck: '.21', joint: '.78', mortar: '.65', weight: '.43', lip: '.19', roll: '0.0' },
  slate: { spacing: '.178, .127', roughness: .83, fleck: '.19', joint: '.61', mortar: '.63', weight: '.42', lip: '.26', roll: '0.0' },
  tile: { spacing: '.137, .155', roughness: .87, fleck: '.23', joint: '.57', mortar: '.62', weight: '.40', lip: '.18', roll: '.43' },
};

function patterned(kind: keyof typeof surfacePatterns) {
  const pattern = surfacePatterns[kind];
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: pattern.roughness, side: DoubleSide });
  material.customProgramCacheKey = () => `ring-terrace-${kind}`;
  material.onBeforeCompile = shader => {
    shader.vertexShader = `attribute vec2 terraceCoord; varying vec2 terracePoint;\n${shader.vertexShader}`.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n terracePoint = terraceCoord;');
    shader.fragmentShader = `varying vec2 terracePoint;\n${shader.fragmentShader}`.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 p = terracePoint / vec2(${pattern.spacing});
      p.x += ${kind === 'tile' ? '0.0' : '.5'} * mod(floor(p.y), 2.0);
      float distanceToJoint = min(fract(p.x), 1.0 - fract(p.x));
      float distanceToCourse = min(fract(p.y), 1.0 - fract(p.y));
      vec2 footprint = fwidth(terracePoint);
      float visibleGrain = 1.0 - smoothstep(.03, .097, max(footprint.x, footprint.y));
      vec2 tile = fract(p);
      float joint = 1.0 - smoothstep(.020, .060, distanceToJoint);
      float course = 1.0 - smoothstep(.021, .066, distanceToCourse);
      float n = fract(sin(dot(floor(p), vec2(41.13, 113.38))) * 43758.5453) - .5;
      float lip = (1.0 - smoothstep(.038, .146, tile.y)) - (1.0 - smoothstep(.044, .18, 1.0 - tile.y));
      float roll = sin(tile.x * 6.283) * ${pattern.roll};
      float runnel = .034 * sin(terracePoint.x * 12.83 + sin(terracePoint.x * 3.92) * 3.3 + terracePoint.y * .61);
      float tideStain = (1.0 - smoothstep(.04, .61, terracePoint.y)) * (.12 + runnel);
      diffuseColor.rgb *= 1.0 + (n * ${pattern.fleck} + lip * ${pattern.lip} + roll) * visibleGrain + runnel - tideStain;
      diffuseColor.r *= 1.0 + n * .102 * visibleGrain;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * ${pattern.mortar},
        visibleGrain * max(course, joint * ${pattern.joint}) * ${pattern.weight});
    `);
  };
  return material;
}

function finishes(): Materials {
  return {
    brick: patterned('brick'),
    ashlar: patterned('ashlar'),
    slate: patterned('slate'),
    tile: patterned('tile'),
    trim: new MeshStandardMaterial({ vertexColors: true, roughness: .77, side: DoubleSide }),
    glass: new MeshStandardMaterial({ vertexColors: true, roughness: .38, metalness: .12, side: DoubleSide }),
    lit: new MeshStandardMaterial({ vertexColors: true, roughness: .43, emissive: 0xeab175, emissiveIntensity: 0, side: DoubleSide }),
    sign: signMaterial(),
  };
}

class FaceAccumulator {
  readonly position: number[] = [];
  readonly color: number[] = [];
  readonly coord: number[] = [];
  readonly index: number[] = [];
}

class TerraceBuilder {
  private readonly surfaces: Record<Finish, FaceAccumulator> = {
    brick: new FaceAccumulator(), ashlar: new FaceAccumulator(), slate: new FaceAccumulator(), tile: new FaceAccumulator(), trim: new FaceAccumulator(),
    glass: new FaceAccumulator(), lit: new FaceAccumulator(), sign: new FaceAccumulator(),
  };
  private readonly direction: -1 | 1;
  private readonly baseline: number;
  readonly width: number;
  readonly depth: number;
  readonly tangent: number;
  private readonly radialStep: number;
  private readonly radial: boolean;

  constructor(private readonly lot: CityTerrace) {
    this.radial = Boolean(lot.sideFront);
    this.direction = this.radial ? (lot.sideFront === 'west' ? 1 : -1) : (lot.facing === 'inner' ? 1 : -1);
    const angularStep = ringRadius(lot.z + lot.depth / 2) * Math.PI * 2 / RING_PERIOD;
    this.radialStep = ringRadius(lot.z + 1) - ringRadius(lot.z);
    this.tangent = angularStep;
    this.width = this.radial ? lot.depth * this.radialStep / angularStep : lot.width;
    this.depth = this.radial ? lot.width * angularStep / this.radialStep : lot.depth;
    this.baseline = this.radial
      ? lot.x + (this.direction > 0 ? 0 : lot.width)
      : lot.z + (this.direction > 0 ? 0 : lot.depth);
  }

  mirrorLettering(front: boolean) {
    return front === (this.radial ? this.direction < 0 : this.direction > 0);
  }

  private vertices(points: readonly Point[], finish: Finish, color: Color, face: Face) {
    const bucket = this.surfaces[finish];
    const index = bucket.position.length / 3;
    for (const [x, y, z] of points) {
      const row = this.radial ? this.lot.z + x * this.tangent / this.radialStep : this.baseline + z * this.direction;
      const column = this.radial ? this.baseline + z * this.direction * this.radialStep / this.tangent : this.lot.x + x;
      const world = ringPosition(column, row);
      bucket.position.push(world.x, y, world.z);
      bucket.color.push(color.r, color.g, color.b);
      const tangent = x * (this.radial ? this.tangent : ringRadius(row) * Math.PI * 2 / RING_PERIOD);
      bucket.coord.push((face === 'side' ? z * this.radialStep : tangent) + this.lot.x * .31, face === 'roof' ? z * .53 : y);
    }
    return index;
  }

  triangle(a: Point, b: Point, c: Point, finish: Finish, color: Color, face: Face = 'front') {
    const index = this.vertices([a, b, c], finish, color, face);
    this.surfaces[finish].index.push(index, index + 1, index + 2);
  }

  quad(a: Point, b: Point, c: Point, d: Point, finish: Finish, color: Color, face: Face = 'front') {
    const index = this.vertices([a, b, c, d], finish, color, face);
    this.surfaces[finish].index.push(index, index + 1, index + 2, index + 2, index + 1, index + 3);
  }

  shopSign(name: ShopName, left: number, right: number, bottom: number, top: number, side: Side, paint: Color) {
    this.signSurface(name, bottom, top, this.mirrorLettering(side.front), paint, Math.ceil((right - left) * 5),
      (ratio, y) => [left + (right - left) * ratio, y, side.at]);
  }

  endShopSign(name: ShopName, from: number, to: number, bottom: number, top: number, edge: number, outside: -1 | 1, paint: Color) {
    const reverse = this.radial ? outside !== this.direction : outside === this.direction;
    this.signSurface(name, bottom, top, reverse, paint, this.radial ? Math.ceil((to - from) / .68) : 1,
      (ratio, y) => [edge, y, from + (to - from) * ratio]);
  }

  private signSurface(name: ShopName, bottom: number, top: number, flip: boolean, paint: Color, segments: number,
    point: (ratio: number, elevation: number) => Point) {
    const row = signDesigns.findIndex(sign => sign.name === name);
    const h = signDesigns.length;
    const upper = 1 - (row + .023) / h, lower = 1 - (row + .977) / h;
    const x0 = flip ? .998 : .002, x1 = flip ? .002 : .998;
    const uv = (from: number, y: number): UV => [x0 + (x1 - x0) * from, y];
    const coords = this.surfaces.sign.coord;
    for (let i = 0; i < segments; i++) {
      const f = i / segments, g = (i + 1) / segments;
      const start = coords.length;
      this.quad(point(f, top), point(f, bottom), point(g, top), point(g, bottom), 'sign', paint);
      coords.splice(start, 8, ...uv(f, upper), ...uv(f, lower), ...uv(g, upper), ...uv(g, lower));
    }
  }

  facade(left: number, right: number, bottom: number, top: number, z: number, finish: Finish, color: Color) {
    if (right <= left || top <= bottom) return;
    const segments = Math.max(1, Math.ceil((right - left) * 4));
    for (let i = 0; i < segments; i++) {
      const x = left + (right - left) * i / segments, end = left + (right - left) * (i + 1) / segments;
      this.quad([x, top, z], [x, bottom, z], [end, top, z], [end, bottom, z], finish, color);
    }
  }

  roof(left: number, right: number, a: [y: number, z: number], b: [y: number, z: number], finish: Finish, color: Color, hip = 0) {
    const segments = Math.max(1, Math.ceil((right - left) * 4));
    const rows = this.radial ? Math.max(1, Math.ceil(Math.abs(a[1] - b[1]) / .68)) : 1;
    for (let i = 0; i < segments; i++) {
      const x = left + (right - left) * i / segments, end = left + (right - left) * (i + 1) / segments;
      for (let j = 0; j < rows; j++) {
        const from = j / rows, to = (j + 1) / rows;
        const first: [number, number] = [a[0] + (b[0] - a[0]) * from, a[1] + (b[1] - a[1]) * from];
        const last: [number, number] = [a[0] + (b[0] - a[0]) * to, a[1] + (b[1] - a[1]) * to];
        const startInset = hip * (1 - 2 * i / segments), endInset = hip * (1 - 2 * (i + 1) / segments);
        this.quad([x + startInset * from, ...first], [x + startInset * to, ...last],
          [end + endInset * from, ...first], [end + endInset * to, ...last], finish, color, 'roof');
      }
    }
  }

  wall(left: number, right: number, top: number, side: Side, finish: Finish, color: Color, base = 0) {
    const openings = side.openings ?? [];
    const cutsWithin = openings.filter(opening => opening.bottom < top && opening.top > base);
    const bands = [...new Set([base, top, ...cutsWithin.flatMap(opening => [Math.max(base, opening.bottom), Math.min(top, opening.top)])])].sort((a, b) => a - b);
    for (let i = 0; i < bands.length - 1; i++) {
      const bottom = bands[i], upper = bands[i + 1];
      const cuts = cutsWithin.filter(opening => opening.bottom <= bottom && opening.top >= upper).sort((a, b) => a.left - b.left);
      let x = left;
      for (const cut of cuts) {
        this.facade(x, cut.left, bottom, upper, side.at, finish, color);
        x = Math.max(x, cut.right);
      }
      this.facade(x, right, bottom, upper, side.at, finish, color);
    }
  }

  endPanel(x: number, from: number, to: number, bottom: number, top: number, finish: Finish, color: Color) {
    if (to - from <= .0001 || top - bottom <= .0001) return;
    const segments = this.radial ? Math.max(1, Math.ceil((to - from) / .68)) : 1;
    for (let i = 0; i < segments; i++) {
      const z = from + (to - from) * i / segments, end = from + (to - from) * (i + 1) / segments;
      this.quad([x, top, z], [x, bottom, z], [x, top, end], [x, bottom, end], finish, color, 'side');
    }
  }

  endGable(x: number, front: number, ridge: number, back: number, eave: number, peak: number, finish: Finish, color: Color) {
    for (const [from, to, rising] of [[front, ridge, true], [ridge, back, false]] as const) {
      const segments = this.radial ? Math.max(1, Math.ceil((to - from) / .65)) : 1;
      for (let i = 0; i < segments; i++) {
        const a = i / segments, b = (i + 1) / segments;
        const h0 = eave + (peak - eave) * (rising ? a : 1 - a);
        const h1 = eave + (peak - eave) * (rising ? b : 1 - b);
        const p = from + (to - from) * a, q = from + (to - from) * b;
        this.quad([x, h0, p], [x, eave, p], [x, h1, q], [x, eave, q], finish, color, 'side');
      }
    }
  }

  hipRoof(x: number, inward: number, front: number, ridge: number, back: number, eave: number, peak: number, finish: RoofFinish, color: Color) {
    for (const limit of [front, back]) {
      const rows = this.radial ? Math.max(1, Math.ceil(Math.abs(limit - ridge) / .68)) : 1;
      const point = (ratio: number, z: number): Point => [x + (inward - x) * ratio, eave + (peak - eave) * ratio, z + (ridge - z) * ratio];
      for (let i = 0; i < rows; i++) {
        const start = i / rows, end = (i + 1) / rows;
        this.quad(point(start, limit), point(end, limit), point(start, ridge), point(end, ridge), finish, color, 'roof');
      }
    }
  }

  box(left: number, right: number, base: number, top: number, front: number, back: number, finish: Finish, color: Color) {
    this.facade(left, right, base, top, front, finish, color);
    this.facade(left, right, base, top, back, finish, tint(color, .92));
    this.roof(left, right, [top, front], [top, back], finish, color);
    const side = tint(color, .88);
    for (const x of [left, right]) this.endPanel(x, front, back, base, top, finish, side);
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
      geometry.setAttribute(name === 'sign' ? 'uv' : 'terraceCoord', new Float32BufferAttribute(attributes.coord, 2));
      geometry.setIndex(attributes.index);
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      const mesh = new Mesh(geometry, materials[name]);
      mesh.castShadow = name === 'brick' || name === 'ashlar' || name === 'slate' || name === 'tile';
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }
}

function surfacePoint(side: Side, amount: number) {
  return side.at + (side.front ? -amount : amount);
}

function plaque(builder: TerraceBuilder, text: string, x: number, y: number, side: Side, scale: number) {
  const spacing = scale * 4;
  const length = text.length * spacing - scale;
  const left = x - length / 2;
  const reverse = builder.mirrorLettering(side.front);
  builder.facade(left - scale * 1.4, left + length + scale * 1.4, y - scale * 3.4, y + scale * 3.4, side.at, 'trim', deep);
  for (let char = 0; char < text.length; char++) {
    const value = text[char];
    const glyph = numerals[Number(value)] ?? letters[value];
    if (!glyph) continue;
    for (let row = 0; row < glyph.length; row++) for (let column = 0; column < glyph[row].length; column++) {
      if (glyph[row][column] !== '1') continue;
      const place = char * spacing + column * scale;
      const at = left + (reverse ? length - scale - place : place);
      const down = y + (2.5 - row) * scale;
      builder.facade(at, at + scale * .95, down - scale * .96, down, surfacePoint(side, .015), 'trim', tint(cream, 1.06));
    }
  }
}

function reveal(builder: TerraceBuilder, side: Side, opening: Opening, stone: Color, depth = .175) {
  const { left, right, bottom, top } = opening;
  side.openings?.push(opening);
  const rim = surfacePoint(side, .050);
  const pane = surfacePoint(side, side.openings ? -depth : .011);
  const inward = Math.min((right - left) * .09, .024);
  const darkJamb = tint(stone, .57);
  const lightJamb = tint(stone, .77);
  builder.quad([left, top, rim], [left, bottom, rim], [left + inward, top - .029, pane], [left + inward, bottom + .015, pane], 'trim', darkJamb, 'side');
  builder.quad([right, top, rim], [right, bottom, rim], [right - inward, top - .029, pane], [right - inward, bottom + .015, pane], 'trim', lightJamb, 'side');
  builder.roof(left, right, [top, rim], [top - .029, pane], 'trim', tint(stone, .48));
  builder.roof(left, right, [bottom, rim], [bottom + .015, pane], 'trim', tint(stone, .73));
  return { left: left + inward, right: right - inward, bottom: bottom + .014, top: top - .027, at: pane };
}

function paneGlass(builder: TerraceBuilder, side: Side, left: number, right: number, bottom: number, top: number, warm: boolean, curtains = false) {
  const height = top - bottom, width = right - left;
  const finish = warm ? 'lit' : 'glass';
  builder.facade(left, right, bottom, top, side.at, finish, warm ? honey : glass);
  const plane = surfacePoint(side, .003);
  builder.facade(left, right, bottom, bottom + height * .34, plane, finish, warm ? tint(honey, .77) : paneDark);
  if (warm && curtains) {
    for (const [from, to] of [[left, left + width * .19], [right - width * .19, right]]) {
      builder.facade(from, to, bottom, top, surfacePoint(side, .006), 'trim', tint(oldIvory, .73));
      builder.facade(from + (to - from) * .32, from + (to - from) * .52, bottom, top, surfacePoint(side, .009), 'trim', tint(oldIvory, .86));
    }
  } else if (!warm) {
    const glint = surfacePoint(side, .008);
    builder.quad([left, top - height * .095, glint], [left, top - height * .161, glint],
      [right, top - height * .345, glint], [right, top - height * .412, glint], 'glass', tint(skyReflection, .75));
  }
}

function sash(builder: TerraceBuilder, side: Side, x: number, y: number, width: number, height: number, warm: boolean, surround = true, depth = .175) {
  const left = x - width / 2, right = x + width / 2;
  const foot = y - height / 2, crown = y + height / 2;
  const cavity = reveal(builder, side, { left, right, bottom: foot, top: crown }, sand, depth);
  const frameAt = { at: cavity.at, front: side.front };
  const jamb = surfacePoint(frameAt, .019);
  const widthAt = cavity.right - cavity.left;
  const sashFrame = warm ? cream : oldIvory;
  paneGlass(builder, frameAt, cavity.left, cavity.right, cavity.bottom, cavity.top, warm, surround);
  const bar = Math.min(width * .070, .011);
  for (const pos of [cavity.left, x - bar / 2, cavity.right - bar]) {
    builder.facade(pos, pos + bar, cavity.bottom, cavity.top, jamb, 'trim', sashFrame);
  }
  for (const [level, thickness] of [[cavity.bottom, .018], [y - .022, .028], [cavity.top - .015, .016]]) {
    builder.facade(cavity.left, cavity.right, level, level + thickness, jamb, 'trim', sashFrame);
  }
  if (surround && widthAt > .14) {
    builder.facade(cavity.left, cavity.right, y + height * .212, y + height * .226, jamb, 'trim', sashFrame);
  }
  const lip = surfacePoint(side, .106);
  builder.box(left - .028, right + .028, foot - .052, foot, Math.min(side.at, lip), Math.max(side.at, lip), 'trim', cream);
  if (surround) {
    for (const [from, to] of [[left - .016, left + .008], [right - .008, right + .016]]) {
      builder.facade(from, to, foot - .013, crown + .018, surfacePoint(side, .057), 'trim', sand);
    }
    builder.box(left - .027, right + .027, crown - .006, crown + .051, Math.min(side.at, lip), Math.max(side.at, lip), 'trim', cream);
    builder.facade(x - .018, x + .018, crown + .012, crown + .071, surfacePoint(side, .111), 'trim', tint(cream, 1.04));
  }
}

function baySash(builder: TerraceBuilder, side: Side, x: number, width: number, wall: Color, warm: boolean, center = .577) {
  const left = x - width * .5, right = x + width * .5;
  const head = center + .318, foot = center - .324;
  const face = surfacePoint(side, .309);
  const wing = width * .17;
  const faceSide: Side = { front: side.front, at: face, openings: [] };
  for (const [wallAt, faceAt] of [[left, left + wing], [right, right - wing]]) {
    const along = (part: number, y: number, relief = 0): Point => [
      wallAt + (faceAt - wallAt) * part, y, side.at + (face - side.at) * part + (side.front ? -relief : relief),
    ];
    builder.quad(along(0, head), along(0, foot), along(1, head), along(1, foot), 'trim', tint(wall, .74));
    builder.quad(along(.13, head - .075, .010), along(.13, foot + .086, .010),
      along(.89, head - .075, .010), along(.89, foot + .086, .010), warm ? 'lit' : 'glass', warm ? honey : glass);
    builder.quad(along(.13, head - .185, .013), along(.13, head - .219, .013),
      along(.89, head - .237, .013), along(.89, head - .270, .013), 'glass', tint(skyReflection, .77));
    for (const level of [foot + .077, center, head - .065]) {
      builder.quad(along(.05, level + .014, .020), along(.05, level, .020),
        along(.94, level + .014, .020), along(.94, level, .020), 'trim', cream);
    }
  }
  builder.roof(left - .023, right + .023, [head + .125, side.at], [head + .022, surfacePoint(side, .353)], 'slate', roofInk);
  const sill = surfacePoint(side, .333);
  builder.box(left - .018, right + .018, foot - .049, foot + .006, Math.min(sill, side.at), Math.max(sill, side.at), 'trim', cream);
  if (center > 1) {
    for (const offset of [-.23, .23]) {
      const support = x + width * offset;
      builder.box(support - .022, support + .022, foot - .138, foot - .047,
        Math.min(face, side.at), Math.max(face, side.at), 'trim', sand);
      builder.roof(support - .029, support + .029, [foot - .200, side.at], [foot - .108, surfacePoint(side, .276)], 'trim', tint(cream, .82));
    }
  }
  sash(builder, faceSide, x, center, width * .595, .460, warm, false, .083);
  builder.wall(left + wing, right - wing, head, faceSide, 'trim', wall, foot);
}

function archedSash(builder: TerraceBuilder, side: Side, x: number, base: number, width: number, height: number, warm: boolean,
  masonry: Color = sand, finish: Finish = 'ashlar') {
  const spring = base + height * .67;
  const head = base + height;
  const half = width * .5;
  const radius = height * .33;
  const at = surfacePoint(side, side.openings ? -.156 : .019);
  const behind = { front: side.front, at };
  const stone = surfacePoint(side, .064);
  side.openings?.push({ left: x - half, right: x + half, bottom: base, top: head });
  const arc = (angle: number, radial: number, rise: number, plane: number): Point => [
    x + Math.cos(angle) * (half + radial), spring + Math.sin(angle) * (radius + rise), plane,
  ];
  const paneHalf = half * .88;
  const paint = warm ? honey : glass;
  paneGlass(builder, behind, x - paneHalf, x + paneHalf, base + .014, spring, warm);
  for (let sector = 0; sector < 8; sector++) {
    const a = sector * Math.PI / 8, b = (sector + 1) * Math.PI / 8;
    const first = arc(a, 0, 0, side.at), second = arc(b, 0, 0, side.at);
    if (side.openings) builder.quad([first[0], head, side.at], first, [second[0], head, side.at], second, finish, masonry);
    const glassA = arc(a, paneHalf - half, -.022, at), glassB = arc(b, paneHalf - half, -.022, at);
    builder.triangle([x, spring - .006, at], glassA, glassB, warm ? 'lit' : 'glass', paint);
    builder.quad(arc(a, -.004, -.006, stone), glassA, arc(b, -.004, -.006, stone), glassB, 'trim', tint(masonry, .62), 'roof');
    const trim = sector === 3 || sector === 4;
    const relief = surfacePoint(side, trim ? .088 : .073);
    builder.quad(arc(a + .016, .020, trim ? .057 : .041, relief), arc(a + .016, -.004, -.006, stone),
      arc(b - .016, .020, trim ? .057 : .041, relief), arc(b - .016, -.004, -.006, stone), 'trim', trim ? cream : sand);
  }
  for (const direction of [-1, 1]) {
    const edge = x + direction * half;
    const glassEdge = x + direction * paneHalf;
    builder.quad([edge, spring, stone], [edge, base, stone], [glassEdge, spring, at], [glassEdge, base + .017, at], 'trim', tint(masonry, .69), 'side');
    builder.facade(Math.min(edge, edge + direction * .017), Math.max(edge, edge + direction * .017), base, spring, stone, 'trim', sand);
  }
  const bars = surfacePoint(behind, .023);
  builder.facade(x - .006, x + .006, base + .014, spring + radius * .82, bars, 'trim', cream);
  builder.facade(x - paneHalf, x + paneHalf, spring - .012, spring + .009, bars, 'trim', cream);
  const lip = surfacePoint(side, .116);
  builder.box(x - half - .026, x + half + .026, base - .048, base, Math.min(lip, at), Math.max(lip, at), 'trim', cream);
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
  const top = primary ? .831 : .753;
  const cavity = reveal(builder, side, { left, right, bottom: .09, top }, sand, primary ? .203 : .151);
  const doorSide = { front: side.front, at: cavity.at };
  const trim = surfacePoint(doorSide, .022);
  builder.facade(cavity.left, cavity.right, .101, top - .018, doorSide.at, 'trim', door);
  for (const x of [left - .024, right - .001]) {
    builder.facade(x, x + .025, .11, top + .031, surfacePoint(side, .053), 'trim', cream);
  }
  const leaf = (cavity.right - cavity.left) * .17;
  for (const y of [.216, .493]) {
    builder.facade(cavity.left + leaf, cavity.right - leaf, y, y + .139, trim, 'trim', tint(door, .72));
    builder.facade(cavity.left + leaf * 1.24, cavity.right - leaf * 1.24, y + .110, y + .135,
      surfacePoint(doorSide, .026), 'trim', tint(door, 1.24));
  }
  builder.facade(cavity.right - leaf, cavity.right - leaf * .28, .416, .444, surfacePoint(doorSide, .032), 'trim', brass);
  builder.facade(left - .034, right + .034, top - .012, top + .063, surfacePoint(side, .060), 'trim', cream);
  if (primary) fanlight(builder, side, center, top + .057, width * .53, .106, number % 3 === 0);
  const sill = surfacePoint(side, primary ? .21 : .12);
  const threshold = surfacePoint(side, primary ? .138 : .095);
  builder.box(left - .040, right + .041, 0, .072, Math.min(sill, cavity.at), Math.max(sill, cavity.at), 'trim', sand);
  builder.box(left - .026, right + .027, .072, .122, Math.min(threshold, cavity.at), Math.max(threshold, cavity.at), 'trim', cream);
  plaque(builder, String(number), center, top - .136, { ...doorSide, at: surfacePoint(doorSide, .036) }, primary ? .010 : .008);
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

function hangingShopSign(builder: TerraceBuilder, text: ShopName, x: number, y: number, side: Side, featured: boolean) {
  const far = surfacePoint(side, featured ? .599 : .47), near = surfacePoint(side, featured ? .191 : .204);
  const paint = new Color(signDesigns.find(sign => sign.name === text)?.paint ?? '#46493d');
  const front = Math.min(far, near), back = Math.max(far, near);
  const lineHeight = featured ? .120 : .079;
  const height = text.length * lineHeight + .12;
  const top = y + height / 2;
  const bottom = y - height / 2;
  builder.box(x - .015, x + .015, bottom, top, front, back, 'trim', paint);
  for (const line of [top - .021, bottom + .006]) builder.box(x - .018, x + .018, line, line + .016, front - .012, back + .009, 'trim', brass);
  builder.box(x - .013, x + .013, top + .032, top + .060, Math.min(far, side.at), Math.max(far, side.at), 'trim', iron);
  builder.roof(x - .011, x + .011, [top + .050, surfacePoint(side, .405)], [top + .166, side.at], 'trim', iron);
  for (const depth of [front + .044, back - .031]) builder.box(x - .009, x + .009, top - .010, top + .052, depth, depth + .022, 'trim', brass);
  const pixel = featured ? .018 : .014;
  const depthPixel = featured ? .060 : .035;
  const left = (front + back - depthPixel * 3) / 2;
  for (const edge of [-1, 1]) {
    const at = x + edge * .018;
    for (let char = 0; char < text.length; char++) {
      const glyph = letters[text[char]];
      if (!glyph) continue;
      for (let row = 0; row < glyph.length; row++) for (let col = 0; col < glyph[row].length; col++) {
        if (glyph[row][col] !== '1') continue;
        const z = left + (edge > 0 ? col : 2 - col) * depthPixel;
        const up = top - .061 - char * lineHeight - row * pixel;
        builder.quad([at, up, z], [at, up - pixel * .94, z], [at, up, z + depthPixel * .95],
          [at, up - pixel * .94, z + depthPixel * .95], 'trim', tint(cream, 1.08), 'side');
      }
    }
  }
}

function shopLamp(builder: TerraceBuilder, side: Side, x: number, y: number) {
  const back = surfacePoint(side, .035), arm = surfacePoint(side, .139);
  const box = (width: number, low: number, top: number, left: number, right: number, paint: Color, finish: Finish = 'trim') =>
    builder.box(x - width, x + width, y + low, y + top, Math.min(left, right), Math.max(left, right), finish, paint);
  box(.014, -.090, .047, side.at, back, iron);
  box(.009, .004, .029, back, arm, iron);
  box(.021, -.127, -.033, surfacePoint(side, .106), surfacePoint(side, .176), oldIvory, 'lit');
  box(.027, -.142, -.128, surfacePoint(side, .103), surfacePoint(side, .182), iron);
  box(.025, -.038, -.022, surfacePoint(side, .099), surfacePoint(side, .182), iron);
  builder.roof(x - .025, x + .025, [y - .021, surfacePoint(side, .099)], [y + .020, arm], 'trim', iron);
  builder.roof(x - .025, x + .025, [y + .020, arm], [y - .021, surfacePoint(side, .182)], 'trim', iron);
}

function shopDisplay(builder: TerraceBuilder, side: Side, x: number, width: number, paneHeight: number, paint: Color, choice: number) {
  const foot = .238;
  const crown = foot + paneHeight;
  const aperture = { left: x - width / 2, right: x + width / 2, bottom: foot, top: crown };
  const cavity = reveal(builder, side, aperture, paint, .220);
  const interior = { at: cavity.at, front: side.front };
  const space = cavity.right - cavity.left;
  const z = (offset: number) => surfacePoint(interior, offset);
  const warm = choice % 4 !== 2;
  builder.facade(cavity.left, cavity.right, cavity.bottom, cavity.top, cavity.at, warm ? 'lit' : 'glass', warm ? tint(honey, .61) : paneDark);
  const stock = choice % 3 === 0 ? ['#947247', '#c49a64', '#764a43', '#8e8e68'] : choice % 3 === 1
    ? ['#966351', '#a6875a', '#657668', '#b07859'] : ['#6e8380', '#b89974', '#6b5760', '#997f5e'];
  for (let level = 0; level < 2; level++) {
    const shelf = cavity.bottom + .060 + level * .230;
    builder.box(cavity.left, cavity.right, shelf - .021, shelf, Math.min(cavity.at, z(.102)), Math.max(cavity.at, z(.102)), 'trim', tint(paint, .73));
    const count = width > .35 ? 7 : width > .19 ? 5 : 3;
    for (let piece = 0; piece < count; piece++) {
      const item = space / count;
      const center = cavity.left + item * (piece + .5);
      const height = .047 + noise(choice * 13 + piece, level * 7 + 81) * (level === 0 ? .075 : .116);
      const color = new Color(stock[(piece + choice + level * 2) % stock.length]);
      const depth = .096 - piece % 2 * .027;
      builder.box(center - item * .34, center + item * .34, shelf, shelf + height, Math.min(z(.027), z(depth)), Math.max(z(.027), z(depth)), 'trim', color);
      if (choice % 3 !== 1) builder.facade(center - item * .22, center + item * .22, shelf + height * .29,
        shelf + height * .65, z(depth + .005), 'trim', tint(cream, .79));
    }
  }
  const mullion = tint(paint, 1.18);
  const mullionAt = z(.151);
  for (const pos of [cavity.left, x, cavity.right]) {
    builder.facade(pos - .009, pos + .009, cavity.bottom, cavity.top, mullionAt, 'trim', mullion);
  }
  for (const up of [cavity.bottom, cavity.top - .109, cavity.top - .016]) {
    builder.facade(cavity.left, cavity.right, up, up + .018, mullionAt, 'trim', mullion);
  }
  const reflection = z(.137);
  builder.quad([cavity.left, cavity.top - .021, reflection], [cavity.left, cavity.top - .046, reflection],
    [cavity.right, cavity.top - .134, reflection], [cavity.right, cavity.top - .166, reflection], 'glass', tint(skyReflection, .62));
  builder.facade(cavity.left + space * .30, cavity.left + space * .35, cavity.bottom + .066, cavity.top - .163, reflection, 'glass', tint(skyReflection, .53));
  const lip = surfacePoint(side, .105);
  const wall = side.at;
  builder.box(aperture.left - .014, aperture.right + .014, foot - .037, foot, Math.min(wall, lip), Math.max(wall, lip), 'trim', mullion);
  builder.box(aperture.left - .014, aperture.right + .014, crown, crown + .057, Math.min(wall, lip), Math.max(wall, lip), 'trim', mullion);
  for (const edge of [aperture.left, aperture.right]) {
    builder.facade(edge - .010, edge + .010, foot, crown, surfacePoint(side, .058), 'trim', mullion);
  }
}

function shop(builder: TerraceBuilder, left: number, right: number, side: Side, style: CityTerrace['style'],
  choice: number, number: number, displayWidth: number, entrance: number, name: ShopName, featured = false) {
  const color = shopPaint[(choice + (style === 'wharf' ? 0 : 2) + (side.front ? 0 : 1)) % shopPaint.length];
  const span = right - left;
  const z = (offset: number) => surfacePoint(side, offset);
  const x = (left + right) / 2;
  const door = Math.min(.092, span * .149);
  const pilasterPositions = [left + .031, entrance - door - .025, entrance + door + .025, right - .031];
  for (const [from, to] of [[pilasterPositions[0], pilasterPositions[1]], [pilasterPositions[2], pilasterPositions[3]]]) {
    const displaySpan = to - from;
    if (displaySpan < .082) continue;
    const pane = Math.min(displayWidth, displaySpan * .96);
    const center = (from + to) / 2;
    shopDisplay(builder, side, center, pane, style === 'wharf' ? .611 : .645, color, choice + Number(center > entrance));
    builder.facade(from, to, .078, .221, z(.057), 'trim', tint(color, .73));
    builder.facade(from + .009, to - .009, .128, .194, z(.038), 'trim', tint(color, .88));
    builder.facade(from + .013, to - .013, .179, .193, z(.042), 'trim', tint(color, 1.16));
  }
  const doorCavity = reveal(builder, side, { left: entrance - door, right: entrance + door, bottom: .069, top: .875 }, color, .25);
  const doorFace = { at: doorCavity.at, front: side.front };
  paneGlass(builder, doorFace, doorCavity.left, doorCavity.right, .307, .849, choice % 3 !== 1);
  builder.facade(doorCavity.left, doorCavity.right, .087, .311, surfacePoint(doorFace, .021), 'trim', color);
  builder.facade(doorCavity.left, doorCavity.right, .730, .754, surfacePoint(doorFace, .026), 'trim', tint(color, 1.20));
  builder.facade(entrance - .010, entrance + .010, .301, .849, surfacePoint(doorFace, .029), 'trim', tint(color, 1.20));
  builder.facade(entrance + .012, entrance + .025, .397, .467, surfacePoint(doorFace, .036), 'trim', brass);
  plaque(builder, String(number), entrance, .226, { ...doorFace, at: surfacePoint(doorFace, .040) }, .008);
  const fasciaRight = right - .024, fasciaLeft = left + .024;
  for (const base of [.912, 1.220]) {
    const lip = z(base > 1 ? .107 : .126);
    const top = base + (base > 1 ? .184 : .132);
    builder.box(fasciaLeft, fasciaRight, base, top, Math.min(side.at, lip), Math.max(side.at, lip), 'trim', tint(color, .92));
    for (const y of [base + .011, top - .009]) {
      const rim = z(.122);
      builder.box(fasciaLeft - .006, fasciaRight + .006, y, y + .015, Math.min(side.at, rim), Math.max(side.at, rim), 'trim', tint(brass, 1.08));
    }
  }
  for (const position of pilasterPositions) {
    const edge = z(.083);
    builder.box(position - .013, position + .013, .073, .946, Math.min(side.at, edge), Math.max(side.at, edge), 'trim', tint(color, .83));
    for (const y of [.106, .869]) {
      const lip = z(.114);
      builder.box(position - .023, position + .023, y, y + .064, Math.min(side.at, lip), Math.max(side.at, lip), 'trim', tint(color, 1.06));
    }
  }
  const signWidth = Math.min(span * (featured ? .80 : .70), (featured ? 2.03 : 1.54) / builder.tangent);
  const signLeft = x - signWidth / 2, signRight = x + signWidth / 2;
  if (featured) {
    const edge = z(.209);
    builder.box(signLeft - .010, signRight + .010, 1.178, 1.401, Math.min(side.at, edge), Math.max(side.at, edge), 'trim', tint(color, .67));
    for (const y of [1.179, 1.389]) builder.facade(signLeft - .011, signRight + .011, y, y + .012, z(.216), 'trim', brass);
  }
  builder.shopSign(name, signLeft, signRight, featured ? 1.192 : 1.243, 1.388,
    { front: side.front, at: z(featured ? .221 : .120) }, signIvory);
  if (span > .39 && side.front) shopLamp(builder, side, entrance + door + .029, .786);
  if (style === 'shops' && (side.front || choice % 3 === 1) || side.front && choice % 3 === 0) {
    hangingShopSign(builder, name, right - .063, featured ? 1.809 : 1.743, side, featured);
  }
  if (choice % 3 !== 1 || side.front) {
    const cloth = [0, 2].includes(choice % 5);
    const stripes = cloth ? 7 : 3;
    const awningStart = left + .021, awningSpan = right - awningStart - .021;
    const projection = side.front ? .367 : .211;
    const shade = z(projection * .47), lip = z(projection);
    for (let i = 0; i < stripes; i++) {
      const start = awningStart + awningSpan * i / stripes;
      const end = awningStart + awningSpan * (i + 1) / stripes;
      const fabric = cloth && i % 2 ? tint(cream, .92) : tint(color, 1.26);
      builder.roof(start, end, [1.188, z(.066)], [1.179, shade], 'trim', fabric);
      builder.roof(start, end, [1.179, shade], [1.057, lip], 'trim', tint(fabric, .87));
      builder.facade(start, end, 1.015, 1.058, lip, 'trim', tint(fabric, .75));
      if (cloth) builder.triangle([start, 1.016, lip], [end, 1.016, lip], [(start + end) / 2, .992, lip], 'trim', tint(fabric, .74));
    }
    for (const end of [awningStart + .012, awningStart + awningSpan - .012]) {
      builder.roof(end - .007, end + .007, [.944, z(.071)], [1.055, lip], 'trim', iron);
    }
  }
  const step = z(.139);
  builder.box(entrance - door - .034, entrance + door + .034, 0, .067, Math.min(doorCavity.at, step), Math.max(doorCavity.at, step), 'trim', sand);
}

function attic(builder: TerraceBuilder, left: number, right: number, front: number, ridge: number, back: number, eave: number, peak: number, shade: Color,
  wall: Color, masonry: Finish, cover: RoofFinish, alternate: boolean, raisedGable: boolean, hip: number) {
  const inset = .017;
  const upper = tint(shade, 1.05);
  builder.roof(left - inset, right + inset, [eave, front], [peak, ridge], cover, shade, hip);
  builder.roof(left - inset, right + inset, [eave, back], [peak, ridge], cover, tint(shade, .91), hip);
  if (hip > 0) {
    builder.hipRoof(left - inset, left - inset + hip, front, ridge, back, eave, peak, cover, tint(shade, .88));
    builder.hipRoof(right + inset, right + inset - hip, front, ridge, back, eave, peak, cover, tint(shade, .94));
  } else {
    for (const x of [left, right]) builder.endGable(x, front + .024, ridge, back - .030, eave, peak, masonry, tint(wall, .91));
  }
  builder.box(left - .024 + hip, right + .024 - hip, peak - .037, peak + .018, ridge - .035, ridge + .035, 'trim', upper);
  for (const side of [front, back]) builder.box(left - inset, right + inset, eave - .051, eave, side - .034, side + .034, 'trim', roofInk);
  if (raisedGable && hip === 0) {
    builder.roof(left - .017, left + .037, [eave + .035, front], [peak + .074, ridge], 'trim', sand);
    builder.roof(left - .017, left + .037, [peak + .074, ridge], [eave + .035, back], 'trim', tint(sand, .90));
  }
  if (!alternate) return;
  const middle = (left + right) / 2, w = (right - left) * .25;
  const opening = front + (ridge - front) * .47;
  const bottom = eave + (peak - eave) * .43;
  const top = Math.min(peak - .078, bottom + .215);
  const lip = opening + (ridge - opening) * .43;
  builder.box(middle - w / 2, middle + w / 2, bottom, top, opening - .016, lip, masonry, wall);
  builder.triangle([middle - w * .58, top, opening - .041], [middle + w * .58, top, opening - .041], [middle, top + .068, opening - .041], 'trim', cream);
  builder.quad([middle - w * .58, top, opening - .06], [middle, top + .072, opening - .06],
    [middle - w * .58, top, lip], [middle, top + .072, lip], cover, shade, 'roof');
  builder.quad([middle, top + .072, opening - .06], [middle + w * .58, top, opening - .06],
    [middle, top + .072, lip], [middle + w * .58, top, lip], cover, upper, 'roof');
  sash(builder, { front: true, at: opening - .018 }, middle, bottom + .095, w * .55, .115, false, false);
}

function streetGable(builder: TerraceBuilder, middle: number, span: number, front: number, ridge: number,
  eave: number, crest: number, wall: Color, roof: Color, cover: RoofFinish) {
  const left = middle - span / 2, right = middle + span / 2;
  const top = eave + (crest - eave) * .79;
  const tail = front + (ridge - front) * .81;
  const verge = front - .064;
  builder.triangle([left, eave - .030, front], [right, eave - .030, front], [middle, top, front], 'ashlar', wall);
  builder.quad([left - .026, eave, verge], [middle, top + .015, verge],
    [left - .026, eave, tail], [middle, top + .015, tail], cover, tint(roof, 1.03), 'roof');
  builder.quad([middle, top + .015, verge], [right + .026, eave, verge],
    [middle, top + .015, tail], [right + .026, eave, tail], cover, tint(roof, .91), 'roof');
  builder.triangle([left - .019, eave - .021, verge], [left + .051, eave - .021, verge],
    [middle, top + .013, verge], 'trim', cream);
  builder.triangle([right - .051, eave - .021, verge], [right + .019, eave - .021, verge],
    [middle, top + .013, verge], 'trim', sand);
  const atticWidth = Math.min(.15, span * .24);
  archedSash(builder, { at: front - .005, front: true }, middle, eave + .067, atticWidth, .173, false);
}

function chimney(builder: TerraceBuilder, x: number, z: number, y: number, w: number, wall: Color,
  pots: boolean, prominent: boolean, taller: boolean) {
  const tip = Math.min(taller ? 4.43 : 2.95, y + (prominent ? .243 : .171));
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

function terraceCornice(builder: TerraceBuilder, left: number, right: number, side: Side, y: number, detailed: boolean) {
  const front = surfacePoint(side, .083), edge = surfacePoint(side, .112);
  builder.box(left - .024, right + .024, y - .056, y, Math.min(front, side.at), Math.max(front, side.at), 'trim', sand);
  builder.box(left - .034, right + .034, y - .012, y + .027, Math.min(edge, side.at), Math.max(edge, side.at), 'trim', cream);
  if (!detailed) return;
  const count = Math.max(2, Math.round((right - left) / .13));
  for (let i = 0; i < count; i++) {
    const x = left + (right - left) * (i + .5) / count;
    builder.facade(x - .023, x + .023, y - .069, y - .027, surfacePoint(side, .093), 'trim', cream);
  }
}

function parapet(builder: TerraceBuilder, left: number, right: number, side: Side, base: number, rise: number, wall: Color, stone: boolean) {
  const span = right - left;
  const front = surfacePoint(side, .026), back = surfacePoint(side, -.16);
  const stepCount = stone ? 3 : 2;
  for (let step = 0; step < stepCount; step++) {
    const inset = step * span * .13;
    const y = base + rise * step / stepCount;
    const top = base + rise * (step + 1) / stepCount;
    builder.box(left + inset, right - inset, y, top, Math.min(front, back), Math.max(front, back), stone ? 'ashlar' : 'brick', wall);
    const lip = surfacePoint(side, .083);
    builder.box(left + inset - .012, right - inset + .012, top - .025, top + .027, Math.min(back, lip), Math.max(back, lip), 'trim', stone ? cream : darkStone);
  }
}

function castBalcony(builder: TerraceBuilder, side: Side, left: number, right: number, height: number, paint: Color) {
  const wall = side.at - (side.front ? .012 : -.012);
  const face = surfacePoint(side, .217);
  builder.box(left - .021, right + .021, height - .053, height + .013, Math.min(wall, face), Math.max(wall, face), 'trim', sand);
  const rail = surfacePoint(side, .198);
  const railFace = surfacePoint(side, .211);
  builder.box(left, right, height + .180, height + .200, Math.min(rail, railFace), Math.max(rail, railFace), 'trim', paint);
  const posts = Math.ceil((right - left) * 25);
  for (let index = 0; index <= posts; index++) {
    const x = left + (right - left) * index / posts;
    const depth = surfacePoint(side, .212);
    builder.box(x - .004, x + .004, height + .013, height + .187, Math.min(rail, depth), Math.max(rail, depth), 'trim', paint);
  }
  for (const edge of [left, right]) {
    builder.roof(edge - .006, edge + .006, [height + .192, wall], [height + .192, rail], 'trim', paint);
  }
}

function endElevation(builder: TerraceBuilder, edge: number, outside: -1 | 1, front: number, back: number, eave: number,
  style: CityTerrace['style'], masonry: Finish, wall: Color, outer: boolean, vendor?: ShopName) {
  const surface = (relief: number) => edge + outside * relief / builder.tangent;
  const depth = back - front;
  const middle = (back + front) / 2;
  const wide = depth > 3.8;
  const freight = style === 'wharf' && wide;
  const moulding = style === 'garden' ? cream : tint(sand, .85);
  const holes: Opening[] = [];
  const panel = (from: number, to: number, bottom: number, top: number, relief: number, finish: Finish, paint: Color) =>
    builder.endPanel(surface(relief), from, to, bottom, top, finish, paint);
  const lip = (from: number, to: number, h0: number, h1: number, relief: number, paint: Color) => {
    const face = surface(relief);
    builder.quad([edge, h1, from], [edge, h1, to], [face, h1, from], [face, h1, to], 'trim', paint, 'roof');
    panel(from, to, h0, h1, relief, 'trim', paint);
  };
  const pier = (at: number, width: number, bottom: number, top: number) => {
    const face = surface(.076), border = surface(.024);
    panel(at - width / 2, at + width / 2, bottom, top, .076, 'trim', moulding);
    for (const point of [at - width / 2, at + width / 2]) {
      builder.quad([border, top, point], [border, bottom, point], [face, top, point], [face, bottom, point], 'trim', tint(moulding, .73), 'side');
      panel(point - .022, point + .022, bottom + .12, top - .12, .086, 'trim', tint(cream, 1.10));
    }
    lip(at - width * .73, at + width * .73, bottom, bottom + .133, .124, sand);
    lip(at - width * .78, at + width * .78, top - .081, top + .005, .151, cream);
    lip(at - width * .65, at + width * .65, top - .141, top - .083, .110, sand);
  };
  const recess = (center: number, width: number, bottom: number, top: number, inset: number) => {
    const from = center - width / 2, to = center + width / 2;
    holes.push({ left: from, right: to, bottom, top });
    const frame = (to - from) * .07;
    const inward = surface(-inset), flared = surface(.053);
    for (const [lipAt, pane] of [[from, from + frame], [to, to - frame]]) {
      builder.quad([flared, top - .006, lipAt], [flared, bottom + .004, lipAt], [inward, top - .035, pane],
        [inward, bottom + .019, pane], 'trim', tint(moulding, lipAt === from ? .58 : .76), 'side');
      panel(lipAt - .025, lipAt + .025, bottom, top, .057, 'trim', moulding);
    }
    for (const [y, inner, shade] of [[top, top - .034, .63], [bottom, bottom + .018, .78]]) {
      builder.quad([flared, y, from], [inward, inner, from + frame], [flared, y, to], [inward, inner, to - frame],
        'trim', tint(moulding, shade), 'side');
    }
    lip(from - .071, to + .071, bottom - .059, bottom, .118, moulding);
    lip(from - .058, to + .058, top - .012, top + .075, .086, moulding);
    return { from: from + frame, to: to - frame, bottom: bottom + .017, top: top - .031 };
  };
  const opening = (center: number, span: number, bottom: number, top: number, warm: boolean, arched = false) => {
    const inset = .176;
    const inner = recess(center, span, bottom, top, inset);
    const tintGlass = warm ? honey : glass;
    const finish = warm ? 'lit' : 'glass';
    panel(inner.from, inner.to, inner.bottom, inner.top, -inset, finish, tintGlass);
    const d = surface(-inset + .007);
    builder.quad([d, top - .063, inner.from], [d, top - .120, inner.from], [d, top - .163, inner.to],
      [d, top - .230, inner.to], finish, warm ? tint(honey, .77) : tint(skyReflection, .63), 'side');
    if (warm) {
      const fold = (inner.to - inner.from) * .18;
      panel(inner.from, inner.from + fold, inner.bottom, inner.top, -inset + .010, 'trim', oldIvory);
      panel(inner.to - fold, inner.to, inner.bottom, inner.top, -inset + .010, 'trim', oldIvory);
    }
    panel(center - .023, center + .023, inner.bottom, inner.top, -inset + .029, 'trim', cream);
    for (const fraction of [.04, .44, .96]) {
      const bar = inner.bottom + (inner.top - inner.bottom) * fraction;
      panel(inner.from, inner.to, bar, bar + .021, -inset + .034, 'trim', cream);
    }
    if (arched) {
      const outer = surface(.142), throat = surface(.026);
      const spring = top - .251;
      const radius = span * .5;
      const point = (angle: number, centerRise: number, widen: number, face: number): Point => [
        face, spring + Math.sin(angle) * (.250 + centerRise), center + Math.cos(angle) * (radius + widen),
      ];
      for (let part = 0; part < 9; part++) {
        const from = part * Math.PI / 9, to = (part + 1) * Math.PI / 9;
        const k = part === 4;
        const a = point(from, 0, .005, throat), b = point(to, 0, .005, throat);
        builder.quad([a[0], top, a[2]], a, [b[0], top, b[2]], b, masonry, tint(wall, .95), 'side');
        builder.quad(point(from + .015, k ? .078 : .049, .100, outer), a,
          point(to - .015, k ? .078 : .049, .100, outer), b, 'trim', k ? cream : moulding, 'side');
      }
    }
  };
  if (freight) {
    const center = middle - depth * .092;
    const span = Math.min(depth * .51, 3.57);
    const inner = recess(center, span, .122, 1.267, .175);
    const value = inner.to - inner.from;
    panel(inner.from, inner.to, .136, 1.24, -.173, 'trim', tint(iron, 1.22));
    for (let i = 1; i < 10; i++) {
      const at = inner.from + value * i * .1;
      panel(at, at + .029, .136, 1.234, -.167, 'trim', tint(iron, 1.75));
    }
    for (const y of [.262, .891]) panel(inner.from, inner.to, y, y + .058, -.145, 'trim', tint(iron, .88));
    const face = surface(-.134);
    for (const [a, b] of [[inner.from, center - .043], [inner.to, center + .043]]) {
      builder.quad([face, .319, a], [face, .374, a], [face, .848, b], [face, .903, b], 'trim', tint(iron, .88), 'side');
    }
    panel(center - .040, center + .040, .134, 1.234, -.143, 'trim', iron);
    for (const sign of [-1, 1]) {
      const at = center + sign * .129;
      panel(at - .059, at + .059, .616, .664, -.123, 'trim', brass);
    }
    lip(inner.from - .153, inner.to + .153, 0, .07, .167, damp);
    lip(inner.from - .105, inner.to + .105, .067, .129, .107, sand);
    if (outer) {
      opening(center, span * .59, 1.556, 2.424, false);
      const top = surface(.367);
      builder.quad([edge, 2.610, center - .049], [edge, 2.663, center - .049],
        [top, 2.610, center - .049], [top, 2.663, center - .049], 'trim', iron, 'side');
      panel(center - .060, center + .060, 2.181, 2.626, .343, 'trim', iron);
      panel(center - .121, center + .121, 2.583, 2.654, .371, 'trim', brass);
      const second = Math.min(back - depth * .148, center + depth * .324);
      opening(second, Math.min(.98, depth * .15), .564, 1.110, true);
      opening(second, Math.min(.96, depth * .15), 1.735, 2.373, false);
    }
  } else {
    const windows = wide ? [front + depth * .264, back - depth * .264] : [middle];
    const width = Math.min(style === 'shops' ? 1.68 : 1.34, depth * (wide ? .32 : .63));
    for (const [i, center] of windows.entries()) {
      const ground = style === 'garden' ? .411 : .356;
      opening(center, width, ground, ground + (style === 'shops' ? .724 : .652), i % 2 === 0, style === 'garden' && wide);
      if (outer) opening(center, width * .948, 1.340, 1.990, i % 2 !== 0);
      opening(center, width * .89, eave - .805, eave - .265, i % 2 === 0 && !outer);
    }
    if (style === 'garden' && wide) {
      for (const offset of [.064, .5, .936]) pier(front + depth * offset, Math.min(depth * .065, .43), .134, eave - .076);
      lip(front + .054, back - .054, 1.187, 1.252, .114, sand);
      lip(front + .036, back - .036, eave - .081, eave - .020, .143, cream);
    }
  }
  const levels = [...new Set([0, eave, ...holes.flatMap(hole => [hole.bottom, hole.top])])].sort((a, b) => a - b);
  for (let i = 0; i < levels.length - 1; i++) {
    const bottom = levels[i], top = levels[i + 1];
    let from = front;
    const active = holes.filter(hole => hole.bottom <= bottom && hole.top >= top).sort((a, b) => a.left - b.left);
    for (const { left, right } of active) {
      panel(from, left, bottom, top, 0, masonry, tint(wall, .92));
      from = Math.max(right, from);
    }
    panel(from, back, bottom, top, 0, masonry, tint(wall, .92));
  }
  const pipeAt = front + Math.min(.221, depth * .09);
  panel(pipeAt - .027, pipeAt + .027, .142, eave - .065, .045, 'trim', iron);
  panel(pipeAt - .023, pipeAt + .023, .144, eave - .068, .060, 'trim', tint(iron, 1.32));
  for (const at of [.312, .838, 1.772, 2.56]) {
    if (at < eave - .22) panel(pipeAt - .064, pipeAt + .064, at, at + .046, .069, 'trim', iron);
  }
  if (wide) {
    for (const k of [.108, .91]) {
      const at = front + depth * k;
      panel(at - .118, at + .118, eave - .213, eave - .169, .062, 'trim', iron);
      panel(at - .043, at + .043, eave - .272, eave - .110, .064, 'trim', iron);
    }
  }
  const signClearance = depth * .144 - Math.min(1.68, depth * .32) / 2 - .095;
  if (vendor && wide && signClearance > .52) {
    const center = front + depth * .592;
    const half = Math.min(signClearance, .835);
    const from = center - half, to = center + half;
    const bottom = 1.124, top = 1.420;
    panel(from - .047, to + .047, bottom - .025, top + .026, .086, 'trim', iron);
    lip(from - .052, to + .052, top + .005, top + .027, .128, brass);
    lip(from - .054, to + .054, bottom - .026, bottom - .002, .127, brass);
    for (const bound of [from - .034, to + .034]) {
      panel(bound - .018, bound + .018, bottom - .003, top + .008, .110, 'trim', brass);
    }
    builder.endShopSign(vendor, from, to, bottom, top, surface(.135), outside, signIvory);
  }
}

function house(builder: TerraceBuilder, lot: CityTerrace, index: number) {
  const pitch = builder.width / lot.homes;
  const rowNumber = (lot.address?.first ?? 1) - 1 + index;
  const unit = Math.round(lot.x * 13 + lot.z * 31) + rowNumber * 11;
  const boundary = Math.min(.055, pitch * .083);
  const left = pitch * index + boundary, right = pitch * (index + 1) - boundary;
  const span = right - left;
  const prominent = (index === 0 && lot.style !== 'wharf') || index === lot.homes - 1 && noise(unit, 45) > .52 || Boolean(lot.sideFront);
  const facade = (lot.style === 'wharf' ? .391 : .436) + (rowNumber % 3) * .028;
  const back = builder.depth - .198 - (rowNumber % 3) * .032;
  const isBuff = (rowNumber + Math.floor(lot.x / 3)) % 4 === 0;
  const stoneHouse = lot.style === 'garden';
  const palette = blends[lot.style];
  const wall = new Color(isBuff && !stoneHouse ? buffBricks[(rowNumber + Math.floor(lot.z)) % buffBricks.length] : palette[rowNumber % palette.length]);
  const weatheredClay = stoneHouse && (lot.id === 'garden-crescent' && index === 2
    || lot.id === 'slate-gardens' && index === 1 || lot.id === 'station-road' && index === 1);
  const cover = weatheredClay ? 'tile' : 'slate';
  const roofShape = weatheredClay ? roofClay : rowNumber % 2 ? roofTeal : roofInk;
  const roofColor = tint(roofShape, .93 + noise(unit, 17) * .28);
  const near: Side = { at: facade, front: true, openings: [] };
  const far: Side = { at: back, front: false, openings: [] };
  const outer = lot.z >= outerRingStart;
  const extraFloor = outer ? 1.03 + (prominent ? .085 : 0) : 0;
  const eave = 1.741 + (rowNumber % 3) * .067 + noise(unit, 13) * .093 + (prominent ? .115 : 0) + extraFloor;
  const crest = 2.268 + [0, .19, .068][rowNumber % 3] + noise(unit, 19) * .074 + (prominent ? .187 : 0)
    + extraFloor + (outer ? [.14, .037, .196][rowNumber % 3] : 0);
  const ridge = facade + (back - facade) * (lot.style === 'wharf' && rowNumber % 3 === 0 ? .344 : .46 + (rowNumber % 3) * .058);
  const hip = lot.sideFront && lot.style === 'wharf' || lot.style === 'shops' && rowNumber % 3 === 1
    ? Math.min(span * .202, .524 / builder.tangent) : 0;
  const shopfront = lot.style === 'shops' || lot.style === 'wharf' && rowNumber % 3 === 0;
  const vendor = vendorName(lot, rowNumber);
  const bookNumber = Math.round(lot.x * 2) + 3 + 2 * rowNumber;
  const featured = featuredShops.has(lot.id);
  const middle = (left + right) / 2;
  const aperture = Math.min(span * .243, (outer ? .553 : .515) / builder.tangent);
  const bay = Math.min(span * .403, (outer ? 1.12 : .924) / builder.tangent);
  const storefrontPane = Math.min(span * .553, 1.62 / builder.tangent);
  const masonry = stoneHouse ? 'ashlar' : 'brick';
  for (const edge of [left, right]) {
    if (edge === left && index === 0 || edge === right && index === lot.homes - 1) continue;
    builder.endPanel(edge, facade, back, 0, eave, masonry, tint(wall, .93));
  }
  const belt = stoneHouse ? tint(cream, .84) : tint(wall, .74);
  builder.box(left - .013, right + .013, 1.151, 1.183, facade - .035, back + .031, 'trim', belt);
  if (outer && stoneHouse) builder.box(left - .018, right + .018, 2.018, 2.075, facade - .061, back + .061, 'trim', sand);
  builder.box(left - .020, right + .020, eave - .064, eave - .021, facade - .057, back + .058, 'trim', belt);
  attic(builder, left, right, facade - .072, ridge, back + .059, eave + .012, crest, roofColor, wall, masonry, cover,
    lot.style !== 'wharf' && rowNumber % 3 === 1, prominent || isBuff, hip);
  if (stoneHouse && rowNumber % 3 !== 1) streetGable(builder, middle + span * .042, span * (lot.sideFront ? .88 : .73), facade - .065, ridge, eave, crest, wall, roofColor, cover);
  if (outer && lot.style === 'shops' && (rowNumber % 3 !== 1 || lot.sideFront)) {
    parapet(builder, left, right, near, eave - .026, (crest - eave) * .69, wall, false);
    if (prominent) parapet(builder, left, right, far, eave - .026, (crest - eave) * .48, wall, false);
  }
  if (outer && stoneHouse && lot.sideFront) parapet(builder, left, right, far, eave - .016, (crest - eave) * .51, wall, true);
  chimney(builder, left + span * (rowNumber % 2 ? .27 : .70), ridge + .022, crest,
    Math.min(.087, span * .115), wall, rowNumber % 3 !== 1, prominent, outer);

  const entranceX = left + span * (lot.sideFront ? .50 : rowNumber % 3 === 2 ? .70 : .27);
  const nearSash = left + span * (lot.sideFront ? .817 : rowNumber % 3 === 2 ? .28 : .69);
  const door = doors[(unit + rowNumber) % doors.length];
  if (shopfront) shop(builder, left, right, near, lot.style, rowNumber, bookNumber, storefrontPane, middle, vendor, featured);
  else {
    entrance(builder, near, entranceX, Math.min(.74 / builder.tangent, span * .257), door, bookNumber, true);
    if (stoneHouse && rowNumber % 2 === 0) archedSash(builder, near, nearSash, .274, aperture * 1.16, .673, true, wall, masonry);
    else sash(builder, near, nearSash, .622, aperture, .518, rowNumber % 2 === 0);
    if (!lot.sideFront) doorwayRails(builder, left, right, entranceX, span * .29, facade, unit);
  }
  const backDoor = left + span * .29;
  if (outer && lot.style === 'shops') {
    shop(builder, left, right, far, lot.style, rowNumber, bookNumber, storefrontPane, backDoor, vendor);
  } else {
    entrance(builder, far, backDoor, Math.min(.72 / builder.tangent, span * .233), tint(door, .89), bookNumber, false);
    if (prominent && lot.style !== 'wharf') baySash(builder, far, left + span * .68, bay, wall, rowNumber % 2 === 0);
    else sash(builder, far, left + span * .67, .638, aperture, .504, rowNumber % 2 === 1);
  }

  for (const side of [near, far]) {
    const detailed = stoneHouse || lot.style === 'shops' && side.front;
    if (prominent || stoneHouse) quoins(builder, side, left + .010, rowNumber, eave);
    if (detailed) terraceCornice(builder, left, right, side, eave - .094, stoneHouse);
    for (const [pane, offset] of [[0, .284], [1, .694]]) {
      const upper = left + span * offset;
      const warm = (rowNumber + pane + (side.front ? 0 : 1)) % 4 === 0;
      if (outer) {
        if (stoneHouse && pane === 0 && (side.front || prominent)) archedSash(builder, side, upper, 1.334, aperture * 1.107, .653, !warm, wall, masonry);
        else sash(builder, side, upper, 1.651 + (rowNumber % 2) * .038, aperture * 1.04, .579, !warm);
      }
      if (stoneHouse && pane === 1 && (side.front || prominent)) {
        baySash(builder, side, upper, bay, wall, warm, eave - .453);
      } else sash(builder, side, upper, eave - .453, aperture, outer ? .585 : .498, warm);
    }
    if (outer && shopfront && (rowNumber % 2 === 1 || lot.sideFront) && (side.front || prominent)) {
      castBalcony(builder, side, left + span * .14, left + span * .84, 1.439, iron);
    }
    const rainAt = side.front ? facade - .050 : back + .039;
    builder.cylinder(right - .028, rainAt, .171, eave - .048, Math.min(.015, span * .028), 'trim', deep, 5);
    builder.wall(left, right, eave, side, masonry, side.front ? wall : tint(wall, .96));
    builder.wall(left - .018, right + .018, .171, { ...side, at: surfacePoint(side, .031) }, 'trim', damp);
  }
  const cornerVendor = featured && lot.sideFront ? vendor : undefined;
  if (index === 0) endElevation(builder, left, -1, facade, back, eave, lot.style, masonry, wall, outer, cornerVendor);
  if (index === lot.homes - 1) endElevation(builder, right, 1, facade, back, eave, lot.style, masonry, wall, outer);
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
      buildingIds.push(`${lot.address?.row ?? lot.id}-${(lot.address?.first ?? 1) + index}`);
    }
    const row = builder.finish(materials);
    row.userData.buildingIds = buildingIds;
    group.add(row);
  }
  return {
    group,
    update(_time: number, darkness: number) {
      const evening = Math.max(0, Math.min(1, darkness));
      materials.lit.emissiveIntensity = .010 + evening * .44;
    },
  };
}
