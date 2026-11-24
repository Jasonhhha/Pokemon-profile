import {
  BufferGeometry, CatmullRomCurve3, CircleGeometry, Color, DataTexture, DoubleSide, Float32BufferAttribute, Group,
  LinearFilter, Mesh, MeshStandardMaterial, PlaneGeometry, RGBAFormat, ShaderMaterial,
  UniformsLib, UniformsUtils, Vector3, type Material,
} from 'three';
import {
  cityAlleyBarriers, cityAlleys, cityCourtyardAt, cityCourtyards, cityForecourts, cityFountainSite, cityGateSites, cityParcels, cityStreet,
  cityTerraceAt, cityTerraceFrontages, cityTerraces, ringBreakwaterSpans, type CityTerrace,
  harborHeight, outerRingStart,
} from './field-city-layout';
import { harborHeads } from './field-harbor-mouth';
import { maps, tileAt, type Tile } from './field-layout';
import { RING_PERIOD, ringAngle, ringCoordinates, ringPosition, ringRadius, wrapRingX } from './field-ring-space';

type Point = [number, number, number];
type Edge = { x: number; z: number; dx: number; dz: number; lengthSquared: number };
type EdgeSide = { x: number; z: number; across: boolean; normal: -1 | 1 };
type PaletteShade = (x: number, z: number, base: Color, seed: number) => Color;
type SurfaceVertices = { position: number[]; color: number[] };

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
const dryJoints = new Color('#958878');
const dampJoints = new Color('#6d7470');
const paleSetts = ['#c7b599', '#c1af96', '#bdab92', '#b9a994', '#cbb99d'].map(hue => new Color(hue));
const oldSetts = ['#a8a098', '#9d9389', '#afa49a', '#998c84', '#b2a798'].map(hue => new Color(hue));
const graniteSetts = ['#7b8382', '#858883', '#7d827d', '#777e7e'].map(hue => new Color(hue));
const sandstoneFlags = ['#bea278', '#bda783', '#cbb592', '#ab9a80', '#d0b794', '#b0a38d'].map(hue => new Color(hue));
const warehouseSetts = ['#969187', '#8c867e', '#9a8f7e', '#857d72', '#a49a8b', '#998779'].map(hue => new Color(hue));
const shopFlags = ['#a48f80', '#b09d8d', '#b1a497', '#988b81', '#ac9b88'].map(hue => new Color(hue));
const iron = new Color('#485555');
const pale = new Color('#e7d8b9');
const bronze = new Color('#c4a06c');
const street = new Color('#617380');
const shore = new Color('#a79a80');
const grass = new Color('#648569');
const meadow = new Color('#929e74');
const timber = new Color('#bb966c');
const beam = new Color('#795947');
const marl = new Color('#b9a68d');
const harbourSalt = new Color('#7d8577');
const curbShadow = new Color('#746b5f');
const harbourRed = new Color('#8c5643');
const channelSetts = ['#8e8d83', '#93918c', '#9c9387', '#8c877b'].map(color => new Color(color));
const carriageStone = ['#7d8485', '#8c8a80', '#83898a', '#8c8b82', '#92958c'].map(color => new Color(color));
const signalRoad = [[30.45, 23.62], [31.48, 25.16], [32.56, 26.78], [33.44, 27.31], [34.42, 28.90], [34.49, 31.48]] as const;

function random(x: number, z: number, salt: number) {
  const n = Math.imul(x + 101, 374761393) ^ Math.imul(z + 23, 668265263) ^ Math.imul(salt + 7, 1597334677);
  return ((Math.imul(n ^ (n >>> 13), 1274126177) ^ (n >>> 18)) >>> 0) / 4294967296;
}

const tint = (base: Color, power: number) => base.clone().multiplyScalar(power);

function servicePath(points: readonly (readonly [number, number])[], halfWidth: number, palette: Color[], amount: number) {
  const segments: Edge[] = [];
  for (let i = 1; i < points.length; i++) {
    const [column, row] = points[i - 1], [to, toward] = points[i];
    const pieces = Math.ceil(Math.max(Math.abs(to - column) * 3, Math.abs(toward - row) * 2));
    let start = ringPosition(column, row);
    for (let step = 1; step <= pieces; step++) {
      const end = ringPosition(column + (to - column) * step / pieces, row + (toward - row) * step / pieces);
      const dx = end.x - start.x, dz = end.z - start.z;
      segments.push({ x: start.x, z: start.z, dx, dz, lengthSquared: dx * dx + dz * dz });
      start = end;
    }
  }
  return { segments, halfWidth, palette, amount };
}

const serviceStreets = [
  servicePath([[4.9, 24.46], [7.4, 24.54], [9.77, 24.55], [10.47, 25.85], [10.49, 28.60]], .64, channelSetts, .72),
  servicePath([[13.47, 25.51], [15.34, 25.49], [15.47, 26.50], [15.37, 27.38], [13.54, 27.49], [13.50, 29.45]], .53, sandstoneFlags, .82),
  servicePath([[18.86, 24.44], [21.76, 24.57], [22.37, 26.47], [22.51, 29.49]], .48, oldSetts, .62),
  servicePath([[24.64, 23.58], [25.26, 25.24], [25.48, 26.73], [25.82, 27.50], [27.41, 27.50], [27.50, 29.40]], .64, shopFlags, .77),
  servicePath(signalRoad, .81, carriageStone, .80),
];

function pavingOnServiceStreet(x: number, z: number, base: Color, seed: number) {
  const world = ringPosition(x, z);
  let closest = 0;
  let tone = base;
  for (const route of serviceStreets) {
    const reach = route.halfWidth + .22;
    let distance = reach * reach;
    for (const edge of route.segments) {
      const px = world.x - edge.x, pz = world.z - edge.z;
      if (Math.abs(px) > reach + Math.abs(edge.dx) || Math.abs(pz) > reach + Math.abs(edge.dz)) continue;
      const hit = Math.min(1, Math.max(0, (px * edge.dx + pz * edge.dz) / edge.lengthSquared));
      distance = Math.min(distance, (px - edge.dx * hit) ** 2 + (pz - edge.dz * hit) ** 2);
    }
    const gain = 1 - Math.sqrt(distance) / reach;
    if (gain <= closest) continue;
    closest = gain;
    const index = Math.floor(random(Math.floor(x * 13), Math.floor(z * 7), seed + 94) * route.palette.length);
    const surface = Math.min(1, gain * 2.6) * route.amount;
    tone = base.clone().lerp(route.palette[index], surface);
  }
  return tone;
}

function position(x: number, y: number, z: number): Point {
  const world = ringPosition(x, z);
  return [world.x, y, world.z];
}

class RingSurface {
  private readonly sections: SurfaceVertices[];

  constructor(partitioned = false) {
    this.sections = Array.from({ length: partitioned ? 16 : 1 }, () => ({ position: [], color: [] }));
  }

  private section(a: Point, b: Point, c: Point) {
    if (this.sections.length === 1) return this.sections[0];
    const x = a[0] + b[0] + c[0], z = a[2] + b[2] + c[2];
    const quadrant = Number(x > 0) + Number(z > 0) * 2;
    const octant = quadrant * 2 + Number(Math.abs(x) > Math.abs(z));
    const outside = x * x + z * z > pavingRadiusSquared;
    return this.sections[octant * 2 + Number(outside)];
  }

  triangle(a: Point, b: Point, c: Point, tone: Color, tip = tone, edge = tone) {
    const { position, color } = this.section(a, b, c);
    position.push(...a, ...b, ...c);
    color.push(tone.r, tone.g, tone.b, edge.r, edge.g, edge.b, tip.r, tip.g, tip.b);
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

  sett(x: number, z: number, width: number, depth: number, y: number, color: Color, trim = .15) {
    if (width <= 0 || depth <= 0) return;
    const dx = width * trim, dz = depth * trim;
    const lip = [position(x + dx, y, z), position(x, y, z + dz), position(x, y, z + depth - dz),
      position(x + dx, y, z + depth), position(x + width - dx, y, z + depth), position(x + width, y, z + depth - dz),
      position(x + width, y, z + dz), position(x + width - dx, y, z)];
    const edge = tint(color, .84);
    for (let i = 1; i < lip.length - 1; i++) this.triangle(lip[0], lip[i], lip[i + 1], color, color, i === 1 || i === 5 ? edge : color);
    this.quad(lip[3], [lip[3][0], y - .009, lip[3][2]], lip[4], [lip[4][0], y - .009, lip[4][2]], edge);
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
    const patches = this.sections.filter(({ position }) => position.length > 0).map(({ position, color }) => {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
      geometry.setAttribute('color', new Float32BufferAttribute(color, 3));
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      const mesh = new Mesh(geometry, material);
      mesh.name = name;
      mesh.receiveShadow = true;
      mesh.castShadow = castsShadow;
      return mesh;
    });
    if (patches.length === 1) return patches[0];
    const group = new Group();
    group.name = name;
    group.add(...patches);
    return group;
  }
}

const pavingRadiusSquared = (ringRadius(23) * 3) ** 2;

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
  const span = side.across ? ringRadius(side.z) * Math.PI * 2 / RING_PERIOD : .48;
  const calmWater = side.z <= 4 || side.z >= 27;
  if (!calmWater && z % 5 === 0) return;

  for (const [course, upper, lower, inset, toe] of [
    [0, -.118, -.267, .069, .119], [1, -.279, -.454, .125, .186], [2, -.467, -.635, .193, .249],
  ]) {
    const count = Math.max(1, Math.round(span * duration / (.42 + course * .12)));
    const offset = course % 2 === 0 ? 0 : .42 / count;
    for (let joint = 0; joint <= count; joint++) {
      const fracture = .12 * (random(x * 13 + joint, z, 682 + course) - .5) / count;
      const from = Math.max(0, joint / count - offset + fracture + .009 / span) * duration;
      const to = Math.min(1, (joint + 1) / count - offset + fracture - .008 / span) * duration;
      if (to - from < .013) continue;
      const gain = .90 + random(x, z, 697 + joint * 3 + course) * .21;
      const color = tint(course < 2 ? marl : harbourSalt, gain - course * .104);
      const faceInset = side.across && side.z < 1 ? inset * .27 : inset;
      const faceToe = side.across && side.z < 1 ? toe * .27 : toe;
      surface.quad(coastPoint(side, from, upper, faceInset), coastPoint(side, from, lower, faceToe),
        coastPoint(side, to, upper, faceInset), coastPoint(side, to, lower, faceToe), color);
      if (course === 0 && joint % 2 === 0) {
        surface.quad(coastPoint(side, from, upper, faceInset), coastPoint(side, from, upper + .010, faceInset - .011),
          coastPoint(side, to, upper, faceInset), coastPoint(side, to, upper + .010, faceInset - .011), tint(color, 1.08));
      }
    }
  }
  if (side.across && (side.z >= harborHeight - .02 || side.z <= .5) && (x * 11 + Math.round(side.z)) % 7 === 0) {
    quayOutlet(surface, side, span, tight);
  }
}

function quayOutlet(surface: RingSurface, side: EdgeSide, metres: number, tight: boolean) {
  const mid = .55;
  const spring = -.339;
  const width = Math.min(.30, .145 / metres);
  const rise = .103;
  const project = (u: number, height: number, relief = 0) => {
    const slope = .057 + Math.max(0, -.12 - height) * .412;
    return coastPoint(side, u, height, (tight ? slope * .23 : slope) + .014 + relief);
  };
  const bottom = -.456;
  const outer = width + .048 / metres;
  surface.quad(project(mid - outer, spring + .003), project(mid - outer, bottom - .025),
    project(mid + outer, spring + .003), project(mid + outer, bottom - .025), tint(marl, .98));
  surface.quad(project(mid - width, spring, .004), project(mid - width, bottom, .003),
    project(mid + width, spring, .004), project(mid + width, bottom, .003), shadeIron);
  const core = project(mid, spring, .005);
  for (let step = 0; step < 8; step++) {
    const from = step * Math.PI / 8;
    const end = (step + 1) * Math.PI / 8;
    const arch = (angle: number, rim: number, lift: number) => project(mid + Math.cos(angle) * rim, spring + Math.sin(angle) * lift, .007);
    surface.triangle(core, arch(from, width, rise), arch(end, width, rise), shadeIron);
    surface.quad(arch(from + .015, outer, rise + .044), arch(from + .015, width, rise),
      arch(end - .015, outer, rise + .044), arch(end - .015, width, rise), tint(marl, .92 + step % 3 * .081));
  }
  for (let bar = -2; bar <= 2; bar++) {
    const x = mid + bar * width * .321;
    const half = .007 / metres;
    const peak = spring + Math.sqrt(1 - ((x - mid) / width) ** 2) * rise * .94;
    surface.quad(project(x - half, peak, .011), project(x - half, bottom + .008, .011),
      project(x + half, peak, .011), project(x + half, bottom + .008, .011), tint(iron, .91));
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

function harborLanterns(walls: RingSurface, lenses: RingSurface) {
  for (const head of harborHeads) for (const casting of head.castings) {
    const { foot, crown, top, base } = casting;
    const surface = casting.lit ? lenses : walls;
    const color = new Color(casting.color);
    const a: Point[] = foot.map(p => [p.x, base, p.z]);
    const b: Point[] = crown.map(p => [p.x, top, p.z]);
    for (let i = 0; i < a.length; i++) {
      const next = (i + 1) % a.length;
      surface.quad(a[i], a[next], b[i], b[next], color);
      if (i > 0 && i < b.length - 1) surface.triangle(b[0], b[i], b[next], color);
    }
  }
}

function breakwater(top: RingSurface, walls: RingSurface, trim: RingSurface, shoreEdges: Edge[]) {
  // Low outer seawalls continue the circle across the open harbor. The ferry sails clear of their tips.
  const edge = harborHeight + .31;
  for (const [from, to] of ringBreakwaterSpans) {
    const pieces = Math.ceil((to - from) * 3);
    for (let index = 0; index < pieces; index++) {
      const x = from + (to - from) * index / pieces;
      const length = (to - from) / pieces;
      const color = tint(shore, .82 + random(index, Math.round(from), 46) * .17);
      walls.block(x, edge - .88, length, 1.58, -.84, .85, tint(color, .88));
      walls.block(x, edge - 1.10, length, 1.83, -.57, .21, tint(harbourSalt, .85));
      top.sector(x, edge - .84, length, .91, .018, tint(shore, .99));
      trim.block(x + .015, edge + .46, length - .030, .33, .065, .17, tint(marble, .87));
      if (index % 3 === 1) {
        walls.block(x + length * .38, edge + .61, .105, .30, -.49, .74, tint(shore, .93));
        trim.block(x + length * .38 - .012, edge + .56, .129, .41, .244, .075, marble);
      }
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
    const tangent = ringRadius(edge) * Math.PI * 2 / RING_PERIOD;
    const mark = from + .118;
    const base = .215 / tangent;
    trim.block(mark - base * .67, edge + .178, base * 1.34, .294, .284, .087, graniteSetts[2]);
    trim.block(mark - base * .51, edge + .214, base * 1.02, .37, .364, .217, tint(harbourRed, .98));
    trim.block(mark - base * .53, edge + .209, base * 1.06, .382, .526, .062, tint(pale, .9));
    trim.block(mark - base * .60, edge + .189, base * 1.20, .422, .581, .044, tint(iron, .85));
    trim.block(mark - base * .40, edge + .241, base * .80, .316, .624, .107, tint(bronze, 1.07));
    trim.block(mark - base * .53, edge + .215, base * 1.06, .37, .730, .038, shadeIron);
    for (const [index, at] of [to - .27, from + .43].entries()) {
      const footing = .114 / tangent;
      trim.block(at - footing * .5, edge + .183, footing, .24, .023, .112, shadeIron);
      trim.block(at - footing * .62, edge + .152, footing * 1.24, .30, .128, .036, tint(iron, 1.09));
      walls.block(at - footing * .78, edge + .018, footing * 1.56, .069, -.345, .361,
        tint(beam, index ? .86 : 1.02));
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
        if (end - start < .19) continue;
        for (const bolt of [start + .091, end - .082]) {
          const length = .026 / (ringRadius(bolt) * Math.PI * 2 / RING_PERIOD);
          for (const across of [.032, .154]) {
            wood.sett(at + across - length * .5, bolt - .028, length, .056, .005, tint(beam, .78), .29);
          }
        }
      }
    }
    for (const z of x < 6 ? [11.17, 14.28] : [11.17]) {
      metal.block(x + .30, z, .115, .153, -.93, 1.27, beam);
      metal.block(x + .289, z - .025, .136, .18, .327, .062, tint(timber, .86));
      metal.block(x + .32, z + .025, .071, .108, -.055, .075, tint(bronze, .83));
      metal.block(x + .41, z + .071, .88, .038, .244, .032, tint(timber, .73));
    }
    const aft = outer - .033;
    const dampBeam = tint(beam, .77 + random(x, 14, 66) * .16);
    seams.block(x + .06, aft, .88, .138, -.252, .154, dampBeam);
    if (x < 6) {
      seams.block(x + .47, aft + .046, .117, .171, -.824, .745, dampBeam);
      metal.block(x + .46, aft + .10, .137, .126, -.258, .052, tint(iron, .84));
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

function course(
  surface: RingSurface, x: number, row: number, from: number, to: number, palette: Color[],
  columns: number, rows: number, level: number, dressed: boolean, age = 0, shade?: PaletteShade,
) {
  const depth = (to - from) / rows;
  const wear = 1 - age * .090;
  for (let line = 0; line < rows; line++) {
    const shift = (.47 * (line % 2) + age * (.21 + random(x, row, line * 3 + 27) * .28)) / columns;
    const joint = (index: number) => x + (index + age * (random(x * 23 + index, row, line * 41 + 721) - .5) * .52) / columns - shift;
    for (let column = 0; column <= columns; column++) {
      const left = Math.max(x, joint(column)), right = Math.min(x + 1, joint(column + 1));
      const step = Math.min(.0044 + age * .002, (right - left) * .13);
      const inset = .012 + random(x, row, column + line * 41 + 127) * (.008 + age * .007);
      const index = Math.floor(random(x, row, column + line * 41 + 58) * palette.length);
      const chipped = random(x, row, column + line * 41 + 10);
      const stone = shade ? shade((left + right) * .5, from + (line + .5) * depth, palette[index], column + line * 41) : palette[index];
      const color = tint(stone, wear * (.94 + chipped * (.133 + age * .052)));
      const height = level + random(x, row, column + line * 41 + 353) * .0035;
      if (dressed) surface.sett(left + step, from + line * depth + inset, right - left - 2 * step, depth - 2 * inset, height, color, .071 + age * chipped * .11);
      else surface.sector(left + step, from + line * depth + inset, right - left - 2 * step, depth - 2 * inset, height, color, 2);
    }
  }
}

function drain(surface: RingSurface, x: number, z: number, y = .020) {
  const across = .22 / (ringRadius(z) * Math.PI * 2 / RING_PERIOD);
  surface.sett(x - across / 2, z, across, .303, y, tint(iron, .83));
  surface.sector(x - across * .35, z + .027, across * .70, .249, y + .002, shadeIron);
  for (let bar = 0; bar < 5; bar++) {
    surface.sector(x - across * .38, z + .038 + bar * .046, across * .76, .016, y + .004, iron);
  }
}

const shadeIron = new Color('#292f31');
const archiveForecourt = { from: 8.88, to: 13.22, front: 10.07, center: 10.5 } as const;

function watercourse(surface: RingSurface, x: number, z: number, length: number, radial: boolean, seed = 0) {
  // Blue pennant margins around a narrow, partially silted gully.
  const tangent = ringRadius(z) * Math.PI * 2 / RING_PERIOD;
  const backer = radial ? .074 / tangent : .075 / .48;
  const slot = backer * .27;
  const slabbing = backer * .30;
  const point = (u: number, v: number, span: number, width: number, height: number, tone: Color) => {
    if (radial) surface.sector(x + v, z + u, width, span, height, tone, 2);
    else surface.sector(x + u, z + v, span, width, height, tone, 4);
  };
  point(0, -backer / 2, length, backer, .019, tint(curbShadow, .98));
  const count = Math.max(2, Math.round(length * (radial ? 2 : tangent / .28)));
  for (let step = 0; step < count; step++) {
    const slab = length / count;
    const stain = random(seed, step, 21);
    const tone = tint(cobble, .95 + stain * .24);
    point(step * slab + .003, -backer * .46, slab - .006, slabbing, .021, tone);
    point(step * slab + .003, backer * .16, slab - .006, slabbing, .021, tint(tone, 1.08));
    if (stain > .22) point(step * slab + .006, -slot / 2, slab - .012, slot, .021, tint(iron, .98 + stain * .24));
  }
}

function hatch(surface: RingSurface, x: number, z: number, large: boolean, height = .021) {
  const tangent = ringRadius(z) * Math.PI * 2 / RING_PERIOD;
  const width = (large ? .31 : .215) / tangent;
  const depth = large ? .45 : .29;
  surface.sett(x - width * .58, z - depth * .58, width * 1.16, depth * 1.16, height, tint(cobble, .76), .13);
  surface.sett(x - width * .48, z - depth * .48, width * .96, depth * .96, height + .003, tint(iron, .70), .12);
  for (let index = 0; index < (large ? 7 : 4); index++) {
    surface.sector(x - width * .34, z - depth * .334 + depth * .101 * index, width * .68, depth * .029,
      height + .004, tint(iron, .90 + index % 3 * .09));
  }
  surface.sector(x - width * .04, z - depth * .38, width * .08, depth * .76, height + .005, tint(iron, .98));
}

function avenues(roads: RingSurface, marking: RingSurface, trim: RingSurface) {
  const middle = (roadIn + roadOut) / 2;
  for (let x = 0; x < RING_PERIOD; x++) {
    if (x >= 1 && x < 7) continue;
    roads.sector(x, roadIn, 1, roadOut - roadIn, .010, dampJoints);
    course(roads, x, 12, roadIn + .12, roadOut - .12, graniteSetts, 5, 8, .014, false);
    roads.sector(x, roadIn + .034, 1, .10, .016, tint(street, .92));
    roads.sector(x, roadOut - .139, 1, .094, .016, tint(street, .89));
    if (x % 4 === 1 && !nearCrossing(x + .30, .56)) {
      drain(marking, x + .26, roadOut - .44);
      drain(marking, x + .71, roadIn + .17);
    }
    for (let piece = 0; piece < 2; piece++) {
      const at = x + piece * .5;
      if (nearCrossing(at + .19, .50)) continue;
      const color = tint(marble, .89 + random(x, piece, 86) * .18);
      if (at + .5 <= archiveForecourt.from || at >= archiveForecourt.to) {
        trim.block(at + .014, roadIn - .065, .475, .143, 0, .061, color);
      }
      trim.block(at + .014, roadOut - .066, .475, .143, 0, .061, color);
      marking.sector(at + .117, middle - .020, .170, .038, .021, tint(bronze, .74));
    }
    if (bridgeSpan(x, 12)) {
      for (const z of [roadIn + .12, bridgeShoulder - .22]) {
        if (!nearCrossing(x + .5, .44)) trim.block(x + .064, z, .87, .19, .063, .144, tint(marble, .89));
      }
    }
  }
  for (const x of cityStreet.crossings) {
    for (let row = 0; row < 8; row++) for (let brick = 0; brick < 4; brick++) {
      const at = x - .40 + brick * .20 + (row % 2) * .035;
      const light = row === 0 || row === 7 || brick === 0 || brick === 3;
      marking.sett(at, roadIn + .225 + row * .321, .182, .275, .023,
        light ? tint(pale, .89 + random(row, brick, 5) * .10) : tint(marble, .88 + random(row, brick, 81) * .15));
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
  const thresholds = cityTerraces.flatMap(lot => cityTerraceFrontages(lot).map(position => ({ ...position, lot })));
  const alongWall = (x: number, z: number) => cityTerraceAt(x, z) || cityAlleyBarriers.some(lot =>
    x >= lot.x && x < lot.x + lot.width && z >= lot.z && z < lot.z + lot.depth);
  for (let z = 0; z < harborHeight; z++) for (let x = 0; x < RING_PERIOD; x++) {
    if (!solid(x, z) || boulevard(z)) continue;
    const tile = tileAt('harbor', x, z);
    if (tile === 'grass') continue;
    const footprint = cityTerraceAt(x, z) || cityParcels.some(lot => x >= lot.x && x < lot.x + lot.width && z >= lot.z && z < lot.z + lot.depth);
    const outer = z >= outerRingStart - 2;
    const radials = !outer && (nearCrossing(x + .5, 1.1) || x >= 12 && x <= 14 && z < 11);
    const coast = z < 2 || z >= harborHeight - 2 || tile === 'shore';
    const frontage = thresholds.find(tile => tile.x === x && tile.z === z)?.lot;
    const court = cityCourtyardAt(x, z);
    const lanes = cityAlleys.filter(lot => x >= lot.x && x < lot.x + lot.width && z >= lot.z && z < lot.z + lot.depth);
    const crossLane = lanes.some(lane => lane.width > lane.depth);
    const radialLane = lanes.some(lane => lane.depth > lane.width);
    const serviceStreet = z >= 23 && z <= 31;
    const formal = !outer && z === 10 && x >= 8 && x <= 12;
    const square = Boolean(court && court.kind !== 'wharf') || (z >= 14 && z <= 16 && x >= 22 && x <= 25) || (z === 10 && x >= 28 && x <= 32);
    const shopCourt = cityForecourts.some(court => x >= court.x && x < court.x + court.width && z >= court.z && z < court.z + court.depth);
    const commercial = !square && (frontage?.style === 'shops' || z === 10 && x >= 21 && x <= 26 || outer && x >= 22 && x < 30 || shopCourt);
    const warehouse = !square && !commercial && (court?.kind === 'wharf' || outer && (x < 11 || x > 30));
    const garden = !square && !commercial && !warehouse && outer && x >= 11 && x < 22;
    const oldTown = !square && !commercial && !garden && !warehouse && Boolean(lanes.length || frontage || outer && tile === 'path');
    const civic = z < 15 || tile !== 'lawn' || radials || frontage || court || square;
    const start = z === 0 ? innerEdge : z;
    if (!civic && !coast) continue;
    const jointColor = formal || square || garden ? dryJoints : oldTown || warehouse || commercial ? dampJoints : grout;
    const warmStone = formal || square || garden;
    const shadedMargin = footprint || (warehouse || commercial) && !lanes.length;
    paving.sector(x, start, 1, z + 1 - start, .005, tint(jointColor, (shadedMargin ? .87 : .94) + random(x, z, 50) * .085));
    if (footprint) continue;
    const palette = formal ? sandstoneFlags : square ? paleSetts : commercial ? shopFlags : warehouse ? warehouseSetts
      : garden ? sandstoneFlags : oldTown ? oldSetts : coast || radials ? [marble, pavement] : [pavement];
    const dressed = warmStone || commercial || warehouse || oldTown || serviceStreet;
    const span = ringRadius(z) * Math.PI * 2 / RING_PERIOD;
    const columns = Math.max(2, Math.round(span / (formal ? .51 : square || garden ? .53 : warehouse ? .314 : commercial ? .43 : .52)));
    const age = warehouse ? .93 : oldTown ? .84 : commercial ? .57 : garden ? .38 : serviceStreet ? .42 : .14;
    const rows = warehouse || lanes.length && commercial ? 3 : 2;
    const rightWall = alongWall(x + 1, z), leftWall = alongWall(x - 1, z);
    const backWall = alongWall(x, z + 1), foreWall = alongWall(x, z - 1);
    const hasMargin = rightWall || leftWall || backWall || foreWall;
    const shade: PaletteShade | undefined = serviceStreet || hasMargin ? (column, row, base, seed) => {
      const tone = serviceStreet ? pavingOnServiceStreet(column, row, base, seed) : base;
      const distance = Math.min(leftWall ? (column - x) * span : 1, rightWall ? (x + 1 - column) * span : 1,
        foreWall ? (row - z) * .48 : 1, backWall ? (z + 1 - row) * .48 : 1);
      const drift = Math.max(0, 1 - distance / .241);
      return drift > 0 ? tint(tone, 1 - drift * drift * (.138 + random(x, z, seed + 561) * .063)) : tone;
    } : undefined;
    course(paving, x, z, start, z + 1, palette, columns, rows, .012, dressed, age, shade);
    if (square && (z === 10 || z === 14 || z === 16 || court && (z === court.z || z === court.z + court.depth - 1))) {
      paving.sector(x, z + .052, 1, .090, .019, tint(marble, .94));
      paving.sector(x, z + .880, 1, .084, .019, tint(marble, .91));
      paving.sector(x, z + .156, 1, .023, .021, tint(cobble, .83));
    }
    if (radialLane && (rightWall || leftWall)) {
      const drainX = x + (rightWall && !leftWall ? .875 : .135);
      watercourse(paving, drainX, z, 1, true, z);
      if (z % 3 === 1) hatch(paving, drainX, z + .68, false);
    }
    if (crossLane && !radialLane && !square && (backWall || foreWall)) {
      const seeksFront = !backWall || Boolean(frontage && frontage.facing === 'outer');
      const drainZ = z + (seeksFront ? .195 : .787);
      watercourse(paving, x, drainZ, 1, false, x);
      if (x % 5 === 1) hatch(paving, x + .73, drainZ, warehouse);
    }
    if (!lanes.length && commercial && z % 4 === 2 && x % 3 === 1) {
      hatch(paving, x + .39, z + .77, true);
    }
    if ((frontage && !frontage.sideFront) || z === 23 || z === 27) {
      const kerb = frontage?.facing === 'outer' ? z + .20 : z + .810;
      paving.sector(x, kerb, 1, .034, .019, tint(commercial ? bronze : grout, .86));
    }
    const waterSide = z === 0 ? start + .075 : z === harborHeight - 1 ? z + .79 : 0;
    if (waterSide && !footprint) {
      rails.block(x + .014, waterSide, .48, .178, -.024, .128, marble);
      rails.block(x + .515, waterSide, .469, .178, -.024, .128, tint(marble, .95));
    }
  }
}

function terraceApron(paving: RingSurface, lot: CityTerrace, primary: boolean) {
  const radial = Boolean(lot.sideFront);
  const front = radial ? lot.sideFront === 'east' ? 1 : -1 : lot.facing === 'inner' ? -1 : 1;
  const direction = primary ? front : -front;
  const wall = radial ? lot.x + (direction > 0 ? lot.width : 0) : lot.z + (direction > 0 ? lot.depth : 0);
  const from = radial ? lot.z : lot.x;
  const span = radial ? lot.depth : lot.width;
  const tangent = ringRadius(lot.z + lot.depth * .5) * Math.PI * 2 / RING_PERIOD;
  const metre = radial ? .48 : tangent;
  const across = radial ? tangent : .48;
  const material = lot.style === 'garden' ? primary ? sandstoneFlags : oldSetts : lot.style === 'shops' ? shopFlags : warehouseSetts;
  const doorstep = lot.style === 'garden' ? marble : tint(material[1], 1.09);

  for (let spanCell = 0; spanCell < span; spanCell++) {
    const start = from + spanCell;
    const neighbor = wall + (direction < 0 ? -1 : 0);
    const column = radial ? neighbor : start, row = radial ? start : neighbor;
    const beside = solid(column, row) && tileAt('harbor', column, row) !== 'grass' && !cityTerraceAt(column, row);
    const apron = (at: number, distance: number, length: number, depth: number, y: number, tone: Color, dressed = false) => {
      const join = wall + direction * (direction < 0 ? distance + depth : distance);
      if (radial) {
        if (dressed) paving.sett(join, at, depth, length, y, tone, .071);
        else paving.sector(join, at, depth, length, y, tone);
      } else {
        if (dressed) paving.sett(at, join, length, depth, y, tone, .071);
        else paving.sector(at, join, length, depth, y, tone);
      }
    };
    const backing = (primary ? -.216 : -.153) / across;
    const seam = beside ? (primary ? .15 : .10) / across : -.028 / across;
    const edge = beside ? (primary ? .25 : .19) / across : 0;
    apron(start, backing, 1, edge - backing, .023, tint(curbShadow, primary ? .92 : .85));
    const count = Math.max(1, Math.round(metre / (lot.style === 'wharf' ? .326 : .465)));
    for (let piece = 0; piece < count; piece++) {
      const length = 1 / count;
      const at = start + piece * length;
      const index = Math.floor(random(lot.x + spanCell, lot.z, piece + (primary ? 361 : 421)) * material.length);
      const stone = tint(material[index], .94 + random(lot.x, spanCell, piece + 140) * .22);
      apron(at + length * .016, backing + .006, length * .968, seam - backing - .013, .025, stone, true);
      if (beside) apron(at + length * .015, seam, length * .970, edge - seam, .025, tint(doorstep, .84 + piece % 3 * .063), true);
    }

    if (beside && spanCell % 3 === 1 && lot.style !== 'garden') {
      const drain = wall + direction * (primary ? .16 : .105) / across;
      if (radial) hatch(paving, drain, start + .57, false);
      else hatch(paving, start + .73, drain, false);
    }
  }
}

function terraceReturns(paving: RingSurface, lot: CityTerrace) {
  const radial = !lot.sideFront;
  const span = radial ? lot.depth : lot.width;
  const palette = lot.style === 'garden' ? sandstoneFlags : warehouseSetts;
  for (let piece = 0; piece < span; piece++) {
    const step = (radial ? lot.z : lot.x) + piece;
    for (const outward of [-1, 1]) {
      const wall = radial ? lot.x + (outward > 0 ? lot.width : 0) : lot.z + (outward > 0 ? lot.depth : 0);
      const neighbor = wall - (outward < 0 ? 1 : 0);
      const x = radial ? neighbor : step, z = radial ? step : neighbor;
      if (!maps.harbor.walkable[z]?.[x] || tileAt('harbor', x, z) === 'grass') continue;
      const tangent = ringRadius(z) * Math.PI * 2 / RING_PERIOD;
      const metre = radial ? .48 : tangent;
      const inset = radial ? .158 / tangent : .35;
      const verge = radial ? .128 / tangent : .275;
      const extent = inset + verge;
      const start = wall - (outward > 0 ? inset : verge);
      if (radial) paving.sector(start, step, extent, 1, .021, tint(curbShadow, .87));
      else paving.sector(step, start, 1, extent, .021, tint(curbShadow, .91));
      const count = Math.max(1, Math.floor(metre / .245));
      for (let flag = 0; flag < count; flag++) {
        const at = step + (flag + .029) / count;
        const length = .943 / count;
        const tone = tint(palette[(flag + lot.x + piece) % palette.length], .89 + random(lot.x, step, flag + 22) * .17);
        if (radial) paving.sett(start + extent * .05, at, extent * .90, length, .023, tone, .09);
        else paving.sett(at, start + extent * .05, length, extent * .90, .023, tone, .08);
      }
    }
  }
}

function streetFronts(paving: RingSurface) {
  for (const lot of cityTerraces) {
    terraceApron(paving, lot, true);
    terraceApron(paving, lot, false);
    terraceReturns(paving, lot);
  }

  for (const parcel of cityParcels) {
    const z = parcel.z + parcel.depth;
    const formal = parcel.kind === 'archive' || parcel.kind === 'station';
    const stone = formal ? sandstoneFlags : parcel.kind === 'market' ? shopFlags : paleSetts;
    for (let tile = 0; tile < parcel.width; tile++) {
      const x = parcel.x + tile;
      const beside = solid(x, z) && !boulevard(z);
      const end = beside ? z + (formal ? .780 : .541) : z - .018;
      paving.sector(x, z - .209, 1, end - z + .209, .024, tint(curbShadow, formal ? 1.11 : .91));
      const width = Math.max(2, Math.round(ringRadius(z) * .29));
      for (let flag = 0; flag < width; flag++) {
        const at = x + flag / width;
        const tone = stone[Math.floor(random(x, z, flag + 21) * stone.length)];
        if (beside) {
          const land = .165 + random(x, z, flag + 522) * .040;
          paving.sett(at + .006, z + land, 1 / width - .012, end - z - land - .017, .027, tint(tone, .99), .046);
          paving.sett(at + .007, z - .198, 1 / width - .013, .345, .029, tint(tone, 1.045), .077);
        } else paving.sett(at + .006, z - .198, 1 / width - .012, .178, .027, tint(tone, .93), .074);
      }
      if (beside) {
        const at = x + .28 + .11 * (tile % 2);
        const outer = formal ? z + .737 : z + .493;
        paving.sector(x, outer, 1, .032, .031, tint(marl, 1.07));
        if (tile === 0 || tile === parcel.width - 1) hatch(paving, at, outer - .10, formal);
      }
    }
  }
}

function forecourtDetails(surface: RingSurface) {
  for (const { id, x, z, width, depth } of cityForecourts) {
    const sailmakers = id === 'sailmakers-forecourt';
    const tangent = ringRadius(z + depth * .5) * Math.PI * 2 / RING_PERIOD;
    const flagCount = Math.ceil(width * tangent / (sailmakers ? .42 : .31));
    const size = width / flagCount;
    const firstRow = z + (sailmakers ? .197 : .404);
    const courseDepth = sailmakers ? .216 : .295;
    const plane = .023;
    const border = sailmakers ? sandstoneFlags[1] : tint(graniteSetts[1], .98);
    surface.sector(x + .015, firstRow, width - .030, courseDepth, plane, tint(curbShadow, 1.05));
    for (let flag = 0; flag < flagCount; flag++) {
      const at = x + size * flag;
      const face = tint(border, .86 + random(x + flag, z, 78) * .29);
      surface.sett(at + size * .042, firstRow + .016, size * .916, courseDepth - .032, plane + .002, face, .078);
      if (!sailmakers && flag % 4 === 1) {
        const left = at + size * .31, right = left + size * .36;
        surface.sett(left, firstRow + .064, right - left, .152, plane + .003, tint(bronze, .94), .26);
      }
    }
    if (!sailmakers) continue;
    const anchorX = x + width - .190, anchorZ = z + depth - .576;
    const point = (side: number, radial: number) => position(anchorX + side / tangent, plane + .004, anchorZ + radial / .48);
    // The repaired threshold follows the radial shopfront rather than the ring lane.
    for (let paver = 0; paver < 4; paver++) {
      const at = -.265 + paver * .115;
      const tone = tint(pale, .80 + paver % 3 * .07);
      surface.quad(point(at, -.229), point(at + .092, -.229), point(at + .041, .229), point(at + .130, .229), tone);
    }
  }
}

function signalCobbles(surface: RingSurface) {
  const course = new CatmullRomCurve3(signalRoad.map(([x, z]) => {
    const anchor = ringPosition(x, z);
    return new Vector3(anchor.x, 0, anchor.z);
  }));
  const count = Math.round(course.getLength() / .213);
  const steps = Array.from({ length: count + 1 }, (_, index) => {
    const u = index / count;
    const at = course.getPointAt(u), ahead = course.getTangentAt(u);
    const threshold = Math.min(1, index / 5, (count - index) / 7);
    const reach = threshold * (.618 + .037 * Math.sin(u * Math.PI * 2));
    return { at, quarter: new Vector3(-ahead.z, 0, ahead.x), reach };
  });
  const point = (step: number, across: number, y: number): Point => {
    const { at, quarter, reach } = steps[step];
    return [at.x + quarter.x * across * reach, y, at.z + quarter.z * across * reach];
  };
  const open = ([x, , z]: Point) => {
    const cell = ringCoordinates(x, z);
    return Boolean(maps.harbor.walkable[Math.floor(cell.z)]?.[Math.floor(cell.x)]);
  };
  const joints = new Color('#6d756f');
  for (let line = 0; line < count; line++) {
    const edges = [point(line, -1, .018), point(line + 1, -1, .018), point(line, 1, .018), point(line + 1, 1, .018)] as const;
    if (!edges.every(open)) continue;
    surface.quad(...edges, tint(joints, .92 + random(line, 33, 41) * .13));
    // Stagger the granite courses perpendicular to the carriage turn.
    const shift = line % 2 * .132;
    const slots = 6;
    for (let stone = 0; stone <= slots; stone++) {
      const size = 2 / slots;
      const from = Math.max(-1, -1 + stone * size - shift + .018);
      const to = Math.min(1, -1 + (stone + 1) * size - shift - .016);
      if (to - from < .035) continue;
      const color = carriageStone[(stone + line * 3) % carriageStone.length];
      const outline = Math.abs((from + to) * .5);
      const edge = outline > .79;
      const hue = tint(edge ? marl : color, (edge ? .89 : .88) + random(line, stone, 47) * .17);
      const height = .023 + random(line, stone, 116) * .002;
      const reach = (at: number, t: number) => {
        const a = point(line, at, height), b = point(line + 1, at, height);
        return [a[0] + (b[0] - a[0]) * t, height, a[2] + (b[2] - a[2]) * t] as Point;
      };
      surface.quad(reach(from, .052), reach(from, .943), reach(to, .043), reach(to, .952), hue);
    }
  }
}

function archiveApproach(surface: RingSurface) {
  const { from, to, front, center } = archiveForecourt;
  const tangent = ringRadius(front) * Math.PI * 2 / RING_PERIOD;
  const taper = .43;
  const lip = 13.24;
  const layers = 7;
  for (let band = 0; band < layers; band++) {
    const r0 = front + band * (lip - front) / layers;
    const r1 = front + (band + 1) * (lip - front) / layers;
    const left = from + taper * (band / layers) ** 2, right = to - taper * (band / layers) ** 2;
    const finalLeft = from + taper * ((band + 1) / layers) ** 2, finalRight = to - taper * ((band + 1) / layers) ** 2;
    const count = Math.ceil((right - left) * tangent / .40);
    const begin = (n: number, r: number, up: number) => position(left + (right - left) * n, up, r);
    const end = (n: number, r: number, up: number) => position(finalLeft + (finalRight - finalLeft) * n, up, r);
    for (let flag = 0; flag < count; flag++) {
      const first = flag / count, next = (flag + 1) / count;
      const joint = .0035;
      surface.quad(begin(first, r0, .022), end(first, r1, .022), begin(next, r0, .022), end(next, r1, .022), tint(curbShadow, 1.20));
      const edge = flag === 0 || flag === count - 1 || band === layers - 1;
      const material = edge ? marble : paleSetts[(flag + band * 3) % paleSetts.length];
      const stone = tint(material, .95 + random(band, flag, 291) * .15);
      surface.quad(begin(first + joint, r0 + .014, .026), end(first + joint, r1 - .015, .026),
        begin(next - joint, r0 + .014, .026), end(next - joint, r1 - .015, .026), stone);
    }
  }
  // Narrow radiating setts take their center and fan from the archive threshold.
  const fan = (angle: number, radius: number, y: number) =>
    position(center + Math.sin(angle) * radius / tangent, y, front + .17 + Math.cos(angle) * radius / .48 * .79);
  const layersInFan = [
    { inner: .225, outer: .265, tone: tint(bronze, .85) },
    { inner: .472, outer: .534, tone: tint(cobble, 1.06) },
    { inner: .558, outer: .656, tone: tint(marble, 1.08) },
    { inner: .680, outer: .717, tone: tint(marl, .86) },
  ];
  for (const { inner, outer, tone } of layersInFan) for (let blade = 0; blade < 22; blade++) {
    const a = (blade / 22 - .5) * Math.PI + .006;
    const b = ((blade + 1) / 22 - .5) * Math.PI - .006;
    surface.quad(fan(a, inner, .033), fan(a, outer, .033), fan(b, inner, .033), fan(b, outer, .033), tint(tone, blade % 2 ? .94 : 1.07));
  }
}

function gatePaving(surface: RingSurface) {
  for (const { id, x, z } of cityGateSites) {
    const limestoneGate = id === 'fern-court';
    const darkGate = id === 'west-lock';
    const flags = limestoneGate ? sandstoneFlags : darkGate ? warehouseSetts : shopFlags;
    const joints = darkGate ? dampJoints : dryJoints;
    const width = Math.max(5, Math.round(ringRadius(z) * .43));
    const from = z + .086, to = z + .902;
    surface.sector(x + .018, from, .964, to - from, .027, tint(joints, .87));
    course(surface, x, z, from + .027, to - .022, flags, width, 3, .031, true, darkGate ? .68 : .31);
    for (const rim of [from - .009, to - .015]) {
      for (let stone = 0; stone < width; stone++) {
        const start = (stone + .10) / width;
        const tone = tint(limestoneGate ? marble : flags[1], .92 + random(stone, z, x + 28) * .17);
        surface.sector(x + start, rim, .83 / width, .054, .036, tone);
      }
    }
    const at = x + (darkGate ? .169 : .826);
    if (limestoneGate) {
      surface.sector(x + .095, z + .436, .81, .034, .036, tint(marl, .96));
      surface.sector(x + .095, z + .478, .81, .021, .036, tint(pale, .95));
    } else hatch(surface, at, z + .65, darkGate, .036);
  }
}

function courtDetails(paving: RingSurface) {
  for (const { x: west, z: near, width, depth, feature, kind } of cityCourtyards) {
    const x = feature.x + feature.width * .5, z = feature.z + feature.depth * .5;
    const tangent = ringRadius(z) * Math.PI * 2 / RING_PERIOD;
    const radius = kind === 'garden' ? .575 : .59;
    if (kind === 'wharf' || kind === 'station') {
      const end = near + (kind === 'wharf' ? depth - .41 : .421);
      watercourse(paving, west + .165, end, width - .34, false, west);
      for (const reach of [.54, width - .78]) hatch(paving, west + reach, end, true);
      for (const rad of [-.348, .348]) paving.sector(x - 1.15 / tangent, z + rad, 2.3 / tangent, .029, .023, curbShadow);
      continue;
    }
    for (const direction of [-1, 1]) {
      const thisRow = near + (direction > 0 ? depth - .255 : .252);
      paving.sector(west + .18, thisRow, width - .36, .085, .023, tint(curbShadow, .90));
      paving.sector(west + .18, thisRow + .091, width - .36, .018, .023, tint(marble, 1.08));
    }
    const point = (angle: number, r: number, y: number) => position(x + Math.cos(angle) * r / tangent, y, z + Math.sin(angle) * r / .48);
    for (let panel = 0; panel < 36; panel++) {
      const a = panel * Math.PI * 2 / 36, b = a + Math.PI * 2 / 36;
      const center = kind === 'garden' ? sandstoneFlags[1] : paleSetts[2];
      paving.quad(point(a, radius - .10, .024), point(b, radius - .10, .024), point(a, radius, .024), point(b, radius, .024),
        panel % 6 < 3 ? tint(center, .84) : tint(marble, 1.06));
      paving.quad(point(a, radius + .028, .024), point(b, radius + .028, .024), point(a, radius + .064, .024), point(b, radius + .064, .024), tint(cobble, .94));
    }
    if (kind !== 'market') continue;
    for (let ray = 0; ray < 8; ray++) {
      const center = ray * Math.PI / 4;
      paving.triangle(point(center - .105, radius - .062, .026), point(center + .105, radius - .062, .026),
        point(center, ray % 2 ? .740 : .865, .026), ray % 2 ? bronze : tint(pale, .97));
    }
  }
}

function fountainMosaic(surface: RingSurface) {
  const { x, z, width, depth } = cityFountainSite;
  const row = z + depth * .5, column = x + width * .5;
  const anchor = ringPosition(column, row);
  const heading = ringAngle(column);
  const sin = Math.sin(heading), cos = Math.cos(heading);
  const radiusX = width * ringRadius(row) * Math.PI * 2 / RING_PERIOD * .416;
  const radiusZ = depth * .48 * .407;
  const point = (angle: number, trim: number, up: number): Point => {
    const dx = Math.sin(angle) * (radiusX + trim), dz = Math.cos(angle) * (radiusZ + trim);
    return [anchor.x + dx * cos + dz * sin, up, anchor.z - dx * sin + dz * cos];
  };
  for (let piece = 0; piece < 56; piece++) {
    const first = (piece + .042) * Math.PI / 28, second = (piece + .955) * Math.PI / 28;
    const tone = piece % 7 < 2 ? tint(street, 1.06) : tint(marble, .88 + random(piece, 24, 15) * .13);
    surface.quad(point(first, .023, .020), point(second, .023, .020), point(first, .142, .020), point(second, .142, .020), tone);
    surface.quad(point(first, .151, .022), point(second, .151, .022), point(first, .162, .022), point(second, .162, .022), tint(bronze, .85));
  }
}

function parks(beds: RingSurface, edges: RingSurface, leaves: RingSurface) {
  const roadside = { base: new Color('#6d8969'), tip: new Color('#91a778'), seed: new Color('#cfb987'), height: 1.04 };
  const sedge = { base: new Color('#57796d'), tip: new Color('#78a383'), seed: new Color('#aeaa85'), height: .94 };
  const reeds = { base: new Color('#6d8569'), tip: new Color('#a1a778'), seed: new Color('#c6ad7e'), height: 1.22 };
  for (let z = 0; z < harborHeight; z++) for (let x = 0; x < RING_PERIOD; x++) {
    if (tileAt('harbor', x, z) !== 'grass') continue;
    const plants = z < 7 ? reeds : x > 24 ? sedge : roadside;
    const hue = tint(plants.base, 1.00 + random(Math.floor(x / 2), z, 9) * .16);
    beds.sector(x, z, 1, 1, .006, hue);
    if (x % 3 !== 0 && tileAt('harbor', x, z - 1) !== 'grass') edges.block(x + .028, z + .055, .946, .151, 0, .081, marble);
    if (x % 3 !== 1 && tileAt('harbor', x, z + 1) !== 'grass') edges.block(x + .028, z + .793, .946, .151, 0, .081, tintedParkStone);
    const clusters = 5 + Math.floor(ringRadius(z) / 2);
    for (let i = 0; i < clusters; i++) {
      const at = x + .08 + (i + random(x, z, i + 62)) / clusters * .85;
      const across = z + .17 + random(x, z, i * 3 + 22) * .66;
      const [wx, h, wz] = position(at, .015, across);
      const low = tint(plants.base, .68 + random(x, z, i + 190) * .33);
      const top = tint(plants.tip, .80 + random(x, z, i + 79) * .26);
      const length = (.18 + random(x, z, i * 7 + 55) * .23) * plants.height;
      beds.sector(at - .048, across - .12, .096, .24, .008, tint(hue, .87));
      for (let blade = 0; blade < 5; blade++) {
        const angle = random(x, z, i * 6 + blade + 101) * Math.PI * 2;
        const dx = Math.sin(angle), dz = Math.cos(angle);
        const sweep = random(x, z, blade * 3 + i + 96);
        const surge = length * (.49 + sweep * .64);
        const side = .028 + sweep * .018;
        const end: Point = [wx + dx * surge * .58, surge, wz + dz * surge * .58];
        const middle: Point = [wx + dx * surge * .09, surge * .42, wz + dz * surge * .09];
        const across = tint(low, 1.14 - sweep * .20);
        leaves.triangle([wx - dz * side, h, wz + dx * side], middle, end, low, top, across);
        leaves.triangle(middle, [wx + dz * side, h, wz - dx * side], end, across, top, low);
      }
      if (random(x, z, i + 243) > (plants === reeds ? .49 : .72)) {
        const rise = length * 1.28;
        const side = random(x, z, i + 159) - .5;
        const tip: Point = [wx + side * .11, rise, wz + .015];
        leaves.quad([wx - .007, .016, wz], [tip[0] - .007, rise * .95, tip[2]],
          [wx + .007, .016, wz + .014], [tip[0] + .007, rise * .95, tip[2] + .014], top);
        const seed = tint(plants.seed, .89 + random(x, z, i + 128) * .16);
        leaves.triangle([tip[0] - .021, rise - .016, tip[2]], [tip[0] + .024, rise - .001, tip[2] - .007],
          [tip[0] + side * .062, rise + .075, tip[2] + .029], seed, tint(seed, 1.06));
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
      float grit = fract(sin(dot(floor(p * vec3(47.0,31.0,47.0)), vec3(43.72, 18.67, 65.59))) * 27647.23) - .5;
      float faintVeins = sin(p.x * 1.31 + p.z * 1.47 + sin(p.z * 3.1 - p.y * 2.9) * 1.03);
      float risingTide = smoothstep(-.60, -.12, p.y + .022 * sin(p.x + p.z * 2.9));
      float brine = max(0.0, -p.y) * (1.0 - risingTide);
      diffuseColor.rgb *= (1.0 + crisp * (grain + grit * .44) * .107 + faintVeins * .022) * (.89 + .11 * risingTide);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(.84, .98, .93), min(.48, brine));
    `);
  };
  return material;
}

function timberFinish() {
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: .84, side: DoubleSide });
  material.onBeforeCompile = shader => {
    shader.vertexShader = `varying vec3 timberPoint;\n${shader.vertexShader}`.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n timberPoint = (modelMatrix * vec4(position, 1.0)).xyz;');
    shader.fragmentShader = `varying vec3 timberPoint;\n${shader.fragmentShader}`.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 p = timberPoint.xz;
      float radius = length(p);
      float across = atan(p.x, p.y);
      float footprint = max(length(dFdx(p)), length(dFdy(p)));
      float detail = 1.0 - smoothstep(.020, .078, footprint);
      float wander = sin(radius * 7.5 + across * 119.0) * .57 + sin(radius * 24.0 + across * 41.0) * .19;
      float fibers = sin(across * 2360.0 + wander);
      float rings = .56 * sin(across * 377.0 + sin(radius * 14.0) * .38) + .44 * sin(across * 669.0 + wander * .41);
      float pore = smoothstep(.55,1.0, fibers) * .086 * detail;
      float dusk = (.91 + .09 * smoothstep(0.0, .048, timberPoint.y + .033));
      diffuseColor.rgb *= (1.0 + rings * .039 - pore) * dusk;
    `);
  };
  return material;
}

function bathymetry(edges: Edge[]) {
  const size = 192;
  const cell = surveySpan * 2 / size;
  const minimum = new Float32Array(size * size).fill(coastDepth ** 2);
  const grid = (world: number) => (world + surveySpan) / cell - .5;
  const world = (index: number) => (index + .5) * cell - surveySpan;
  for (const { x, z, dx, dz, lengthSquared } of edges) {
    const left = Math.max(0, Math.ceil(grid(Math.min(x, x + dx) - coastDepth)));
    const right = Math.min(size - 1, Math.floor(grid(Math.max(x, x + dx) + coastDepth)));
    const front = Math.max(0, Math.ceil(grid(Math.min(z, z + dz) - coastDepth)));
    const back = Math.min(size - 1, Math.floor(grid(Math.max(z, z + dz) + coastDepth)));
    for (let row = front; row <= back; row++) {
      const pz = world(row) - z;
      const offset = row * size;
      for (let column = left; column <= right; column++) {
        const px = world(column) - x;
        const u = Math.max(0, Math.min(1, (px * dx + pz * dz) / lengthSquared));
        const a = px - dx * u, b = pz - dz * u;
        minimum[offset + column] = Math.min(minimum[offset + column], a * a + b * b);
      }
    }
  }
  const data = new Uint8Array(size * size * 4);
  for (let index = 0; index < minimum.length; index++) {
    const at = index * 4;
    data[at] = Math.round(Math.sqrt(minimum[index]) / coastDepth * 255);
    data[at + 3] = 255;
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function ocean(edges: Edge[], clock: { value: number }, night: { value: number }, vista: { value: number }) {
  const material = new ShaderMaterial({
    fog: true, transparent: true, depthWrite: false,
    uniforms: {
      ...UniformsUtils.clone(UniformsLib.fog), clock, night, vista,
      coastDistance: { value: bathymetry(edges) },
      surveyDiameter: { value: surveySpan * 2 },
      basinRim: { value: ringRadius(innerEdge) },
      basinReach: { value: ringRadius(9.25) },
      fortressRadius: { value: ringRadius(harborHeight + 1) },
      displacement: { value: 0 },
      deep: { value: new Color('#2b5363') }, lagoon: { value: new Color('#437570') }, shallows: { value: new Color('#577f7d') },
      openSea: { value: new Color('#3e7791') },
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
      uniform float fortressRadius;
      uniform float displacement;
      uniform vec3 deep;
      uniform vec3 openSea;
      uniform vec3 lagoon;
      uniform vec3 shallows;
      uniform float clock;
      uniform float night;
      uniform float vista;
      void main() {
        vec2 p = waterPoint.xz;
        vec2 mapUv = .5 + p / surveyDiameter;
        vec2 outer = abs(mapUv - .5);
        float bank = max(outer.x, outer.y) > .5 ? 1.0 : texture2D(coastDistance, mapUv).r;
        float radius = length(p);
        float swash = sin(dot(p, vec2(.51, .63))) * .72 + sin(dot(p, vec2(-.69, 1.09))) * .44;
        float swell = dot(p, vec2(1.01, -1.93)) - clock * 1.14 + swash;
        float ripple = dot(p, vec2(.96, 5.74)) + clock * 1.91 + swash * 1.46 + sin(dot(p, vec2(2.0, -.62))) * .65;
        float chop = dot(p, vec2(-2.21, 9.35)) - clock * 2.67 + sin(p.x * 3.9 + p.y * 1.10) * .86;
        vec2 slope = cos(swell) * vec2(.027, -.037) + cos(ripple) * vec2(.010, .069) + cos(chop) * vec2(-.011, .045);
        vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));
        vec3 viewer = normalize(cameraPosition - waterPoint);
        vec3 sky = normalize(vec3(-.37, .91, .23));
        float glint = pow(max(0.0, dot(normal, normalize(viewer + sky))), 42.0);
        float fresnel = pow(max(0.0, 1.0 - dot(viewer, normal)), 3.5);
        float pool = 1.0 - smoothstep(basinRim - .07, basinReach, radius);
        float current = sin(radius * 3.9 - clock * .55 + sin(p.x * .8 - p.y * .53) * .72);
        float seaward = smoothstep(basinRim - .48, basinReach + 8.0, radius);
        vec3 base = mix(mix(deep, openSea, vista * seaward * (1.0 - night * .48)), lagoon, pool * .81);
        float bottom = smoothstep(.030, .18 + swash * .023 + pool * .054, bank);
        float silt = (1.0 - bottom) * (.47 + pool * .16);
        vec3 color = mix(base, shallows, silt);
        color *= .87 + .13 * smoothstep(.047, .124, bank);
        float resolvedRipple = 1.0 - smoothstep(.55, 2.8, fwidth(ripple));
        float distanceQuiet = 1.0 - vista * .42 * seaward;
        color *= .95 + (sin(swell) * .023 + cos(ripple) * .014 * resolvedRipple) * distanceQuiet + dot(normal, sky) * .064 + current * pool * .013;
        float tide = .083 + sin(swell) * .012 + sin(chop) * .004;
        float fringe = smoothstep(-.29, .79, sin(p.x * 3.7 + p.y * 4.1 + swash * 1.6) + cos(chop) * .19);
        float foam = (1.0 - smoothstep(.003, .0135, abs(bank - tide))) * (.20 + fringe * .73);
        float crest = 1.0 - smoothstep(.048, .169 + fwidth(ripple) * .26, 1.0 - cos(ripple));
        float patches = smoothstep(.45, 1.24, sin(dot(p, vec2(1.84, .71)) + sin(swell) * .84 - clock * .38) + swash * .31);
        float cap = crest * patches * resolvedRipple * (.26 + .74 * smoothstep(.19, .81, bank));
        float lighter = glint * .064 + fresnel * .116 + foam * .085 + cap * .023 * distanceQuiet * distanceQuiet;
        float lift = max(0.0, -.58 - waterPoint.y);
        float exposed = smoothstep(.16, 1.24, lift);
        float shelf = .20 + 1.20 * smoothstep(4.8, 5.9, lift) + 1.38 * smoothstep(10.1, 12.3, lift)
          + 4.06 * smoothstep(16.8, 20.5, lift);
        float hullDistance = radius - fortressRadius - shelf;
        float surge = .07 * sin(p.x * .81 - clock * 1.43) + .057 * cos(p.y * 1.14 + clock * .88);
        float contact = 1.0 - smoothstep(.035, .21, abs(hullDistance - .11 - surge));
        float wash = exp(-max(0.0, hullDistance) * 1.9) * (.5 + .5 * cos((hullDistance - surge) * 14.0 - clock * 1.76));
        color *= 1.0 - exposed * exp(-max(0.0, hullDistance) * .96) * .24;
        lighter += exposed * (contact * (.19 + .25 * fringe) + wash * .058);
        float rippleFront = hullDistance * .63 - clock * 1.50 + .17 * swash;
        float propagating = pow(.5+.5*cos(rippleFront),10.) * exp(-max(0.,hullDistance)*.067);
        lighter += displacement * propagating * (.15 + .20*fringe) * smoothstep(.13,2.3,hullDistance);
        vec3 dusk = color * vec3(.27,.45,.60) + vec3(.013,.023,.037);
        color = mix(color, dusk, night);
        color = mix(color, mix(vec3(.45,.68,.65), vec3(.14,.29,.38), night), lighter);
        float haze = exposed * (1.0 - smoothstep(.029,.145,viewer.y));
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
        vec3 horizon = mix(vec3(.358,.491,.566),vec3(.071,.11,.15),night);
        gl_FragColor.rgb = mix(gl_FragColor.rgb,sRGBTransferOETF(vec4(horizon,1.)).rgb,haze*.98);
      }`,
  });
  const mesh = new Mesh(new PlaneGeometry(1200, 1200), material);
  mesh.name = 'Inner tidal basin and outer sea';
  mesh.position.y = seaLevel;
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -1;
  return mesh;
}

export function buildRingGround() {
  const group = new Group();
  group.name = 'Tideport annular ground and shoreline';
  const top = new RingSurface(), cliffs = new RingSurface(), paving = new RingSurface(true);
  const roads = new RingSurface(), paint = new RingSurface(), trim = new RingSurface();
  const boards = new RingSurface(), leaves = new RingSurface();
  const clock = { value: 0 }, night = { value: 0 }, vista = { value: 0 };
  const stone = coastlineFinish();
  const edges = ground(top, cliffs);
  breakwater(top, cliffs, trim, edges);
  const lenses = new RingSurface();
  harborLanterns(cliffs, lenses);
  const lensGlass = new MeshStandardMaterial({ vertexColors: true, roughness: .25, emissive: 0xffc483, emissiveIntensity: 0 });
  group.add(lenses.mesh(lensGlass, 'Glazed harbour signals'));
  platform(boards, top, trim);
  archSpan(top, cliffs, -.022, 1.064, [.48]);
  archSpan(top, cliffs, 33.98, 4.04, [34.67, 35.97, 37.19]);
  avenues(roads, paint, trim);
  stonework(paving, trim);
  archiveApproach(paint);
  signalCobbles(paving);
  streetFronts(paving);
  forecourtDetails(paving);
  gatePaving(paving);
  courtDetails(paving);
  fountainMosaic(paint);
  parks(paving, trim, leaves);
  const sea = ocean(edges, clock, night, vista);
  const basin = new Mesh(new CircleGeometry(ringRadius(harborHeight + 1) - .02, 144), sea.material);
  basin.name = 'Retained upper harbor';
  basin.rotation.copy(sea.rotation);
  basin.position.y = seaLevel;
  basin.renderOrder = -1;
  basin.visible = false;
  sea.renderOrder = -2;
  group.add(top.mesh(stone, 'Annulus walk surface'), cliffs.mesh(stone, 'Carved seawalls and bridge arches', true),
    paving.mesh(stone, 'Radial plazas and limestone promenades'), roads.mesh(stone, 'Circular slate boulevard'),
    paint.mesh(stone, 'Ring crossings and guiding lines'), trim.mesh(stone, 'Curb caps and quay details', true),
    boards.mesh(timberFinish(), 'Curved timber landing', true), leaves.mesh(wind(clock), 'Wind in the annular parks'), sea, basin);
  return {
    group,
    update(time: number, darkness: number, aerial = 0, seaDrop = 0, displacement = 0) {
      lensGlass.emissiveIntensity = darkness * .85;
      sea.position.y = seaLevel - seaDrop;
      sea.material.uniforms.displacement.value = displacement;
      basin.visible = seaDrop > .0001;
      clock.value = time / 1000;
      night.value = darkness;
      vista.value = aerial;
    },
  };
}
