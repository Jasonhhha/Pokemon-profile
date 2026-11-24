import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  TorusGeometry,
} from 'three';
import type { FortressRoom } from './field-fortress-state';

const tau = Math.PI * 2;

// The changing radius describes a carved column drum. Actual flutes catch the grazing light from the water.
export function carvedDrum(profile: readonly (readonly [number, number])[], flutes: number, relief: number) {
  const vertices: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const segments = flutes * 5;
  for (let row = 0; row < profile.length; row++) {
    const [height, radius] = profile[row];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * tau;
      const r = radius * (1 - relief * Math.pow(0.5 + 0.5 * Math.cos(flutes * a), 1.5));
      vertices.push(Math.cos(a) * r, height, Math.sin(a) * r);
      uvs.push(i / segments, height);
      if (row > 0 && i > 0) {
        const q = row * (segments + 1) + i,
          lower = q - segments - 1;
        indices.push(lower - 1, q - 1, q, lower - 1, q, lower);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createTideDial(room: FortressRoom) {
  const group = new Group();
  const downstairs = room === 'seal';
  const wheel = new Group();
  const nearWheel = new Group();
  const bronze = new MeshStandardMaterial({ color: 0xb19763, metalness: 0.46, roughness: 0.49 });
  const oldCopper = new MeshStandardMaterial({ color: 0x49766a, metalness: 0.41, roughness: 0.53 });
  const basalt = new MeshStandardMaterial({ color: 0x304443, roughness: 0.79 });
  const inlay = new MeshStandardMaterial({
    color: 0x56796e,
    roughness: 0.38,
    metalness: 0.25,
    emissive: 0x285c4c,
    emissiveIntensity: 0,
  });
  const geometries: BufferGeometry[] = [];
  const owned = <T extends BufferGeometry>(g: T) => {
    geometries.push(g);
    return g;
  };
  const cube = owned(new BoxGeometry());
  const cylinder = owned(new CylinderGeometry(1, 1, 1, 64));
  const markPositions: number[] = [],
    markColors: number[] = [],
    flow: number[] = [];
  const baseColor = new Color(0x193c39),
    litColor = new Color(0xb5dbb9);
  const placer = new Object3D();
  const col = new Color();
  function disk(parent: Group, r: number, y: number, m: MeshStandardMaterial, thick: number) {
    const stone = new Mesh(cylinder, m);
    stone.scale.set(r, thick, r);
    stone.position.y = y;
    stone.castShadow = true;
    stone.receiveShadow = true;
    parent.add(stone);
  }
  function hoop(parent: Group, r: number, y: number, tube: number, m: MeshStandardMaterial) {
    const shape = owned(new TorusGeometry(r, tube, 7, 80));
    shape.rotateX(-Math.PI / 2);
    const ring = new Mesh(shape, m);
    ring.position.y = y;
    ring.castShadow = true;
    parent.add(ring);
  }
  function radialMarks(
    parent: Group,
    r: number,
    y: number,
    count: number,
    width: number,
    length: number,
    m: MeshStandardMaterial,
  ) {
    const marks = new InstancedMesh(cube, m, count);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * tau,
        major = i % 4 === 0;
      placer.position.set(r * Math.sin(a), y, r * Math.cos(a));
      placer.scale.set(major ? width * 1.7 : width, 0.018, length * (major ? 1.55 : 1));
      placer.rotation.set(0, a, 0);
      placer.updateMatrix();
      marks.setMatrixAt(i, placer.matrix);
    }
    parent.add(marks);
  }
  function meridian(g: Group, radius: number, pitch: number, yaw: number, metal: MeshStandardMaterial, tube: number) {
    const arc = new Mesh(owned(new TorusGeometry(radius, tube, 8, 80)), metal);
    arc.rotation.set(pitch, yaw, 0);
    arc.castShadow = true;
    g.add(arc);
  }
  // A narrow open stone runnel carries a visible moving meniscus. Its two raised edges remain readable when dry.
  function course(ax: number, az: number, bx: number, bz: number, delay: number, y = 0.049, width = 0.053) {
    const dx = bx - ax,
      dz = bz - az,
      len = Math.hypot(dx, dz),
      nx = dz / len,
      nz = -dx / len;
    for (const side of [-1, 1]) {
      const rim = new Mesh(cube, oldCopper);
      rim.position.set(
        (ax + bx) / 2 + nx * side * (width + 0.023),
        y - 0.013,
        (az + bz) / 2 + nz * side * (width + 0.023),
      );
      rim.rotation.y = Math.atan2(dx, dz);
      rim.scale.set(0.029, 0.026, len);
      group.add(rim);
    }
    const intervals = Math.max(1, Math.ceil(len * 5));
    for (let j = 0; j < intervals; j++) {
      const corners = [
        [j, -1],
        [j, 1],
        [j + 1, -1],
        [j, 1],
        [j + 1, 1],
        [j + 1, -1],
      ];
      for (const [k, s] of corners) {
        const f = k / intervals;
        markPositions.push(ax + dx * f + nx * s * width, y, az + dz * f + nz * s * width);
        flow.push(delay + f * len);
        markColors.push(0, 0, 0);
      }
    }
  }
  if (!downstairs) {
    wheel.position.set(8.5, 0, 8.5);
    group.add(wheel);
    disk(wheel, 1.31, 0.023, basalt, 0.03);
    hoop(wheel, 1.28, 0.047, 0.033, bronze);
    hoop(wheel, 1.09, 0.048, 0.017, oldCopper);
    hoop(wheel, 0.8, 0.048, 0.029, bronze);
    radialMarks(wheel, 1.17, 0.049, 64, 0.022, 0.087, bronze);
    wheel.add(nearWheel);
    radialMarks(nearWheel, 0.6, 0.057, 12, 0.052, 0.39, oldCopper);
    for (let i = 0; i < 4; i++) {
      const a = (i * tau) / 4;
      const pointer = new Mesh(cube, bronze);
      pointer.position.set(0.49 * Math.sin(a), 0.065, 0.49 * Math.cos(a));
      pointer.rotation.y = a;
      pointer.scale.set(0.064, 0.029, 0.56);
      nearWheel.add(pointer);
    }
    disk(nearWheel, 0.25, 0.055, oldCopper, 0.042);
    hoop(nearWheel, 0.25, 0.084, 0.021, bronze);
    disk(nearWheel, 0.094, 0.086, inlay, 0.021);
    for (const side of [-1, 1]) {
      const x = 8.5 + side * 0.94;
      course(8.5 + side * 0.16, 8.4, x, 7.62, 0);
      course(x, 7.62, x, 3.1, 1.11);
      course(x, 3.1, 8.5 + side * 0.54, 2.33, 5.63, -0.04);
    }
  } else {
    // The counterpart is an armillary tide calendar. Through its open rings the sanctuary continues into darkness.
    wheel.position.set(8.5, 3.16, -4.74);
    group.add(wheel);
    meridian(wheel, 2.55, 0, 0, bronze, 0.097);
    meridian(wheel, 2.3, 0, 0, oldCopper, 0.032);
    wheel.add(nearWheel);
    meridian(nearWheel, 1.87, -0.14, -0.42, bronze, 0.062);
    meridian(nearWheel, 1.58, 0.63, 0.67, oldCopper, 0.056);
    meridian(nearWheel, 1.29, -0.67, 0.21, bronze, 0.033);
    const ticks = new Group();
    ticks.rotation.x = Math.PI / 2;
    radialMarks(ticks, 2.42, 0, 64, 0.028, 0.115, bronze);
    wheel.add(ticks);
    meridian(nearWheel, 0.31, 0.17, 0.3, inlay, 0.05);
    for (const side of [-1, 1]) {
      const x = 8.5 + side * 0.93;
      course(x, 17.74, x, 11.18, 0);
      course(x, 11.18, 8.5 + side * 0.6, 11.03, 6.56);
    }
  }
  const channels = owned(new BufferGeometry());
  const colors = new Float32BufferAttribute(markColors, 3);
  channels.setAttribute('position', new Float32BufferAttribute(markPositions, 3));
  channels.setAttribute('color', colors);
  const moving = new MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: DoubleSide });
  const surface = new Mesh(channels, moving);
  group.add(surface);
  let lastResponse = -1,
    lastFrame = -1;
  return {
    group,
    update(response: number, time: number) {
      if (response === lastResponse && (response === 0 || time === lastFrame)) return;
      lastResponse = response;
      lastFrame = time;
      if (downstairs) nearWheel.rotation.set(response * 0.28, response * 0.96, -response * 0.29);
      else nearWheel.rotation.y = response * Math.PI * 0.36;
      inlay.emissiveIntensity = 0.05 + response * 0.62;
      for (let i = 0; i < flow.length; i++) {
        const bound = response * 8.0 - flow[i];
        const wet = Math.max(0, Math.min(1, bound * 2.6));
        const glint = 0.5 + 0.5 * Math.cos(flow[i] * 3.2 - time * 3.4);
        col.copy(baseColor).lerp(litColor, wet * (0.4 + 0.18 * glint));
        colors.setXYZ(i, col.r, col.g, col.b);
      }
      colors.needsUpdate = true;
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of [bronze, oldCopper, basalt, inlay, moving]) m.dispose();
      group.traverse(object => {
        if (object instanceof InstancedMesh) object.dispose();
      });
    },
  };
}
