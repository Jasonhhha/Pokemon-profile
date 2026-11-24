import {
  Box3,
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Raycaster,
  TorusGeometry,
  Vector3,
} from 'three';
import { wardPosts } from './fortress-ward-service';
import type { FortressInteriorFrame } from './field-fortress-state';

const tau = Math.PI * 2;
const normal = new Vector3(0, 0, 1);

// The brake wheel is on the gallery side of its post. Its gauge shows the
// same extension as the chain so the fault can be read by shape as well as colour.
export function createWardCapstans(center: Vector3, radius: number) {
  const root = new Group(),
    count = wardPosts.length;
  const iron = new MeshStandardMaterial({ color: 0x344440, metalness: 0.51, roughness: 0.5 });
  const brass = new MeshStandardMaterial({ color: 0xc09c60, metalness: 0.6, roughness: 0.34 });
  const face = new MeshStandardMaterial({ color: 0x2c3e42, metalness: 0.25, roughness: 0.47 });
  const ink = new MeshBasicMaterial({ color: 0xffffff });
  const ring = new TorusGeometry(0.265, 0.033, 7, 36);
  const barrel = new CylinderGeometry(1, 1, 1, 24).rotateX(Math.PI / 2);
  const block = new BoxGeometry();
  const lens = new CylinderGeometry(0.121, 0.157, 0.19, 6);
  const parts = [
    new InstancedMesh(barrel, iron, count),
    new InstancedMesh(ring, brass, count),
    new InstancedMesh(block, brass, count * 3),
    new InstancedMesh(barrel, brass, count),
    new InstancedMesh(barrel, face, count),
    new InstancedMesh(block, ink, count),
    new InstancedMesh(block, brass, count * 5),
    new InstancedMesh(lens, ink, count),
    new InstancedMesh(block, iron, count * 2),
    new InstancedMesh(barrel, iron, count),
  ];
  const [drives, wheels, spokes, knobs, dials, needles, graduations, indicators, guides, shafts] = parts;
  for (const part of parts) {
    root.add(part);
    part.frustumCulled = false;
    part.castShadow = part !== needles && part !== graduations;
    part.receiveShadow = part !== needles;
  }
  const place = new Object3D(),
    matrix = new Matrix4();
  const base = new Vector3(),
    axis = new Vector3(),
    scale = new Vector3(1, 1, 1);
  const rotation = new Quaternion(),
    rayPoint = new Vector3();
  const teal = new Color(0x6e9f9b),
    iceWhite = new Color(0xd7fffc),
    amber = new Color(0xffa23d),
    tint = new Color();

  const settings = wardPosts.map((post, index) => {
    const x = center.x + Math.sin(post.bearing) * radius,
      z = center.z + Math.cos(post.bearing) * radius;
    const dx = post.tile.x + 0.5 - x,
      dz = post.tile.y + 0.5 - z,
      d = Math.hypot(dx, dz);
    // The rear posts sit farther inside the basin. Lengthen their pedestal drive
    // so every wheel can be reached from its actual shoe plates.
    const standOff = d - 0.53;
    base.set(x + (standOff * dx) / d, 0.79, z + (standOff * dz) / d);
    axis.set(dx / d, 0.96, dz / d).normalize();
    rotation.setFromUnitVectors(normal, axis);
    const wheel = new Matrix4().compose(base, rotation, scale);
    const gauge = new Matrix4().compose(
      base
        .clone()
        .addScaledVector(axis, 0.035)
        .add(new Vector3(0, 0.47, 0)),
      rotation,
      scale,
    );
    const bounds = new Box3(new Vector3(x - 0.39, 0.02, z - 0.39), new Vector3(x + 0.39, 2.08, z + 0.39));
    bounds.union(new Box3(new Vector3(-0.29, -0.29, 0.01), new Vector3(0.29, 0.29, 0.27)).applyMatrix4(wheel));
    bounds.union(new Box3(new Vector3(-0.21, -0.21, 0.01), new Vector3(0.21, 0.21, 0.12)).applyMatrix4(gauge));
    const indicator = new Matrix4().makeTranslation(x, 1.48, z);
    const shaftAxis = new Vector3(dx / d, 0, dz / d);
    const shaft = new Matrix4().compose(
      new Vector3(x, 0.77, z).addScaledVector(shaftAxis, standOff * 0.5),
      new Quaternion().setFromUnitVectors(normal, shaftAxis),
      new Vector3(0.113, 0.113, standOff),
    );
    shafts.setMatrixAt(index, shaft);
    return { wheel, gauge, indicator, bounds, tile: post.tile, id: post.id, heading: Math.atan2(-dx, -dz) };
  });
  function set(
    mesh: InstancedMesh,
    index: number,
    basis: Matrix4,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    angle = 0,
  ) {
    place.position.set(x, y, z);
    place.rotation.set(0, 0, angle);
    place.scale.set(w, h, d);
    place.updateMatrix();
    mesh.setMatrixAt(index, matrix.multiplyMatrices(basis, place.matrix));
  }
  settings.forEach(({ wheel, gauge, indicator }, i) => {
    set(drives, i, wheel, 0, 0, 0.035, 0.114, 0.114, 0.24);
    set(wheels, i, wheel, 0, 0, 0.175, 1, 1, 1);
    set(dials, i, gauge, 0, 0, 0.074, 0.205, 0.205, 0.051);
    for (let j = 0; j < 5; j++) {
      const a = -1.13 + j * 0.565;
      set(graduations, i * 5 + j, gauge, Math.sin(a) * 0.154, Math.cos(a) * 0.154, 0.107, 0.021, 0.043, 0.017, -a);
    }
    // Two iron guides retain a sliding six-sided sight glass immediately below the lifting eye.
    for (let j = 0; j < 2; j++) set(guides, i * 2 + j, indicator, (j - 0.5) * 0.35, 0.1, 0, 0.029, 0.22, 0.066);
  });
  for (const part of parts) part.instanceMatrix.needsUpdate = true;
  return {
    root,
    handwheel(frame: FortressInteriorFrame) {
      const age = frame.wardAdjustmentAge ?? Infinity;
      if (frame.reduced || frame.ward?.phase !== 'braced' || age < 0 || age >= 0.86) return;
      const post = settings.find((p) => p.id === frame.ward!.fault);
      if (!post || Math.abs(frame.x - post.tile.x - 0.5) + Math.abs(frame.y - post.tile.y - 0.5) > 0.06) return;
      return { progress: age / 0.86, heading: post.heading };
    },
    pose(i: number, slack: number, turn: number, sway: number, receipt: number) {
      const { wheel, gauge, indicator } = settings[i];
      const markAngle = 0.79 - slack * 1.69 + sway * 1.4;
      for (let arm = 0; arm < 3; arm++) {
        const a = turn + (arm * tau) / 3;
        set(spokes, i * 3 + arm, wheel, Math.cos(a) * 0.119, Math.sin(a) * 0.119, 0.175, 0.235, 0.053, 0.04, a);
      }
      set(knobs, i, wheel, Math.cos(turn) * 0.223, Math.sin(turn) * 0.223, 0.237, 0.051, 0.051, 0.145);
      set(
        needles,
        i,
        gauge,
        Math.sin(markAngle) * 0.072,
        Math.cos(markAngle) * 0.072,
        0.114,
        0.027,
        0.146,
        0.016,
        -markAngle,
      );
      needles.setColorAt(i, tint.copy(teal).lerp(amber, slack).lerp(iceWhite, receipt));
      set(indicators, i, indicator, 0, 0.04 + slack * 0.04, 0, 1.76, 0.46 + slack * 0.59, 1.76);
      indicators.setColorAt(i, tint.copy(teal).lerp(amber, slack).lerp(iceWhite, receipt));
    },
    upload() {
      for (const part of [spokes, knobs, needles, indicators]) part.instanceMatrix.needsUpdate = true;
      if (needles.instanceColor) needles.instanceColor.needsUpdate = true;
      if (indicators.instanceColor) indicators.instanceColor.needsUpdate = true;
    },
    landmarkAt(ray: Raycaster) {
      let nearest = Infinity,
        selected: (typeof settings)[number] | undefined;
      for (const setting of settings) {
        if (!ray.ray.intersectBox(setting.bounds, rayPoint)) continue;
        const distance = rayPoint.distanceToSquared(ray.ray.origin);
        if (distance < nearest) {
          nearest = distance;
          selected = setting;
        }
      }
      return selected && { x: selected.tile.x + 0.5, y: selected.tile.y + 0.5 };
    },
    dispose() {
      for (const item of [...parts, ring, barrel, block, lens, iron, brass, face, ink]) item.dispose();
    },
  };
}
