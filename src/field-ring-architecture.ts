import {
  BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, Group, LatheGeometry, Mesh, MeshStandardMaterial,
  TorusGeometry, Vector2, Vector3,
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
const lantern = new MeshStandardMaterial({
  color: 0xe3c288, emissive: 0xffc16c, emissiveIntensity: .015, roughness: .35,
});
const innerGlass = new MeshStandardMaterial({
  color: 0x7a9a92, emissive: 0xe7b46c, emissiveIntensity: 0, metalness: .08, roughness: .38,
});
const clockIvory = new MeshStandardMaterial({ color: 0xe4cea0, roughness: .67, emissive: 0xf4cc84, emissiveIntensity: 0 });
const domeSlate = new MeshStandardMaterial({ color: 0x375358, roughness: .74, metalness: .20 });
const domeCopper = new MeshStandardMaterial({ color: 0x658479, roughness: .64, metalness: .33 });
const brightBrass = new MeshStandardMaterial({ color: 0xd3af71, roughness: .52, metalness: .38 });
const steelGlazing = new MeshStandardMaterial({ color: 0x425452, roughness: .64, metalness: .25 });

function cutStone(color: number, course: number, density: number) {
  const surface = new MeshStandardMaterial({ color, roughness: .91 });
  surface.customProgramCacheKey = () => `municipal-ashlar-${course}-${density}`;
  surface.onBeforeCompile = shader => {
    shader.vertexShader = `varying vec3 masonryPosition;\n${shader.vertexShader}`.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n masonryPosition = position;');
    shader.fragmentShader = `varying vec3 masonryPosition;\n${shader.fragmentShader}`.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 joint = vec2(atan(masonryPosition.x, masonryPosition.z) * ${density.toFixed(3)}, masonryPosition.y / ${course.toFixed(3)});
      joint.x += mod(floor(joint.y), 2.0) * .5;
      vec2 stepWidth = fwidth(joint);
      vec2 portion = fract(joint);
      float close = 1.0 - smoothstep(.16, .56, max(stepWidth.x, stepWidth.y));
      vec2 seam = 1.0 - smoothstep(vec2(.023), vec2(.076), min(portion, 1.0 - portion));
      float block = fract(sin(dot(floor(joint), vec2(134.9, 361.81))) * 713.9) - .5;
      float edge = smoothstep(.11, .26, portion.y) - smoothstep(.77, .97, portion.y);
      float weather = sin(masonryPosition.x * 7.4 + sin(masonryPosition.z * 3.0) - masonryPosition.y * .57) * .035;
      diffuseColor.rgb *= 1.0 + weather + close * (.19 * block + .075 * edge - max(seam.x * .71, seam.y) * .19);
    `);
  };
  return surface;
}

const cutSandstone = cutStone(0xcab493, .214, 4.137);
const cutPlinth = cutStone(0xb29a7b, .248, 4.456);

const origin = new Vector3();
const up = new Vector3(0, 1, 0);
const end = new Vector3();
const flatBox = new BoxGeometry(1, 1, 1);
const rod = new CylinderGeometry(1, 1, 1, 9);
const clockDisc = new CylinderGeometry(1, 1, 1, 36);

class Monument {
  private readonly pieces = new Map<MeshStandardMaterial, BufferGeometry[]>();

  private bake(geometry: BufferGeometry, material: MeshStandardMaterial, configure: (object: Mesh) => void) {
    const object = new Mesh(geometry, material);
    configure(object);
    object.updateMatrix();
    const part = geometry.clone();
    if (!part.index) part.setIndex(Array.from({ length: part.getAttribute('position').count }, (_, index) => index));
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

  panel(material: MeshStandardMaterial, points: readonly Point[]) {
    const geometry = new BufferGeometry();
    const indices: number[] = [];
    for (let index = 1; index < points.length - 1; index++) indices.push(0, index, index + 1);
    geometry.setAttribute('position', new Float32BufferAttribute(points.flat(), 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(new Float32Array(points.length * 2), 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    this.bake(geometry, material, () => {});
    geometry.dispose();
  }

  profile(material: MeshStandardMaterial, points: readonly (readonly [radius: number, height: number])[], sides: number) {
    const shape = new LatheGeometry(points.map(([radius, height]) => new Vector2(radius, height)), sides, Math.PI / sides);
    this.bake(shape, material, () => {});
    shape.dispose();
  }

  disc(material: MeshStandardMaterial, center: Point, diameter: number, depth: number, heading: number) {
    this.bake(clockDisc, material, object => {
      object.position.set(...center);
      object.scale.set(diameter / 2, depth, diameter / 2);
      object.quaternion.setFromUnitVectors(up, end.set(Math.sin(heading), 0, Math.cos(heading)));
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
    const geometry = new TorusGeometry(radius, thickness, 5, 32);
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
      mesh.castShadow = material !== lantern && material !== innerGlass && material !== clockIvory;
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

const eighth = Math.PI / 4;
const apothem = Math.cos(eighth / 2);
const halfFace = Math.sin(eighth / 2);

type OctagonalBay = {
  angle: number;
  base: number;
  top: number;
  width: (y: number) => number;
  point: (x: number, y: number, outset?: number) => Point;
};

function bay(angle: number, base: number, top: number, bottomRadius: number, topRadius = bottomRadius): OctagonalBay {
  const radius = (y: number) => bottomRadius + (topRadius - bottomRadius) * (y - base) / (top - base);
  return {
    angle, base, top,
    width: y => radius(y) * halfFace,
    point: (x, y, outset = 0) => radial(angle, radius(y) * apothem + outset, y, x),
  };
}

function infill(kit: Monument, bay: OctagonalBay, material: MeshStandardMaterial, bottom: number, top: number) {
  const lower = bay.width(bottom), upper = bay.width(top);
  kit.panel(material, [bay.point(-lower, bottom), bay.point(lower, bottom), bay.point(upper, top), bay.point(-upper, top)]);
}

function archway(kit: Monument, wall: OctagonalBay, material: MeshStandardMaterial,
  width: number, bottom: number, top: number, glazed: MeshStandardMaterial, entrance = false) {
  const half = width / 2;
  const height = top - bottom;
  const archRise = height * (entrance ? .34 : .33);
  const spring = top - archRise;
  const depth = entrance ? -.218 : -.156;
  const rim = entrance ? .102 : .078;
  const pane = half - (entrance ? .048 : .033);
  const trim = entrance ? stone : cream;
  const local = (x: number, y: number, outset: number) => wall.point(x, y, outset);
  const strip = (mat: MeshStandardMaterial, left: number, right: number, base: number, tip: number, at: number) => {
    kit.panel(mat, [local(left, base, at), local(right, base, at), local(right, tip, at), local(left, tip, at)]);
  };
  infill(kit, wall, material, wall.base, bottom);
  for (const edge of [-1, 1]) {
    const lowerOuter = local(edge * wall.width(bottom), bottom, 0);
    const lowerInner = local(edge * half, bottom, 0);
    const upperOuter = local(edge * wall.width(wall.top), wall.top, 0);
    const upperInner = local(edge * half, wall.top, 0);
    const face = [lowerOuter, lowerInner, upperInner, upperOuter];
    kit.panel(material, edge === -1 ? face : face.reverse());
    const curve = (x: number, y: number, side: number) => local(edge * x, y, side);
    const reveal = [curve(half, bottom, rim), curve(pane, bottom + .019, depth), curve(pane, spring, depth), curve(half, spring, rim)];
    kit.panel(stone, edge === -1 ? reveal : reveal.reverse());
    kit.box(trim, local(edge * (half + .021), (bottom + spring) / 2, rim - .027),
      [entrance ? .106 : .071, spring - bottom, .077], wall.angle);
    kit.box(cream, local(edge * (half + .024), spring - .013, rim - .007),
      [entrance ? .161 : .111, .081, .088], wall.angle);
  }
  const arc = (angle: number, radius: number, rise: number, at: number) =>
    local(Math.cos(angle) * radius, spring + Math.sin(angle) * rise, at);
  for (let index = 0; index < 10; index++) {
    const from = index * Math.PI / 10, to = (index + 1) * Math.PI / 10;
    const front = arc(from, half, archRise, 0), next = arc(to, half, archRise, 0);
    kit.panel(material, [wall.point(Math.cos(from) * half, wall.top), wall.point(Math.cos(to) * half, wall.top), next, front]);
    const lower = arc(from, pane, archRise - .019, depth), upper = arc(to, pane, archRise - .019, depth);
    kit.panel(stone, [arc(from, half, archRise, rim), arc(to, half, archRise, rim), upper, lower]);
    kit.panel(glazed, [local(0, spring - .006, depth + .007), lower, upper]);
    const keystone = index === 4 || index === 5;
    const offset = keystone ? .076 : .058;
    kit.panel(keystone ? cream : trim, [
      arc(from + .013, half + offset, archRise + offset, rim + .028),
      arc(to - .013, half + offset, archRise + offset, rim + .028),
      arc(to - .013, half - .001, archRise -.002, rim),
      arc(from + .013, half - .001, archRise -.002, rim),
    ]);
  }
  strip(glazed, -pane, pane, bottom + .009, spring, depth + .012);
  const sash = depth + .043;
  kit.box(steelGlazing, local(0, spring, sash), [pane * 2, .028, .035], wall.angle);
  kit.box(steelGlazing, local(0, (bottom + top) / 2, sash), [.031, top - bottom - .063, .033], wall.angle);
  if (entrance) {
    for (const edge of [-1, 1]) {
      kit.box(steelGlazing, local(edge * pane * .50, bottom + .205, sash + .013), [pane - .014, .40, .047], wall.angle);
      kit.box(copper, local(edge * .068, bottom + .406, sash + .047), [.023, .091, .023], wall.angle);
    }
    for (const x of [-.70, .70]) {
      kit.beam(steelGlazing, local(0, spring + .014, sash), local(x * pane, spring + archRise * .59, sash), .016);
    }
  } else {
    kit.box(steelGlazing, local(0, bottom + .37 * height, sash), [pane * 2, .025, .034], wall.angle);
  }
  kit.box(trim, local(0, bottom - .042, rim - .049), [width + .198, .082, .192], wall.angle);
}

function caisson(kit: Monument) {
  kit.tier(shadow, 2.51, 2.43, -1.52, -.62, 28);
  kit.profile(cutPlinth, [[2.51, -.64], [2.58, -.56], [2.60, -.43], [2.59, -.20], [2.57, -.12], [2.48, -.075]], 28);
  kit.profile(cream, [[2.48, -.085], [2.59, -.078], [2.60, -.020], [2.60, .038], [2.51, .059]], 28);
  // The plinth is a solid marine foundation, capped below the quay's visible iron rail.
  kit.tier(stone, 2.48, 2.51, .035, .087, 28);
  kit.tier(pier, 2.32, 2.40, .083, .133, 28);
  for (let i = 0; i < 20; i++) {
    const angle = i * Math.PI / 10;
    const pierGate = i % 5 === 0;
    const next = angle + Math.PI / 10;
    kit.box(pierGate ? cream : stone, radial(angle, 2.421, .191), [pierGate ? .130 : .064, pierGate ? .251 : .202, .082], angle);
    kit.box(copper, radial(angle, 2.424, pierGate ? .324 : .281), [pierGate ? .150 : .073, .034, .086], angle);
    kit.beam(ink, radial(angle, 2.420, .162), radial(next, 2.420, .162), .012);
    kit.beam(ink, radial(angle, 2.420, .258), radial(next, 2.420, .258), .012);
  }
}

function rusticatedPavilion(kit: Monument) {
  kit.profile(cream, [[2.17, .118], [2.19, .17], [2.18, .222], [2.05, .265], [2.04, .382]], 8);
  kit.profile(stone, [[2.04, .372], [2.06, .424], [2.06, .486], [1.97, .524]], 8);
  for (let sector = 0; sector < 8; sector++) {
    const axis = sector * eighth;
    const primary = sector % 2 === 0;
    const face = bay(axis, .484, 1.992, 1.99, 1.90);
    archway(kit, face, cutPlinth, primary ? .728 : .506, primary ? .645 : .774,
      primary ? 1.797 : 1.735, primary ? innerGlass : glass, primary);
    for (const edge of [-1, 1]) {
      const x = edge * face.width(.63) * .82;
      kit.beam(stone, face.point(x, .545, .031), face.point(x * .969, 1.971, .034), .039);
      for (const [row, y] of [.655, .928, 1.200, 1.472, 1.746].entries()) {
        const inward = edge * (primary ? .060 : .051) * (row % 2 ? 1 : -1);
        kit.box(row % 2 ? stone : cream, face.point(x + inward, y, .053), [row % 2 ? .151 : .197, .119, .130], axis);
      }
    }
    if (primary) {
      kit.box(stone, face.point(0, .543, .198), [1.014, .106, .383], axis);
      kit.box(cream, face.point(0, .608, .136), [.913, .071, .381], axis);
    }
  }
  kit.profile(stone, [[1.90, 1.940], [1.96, 1.993], [2.02, 2.035], [2.02, 2.092], [1.93, 2.118]], 8);
  kit.profile(cream, [[1.93, 2.104], [1.98, 2.128], [1.98, 2.180], [1.89, 2.206], [1.71, 2.252], [1.56, 2.361]], 8);
  kit.profile(steelGlazing, [[1.91, 2.252], [1.87, 2.320], [1.69, 2.383], [1.54, 2.389]], 8);
}

function shaftMasonry(kit: Monument) {
  const levels = [
    { base: 2.318, top: 3.542, start: 1.52, end: 1.469 },
    { base: 3.542, top: 4.805, start: 1.469, end: 1.417 },
    { base: 4.805, top: 6.095, start: 1.417, end: 1.372 },
  ];
  for (const [row, floor] of levels.entries()) {
    for (let side = 0; side < 8; side++) {
      const angle = side * eighth;
      const wall = bay(angle, floor.base, floor.top, floor.start, floor.end);
      const decorativeBay = side % 2 === 0;
      const glazed = (side + row) % 4 === 0 ? innerGlass : glass;
      const openingWidth = (decorativeBay ? .406 : .307) + (row === 1 ? -.032 : row === 2 ? .025 : 0);
      const bottom = floor.base + (row === 0 ? .218 : row === 1 ? .250 : .160);
      archway(kit, wall, cutSandstone, openingWidth, bottom, floor.top - .125, glazed);
      if (row === 2 && !decorativeBay) {
        for (const y of [.26, .37, .48, .59]) {
          kit.box(steelGlazing, wall.point(0, bottom + y, -.084), [openingWidth * .75, .029, .031], angle, -.128);
        }
      }
      if (decorativeBay && row < 2) {
        const sill = floor.base + .129;
        kit.box(stone, wall.point(0, sill, .102), [.567, .070, .221], angle);
        for (const x of [-.076, .076]) {
          kit.box(cream, wall.point(x * 2, sill - .057, .101), [.103, .047, .187], angle);
        }
      }
    }
    if (row > 0) {
      kit.profile(cream, [[floor.start, floor.base -.033], [floor.start + .036, floor.base -.010],
        [floor.start + .036, floor.base + .042], [floor.start, floor.base + .068]], 8);
    }
  }
  for (let side = 0; side < 8; side++) {
    const a = side * eighth + eighth / 2;
    kit.beam(stone, radial(a, 1.513, 2.335), radial(a, 1.365, 6.033), .107);
    kit.beam(cream, radial(a, 1.566, 2.455), radial(a, 1.425, 5.987), .079);
    kit.box(cream, radial(a, 1.532, 2.449), [.171, .150, .146], a);
    kit.box(stone, radial(a, 1.426, 5.916), [.152, .205, .145], a);
    kit.box(cream, radial(a, 1.444, 6.004), [.162, .084, .160], a);
  }
}

const clockHeight = 7.040;
const dialRadius = 1.598;
const handBar = new BoxGeometry(.013, .222, .014);

const romanStrokes = {
  I: [[0, -.5, 0, .5]],
  V: [[-.39, .5, 0, -.5], [0, -.5, .39, .5]],
  X: [[-.39, -.5, .39, .5], [-.39, .5, .39, -.5]],
} as const;

function chapterMark(kit: Monument, angle: number, x: number, y: number, text: readonly (keyof typeof romanStrokes)[]) {
  for (const [column, glyph] of text.entries()) {
    const shift = x + (column - (text.length - 1) / 2) * .0174;
    for (const [fromX, fromY, toX, toY] of romanStrokes[glyph]) {
      const x0 = shift + fromX * .014, y0 = clockHeight + y + fromY * .032;
      const x1 = shift + toX * .014, y1 = clockHeight + y + toY * .032;
      const length = Math.hypot(x1 - x0, y1 - y0);
      const side = (y1 - y0) * .0028 / length, rise = (x0 - x1) * .0028 / length;
      const d = dialRadius + .044;
      kit.panel(ink, [radial(angle, d, y0 + rise, x0 + side), radial(angle, d, y1 + rise, x1 + side),
        radial(angle, d, y1 - rise, x1 - side), radial(angle, d, y0 - rise, x0 - side)]);
    }
  }
}

function clockFace(kit: Monument, face: OctagonalBay) {
  const a = face.angle;
  kit.box(stone, face.point(0, clockHeight, .043), [.795, .841, .129], a);
  kit.box(cream, face.point(0, clockHeight - .436, .064), [.864, .059, .162], a);
  kit.box(stone, face.point(0, clockHeight + .441, .060), [.837, .089, .151], a);
  kit.disc(ink, radial(a, dialRadius - .079, clockHeight), .712, .10, a);
  kit.disc(brightBrass, radial(a, dialRadius - .023, clockHeight), .674, .047, a);
  kit.disc(clockIvory, radial(a, dialRadius + .005, clockHeight), .594, .032, a);
  kit.ring(copper, radial(a, dialRadius + .025, clockHeight), .266, .010, [0, a, 0]);
  const tickAt = dialRadius + .043;
  for (let mark = 0; mark < 12; mark++) {
    if (mark % 3 === 0) continue;
    const angle = mark * Math.PI / 6;
    const inner = .226;
    const outer = .248;
    kit.beam(ink, radial(a, tickAt, clockHeight + Math.cos(angle) * inner, Math.sin(angle) * inner),
      radial(a, tickAt, clockHeight + Math.cos(angle) * outer, Math.sin(angle) * outer), .008);
  }
  chapterMark(kit, a, 0, .232, ['X', 'I', 'I']);
  chapterMark(kit, a, .220, 0, ['I', 'I', 'I']);
  chapterMark(kit, a, 0, -.231, ['V', 'I']);
  chapterMark(kit, a, -.221, 0, ['I', 'X']);
  for (const x of [-.35, .35]) {
    for (const side of [-1, 1]) {
      kit.box(cream, face.point(x, clockHeight + side * .329, .112), [.048, .092, .043], a);
      kit.disc(copper, face.point(x, clockHeight + side * .327, .141), .041, .009, a);
    }
  }
  const pins = dialRadius + .055;
  kit.disc(ink, radial(a, pins, clockHeight), .047, .018, a);
}

function clockRoom(kit: Monument) {
  kit.profile(stone, [[1.37, 6.018], [1.47, 6.056], [1.57, 6.114], [1.57, 6.191], [1.66, 6.237]], 8);
  kit.profile(cream, [[1.66, 6.217], [1.72, 6.267], [1.72, 6.326], [1.64, 6.375]], 8);
  kit.profile(cutSandstone, [[1.64, 6.348], [1.56, 6.435], [1.56, 6.545]], 8);
  for (let side = 0; side < 8; side++) {
    const a = side * eighth;
    const face = bay(a, 6.49, 7.643, 1.56);
    if (side % 2 === 0) {
      infill(kit, face, cutSandstone, face.base, face.top);
      clockFace(kit, face);
    } else {
      archway(kit, face, cutSandstone, .484, 6.645, 7.489, innerGlass);
      for (const y of [6.840, 6.943, 7.046, 7.149, 7.251]) {
        kit.box(steelGlazing, face.point(0, y, -.074), [.294, .042, .046], a, -.168);
      }
    }
    for (const x of [-.521, .521]) {
      kit.box(stone, face.point(x, 7.062, .014), [.099, 1.12, .123], a);
      kit.box(cream, face.point(x, 6.550, .043), [.145, .140, .151], a);
      kit.box(cream, face.point(x, 7.560, .053), [.155, .123, .148], a);
    }
    for (const x of [-.42, -.214, 0, .214, .42]) {
      kit.box(cream, face.point(x, 7.681, .155), [.059, .096, .136], a);
    }
  }
  kit.profile(cream, [[1.56, 7.604], [1.68, 7.668], [1.74, 7.727], [1.74, 7.790]], 8);
  kit.profile(steelGlazing, [[1.74, 7.773], [1.782, 7.805], [1.764, 7.879], [1.698, 7.924]], 16);
}

function verdigrisCupola(kit: Monument) {
  const profile = [[1.703, 7.900], [1.653, 8.072], [1.565, 8.271], [1.441, 8.470],
    [1.254, 8.675], [.994, 8.853], [.684, 8.991], [.391, 9.080]] as const;
  kit.profile(domeSlate, profile, 32);
  // Raised copper seams follow the dome over continuously curved slate panels.
  for (let side = 0; side < 12; side++) {
    const angle = side * Math.PI / 6;
    for (let step = 1; step < profile.length; step++) {
      const [lower, base] = profile[step - 1], [upper, top] = profile[step];
      kit.beam(side % 3 === 0 ? copper : domeCopper, radial(angle, lower + .014, base), radial(angle, upper + .014, top), side % 3 === 0 ? .024 : .017);
    }
  }
  for (const [index, y] of [8.044, 8.400, 8.742].entries()) {
    const marker = profile.findIndex(([, height]) => height > y);
    const from = profile[marker - 1], to = profile[marker];
    const r = from[0] + (to[0] - from[0]) * (y - from[1]) / (to[1] - from[1]);
    kit.profile(index ? domeCopper : copper, [[r + .021, y - .014], [r + .026, y], [r + .014, y + .016]], 32);
  }
  kit.profile(copper, [[.377, 9.044], [.421, 9.082], [.421, 9.134], [.304, 9.183]], 12);
  kit.tier(lantern, .187, .187, 9.170, 9.614, 12);
  for (let side = 0; side < 8; side++) {
    const a = side * eighth;
    kit.box(steelGlazing, radial(a, .236, 9.390), [.049, .454, .067], a);
    kit.box(copper, radial(a, .236, 9.201), [.087, .066, .097], a);
    kit.box(copper, radial(a, .236, 9.590), [.091, .064, .095], a);
  }
  kit.profile(steelGlazing, [[.242, 9.584], [.310, 9.638], [.303, 9.695], [.201, 9.805], [.091, 9.865]], 16);
  kit.tier(copper, .094, .113, 9.848, 9.914, 12);
  kit.tier(brightBrass, .037, .090, 9.906, 9.991, 12);
  kit.tier(copper, .012, .044, 9.981, 10.186, 9);
}

function clockwork() {
  const clocks: { hour: Group; minute: Group; sweep: Group }[] = [];
  const faces = new Group();
  faces.name = 'Four clock mechanisms';
  for (let n = 0; n < 4; n++) {
    const angle = n * Math.PI / 2;
    const support = new Group();
    support.position.set(...radial(angle, dialRadius + .077, clockHeight));
    support.rotation.y = angle;
    const hand = (length: number, width: number, depth: number, material: MeshStandardMaterial) => {
      const pivot = new Group();
      const blade = new Mesh(handBar, material);
      blade.scale.set(width / .013, length / .222, .85);
      blade.position.set(0, length * .425, depth);
      pivot.add(blade);
      support.add(pivot);
      return pivot;
    };
    clocks.push({ hour: hand(.146, .031, .001, ink), minute: hand(.225, .023, .007, ink), sweep: hand(.221, .010, .017, copper) });
    faces.add(support);
  }
  let lastTick = -1;
  return {
    faces,
    tick(time: number) {
      const second = Math.trunc(time / 1000);
      if (lastTick === second) return;
      lastTick = second;
      const fraction = Math.PI * 2;
      const localTime = second + 8 * 3600 + 17 * 60;
      for (const { hour, minute, sweep } of clocks) {
        hour.rotation.z = -localTime / (12 * 3600) * fraction;
        minute.rotation.z = -localTime / 3600 * fraction;
        sweep.rotation.z = -localTime / 60 * fraction;
      }
    },
  };
}

function observatory() {
  const kit = new Monument();
  caisson(kit);
  rusticatedPavilion(kit);
  shaftMasonry(kit);
  clockRoom(kit);
  verdigrisCupola(kit);
  const shape = kit.finish();
  const { faces, tick } = clockwork();
  shape.add(faces);
  shape.name = 'Central tidal observatory';
  shape.userData.parcel = 'ring-observatory';
  shape.scale.y = 1.13;
  tick(0);
  return { shape, tick };
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
  const architecture = buildCityArchitecture();
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
  city.add(monument.shape, tideGate(), tideGateApron(), breakwater(), servicePier(), pilotsStation(), boardingSpur(), abutmentRail());
  city.userData.update = (time: number, darkness: number) => {
    monument.tick(time);
    updateRingArchitecture(darkness);
  };
  return city;
}

export function updateRingArchitecture(darkness: number) {
  const night = Math.max(0, Math.min(1, darkness));
  lantern.emissiveIntensity = .015 + night * 1.03;
  innerGlass.emissiveIntensity = night * .46;
  clockIvory.emissiveIntensity = night * .30;
}
