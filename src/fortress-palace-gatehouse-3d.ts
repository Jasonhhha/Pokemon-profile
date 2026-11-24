import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshStandardMaterial,
  ShaderMaterial,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
} from 'three';
import {
  gateFinishes,
  gatehouseFabric,
  gateLightwells,
  gateLoadDial,
  gatePointerAngle,
  gatePointerVertices,
  type GateFinish,
} from './fortress-palace-gatehouse';

function dressedStone() {
  const size = 128,
    pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const row = Math.floor(y / 32),
        column = (x + (row % 2) * 32) % 64;
      const joint = Math.min(y % 32, 32 - (y % 32), column, 64 - column);
      const hash = Math.imul(x + 19, 776531) ^ Math.imul(y + 73, 923791);
      const grain = ((Math.imul(hash ^ (hash >>> 9), 69283) >>> 0) % 131) / 131;
      const l = joint < 1 ? 179 : joint <= 2 ? 235 : 230 + grain * 16 + 4 * Math.sin(x * 0.14 + y * 0.11);
      const i = (y * size + x) * 4;
      pixels[i] = l;
      pixels[i + 1] = l;
      pixels[i + 2] = l;
      pixels[i + 3] = 255;
    }
  const texture = new DataTexture(pixels, size, size, RGBAFormat);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

// The light is scattered by damp air between a glazed slot and the open pool beneath it.
function lightShafts() {
  const geometry = new BufferGeometry();
  const xyz: number[] = [],
    uv: number[] = [];
  for (const well of gateLightwells)
    for (const [dx, dz] of [
      [0.91, 0.13],
      [-0.14, 0.66],
    ]) {
      for (const [edge, depth] of [
        [-1, 0],
        [1, 0],
        [1, 1],
        [-1, 0],
        [1, 1],
        [-1, 1],
      ]) {
        const width = 0.245 + 0.73 * depth;
        xyz.push(
          well.x + (well.waterX - well.x) * depth + edge * dx * width,
          well.h + 0.43 + (well.waterHeight - well.h - 0.43) * depth,
          well.z + 0.28 + (well.waterZ - well.z - 0.28) * depth + edge * dz * width,
        );
        uv.push((edge + 1) * 0.5, depth);
      }
    }
  geometry.setAttribute('position', new Float32BufferAttribute(xyz, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    vertexShader:
      'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying vec2 vUv;
      void main(){
        float edge=sin(3.14159*vUv.x),through=smoothstep(0.0,.075,vUv.y)*(1.0-smoothstep(.80,1.0,vUv.y));
        float grille=sin(vUv.x*13.0); float stripes=.81+.19*grille*grille;
        gl_FragColor=vec4(.55,.76,.72,edge*edge*through*stripes*(.054-.032*vUv.y));
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = 3;
  return mesh;
}

export function buildPalaceGatehouse() {
  const group = new Group(),
    texture = dressedStone();
  const buffers = new Map<GateFinish, { positions: number[]; shade: number[]; uv: number[] }>();
  for (const face of gatehouseFabric()) {
    const batch = buffers.get(face.finish) ?? { positions: [], shade: [], uv: [] };
    buffers.set(face.finish, batch);
    const [a, b, c] = face.vertices;
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      dh = b[2] - a[2],
      ex = c[0] - a[0],
      ez = c[1] - a[1],
      eh = c[2] - a[2];
    const nx = Math.abs(dh * ez - dz * eh),
      ny = Math.abs(dz * ex - dx * ez),
      nz = Math.abs(dx * eh - dh * ex);
    for (let i = 1; i < face.vertices.length - 1; i++)
      for (const [x, z, h] of [a, face.vertices[i], face.vertices[i + 1]]) {
        batch.positions.push(x, h, z);
        batch.shade.push(face.tint, face.tint, face.tint);
        const top = ny >= nx && ny >= nz;
        batch.uv.push((top || nz >= nx ? x : z) * 0.53, (top ? z : h) * 0.53);
      }
  }
  const surfaces: Mesh<BufferGeometry, MeshStandardMaterial>[] = [];
  for (const [finish, batch] of buffers) {
    const stone = finish === 'ashlar' || finish === 'limestone' || finish === 'bedrock' || finish === 'soffit';
    const lit = finish === 'light' || finish === 'opal' || finish === 'smokedGlass',
      metal = !stone && !lit;
    const material = new MeshStandardMaterial({
      color: new Color(gateFinishes[finish]),
      map: stone ? texture : null,
      side: DoubleSide,
      vertexColors: true,
      roughness: stone ? 0.9 : lit ? 0.38 : 0.54,
      metalness: metal ? 0.3 : 0.025,
      bumpMap: stone ? texture : null,
      bumpScale: stone ? 0.033 : 0,
      emissive: finish === 'smokedGlass' ? 0x638d85 : finish === 'opal' ? 0x8dc8c6 : lit ? 0xf0b880 : 0x000000,
      emissiveIntensity: finish === 'smokedGlass' ? 0.53 : lit ? 0.82 : 0,
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(batch.positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(batch.shade, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(batch.uv, 2));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = !lit;
    mesh.receiveShadow = true;
    group.add(mesh);
    surfaces.push(mesh);
  }
  const shafts = lightShafts();
  const needleGeometry = new BufferGeometry(),
    needleVertices = gatePointerVertices(0.5),
    needleData = [];
  for (let i = 1; i < needleVertices.length - 1; i++)
    for (const [x, z, h] of [needleVertices[0], needleVertices[i], needleVertices[i + 1]])
      needleData.push(x - gateLoadDial.x, h - gateLoadDial.height, z - gateLoadDial.z);
  needleGeometry.setAttribute('position', new Float32BufferAttribute(needleData, 3));
  needleGeometry.computeVertexNormals();
  const needleMaterial = new MeshStandardMaterial({
    color: 0xffdd96,
    emissive: 0x9d6d3e,
    emissiveIntensity: 0.52,
    roughness: 0.39,
    side: DoubleSide,
  });
  const needle = new Mesh(needleGeometry, needleMaterial);
  needle.position.set(gateLoadDial.x, gateLoadDial.height, gateLoadDial.z);
  group.add(shafts, needle);
  return {
    group,
    update(load: number) {
      needle.rotation.z = -gatePointerAngle(load);
    },
    dispose() {
      for (const part of surfaces) {
        part.geometry.dispose();
        part.material.dispose();
      }
      needle.geometry.dispose();
      needle.material.dispose();
      shafts.geometry.dispose();
      shafts.material.dispose();
      texture.dispose();
    },
  };
}
