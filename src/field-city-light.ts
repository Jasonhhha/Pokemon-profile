import {
  AdditiveBlending, CanvasTexture, Color, CylinderGeometry, DoubleSide, EquirectangularReflectionMapping, Group, InstancedMesh, Mesh, MeshBasicMaterial,
  Object3D, PlaneGeometry, ShaderMaterial, Sprite, SpriteMaterial, SRGBColorSpace,
} from 'three';
import { cityParcels } from './field-city-layout';
import { ringAngle, ringPosition, ringRadius } from './field-ring-space';
import type { CityLamp } from './field-city-street';

function wash(size: number, color: string, edge: number, square: boolean) {
  const image = document.createElement('canvas');
  image.width = image.height = size;
  const context = image.getContext('2d')!;
  if (square) {
    context.shadowBlur = size * .13;
    context.shadowColor = color;
    context.fillStyle = color;
    context.roundRect(size * .22, size * .22, size * .56, size * .56, size * .105);
    context.fill();
  } else {
    const gradient = context.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, color);
    gradient.addColorStop(edge, color.replace(/\.[0-9]+\)$/, '.065)'));
    gradient.addColorStop(1, 'rgba(255,235,195,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
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
  const horizon = context.createLinearGradient(0, 106, 0, 169);
  horizon.addColorStop(0, 'rgba(72,91,102,.58)');
  horizon.addColorStop(1, 'rgba(97,106,105,0)');
  context.fillStyle = horizon;
  for (const [x, y, width] of [[10, 125, 41], [55, 110, 28], [90, 119, 35], [131, 113, 31], [166, 125, 29], [217, 129, 37], [259, 120, 22], [286, 115, 33], [325, 116, 28], [433, 109, 39], [480, 119, 32]]) {
    context.fillRect(x, y, width, 43 + (128 - y));
  }
  const texture = new CanvasTexture(image);
  texture.colorSpace = SRGBColorSpace;
  texture.mapping = EquirectangularReflectionMapping;
  return texture;
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
  const origin = polar ? ringPosition(3.5, 8.82) : { x: 3.5, z: 8.82 };
  light.position.set(origin.x, 3.15, origin.z);
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
  const lampMap = wash(96, 'rgba(253,184,92,.48)', .53, false);
  const contactMap = wash(96, 'rgba(33,42,47,.27)', .54, true);
  const skylight = daylightReflection();
  const beacon = lighthouseBeam(polar);
  const skirting = new MeshBasicMaterial({
    map: contactMap, transparent: true, opacity: .76, depthWrite: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -1,
  });
  const bulb = new MeshBasicMaterial({
    map: lampMap, transparent: true, depthWrite: false, opacity: 0, toneMapped: false, blending: AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -1,
  });
  const contact = new InstancedMesh(flat, skirting, cityParcels.length);
  const pool = new InstancedMesh(flat, bulb, lamps.length);
  const dial = new Sprite(new SpriteMaterial({
    map: lampMap, color: 0xffe2af, transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false,
  }));
  dial.position.y = 10.70;
  dial.scale.set(1.92, 1.92, 1);
  dial.visible = false;
  const dummy = new Object3D();
  cityParcels.forEach((lot, index) => {
    const x = lot.x + lot.width / 2, z = lot.z + lot.depth / 2;
    const location = polar ? ringPosition(x, z) : { x, z };
    dummy.position.set(location.x, .019, location.z);
    dummy.rotation.y = polar ? ringAngle(x) : 0;
    dummy.scale.set(lot.width * (polar ? ringRadius(z) * Math.PI / 20 * 1.76 : 1.78), 1, lot.depth * (polar ? .865 : 1.80));
    dummy.updateMatrix();
    contact.setMatrixAt(index, dummy.matrix);
  });
  lamps.forEach((light, index) => {
    dummy.position.set(light.x, .027, light.z - .14);
    dummy.rotation.y = 0;
    dummy.scale.set(3.0, 1, 3.05);
    dummy.updateMatrix();
    pool.setMatrixAt(index, dummy.matrix);
  });
  contact.computeBoundingSphere();
  pool.computeBoundingSphere();
  group.add(contact, pool, beacon.light, dial);
  return {
    group, skylight,
    update(darkness: number, time = 0) {
      beacon.update(time, darkness);
      pool.visible = darkness > .027;
      bulb.opacity = darkness * .58;
      skirting.opacity = .77 - darkness * .23;
      dial.visible = polar && darkness > .09;
      dial.material.opacity = darkness * (.63 + .10 * Math.sin(time / 690));
    },
    dispose() {
      beacon.dispose(); flat.dispose(); lampMap.dispose(); contactMap.dispose(); skylight.dispose(); skirting.dispose(); bulb.dispose(); dial.material.dispose();
    },
  };
}
