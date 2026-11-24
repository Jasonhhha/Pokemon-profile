import { Color, CylinderGeometry, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import type { FortressInteriorFrame } from './field-fortress-state';
import { riserCrest, riserOutput, riserSites, type RiserRoom } from './fortress-risers';

export function buildPalaceRisers(room: RiserRoom) {
  const site = riserSites[room];
  const group = new Group();
  const cylinder = new CylinderGeometry(1, 1, 1, 12);
  const metal = new MeshStandardMaterial({ color: 0x665846, roughness: .49, metalness: .49 });
  const stone = new MeshStandardMaterial({ color: 0x334449, roughness: .92 });
  const glass = new MeshStandardMaterial({ color: 0x54867f, roughness: .26, metalness: .26, emissive: 0x4bbaad, emissiveIntensity: .43 });
  const lit = new MeshStandardMaterial({ color: 0xffffff, roughness: .4, emissive: 0x173735 });
  const foundation: Matrix4[] = [], casing: Matrix4[] = [], core: Matrix4[] = [], slits: Matrix4[] = [];
  const ringHeights: number[] = [];
  const p = new Vector3(), s = new Vector3(), q = new Quaternion();
  function segment(parts: Matrix4[], x: number, z: number, h: number, radius: number, thickness: number) {
    parts.push(new Matrix4().compose(p.set(x, h, z), q, s.set(radius, thickness, radius)));
  }
  for (const side of [-1, 1]) {
    const x = site.center + side * site.spread, z = site.z;
    segment(foundation, x, z, -.35, .67, 1.5);
    segment(casing, x, z, .42, .53, .24);
    segment(core, x, z, site.height / 2, .227, site.height);
    for (let rail = 0; rail < 4; rail++) {
      const a = Math.PI * .25 + rail * Math.PI / 2;
      segment(casing, x + Math.cos(a) * .32, z + Math.sin(a) * .32, site.height / 2, .056, site.height);
    }
    for (let h = .85; h < site.height; h += .75) {
      segment(casing, x, z, h, .37, .14);
      segment(slits, x, z, h + .12, .313, .094);
      ringHeights.push(h);
    }
    segment(foundation, x, z, site.height, .59, .42);
  }
  function batch(parts: Matrix4[], material: MeshStandardMaterial) {
    const mesh = new InstancedMesh(cylinder, material, parts.length);
    parts.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.computeBoundingSphere();
    group.add(mesh);
    return mesh;
  }
  batch(foundation, stone);
  batch(casing, metal);
  batch(core, glass);
  const bands = batch(slits, lit);
  const shade = new Color();
  return { group, update(frame: FortressInteriorFrame) {
    const level = riserOutput(frame, room), phase = frame.power?.phase ?? .45;
    glass.emissiveIntensity = .12 + level * .65;
    ringHeights.forEach((h, index) => {
      const glow = level * (.11 + .89 * riserCrest(phase, room, h, frame.reduced));
      bands.setColorAt(index, shade.setRGB(.07 + glow * .74, .17 + glow * 1.23, .18 + glow * 1.08));
    });
    if (bands.instanceColor) bands.instanceColor.needsUpdate = true;
  }, dispose() {
    for (const mesh of group.children) if (mesh instanceof InstancedMesh) mesh.dispose();
    group.removeFromParent();
    cylinder.dispose();
    for (const mat of [metal, stone, glass, lit]) mat.dispose();
  } };
}
