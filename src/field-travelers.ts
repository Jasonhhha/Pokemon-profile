import {
  BoxGeometry, CapsuleGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial,
  SphereGeometry, type BufferGeometry, type ColorRepresentation,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { FieldMap } from './field-layout';
import type { Direction } from './field';

type Role = FieldMap['npcs'][number]['style'] | 'player' | 'commuter' | 'courier' | 'resident';
type Shape = [number, number, number];
type Paint = { coat: number; seam: number; trim: number; hat: number; hair: number; skin: number; pants: number };

const outfits: Record<Role, Paint> = {
  player: { coat: 0x2e6178, seam: 0x193e53, trim: 0xe5a455, hat: 0xdcaa69, hair: 0x32273a, skin: 0xc48866, pants: 0x263c50 },
  guide: { coat: 0x88495b, seam: 0x5a354c, trim: 0xf0b79b, hat: 0xbc674f, hair: 0x322536, skin: 0xe9ad90, pants: 0x484055 },
  researcher: { coat: 0xd6c3a1, seam: 0x587776, trim: 0xe4d8b5, hat: 0x5f837d, hair: 0x4a3340, skin: 0xbd7f63, pants: 0x40575c },
  healer: { coat: 0xa0c5b3, seam: 0x4d7873, trim: 0xf8e7c5, hat: 0xede1ce, hair: 0x654739, skin: 0xe5a682, pants: 0x56756d },
  keeper: { coat: 0x596f89, seam: 0x364760, trim: 0xe0b17b, hat: 0x686681, hair: 0x312b40, skin: 0xbb8269, pants: 0x3d4360 },
  trial: { coat: 0x405b69, seam: 0x283e4c, trim: 0xddb778, hat: 0xe2dfc9, hair: 0x302938, skin: 0xd99879, pants: 0x384856 },
  spar: { coat: 0x6d5271, seam: 0x433a56, trim: 0xefb8a1, hat: 0x9f666d, hair: 0x443044, skin: 0xab6f55, pants: 0x4a465e },
  commuter: { coat: 0x5b6979, seam: 0x384954, trim: 0xdacba9, hat: 0x556478, hair: 0x57382d, skin: 0xe0ad8f, pants: 0x425566 },
  courier: { coat: 0xb48357, seam: 0x674b50, trim: 0xf1d397, hat: 0x506572, hair: 0x392f39, skin: 0xaa745e, pants: 0x525563 },
  resident: { coat: 0x7d9b8d, seam: 0x526e72, trim: 0xebc59e, hat: 0x956362, hair: 0x4a3334, skin: 0xca8c6d, pants: 0x465a61 },
};

const face = new SphereGeometry(1, 18, 12);
const soft = new CapsuleGeometry(.5, .65, 4, 12);
const cylinder = new CylinderGeometry(1, 1, 1, 16);
const block = new BoxGeometry(1, 1, 1);
const cloth = new Map<ColorRepresentation, MeshStandardMaterial>();
const facingAngle: Record<Direction, number> = { down: 0, right: Math.PI / 2, up: Math.PI, left: -Math.PI / 2 };

function part(parent: Group, geometry: BufferGeometry, color: ColorRepresentation, position: Shape, scale: Shape, pitch = 0, roll = 0) {
  let material = cloth.get(color);
  if (!material) {
    material = new MeshStandardMaterial({ color, roughness: .78 });
    cloth.set(color, material);
  }
  const mesh = new Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(pitch, 0, roll);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function fixedPieces(group: Group) {
  const byMaterial = new Map<MeshStandardMaterial, Mesh<BufferGeometry, MeshStandardMaterial>[]>();
  for (const child of group.children) {
    if (!(child instanceof Mesh)) continue;
    const list = byMaterial.get(child.material) ?? [];
    list.push(child);
    byMaterial.set(child.material, list);
  }
  const owned: BufferGeometry[] = [];
  for (const [material, meshes] of byMaterial) {
    if (meshes.length < 2) continue;
    const local = meshes.map(mesh => {
      mesh.updateMatrix();
      return (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(mesh.matrix);
    });
    const combined = mergeGeometries(local);
    local.forEach(geometry => geometry.dispose());
    if (!combined) continue;
    const mesh = new Mesh(combined, material);
    mesh.receiveShadow = true;
    group.remove(...meshes);
    group.add(mesh);
    owned.push(combined);
  }
  return owned;
}

function collar(torso: Group, colors: Paint, wrap: boolean) {
  part(torso, cylinder, wrap ? colors.trim : colors.seam, [0, .327, .014], [.186, wrap ? .103 : .074, .153]);
  if (wrap) {
    part(torso, soft, colors.trim, [.103, .244, .174], [.072, .129, .055], -.22, .19);
    part(torso, soft, colors.seam, [.129, .218, .173], [.021, .099, .023], -.22, .19);
  } else {
    for (const side of [-1, 1]) part(torso, block, colors.trim, [side * .113, .254, .157], [.076, .159, .035], -.33, side * .30);
  }
}

function bag(torso: Group, color: number, seam: number, trim: number) {
  part(torso, soft, color, [0, .080, -.255], [.397, .296, .255], -.09);
  part(torso, face, trim, [0, .215, -.306], [.212, .078, .125], -.2);
  part(torso, soft, seam, [0, .010, -.374], [.28, .139, .068], Math.PI / 2);
  for (const sign of [-1, 1]) {
    part(torso, block, seam, [sign * .186, .112, .165], [.048, .300, .036], -.17, -sign * .12);
    part(torso, block, trim, [sign * .180, .006, .196], [.052, .050, .028], -.17, -sign * .12);
    part(torso, block, seam, [sign * .114, .145, -.401], [.025, .211, .021], .11);
  }
}

function headwear(head: Group, role: Role, colors: Paint) {
  if (role === 'guide') {
    for (const side of [-1, 1]) {
      part(head, soft, colors.hair, [side * .208, -.109, -.029], [.158, .274, .211], -.20, side * -.24);
    }
    part(head, soft, colors.hair, [-.104, .156, .173], [.13, .173, .115], .38, -.69);
    part(head, face, colors.hair, [.127, .198, .117], [.144, .115, .117], -.03, .27);
    part(head, block, colors.trim, [.173, .123, .217], [.088, .024, .031], -.1, .42);
    return;
  }
  if (role === 'healer') {
    part(head, soft, colors.hat, [0, .178, -.029], [.486, .193, .453], Math.PI / 2);
    part(head, face, colors.seam, [0, .149, .177], [.237, .089, .120], -.12);
    part(head, block, colors.trim, [0, .182, .279], [.071, .035, .015]);
    part(head, block, colors.trim, [0, .182, .279], [.029, .077, .015]);
    return;
  }
  if (role === 'keeper') {
    part(head, face, colors.hat, [0, .137, -.026], [.270, .180, .253]);
    part(head, cylinder, colors.seam, [0, .104, -.016], [.266, .073, .255], .03);
    part(head, face, colors.trim, [0, .307, -.041], [.085, .068, .072]);
    for (const side of [-1, 1]) part(head, soft, colors.hat, [side * .239, .020, .023], [.100, .124, .147], -.16, side * -.11);
    return;
  }
  if (role === 'trial') {
    part(head, cylinder, colors.hat, [0, .182, -.012], [.295, .125, .272], -.045);
    part(head, face, colors.hat, [0, .218, -.012], [.287, .098, .267], -.045);
    part(head, cylinder, colors.seam, [0, .112, .007], [.263, .068, .245], -.045);
    part(head, face, colors.seam, [0, .093, .190], [.243, .036, .137], -.14);
    part(head, soft, colors.trim, [0, .151, .257], [.067, .066, .022], -.17);
    return;
  }
  if (role === 'spar') {
    part(head, face, colors.hair, [0, .165, -.035], [.266, .154, .249]);
    part(head, cylinder, colors.hat, [0, .113, .027], [.268, .062, .242], -.08);
    part(head, soft, colors.hat, [.236, .057, -.148], [.045, .112, .052], .62, .31);
    part(head, face, colors.hair, [-.09, .129, .191], [.118, .094, .087], -.12, -.37);
    return;
  }
  if (role === 'resident') {
    part(head, face, colors.hair, [-.12, .124, .160], [.135, .124, .086], 0, -.47);
    part(head, face, colors.hat, [.016, .155, -.006], [.279, .127, .250], -.04, .25);
    part(head, cylinder, colors.seam, [0, .098, .019], [.262, .045, .244], -.03);
    return;
  }
  const bucket = role === 'researcher';
  part(head, face, colors.hat, [0, .157, -.019], [.279, bucket ? .175 : .137, .259], -.08);
  part(head, cylinder, colors.seam, [0, .106, -.006], [.271, .054, .247], -.03);
  part(head, cylinder, colors.hat, [0, .082, bucket ? .022 : .154],
    [bucket ? .321 : .236, .040, bucket ? .289 : .195], bucket ? .03 : -.20);
  if (!bucket) {
    part(head, face, colors.trim, [0, .182, .226], [.047, .041, .020]);
    part(head, cylinder, colors.hat, [0, .286, -.028], [.045, .031, .045]);
  }
}

const thighLength = .266;
const shinLength = .247;
const ankleRest = .086;
const hipRest = .58;

function makeLeg(parent: Group, sign: number, colors: Paint, boot: number) {
  const hip = new Group();
  const knee = new Group();
  const ankle = new Group();
  parent.add(hip);
  hip.add(knee);
  knee.add(ankle);
  hip.position.set(sign * .139, hipRest, 0);
  knee.position.y = -thighLength;
  ankle.position.y = -shinLength;
  part(hip, soft, colors.pants, [0, -.120, 0], [.214, .166, .217]);
  part(knee, soft, colors.pants, [0, -.096, .005], [.169, .145, .180]);
  part(knee, cylinder, colors.seam, [0, -.172, .015], [.094, .084, .102]);
  part(ankle, face, boot, [0, -.015, .062], [.111, .075, .163]);
  part(ankle, face, 0x283039, [0, -.060, .066], [.115, .034, .171]);
  part(ankle, block, colors.trim, [0, .032, .100], [.095, .013, .041], -.11);
  return { hip, knee, ankle };
}

function positionLeg(leg: ReturnType<typeof makeLeg>, phase: number, energy: number, hipHeight: number, running: boolean) {
  const down = running ? .49 : .61;
  const lift = phase < down ? 0 : (phase - down) / (1 - down);
  const swing = lift * lift * (3 - 2 * lift);
  const reach = (running ? .260 : .190) * energy;
  const forward = phase < down ? reach * (1 - 2 * phase / down) : reach * (2 * swing - 1);
  const foot = ankleRest + Math.sin(Math.PI * lift) * (running ? .177 : .117) * energy;
  const vertical = hipHeight - foot;
  const length = Math.min(thighLength + shinLength - .0005, Math.hypot(vertical, forward));
  const joint = Math.acos((thighLength ** 2 + length ** 2 - shinLength ** 2) / (2 * thighLength * length));
  const hinge = Math.acos((thighLength ** 2 + shinLength ** 2 - length ** 2) / (2 * thighLength * shinLength));
  leg.hip.position.y = hipHeight;
  leg.hip.rotation.x = Math.atan2(-forward, vertical) - joint;
  leg.knee.rotation.x = Math.PI - hinge;
  leg.ankle.rotation.x = -(leg.hip.rotation.x + leg.knee.rotation.x) + Math.sin(Math.PI * lift) * energy * .20;
}

type TravelerPose = {
  facing: Direction; time: number; phase?: number; running?: boolean; reduced?: boolean; focus?: boolean;
  handwheel?: {progress:number; heading:number};
};

export function createTraveler(role: Role) {
  const c = outfits[role];
  const model = new Group();
  const torso = new Group();
  const head = new Group();
  const eyes = new Group();
  const arms: Group[] = [];
  model.add(torso);
  torso.add(head);
  head.add(eyes);
  torso.position.y = .758;
  head.position.set(0, .570, .010);

  const legs = [-1, 1].map(side => makeLeg(model, side, c, role === 'player' ? 0x795744 : 0x544851));
  for (const side of [-1, 1]) {
    const arm = new Group();
    arms.push(arm);
    torso.add(arm);
    arm.position.set(side * .285, .237, 0);
    part(arm, soft, c.coat, [0, -.124, 0], [.185, .251, .194]);
    part(arm, cylinder, c.seam, [0, -.271, .002], [.095, .079, .104]);
    part(arm, face, c.skin, [0, -.339, .029], [.073, .084, .075], -.13);
    if (role === 'spar' || role === 'healer') part(arm, cylinder, c.trim, [0, -.295, .009], [.087, .041, .093]);
  }

  part(torso, soft, c.coat, [0, .015, -.017], [.553, .366, .442], -.053);
  part(torso, face, c.coat, [0, .170, -.029], [.282, .160, .203]);
  part(torso, cylinder, c.seam, [0, -.229, -.026], [.264, .056, .206]);
  part(torso, block, c.seam, [.003, .016, .215], [.028, .383, .018], -.029);
  part(torso, block, c.trim, [.005, .144, .232], [.031, .066, .029], -.029);
  part(torso, cylinder, c.skin, [0, .365, .007], [.105, .091, .097]);
  collar(torso, c, role === 'player' || role === 'guide' || role === 'resident');
  for (const side of [-1, 1]) {
    part(torso, soft, c.seam, [side * .146, -.106, .176], [.105, .109, .038], -.10, side * .24);
    part(torso, block, c.trim, [side * .153, -.067, .199], [.084, .022, .017], -.10, side * .24);
  }
  if (role === 'player' || role === 'guide') bag(torso, role === 'player' ? 0xa2694b : 0xb97d62, c.seam, c.trim);
  if (role === 'trial') {
    for (const side of [-1, 1]) {
      part(torso, block, c.trim, [side * .217, .283, .047], [.127, .025, .13], 0, side * -.16);
      for (const row of [0, 1, 2]) part(torso, face, c.trim, [side * .073, .128 - row * .094, .203], [.020, .020, .011]);
    }
  }
  if (role === 'courier') bag(torso, 0x69595a, c.seam, c.trim);
  if (role === 'commuter') {
    part(torso, block, 0x645348, [.384, -.294, -.022], [.17, .205, .28], -.13, -.10);
    part(torso, block, 0xa98967, [.366, -.181, -.025], [.072, .046, .067], -.13, -.10);
  }
  if (role === 'researcher' || role === 'keeper') {
    part(torso, block, c.seam, [.180, .124, .182], [.108, .091, .054], -.13, -.15);
    part(torso, block, c.trim, [.174, .140, .216], [.081, .026, .017], -.13, -.15);
  }

  part(head, face, c.hair, [0, .006, -.050], [.258, .273, .239]);
  part(head, face, c.skin, [0, -.017, .043], [.233, .224, .215]);
  part(head, face, c.skin, [0, -.153, .075], [.153, .087, .155]);
  part(head, face, c.skin, [0, -.053, .265], [.033, .037, .033]);
  for (const side of [-1, 1]) {
    part(head, face, c.skin, [side * .224, -.043, .045], [.053, .079, .057], 0, side * -.12);
    part(head, face, c.hair, [side * .090, .061, .225], [.038, .012, .022], 0, side * .10);
    part(eyes, face, 0x302733, [side * .092, -.002, .242], [.024, .033, .020]);
    part(eyes, face, 0xf7e7d0, [side * .092 - .006, .010, .258], [.006, .007, .005]);
    if (role === 'researcher') {
      part(head, block, c.seam, [side * .094, .037, .259], [.126, .013, .029]);
      part(head, block, c.seam, [side * .155, .006, .244], [.016, .079, .035], 0, side * .10);
      part(head, block, c.seam, [side * .051, -.035, .259], [.081, .013, .022]);
    }
  }
  part(head, face, 0x865350, [0, -.113, .236], [.042, .010, .012]);
  headwear(head, role, c);

  const meshGroups = [torso, head, eyes, ...arms, ...legs.flatMap(({ hip, knee, ankle }) => [hip, knee, ankle])];
  const owned = meshGroups.flatMap(fixedPieces);
  const idleOffset = Object.keys(outfits).indexOf(role) * .77;
  let lastTime = 0;
  let heading = 0;
  let gait = 0;
  let strength = 0;

  function pose({ facing, time, phase, reduced = false, running = false, focus = false, handwheel }: TravelerPose) {
    const duration = Math.min(65, Math.max(0, time - lastTime));
    const instant = reduced || !lastTime || time - lastTime > 220;
    const angle = handwheel?.heading ?? facingAngle[facing];
    const difference = Math.atan2(Math.sin(angle - heading), Math.cos(angle - heading));
    heading = instant ? angle : heading + difference * (1 - Math.exp(-duration / 41));
    lastTime = time;
    model.rotation.y = heading;

    const moving = phase !== undefined && !reduced;
    if (moving) gait = phase % 1;
    const requested = Number(moving);
    strength = instant ? requested : strength + (requested - strength) * (1 - Math.exp(-duration / (moving ? 29 : 50)));
    const step = Math.sin(gait * Math.PI * 2) * strength;
    const bounce = (.018 - .029 * Math.cos(gait * Math.PI * 4)) * strength;
    const seconds = time / 1000;
    const breath = reduced ? 0 : .009 * Math.sin(seconds * 2.65 + idleOffset);
    const hipHeight = hipRest + bounce;
    const lean = strength * (running ? .145 : .074);
    for (let i = 0; i < legs.length; i++) {
      positionLeg(legs[i], (gait + i * .5) % 1, strength, hipHeight, running);
      arms[i].rotation.x = (i ? -1 : 1) * step * (running ? .49 : .33) - .10 * strength;
      arms[i].rotation.z = (i ? 1 : -1) * (.084 + .020 * Math.abs(step));
    }
    torso.position.set(step * .024, .758 + bounce + breath, .012 + .031 * strength);
    torso.rotation.set(lean, .066 * step, -.055 * step);
    head.rotation.x = -lean * .75 + (focus ? .029 : 0);
    head.rotation.z = .034 * step + (focus ? .035 : 0);
    if (handwheel) {
      const p = handwheel.progress;
      const grip = Math.min(1, p/.16, (1-p)/.19);
      const wind = 2.7 * Math.PI * p*p*(3-2*p), pull = Math.sin(wind);
      // The feet remain planted while the shoulders alternate between pushing
      // and pulling the rim; both hands release before returning to rest.
      for (let i=0;i<arms.length;i++) {
        const side=i===0 ? -1 : 1;
        arms[i].rotation.x -= (1.23 + side*.52*pull)*grip;
        arms[i].rotation.z -= side*(.33+.16*Math.cos(wind))*grip;
      }
      torso.position.z += .095*grip;
      torso.position.y -= .045*grip;
      torso.rotation.x += .19*grip;
      torso.rotation.y += .095*pull*grip;
      head.rotation.x += .07*grip;
    }
    const blink = (seconds + idleOffset) % 4.7;
    eyes.scale.y = reduced || blink > .16 ? 1 : .14 + .86 * Math.abs(blink / .08 - 1);
  }

  return { model, pose, dispose: () => owned.forEach(geometry => geometry.dispose()) };
}
