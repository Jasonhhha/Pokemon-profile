import {
  BufferGeometry, Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Float32BufferAttribute, Group,
  IcosahedronGeometry, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, type ColorRepresentation,
} from 'three';
import { tileAt, type FieldArea } from './field-layout';

type Placement = [x: number, y: number, z: number, w: number, h: number, d: number, angle: number, color: ColorRepresentation];

const pineGeometry = new ConeGeometry(1, 1, 7);
const trunkGeometry = new CylinderGeometry(.67, .95, 1, 6);
const rockGeometry = new DodecahedronGeometry(1, 0);
const petalGeometry = new IcosahedronGeometry(1, 0);

function seed(x: number, z: number, salt: number) {
  const wave = Math.sin(x * 12.9898 + z * 78.233 + salt * 19.87) * 43758.5453123;
  return wave - Math.floor(wave);
}

function batch(parent: Group, geometry: BufferGeometry, pieces: Placement[], castShadow = false) {
  if (!pieces.length) return;
  const material = new MeshStandardMaterial({ roughness: .96, flatShading: true });
  const instances = new InstancedMesh(geometry, material, pieces.length);
  const dummy = new Object3D();
  const color = new Color();
  pieces.forEach(([x, y, z, w, h, d, angle, hue], index) => {
    dummy.position.set(x, y, z);
    dummy.scale.set(w, h, d);
    dummy.rotation.y = angle;
    dummy.updateMatrix();
    instances.setMatrixAt(index, dummy.matrix);
    instances.setColorAt(index, color.set(hue));
  });
  instances.castShadow = castShadow;
  instances.receiveShadow = true;
  instances.computeBoundingSphere();
  parent.add(instances);
}

// Staggered profiles meet at the same vertices to give each ridge a continuous, faceted surface.
function ridge(parent: Group, x: number, z: number, width: number, depth: number, height: number, hue: number, salt: number) {
  const positions: number[] = [];
  const colors: number[] = [];
  const count = 15;
  const paint = new Color(hue);
  const row = (latitude: number) => Array.from({ length: count }, (_, i) => {
    const at = i / (count - 1);
    const envelope = Math.sin(at * Math.PI) ** .53;
    const high = .64 + .32 * seed(i, salt, 3);
    const profiles = [0, .24, .59, 1, .61, .29, 0];
    const bump = profiles[latitude] * height * envelope * high;
    return [x + (at - .5) * width + (seed(i, latitude, salt) - .5) * width / count * .62,
      -.44 + bump, z + (latitude / 6 - .5) * depth + (seed(i, latitude, salt + 9) - .5) * depth * .19];
  });
  const points = Array.from({ length: 7 }, (_, latitude) => row(latitude));
  const face = (a: number[], b: number[], c: number[], latitude: number, triangle: number) => {
    positions.push(...a, ...b, ...c);
    const tint = paint.clone().multiplyScalar(.89 + seed(latitude, triangle, salt) * .25);
    colors.push(tint.r, tint.g, tint.b, tint.r, tint.g, tint.b, tint.r, tint.g, tint.b);
  };
  for (let v = 0; v < 6; v++) {
    for (let i = 0; i < count - 1; i++) {
      const a = points[v][i], b = points[v + 1][i], c = points[v][i + 1], d = points[v + 1][i + 1];
      face(a, b, c, v, i * 2);
      face(c, b, d, v, i * 2 + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const escarpment = new Mesh(geometry, new MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  escarpment.receiveShadow = true;
  parent.add(escarpment);
}

export function buildFieldDressing(area: FieldArea) {
  const root = new Group();
  const canopy: Placement[] = [];
  const trunks: Placement[] = [];
  const rocks: Placement[] = [];
  const petals: Placement[] = [];
  if (area === 'grove') {
    ridge(root, 12, -4.9, 35, 10, 3.2, 0x67897a, 3);
    ridge(root, 32, -5.4, 29, 9, 3.7, 0x709084, 2);
  } else if (area === 'summit') {
    ridge(root, 16, -12.0, 43, 11, 8.5, 0x899caf, 1);
    ridge(root, 33, -8.3, 33, 12.5, 7.4, 0x8691a4, 8);
    ridge(root, 7, -3.8, 23, 8.0, 4.0, 0x838e99, 4);
    ridge(root, 30, -3.6, 26, 9.5, 4.6, 0x8d94a0, 5);
  }

  if (area !== 'harbor') {
    const density = area === 'grove' ? 75 : 37;
    const colors = area === 'grove' ? [0x345d51, 0x456e5d, 0x4c775f, 0x527b67] : [0x47636c, 0x4e7077, 0x567983, 0x627e85];
    for (let i = 0; i < density; i++) {
      const x = -6 + seed(i, 2, 5) * 52;
      const z = .12 - seed(i, 3, 5) * (area === 'grove' ? 3.8 : 1.3);
      const size = 1.25 + seed(i, 4, 3) * 2.4;
      const lift = 0;
      const angle = seed(i, 5, 4) * Math.PI;
      trunks.push([x, lift + size * .29, z, .16, size * .62, .15, angle, 0x4e5145]);
      for (let tier = 0; tier < 4; tier++) {
        const wide = size * (.29 - tier * .049);
        const height = size * (.51 - tier * .021);
        const y = lift + size * (.42 + tier * .16);
        const stagger = (seed(i, tier, 3) - .5) * size * .065;
        canopy.push([x + stagger, y, z - stagger, wide, height, wide * .87, angle + tier * .7, colors[(i + tier) % colors.length]]);
      }
    }
  }

  const flowerColors = area === 'harbor' ? [0xf3d49b, 0xe7d9b7, 0xf0c7aa] :
    area === 'grove' ? [0xe5dd9e, 0xd9d3ad, 0xbcb4ce] : [0xded1aa, 0xc1b6c3, 0xdcc0ae];
  const stoneColors = area === 'summit' ? [0x9599a9, 0x9196a7, 0xa7a5b0, 0x7e8993] : [0xb2b099, 0x9ea18c, 0xbfb79d];
  const clusters = area === 'summit' ? 110 : 88;
  for (let i = 0; i < clusters; i++) {
    const x = 1.5 + seed(i, 2, 49) * 37;
    const z = .6 + seed(i, 5, 25) * 22.6;
    const tile = tileAt(area, Math.floor(x), Math.floor(z));
    if (tile !== 'lawn' && tile !== 'shore' && tile !== 'grass') continue;
    if (area === 'summit' || seed(i, 7, 4) > .47) {
      const count = 2 + Math.floor(seed(i, 9, 11) * 3);
      for (let j = 0; j < count; j++) {
        const size = .035 + seed(i, j, 12) * .13;
        rocks.push([x + (seed(i, j, 40) - .5) * .89, size * .27, z + (seed(i, j, 28) - .5) * .71, size * 1.3, size * .42, size, seed(i, j, 22) * 6, stoneColors[(i + j) % stoneColors.length]]);
      }
    }
    if (tile !== 'lawn' || seed(i, 27, 23) > (area === 'harbor' ? .76 : .41)) continue;
    const mass = 4 + Math.floor(seed(i, 42, 5) * 6);
    for (let j = 0; j < mass; j++) {
      const bloomX = x + (seed(i, j, 14) - .5) * 1.18;
      const bloomZ = z + (seed(i, j, 53) - .5) * .96;
      const flowerHeight = .072 + seed(i, j, 13) * .15;
      petals.push([bloomX, flowerHeight, bloomZ, .046, .025, .046, j, flowerColors[(i + j) % flowerColors.length]]);
      petals.push([bloomX + .025, flowerHeight * .46, bloomZ, .067, .035, .025, i + j, area === 'summit' ? 0x7f916e : 0x6d884f]);
    }
  }

  if (area === 'summit') {
    for (let i = 0; i < 26; i++) {
      const x = -1 + seed(i, 8, 15) * 43;
      const z = -1 + seed(i, 9, 18) * 1.9;
      const size = .28 + seed(i, 10, 19) * .70;
      rocks.push([x, size * .22, z, size, size * .53, size * .72, i, stoneColors[i % stoneColors.length]]);
    }
  }
  batch(root, trunkGeometry, trunks, true);
  batch(root, pineGeometry, canopy, true);
  batch(root, rockGeometry, rocks);
  batch(root, petalGeometry, petals);
  return root;
}
