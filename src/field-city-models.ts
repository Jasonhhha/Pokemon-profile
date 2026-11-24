import {
  BoxGeometry, BufferGeometry, CanvasTexture, Color, CylinderGeometry, DoubleSide, ExtrudeGeometry,
  Float32BufferAttribute, Group, Matrix4, Mesh, MeshStandardMaterial, PlaneGeometry, RepeatWrapping,
  Quaternion, Shape, SRGBColorSpace, Vector3, type ColorRepresentation,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cityParcels, type CityParcel } from './field-city-layout';

type XYZ = [x: number, y: number, z: number];
type Finish = 'stone' | 'ashlar' | 'brick' | 'stucco' | 'slate' | 'metal' | 'glass' | 'light' | 'skylight' | 'wood';

const surfaces: Record<Finish, MeshStandardMaterial> = {
  stone: new MeshStandardMaterial({ vertexColors: true, roughness: .87 }),
  ashlar: new MeshStandardMaterial({ vertexColors: true, roughness: .91 }),
  brick: new MeshStandardMaterial({ vertexColors: true, roughness: .96 }),
  stucco: new MeshStandardMaterial({ vertexColors: true, roughness: .93 }),
  slate: new MeshStandardMaterial({ vertexColors: true, roughness: .81, side: DoubleSide }),
  metal: new MeshStandardMaterial({ vertexColors: true, roughness: .57, metalness: .24, side: DoubleSide }),
  glass: new MeshStandardMaterial({ vertexColors: true, roughness: .30, metalness: .16 }),
  light: new MeshStandardMaterial({
    vertexColors: true, roughness: .34, emissive: 0xdb9e64, emissiveIntensity: 0,
  }),
  skylight: new MeshStandardMaterial({
    vertexColors: true, roughness: .38, metalness: .08, emissive: 0xddac75, emissiveIntensity: 0,
  }),
  wood: new MeshStandardMaterial({ vertexColors: true, roughness: .82 }),
};

const limestone = 0xe5cfab;
const paleStone = 0xf0dfc3;
const agedStone = 0xc8af91;
const mortar = 0xaf9b85;
const concrete = 0xa7a496;
const ink = 0x2d414c;
const slate = 0x405961;
const blueGlass = 0x6e9c9b;
const copper = 0xaf7353;
const gold = 0xceaa6c;
const brightGold = 0xe1bc76;
const warmGlass = 0xaa9d77;
const brass = 0x877553;
const redBrick = 0x9c634d;
const darkBrick = 0x774c40;
const teal = 0x4b7772;
const ivory = 0xe3dfca;
const clay = 0xa25d42;
const brownStock = 0xa27659;
const buffStock = 0xbc9671;
const bottle = 0x325348;
const welshSlate = 0x485866;
const oldSlate = 0x515d65;
const castIron = 0x374749;

const unitCube = new BoxGeometry(1, 1, 1);
const cylinder = new CylinderGeometry(1, 1, 1, 12, 1);
const archShape = new Shape().moveTo(-.5, 0).lineTo(.5, 0).lineTo(.5, .66)
  .bezierCurveTo(.50, .90, .248, 1.0, 0, 1).bezierCurveTo(-.248, 1, -.50, .90, -.50, .66).closePath();
const arch = new ExtrudeGeometry(archShape, { depth: 1, bevelEnabled: false, curveSegments: 5 });
const bevelOutline = new Shape().moveTo(-.466, -.466).lineTo(.466, -.466).lineTo(.466, .466).lineTo(-.466, .466).closePath();
const carvedBox = new ExtrudeGeometry(bevelOutline, { depth: .932, bevelThickness: .034, bevelSize: .034, bevelSegments: 1, steps: 1 });
carvedBox.translate(0, 0, -.466);
const axisY = new Vector3(0, 1, 0);
const modelRotation = new Quaternion();
const transformation = new Matrix4();
const move = new Vector3();
const scale = new Vector3();
const localAxis = new Vector3();

function rand(x: number, z: number, salt = 0) {
  const value = Math.imul(x + 87 + salt, 7109891) ^ Math.imul(z + 31, 2156123);
  return ((Math.imul(value ^ (value >>> 11), 513481) >>> 0) % 4096) / 4096;
}

const finishes: Partial<Record<Finish, { density: number; rough: number }>> = {
  stone: { density: 1.22, rough: .95 },
  ashlar: { density: .87, rough: .98 },
  brick: { density: 1.12, rough: .90 },
  stucco: { density: .72, rough: 1.30 },
  slate: { density: .98, rough: .82 },
  metal: { density: .88, rough: .63 },
  wood: { density: 1.08, rough: 1.03 },
};

function quarriedPattern(finish: 'ashlar' | 'brick' | 'slate', x: number, y: number, size: number) {
  const brick = finish === 'brick';
  const ashlar = finish === 'ashlar';
  const rows = ashlar ? 4 : brick ? 7 : 8;
  const columns = ashlar ? 2 : brick ? 3 : 5;
  const v = y / size * rows;
  const course = Math.floor(v);
  const stagger = course % 2 ? .5 : 0;
  const u = x / size * columns + stagger;
  const joint = Math.floor(u);
  const run = u - joint;
  const rise = v - course;
  const localStone = rand(joint % columns, course, brick ? 61 : ashlar ? 80 : 81);
  const seam = ashlar ? .041 : brick ? .042 : .033;
  if (rise < seam || run < seam * .72) return brick ? 233 : ashlar ? 184 : 169;
  const edge = rise < seam + .045 || run < seam + .029 ? 10 : rise > .908 ? -14 : 0;
  const contour = Math.sin(rise * Math.PI) * (ashlar ? 8 : 3);
  return (brick ? 194 : 209) + localStone * (brick ? 41 : 31) + edge + contour;
}

function cityFinish(finish: Finish, geometry: BufferGeometry) {
  const recipe = finishes[finish];
  if (!recipe || typeof document === 'undefined') {
    geometry.deleteAttribute('uv');
    return;
  }
  const material = surfaces[finish];
  if (!material.map) {
    const image = document.createElement('canvas');
    const size = 192;
    image.width = image.height = size;
    const ctx = image.getContext('2d')!;
    const sample = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const phaseX = x / size * 2 * Math.PI;
      const phaseY = y / size * 2 * Math.PI;
      const fleck = rand(x, y, 11) - .5;
      const wash = Math.sin(phaseX * 2 + phaseY * 3) * 4 + Math.sin(phaseX * 5 - phaseY * 2) * 2.7;
      const materialGrain = finish === 'wood' ? Math.sin(phaseY * 24 + Math.sin(phaseX * 2)) * 5.7 : finish === 'metal' ? Math.sin(phaseY * 13 + phaseX) * 3 : 0;
      const masonry = finish === 'brick' || finish === 'ashlar' || finish === 'slate';
      const base = masonry ? quarriedPattern(finish, x, y, size) : finish === 'stucco' ? 236 : 244;
      const erosion = Math.sin(phaseX * 12 + Math.sin(phaseY) * .8) * Math.sin(phaseY * 3) * (masonry ? 3.2 : finish === 'stucco' ? 6.7 : 2);
      const shade = base + (wash + materialGrain + erosion + fleck * 14 - (fleck < -.47 ? 14 : 0)) * recipe.rough;
      const index = (y * size + x) * 4;
      sample.data[index] = shade + (finish === 'brick' ? wash * .31 + erosion : 0);
      sample.data[index + 1] = shade;
      sample.data[index + 2] = shade - (finish === 'brick' ? wash * .37 + erosion : 0);
      sample.data[index + 3] = 255;
    }
    ctx.putImageData(sample, 0, 0);
    const map = new CanvasTexture(image);
    map.colorSpace = SRGBColorSpace;
    map.wrapS = map.wrapT = RepeatWrapping;
    map.anisotropy = 4;
    material.map = map;
    material.needsUpdate = true;
  }
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const x = Math.abs(normal.getX(i));
    const y = Math.abs(normal.getY(i));
    const z = Math.abs(normal.getZ(i));
    const top = y >= x && y >= z;
    uv[i * 2] = (top || z >= x ? position.getX(i) : position.getZ(i)) * recipe.density;
    uv[i * 2 + 1] = (top ? position.getZ(i) : position.getY(i)) * recipe.density;
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
}

class StructureKit {
  private bins = new Map<Finish, BufferGeometry[]>();

  constructor(readonly group = new Group()) {}

  private prepare(finish: Finish, geometry: BufferGeometry, tint: ColorRepresentation, pos: XYZ, dims: XYZ, orientation: Quaternion) {
    const instance = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    transformation.compose(move.set(...pos), orientation, scale.set(...dims));
    instance.applyMatrix4(transformation);
    cityFinish(finish, instance);
    const color = new Color(tint);
    const position = instance.getAttribute('position');
    const colors = new Float32Array(position.count * 3);
    for (let index = 0; index < position.count; index++) {
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }
    instance.setAttribute('color', new Float32BufferAttribute(colors, 3));
    const list = this.bins.get(finish) ?? [];
    list.push(instance);
    this.bins.set(finish, list);
  }

  piece(finish: Finish, tint: ColorRepresentation, geometry: BufferGeometry, pos: XYZ, dims: XYZ, yaw = 0) {
    this.prepare(finish, geometry, tint, pos, dims, modelRotation.setFromAxisAngle(axisY, yaw));
  }

  block(finish: Finish, tint: ColorRepresentation, pos: XYZ, dims: XYZ, beveled = false, yaw = 0) {
    this.piece(finish, tint, beveled ? carvedBox : unitCube, pos, dims, yaw);
  }

  beam(finish: Finish, tint: ColorRepresentation, a: XYZ, b: XYZ, thick: number, round = false) {
    const length = localAxis.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).length();
    if (length < 1e-5) return;
    const middle: XYZ = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    this.prepare(finish, round ? cylinder : unitCube, tint, middle, [thick, length, thick], modelRotation.setFromUnitVectors(axisY, localAxis.normalize()));
  }

  panel(finish: Finish, tint: ColorRepresentation, polygon: readonly XYZ[]) {
    const geometry = new BufferGeometry();
    const coords: number[] = [];
    for (let i = 1; i < polygon.length - 1; i++) coords.push(...polygon[0], ...polygon[i], ...polygon[i + 1]);
    geometry.setAttribute('position', new Float32BufferAttribute(coords, 3));
    geometry.computeVertexNormals();
    this.piece(finish, tint, geometry, [0, 0, 0], [1, 1, 1]);
    geometry.dispose();
  }

  finish() {
    for (const [key, geometries] of this.bins) {
      const merged = mergeGeometries(geometries);
      geometries.forEach(geometry => geometry.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new Mesh(merged, surfaces[key]);
      mesh.castShadow = key !== 'light' && key !== 'skylight';
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
    this.bins.clear();
    return this.group;
  }
}

type Pierce = { left: number; right: number; bottom: number; top: number };
type Masonry = { finish: 'ashlar' | 'brick' | 'stucco'; material: number };
type Wall = { point: (x: number, y: number, inset: number) => XYZ; yaw: number; openings?: Pierce[]; masonry?: Masonry };

function wall(x: number, z: number, yaw = 0, masonry?: Masonry): Wall {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return { yaw, masonry, openings: masonry ? [] : undefined,
    point: (offset, y, inset) => [x + offset * cos + inset * sin, y, z - offset * sin + inset * cos] };
}

function facadePanel(kit: StructureKit, mount: Wall, left: number, right: number, bottom: number, top: number, depth: number, finish: Finish, color: ColorRepresentation) {
  if (right - left < .0005 || top - bottom < .0005) return;
  kit.panel(finish, color, [mount.point(left, bottom, depth), mount.point(right, bottom, depth),
    mount.point(right, top, depth), mount.point(left, top, depth)]);
}

function piercedWall(kit: StructureKit, mount: Wall, width: number, base: number, height: number, depth: number, finish: Finish, color: ColorRepresentation) {
  const openings = mount.openings?.filter(opening => opening.bottom < height && opening.top > base) ?? [];
  const levels = [...new Set([base, height, ...openings.flatMap(opening => [Math.max(opening.bottom, base), Math.min(opening.top, height)])])].sort((a, b) => a - b);
  for (let i = 0; i < levels.length - 1; i++) {
    const bottom = levels[i], top = levels[i + 1];
    const cuts = openings.filter(opening => opening.bottom <= bottom && opening.top >= top).sort((a, b) => a.left - b.left);
    let cursor = -width / 2;
    for (const cut of cuts) {
      facadePanel(kit, mount, cursor, Math.min(cut.left, width / 2), bottom, top, depth, finish, color);
      cursor = Math.max(cut.right, cursor);
    }
    facadePanel(kit, mount, cursor, width / 2, bottom, top, depth, finish, color);
  }
}

function civicReveal(kit: StructureKit, mount: Wall, x: number, y: number, w: number, h: number, curved: boolean, paint: number) {
  const depth = mount.openings ? -.232 : .056;
  const rim = mount.openings ? .093 : .202;
  const span = w * .50;
  const frame = w * .436;
  const spring = y + (curved ? h * .646 : h);
  const top = y + h;
  const stone = new Color(paint);
  mount.openings?.push({ left: x - span, right: x + span, bottom: y, top });
  const direction = [-1, 1] as const;
  for (const side of direction) {
    const face = x + span * side;
    const jambEdge = x + frame * side;
    const shape = [mount.point(face, y, rim), mount.point(face, spring, rim),
      mount.point(jambEdge, spring - .033, depth), mount.point(jambEdge, y + .022, depth)];
    kit.panel('stone', stone.clone().multiplyScalar(side === -1 ? .66 : .79), side === -1 ? shape : shape.reverse());
    kit.block('stone', paint, mount.point(face, (spring + y) / 2, rim - .028), [.051, spring - y, .087], true, mount.yaw);
  }
  kit.panel('stone', stone.clone().multiplyScalar(.81), [mount.point(x - span, y, rim), mount.point(x + span, y, rim),
    mount.point(x + frame, y + .022, depth), mount.point(x - frame, y + .022, depth)]);
  if (!curved) {
    kit.panel('stone', stone.clone().multiplyScalar(.69), [mount.point(x - span, top, rim), mount.point(x - frame, top - .033, depth),
      mount.point(x + frame, top - .033, depth), mount.point(x + span, top, rim)]);
  } else {
    const radius = h * .354;
    const arc = (angle: number, width: number, arcRise: number, at: number) => mount.point(x + Math.cos(angle) * width, spring + Math.sin(angle) * arcRise, at);
    for (let index = 0; index < 10; index++) {
      const from = index * Math.PI / 10, to = (index + 1) * Math.PI / 10;
      const lipA = arc(from, span, radius, rim), lipB = arc(to, span, radius, rim);
      kit.panel('stone', stone.clone().multiplyScalar(.66 + index * .013), [lipA, lipB,
        arc(to, frame, radius - .026, depth), arc(from, frame, radius - .026, depth)]);
      if (mount.masonry) {
        const a = arc(from, span, radius, 0), b = arc(to, span, radius, 0);
        kit.panel(mount.masonry.finish, mount.masonry.material, [a, mount.point(x + Math.cos(from) * span, top, 0),
          mount.point(x + Math.cos(to) * span, top, 0), b]);
      }
    }
  }
  return { depth, rim, frame, spring, top };
}

function windowBay(kit: StructureKit, mount: Wall, x: number, y: number, w: number, h: number,
  style: 'arch' | 'sash' | 'band', lit = false, glazingOffset = 0) {
  const curved = style === 'arch';
  const stone = style === 'band' ? 0x778381 : limestone;
  const reveal = civicReveal(kit, mount, x, y, w, h, curved, stone);
  const { depth, rim, frame, spring, top } = reveal;
  const finish: Finish = lit ? 'light' : 'glass';
  const glow = lit ? warmGlass : blueGlass;
  const glazing = depth + .026 + (mount.openings ? glazingOffset * .36 : glazingOffset * .27);
  const panelWidth = frame * 2;
  const trim = style === 'sash' ? 0xd5c4a1 : 0x566261;
  facadePanel(kit, mount, x - frame, x + frame, y + .022, spring - .026, glazing, finish, glow);
  facadePanel(kit, mount, x - frame, x + frame, y + .023, y + h * .225, glazing + .006, finish,
    new Color(glow).multiplyScalar(lit ? .79 : .63));
  if (curved) {
    const height = h * .354 - .014;
    const arc = (angle: number) => mount.point(x + Math.cos(angle) * frame, spring + Math.sin(angle) * height - .027, glazing);
    for (let i = 0; i < 10; i++) {
      kit.panel(finish, glow, [mount.point(x, spring - .036, glazing + .002), arc(i * Math.PI / 10), arc((i + 1) * Math.PI / 10)]);
    }
  }
  const bars = glazing + .036;
  for (const offset of [-frame + .015, frame - .015]) {
    kit.block('metal', trim, mount.point(x + offset, (y + spring) / 2, bars), [.029, spring - y - .048, .041], false, mount.yaw);
  }
  kit.block('metal', trim, mount.point(x, y + h * (curved ? .635 : .475), bars), [panelWidth, .032, .041], false, mount.yaw);
  if (style === 'sash') {
    kit.block('wood', trim, mount.point(x, y + h * .51, bars), [.024, h - .049, .041], false, mount.yaw);
    if (w > .63) kit.block('wood', trim, mount.point(x, y + h * .736, bars), [panelWidth, .018, .037], false, mount.yaw);
    kit.block('stone', paleStone, mount.point(x, top + .030, rim - .027), [w + .128, .081, .137], true, mount.yaw);
  } else {
    kit.block('metal', trim, mount.point(x, y + h * .451, bars), [.025, h * .836, .042], false, mount.yaw);
  }
  if (!lit) {
    kit.panel('glass', 0x88978c, [mount.point(x - frame, y + h * .51, glazing + .010), mount.point(x + frame, y + h * .31, glazing + .010),
      mount.point(x + frame, y + h * .37, glazing + .010), mount.point(x - frame, y + h * .57, glazing + .010)]);
  } else if (style !== 'band') {
    for (const sign of [-1, 1]) {
      kit.block('wood', 0xbba17d, mount.point(x + sign * frame * .77, (spring + y) / 2, glazing + .014),
        [panelWidth * .19, spring - y - .051, .012], false, mount.yaw);
    }
  }
  if (style !== 'band') {
    kit.block('stone', paleStone, mount.point(x, y - .042, rim - .046), [w + .146, .089, .228], true, mount.yaw);
    for (const offset of [-.28, .28]) kit.block('stone', agedStone, mount.point(x + offset * w, y - .104, rim - .051), [.074, .087, .135], true, mount.yaw);
  }
}

function portal(kit: StructureKit, mount: Wall, x: number, w: number, h: number, rectangular = false) {
  const reveal = civicReveal(kit, mount, x, .153, w, h - .153, !rectangular, limestone);
  const { depth, rim, frame, spring } = reveal;
  const glazing = depth + .036;
  const bars = glazing + .035;
  const leafHead = Math.min(h * .735, spring - .089);
  facadePanel(kit, mount, x - frame, x + frame, .161, spring - .015, depth + .009, 'glass', 0x4d6263);
  facadePanel(kit, mount, x - frame, x + frame, .202, leafHead - .066, glazing, 'glass', 0x537879);
  if (!rectangular) {
    const upper = mount.point(x, spring, depth + .012);
    for (let i = 0; i < 10; i++) {
      const arc = (a: number) => mount.point(x + Math.cos(a) * frame, spring + Math.sin(a) * (h - spring - .023), depth + .012);
      kit.panel('glass', 0x6c837a, [upper, arc(i * Math.PI / 10), arc((i + 1) * Math.PI / 10)]);
    }
    for (const ray of [-1, -.48, .48, 1]) {
      kit.beam('metal', bottle, mount.point(x, spring - .006, bars), mount.point(x + ray * frame * .96, spring + (h - spring) * (1 - Math.abs(ray) * .82), bars), .026);
    }
    const arch = (angle: number, offset: number, projection: number) => mount.point(
      x + Math.cos(angle) * (w / 2 + offset), spring + Math.sin(angle) * (h - spring + offset), projection,
    );
    for (let i = 0; i < 11; i++) {
      const a = i * Math.PI / 11 + .012, b = (i + 1) * Math.PI / 11 - .012;
      const outer = i === 5 ? .135 : .101;
      const face = rim + (i === 5 ? .114 : .062);
      kit.panel('stone', i === 5 ? paleStone : limestone, [arch(a, outer, face), arch(b, outer, face), arch(b, .002, rim + .024), arch(a, .002, rim + .024)]);
      kit.panel('stone', agedStone, [arch(a, .002, rim + .024), arch(b, .002, rim + .024), arch(b, -.011, rim), arch(a, -.011, rim)]);
    }
  }
  kit.block('metal', bottle, mount.point(x, (leafHead + .171) / 2, bars), [.056, leafHead - .171, .071], true, mount.yaw);
  for (const y of [leafHead, spring - .052]) {
    kit.block('metal', bottle, mount.point(x, y, bars), [frame * 2, .052, .068], false, mount.yaw);
  }
  for (const offset of [-.5, .5]) {
    kit.block('stone', paleStone, mount.point(x + w * offset, h * .407, rim - .048), [.082, h * .61, .144], true, mount.yaw);
  }
  if (rectangular) kit.block('stone', paleStone, mount.point(x, h + .012, rim - .020), [w + .228, .127, .213], true, mount.yaw);
  for (const side of [-1, 1]) {
    const center = x + side * frame * .515;
    kit.block('wood', bottle, mount.point(center, .366, bars), [frame * .951, .414, .056], true, mount.yaw);
    kit.block('wood', 0x496254, mount.point(center, .369, bars + .033), [frame * .66, .274, .024], true, mount.yaw);
    kit.block('metal', brightGold, mount.point(x + side * w * .105, .665, bars + .041), [.023, .124, .036], true, mount.yaw);
  }
  kit.block('stone', concrete, mount.point(x, .043, .186), [w + .39, .086, .605], true, mount.yaw);
  kit.block('stone', agedStone, mount.point(x, .114, .024), [w + .24, .126, .666], true, mount.yaw);
}

function pilaster(kit: StructureKit, mount: Wall, x: number, h: number, tint = limestone, spread = .19) {
  kit.block('stone', tint, mount.point(x, h / 2, .08), [spread, h, .18], true, mount.yaw);
  kit.block('stone', agedStone, mount.point(x, .15, .118), [spread + .082, .275, .20], true, mount.yaw);
  kit.block('stone', paleStone, mount.point(x, h - .10, .11), [spread + .09, .15, .21], true, mount.yaw);
  for (const delta of [-.050, 0, .05]) {
    kit.block('stone', paleStone, mount.point(x + delta, h * .55, .171), [.018, h * .64, .023], false, mount.yaw);
  }
}

function pilasterPedestal(kit: StructureKit, mount: Wall, x: number, top: number) {
  kit.block('stone', agedStone, mount.point(x, .258, .128), [.298, .36, .267], true, mount.yaw);
  kit.block('stone', limestone, mount.point(x, .405, .149), [.304, .076, .312], true, mount.yaw);
  kit.block('stone', paleStone, mount.point(x, top - .183, .203), [.235, .068, .259], true, mount.yaw);
  kit.block('stone', agedStone, mount.point(x, top - .111, .189), [.276, .098, .288], true, mount.yaw);
  kit.block('stone', paleStone, mount.point(x, top - .034, .177), [.316, .072, .307], true, mount.yaw);
  for (const offset of [-.079, .079]) {
    kit.piece('stone', agedStone, cylinder, mount.point(x + offset, top - .129, .337), [.035, .094, .033], mount.yaw);
  }
}

const plaques = new Map<string, MeshStandardMaterial>();

function signage(kit: StructureKit, mount: Wall, text: string, x: number, y: number, w: number, h: number, theme: 'bronze' | 'navy' = 'bronze') {
  const edge = theme === 'bronze' ? copper : slate;
  kit.block('metal', edge, mount.point(x, y, .083), [w + .032, h + .061, .105], true, mount.yaw);
  if (typeof document === 'undefined') return;
  const key = text + theme;
  let material = plaques.get(key);
  if (!material) {
    const image = document.createElement('canvas');
    image.width = 512;
    image.height = 128;
    const ctx = image.getContext('2d')!;
    ctx.fillStyle = theme === 'bronze' ? '#634435' : '#304c55';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#d7a56d';
    ctx.lineWidth = 3.5;
    ctx.strokeRect(10, 9, 492, 110);
    ctx.strokeStyle = '#95795b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(18, 16, 476, 96);
    ctx.font = `650 ${text.length > 4 ? 75 : 88}px "PingFang SC", "Microsoft Yahei", system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#efcea0';
    ctx.fillText(text, 256, 64, 446);
    const map = new CanvasTexture(image);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 3;
    material = new MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xcd985e, emissiveIntensity: 0, roughness: .74 });
    plaques.set(key, material);
  }
  const sign = new Mesh(new PlaneGeometry(w, h), material);
  sign.rotation.y = mount.yaw;
  sign.position.set(...mount.point(x, y, .142));
  kit.group.add(sign);
}

function placedSign(kit: StructureKit, mount: Wall, y: number, text: string, w = 1.85, theme: 'bronze' | 'navy' = 'bronze') {
  signage(kit, mount, text, 0, y, w, .356, theme);
}

function plaqueBadge(kit: StructureKit, mount: Wall, y: number, radiate = true) {
  const at = mount.point(0, y, .152);
  kit.beam('metal', copper, mount.point(0, y, .069), at, .223, true);
  kit.beam('metal', gold, at, mount.point(0, y, .187), .187, true);
  kit.beam('metal', ink, at, mount.point(0, y, .199), .151, true);
  if (radiate) {
    for (let ray = 0; ray < 8; ray++) {
      const a = ray * Math.PI / 4;
      const far = ray % 2 ? .105 : .13;
      kit.beam('metal', brightGold, mount.point(Math.cos(a) * .034, y + Math.sin(a) * .034, .202), mount.point(Math.cos(a) * far, y + Math.sin(a) * far, .202), .018);
    }
  } else {
    kit.block('metal', 0xc76952, mount.point(0, y, .202), [.047, .189, .017]);
    kit.block('metal', 0xc76952, mount.point(0, y, .204), [.189, .045, .019]);
  }
}

function slab(kit: StructureKit, x: number, z: number, y: number, w: number, d: number, color = agedStone) {
  kit.block('stone', color, [x, y, z], [w, .138, d], true);
  kit.block('stone', paleStone, [x, y + .069, z], [w + .024, .041, d + .024], true);
}

type Lot = { parcel: CityParcel; x: number; z: number; front: number; rear: number; w: number; d: number; h: number;
  facade: Wall; side: Wall; innerWall: Wall; westWall: Wall; shell?: Masonry };

const civicMasonry: Partial<Record<CityParcel['kind'], Masonry>> = {
  archive: { finish: 'ashlar', material: 0xcbb086 },
  clinic: { finish: 'brick', material: 0xa8735c },
  market: { finish: 'brick', material: 0x935541 },
  station: { finish: 'brick', material: 0x9c674e },
  office: { finish: 'ashlar', material: 0xc3b196 },
  hotel: { finish: 'stucco', material: 0xca8a50 },
};

function lotBounds(parcel: CityParcel): Lot {
  const w = parcel.width - .34;
  const d = parcel.depth - .31;
  const x = parcel.x + parcel.width / 2;
  const z = parcel.z + parcel.depth / 2;
  const shell = parcel.kind === 'apartment'
    ? { finish: 'brick' as const, material: parcel.finish < 2 ? buffStock : 0xa0674e }
    : parcel.kind === 'warehouse' ? { finish: 'brick' as const, material: parcel.stories === 1 ? 0x8f5945 : buffStock }
      : civicMasonry[parcel.kind];
  return {
    parcel, x, z, w, d, shell, front: z + d / 2, rear: z - d / 2,
    h: .76 + parcel.stories * 1.05,
    facade: wall(x, z + d / 2, 0, shell),
    side: wall(x + w / 2, z, Math.PI / 2, shell),
    innerWall: wall(x, z - d / 2, Math.PI, shell),
    westWall: wall(x - w / 2, z, -Math.PI / 2, shell),
  };
}

function civicShell(kit: StructureKit, lot: Lot, masonry: Masonry, height: number) {
  const { facade, innerWall, side, westWall, w, d } = lot;
  for (const [mount, width, shade] of [[facade, w, 1], [innerWall, w, .96], [side, d, .98], [westWall, d, .92]] as const) {
    const base = new Color(masonry.material).multiplyScalar(shade);
    piercedWall(kit, mount, width, 0, height, 0, masonry.finish, base);
    if (masonry.finish === 'brick') continue;
    const courses = lot.parcel.kind === 'office' ? 10 : 6;
    const plinth = masonry.finish === 'stucco' ? new Color(0xc5a484).multiplyScalar(shade) : base;
    for (let course = 0; course < courses; course++) {
      const lower = .227 + course * .229;
      const color = plinth.clone().multiplyScalar(course % 2 ? .92 : .97);
      piercedWall(kit, mount, width - .055, lower + .013, lower + .196, .024, 'ashlar', color);
      piercedWall(kit, mount, width - .080, lower + .196, lower + .213, .019, 'stone', plinth.clone().multiplyScalar(1.09));
    }
  }
}

function foundation(kit: StructureKit, lot: Lot, finish = concrete) {
  kit.block('stone', finish, [lot.x, .083, lot.z], [lot.w + .09, .166, lot.d + .09], true);
  kit.block('stone', agedStone, [lot.x, .167, lot.z], [lot.w + .036, .080, lot.d + .049], true);
}

function stringCourse(kit: StructureKit, lot: Lot, y: number, tint = agedStone) {
  kit.block('stone', tint, [lot.x, y, lot.z], [lot.w + .085, .079, lot.d + .079], true);
}

function streetCornice(kit: StructureKit, mount: Wall, width: number, y: number) {
  kit.block('stone', agedStone, mount.point(0, y - .089, .064), [width, .079, .16], true, mount.yaw);
  kit.block('stone', limestone, mount.point(0, y - .018, .107), [width + .058, .079, .244], true, mount.yaw);
  kit.block('stone', paleStone, mount.point(0, y + .041, .131), [width + .098, .055, .282], true, mount.yaw);
  const consoles = Math.round(width / .25);
  for (let i = 0; i < consoles; i++) {
    const x = (i - (consoles - 1) / 2) * .25;
    kit.block('stone', limestone, mount.point(x, y - .096, .156), [.076, .071, .145], true, mount.yaw);
  }
}

function dressedArch(kit: StructureKit, mount: Wall, x: number, y: number, width: number, height: number, lit = false) {
  windowBay(kit, mount, x, y, width, height, 'arch', lit, .039);
  const spring = y + height * .65;
  const point = (angle: number, outer: boolean, depth: number) => mount.point(
    x + Math.cos(angle) * (width * .50 + (outer ? .080 : .019)),
    spring + Math.sin(angle) * (height * .345 + (outer ? .085 : .026)), depth,
  );
  for (let i = 0; i < 9; i++) {
    const start = Math.PI * i / 9 + .017;
    const end = Math.PI * (i + 1) / 9 - .017;
    const depth = i === 4 ? .182 : .156;
    const outerStart = point(start, true, depth), outerEnd = point(end, true, depth);
    const innerStart = point(start, false, depth), innerEnd = point(end, false, depth);
    kit.panel('stone', i === 4 ? paleStone : limestone, [outerStart, outerEnd, innerEnd, innerStart]);
    kit.panel('stone', agedStone, [innerStart, innerEnd, point(end, false, .065), point(start, false, .065)]);
  }
}

function cantedSash(kit: StructureKit, mount: Wall, x: number, y: number, width: number, height: number, lit: boolean) {
  const outline = [[-.5, .024], [-.27, .207], [.27, .207], [.5, .024]] as const;
  const unit = ([u, depth]: readonly [number, number], elevation: number) => mount.point(x + u * width, elevation, depth);
  kit.panel('stone', paleStone, outline.map(point => unit(point, y + height)));
  kit.panel('stone', agedStone, [...outline].reverse().map(point => unit(point, y)));
  for (let i = 0; i < outline.length - 1; i++) {
    const a = outline[i], b = outline[i + 1];
    const run = (b[0] - a[0]) * width;
    const depth = b[1] - a[1];
    const span = Math.hypot(run, depth);
    const center = unit([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], y);
    const face = wall(center[0], center[2], mount.yaw - Math.atan2(depth, run));
    kit.panel('stone', limestone, [unit(a, y), unit(b, y), unit(b, y + height), unit(a, y + height)]);
    kit.block('metal', bottle, face.point(0, y + height * .51, .014), [span - .034, height - .13, .041], true, face.yaw);
    kit.block(lit ? 'light' : 'glass', lit ? warmGlass : blueGlass,
      face.point(0, y + height * .51, .043), [span - .084, height - .183, .017], false, face.yaw);
    for (const rail of [.29, .51, .73]) {
      kit.block('wood', ivory, face.point(0, y + height * rail, .055), [span - .080, rail === .51 ? .031 : .017, .024], false, face.yaw);
    }
    kit.block('wood', ivory, face.point(0, y + height * .51, .058), [.023, height - .183, .023], false, face.yaw);
    kit.block('stone', paleStone, face.point(0, y + height - .027, .032), [span + .024, .064, .099], true, face.yaw);
    kit.block('stone', paleStone, face.point(0, y + .018, .036), [span + .035, .079, .112], true, face.yaw);
  }
  for (const offset of [-.24, .24]) {
    kit.block('stone', agedStone, mount.point(x + width * offset, y - .061, .101), [.098, .138, .203], true, mount.yaw);
  }
}

function shopBlade(kit: StructureKit, mount: Wall, x: number, y: number, text: string, theme: 'bronze' | 'navy') {
  const at = mount.point(x, y, .37);
  kit.beam('metal', castIron, mount.point(x, y + .292, .062), mount.point(x, y + .292, .603), .035);
  kit.beam('metal', castIron, mount.point(x, y + .185, .093), mount.point(x, y + .290, .528), .028);
  kit.block('metal', theme === 'bronze' ? darkBrick : bottle, at, [.388, .414, .052], true, mount.yaw + Math.PI / 2);
  for (const depth of [.228, .517]) {
    kit.beam('metal', brass, mount.point(x, y + .288, depth), mount.point(x, y + .158, depth), .023, true);
  }
  for (const side of [-1, 1]) {
    const face = mount.point(x + side * .013, y, .366);
    signage(kit, wall(face[0], face[2], mount.yaw + side * Math.PI / 2), text, 0, y - .007, .315, .159, theme);
  }
}

function steppedCrown(kit: StructureKit, lot: Lot, y: number, color = stoneCrown) {
  const { x, z, w, d } = lot;
  slab(kit, x, z, y, w + .125, d + .124, color);
  kit.block('stone', color, [x, y + .19, z], [w - .18, .31, d - .20], true);
  kit.block('metal', slate, [x, y + .357, z], [w - .12, .055, d - .165], true);
  kit.block('metal', ink, [x, y + .382, z], [w - .40, .034, d - .401]);
}

const stoneCrown = 0xcdb89b;

function drainpipe(kit: StructureKit, mount: Wall, x: number, y: number) {
  kit.beam('metal', slate, mount.point(x, .27, .139), mount.point(x, y - .11, .139), .041, true);
  kit.beam('metal', slate, mount.point(x, .27, .139), mount.point(x + .09, .14, .199), .044, true);
  for (let row = 0; row < Math.floor(y); row++) {
    kit.block('metal', agedStone, mount.point(x, .53 + row, .094), [.105, .048, .092], false, mount.yaw);
  }
  kit.beam('metal', copper, mount.point(x, y - .16, .137), mount.point(x, y + .025, .050), .049, true);
}

function trimPanel(kit: StructureKit, mount: Wall, x: number, y: number, w: number, h: number, stoneColor: number) {
  kit.block('stone', stoneColor, mount.point(x, y, .033), [w, h, .085], true, mount.yaw);
  kit.block('stone', new Color(stoneColor).multiplyScalar(.88), mount.point(x, y, .074), [w * .78, h * .64, .035], true, mount.yaw);
  kit.block('stone', new Color(stoneColor).multiplyScalar(1.04), mount.point(x, y + .032, .096), [w * .71, h * .19, .021], false, mount.yaw);
}

function weatherVane(kit: StructureKit, x: number, y: number, z: number) {
  kit.block('stone', agedStone, [x, y - .044, z], [.37, .134, .35], true);
  kit.beam('metal', brass, [x, y - .018, z], [x, y + .49, z], .035, true);
  kit.beam('metal', brightGold, [x - .25, y + .35, z], [x + .27, y + .35, z], .026, true);
  kit.beam('metal', gold, [x, y + .30, z - .204], [x, y + .30, z + .204], .019, true);
  kit.panel('metal', brightGold, [[x + .20, y + .443, z], [x + .35, y + .35, z], [x + .20, y + .27, z]]);
  kit.panel('metal', copper, [[x - .27, y + .455, z], [x - .124, y + .397, z], [x - .124, y + .302, z], [x - .27, y + .258, z]]);
}

function tiledCap(kit: StructureKit, x: number, z: number, y: number, w: number, d: number, base: number, mass = .52) {
  const front = z + d / 2;
  const rear = z - d / 2;
  const eaves: XYZ[] = [[x - w / 2, y, front], [x + w / 2, y, front], [x + w / 2, y, rear], [x - w / 2, y, rear]];
  const r1: XYZ = [x - w * .30, y + mass, z];
  const r2: XYZ = [x + w * .30, y + mass, z];
  kit.panel('slate', base, [eaves[0], eaves[1], r2, r1]);
  kit.panel('slate', base, [eaves[2], eaves[3], r1, r2]);
  kit.panel('slate', new Color(base).multiplyScalar(.86), [eaves[1], eaves[2], r2]);
  kit.panel('slate', new Color(base).multiplyScalar(.92), [eaves[3], eaves[0], r1]);
  for (const ridge of [r1, r2]) {
    const sign = ridge === r1 ? -1 : 1;
    kit.beam('metal', ink, [x + sign * w * .5, y, front], ridge, .050, true);
    kit.beam('metal', ink, [x + sign * w * .5, y, rear], ridge, .049, true);
  }
  kit.beam('metal', slate, r1, r2, .059, true);
  for (let i = 0; i < eaves.length; i++) kit.beam('metal', ink, eaves[i], eaves[(i + 1) % eaves.length], .067);
  for (const face of [front, rear]) for (let rail = 1; rail < 9; rail++) {
    const t = rail / 9 - .5;
    kit.beam('metal', new Color(base).multiplyScalar(1.15), [x + w * t, y + .011, face], [x + w * .6 * t, y + mass + .011, z], .018, true);
  }
}

function slateGable(kit: StructureKit, lot: Lot, y: number, w: number, d: number, rise: number, tint = welshSlate, brick = brownStock, z = lot.z) {
  const { x } = lot;
  const front = z + d / 2;
  const rear = z - d / 2;
  const left = x - w / 2;
  const right = x + w / 2;
  const first: XYZ = [left, y + rise, z];
  const last: XYZ = [right, y + rise, z];
  kit.panel('slate', tint, [[left, y, front], [right, y, front], last, first]);
  kit.panel('slate', new Color(tint).multiplyScalar(.94), [[right, y, rear], [left, y, rear], first, last]);
  for (const [edge, ridge] of [[left, first], [right, last]] as const) {
    const points: XYZ[] = [[edge, y, front], [edge, y, rear], ridge];
    kit.panel('brick', brick, edge === left ? points.reverse() : points);
    for (const eave of [front, rear]) kit.beam('metal', castIron, [edge, y + .010, eave], ridge, .048);
  }
  for (const eave of [front, rear]) kit.beam('metal', castIron, [left, y, eave], [right, y, eave], .060);
  kit.beam('metal', castIron, first, last, .055, true);
  for (const offset of [-.38, -.13, .15, .38]) {
    const span = x + offset * w;
    kit.block('metal', new Color(tint).multiplyScalar(1.16), [span, y + rise + .006, z], [.019, .050, .099]);
  }
}

function slateMansard(kit: StructureKit, lot: Lot, y: number, w: number, d: number, rise: number, tint = welshSlate) {
  const { x, z } = lot;
  const outline = (width: number, depth: number, at: number): XYZ[] => [
    [x - width / 2, at, z + depth / 2], [x + width / 2, at, z + depth / 2],
    [x + width / 2, at, z - depth / 2], [x - width / 2, at, z - depth / 2],
  ];
  const base = outline(w, d, y);
  const top = outline(w * .825, d * .64, y + rise);
  for (let side = 0; side < base.length; side++) {
    const next = (side + 1) % base.length;
    const hue = new Color(tint).multiplyScalar(side % 2 ? .90 : 1);
    kit.panel('slate', hue, [base[side], base[next], top[next], top[side]]);
    kit.beam('metal', castIron, base[side], base[next], .045);
    kit.beam('metal', castIron, base[side], top[side], .050, true);
  }
  tiledCap(kit, x, z, y + rise, w * .833, d * .657, tint, rise * .27);
}

function chimneyStack(kit: StructureKit, x: number, y: number, z: number, brick: number, height = .61, pots = 2) {
  kit.block('metal', castIron, [x, y + .022, z], [.375, .044, .376], true);
  kit.block('brick', brick, [x, y + height * .48, z], [.302, height, .269], true);
  kit.block('brick', new Color(brick).multiplyScalar(.91), [x, y + height - .054, z], [.352, .108, .317], true);
  kit.block('stone', agedStone, [x, y + height + .024, z], [.376, .050, .344], true);
  for (let pot = 0; pot < pots; pot++) {
    const at = x + (pot - (pots - 1) / 2) * .138;
    kit.beam('brick', clay, [at, y + height, z], [at, y + height + .187 - pot * .036, z], .047, true);
    kit.beam('brick', 0x9e6046, [at, y + height + .173 - pot * .036, z], [at, y + height + .204 - pot * .036, z], .059, true);
    kit.beam('metal', ink, [at, y + height + .201 - pot * .036, z], [at, y + height + .208 - pot * .036, z], .036, true);
  }
}

function roofDormer(kit: StructureKit, x: number, y: number, z: number, w = .67, tint = oldSlate, lit = false) {
  const face = wall(x, z + .211);
  kit.block('brick', brownStock, [x, y + .220, z], [w, .506, .432], true);
  kit.block('stone', limestone, face.point(0, y + .234, .025), [w, .481, .084], true);
  kit.block('metal', ink, face.point(0, y + .242, .079), [w * .72, .391, .038]);
  kit.block(lit ? 'skylight' : 'glass', lit ? warmGlass : 0x76928b, face.point(0, y + .237, .106), [w * .60, .325, .020]);
  kit.block('metal', ivory, face.point(0, y + .237, .119), [.021, .334, .023]);
  kit.block('metal', ivory, face.point(0, y + .236, .119), [w * .61, .019, .023]);
  const top = y + .676;
  const eave = y + .456;
  const front = z + .269;
  const rear = z - .293;
  const left = x - w * .59;
  const right = x + w * .59;
  kit.panel('slate', tint, [[left, eave, front], [x, top, front], [x, top, rear], [left, eave, rear]]);
  kit.panel('slate', tint, [[x, top, front], [right, eave, front], [right, eave, rear], [x, top, rear]]);
  kit.panel('stone', paleStone, [[left, eave, front - .043], [right, eave, front - .043], [x, top - .024, front - .043]]);
  for (const eaves of [left, right]) kit.beam('metal', castIron, [eaves, eave, front], [x, top, front], .044);
}

function pediment(kit: StructureKit, mount: Wall, x: number, y: number, w: number, rise: number, tympanum = limestone) {
  const face = .148;
  const left = mount.point(x - w * .50, y, face);
  const right = mount.point(x + w * .50, y, face);
  const apex = mount.point(x, y + rise, face);
  kit.panel('stone', tympanum, [left, right, apex]);
  kit.block('stone', agedStone, mount.point(x, y - .048, .112), [w + .055, .117, .160], true, mount.yaw);
  kit.block('stone', paleStone, mount.point(x, y + .019, .158), [w + .133, .053, .162], true, mount.yaw);
  for (const endpoint of [left, right]) {
    kit.beam('stone', paleStone, endpoint, apex, .067);
    kit.beam('metal', castIron, [endpoint[0], endpoint[1] + .055, endpoint[2] - .019], [apex[0], apex[1] + .055, apex[2] - .019], .027);
  }
  for (let notch = -3; notch <= 3; notch++) {
    kit.block('stone', paleStone, mount.point(x + notch * w * .12, y - .083, .198), [.041, .049, .085], false, mount.yaw);
  }
}

function barrelRoof(kit: StructureKit, x: number, z: number, y: number, w: number, d: number, color: number, rise: number, ribs = 9, glazing = false) {
  const sections = 14;
  const front = z + d / 2;
  const rear = z - d / 2;
  const surface = Array.from({ length: sections + 1 }, (_, i) => {
    const a = (i / sections - .5) * Math.PI;
    return [x + Math.sin(a) * w / 2, y + Math.cos(a) * rise] as const;
  });
  for (let i = 0; i < sections; i++) {
    const [lx, ly] = surface[i];
    const [rx, ry] = surface[i + 1];
    const blend = rand(i, 4, 21) * .18 + .91;
    const glass = glazing && i >= 3 && i <= 10;
    const pane = new Color(color).multiplyScalar(glass ? blend * 1.12 : blend);
    if (glass) {
      const width = d / (ribs - 1);
      for (let gutter = 0; gutter < ribs - 1; gutter++) {
        const near = front - gutter * width;
        const far = near - width;
        const detail = rand(i, gutter, 24);
        const backlit = gutter > 0 && gutter < ribs - 2 && i > 3 && i < 10 && detail > .23;
        kit.panel(backlit ? 'skylight' : 'glass', pane.clone().multiplyScalar(.92 + detail * .16), [[lx, ly, near], [rx, ry, near], [rx, ry, far], [lx, ly, far]]);
      }
    } else {
      kit.panel('metal', pane, [[lx, ly, front], [rx, ry, front], [rx, ry, rear], [lx, ly, rear]]);
    }
    if (glass) {
      const sx = lx + (rx - lx) * .20;
      const sy = ly + (ry - ly) * .20 + .007;
      const ex = lx + (rx - lx) * .27;
      const ey = ly + (ry - ly) * .27 + .007;
      kit.panel('glass', 0x92b0a7, [[sx, sy, front - .47], [ex, ey, front - .43], [ex, ey, rear + .54], [sx, sy, rear + .58]]);
    }
    kit.panel('metal', color, [[lx, y - .019, front], [rx, y - .019, front], [rx, ry, front], [lx, ly, front]]);
    kit.panel('metal', new Color(color).multiplyScalar(.83), [[rx, y - .019, rear], [lx, y - .019, rear], [lx, ly, rear], [rx, ry, rear]]);
    for (let tier = 0; tier < ribs; tier++) {
      const z = rear + tier / (ribs - 1) * d;
      kit.beam('metal', tier > 0 && tier < ribs - 1 ? slate : gold, [lx, ly + .020, z], [rx, ry + .020, z], tier > 0 && tier < ribs - 1 ? .027 : .040, true);
    }
  }
  for (const [lx, ly] of surface.filter((_, i) => i % 3 === 0)) {
    kit.beam('metal', slate, [lx, ly + .026, front], [lx, ly + .026, rear], .032, true);
  }
}

function monitorRoof(kit: StructureKit, lot: Lot, y: number) {
  const { x, z, w, d } = lot;
  tiledCap(kit, x, z, y, w - .035, d - .089, welshSlate, .56);
  const width = w * .62;
  const depth = d * .33;
  const roofZ = z - .14;
  const sill = y + .402;
  const face = wall(x, roofZ + depth * .5);
  kit.block('brick', redBrick, [x, sill + .23, roofZ], [width, .52, depth], true);
  kit.block('metal', copper, [x, sill + .068, roofZ], [width + .083, .092, depth + .080], true);
  for (let i = -2; i <= 2; i++) windowBay(kit, face, width / 6 * i, sill + .123, .377, .30, 'band', i === 1);
  tiledCap(kit, x, roofZ, sill + .506, width + .099, depth + .123, oldSlate, .19);
}

function workshopRoof(kit: StructureKit, x: number, z: number, y: number, w: number, d: number, tint: number) {
  const left = x - w / 2;
  const right = x + w / 2;
  const sections = 3;
  const deep = d / sections;
  for (let i = 0; i < sections; i++) {
    const front = z + d / 2 - i * deep;
    const rear = front - deep + .08;
    const high = y + .45;
    const paint = new Color(tint).multiplyScalar(.90 + i * .053);
    kit.panel('metal', paint, [[left, y, front], [right, y, front], [right, high, rear], [left, high, rear]]);
    kit.panel('metal', slate, [[left, y, rear], [left, y, front], [left, high, rear]]);
    kit.panel('metal', slate, [[right, y, front], [right, y, rear], [right, high, rear]]);
    const glare = rear - .019;
    kit.panel('metal', ink, [[right, y, rear], [left, y, rear], [left, high, rear], [right, high, rear]]);
    kit.panel('glass', 0x789e9a, [[right - .098, y + .063, glare], [left + .098, y + .063, glare], [left + .098, high - .048, glare], [right - .098, high - .048, glare]]);
    for (let bar = 1; bar < 9; bar++) {
      const axis = left + w * bar / 9;
      kit.beam('metal', slate, [axis, y + .016, front], [axis, high + .017, rear], .022);
      kit.beam('metal', ink, [axis, y + .051, rear - .022], [axis, high - .047, rear - .023], .029);
    }
    kit.beam('metal', ink, [left, y + .001, front], [right, y + .001, front], .070);
    kit.beam('metal', copper, [left, high + .013, rear], [right, high + .013, rear], .044, true);
  }
}

function gardenWorkshopRoof(kit: StructureKit, lot: Lot, y: number) {
  const { x, front, rear, w } = lot;
  const extent = w / 2 + .084;
  const ridge = y + .663;
  const head = front + .061;
  const heel = rear - .064;
  for (const side of [-1, 1]) {
    const roof = (t: number, z: number, lift = 0): XYZ => [x + side * extent * t, ridge - (ridge - y) * t + lift, z];
    const roofFace = (t0: number, t1: number, first: number, last: number): XYZ[] => {
      const points = [roof(t0, first), roof(t1, first), roof(t1, last), roof(t0, last)];
      return side > 0 ? points : points.reverse();
    };
    const tint = side > 0 ? 0x64756a : 0x5b6d61;
    kit.panel('metal', tint, roofFace(.28, 1, head, heel));
    kit.panel('metal', tint, roofFace(0, .28, head, head - .55));
    kit.panel('metal', tint, roofFace(0, .28, heel + .48, heel));
    const glassSpan = (head - heel - 1.03) / 6;
    for (let pane = 0; pane < 6; pane++) {
      const near = head - .55 - pane * glassSpan;
      const far = near - glassSpan;
      const paint = new Color(0x729189).multiplyScalar(.89 + rand(pane, side, 321) * .25);
      kit.panel(pane === 2 || pane === 3 ? 'skylight' : 'glass', paint, roofFace(0, .28, near, far));
      kit.beam('metal', teal, roof(0, near, .013), roof(.28, near, .013), .036);
    }
    kit.beam('metal', teal, roof(.28, head - .55, .017), roof(.28, heel + .48, .017), .039);
    for (let seam = 1; seam <= 9; seam++) {
      const along = head - (head - heel) * seam / 10;
      kit.beam('metal', 0x768071, roof(.30, along, .012), roof(1, along, .012), .021);
    }
    kit.beam('metal', slate, roof(1, head, .004), roof(1, heel, .004), .059, true);
    for (const edge of [head, heel]) {
      kit.beam('metal', 0x938169, roof(0, edge, .022), roof(1, edge, .013), .055);
    }
  }
  for (const z of [head - .032, heel + .032]) {
    const peak: XYZ = [x, ridge, z];
    kit.panel('metal', 0x7c6b54, [[x - extent, y, z], [x + extent, y, z], peak]);
  }
  kit.beam('metal', copper, [x, ridge + .026, head], [x, ridge + .026, heel], .074, true);
  kit.block('metal', teal, [x, y + .104, head], [.334, .153, .066], true);
}

function upperStoreys(kit: StructureKit, lot: Lot, first = 1.65, count = lot.parcel.stories - 1, style: 'arch' | 'sash' | 'band' = 'sash',
  columns = 3, body = limestone, centerBay = true) {
  const { facade, side, w, d } = lot;
  const gap = w / (columns + .58);
  const paneWidth = Math.min(.72, gap * .62);
  for (let row = 0; row < count; row++) {
    const y = first + row * 1.043;
    kit.block('stone', new Color(body).multiplyScalar(.86), facade.point(0, y - .14, .027), [w - .15, .042, .065]);
    for (let column = 0; column < columns; column++) {
      const offset = (column - (columns - 1) / 2) * gap;
      if (!centerBay && Math.abs(offset) < .01) continue;
      windowBay(kit, facade, offset, y, paneWidth, .65, style, (row * 11 + column * 7 + lot.parcel.finish) % 5 === 1);
    }
    for (const offset of [-d * .25, d * .25]) {
      windowBay(kit, side, offset, y, .62, .65, style, (Math.round(offset) + row * 3 + lot.parcel.finish) % 5 === 2);
    }
  }
}

function archiveLightwell(kit: StructureKit, mount: Wall) {
  windowBay(kit, mount, 0, 2.16, .86, 1.47, 'arch');
  const inner = -.151;
  for (const y of [2.57, 2.864, 3.19]) {
    kit.block('metal', slate, mount.point(0, y, inner), [.719, .044, .027]);
  }
  for (const side of [-1, 1]) {
    kit.beam('metal', gold, mount.point(0, 3.18, inner + .008), mount.point(side * .233, 3.480, inner + .008), .023);
    kit.beam('metal', slate, mount.point(side * .158, 2.22, inner), mount.point(side * .158, 3.20, inner), .026);
  }
  kit.block('stone', paleStone, mount.point(0, 3.65, .062), [.173, .135, .129], true);
}

function archiveShelves(kit: StructureKit, mount: Wall, x: number, y: number) {
  const bindings = [0x557175, 0x6e8580, 0x93927a, 0x637a74, 0x7a7760];
  for (let shelf = 0; shelf < 2; shelf++) {
    const line = y + shelf * .151;
    kit.block('glass', 0x527378, mount.point(x, line, -.175), [.55, .145, .015]);
    kit.block('glass', 0x567477, mount.point(x, line - .073, -.158), [.54, .020, .012]);
    for (let book = 0; book < 7; book++) {
      const offset = (book - 3) * .075;
      if (Math.abs(offset) < .057) continue;
      const height = .069 + rand(book, shelf, 81) * .044;
      const paint = bindings[(book * 3 + shelf) % bindings.length];
      kit.block('glass', paint, mount.point(x + offset, line - .065 + height / 2, -.143), [.031 + rand(book, shelf, 42) * .026, height, .018]);
    }
  }
}

function marketDisplay(kit: StructureKit, mount: Wall, x: number, variant: number) {
  const produce = [0xb88962, 0xaaa06d, 0x81916a, 0xb17c65];
  const width = .286;
  const projection = -.29 + (variant ? .031 : 0);
  for (const side of [-1, 1]) {
    const middle = x + side * .24;
    kit.block(variant === 0 ? 'skylight' : 'glass', 0x536f6c, mount.point(middle, .824, .154 + projection), [width, .257, .022]);
    kit.block('wood', 0x8b6c52, mount.point(middle, .779, .171 + projection), [width, .031, .014]);
    for (let i = -1; i <= 1; i++) {
      const color = produce[(i + 3 + variant * 2) % produce.length];
      kit.block('glass', color, mount.point(middle + i * .067, .811, .173 + projection), [.059, .05 + .018 * (1 - Math.abs(i)), .017], true);
    }
  }
}

function archive(kit: StructureKit, lot: Lot) {
  const { x, z, w, d, h, facade } = lot;
  const walls = 0xcbad84;
  foundation(kit, lot, 0xa99b80);
  portal(kit, facade, 0, 1.16, 1.63);
  placedSign(kit, facade, 1.913, '潮汐档案馆', 2.08);
  for (const offset of [-1.39, 1.39]) {
    windowBay(kit, facade, offset, .54, .84, .79, 'sash');
    archiveShelves(kit, facade, offset, .81);
  }
  for (const offset of [-1.94, -.97, .97, 1.94]) {
    pilaster(kit, facade, offset, Math.abs(offset) < 1 ? 3.50 : 3.31, limestone, .172);
    pilasterPedestal(kit, facade, offset, Math.abs(offset) < 1 ? 3.50 : 3.31);
  }
  for (const offset of [-1.39, 1.39]) trimPanel(kit, facade, offset, 2.888, .64, .205, limestone);
  const spacing = w / 3.58;
  for (const offset of [-spacing, spacing]) {
    dressedArch(kit, facade, offset, 2.105, .627, .712, offset < 0);
    windowBay(kit, facade, offset, 3.163, .629, .569, 'sash', offset > 0);
  }
  archiveLightwell(kit, facade);
  streetCornice(kit, facade, w - .12, 3.745);
  slab(kit, x, z, h + .04, w + .11, d + .118, limestone);
  slateGable(kit, lot, h + .140, w + .087, d + .096, .699, welshSlate, walls);
  pediment(kit, facade, 0, h + .139, 2.09, .58);
  plaqueBadge(kit, facade, h + .323);
  for (const offset of [-1.46, 1.46]) roofDormer(kit, x + offset, h + .246, z + 1.01, .587, welshSlate, offset > 0);
  chimneyStack(kit, x - 1.64, h + .415, z - .47, walls, .544);
  chimneyStack(kit, x + 1.54, h + .41, z - .53, walls, .481);
  weatherVane(kit, x + .46, h + .828, z);
}

function clinic(kit: StructureKit, lot: Lot) {
  const { x, z, w, d, h, facade, side } = lot;
  const walls = 0xa8735c;
  foundation(kit, lot, 0xb9ad95);
  for (const offset of [-1.43, 1.43]) {
    windowBay(kit, facade, offset, .51, 1.02, .88, 'sash', offset > 0);
    cantedSash(kit, facade, offset, 1.89, .96, .735, offset < 0);
    windowBay(kit, facade, offset, 2.90, .88, .61, 'sash');
    for (const corner of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const depth = corner % 2 ? .195 : .292;
      kit.block('stone', 0xcaa88b, facade.point(Math.sign(offset) * (w / 2 - depth * .54), .27 + corner * .339, .048), [depth, .161, .118], true);
    }
  }
  for (const offset of [-.69, .69]) pilaster(kit, facade, offset, 3.66, limestone, .143);
  stringCourse(kit, lot, 1.56, agedStone);
  stringCourse(kit, lot, 3.65, limestone);
  streetCornice(kit, facade, w - .13, 3.627);
  portal(kit, facade, 0, 1.02, 1.53);
  kit.block('metal', bottle, facade.point(0, 1.79, .268), [1.78, .088, .53], true);
  kit.block('metal', 0x987c58, facade.point(0, 1.827, .513), [1.74, .030, .038], true);
  kit.block('skylight', 0xc6b59a, facade.point(0, 1.726, .358), [1.01, .020, .093], true);
  for (const offset of [-.69, .69]) {
    kit.beam('metal', castIron, facade.point(offset, 1.49, .107), facade.point(offset, 1.755, .489), .03);
  }
  placedSign(kit, facade, 2.014, '港湾诊所', 1.60, 'navy');
  windowBay(kit, facade, 0, 2.815, .57, .68, 'sash');
  plaqueBadge(kit, facade, 2.468, false);
  for (const offset of [-.80, .81]) {
    windowBay(kit, side, offset, .57, .72, .76, 'sash');
    windowBay(kit, side, offset, 1.96, .68, .75, 'sash', offset > 0);
    windowBay(kit, side, offset, 2.95, .64, .61, 'sash');
  }
  drainpipe(kit, side, 1.55, h - .07);
  slab(kit, x, z, h - .08, w + .106, d + .093, limestone);
  slateGable(kit, lot, h + .024, w + .098, d + .061, .71, welshSlate, walls);
  roofDormer(kit, x, h + .188, z + .99, .77, welshSlate, true);
  chimneyStack(kit, x - 1.48, h + .360, z - .35, walls, .49);
  chimneyStack(kit, x + 1.45, h + .365, z - .34, walls, .55);
}

function awning(kit: StructureKit, mount: Wall, x: number, y: number, width: number, tint = teal) {
  const bands = 7;
  for (let i = 0; i < bands; i++) {
    const a = x + (i / bands - .5) * width;
    const b = x + ((i + 1) / bands - .5) * width;
    const color = i % 2 ? ivory : tint;
    kit.panel('metal', color, [mount.point(a, y - .15, .40), mount.point(b, y - .15, .40), mount.point(b, y, .068), mount.point(a, y, .068)]);
    kit.block('metal', color, mount.point((a + b) / 2, y - .185, .406), [(b - a) * .98, .072, .027], false, mount.yaw);
  }
  for (const offset of [-.46, .46]) {
    kit.beam('metal', slate, mount.point(x + width * offset, y - .30, .058), mount.point(x + width * offset, y - .154, .39), .027);
  }
}

function market(kit: StructureKit, lot: Lot) {
  const { x, z, w, d, h, facade, side } = lot;
  const walls = 0x935541;
  foundation(kit, lot, darkBrick);
  portal(kit, facade, 0, 1.01, 1.51, true);
  for (const offset of [-1.38, 0, 1.38]) {
    if (offset) dressedArch(kit, facade, offset, .352, 1.03, 1.19, offset < 0);
    awning(kit, facade, offset, 1.81, 1.15, offset < 0 ? 0x8d513f : offset > 0 ? 0x8f754e : bottle);
    marketDisplay(kit, facade, offset, Math.sign(offset));
  }
  shopBlade(kit, facade, 1.987, 2.13, '市集', 'bronze');
  placedSign(kit, facade, 2.16, '港湾市场', 1.74);
  for (const offset of [-2.02, -.687, .687, 2.02]) pilaster(kit, facade, offset, 2.42, agedStone, .13);
  upperStoreys(kit, lot, 2.54, 2, 'sash', 4, redBrick);
  drainpipe(kit, side, -.912, h - .16);
  stringCourse(kit, lot, 2.36, agedStone);
  streetCornice(kit, facade, w - .08, 2.438);
  stringCourse(kit, lot, 4.31, agedStone);
  steppedCrown(kit, lot, h - .07, redBrick);
  monitorRoof(kit, lot, h + .28);
  pediment(kit, facade, 0, h - .069, 1.74, .534, agedStone);
  for (const offset of [-1.49, 1.49]) chimneyStack(kit, x + offset, h + .418, z - .91, walls, .61, 3);
}

function stationClock(kit: StructureKit, mount: Wall, y: number) {
  kit.beam('metal', slate, mount.point(0, y, .041), mount.point(0, y, .092), .386, true);
  kit.beam('metal', gold, mount.point(0, y, .092), mount.point(0, y, .117), .346, true);
  kit.beam('skylight', ivory, mount.point(0, y, .117), mount.point(0, y, .134), .304, true);
  for (let tick = 0; tick < 12; tick++) {
    const a = tick * Math.PI / 6;
    const reach = tick % 3 ? .218 : .185;
    kit.beam('metal', slate, mount.point(Math.sin(a) * reach, y + Math.cos(a) * reach, .140), mount.point(Math.sin(a) * .260, y + Math.cos(a) * .260, .14), tick % 3 ? .019 : .028);
  }
  kit.beam('metal', ink, mount.point(0, y, .157), mount.point(.184, y + .093, .157), .034);
  kit.beam('metal', ink, mount.point(0, y, .158), mount.point(-.105, y + .087, .158), .043);
  kit.beam('metal', copper, mount.point(0, y, .146), mount.point(0, y, .188), .039, true);
}

function stationStair(kit: StructureKit, lot: Lot) {
  const x = lot.x - .95;
  const z = lot.rear + .415;
  const roof = 5.265;
  kit.block('stone', agedStone, [x, 4.42, z], [.97, 1.38, .789], true);
  kit.block('metal', ink, [x, roof - .067, z], [1.08, .106, .884], true);
  kit.block('metal', teal, [x, roof, z - .007], [.98, .050, .836], true);
  const rear = wall(x, lot.rear + .005, Math.PI);
  windowBay(kit, rear, 0, 4.17, .629, .874, 'sash', true);
  const east = wall(x + .485, z, Math.PI / 2);
  for (const y of [4.22, 4.73]) windowBay(kit, east, 0, y, .395, .290, 'band');
  kit.block('stone', limestone, [x, 4.119, lot.rear + .004], [.828, .097, .188], true);
}

function station(kit: StructureKit, lot: Lot) {
  const { x, z, w, d, h, facade, side } = lot;
  const walls = 0xa96a4e;
  foundation(kit, lot);
  for (const offset of [-1.54, 1.54]) {
    dressedArch(kit, facade, offset, .42, .85, 1.10, offset > 0);
    windowBay(kit, facade, offset, 2.07, .84, .70, 'sash');
  }
  for (const offset of [-1.92, -.992, .992, 1.92]) pilaster(kit, facade, offset, 3.21, limestone, .132);
  portal(kit, facade, 0, 1.53, 1.75, true);
  kit.block('metal', bottle, facade.point(0, 1.82, .219), [2.48, .096, .410], true);
  kit.block('metal', copper, facade.point(0, 1.847, .426), [2.44, .029, .040], true);
  for (const offset of [-1.05, 1.05]) {
    kit.beam('metal', castIron, facade.point(offset, 1.50, .098), facade.point(offset, 1.790, .411), .036);
    kit.beam('metal', castIron, facade.point(offset, 1.65, .101), facade.point(offset, 1.76, .413), .021);
  }
  kit.block('skylight', 0xc2ac83, facade.point(0, 1.768, .245), [1.32, .018, .053], true);
  placedSign(kit, facade, 2.12, '中央车站', 1.96, 'navy');
  shopBlade(kit, side, .922, 1.99, '站厅', 'navy');
  windowBay(kit, facade, 0, 2.36, 1.31, .76, 'arch', true);
  windowBay(kit, side, -.64, .64, .78, .91, 'arch');
  windowBay(kit, side, .70, .64, .78, .91, 'arch');
  for (const y of [1.895, 3.23]) stringCourse(kit, lot, y, limestone);
  streetCornice(kit, facade, w - .15, 3.203);
  slab(kit, x, z, h - .36, w + .11, d + .12, limestone);
  barrelRoof(kit, x, z - .04, h - .235, w - .12, d + .085, 0x698581, 1.04, 6, true);
  const clock = wall(x, lot.front + .090);
  const towerZ = lot.front - .27;
  kit.block('brick', walls, [x, h + .64, towerZ], [1.20, 1.63, .73], true);
  kit.block('stone', limestone, [x, h + .10, towerZ], [1.32, .102, .77], true);
  for (const offset of [-.49, .49]) {
    kit.block('stone', paleStone, clock.point(offset, h + .768, .004), [.13, 1.34, .122], true);
    kit.block('stone', agedStone, clock.point(offset, h + 1.379, .037), [.215, .110, .163], true);
  }
  stationClock(kit, clock, h + .902);
  kit.block('stone', limestone, [x, h + 1.426, towerZ], [1.26, .115, .785], true);
  kit.block('metal', castIron, [x, h + 1.516, towerZ], [1.20, .083, .740], true);
  tiledCap(kit, x, towerZ, h + 1.572, 1.205, .792, welshSlate, .511);
  kit.beam('metal', copper, [x, h + 2.060, towerZ], [x, h + 2.257, towerZ], .033, true);
  for (const offset of [-1.49, 1.49]) chimneyStack(kit, x + offset, h + .095, z - .8, walls, .435, 1);
  stationStair(kit, lot);
}

function balustrade(kit: StructureKit, mount: Wall, x: number, y: number, width: number) {
  kit.block('stone', limestone, mount.point(x, y, .151), [width, .072, .28], true, mount.yaw);
  kit.block('metal', ink, mount.point(x, y + .335, .288), [width - .061, .041, .043], false, mount.yaw);
  kit.block('metal', bronzeRail, mount.point(x, y + .071, .288), [width - .10, .043, .035], false, mount.yaw);
  for (let i = 0; i < 6; i++) {
    const offset = x + (i / 5 - .5) * (width - .11);
    kit.block('metal', castIron, mount.point(offset, y + .199, .288), [.026, .277, .026], false, mount.yaw);
    kit.block('metal', 0x716a57, mount.point(offset, y + .347, .289), [.031, .030, .027], true, mount.yaw);
  }
}

const bronzeRail = 0x746b56;

function balconyPot(kit: StructureKit, mount: Wall, x: number, y: number) {
  kit.block('wood', darkBrick, mount.point(x, y + .108, .172), [.246, .128, .127], true, mount.yaw);
  kit.block('wood', copper, mount.point(x, y + .166, .171), [.263, .044, .144], true, mount.yaw);
  for (let sprout = -1; sprout <= 1; sprout++) {
    const base = mount.point(x + sprout * .058, y + .171, .179);
    const top = mount.point(x + sprout * .075, y + .255 + (1 - Math.abs(sprout)) * .036, .183);
    kit.beam('wood', 0x718752, base, top, .038, true);
  }
}

function cantedBay(kit: StructureKit, mount: Wall, x: number, y: number, w = .85, h = .74, lit = false) {
  const front = .205;
  const inset = .003;
  const cheek = w * .52;
  const broad = w * .30;
  const center = mount.point(x, 0, front);
  const facade = wall(center[0], center[2], mount.yaw);
  kit.block('stone', agedStone, mount.point(x, y + h / 2, .108), [w * .62, h + .21, .235], true, mount.yaw);
  windowBay(kit, facade, 0, y, w * .62, h, 'sash', lit);
  for (const sign of [-1, 1]) {
    const a = mount.point(x + broad * sign, y - .087, front + .025);
    const b = mount.point(x + cheek * sign, y - .087, inset);
    const c = mount.point(x + cheek * sign, y + h + .119, inset);
    const d = mount.point(x + broad * sign, y + h + .119, front + .025);
    kit.panel('metal', limestone, sign > 0 ? [a, b, c, d] : [b, a, d, c]);
    const where = mount.point(x + (broad + cheek) * .50 * sign, 0, (front + inset) * .50 + .020);
    const jamb = wall(where[0], where[2], mount.yaw + sign * .67);
    kit.block('metal', ink, jamb.point(0, y + h * .49, .004), [.151, h * .75, .035], false, jamb.yaw);
    kit.block(lit ? 'light' : 'glass', lit ? warmGlass : 0x678783, jamb.point(0, y + h * .48, .022), [.108, h * .67, .027], false, jamb.yaw);
    kit.block('metal', ivory, jamb.point(0, y + h * .49, .041), [.121, .022, .019], false, jamb.yaw);
    kit.beam('stone', paleStone, a, b, .076);
    kit.beam('stone', agedStone, c, d, .052);
  }
  const lower = y + h + .157;
  kit.block('stone', limestone, mount.point(x, lower - .035, .142), [w + .054, .105, .291], true, mount.yaw);
  const lowLeft = mount.point(x - w * .52, lower, .307);
  const lowRight = mount.point(x + w * .52, lower, .307);
  const highLeft = mount.point(x - w * .50, lower + .113, .025);
  const highRight = mount.point(x + w * .50, lower + .113, .025);
  kit.panel('slate', welshSlate, [lowLeft, lowRight, highRight, highLeft]);
  kit.beam('metal', castIron, lowLeft, lowRight, .032);
}

function apartment(kit: StructureKit, lot: Lot) {
  const { parcel, x, z, w, d, h, facade, side } = lot;
  const paint = parcel.finish < 2 ? buffStock : 0xad7257;
  const edge = parcel.finish < 2 ? 0xddc7a7 : 0xceac8a;
  foundation(kit, lot, 0xb6a799);
  portal(kit, facade, 0, .91, 1.53, parcel.finish === 1);
  cantedBay(kit, facade, -1.44, .49, .96, .795, parcel.finish === 1);
  cantedBay(kit, facade, 1.44, .49, .96, .795, parcel.finish !== 1);
  upperStoreys(kit, lot, 1.71, parcel.stories - 1, 'sash', 3, paint);
  for (let i = 0; i < parcel.stories - 1; i++) {
    const y = 1.67 + i * 1.044;
    if (i % 2 !== parcel.finish % 2) continue;
    balustrade(kit, facade, -.02, y, 1.03);
    balustrade(kit, side, .11, y, .99);
    balconyPot(kit, facade, -.30, y);
    balconyPot(kit, side, -.19, y);
  }
  for (const offset of [-w * .425, w * .425]) {
    kit.block('stone', edge, facade.point(offset, h * .53, .025), [.139, h * .84, .087]);
  }
  for (const y of [1.48, h - .20]) stringCourse(kit, lot, y, edge);
  drainpipe(kit, side, -1.14, h - .15);
  slab(kit, x, z, h + .046, w + .085, d + .087, edge);
  const tint = parcel.finish < 2 ? oldSlate : welshSlate;
  slateGable(kit, lot, h + .134, w + .070, d + .053, .687, tint, paint);
  const dormerOffset = parcel.finish < 2 ? .81 : 1.09;
  for (const side of [-1, 1]) roofDormer(kit, x + side * dormerOffset, h + .236, z + d * .265, .61, tint, side > 0);
  chimneyStack(kit, x - w * .373, h + .454, z -.114, paint, .55);
  chimneyStack(kit, x + w * .355, h + .455, z -.369, paint, .591, 3);
}

function hotel(kit: StructureKit, lot: Lot) {
  const { x, z, w, d, h, facade, side } = lot;
  const burgundy = 0xb37550;
  foundation(kit, lot, agedStone);
  portal(kit, facade, 0, 1.03, 1.46);
  placedSign(kit, facade, 1.82, '潮汐旅馆', 1.54);
  for (const offset of [-1.46, 1.46]) {
    dressedArch(kit, facade, offset, .39, .86, .92, offset > 0);
    awning(kit, facade, offset, 1.499, 1.032, 0x914837);
    balustrade(kit, facade, offset, 1.947, .96);
  }
  upperStoreys(kit, lot, 2.03, 5, 'sash', 3, burgundy);
  for (const xOffset of [-1.93, -.883, .883, 1.93]) pilaster(kit, facade, xOffset, h - .18, agedStone, .141);
  for (const y of [1.537, h - .54]) stringCourse(kit, lot, y, limestone);
  for (const zOffset of [-1.41, 1.41]) {
    kit.block('stone', agedStone, side.point(zOffset, h * .49, .029), [.157, h * .84, .089], false, side.yaw);
  }
  streetCornice(kit, facade, w - .12, h - .106);
  streetCornice(kit, side, d - .12, h - .106);
  steppedCrown(kit, lot, h + .012, limestone);
  slateMansard(kit, lot, h + .377, w - .072, d - .091, .79, welshSlate);
  for (const offset of [-1.31, 0, 1.31]) roofDormer(kit, x + offset, h + .495, z + 1.31, offset === 0 ? .72 : .60, oldSlate, offset === 0);
  for (const offset of [-1.48, 1.51]) chimneyStack(kit, x + offset, h + .831, z -.63, burgundy, .625, 3);
}

function exchangeBays(kit: StructureKit, mount: Wall, width: number, height: number, shift = 0) {
  const columns = width > 4 ? [-1.38, 0, 1.38] : [-.88, .88];
  for (const edge of [-.44, .44]) {
    kit.block('stone', 0xb59c81, mount.point(edge * width, height * .47, .044), [.128, height * .833, .110], true, mount.yaw);
  }
  for (let row = 0; row < 6; row++) {
    const y = 1.93 + row * .939;
    if (row % 2 === 0) kit.block('stone', agedStone, mount.point(0, y - .127, .038), [width - .21, .049, .100], false, mount.yaw);
    for (const [index, offset] of columns.entries()) {
      const lit = (row * 3 + index * 7 + shift) % 6 === 3;
      windowBay(kit, mount, offset, y, row > 3 ? .63 : .77, row > 3 ? .57 : .68, row === 0 ? 'arch' : 'sash', lit);
    }
  }
}

function exchange(kit: StructureKit, lot: Lot) {
  const { x, z, w, d, h, facade, side } = lot;
  const shade = 0xb09b80;
  foundation(kit, lot, agedStone);
  exchangeBays(kit, facade, w, h);
  exchangeBays(kit, side, d, h, 1);
  portal(kit, facade, 0, 1.25, 1.62);
  for (const offset of [-1.43, 1.43]) windowBay(kit, facade, offset, .451, .78, .92, 'arch', offset > 0);
  for (const y of [1.75, 3.77, h - .211]) stringCourse(kit, lot, y, limestone);
  for (const offset of [-.93, .93]) {
    kit.block('stone', limestone, facade.point(offset, h * .53, .051), [.116, h * .81, .097], true);
    pilasterPedestal(kit, facade, offset, h - .61);
  }
  streetCornice(kit, facade, w - .11, h - .28);
  streetCornice(kit, side, d - .11, h - .28);
  steppedCrown(kit, lot, h, agedStone);
  slateMansard(kit, lot, h + .368, w - .062, d - .041, .888, 0x505766);
  pediment(kit, facade, 0, h + .165, 1.75, .705, agedStone);
  roofDormer(kit, x, h + .582, z + .97, .80, welshSlate, true);
  for (const offset of [-1.49, 1.49]) chimneyStack(kit, x + offset, h + .974, z -.58, shade, .54, 3);
}

function warehouseLoader(kit: StructureKit, mount: Wall, x: number, width: number, height: number) {
  const reveal = civicReveal(kit, mount, x, .108, width, height - .108, false, 0xc4ab88);
  const depth = reveal.depth;
  const spring = reveal.spring;
  const half = reveal.frame;
  facadePanel(kit, mount, x - half, x + half, .135, spring - .028, depth + .007, 'wood', 0x4b4d44);
  for (let index = 1; index < 12; index++) {
    const at = x - half + half * index / 6;
    facadePanel(kit, mount, at - .009, at + .009, .139, spring - .038, depth + .013, 'wood', 0x675f47);
  }
  for (const side of [-1, 1]) {
    const center = x + side * half * .50;
    for (const y of [.28, spring - .167]) kit.block('wood', castIron, mount.point(center, y, depth + .042), [half - .012, .064, .064], true, mount.yaw);
    kit.beam('wood', 0x777157, mount.point(x + side * half * .91, .292, depth + .055),
      mount.point(x + side * .036, spring - .184, depth + .055), .065);
    kit.block('metal', brass, mount.point(x + side * .064, .620, depth + .061), [.042, .101, .044], true, mount.yaw);
  }
  kit.block('metal', ink, mount.point(x, (spring + .135) / 2, depth + .038), [.037, spring - .149, .054], false, mount.yaw);
  kit.block('stone', limestone, mount.point(x, spring + .058, .068), [width + .176, .142, .225], true, mount.yaw);
  const sill = mount.point(x, .067, .017);
  kit.block('stone', agedStone, sill, [width + .263, .134, .474], true, mount.yaw);
}

function warehouse(kit: StructureKit, lot: Lot) {
  const { parcel, x, z, w, d, facade, side } = lot;
  const single = parcel.stories === 1;
  const h = single ? 1.59 : 2.20;
  const paint = single ? 0x8f5945 : buffStock;
  foundation(kit, lot);
  const opening = single ? '渡口仓栈' : '园务工坊';
  if (single) warehouseLoader(kit, facade, 0, 1.22, 1.36);
  else portal(kit, facade, 0, 1.14, 1.39, true);
  placedSign(kit, facade, 1.61 + (single ? 0 : .20), opening, 1.41);
  for (const offset of [-(w * .34), w * .34]) {
    windowBay(kit, facade, offset, single ? .53 : .57, single ? .64 : .76, single ? .55 : .74, 'sash', !single && offset > 0);
    kit.block('wood', darkBrick, facade.point(offset + Math.sign(offset) * .40, .80, .061), [.099, .615, .071], true);
    if (!single) balconyPot(kit, facade, offset, .484);
  }
  windowBay(kit, side, .45, .58, single ? .93 : 1.14, single ? .57 : .75, 'sash');
  if (single) {
    warehouseLoader(kit, side, -.78, .78, 1.19);
  } else {
    windowBay(kit, side, -.98, .58, .77, .75, 'sash');
    balconyPot(kit, side, .67, .481);
    awning(kit, facade, 0, 1.72, 1.42, 0x6f8872);
  }
  slab(kit, x, z, h + .019, w + .13, d + .123, agedStone);
  if (single) workshopRoof(kit, x, z, h + .105, w + .022, d - .053, oldSlate);
  else gardenWorkshopRoof(kit, lot, h + .106);
  chimneyStack(kit, x + w * .278, h + .296, z - .74, paint, .388, single ? 1 : 2);
  drainpipe(kit, side, single ? -1.32 : 1.42, h + .075);
  streetCornice(kit, facade, w - .15, h - .073);
}

function serviceWindow(kit: StructureKit, mount: Wall, x: number, y: number, w: number, h: number, lit = false) {
  if (mount.openings) {
    windowBay(kit, mount, x, y - h / 2, w, h, 'sash', lit);
    return;
  }
  kit.block('stone', agedStone, mount.point(x, y, .023), [w + .055, h + .057, .074], true, mount.yaw);
  kit.block('metal', ink, mount.point(x, y, .060), [w, h, .044], false, mount.yaw);
  kit.block(lit ? 'light' : 'glass', lit ? warmGlass : 0x678583, mount.point(x, y, .088), [w - .070, h - .079, .019], false, mount.yaw);
  kit.block('metal', slate, mount.point(x, y + h * .105, .102), [w - .064, .019, .018], false, mount.yaw);
  kit.block('metal', slate, mount.point(x, y, .104), [.023, h - .074, .020], false, mount.yaw);
  kit.block('stone', paleStone, mount.point(x, y - h * .52, .055), [w + .102, .049, .129], false, mount.yaw);
}

function fanGlazing(kit: StructureKit, mount: Wall, x: number, base: number, width: number, height: number) {
  const spring = base + height * .65;
  const depth = mount.openings ? -.142 : .139;
  const from = mount.point(x, spring, depth);
  for (const angle of [.24, .38, .62, .76]) {
    const direction = angle * Math.PI;
    const tip = mount.point(x + Math.cos(direction) * width * .397,
      spring + Math.sin(direction) * height * .257, depth);
    kit.beam('metal', bottle, from, tip, .018);
  }
  kit.block('metal', bottle, mount.point(x, spring, depth), [width * .798, .029, .021], false, mount.yaw);
}

function archiveReturn(kit: StructureKit, mount: Wall, width: number, interior: boolean) {
  const spread = width / (interior ? 3.63 : 3.22);
  const bays = interior ? [-spread, 0, spread] : [-spread, spread];
  for (const offset of bays) {
    dressedArch(kit, mount, offset, .442, .701, 1.05, offset > 0);
    fanGlazing(kit, mount, offset, .442, .701, 1.05);
    dressedArch(kit, mount, offset, 2.016, .661, 1.010, offset < 0);
  }
  for (const offset of [-width * .445, 0, width * .445]) {
    if (interior && !offset) continue;
    pilaster(kit, mount, offset, 3.62, limestone, .137);
    pilasterPedestal(kit, mount, offset, 3.62);
  }
  for (const y of [1.721, 3.706]) streetCornice(kit, mount, width - .13, y);
  if (!interior) trimPanel(kit, mount, 0, 2.716, .414, .518, paleStone);
  drainpipe(kit, mount, width * .430 * (interior ? -1 : 1), 3.60);
}

function stationReturn(kit: StructureKit, mount: Wall, width: number, inner: boolean) {
  const spread = width / (inner ? 3.39 : 3.16);
  const columns = inner ? [-spread, 0, spread] : [-spread, spread];
  for (const offset of columns) {
    dressedArch(kit, mount, offset, .452, .790, 1.392, offset <= 0);
    fanGlazing(kit, mount, offset, .452, .790, 1.392);
    windowBay(kit, mount, offset, 2.199, .658, .749, 'sash', offset > 0);
  }
  for (const offset of [-width * .432, width * .432]) {
    pilaster(kit, mount, offset, 3.19, agedStone, .134);
  }
  streetCornice(kit, mount, width - .12, 3.171);
  if (!inner) drainpipe(kit, mount, -width * .416, 3.43);
}

function marketReturn(kit: StructureKit, mount: Wall, width: number, interior: boolean) {
  const spread = width / 3.42;
  for (const offset of [-spread, spread]) {
    dressedArch(kit, mount, offset, .363, .887, 1.139, offset < 0);
    marketDisplay(kit, mount, offset, Math.sign(offset));
    awning(kit, mount, offset, 1.750, .950, offset < 0 ? 0x84524a : 0x8b774e);
    windowBay(kit, mount, offset, 2.195, .673, .684, 'sash', offset > 0);
    windowBay(kit, mount, offset, 3.276, .649, .676, 'sash', offset < 0);
  }
  for (const offset of [-width * .426, 0, width * .426]) {
    pilaster(kit, mount, offset, 2.05, agedStone, .107);
  }
  if (!interior) shopBlade(kit, mount, width * .412, 2.183, '纸品', 'navy');
  streetCornice(kit, mount, width - .15, 2.059);
  streetCornice(kit, mount, width - .14, 4.298);
}

function clinicReturn(kit: StructureKit, mount: Wall, width: number, interior: boolean) {
  const spread = width / 3.47;
  for (const offset of [-spread, spread]) {
    windowBay(kit, mount, offset, .528, .712, .799, 'sash', offset < 0);
    cantedSash(kit, mount, offset, 1.896, .758, .723, offset > 0);
    windowBay(kit, mount, offset, 2.909, .683, .610, 'sash', offset < 0);
  }
  for (const offset of [-width * .445, width * .445]) {
    pilaster(kit, mount, offset, 3.605, 0xcbb091, .118);
  }
  streetCornice(kit, mount, width - .12, 3.570);
  drainpipe(kit, mount, width * .416 * (interior ? 1 : -1), 3.46);
}

function orbitalElevations(kit: StructureKit, lot: Lot) {
  const { parcel, w, d, h, innerWall: inner, westWall: west } = lot;
  if (parcel.kind === 'office') {
    exchangeBays(kit, inner, w, h, 2);
    exchangeBays(kit, west, d, h, 4);
    for (const offset of [-1.44, 0, 1.44]) serviceWindow(kit, inner, offset, 1.02, .83, .78, offset === 0);
    for (const offset of [-.81, .81]) serviceWindow(kit, west, offset, 1.02, .72, .78, offset > 0);
    return;
  }
  if (parcel.kind === 'station') {
    stationReturn(kit, inner, w, true);
    stationReturn(kit, west, d, false);
    return;
  }
  if (parcel.kind === 'archive') {
    archiveReturn(kit, inner, w, true);
    archiveReturn(kit, west, d, false);
    archiveReturn(kit, lot.side, d, false);
    return;
  }
  if (parcel.kind === 'market') {
    marketReturn(kit, inner, w, true);
    marketReturn(kit, west, d, false);
    return;
  }
  if (parcel.kind === 'clinic') {
    clinicReturn(kit, inner, w, true);
    clinicReturn(kit, west, d, false);
    return;
  }
  if (parcel.kind === 'warehouse') {
    for (const offset of [-w * .29, w * .29]) serviceWindow(kit, inner, offset, .958, .76, .55, offset > 0 && parcel.stories > 1);
    serviceWindow(kit, west, -.18, .945, 1.05, .504);
    return;
  }

  const rows = Math.min(parcel.stories, 6);
  for (const mount of [inner, west]) {
    const across = (mount === inner ? w : d) * .296;
    const offsets = mount === inner ? [-across, 0, across] : [-across, across];
    for (let row = 0; row < rows; row++) {
      const y = 1.0 + row * 1.025;
      kit.block('stone', limestone, mount.point(0, y - .404, .029), [(mount === inner ? w : d) - .30, .045, .064], false, mount.yaw);
      for (const [index, offset] of offsets.entries()) {
        serviceWindow(kit, mount, offset, y, .69, .59, (row * 3 + index * 9 + parcel.finish + (mount === inner ? 1 : 3)) % 7 === 2);
      }
    }
    drainpipe(kit, mount, (mount === inner ? w : d) * .432, h - .20);
  }
}

function buildParcel(parcel: CityParcel) {
  const kit = new StructureKit();
  kit.group.name = `parcel:${parcel.id}`;
  kit.group.userData.parcel = parcel.id;
  const lot = lotBounds(parcel);
  switch (parcel.kind) {
    case 'archive': archive(kit, lot); break;
    case 'clinic': clinic(kit, lot); break;
    case 'market': market(kit, lot); break;
    case 'station': station(kit, lot); break;
    case 'apartment': apartment(kit, lot); break;
    case 'hotel': hotel(kit, lot); break;
    case 'office': exchange(kit, lot); break;
    case 'warehouse': warehouse(kit, lot);
  }
  orbitalElevations(kit, lot);
  if (lot.shell) {
    const top = parcel.kind === 'warehouse' ? (parcel.stories === 1 ? 1.59 : 2.20)
      : lot.h - (parcel.kind === 'station' ? .41 : parcel.kind === 'clinic' ? .096 : 0);
    civicShell(kit, lot, lot.shell, top);
  }
  return kit.finish();
}

export function buildCityArchitecture() {
  const city = new Group();
  city.name = 'Tidebound waterfront architecture';
  city.add(...cityParcels.map(buildParcel));
  return city;
}

export function updateCityArchitecture(darkness: number, supply = .73) {
  const level = Math.min(1, Math.max(0, darkness));
  const current = Math.min(1.30, supply / .73);
  surfaces.light.color.copy(coolPane).lerp(neutralPane, Math.min(1, level * current));
  surfaces.light.emissiveIntensity = level * .81 * current;
  surfaces.skylight.emissiveIntensity = level * .26 * current;
  for (const material of plaques.values()) material.emissiveIntensity = level * .41 * current;
}

const coolPane = new Color(0xb4c8d0);
const neutralPane = new Color(0xffffff);
