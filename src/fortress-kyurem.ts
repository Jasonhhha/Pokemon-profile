import { glacialHeightAt } from './fortress-glacier';
import { createLegPlant } from './fortress-leg-plant';
import {
  Bone,
  Color,
  Float32BufferAttribute,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  Quaternion,
  SkinnedMesh,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const glacierHeight = -0.62;
const bearing = -0.83;
const baseScale = 0.562;
const smooth = (a: number, b: number, n: number) => {
  const k = Math.min(1, Math.max(0, (n - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

export function roarPose(age: number) {
  const windup = smooth(0.01, 0.32, age) * (1 - smooth(0.43, 0.72, age));
  const release = smooth(0.42, 0.69, age) * (1 - smooth(1.22, 1.95, age));
  const jaw = smooth(0.42, 0.66, age) * (1 - smooth(1.31, 1.9, age));
  const recoil = smooth(0.8, 0.99, age) * (1 - smooth(1.19, 2.06, age));
  return { windup, release, jaw, recoil };
}

function disposeModel(scene: Group) {
  const geometries = new Set<Mesh['geometry']>();
  const materials = new Set<Material>();
  const maps = new Set<Texture>();
  const skeletons = new Set<SkinnedMesh['skeleton']>();
  scene.traverse(child => {
    if (child instanceof Mesh) {
      geometries.add(child.geometry);
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) materials.add(material);
    }
    if (child instanceof SkinnedMesh) skeletons.add(child.skeleton);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof Texture) maps.add(value);
    material.dispose();
  }
  for (const map of maps) {
    map.dispose();
    const image = map.source.data;
    if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close();
  }
  for (const shape of geometries) shape.dispose();
  for (const rig of skeletons) rig.dispose();
}

type Pose = ReturnType<typeof roarPose>;
type Rotation = (t: number, p: Pose) => [number, number, number];
type Joint = { bone: Bone; rest: Quaternion; worldToBone: Quaternion; turn: Rotation; gazeWeight: number };
const gazeWeights: Record<string, number> = { Neck2: 0.1, Neck3: 0.17, Neck4: 0.21, Neck5: 0.25, Head: 0.27 };

export function createKyuremActor() {
  const root = new Group(),
    body = new Group();
  root.add(body);
  const base = import.meta.env.BASE_URL + 'assets/';
  const portraitMaterial = new SpriteMaterial({ transparent: true, alphaTest: 0.025, depthWrite: false });
  const portrait = new Sprite(portraitMaterial);
  portrait.renderOrder = 1;
  let portraitSize = 5.79;
  portrait.scale.set(portraitSize, portraitSize, 1);
  portrait.position.set(8.35, glacierHeight, 7.18);
  portrait.visible = false;
  root.add(portrait);
  let model: Group | undefined,
    disposed = false;
  const portraits: Texture[] = [];
  const loader = new TextureLoader();
  function picture(filename: string, pixel = false) {
    const image = loader.load(
      base + filename,
      texture => {
        if (disposed || model) return;
        texture.colorSpace = SRGBColorSpace;
        if (pixel) texture.magFilter = NearestFilter;
        // HOME and Generation V use very different transparent margins under the toes.
        portrait.center.set(0.5, pixel ? 20 / 96 : 9 / 512);
        portraitSize = pixel ? 6.13 : 5.79;
        portraitMaterial.map = texture;
        portraitMaterial.needsUpdate = true;
        portrait.visible = true;
      },
      undefined,
      () => {
        if (!pixel && !disposed && !model) picture('kyurem-bw.png', true);
      },
    );
    portraits.push(image);
  }
  let requestedPortrait = false;
  function showPortrait() {
    if (disposed || model || requestedPortrait) return;
    requestedPortrait = true;
    picture('kyurem.png');
  }
  // A fast local model arrives before a second image download is needed.
  const portraitTimer = window.setTimeout(showPortrait, 380);
  const joints: Joint[] = [],
    jaws: SkinnedMesh[] = [];
  const soles: { mesh: SkinnedMesh; index: number; side: number }[] = [];
  const footprints = [new Vector3(), new Vector3()];
  const plant: (((drop: number) => void) | undefined)[] = [];
  const gaps = [0, 0],
    totals = [0, 0];
  const pivot = new Quaternion(),
    worldQ = new Quaternion(),
    temp = new Vector3(),
    muzzleLocal = new Vector3(),
    eyesLocal = new Vector3();
  let head: Bone | undefined;
  const action = new Map<string, Rotation>();
  action.set('Hips', (t, p) => [
    0.012 * Math.sin(t * 0.72) - p.windup * 0.018,
    0.026 * Math.sin(t * 0.42),
    0.02 * Math.sin(t * 0.61),
  ]);
  action.set('Spine1', (t, p) => [
    -0.06 + 0.02 * Math.sin(t * 1.15) + p.windup * 0.12 - p.release * 0.095,
    0.014 * Math.sin(t * 0.72),
    0,
  ]);
  action.set('Spine2', (t, p) => [
    0.11 + 0.016 * Math.sin(t * 1.15 - 0.4) + p.windup * 0.069 - p.release * 0.065,
    0.022 * Math.sin(t * 0.55),
    0,
  ]);
  for (let i = 1; i <= 5; i++) {
    const neutral = [-0.2, -0.14, 0.12, 0.18, 0.08][i - 1];
    action.set('Neck' + i, (t, p) => [
      neutral +
        0.018 * Math.sin(t * 1.18 - i * 0.22) +
        (i <= 2 ? -0.13 : 0.075) * p.windup +
        (i <= 2 ? -0.112 : -0.077) * p.release +
        0.027 * p.recoil,
      0.018 * Math.sin(t * 0.59 - i * 0.24) + (i < 3 ? 0.042 : -0.02) * p.windup,
      0.007 * Math.sin(t * 0.68 + i * 0.17),
    ]);
  }
  action.set('Head', (t, p) => [
    0.12 + 0.02 * Math.sin(t * 1.18 - 0.9) - p.release * 0.16 + p.recoil * 0.072,
    -0.07 + 0.048 * Math.sin(t * 0.63) - p.windup * 0.042,
    0.026 * Math.sin(t * 0.81),
  ]);
  for (const [side, sign] of [
    ['L', 1],
    ['R', -1],
  ] as const) {
    action.set(side + 'Shoulder', (t, p) => [
      -0.055 + 0.018 * Math.sin(t * 0.98),
      sign * (-0.056 + p.windup * 0.11),
      sign * (0.055 + 0.022 * Math.sin(t * 1.12) - p.windup * 0.11 + p.release * 0.24),
    ]);
    action.set(side + 'Arm', (t, p) => [
      0.26 + 0.025 * Math.sin(t * 0.85 + sign * 0.36) - p.release * 0.18,
      sign * 0.065,
      sign * (-0.15 + 0.028 * Math.sin(t * 1.02 + sign * 0.4) + p.release * 0.085),
    ]);
    action.set(side + 'ForeArm', (t, p) => [
      -0.15 + p.windup * 0.19 - p.release * 0.17,
      sign * -0.04,
      sign * (0.068 + 0.022 * Math.sin(t * 0.93)),
    ]);
    action.set(side + 'Thigh', (t, p) => [
      sign * 0.184 + 0.011 * Math.sin(t * 0.75) + p.windup * 0.047,
      0,
      -sign * 0.242,
    ]);
    action.set(side + 'Leg', (_t, p) => [-0.086 - p.windup * 0.075 + p.release * 0.027, 0, sign * 0.033]);
    action.set(side + 'Foot', (_t, p) => [0.071 + p.windup * 0.048, 0, sign * 0.158]);
  }
  action.set('Tail1', (t, p) => [
    -0.085 + 0.065 * Math.sin(t * 0.73) + p.windup * 0.13,
    0.15 * Math.sin(t * 0.63) + p.recoil * 0.12,
    0.055 * Math.sin(t * 0.55),
  ]);
  action.set('Tail2', (t, p) => [
    -0.078 + 0.078 * Math.sin(t * 0.73 - 0.64) + p.windup * 0.082,
    0.17 * Math.sin(t * 0.63 - 0.75) - p.release * 0.11,
    0.04 * Math.sin(t * 0.55 - 0.7),
  ]);
  function sampleSoles(storePositions: boolean) {
    gaps.fill(Infinity);
    if (storePositions) {
      totals.fill(0);
      for (const foot of footprints) foot.set(0, 0, 0);
    }
    for (const sole of soles) {
      sole.mesh.getVertexPosition(sole.index, temp).applyMatrix4(sole.mesh.matrixWorld);
      const side = sole.side > 0 ? 1 : 0;
      gaps[side] = Math.min(gaps[side], temp.y - glacialHeightAt(temp.x, temp.z));
      if (storePositions) {
        footprints[side].add(temp);
        totals[side]++;
      }
    }
    if (storePositions)
      for (let side = 0; side < 2; side++) if (totals[side]) footprints[side].multiplyScalar(1 / totals[side]);
  }
  const ready = new Promise<boolean>(resolve => {
    new GLTFLoader().load(
      base + 'kyurem.glb',
      ({ scene }) => {
        if (disposed) {
          disposeModel(scene);
          resolve(false);
          return;
        }
        scene.updateMatrixWorld(true);
        const supports: { y: number; mesh: SkinnedMesh; index: number; side: number }[] = [];
        // These four source primitives use painted maps. The other two use solid materials.
        const unpainted = new Set(['Material #10', 'Material #12', 'Material #13', 'Material #14']);
        scene.traverse(node => {
          if (node instanceof Bone) {
            const turn = action.get(node.name);
            if (turn)
              joints.push({
                bone: node,
                rest: node.quaternion.clone(),
                worldToBone: node.getWorldQuaternion(new Quaternion()).invert(),
                turn,
                gazeWeight: gazeWeights[node.name] ?? 0,
              });
            if (node.name === 'Head') {
              head = node;
              muzzleLocal.set(0, 4.3, 6.09);
              head.worldToLocal(muzzleLocal);
              eyesLocal.set(0, 4.61, 5.65);
              head.worldToLocal(eyesLocal);
            }
          }
          if (!(node instanceof SkinnedMesh)) return;
          node.frustumCulled = false;
          node.castShadow = true;
          node.receiveShadow = true;
          const material = node.material;
          if (!(material instanceof MeshStandardMaterial)) return;
          const part = material.name;
          const ice = part === 'Material #12';
          if (material.map?.image) unpainted.delete(part);
          material.metalness = ice ? 0.14 : 0.035;
          material.roughness = ice ? 0.28 : 0.7;
          if (part === 'Material #15') {
            // Split the FBX glow mask into the Pokémon's yellow median crest and pale, frozen lateral spikes.
            const colors = new Float32Array(node.geometry.attributes.position.count * 3);
            const crest = new Color(0xf1ce38),
              frost = new Color(0xc1e1e8);
            for (let i = 0; i < colors.length / 3; i++) {
              node.getVertexPosition(i, temp).applyMatrix4(node.matrixWorld);
              const tint = temp.z > 4.2 && Math.abs(temp.x) < 0.28 ? crest : frost;
              colors.set([tint.r, tint.g, tint.b], i * 3);
            }
            node.geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
            material.vertexColors = true;
            material.color.setHex(0xffffff);
            material.roughness = 0.32;
          } else if (part === 'Material #14') {
            material.onBeforeCompile = s => {
              s.fragmentShader = s.fragmentShader.replace(
                '#include <map_fragment>',
                '#include <map_fragment>\n diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.70,.78,.80),.66);',
              );
            };
          } else if (part === 'Material #13') {
            material.emissive.setHex(0xcba737);
            material.emissiveIntensity = 0.26;
          } else if (material.map) {
            material.emissiveMap = material.map;
            material.emissive.setHex(ice ? 0xc0deea : 0xc5d4d7);
            material.emissiveIntensity = ice ? 0.18 : 0.125;
          }
          if (node.morphTargetInfluences) jaws.push(node);
          for (let i = 0; i < node.geometry.attributes.position.count; i++) {
            node.getVertexPosition(i, temp).applyMatrix4(node.matrixWorld);
            if (temp.y < 1.57 && temp.z < -0.95)
              supports.push({ mesh: node, index: i, y: temp.y, side: Math.sign(temp.x) });
          }
        });
        supports.sort((a, b) => a.y - b.y);
        for (const side of [-1, 1]) {
          const foot = supports.filter(s => s.side === side);
          // A rear claw can become the lowest point when the knee extends, even if a front toe was lowest in bind pose.
          if (foot.length) soles.push(...foot.filter(s => s.y <= foot[0].y + 0.29));
        }
        for (const side of ['R', 'L']) {
          const hip = scene.getObjectByName(side + 'Thigh'),
            knee = scene.getObjectByName(side + 'Leg'),
            ankle = scene.getObjectByName(side + 'Foot');
          plant.push(
            hip instanceof Bone && knee instanceof Bone && ankle instanceof Bone
              ? createLegPlant(hip, knee, ankle)
              : undefined,
          );
        }
        if (
          unpainted.size ||
          !head ||
          plant.some(leg => !leg) ||
          !soles.some(s => s.side < 0) ||
          !soles.some(s => s.side > 0)
        ) {
          joints.length = jaws.length = soles.length = plant.length = 0;
          head = undefined;
          disposeModel(scene);
          showPortrait();
          resolve(false);
          return;
        }
        model = scene;
        body.add(scene);
        portrait.visible = false;
        window.clearTimeout(portraitTimer);
        resolve(true);
      },
      undefined,
      () => {
        showPortrait();
        resolve(false);
      },
    );
  });
  const ex = new Vector3(1, 0, 0),
    ey = new Vector3(0, 1, 0),
    ez = new Vector3(0, 0, 1);
  const ax = new Quaternion(),
    ay = new Quaternion(),
    az = new Quaternion();
  return {
    root,
    ready,
    update(t: number, age: number, reduced: boolean, observer?: { x: number; y: number }) {
      const p = roarPose(age);
      const f = reduced ? 1.35 : t;
      // Only a small held jaw change remains in reduced-motion mode, with no physical lunge.
      if (reduced) {
        p.windup = 0;
        p.release *= 0.22;
        p.recoil = 0;
        p.jaw *= 0.48;
      }
      const lunge = p.release * 0.32 - p.windup * 0.18;
      // On the approach the captive notices the observer. It turns back towards the stressed pane to roar.
      let gaze = 0;
      if (observer && !reduced) {
        const dx = observer.x - 8.2,
          dz = observer.y - 6.87;
        const near = 1 - smooth(5.1, 11.2, Math.hypot(dx, dz));
        const calm = 1 - smooth(0, 0.39, age) * (1 - smooth(1.88, 2.56, age));
        gaze = Math.max(-0.18, Math.min(0.18, (Math.atan2(dx, dz) - bearing) * 0.21)) * near * calm;
      }
      body.scale.setScalar(baseScale);
      body.position.set(
        8.2 + Math.sin(bearing) * lunge,
        glacierHeight - baseScale * 1.1,
        6.87 + Math.cos(bearing) * lunge,
      );
      body.rotation.set(0, bearing + 0.023 * Math.sin(f * 0.39), 0);
      for (const j of joints) {
        const [x, y, z] = j.turn(f, p);
        worldQ
          .copy(ay.setFromAxisAngle(ey, y + gaze * j.gazeWeight))
          .multiply(ax.setFromAxisAngle(ex, x))
          .multiply(az.setFromAxisAngle(ez, z));
        pivot.copy(j.worldToBone).multiply(worldQ).multiply(ax.copy(j.worldToBone).invert());
        j.bone.quaternion.copy(j.rest).multiply(pivot);
      }
      for (const m of jaws) m.morphTargetInfluences![0] = 0.046 + 0.026 * Math.sin(f * 1.18) + p.jaw * 0.92;
      if (soles.length) {
        root.updateMatrixWorld(true);
        sampleSoles(false);
        const contact = Math.min(...gaps),
          clearance = 0.004;
        body.position.y += clearance - contact;
        body.updateMatrixWorld(true);
        for (let side = 0; side < 2; side++) gaps[side] += clearance - contact;
        // The claws blend ankle and shin weights. Re-read the skinned sole after each small IK correction.
        for (let pass = 0; pass < 3; pass++) {
          if (Math.abs(gaps[0] - clearance) < 0.001 && Math.abs(gaps[1] - clearance) < 0.001) break;
          for (let side = 0; side < 2; side++) plant[side]?.((gaps[side] - clearance) * 0.72);
          sampleSoles(false);
        }
        sampleSoles(true);
      }
      if (portrait.visible) {
        portrait.position.set(8.35 + Math.sin(bearing) * lunge * 0.18, glacierHeight + 0.018, 7.18);
        portrait.scale.set(
          portraitSize,
          portraitSize * (1 + 0.003 * Math.sin(f * 1.21) - p.windup * 0.015 + p.release * 0.019),
          1,
        );
        portrait.material.rotation = -0.004 * Math.sin(f * 0.68) - p.windup * 0.014 + p.release * 0.008;
        footprints[0].set(7.84, glacierHeight, 7.8);
        footprints[1].set(9.56, glacierHeight, 7.13);
      }
    },
    footprints,
    muzzle(out: Vector3) {
      if (head) return head.localToWorld(out.copy(muzzleLocal));
      return out.set(6.01, 1.8, 8.27);
    },
    eyes(out: Vector3) {
      return head ? head.localToWorld(out.copy(eyesLocal)) : out.set(6.28, 1.98, 8.18);
    },
    dispose() {
      disposed = true;
      window.clearTimeout(portraitTimer);
      if (model) disposeModel(model);
      for (const texture of portraits) texture.dispose();
      portraitMaterial.dispose();
    },
  };
}
