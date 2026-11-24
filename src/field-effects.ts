import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, DodecahedronGeometry, DynamicDrawUsage,
  Group, InstancedMesh, MeshBasicMaterial, Object3D, Points, ShaderMaterial, type ColorRepresentation,
} from 'three';
import { tileAt } from './field-layout';
import { ringPosition, ringRadius } from './field-ring-coordinates';
import type { FieldView } from './field-renderer';

type Speck = { x: number; y: number; z: number; vx: number; vz: number; born: number; life: number; size: number; angle: number; paint: ColorRepresentation };
const paint = { grass: 0x8fac6b, trail: 0xc5ad81, rock: 0xdad0ae };

const random = (value: number) => {
  const product = Math.sin(value * 129.98 + 8.37) * 43758.5453;
  return product - Math.floor(product);
};

export function createFieldEffects() {
  const group = new Group();
  const speckCount = 38;
  const fragments = new DodecahedronGeometry(1, 0);
  const fragmentPaint = new MeshBasicMaterial({ toneMapped: false });
  const particles = new InstancedMesh(fragments, fragmentPaint, speckCount);
  particles.instanceMatrix.setUsage(DynamicDrawUsage);
  particles.frustumCulled = false;
  particles.count = 0;
  group.add(particles);
  const moved = new Object3D();
  const pigment = new Color();
  const specks: Speck[] = [];
  let stepStarted = -Infinity;

  const count = 94;
  const positions = new Float32Array(count * 3);
  const attributes = new Float32Array(count);
  const grain = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = -2 + 45 * random(i * 6 + 13);
    positions[i * 3 + 1] = .35 + 3.3 * random(i * 6 + 11);
    positions[i * 3 + 2] = 1 + 22 * random(i * 6 + 1);
    grain[i] = random(i * 6 + 9);
    attributes[i] = random(i * 6 + 7);
  }
  const atmosphereGeometry = new BufferGeometry();
  atmosphereGeometry.setAttribute('position', new BufferAttribute(positions, 3));
  atmosphereGeometry.setAttribute('grain', new BufferAttribute(grain, 1));
  atmosphereGeometry.setAttribute('trait', new BufferAttribute(attributes, 1));
  const atmospherePaint = new ShaderMaterial({
    uniforms: {
      timestamp: { value: 0 }, aperture: { value: 1 }, shade: { value: 0 }, outerShore: { value: ringRadius(25.1) },
      color: { value: new Color(0xa4e6d2) },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float timestamp;
      uniform float aperture;
      uniform float outerShore;
      attribute float grain;
      attribute float trait;
      varying float intensity;
      varying float thrust;
      void main() {
        vec3 point = position;
        float flight = timestamp * (.43 + trait * .75) + grain * 17.0;
        float flutter = sin(flight) * .5 + .5;
        float azimuth = point.z * .28 + timestamp * (.032 + trait * .025);
        float distance = mix(2.82 + grain * .86, outerShore + grain * .71, step(.41, trait));
        point.x = sin(azimuth) * distance;
        point.y = .04 + grain * .34;
        point.z = cos(azimuth) * distance;
        gl_PointSize = aperture * mix(1.05, 3.35, grain);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(point, 1.0);
        thrust = trait;
        intensity = pow(flutter, mix(2.0, 5.0, grain)) * mix(.32, 1.0, trait);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float shade;
      uniform vec3 color;
      varying float intensity;
      varying float thrust;
      void main() {
        vec2 travel = gl_PointCoord - .5;
        float radius = length(travel);
        float center = 1.0 - smoothstep(.06, .48, radius);
        float sparkle = smoothstep(.64, .93, thrust);
        gl_FragColor = vec4(color, center * intensity * shade * mix(.57, 1.0, sparkle));
        #include <colorspace_fragment>
      }
    `,
  });
  const atmosphere = new Points(atmosphereGeometry, atmospherePaint);
  atmosphere.frustumCulled = false;
  group.add(atmosphere);

  function scatter(time: number, view: FieldView, x: number, z: number) {
    const step = view.step!;
    const kind = tileAt(view.location.area, step.to.x, step.to.y);
    const grassy = kind === 'grass' || kind === 'lawn';
    if (kind === 'dock' || kind === 'water' || kind === 'shelf' || kind === 'drop') return;
    const number = step.running ? 7 : grassy ? 4 : 3;
    const from = ringPosition(step.from.x + .5, step.from.y + .875);
    const to = ringPosition(step.to.x + .5, step.to.y + .875);
    const travel = Math.max(.01, Math.hypot(to.x - from.x, to.z - from.z));
    const dx = (to.x - from.x) / travel;
    const dz = (to.z - from.z) / travel;
    const seed = step.to.x * 63 + step.to.y * 927 + Math.floor(time) % 131;
    for (let i = 0; i < number; i++) {
      const spread = random(seed + i * 4) - .5;
      const pace = .17 + random(seed + i * 4 + 1) * .20;
      const life = 300 + random(seed + i * 4 + 2) * 170;
      specks.push({
        x: x - dx * .16 + spread * dz * .54,
        y: .04, z: z - dz * .16 + spread * dx * .54,
        vx: -dx * pace + spread * dz, vz: -dz * pace + spread * dx,
        angle: seed * .04 + i, born: time, life,
        size: (step.running ? .061 : .043) * (.66 + random(seed + i * 4 + 3) * .68),
        paint: grassy ? paint.grass : kind === 'path' || kind === 'shore' ? paint.trail : paint.rock,
      });
    }
    if (specks.length > speckCount) specks.splice(0, specks.length - speckCount);
  }

  function update(time: number, view: FieldView, x: number, z: number, progress: number, darkness: number, pixelRatio: number, reduced: boolean) {
    const room = view.location.room;
    particles.visible = atmosphere.visible = !reduced && !room;
    if (reduced || room) {
      specks.length = 0;
      particles.count = 0;
      return;
    }

    const step = view.step;
    if (step && progress > .37 && step.startedAt !== stepStarted) {
      scatter(time, view, x, z);
      stepStarted = step.startedAt;
    }
    let count = 0;
    for (let i = specks.length - 1; i >= 0; i--) {
      const bit = specks[i];
      const fade = (time - bit.born) / bit.life;
      if (fade >= 1) {
        specks.splice(i, 1);
        continue;
      }
      const curve = Math.sin(Math.PI * fade);
      const size = bit.size * (1 - fade) ** .64;
      moved.position.set(bit.x + bit.vx * fade, bit.y + curve * (bit.life / 2600), bit.z + bit.vz * fade);
      moved.rotation.set(bit.angle - fade, bit.angle + fade, bit.angle + .74 * fade);
      moved.scale.set(size, size * .41, size * .75);
      moved.updateMatrix();
      particles.setMatrixAt(count, moved.matrix);
      particles.setColorAt(count, pigment.set(bit.paint));
      count++;
    }
    particles.count = count;
    particles.instanceMatrix.needsUpdate = true;
    if (particles.instanceColor) particles.instanceColor.needsUpdate = true;

    const uniforms = atmospherePaint.uniforms;
    uniforms.timestamp.value = time / 1000;
    uniforms.aperture.value = pixelRatio;
    uniforms.shade.value = .28 + darkness * .18;
  }

  return {
    group, update,
    reset: () => { specks.length = 0; particles.count = 0; stepStarted = -Infinity; },
    dispose() { fragments.dispose(); fragmentPaint.dispose(); atmosphereGeometry.dispose(); atmospherePaint.dispose(); },
  };
}
