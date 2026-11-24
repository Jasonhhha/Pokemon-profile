import {
  BoxGeometry, BufferGeometry, CanvasTexture, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, ShaderMaterial, SphereGeometry, SRGBColorSpace, TorusGeometry,
} from 'three';
import { batchStaticMeshes } from './field-mesh-batch';
import { ringRadius } from './field-ring-space';
import { harborHeight } from './field-city-layout';

const seaLevel = -.58;
const outerWaterline = ringRadius(harborHeight + 1.35);
const box = new BoxGeometry(1, 1, 1);
const tube = new CylinderGeometry(1, 1, 1, 12);
const knob = new SphereGeometry(1, 12, 7);
const rescueRing = new TorusGeometry(.125, .027, 6, 20);
const ivory = new MeshStandardMaterial({ color: 0xe2d1aa, roughness: .64 });
const stone = new MeshStandardMaterial({ color: 0xc8ad86, roughness: .69 });
const enamel = new MeshStandardMaterial({ color: 0x45757b, roughness: .54, metalness: .2 });
const hullPaint = new MeshStandardMaterial({ color: 0x294750, roughness: .54, side: DoubleSide });
const brass = new MeshStandardMaterial({ color: 0xbe8c67, roughness: .58, metalness: .2 });
const frame = new MeshStandardMaterial({ color: 0x334b53, roughness: .53, metalness: .29 });
const railing = new MeshStandardMaterial({ color: 0x9ca8a4, roughness: .48, metalness: .42 });
const cork = new MeshStandardMaterial({ color: 0xb26e51, roughness: .67 });
const deck = new MeshStandardMaterial({ color: 0xa98362, roughness: .82 });

type Paint = MeshBasicMaterial | MeshStandardMaterial;
type Pos = readonly [number, number, number];

function shape(group: Group, geo: BufferGeometry, pigment: Paint, pos: Pos, dimensions: Pos, yaw = 0, roll = 0) {
  const mesh = new Mesh(geo, pigment);
  mesh.position.set(...pos);
  mesh.scale.set(...dimensions);
  mesh.rotation.set(0, yaw, roll);
  group.add(mesh);
  return mesh;
}

function hull() {
  const positions: number[] = [];
  const plan = [[-2.04, .34, .32], [-1.71, .58, .26], [-1.18, .704, .23], [.9, .682, .25], [1.56, .48, .34], [2.07, .228, .45], [2.18, .06, .47]];
  const vertex = (i: number, ring: number, side: number) => {
    const [z, width, edge] = plan[i];
    return [side * width * [1, .97, .54, .10][ring], [edge, .10, -.17, -.28][ring], z];
  };
  for (const side of [-1, 1]) {
    for (let point = 0; point < plan.length - 1; point++) {
      for (let ring = 0; ring < 3; ring++) {
        const a = vertex(point, ring, side), b = vertex(point + 1, ring, side);
        const c = vertex(point, ring + 1, side), d = vertex(point + 1, ring + 1, side);
        positions.push(...a, ...b, ...c, ...b, ...d, ...c);
      }
      const a = vertex(point, 0, side), b = vertex(point + 1, 0, side);
      positions.push(...a, ...b, 0, plan[point][2], plan[point][0], ...b, 0, plan[point + 1][2], plan[point + 1][0], 0, plan[point][2], plan[point][0]);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return new Mesh(geometry, hullPaint);
}

function plate() {
  const canvas = document.createElement('canvas');
  canvas.width = 246; canvas.height = 68;
  const ink = canvas.getContext('2d')!;
  ink.fillStyle = '#325961'; ink.fillRect(0, 0, 246, 68);
  ink.strokeStyle = '#ccae77'; ink.lineWidth = 3; ink.strokeRect(4, 4, 238, 60);
  ink.font = '800 39px system-ui'; ink.textAlign = 'center'; ink.textBaseline = 'middle';
  ink.fillStyle = '#ebcc9b'; ink.fillText('FERRY 02', 123, 36);
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  return new MeshBasicMaterial({ map, toneMapped: false });
}

function harborCourse(seconds: number, clearance: number) {
  const phase = seconds / 18.7 - .75;
  const angle = phase + Math.sin(phase * 2 + .6) * .089 + Math.sin(phase * 3 - .37) * .032;
  const radius = ringRadius(harborHeight + 3) + clearance + .45 + Math.sin(angle * 2 - .8) * .27 + Math.sin(angle * 5) * .074;
  const rate = .54 * Math.cos(angle * 2 - .8) + .37 * Math.cos(angle * 5);
  const sine = Math.sin(angle), cosine = Math.cos(angle);
  const dx = radius * cosine + rate * sine, dz = -radius * sine + rate * cosine;
  return {
    x: sine * radius, z: cosine * radius, heading: Math.atan2(dx, dz),
    speed: Math.hypot(dx, dz) * (1 + .178 * Math.cos(phase * 2 + .6) + .096 * Math.cos(phase * 3 - .37)) / 18.7,
  };
}

export function buildCityFerry() {
  const ship = new Group();
  const glass = new MeshStandardMaterial({ color: 0x4d7681, metalness: .17, roughness: .29, emissive: 0xe1ad78, emissiveIntensity: .1 });
  const tenderLight = new MeshStandardMaterial({ color: 0xe4c49d, emissive: 0xffba6b, emissiveIntensity: 0, roughness: .38 });
  ship.add(hull());
  shape(ship, box, deck, [0, .311, -.032], [1.12, .09, 3.27]);
  shape(ship, box, enamel, [0, .567, -.287], [1.084, .50, 1.85]);
  shape(ship, box, ivory, [0, .919, -.275], [1.176, .154, 2.21]);
  shape(ship, box, enamel, [0, 1.011, -.297], [1.12, .058, 2.01]);
  shape(ship, box, brass, [0, .862, -.262], [1.19, .037, 2.22]);
  shape(ship, box, ivory, [0, .663, .602], [.986, .40, .29]);
  shape(ship, box, frame, [0, .724, .754], [.88, .228, .017]);
  shape(ship, box, glass, [0, .728, .766], [.81, .158, .017]);
  shape(ship, box, brass, [0, .723, .779], [.034, .211, .021]);
  shape(ship, tube, frame, [0, 1.157, -.567], [.129, .296, .131]);
  shape(ship, tube, brass, [0, 1.317, -.567], [.134, .054, .136]);
  shape(ship, box, ivory, [0, 1.064, .252], [.534, .094, .257]);
  shape(ship, tube, railing, [0, 1.281, .493], [.021, .435, .021]);
  shape(ship, box, cork, [.101, 1.435, .493], [.220, .096, .015]);
  const sign = plate();
  for (const side of [-1, 1]) {
    shape(ship, box, brass, [side * .613, .301, -.167], [.030, .028, 2.8]);
    shape(ship, box, frame, [side * .548, .664, -.338], [.03, .314, 1.70]);
    for (const z of [-1.011, -.699, -.369, -.039, .278]) {
      shape(ship, box, glass, [side * .566, .678, z], [.030, .223, .258]);
      shape(ship, box, railing, [side * .585, .573, z], [.016, .022, .258]);
    }
    shape(ship, box, sign, [side * .58, .457, .198], [.018, .142, .52], side * Math.PI / 2);
    for (const z of [-1.64, -1.34, .80, 1.13, 1.44]) {
      const tapered = z > .85 ? .59 - (z - .85) * .22 : .61;
      shape(ship, tube, railing, [side * tapered, .468, z], [.021, .314, .021]);
    }
    shape(ship, box, railing, [side * .55, .619, 1.138], [.028, .031, .67], -side * .23);
    shape(ship, box, railing, [side * .601, .613, -1.449], [.026, .035, .49], side * .20);
    shape(ship, knob, cork, [side * .621, .495, -.581], [.035, .127, .123]);
    shape(ship, knob, ivory, [side * .651, .495, -.581], [.021, .065, .069]);
    shape(ship, rescueRing, cork, [side * .617, .621, -.96], [1, 1, 1], side * Math.PI * .5);
    shape(ship, tube, frame, [side * .34, .579, 1.24], [.071, .068, .071]);
    shape(ship, tube, tenderLight, [side * .34, .626, 1.24], [.055, .062, .055]);
    shape(ship, tube, brass, [side * .34, .673, 1.24], [.061, .030, .061]);
    for (const z of [-1.55, 1.46]) {
      shape(ship, tube, brass, [side * .314, .395, z], [.067, .12, .067]);
      shape(ship, box, frame, [side * .316, .454, z], [.166, .038, .069]);
    }
  }
  shape(ship, box, frame, [0, .383, 1.524], [.548, .168, .253]);
  shape(ship, tube, brass, [0, .43, -1.86], [.089, .165, .091]);
  const group = new Group();
  const model = batchStaticMeshes(ship, false);
  group.add(model);

  const foam = new ShaderMaterial({
    uniforms: { clock: { value: 0 }, flow: { value: 0 }, shade: { value: 0 }, tint: { value: new Color(0xcfe7d6) } },
    transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 surfaceUv;
      void main() { surfaceUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 surfaceUv;
      uniform float clock; uniform float flow; uniform float shade; uniform vec3 tint;
      void main() {
        float fromHull = 1.0 - surfaceUv.y;
        float wing = abs(surfaceUv.x - .5);
        float lap = abs(wing - (.072 + fromHull * .335));
        float line = exp(-lap * lap * (540.0 - fromHull * 295.0));
        float eddy = .5 + .5 * sin(clock * 3.8 - fromHull * 27.0 + sin(wing * 43.0) * .92);
        float froth = .31 + .69 * smoothstep(.18, .95, eddy);
        float churn = exp(-wing * wing * 112.0) * pow(1.0 - fromHull, 4.7) * .41;
        float alpha = (line * froth + churn) * flow * pow(1.0 - fromHull, 1.62) * (1.0 - .52 * shade);
        gl_FragColor = vec4(tint, alpha * .48);
        #include <colorspace_fragment>
      }
    `,
  });
  const strips = 12;
  const wakeGeometry = new PlaneGeometry(1, 1, 1, strips);
  const waterline = wakeGeometry.getAttribute('position');
  const wake = new Mesh(wakeGeometry, foam);
  wake.frustumCulled = false;
  wake.renderOrder = 2;
  group.add(wake);
  return {
    group,
    update(time: number, night: number, clearance = 0) {
      const seconds = time / 1000;
      const { x, z, heading, speed } = harborCourse(seconds, clearance);
      const pitch = time ? Math.sin(seconds * 1.7 + .6) : 0;
      const roll = time ? Math.sin(seconds * 1.19 + .18) : 0;
      model.position.set(x, seaLevel + pitch * .018, z);
      model.rotation.set(pitch * .013, heading, roll * .029, 'YXZ');
      wake.visible = Boolean(time);
      if (wake.visible) {
        const sternDelay = 1.68 / Math.max(.80, speed);
        for (let i = 0; i <= strips; i++) {
          const trail = i / strips;
          const earlier = harborCourse(seconds - sternDelay - trail * 3.70, clearance);
          const width = Math.min(.96 + .60 * trail, Math.hypot(earlier.x, earlier.z) - outerWaterline);
          const dx = Math.cos(earlier.heading) * width, dz = -Math.sin(earlier.heading) * width;
          waterline.setXYZ(i * 2, earlier.x + dx, seaLevel + .009, earlier.z + dz);
          waterline.setXYZ(i * 2 + 1, earlier.x - dx, seaLevel + .009, earlier.z - dz);
        }
        waterline.needsUpdate = true;
      }
      foam.uniforms.clock.value = seconds;
      foam.uniforms.flow.value = Math.min(1, .41 + .36 * speed);
      foam.uniforms.shade.value = night;
      glass.emissiveIntensity = .045 + night * .72;
      tenderLight.emissiveIntensity = .065 + night * .89;
    },
    dispose() {
      wakeGeometry.dispose();
      foam.dispose();
      sign.map?.dispose();
      sign.dispose();
      glass.dispose();
      tenderLight.dispose();
      model.traverse(object => { if (object instanceof Mesh) object.geometry.dispose(); });
    },
  };
}
