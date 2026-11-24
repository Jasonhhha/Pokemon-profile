import {
  AdditiveBlending, BufferGeometry, CanvasTexture, Color, CylinderGeometry, DoubleSide, EquirectangularReflectionMapping,
  Float32BufferAttribute, Group, InstancedMesh, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, ShaderMaterial, Sprite,
  SpriteMaterial, SRGBColorSpace,
} from 'three';
import { cityLighthouseSite, cityParcels, cityTerraces } from './field-city-layout';
import { ringPosition, ringRadius } from './field-ring-space';
import type { CityLamp } from './field-city-street';

function lampWash(size: number) {
  const image = document.createElement('canvas');
  image.width = image.height = size;
  const context = image.getContext('2d')!;
  const gradient = context.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,177,76,.53)');
  gradient.addColorStop(.34, 'rgba(250,164,68,.29)');
  gradient.addColorStop(.65, 'rgba(250,163,74,.06)');
  gradient.addColorStop(1, 'rgba(255,231,189,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(image);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function daylightReflection() {
  const image = document.createElement('canvas');
  image.width = 512;
  image.height = 256;
  const context = image.getContext('2d')!;
  const sky = context.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, '#7597bc');
  sky.addColorStop(.30, '#9cb7c5');
  sky.addColorStop(.46, '#cecfc3');
  sky.addColorStop(.51, '#e1c5a3');
  sky.addColorStop(.64, '#a2a18f');
  sky.addColorStop(.77, '#788284');
  sky.addColorStop(1, '#586473');
  context.fillStyle = sky;
  context.fillRect(0, 0, 512, 256);
  for (const [x, y, radius] of [[397, 75, 45], [399, 75, 20], [396, 71, 7]]) {
    const shine = context.createRadialGradient(x, y, 0, x, y, radius);
    shine.addColorStop(0, 'rgba(255,244,215,.83)');
    shine.addColorStop(1, 'rgba(255,244,215,0)');
    context.fillStyle = shine;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const texture = new CanvasTexture(image);
  texture.colorSpace = SRGBColorSpace;
  texture.mapping = EquirectangularReflectionMapping;
  return texture;
}

function buildingContact(polar: boolean) {
  const positions: number[] = [];
  const paint: number[] = [];
  const faces = [0, 1, 2, 0, 2, 3];

  function strip(fromX: number, fromZ: number, toX: number, toZ: number, spreadX: number, spreadZ: number, strength: number) {
    const steps = Math.ceil(Math.max(Math.abs(toX - fromX), Math.abs(toZ - fromZ)) * 4);
    for (let i = 0; i < steps; i++) {
      const a = i / steps, b = (i + 1) / steps;
      const ax = fromX + (toX - fromX) * a, az = fromZ + (toZ - fromZ) * a;
      const bx = fromX + (toX - fromX) * b, bz = fromZ + (toZ - fromZ) * b;
      const corners = [[ax, az], [bx, bz], [bx + spreadX, bz + spreadZ], [ax + spreadX, az + spreadZ]];
      for (const index of faces) {
        const [column, row] = corners[index];
        const point = polar ? ringPosition(column, row) : { x: column, z: row };
        positions.push(point.x, .030, point.z);
        paint.push(1, 1, 1, index < 2 ? strength : 0);
      }
    }
  }

  function footprint(x: number, z: number, width: number, depth: number, strength: number) {
    const side = polar ? .26 / (ringRadius(z + depth / 2) * Math.PI / 20) : .26;
    const front = polar ? .49 : .25;
    strip(x - side * .24, z, x + width + side * .24, z, 0, -front, strength);
    strip(x - side * .24, z + depth, x + width + side * .24, z + depth, 0, front, strength);
    strip(x, z, x, z + depth, -side, 0, strength);
    strip(x + width, z, x + width, z + depth, side, 0, strength);
  }

  for (const lot of cityParcels) footprint(lot.x + .21, lot.z + .25, lot.width - .42, lot.depth - .45, .29);
  for (const lot of cityTerraces) footprint(lot.x + .069, lot.z + .27, lot.width - .138, lot.depth - .49, .25);

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(paint, 4));
  geometry.computeBoundingSphere();
  const material = new MeshBasicMaterial({
    color: 0x30323b, transparent: true, vertexColors: true, depthWrite: false,
    side: DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1,
  });
  const contact = new Mesh(geometry, material);
  contact.name = 'Wall and doorstep contact shadows';
  return contact;
}

function lighthouseBeam(polar: boolean) {
  const range = 6.6;
  const geometry = new CylinderGeometry(.095, .69, range, 17, 1, true);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, range * .50 + .32);
  const glass = new ShaderMaterial({
    uniforms: { strength: { value: 0 }, glow: { value: new Color(0xffd7a0) } },
    transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending, toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec2 taper;
      void main() { taper = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float strength;
      uniform vec3 glow;
      varying vec2 taper;
      void main() {
        float feather = taper.y * taper.y * smoothstep(.0,.15,1.0-taper.y);
        gl_FragColor = vec4(glow, feather * strength);
        #include <colorspace_fragment>
      }
    `,
  });
  const light = new Mesh(geometry, glass);
  const origin = polar ? ringPosition(cityLighthouseSite.x, cityLighthouseSite.z) : { x: 3.5, z: 8.82 };
  light.position.set(origin.x, cityLighthouseSite.lampHeight, origin.z);
  light.visible = false;
  return {
    light,
    update(time: number, night: number) {
      light.visible = night > .11;
      light.rotation.y = time ? time / 2900 - 1.8 : -1.8;
      glass.uniforms.strength.value = night * .22;
    },
    dispose() { geometry.dispose(); glass.dispose(); },
  };
}

export function buildCityLight(lamps: readonly CityLamp[], polar = false) {
  const group = new Group();
  const flat = new PlaneGeometry(1, 1);
  flat.rotateX(-Math.PI / 2);
  const lampMap = lampWash(96);
  const skylight = daylightReflection();
  const beacon = lighthouseBeam(polar);
  const bulb = new MeshBasicMaterial({
    map: lampMap, transparent: true, depthWrite: false, opacity: 0, toneMapped: false, blending: AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -1,
  });
  const contact = buildingContact(polar);
  const pool = new InstancedMesh(flat, bulb, lamps.length);
  const dial = new Sprite(new SpriteMaterial({
    map: lampMap, color: 0xffe2af, transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false,
  }));
  dial.position.y = 10.70;
  dial.scale.set(1.92, 1.92, 1);
  dial.visible = false;
  const dummy = new Object3D();
  lamps.forEach((light, index) => {
    dummy.position.set(light.x, .027, light.z - .14);
    dummy.rotation.y = 0;
    dummy.scale.set(3.0, 1, 3.05);
    dummy.updateMatrix();
    pool.setMatrixAt(index, dummy.matrix);
  });
  pool.computeBoundingSphere();
  group.add(contact, pool, beacon.light, dial);
  return {
    group, skylight,
    update(darkness: number, time = 0, load = .73) {
      const powered = darkness * (.08 + load * 1.2);
      beacon.update(time, powered);
      pool.visible = darkness > .027;
      bulb.opacity = powered * .65;
      contact.material.opacity = 1 - darkness * .36;
      dial.visible = polar && darkness > .09;
      dial.material.opacity = powered * (.63 + .10 * Math.sin(time / 690));
    },
    dispose() {
      beacon.dispose(); flat.dispose(); lampMap.dispose(); skylight.dispose(); contact.geometry.dispose();
      contact.material.dispose(); bulb.dispose(); dial.material.dispose();
    },
  };
}
