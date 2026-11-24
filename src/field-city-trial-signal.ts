import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { ringAngle, ringPosition } from './field-ring-space';
import { trialSignalSite } from './field-city-walks';

export function buildTrialSignal() {
  const group = new Group();
  const stone = new MeshStandardMaterial({ color: 0xc6bca3, roughness: .91 });
  const iron = new MeshStandardMaterial({ color: 0x344341, metalness: .36, roughness: .62 });
  const brass = new MeshStandardMaterial({ color: 0xaf8955, metalness: .48, roughness: .49 });
  const glass = new MeshStandardMaterial({ color: 0x436457, emissive: 0x6ce3a7, emissiveIntensity: 0, roughness: .32 });
  const shaft = new CylinderGeometry(1, 1, 1, 12), block = new BoxGeometry(1, 1, 1);
  function circle(paint: MeshStandardMaterial, height: number, radius: number, thickness: number) {
    const part = new Mesh(shaft, paint);
    part.scale.set(radius, thickness, radius);
    part.position.y = height;
    part.castShadow = part.receiveShadow = true;
    group.add(part);
  }
  circle(stone, .07, .218, .14);
  circle(iron, .155, .178, .075);
  circle(iron, .64, .066, .91);
  circle(brass, .92, .089, .062);
  circle(iron, 1.12, .174, .17);
  circle(glass, 1.35, .139, .33);
  for (let face = 0; face < 6; face++) {
    const angle = face * Math.PI / 3;
    const pin = new Mesh(block, brass);
    pin.position.set(Math.sin(angle) * .135, 1.35, Math.cos(angle) * .135);
    pin.scale.set(.021, .36, .021);
    group.add(pin);
  }
  circle(iron, 1.55, .174, .076);
  circle(brass, 1.606, .095, .048);
  const site = ringPosition(trialSignalSite.x, trialSignalSite.y);
  group.name = 'East wharf trial signal';
  group.position.set(site.x, 0, site.z);
  group.rotation.y = ringAngle(trialSignalSite.x);
  let lit: boolean | undefined;
  return { group, update(next: boolean) {
    if (lit === next) return;
    lit = next;
    glass.color.setHex(lit ? 0xb4efbd : 0x436457);
    glass.emissiveIntensity = lit ? 1.35 : 0;
  }, dispose() {
    for (const paint of [stone, iron, brass, glass]) paint.dispose();
    shaft.dispose();
    block.dispose();
  } };
}
