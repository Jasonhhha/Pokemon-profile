import * as THREE from 'three';
import { harborside, height, onCauseway, props, summitEdge, tidalInlet, tileAt, width, type FieldArea, type Tile } from './field-layout';

type Point = [x: number, y: number, z: number];
type Edge = { from: Point; to: Point };
type Ground = Exclude<Tile, 'water' | 'shelf' | 'dock' | 'drop'>;

const bounds = { left: -10, right: width + 10, north: -9, south: height + 9 };
const sea = { harbor: -.58, grove: -.4, summit: -5.8 };
const areaStyle = {
  harbor: { lawn: '#91ab72', grass: '#7d9c60', path: '#baa17b', quay: '#c4b399', shore: '#ccb486', stone: '#a9a798', rock: '#d2c1a7', shade: '#687c70', plant: '#91ad63', foam: '#e0f0dc', deep: '#216872', aqua: '#3daa9e', shallow: '#8ac5aa' },
  grove: { lawn: '#73997b', grass: '#5e855f', path: '#ad997c', quay: '#b7b299', shore: '#a6a584', stone: '#98a393', rock: '#a8af99', shade: '#596f61', plant: '#81a66a', foam: '#d4e9d4', deep: '#354f58', aqua: '#53857f', shallow: '#90ad8d' },
  summit: { lawn: '#939a9e', grass: '#82918e', path: '#b2a799', quay: '#b8b6ae', shore: '#c6b39e', stone: '#aaa6b2', rock: '#b6a9bb', shade: '#666a85', plant: '#99a480', foam: '#d9e5eb', deep: '#526981', aqua: '#7599a5', shallow: '#9baebd' },
} as const;

const clamp = (value: number, a: number, b: number) => Math.max(a, Math.min(value, b));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function random(x: number, z: number, salt = 0) {
  const value = Math.imul(x + 193, 374761393) + Math.imul(z + 257, 668265263) + Math.imul(salt + 1, 1597334677);
  return ((Math.imul(value ^ (value >>> 13), 1274126177) ^ (value >>> 16)) >>> 0) / 4294967296;
}

function noise(x: number, z: number, salt: number) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const tx = x - ix;
  const tz = z - iz;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  return lerp(lerp(random(ix, iz, salt), random(ix + 1, iz, salt), sx),
    lerp(random(ix, iz + 1, salt), random(ix + 1, iz + 1, salt), sx), sz);
}

class Surface {
  private positions: number[] = [];
  private colors: number[] = [];
  private bends: number[] = [];

  triangle(a: Point, b: Point, c: Point, paint: THREE.Color | [THREE.Color, THREE.Color, THREE.Color], bends: [number, number, number] = [0, 0, 0]) {
    this.positions.push(...a, ...b, ...c);
    const colors = Array.isArray(paint) ? paint : [paint, paint, paint];
    for (const color of colors) this.colors.push(color.r, color.g, color.b);
    this.bends.push(...bends);
  }

  quad(a: Point, b: Point, c: Point, d: Point, color: THREE.Color) {
    this.triangle(a, b, c, color);
    this.triangle(c, b, d, color);
  }

  mesh(material: THREE.Material, name: string, castShadow = false) {
    if (this.positions.length === 0) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    if (this.bends.some(value => value)) geometry.setAttribute('windBend', new THREE.Float32BufferAttribute(this.bends, 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.receiveShadow = true;
    mesh.castShadow = castShadow;
    return mesh;
  }
}

function stoneMaterial(side: THREE.Side = THREE.FrontSide) {
  return new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .92, side });
}

function outerTile(area: FieldArea, x: number, z: number): Tile {
  const mapX = clamp(x, 0, width - 1);
  const mapZ = clamp(z, 0, height - 1);
  if (x === mapX && z === mapZ) return tileAt(area, x, z);
  if (area === 'harbor') {
    if (x < 0 || x >= width + 5 || z < -7 || z >= height + 6) return 'water';
    if (x >= width) return z >= 11 && z <= 13 && x < width + 4 ? 'quay' : 'water';
    const fade = Math.max(0, -z, z - height + 1);
    const west = harborside[mapZ] + Math.round(fade * .44 + Math.sin(z * .58) * .8);
    const east = tidalInlet[mapZ][0] - Math.floor(fade * .4);
    if (x < west - 2 || x > east + 1) return 'water';
    if (x < west - 1 || x > east) return 'shelf';
    if (x < west || x === east) return 'shore';
  }
  if (area === 'summit' && z >= summitEdge[mapX]) return 'drop';
  if ((x < 0 || x >= width) && z >= 11 && z <= 12 && area !== 'harbor') return 'path';
  return 'lawn';
}

const isGround = (tile: Tile): tile is Ground => tile !== 'water' && tile !== 'shelf' && tile !== 'dock' && tile !== 'drop';

function makeTerrain(area: FieldArea) {
  const tops = new Surface();
  const walls = new Surface();
  const bed = new Surface();
  const coast: Edge[] = [];
  const colors = Object.fromEntries(Object.entries(areaStyle[area]).map(([name, hex]) => [name, new THREE.Color(hex)])) as Record<keyof typeof areaStyle.harbor, THREE.Color>;
  const grid = new Map<string, Point>();
  const tile = (x: number, z: number) => outerTile(area, x, z);

  function adjacent(x: number, z: number) {
    return [tile(x - 1, z - 1), tile(x, z - 1), tile(x - 1, z), tile(x, z)];
  }

  function top(x: number, z: number): Point {
    const key = `${x},${z}`;
    const previous = grid.get(key);
    if (previous) return previous;
    const near = adjacent(x, z);
    const dry = near.filter(isGround).length;
    const rim = dry > 0 && dry < 4 && !near.includes('dock') && !(area === 'harbor' && x >= 32 && x <= 40 && z >= 11 && z <= 14);
    let xShift = rim ? (random(x, z, 3) - .5) * .33 : 0;
    let zShift = rim ? (random(x, z, 4) - .5) * .30 : 0;
    if (rim && (dry === 1 || dry === 3)) {
      const bevel = (area === 'grove' ? .27 : .19) * (.78 + random(x, z, 6) * .43);
      const corner = near.findIndex(kind => isGround(kind) === (dry === 1));
      xShift += corner % 2 === 0 ? -bevel : bevel;
      zShift += corner < 2 ? -bevel : bevel;
    }
    const edgeDistance = Math.max(0, -x, x - width, -z, z - height);
    const lift = area === 'grove' || area === 'summit' ? Math.min(1.8, edgeDistance * .16) * (noise(x / 5, z / 5, 2) + .16) : 0;
    const point: Point = [x + xShift, lift, z + zShift];
    grid.set(key, point);
    return point;
  }

  function seafloor(x: number, z: number): Point {
    const local = adjacent(x, z);
    const depth = local.filter(kind => kind === 'water' || kind === 'drop').length;
    const mound = noise(x / 3.3, z / 3.2, 5);
    const near = depth < 4 || local.includes('shelf');
    return [x, sea[area] - (near ? .12 + depth * .12 : .72 + mound * .85), z];
  }

  function tint(kind: Ground, p: Point, variation: number) {
    const x = p[0], z = p[2];
    const patch = (noise(x / 3.9, z / 3.9, 1) - .5) * .30 + (noise(x * .95, z, 8) - .5) * .095;
    const soil = colors[kind].clone();
    if (kind === 'grass' || kind === 'lawn') {
      const nearby = adjacent(Math.round(x), Math.round(z));
      const coverage = nearby.filter(value => value === 'grass').length / 4;
      soil.copy(colors.lawn).lerp(colors.grass, coverage);
      if (area === 'harbor') {
        const coastDistance = Math.min(Math.abs(x - harborside[clamp(Math.floor(z), 0, height - 1)]), Math.abs(x - 35));
        soil.lerp(colors.shore, clamp((1.7 - coastDistance) / 5.5, 0, .32));
      } else if (area === 'grove') {
        const saturatedBank = nearby.some(value => value === 'shelf' || value === 'water');
        soil.lerp(colors.shade, saturatedBank ? .35 : Math.max(0, noise(x / 5.6, z / 4.2, 72) - .4) * .29);
      } else {
        const ledge = summitEdge[clamp(Math.floor(x), 0, width - 1)];
        const exposed = clamp((z - ledge + 4) / 9, 0, .45);
        soil.lerp(colors.rock, exposed + .17 * noise(x / 3.3 + z / 8, z / 6, 24));
      }
    }
    return soil.multiplyScalar(1 + patch + variation);
  }

  function cliffPoint(point: Point, shallow: boolean, stage: number, normal: readonly [number, number]): Point {
    const jitter = noise(point[0] / 2, point[2] / 2, 13 + stage);
    const y = shallow ? [0, -.16, -.39, -.75, -1.32][stage] : [0, -.42, -1.52, -3.44, -6.7][stage];
    const spread = shallow ? (area === 'grove' ? .47 : .28) : 1.22;
    const push = spread * stage / 4 * (.72 + .5 * jitter);
    return [point[0] + normal[0] * push, point[1] + y + (stage ? (jitter - .5) * (shallow ? .10 : .44) : 0), point[2] + normal[1] * push];
  }

  function outward(x: number, z: number, fallback: readonly [number, number]): readonly [number, number] {
    const corners = adjacent(x, z);
    let dx = 0, dz = 0;
    corners.forEach((kind, i) => {
      if (isGround(kind)) return;
      dx += i % 2 === 0 ? -1 : 1;
      dz += i < 2 ? -1 : 1;
    });
    const length = Math.hypot(dx, dz);
    return length ? [dx / length, dz / length] : fallback;
  }

  const sides = [
    { dx: -1, dz: 0, a: [0, 1], b: [0, 0] }, { dx: 1, dz: 0, a: [1, 0], b: [1, 1] },
    { dx: 0, dz: -1, a: [0, 0], b: [1, 0] }, { dx: 0, dz: 1, a: [1, 1], b: [0, 1] },
  ] as const;

  for (let z = bounds.north; z < bounds.south; z++) {
    for (let x = bounds.left; x < bounds.right; x++) {
      const kind = tile(x, z);
      const bridge = area === 'harbor' && onCauseway(x, z) && x >= 34 && x < 38;
      if (!isGround(kind) || bridge) {
        const a = seafloor(x, z), b = seafloor(x, z + 1), c = seafloor(x + 1, z), d = seafloor(x + 1, z + 1);
        const color = colors.shore.clone().lerp(colors.shade, kind === 'shelf' ? .26 : .7).multiplyScalar(.9 + random(x, z, 7) * .18);
        bed.quad(a, b, c, d, color);
      }
      if (!isGround(kind)) continue;
      const a = top(x, z), b = top(x, z + 1), c = top(x + 1, z), d = top(x + 1, z + 1);
      const shift = (random(x, z, 11) - .5) * (kind === 'lawn' || kind === 'grass' ? .032 : .06);
      tops.triangle(a, b, c, [tint(kind, a, shift), tint(kind, b, shift), tint(kind, c, shift)]);
      tops.triangle(c, b, d, [tint(kind, c, -shift), tint(kind, b, -shift), tint(kind, d, -shift)]);

      for (const { dx, dz, a: [ax, az], b: [bx, bz] } of sides) {
        const next = tile(x + dx, z + dz);
        if (isGround(next)) continue;
        const start = top(x + ax, z + az), end = top(x + bx, z + bz);
        coast.push({ from: start, to: end });
        // Model bridge spans separately so the inlet remains open underneath.
        if (bridge && dz !== 0) continue;
        const edgeA = outward(x + ax, z + az, [dx, dz]);
        const edgeB = outward(x + bx, z + bz, [dx, dz]);
        const shallow = next !== 'drop';
        for (let stage = 0; stage < 4; stage++) {
          const upA = cliffPoint(start, shallow, stage, edgeA), upB = cliffPoint(end, shallow, stage, edgeB);
          const lowA = cliffPoint(start, shallow, stage + 1, edgeA), lowB = cliffPoint(end, shallow, stage + 1, edgeB);
          const color = colors.rock.clone().lerp(stage === 0 ? colors.lawn : colors.shade, [.22, .32, .52, .76][stage]);
          color.multiplyScalar(.86 + random(x, z, stage + 17) * .23);
          walls.triangle(upA, lowA, upB, color);
          walls.triangle(upB, lowA, lowB, color.clone().multiplyScalar(.91 + random(x, z, stage + 10) * .14));
        }
      }
    }
  }

  return { tops, walls, bed, coast, colors, top };
}

function flatPolygon(surface: Surface, x: number, z: number, points: Array<readonly [number, number]>, color: THREE.Color, y = .009,
  corners?: readonly [Point, Point, Point, Point]) {
  const point = ([u, v]: readonly [number, number]): Point => {
    if (!corners) return [x + u, y, z + v];
    const [tl, tr, bl, br] = corners;
    return [lerp(lerp(tl[0], tr[0], u), lerp(bl[0], br[0], u), v), y,
      lerp(lerp(tl[2], tr[2], u), lerp(bl[2], br[2], u), v)];
  };
  const first = point(points[0]);
  for (let i = 1; i < points.length - 1; i++) {
    surface.triangle(first, point(points[i + 1]), point(points[i]), color);
  }
}

function pave(surface: Surface, area: FieldArea, { colors: palette, top }: ReturnType<typeof makeTerrain>) {
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      const kind = tileAt(area, x, z);
      if (kind !== 'quay' && kind !== 'stone' && kind !== 'path' && kind !== 'shore') continue;
      const corners = [top(x, z), top(x + 1, z), top(x, z + 1), top(x + 1, z + 1)] as const;
      if (kind === 'quay' || kind === 'stone') {
        // Offset joints on alternate courses to keep tile borders out of the masonry.
        for (let row = 0; row < 2; row++) {
          const stagger = (z + row + x % 2) % 2 === 0;
          const split = stagger ? [.025, .42, .975] : [.025, .62, .975];
          for (let col = 0; col < 2; col++) {
            const start = split[col] + .008, end = split[col + 1] - .008;
            const top = row * .5 + .023, bottom = (row + 1) * .5 - .018;
            const chip = .025 + random(x, z, row + col * 4 + 21) * .03;
            const color = palette[kind].clone().lerp(palette.rock, .23).multiplyScalar(.88 + random(x, z, col + row * 2 + 31) * .24);
            flatPolygon(surface, x, z, [[start + chip, top], [end - chip, top], [end, top + chip], [end, bottom - chip],
              [end - chip, bottom], [start + chip, bottom], [start, bottom - chip], [start, top + chip]], color, .009, corners);
            if (random(x, z, row * 2 + col + 41) > .37) {
              flatPolygon(surface, x, z, [[start + chip, bottom - .027], [end - chip, bottom - .023],
                [end - chip * 2, bottom - .014], [start + chip * 2, bottom - .012]], color.clone().multiplyScalar(.84), .012, corners);
            }
          }
        }
      } else if (kind === 'path' || kind === 'shore') {
        for (let i = 0; i < 4; i++) {
          const px = .09 + random(x, z, i * 2 + 50) * .76;
          const pz = .07 + random(x, z, i * 2 + 51) * .81;
          const length = .036 + random(x, z, i + 64) * .12;
          const t = random(x, z, i + 70);
          const color = palette[kind].clone().lerp(palette.rock, t * .55).multiplyScalar(.87 + .26 * t);
          flatPolygon(surface, x, z, [[px, pz], [px + length * .68, pz - .018], [px + length, pz + .01],
            [px + length * .65, pz + .047], [px + .015, pz + .033]], color, .009, corners);
        }
      }
    }
  }
}

function meadow(area: FieldArea, palette: ReturnType<typeof makeTerrain>['colors'], seconds: { value: number }) {
  const plants = new Surface();
  const salt = new THREE.Color('#b4af73');
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      const tile = tileAt(area, x, z);
      const tall = tile === 'grass';
      const shore = area === 'harbor' && tile === 'shore';
      const pond = area === 'grove' && tile === 'lawn' && z >= 5 && z <= 11 && x >= 16 && x <= 28 &&
        [[x - 1, z], [x + 1, z], [x, z - 1], [x, z + 1]].some(([col, row]) => tileAt(area, col, row) === 'shelf');
      const fertility = noise(x * .37, z * .43, 25);
      const fringe = Math.max(0, fertility - .42);
      if (!tall && !shore && !pond && (tile !== 'lawn' || random(x, z, 43) > .23 + fringe * .78)) continue;
      if (shore && random(x, z, 73) > .39) continue;
      const clusters = tall ? 4 + Math.floor(fertility * 6) : pond ? 2 + Math.round(fringe * 5) : 1 + Math.floor(fertility * 3);
      for (let lump = 0; lump < clusters; lump++) {
        const inset = shore || pond ? .24 : .12;
        const px = x + inset + random(x, z, lump * 7 + 50) * (1 - inset * 2);
        const pz = z + inset + random(x, z, lump * 7 + 51) * (1 - inset * 2);
        const growth = random(x, z, lump * 5 + 52);
        const size = tall ? .23 + growth * (.22 + fringe * .15) : pond ? .17 + growth * .20 : shore ? .12 + growth * .17 : .07 + growth * .13;
        const basal = palette.grass.clone().lerp(palette.shade, pond ? .37 : .11).multiplyScalar(tall ? .54 : .69);
        const leaf = palette.plant.clone().lerp(salt, shore ? .59 : area === 'summit' ? .21 : 0).multiplyScalar(.82 + random(x, z, lump * 5 + 53) * .43);
        for (let i = 0; i < (tall || pond ? 4 : 3); i++) {
          const angle = (i / 4 + random(x, z, lump + 79) * .28) * Math.PI * 2;
          const dx = Math.cos(angle), dz = Math.sin(angle);
          const bladeWidth = size * ((area === 'summit' ? .07 : .10) + random(x, z, lump * 4 + i + 71) * .065);
          const bladeHeight = size * (.70 + random(x, z, lump * 4 + i + 61) * .44);
          const curl = bladeHeight * (.22 + random(x, z, lump * 4 + i + 67) * .33);
          const a: Point = [px + dz * bladeWidth, .013, pz - dx * bladeWidth];
          const b: Point = [px - dz * bladeWidth, .014, pz + dx * bladeWidth];
          const lean = area === 'summit' ? .24 : shore ? .14 : 0;
          const fold: Point = [px + (dx * .32 + lean) * curl, bladeHeight * .61, pz + dz * curl * .32];
          const tip: Point = [px + (dx + lean * 2.10) * curl, bladeHeight, pz + dz * curl];
          plants.triangle(a, b, fold, [basal, basal, leaf], [0, 0, .49]);
          plants.triangle(a, fold, tip, [basal, leaf, leaf.clone().multiplyScalar(1.09)], [0, .49, 1]);
        }
      }
    }
  }
  const material = stoneMaterial(THREE.DoubleSide);
  material.onBeforeCompile = shader => {
    shader.uniforms.fieldTime = seconds;
    shader.vertexShader = `uniform float fieldTime; attribute float windBend;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float breeze = sin(fieldTime * 2.2 + position.x * .82 + position.z * .62);
      transformed.x += breeze * windBend * .06;
      transformed.z += sin(fieldTime * 1.52 - position.x * .42) * windBend * .035;`);
  };
  return plants.mesh(material, 'Breeze in the meadow');
}

function box(surface: Surface, x: number, y: number, z: number, w: number, h: number, d: number, paint: THREE.Color) {
  const a: Point = [x, y, z], b: Point = [x + w, y, z], c: Point = [x, y, z + d], d0: Point = [x + w, y, z + d];
  const e: Point = [x, y + h, z], f: Point = [x + w, y + h, z], g: Point = [x, y + h, z + d], h0: Point = [x + w, y + h, z + d];
  surface.quad(e, g, f, h0, paint);
  const shade = paint.clone().multiplyScalar(.72);
  surface.quad(e, f, a, b, shade);
  surface.quad(f, h0, b, d0, shade);
  surface.quad(h0, g, d0, c, shade);
  surface.quad(g, e, c, a, shade);
}

function rope(surface: Surface, start: Point, end: Point, paint: THREE.Color) {
  const steps = 7;
  let before = start;
  const half = .017;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const next: Point = [lerp(start[0], end[0], t), lerp(start[1], end[1], t) - Math.sin(Math.PI * t) * .12, lerp(start[2], end[2], t)];
    const offsets = [[0, half, 0], [0, -half, 0], [0, 0, half], [half, 0, 0], [0, 0, -half], [-half, 0, 0]] as const;
    const point = (v: Point, j: number): Point => [v[0] + offsets[j][0], v[1] + offsets[j][1], v[2] + offsets[j][2]];
    surface.quad(point(before, 0), point(before, 1), point(next, 0), point(next, 1), paint);
    const side = Math.abs(end[0] - start[0]) > Math.abs(end[2] - start[2]) ? [2, 4] : [3, 5];
    surface.quad(point(before, side[0]), point(before, side[1]), point(next, side[0]), point(next, side[1]), paint.clone().multiplyScalar(.82));
    before = next;
  }
}

function harborWorks() {
  const docks = new Surface();
  const timber = new THREE.Color('#bd9567');
  const beam = new THREE.Color('#775441');
  const ropeColor = new THREE.Color('#c4a581');
  box(docks, 1, -.25, 11.07, 6, .16, 2.86, beam);
  for (let plank = 0; plank < 30; plank++) {
    const x = 1 + plank * .20;
    const split = (plank % 4) * .17 + 1.14;
    for (const [from, until, key] of [[11.035, 11 + split, 1], [11 + split + .022, 13.965, 2]]) {
      const wood = timber.clone().multiplyScalar(.83 + random(plank, key, 101) * .23);
      box(docks, x + .009, -.105, from, .183, .105, until - from, wood);
      if (plank % 2 === 0) {
        flatPolygon(docks, x, from, [[.055, .07], [.069, .04], [.075, until - from - .13], [.06, until - from - .08]], wood.clone().multiplyScalar(.8), .002);
      }
    }
  }
  for (const z of [11.105, 13.895]) {
    let prior: Point | undefined;
    for (const x of [1.1, 2.24, 3.45, 4.67, 5.88, 6.55]) {
      box(docks, x - .068, -.97, z - .066, .137, 1.46, .132, beam.clone().multiplyScalar(.9 + random(Math.round(x * 11), 1) * .2));
      box(docks, x - .081, .465, z - .08, .163, .055, .16, timber);
      const node: Point = [x, .397, z];
      if (prior) rope(docks, prior, node, ropeColor);
      prior = node;
    }
  }
  box(docks, 1.08, -.91, 12.43, .14, 1.43, .14, beam);
  rope(docks, [1.13, .38, 11.16], [1.13, .42, 12.50], ropeColor);
  rope(docks, [1.13, .42, 12.50], [1.13, .38, 13.86], ropeColor);
  for (let i = 0; i < 4; i++) {
    box(docks, 1.45 + i * 1.34, -.73, 11.25, .14, .62, .16, beam);
    box(docks, 1.45 + i * 1.34, -.73, 13.60, .14, .62, .16, beam);
    box(docks, 1.45 + i * 1.34, -.41, 11.18, .16, .12, 2.55, timber.clone().multiplyScalar(.59));
  }

  const bridge = new Surface();
  const limestone = new THREE.Color('#c7bba0');
  const archCenters = [35.02, 37.15];
  const archRadius = .84;
  function span(x: number) {
    const local = Math.min(...archCenters.map(center => Math.abs(center - x))) / archRadius;
    return local < 1 ? -.97 + Math.sqrt(1 - local * local) * .72 : -.97;
  }
  const risers = Array.from({ length: 33 }, (_, i) => 34 + i / 8);
  for (const face of [11, 14]) {
    for (let i = 0; i < risers.length - 1; i++) {
      const a = risers[i], b = risers[i + 1];
      const lowerA = span(a), lowerB = span(b);
      const masonry = limestone.clone().multiplyScalar(.69 + random(i, face, 79) * .24);
      bridge.quad([a, -.04, face], [a, lowerA, face], [b, -.04, face], [b, lowerB, face], masonry);
      if (face === 11) bridge.quad([a, lowerA, 11], [a, lowerA, 14], [b, lowerB, 11], [b, lowerB, 14], masonry.clone().multiplyScalar(.66));
      if (lowerA > -.95 || lowerB > -.95) {
        const edge = face + (face === 11 ? -.038 : .038);
        bridge.quad([a, lowerA + .155, edge], [a, lowerA + .02, edge], [b, lowerB + .155, edge], [b, lowerB + .02, edge],
          limestone.clone().multiplyScalar(.87 + random(i, face, 81) * .15));
      }
    }
    const inward = face === 11 ? .094 : -.245;
    for (let i = 0; i < 14; i++) {
      const x = 32.07 + i * .49;
      const tint = limestone.clone().multiplyScalar(.79 + random(i, face, 91) * .22);
      box(bridge, x, -.02, face + inward, .461, .272, .155, tint);
      box(bridge, x - .015, .251, face + inward - .023, .495, .059, .198, limestone);
      if (i % 3 === 0) box(bridge, x -.02, 0, face + inward - .038, .19, .41, .23, limestone.clone().multiplyScalar(.89));
    }
  }
  return { docks, bridge };
}

type Reflection = { x: number; z: number; width: number; length: number; shade: number; lamp?: boolean; wake?: boolean };

function waterReflections(area: FieldArea): Reflection[] {
  if (area === 'harbor') {
    return props.harbor.flatMap<Reflection>(prop => {
      const x = prop.x + .5, z = prop.y + .82;
      if (prop.kind === 'beacon') return [{ x, z, width: .51, length: 3.2, shade: .83, lamp: true }];
      if (prop.kind === 'boat') return [{ x: x - .12, z: z - .18, width: .67, length: 1.38, shade: .57, wake: true }];
      return [];
    });
  }
  if (area === 'grove') {
    return props.grove.flatMap<Reflection>(prop => {
      const x = prop.x + .5, z = prop.y + .82;
      if ((prop.kind === 'pine' || prop.kind === 'oak') && x > 14 && x < 29 && z > 4 && z < 9) {
        return [{ x, z, width: .71, length: 3.7 + (prop.variant ?? 0) * .36, shade: .49 }];
      }
      if (prop.kind === 'rock' && x > 17 && x < 27 && z > 8 && z < 11) return [{ x, z, width: .47, length: .98, shade: .36 }];
      return [];
    });
  }
  return [];
}

function waterLookup(area: FieldArea, coast: Edge[], reach: number) {
  const w = 160, h = 112;
  const bytes = new Uint8Array(w * h * 4);
  const extentX = bounds.right - bounds.left;
  const extentZ = bounds.south - bounds.north;
  const segments = coast.map(({ from, to }) => {
    const dx = to[0] - from[0], dz = to[2] - from[2];
    return { x: from[0], z: from[2], dx, dz, inverseLengthSq: 1 / (dx * dx + dz * dz) };
  });
  const reflections = waterReflections(area);
  for (let i = 0; i < h; i++) {
    const z = bounds.north + (i + .5) / h * extentZ;
    for (let j = 0; j < w; j++) {
      const x = bounds.left + (j + .5) / w * extentX;
      let nearest = reach * reach;
      for (const edge of segments) {
        const dx = x - edge.x, dz = z - edge.z;
        if (Math.abs(dx) > reach + 1.3 || Math.abs(dz) > reach + 1.3) continue;
        const t = clamp((dx * edge.dx + dz * edge.dz) * edge.inverseLengthSq, 0, 1);
        nearest = Math.min(nearest, (dx - edge.dx * t) ** 2 + (dz - edge.dz * t) ** 2);
      }
      let shade = 0, lamp = 0, wake = 0;
      for (const mark of reflections) {
        const dx = x - mark.x, dz = z - mark.z;
        const dist = (dx * .26 + dz * .966) / mark.length;
        const side = (dx * .966 - dz * .26) / mark.width;
        if (dist < -.21 || dist >= 1.0 || Math.abs(side) > 1.9) continue;
        const fall = clamp((dist + .21) * 5, 0, 1) * (1 - Math.max(0, dist)) ** 1.35;
        const silhouette = Math.exp(-side * side * (1.55 - dist * .65)) * fall;
        shade = Math.max(shade, silhouette * mark.shade);
        if (mark.lamp) lamp = Math.max(lamp, silhouette * clamp((dist - .12) * 3, 0, 1));
        if (mark.wake) wake = Math.max(wake, Math.exp(-(((Math.abs(side) - .94) * 3.3) ** 2)) * fall * .82);
      }
      const offset = (i * w + j) * 4;
      bytes[offset] = Math.round(Math.sqrt(nearest) / reach * 255);
      bytes[offset + 1] = Math.round(shade * 255);
      bytes[offset + 2] = Math.round(lamp * 255);
      bytes[offset + 3] = Math.round(wake * 255);
    }
  }
  const texture = new THREE.DataTexture(bytes, w, h, THREE.RGBAFormat);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function makeWater(area: FieldArea, ground: ReturnType<typeof makeTerrain>, seconds: { value: number }, night: { value: number }) {
  const depth = waterLookup(area, ground.coast, area === 'grove' ? 2.4 : 5.8);
  const extent = new THREE.Vector4(bounds.left, bounds.north, bounds.right - bounds.left, bounds.south - bounds.north);
  const shoreProfile: [number, number, number] = area === 'harbor' ? [1.0, 1.0, 1.0] : area === 'grove' ? [.42, .66, .71] : [.62, .62, .78];
  const material = new THREE.ShaderMaterial({
    fog: true, transparent: true, depthWrite: false,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), seconds, night, harbor: { value: area === 'harbor' ? 1 : 0 }, depthMap: { value: depth }, extent: { value: extent },
      shoreProfile: { value: new THREE.Vector3(...shoreProfile) },
      deep: { value: ground.colors.deep }, aqua: { value: ground.colors.aqua }, shallow: { value: ground.colors.shallow }, foam: { value: ground.colors.foam } },
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec3 seaPoint;
      void main() {
        seaPoint = (modelMatrix * vec4(position, 1.0)).xyz;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform sampler2D depthMap;
      uniform vec4 extent;
      uniform float seconds;
      uniform float night;
      uniform float harbor;
      uniform vec3 shoreProfile;
      uniform vec3 deep;
      uniform vec3 aqua;
      uniform vec3 shallow;
      uniform vec3 foam;
      varying vec3 seaPoint;
      void main() {
        vec2 p = seaPoint.xz;
        vec2 uv = (p - extent.xy) / extent.zw;
        float within = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
        float ground = mix(1.0, texture2D(depthMap, uv).r, within);

        // Combine several wave normals so the reflections follow the water surface.
        vec2 swellAxis = vec2(.79, -1.77);
        vec2 rippleAxis = vec2(.41, -5.86);
        vec2 chopAxis = vec2(-3.24, 9.36);
        vec2 fineAxis = vec2(6.72, 18.31);
        float swell = dot(swellAxis, p) - seconds * 1.08 + sin(p.y * .46 + p.x * .61) * .71;
        float ripple = dot(rippleAxis, p) + seconds * 1.91 + sin(p.x * 2.19 + p.y * .38) * .74;
        float chop = dot(chopAxis, p) - seconds * 2.67 + sin(p.x * 3.73 + p.y * .23) * .48;
        float fine = dot(fineAxis, p) + seconds * 3.16 + sin(p.x * 1.38 - p.y * .58) * 1.7;
        vec2 slope = (cos(swell) * swellAxis * .028 + cos(ripple) * rippleAxis * .013
          + cos(chop) * chopAxis * .005 + cos(fine) * fineAxis * .002) * shoreProfile.x;
        vec3 reflection = texture2D(depthMap, uv - slope * vec2(3.8, 1.7) / extent.zw).gba * within;
        vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));
        vec3 view = normalize(cameraPosition - seaPoint);
        float reflectance = pow(clamp(1.0 - dot(normal, view), 0.0, 1.0), 3.0);
        vec3 sun = normalize(vec3(-.46, .88, -.27));
        float glimmer = pow(clamp(dot(normal, normalize(sun + view)), 0.0, 1.0), 86.0);
        float directionalLight = clamp(dot(normal, sun), 0.0, 1.0);

        vec3 color = mix(aqua, deep, smoothstep(.14, .88, ground));
        color = mix(shallow, color, smoothstep(.005, .27, ground));
        color *= .90 + directionalLight * .13 + sin(swell) * .025 + sin(ripple) * .015;
        float dockShadow = 1.0 - smoothstep(0.0, .46, max(abs(p.x - 4.12) - 3.0, abs(p.y - 12.78) - 1.55));
        float bridgeShadow = 1.0 - smoothstep(0.0, .40, max(abs(p.x - 36.2) - 2.05, abs(p.y - 12.76) - 1.56));
        color *= 1.0 - harbor * max(dockShadow, bridgeShadow) * .19;
        color *= 1.0 - reflection.x * (.25 + .14 * sin(ripple));
        color = mix(color, foam * .58, reflectance * .18 + glimmer * .063);

        float surge = .033 + sin(swell) * .012 + sin(ripple) * .003;
        float foamBreak = .46 + .54 * smoothstep(-.45, .83, sin(p.y * 3.2 + p.x * 3.5 + sin(chop) * .39));
        float foamLine = (1.0 - smoothstep(.003, .021, abs(ground - surge))) * foamBreak * shoreProfile.y;
        float wake = (1.0 - smoothstep(.009, .032, abs(ground - surge - .043))) * smoothstep(-.3, .80, sin(ripple)) * .40;
        vec3 evening = color * vec3(.29, .48, .66) + vec3(.012, .020, .039);
        color = mix(color, evening, night);
        vec3 glint = mix(foam, vec3(.21, .39, .53), night);
        color = mix(color, glint, clamp(foamLine * .40 + wake * .20 * shoreProfile.z + reflection.z * glimmer * .10, 0.0, .45));
        color += vec3(.31, .15, .056) * reflection.y * night * (.29 + .24 * sin(ripple + chop * .18));
        float alpha = mix(.73, 1.0, smoothstep(.075, .54, ground));
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const size = area === 'grove' ? 86 : 250;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  water.name = area === 'grove' ? 'Rippling forest pond' : 'Tidal water';
  water.rotation.x = -Math.PI / 2;
  water.position.set(width / 2, sea[area], height / 2);
  water.renderOrder = -1;
  return water;
}

export function buildFieldTerrain(area: FieldArea): { group: THREE.Group; update: (time: number, night: number) => void } {
  const group = new THREE.Group();
  group.name = `Terrain · ${area}`;
  const ground = makeTerrain(area);
  const clock = { value: 0 };
  const night = { value: 0 };
  const add = (mesh?: THREE.Mesh) => { if (mesh) group.add(mesh); };
  const surface = stoneMaterial();
  const edges = stoneMaterial(THREE.DoubleSide);
  add(ground.tops.mesh(surface, 'Terrain surface'));
  add(ground.walls.mesh(edges, 'Layered limestone and shore cliffs', true));
  add(ground.bed.mesh(surface, 'Shallow seabed'));
  const paving = new Surface();
  pave(paving, area, ground);
  add(paving.mesh(surface, 'Paving, gravel and beach grain'));
  add(meadow(area, ground.colors, clock));
  if (area === 'harbor') {
    const { docks, bridge } = harborWorks();
    add(docks.mesh(edges, 'Timber landing and mooring ropes', true));
    add(bridge.mesh(edges, 'Arched limestone causeway', true));
  }
  add(makeWater(area, ground, clock, night));
  return {
    group,
    update(time, darkness) {
      clock.value = time / 1000;
      night.value = clamp(darkness, 0, 1);
    },
  };
}
