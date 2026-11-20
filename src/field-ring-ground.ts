import {
  BufferGeometry, Color, DataTexture, DoubleSide, Float32BufferAttribute, Group,
  LinearFilter, Mesh, MeshStandardMaterial, PlaneGeometry, RGBAFormat, ShaderMaterial,
  UniformsLib, UniformsUtils, Vector3, type Material,
} from 'three';
import { cityParcels, cityStreet, cityTerraceAt, harborHeight } from './field-city-layout';
import { tileAt, type Tile } from './field-layout';
import { RING_PERIOD, ringAngle, ringPosition, ringRadius, wrapRingX } from './field-ring-space';

type Point = [number, number, number];
type Edge = { x: number; z: number; dx: number; dz: number; lengthSquared: number };
type EdgeSide = { x: number; z: number; across: boolean; normal: -1 | 1 };

const seaLevel = -.58;
const innerEdge = .43;
const roadIn = cityStreet.north;
const roadOut = cityStreet.south;
const bridgeShoulder = roadOut + .49;
const pierEdge = 14.45;
const coastDepth = 2.85;
const surveySpan = Math.ceil((ringRadius(harborHeight) + coastDepth + .7) * 2) / 2;

const marble = new Color('#d3c6aa');
const pavement = new Color('#b8b4a3');
const grout = new Color('#a4aaa0');
const cobble = new Color('#8b817b');
const pale = new Color('#e7d8b9');
const bronze = new Color('#c4a06c');
const street = new Color('#617380');
const shore = new Color('#a79a80');
const grass = new Color('#648569');
const meadow = new Color('#929e74');
const timber = new Color('#bb966c');
const beam = new Color('#795947');

function random(x: number, z: number, salt: number) {
  const n = Math.imul(x + 101, 374761393) ^ Math.imul(z + 23, 668265263) ^ Math.imul(salt + 7, 1597334677);
  return ((Math.imul(n ^ (n >>> 13), 1274126177) ^ (n >>> 18)) >>> 0) / 4294967296;
}

const tint = (base: Color, power: number) => base.clone().multiplyScalar(power);

function position(x: number, y: number, z: number): Point {
  const world = ringPosition(x, z);
  return [world.x, y, world.z];
}

class RingSurface {
  private readonly vertices: number[] = [];
  private readonly colors: number[] = [];

  triangle(a: Point, b: Point, c: Point, tone: Color, tip = tone, edge = tone) {
    this.vertices.push(...a, ...b, ...c);
    this.colors.push(tone.r, tone.g, tone.b, edge.r, edge.g, edge.b, tip.r, tip.g, tip.b);
  }

  quad(a: Point, b: Point, c: Point, d: Point, tone: Color) {
    this.triangle(a, b, c, tone);
    this.triangle(c, b, d, tone);
  }

  sector(x: number, z: number, w: number, d: number, y: number, tone: Color, resolution = 4) {
    if (w <= 0 || d <= 0) return;
    const segments = Math.max(1, Math.ceil(w * resolution));
    for (let i = 0; i < segments; i++) {
      const a = x + w * i / segments, b = x + w * (i + 1) / segments;
      this.quad(position(a, y, z), position(a, y, z + d), position(b, y, z), position(b, y, z + d), tone);
    }
  }

  block(x: number, z: number, w: number, d: number, base: number, rise: number, tone: Color) {
    const top = base + rise;
    const a = position(x, top, z), b = position(x + w, top, z);
    const c = position(x, top, z + d), e = position(x + w, top, z + d);
    const a0 = [a[0], base, a[2]] as Point, b0 = [b[0], base, b[2]] as Point;
    const c0 = [c[0], base, c[2]] as Point, e0 = [e[0], base, e[2]] as Point;
    this.sector(x, z, w, d, top, tone);
    const side = tint(tone, .83);
    const segments = Math.max(1, Math.ceil(w * 4));
    for (const rad of [z, z + d]) for (let i = 0; i < segments; i++) {
      const left = x + w * i / segments, right = x + w * (i + 1) / segments;
      this.quad(position(left, top, rad), position(left, base, rad), position(right, top, rad), position(right, base, rad), side);
    }
    this.quad(a, c, a0, c0, tint(tone, .91));
    this.quad(b, e, b0, e0, tint(tone, .91));
  }

  mesh(material: Material, name: string, castsShadow = false) {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(this.vertices, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(this.colors, 3));
    geometry.computeVertexNormals();
    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    mesh.receiveShadow = true;
    mesh.castShadow = castsShadow;
    return mesh;
  }
}

const openWater = (kind: Tile) => kind === 'water' || kind === 'shelf' || kind === 'drop';
const boulevard = (z: number) => z >= 11 && z <= 13;
const bridgeSpan = (x: number, z: number) => boulevard(z) && (x === 0 || x >= 34 && x < 38);
function solid(x: number, z: number) {
  if (z < 0 || z >= harborHeight) return false;
  x = wrapRingX(x);
  const surface = tileAt('harbor', x, z);
  return !bridgeSpan(x, z) && !openWater(surface) && surface !== 'dock';
}

function coastPoint(side: EdgeSide, t: number, level: number, setback: number): Point {
  const x = side.x + (side.across ? t : 0);
  const z = side.z + (side.across ? 0 : t);
  const turn = ringAngle(x);
  const base = ringPosition(x, z);
  const offset = side.normal * setback;
  return side.across
    ? [base.x + Math.sin(turn) * offset, level, base.z + Math.cos(turn) * offset]
    : [base.x + Math.cos(turn) * offset, level, base.z - Math.sin(turn) * offset];
}

function writeCliff(surface: RingSurface, edges: Edge[], side: EdgeSide, x: number, z: number, duration = 1) {
  const pieces = side.across ? 4 : 2;
  const tight = side.across && side.z < 1;
  const bands = [[0, 0], [-.12, tight ? .012 : .058], [-.35, tight ? .022 : .14],
    [-.64, tight ? .032 : .248], [-1.1, tight ? .042 : .36]];
  for (let piece = 0; piece < pieces; piece++) {
    const at = duration * piece / pieces, next = duration * (piece + 1) / pieces;
    const a = coastPoint(side, at, 0, 0), b = coastPoint(side, next, 0, 0);
    const dx = b[0] - a[0], dz = b[2] - a[2];
    edges.push({ x: a[0], z: a[2], dx, dz, lengthSquared: dx * dx + dz * dz });
    const stains = random(x, z, piece + 55) * .13;
    for (let layer = 0; layer < bands.length - 1; layer++) {
      const [y, offset] = bands[layer], [lower, expand] = bands[layer + 1];
      surface.quad(coastPoint(side, at, y, offset), coastPoint(side, at, lower, expand),
        coastPoint(side, next, y, offset), coastPoint(side, next, lower, expand),
        tint(shore, [.99, .83, .70, .57][layer] + stains));
    }
  }
}

function ground(upper: RingSurface, cliffs: RingSurface) {
  const edges: Edge[] = [];
  for (let z = 0; z < harborHeight; z++) for (let x = 0; x < RING_PERIOD; x++) {
    if (!solid(x, z)) continue;
    const tile = tileAt('harbor', x, z);
    const nearest = z === 0 ? innerEdge : z;
    const color = tile === 'grass' ? grass : tile === 'lawn' ? meadow : pavement;
    upper.sector(x, nearest, 1, z + 1 - nearest, 0, tint(color, .94 + random(x, z, 1) * .12));
    if (!solid(x, z - 1)) writeCliff(cliffs, edges, { x, z: nearest, across: true, normal: -1 }, x, z);
    if (!solid(x, z + 1)) writeCliff(cliffs, edges, { x, z: z + 1, across: true, normal: 1 }, x, z);
    if (!solid(x - 1, z)) writeCliff(cliffs, edges, { x, z: nearest, across: false, normal: -1 }, x, z, z + 1 - nearest);
    if (!solid(x + 1, z)) writeCliff(cliffs, edges, { x: x + 1, z: nearest, across: false, normal: 1 }, x, z, z + 1 - nearest);
  }
  return edges;
}

function breakwater(top: RingSurface, walls: RingSurface, trim: RingSurface, shoreEdges: Edge[]) {
  // Low outer seawalls continue the circle across the open harbor. The ferry sails clear of their tips.
  const edge = harborHeight + .31;
  for (const [from, to] of [[31.78, 35.75], [37.06, 41.12], [42.43, 46.38]]) {
    const pieces = Math.ceil((to - from) * 3);
    for (let index = 0; index < pieces; index++) {
      const x = from + (to - from) * index / pieces;
      const length = (to - from) / pieces;
      const color = tint(shore, .82 + random(index, Math.round(from), 46) * .17);
      walls.block(x, edge, length, .662, -.83, .84, tint(color, .88));
      for (let course = 0; course < 2; course++) {
        const start = x + .008 + course * .017;
        walls.block(start, edge + .626, length - .025, .045, -.464 + course * .240, .225,
          tint(color, (course === 0 ? .87 : 1.03) + random(index, course, 54) * .10));
      }
      top.sector(x + .003, edge + .05, length - .006, .60, .018, tint(marble, .76 + random(index, 0, 19) * .14));
      trim.block(x + .009, edge + .52, length - .019, .176, .013, .092, tint(marble, .90 + random(index, 1, 57) * .13));
      const a = position(x, 0, edge + .69), b = position(x + length, 0, edge + .69);
      const dx = b[0] - a[0], dz = b[2] - a[2];
      shoreEdges.push({ x: a[0], z: a[2], dx, dz, lengthSquared: dx * dx + dz * dz });
    }
    for (const x of [from + .015, to - .18]) {
      trim.block(x, edge + .09, .154, .52, .017, .22, tint(shore, .79));
      trim.block(x - .015, edge + .05, .183, .63, .235, .047, marble);
    }
  }
}

function platform(wood: RingSurface, seams: RingSurface, metal: RingSurface) {
  for (let x = 1; x < 7; x++) {
    const outer = 13.986 + (pierEdge - 13.986) * (1 - Math.max(0, x + .2 - 5.9) * .70);
    seams.sector(x, 11, 1, outer - 11, -.0007, beam);
    for (let strip = 0; strip < 5; strip++) {
      const at = x + strip / 5;
      const split = 12.30 + random(x, strip, 59) * .45;
      for (const [start, end] of [[11.015, split], [split + .027, outer]]) {
        const paint = tint(timber, .88 + random(x, strip + Math.round(start), 24) * .22);
        wood.block(at + .006, start, .188, end - start, -.116, .116, paint);
        wood.sector(at + .077, start + .135, .019, end - start - .26, .002, tint(paint, .84));
      }
    }
    for (const z of x < 6 ? [11.17, 14.28] : [11.17]) {
      metal.block(x + .30, z, .115, .153, -.93, 1.27, beam);
      metal.block(x + .289, z - .025, .136, .18, .327, .062, tint(timber, .86));
      metal.block(x + .32, z + .025, .071, .108, -.055, .075, tint(bronze, .83));
      metal.block(x + .41, z + .071, .88, .038, .244, .032, tint(timber, .73));
    }
  }
}

function archSpan(deck: RingSurface, walls: RingSurface, x: number, length: number, archCenters: number[]) {
  deck.sector(x, roadIn, length, bridgeShoulder - roadIn, 0, pavement);
  const spans = 48;
  const foot = (u: number) => {
    const dist = Math.min(...archCenters.map(m => Math.abs(u - m))) / .49;
    return dist < 1 ? -.88 + Math.sqrt(1 - dist * dist) * .67 : -.88;
  };
  for (let index = 0; index < spans; index++) {
    const a = x + index * length / spans, b = x + (index + 1) * length / spans;
    const y1 = foot(a), y2 = foot(b);
    for (const z of [roadIn + .10, bridgeShoulder - .10]) {
      const color = tint(shore, .78 + random(index, x, 9) * .19);
      walls.quad(position(a, -.024, z), position(a, y1, z), position(b, -.024, z), position(b, y2, z), color);
      walls.quad(position(a, y1 + .106, z), position(a, y1 + .012, z), position(b, y2 + .106, z), position(b, y2 + .012, z), tint(marble, .88));
    }
    walls.quad(position(a, y1, roadIn + .10), position(a, y1, bridgeShoulder - .10),
      position(b, y2, roadIn + .10), position(b, y2, bridgeShoulder - .10), tint(shore, .67));
  }
}

const nearCrossing = (x: number, distance: number) =>
  cityStreet.crossings.some(at => Math.abs(at - x) < distance);

function avenues(roads: RingSurface, marking: RingSurface, trim: RingSurface) {
  const middle = (roadIn + roadOut) / 2;
  for (let x = 0; x < RING_PERIOD; x++) {
    if (x >= 1 && x < 7) continue;
    roads.sector(x, roadIn, 1, roadOut - roadIn, .012, tint(street, .975 + random(x, 7, 19) * .048));
    roads.sector(x, roadIn, 1, .16, .014, tint(street, 1.18));
    roads.sector(x, roadOut - .15, 1, .15, .014, tint(street, 1.18));
    for (let piece = 0; piece < 2; piece++) {
      const at = x + piece * .5;
      if (nearCrossing(at + .19, .50)) continue;
      const color = tint(marble, .89 + random(x, piece, 86) * .18);
      trim.block(at + .014, roadIn - .065, .475, .143, 0, .061, color);
      trim.block(at + .014, roadOut - .066, .475, .143, 0, .061, color);
      marking.sector(at + .093, middle - .034, .294, .066, .018, bronze);
    }
    if (bridgeSpan(x, 12)) {
      for (const z of [roadIn + .12, bridgeShoulder - .22]) {
        if (!nearCrossing(x + .5, .44)) trim.block(x + .064, z, .87, .19, .063, .144, tint(marble, .89));
      }
    }
  }
  for (const x of cityStreet.crossings) {
    for (let stripe = 0; stripe < 7; stripe++) {
      marking.sector(x - .405 + stripe * .125, roadIn + .26, .066, roadOut - roadIn - .52, .021, pale);
    }
    for (const z of [roadIn - .27, roadOut + .058]) {
      if (!solid(Math.floor(x), Math.floor(z))) continue;
      marking.sector(x - .422, z, .864, .20, .018, tint(bronze, 1.04));
      for (let pebble = 0; pebble < 10; pebble++) for (const offset of [.043, .132]) {
        marking.sector(x - .364 + pebble * .082, z + offset, .029, .036, .021, pale);
      }
    }
  }
}

function stonework(paving: RingSurface, rails: RingSurface) {
  for (let z = 0; z < harborHeight; z++) for (let x = 0; x < RING_PERIOD; x++) {
    if (!solid(x, z) || boulevard(z)) continue;
    const tile = tileAt('harbor', x, z);
    if (tile === 'grass') continue;
    const footprint = cityTerraceAt(x, z) || cityParcels.some(lot => x >= lot.x && x < lot.x + lot.width && z >= lot.z && z < lot.z + lot.depth);
    const radials = nearCrossing(x + .5, 1.1) || x >= 12 && x <= 14 && z < 11;
    const coast = z < 2 || z >= 22 || tile === 'shore';
    const terraceFront = cityTerraceAt(x, z + 1);
    const civic = z < 15 || tile !== 'lawn' || radials || terraceFront;
    const start = z === 0 ? innerEdge : z;
    if (!civic && !coast) continue;
    paving.sector(x, start, 1, z + 1 - start, .006, tint(grout, .96 + random(x, z, 50) * .075));
    if (footprint) continue;
    const outerStreet = z === 23 || z === 27;
    const hue = terraceFront || outerStreet ? cobble : coast || radials ? marble : pavement;
    const columns = Math.max(2, Math.round(ringRadius(z) * .29));
    for (let row = 0; row < 2; row++) {
      const top = start + (z + 1 - start) * row / 2;
      const bottom = start + (z + 1 - start) * (row + 1) / 2;
      for (let i = 0; i < columns; i++) {
        const shift = i === 0 || row === 0 ? 0 : .16 / columns;
        const next = i === columns - 1 || row === 0 ? 0 : .16 / columns;
        const at = x + i / columns - shift, width = 1 / columns + shift - next;
        paving.sector(at + .009, top + .016, width - .018, bottom - top - .031, .010, tint(hue, .91 + random(x, z, i + row * 11) * .17));
      }
    }
    if (outerStreet) {
      paving.sector(x, z + .19, 1, .028, .016, tint(bronze, .85));
      paving.sector(x, z + .81, 1, .028, .016, tint(grout, .85));
    }
    const waterSide = z === 0 ? start + .075 : z === harborHeight - 1 ? z + .79 : 0;
    if (waterSide && !footprint) {
      rails.block(x + .014, waterSide, .48, .178, -.024, .128, marble);
      rails.block(x + .515, waterSide, .469, .178, -.024, .128, tint(marble, .95));
    }
  }
}

function fountainMosaic(surface: RingSurface) {
  const anchorX = 24.06, anchorZ = 15.40;
  for (let piece = 0; piece < 48; piece++) {
    const first = piece * Math.PI / 24, second = (piece + 1) * Math.PI / 24;
    const point = (angle: number, distance: number, up: number) => position(anchorX + Math.cos(angle) * distance, up, anchorZ + Math.sin(angle) * distance);
    surface.quad(point(first, 1.11, .014), point(second, 1.11, .014), point(first, 1.31, .014), point(second, 1.31, .014),
      piece % 8 < 4 ? tint(street, 1.28) : marble);
    surface.quad(point(first, 1.30, .016), point(second, 1.30, .016), point(first, 1.33, .016), point(second, 1.33, .016), bronze);
  }
}

function parks(beds: RingSurface, edges: RingSurface, leaves: RingSurface) {
  const leaf = new Color('#89a675');
  for (let z = 0; z < harborHeight; z++) for (let x = 0; x < RING_PERIOD; x++) {
    if (tileAt('harbor', x, z) !== 'grass') continue;
    const hue = tint(grass, 1.03 + random(Math.floor(x / 2), z, 9) * .13);
    beds.sector(x, z, 1, 1, .006, hue);
    if (x % 3 !== 0 && tileAt('harbor', x, z - 1) !== 'grass') edges.block(x + .028, z + .055, .946, .151, 0, .081, marble);
    if (x % 3 !== 1 && tileAt('harbor', x, z + 1) !== 'grass') edges.block(x + .028, z + .793, .946, .151, 0, .081, tintedParkStone);
    const clusters = 5 + Math.floor(ringRadius(z) / 2);
    for (let i = 0; i < clusters; i++) {
      const at = x + .08 + (i + random(x, z, i + 62)) / clusters * .85;
      const across = z + .17 + random(x, z, i * 3 + 22) * .66;
      const [wx, h, wz] = position(at, .015, across);
      const low = tint(grass, .69 + random(x, z, i + 190) * .30);
      const top = tint(leaf, .82 + random(x, z, i + 79) * .27);
      const length = .20 + random(x, z, i * 7 + 55) * .23;
      beds.sector(at - .048, across - .12, .096, .24, .008, tint(hue, .87));
      for (let blade = 0; blade < 5; blade++) {
        const angle = random(x, z, i * 6 + blade + 101) * Math.PI * 2;
        const dx = Math.sin(angle), dz = Math.cos(angle);
        const surge = length * (.59 + random(x, z, blade * 3 + i + 96) * .70);
        leaves.triangle([wx - dz * .042, h, wz + dx * .042], [wx + dz * .042, h, wz - dx * .042],
          [wx + dx * surge * .60, surge, wz + dz * surge * .60], low, top);
      }
    }
  }
}

const tintedParkStone = new Color('#adad99');

function wind(clock: { value: number }) {
  const material = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 1 });
  material.onBeforeCompile = shader => {
    shader.uniforms.breezeTime = clock;
    shader.vertexShader = `uniform float breezeTime;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      float lift = max(position.y - .028, 0.0);
      transformed.x += lift * sin(position.x * .49 + position.z * 1.72 + breezeTime * 2.1) * .19;
      transformed.z += lift * cos(position.x * 1.92 - position.z * .53 + breezeTime * 1.61) * .17;
    `);
  };
  return material;
}

function coastlineFinish() {
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: .88, side: DoubleSide });
  material.onBeforeCompile = shader => {
    shader.vertexShader = `varying vec3 terrainPoint;\n${shader.vertexShader}`.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n terrainPoint = (modelMatrix * vec4(position, 1.0)).xyz;');
    shader.fragmentShader = `varying vec3 terrainPoint;\n${shader.fragmentShader}`.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec3 p = terrainPoint;
      float foot = max(length(dFdx(p)), length(dFdy(p)));
      float crisp = 1.0 - smoothstep(.030, .089, foot);
      vec3 seed = floor(p * vec3(24.0,18.0,24.0));
      float grain = fract(sin(dot(seed, vec3(19.59, 51.37, 71.93))) * 35479.43) - .5;
      float faintVeins = sin(p.x * .84 + p.z * 1.62 + sin(p.z * 3.1 - p.y * 2.9) * .42);
      float risingTide = smoothstep(-.60, -.12, p.y + .022 * sin(p.x + p.z * 2.9));
      diffuseColor.rgb *= (1.0 + crisp * grain * .085 + faintVeins * .016) * (.89 + .11 * risingTide);
    `);
  };
  return material;
}

function bathymetry(edges: Edge[]) {
  const size = 136;
  const data = new Uint8Array(size * size * 4);
  for (let row = 0; row < size; row++) for (let column = 0; column < size; column++) {
    const x = ((column + .5) / size * 2 - 1) * surveySpan;
    const z = ((row + .5) / size * 2 - 1) * surveySpan;
    let minimum = coastDepth * coastDepth;
    for (const edge of edges) {
      const px = x - edge.x, pz = z - edge.z;
      if (Math.abs(px) > coastDepth + .57 || Math.abs(pz) > coastDepth + .57) continue;
      const u = Math.max(0, Math.min(1, (px * edge.dx + pz * edge.dz) / edge.lengthSquared));
      const dx = px - edge.dx * u, dz = pz - edge.dz * u;
      minimum = Math.min(minimum, dx * dx + dz * dz);
    }
    const at = (row * size + column) * 4;
    data[at] = Math.round(Math.sqrt(minimum) / coastDepth * 255);
    data[at + 3] = 255;
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function ocean(edges: Edge[], clock: { value: number }, night: { value: number }) {
  const material = new ShaderMaterial({
    fog: true, transparent: true, depthWrite: false,
    uniforms: {
      ...UniformsUtils.clone(UniformsLib.fog), clock, night,
      coastDistance: { value: bathymetry(edges) },
      surveyDiameter: { value: surveySpan * 2 },
      basinRim: { value: ringRadius(innerEdge) },
      basinReach: { value: ringRadius(9.25) },
      deep: { value: new Color('#2b5769') }, lagoon: { value: new Color('#477d78') }, shallows: { value: new Color('#749a91') },
    },
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec3 waterPoint;
      void main() {
        waterPoint = (modelMatrix * vec4(position, 1.0)).xyz;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      varying vec3 waterPoint;
      uniform sampler2D coastDistance;
      uniform float surveyDiameter;
      uniform float basinRim;
      uniform float basinReach;
      uniform vec3 deep;
      uniform vec3 lagoon;
      uniform vec3 shallows;
      uniform float clock;
      uniform float night;
      void main() {
        vec2 p = waterPoint.xz;
        vec2 mapUv = .5 + p / surveyDiameter;
        vec2 outer = abs(mapUv - .5);
        float bank = max(outer.x, outer.y) > .5 ? 1.0 : texture2D(coastDistance, mapUv).r;
        float radius = length(p);
        float swell = dot(p, vec2(1.01, -1.93)) - clock * 1.14 + sin(dot(p, vec2(.5, .379))) * .83;
        float ripple = dot(p, vec2(.89, 5.71)) + clock * 1.91 + sin(dot(p, vec2(2.0, -.62))) * .78;
        float chop = dot(p, vec2(-2.21, 9.35)) - clock * 2.67 + sin(p.x * 3.9 + p.y * 1.10) * .52;
        vec2 slope = cos(swell) * vec2(.029, -.046) + cos(ripple) * vec2(.010, .084) + cos(chop) * vec2(-.013, .048);
        vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));
        vec3 viewer = normalize(cameraPosition - waterPoint);
        vec3 sky = normalize(vec3(-.37, .91, .23));
        float glint = pow(max(0.0, dot(normal, normalize(viewer + sky))), 42.0);
        float fresnel = pow(max(0.0, 1.0 - dot(viewer, normal)), 3.5);
        float pool = 1.0 - smoothstep(basinRim - .07, basinReach, radius);
        float current = sin(radius * 3.9 - clock * .55 + sin(p.x * .8 - p.y * .53) * .72);
        vec3 base = mix(deep, lagoon, pool * .81);
        vec3 color = mix(shallows, base, smoothstep(.048, .54, bank));
        color *= .88 + .12 * smoothstep(.044, .164, bank);
        color *= .94 + sin(swell) * .029 + cos(ripple) * .020 + dot(normal, sky) * .074 + current * pool * .020;
        float tide = .063 + sin(swell) * .010 + sin(chop) * .004;
        float foam = (1.0 - smoothstep(.004, .019, abs(bank - tide))) *
          (.33 + .51 * smoothstep(-.70, .87, sin(p.x * 3.7 + p.y * 4.1 + sin(chop))));
        float crest = 1.0 - smoothstep(.048, .169 + fwidth(ripple) * .26, 1.0 - cos(ripple));
        float patches = smoothstep(.40, .94, sin(dot(p, vec2(1.84, .71)) + sin(swell) * .84 - clock * .38));
        float cap = crest * patches * (.28 + .72 * smoothstep(.16, .70, bank));
        float lighter = glint * .068 + fresnel * .15 + foam * .158 + cap * .030;
        vec3 dusk = color * vec3(.27,.45,.60) + vec3(.013,.023,.037);
        color = mix(color, dusk, night);
        color = mix(color, mix(vec3(.45,.68,.65), vec3(.14,.29,.38), night), lighter);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const mesh = new Mesh(new PlaneGeometry(240, 240), material);
  mesh.name = 'Inner tidal basin and outer sea';
  mesh.position.y = seaLevel;
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -1;
  return mesh;
}

export function buildRingGround() {
  const group = new Group();
  group.name = 'Tideport annular ground and shoreline';
  const top = new RingSurface(), cliffs = new RingSurface(), paving = new RingSurface();
  const roads = new RingSurface(), paint = new RingSurface(), trim = new RingSurface();
  const boards = new RingSurface(), leaves = new RingSurface();
  const clock = { value: 0 }, night = { value: 0 };
  const stone = coastlineFinish();
  const edges = ground(top, cliffs);
  breakwater(top, cliffs, trim, edges);
  platform(boards, top, trim);
  archSpan(top, cliffs, -.022, 1.064, [.48]);
  archSpan(top, cliffs, 33.98, 4.04, [34.67, 35.97, 37.19]);
  avenues(roads, paint, trim);
  stonework(paving, trim);
  fountainMosaic(paint);
  parks(paving, trim, leaves);
  group.add(top.mesh(stone, 'Annulus walk surface'), cliffs.mesh(stone, 'Carved seawalls and bridge arches', true),
    paving.mesh(stone, 'Radial plazas and limestone promenades'), roads.mesh(stone, 'Circular slate boulevard'),
    paint.mesh(stone, 'Ring crossings and guiding lines'), trim.mesh(stone, 'Curb caps and quay details', true),
    boards.mesh(stone, 'Curved timber landing', true), leaves.mesh(wind(clock), 'Wind in the annular parks'), ocean(edges, clock, night));
  return {
    group,
    update(time: number, darkness: number) {
      clock.value = time / 1000;
      night.value = darkness;
    },
  };
}
