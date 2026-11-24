import {
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Points,
  ShaderMaterial,
  TorusGeometry,
  Vector3,
} from 'three';
import { wardArrival, wardPosts, wardServiceLight, wardWalkway, type WardSurvey } from './fortress-ward-service';
import type { FortressInteriorFrame } from './field-fortress-state';
import { createWardCapstans } from './fortress-ward-capstans';

const tau = Math.PI * 2;
const linksPerChain = 13;
const grainsPerPost = 28;
const noise = (seed: number) => {
  const wave = Math.sin(37.317 * seed + 5.124) * 43193.68;
  return wave - Math.floor(wave);
};

// The chain first tightens at the collar. The tug reaches the capstan after travelling up the chain.
export function createWardAnchors(center: Vector3, dimensions: Vector3) {
  const root = new Group();
  const capstans = createWardCapstans(center,5.85);
  root.add(capstans.root);
  const linkShape = new TorusGeometry(1, 0.19, 6, 14),
    eyeShape = new TorusGeometry(0.205, 0.036, 7, 24);
  const cuffShape = new CylinderGeometry(0.221, 0.224, 0.052, 25);
  const steel = new MeshStandardMaterial({ color: 0x424a46, metalness: 0.59, roughness: 0.38 });
  const brass = new MeshStandardMaterial({ color: 0x967954, metalness: 0.61, roughness: 0.37 });
  const enamel = new MeshBasicMaterial({ color: 0xffffff });
  const chains = new InstancedMesh(linkShape, steel, wardPosts.length * linksPerChain);
  const eyes = new InstancedMesh(eyeShape, brass, wardPosts.length);
  const cuffs = new InstancedMesh(cuffShape, enamel, wardPosts.length);
  for (const mesh of [eyes, cuffs, chains]) {
    mesh.frustumCulled = false;
    root.add(mesh);
  }
  chains.castShadow = eyes.castShadow = true;
  chains.receiveShadow = eyes.receiveShadow = true;
  const posts = wardPosts.map(({bearing:a,id}) => {
    const nx = Math.sin(a),
      nz = Math.cos(a);
    const arrival = wardArrival(a) - .102;
    const radius = 5.85;
    return {
      a,
      id,
      nx,
      nz,
      arrival,
      x: center.x + nx * radius,
      z: center.z + nz * radius,
      toeX: center.x + nx * dimensions.x,
      toeZ: center.z + nz * dimensions.z,
    };
  });
  const crustVertices: number[] = [],
    frostColors: number[] = [];
  for (const [index, post] of posts.entries())
    for (let side = 0; side < 4; side++) {
      const nx = Math.cos((side * Math.PI) / 2),
        nz = Math.sin((side * Math.PI) / 2),
        tx = -nz,
        tz = nx;
      const edge = (u: number, r: number, y: number) => [post.x + tx * u + nx * r, y, post.z + tz * u + nz * r];
      for (let i = 0; i < 10; i++) {
        const seed = 100 * index + side * 13 + i;
        if (noise(seed) < 0.17) continue;
        const u = -0.34 + i * 0.069,
          v = u + 0.05 + 0.022 * noise(seed + 29);
        const depth = 0.015 + 0.086 * noise(seed + 45),
          lip = 0.023 + 0.045 * noise(seed + 71);
        const topA = edge(u, 0.371, 1.495),
          topB = edge(v, 0.371, 1.495),
          inner = edge(u + 0.027, 0.371 - depth, 1.496);
        const facet = [topA, topB, inner, topA, topB, edge((u + v) / 2, 0.378, 1.49 - lip)];
        const tone = 0.39 + 0.35 * noise(seed + 26);
        for (const vertex of facet) {
          crustVertices.push(...vertex);
          frostColors.push(tone * 0.68, tone * 0.84, tone * 0.89);
        }
      }
    }
  const crustShape = new BufferGeometry();
  crustShape.setAttribute('position', new Float32BufferAttribute(crustVertices, 3));
  crustShape.setAttribute('color', new Float32BufferAttribute(frostColors, 3));
  crustShape.computeVertexNormals();
  const frost = new MeshStandardMaterial({ vertexColors: true, roughness: 0.76, metalness: 0.03, side: DoubleSide });
  const crust = new Mesh(crustShape, frost);
  crust.receiveShadow = true;
  root.add(crust);
  const place = new Object3D(),
    basis = new Matrix4(),
    along = new Vector3(),
    across = new Vector3(),
    normal = new Vector3();
  const near = new Vector3(),
    far = new Vector3(),
    dim = new Color(0x54818a),
    lit = new Color(0xc1e7db),
    looseMetal = new Color(0xffac4e),
    tint = new Color();
  const arc = new Float32Array(25);
  const positions = new Float32Array(posts.length * grainsPerPost * 3),
    strengths = new Float32Array(positions.length / 3);
  const grits = Array.from({ length: strengths.length }, (_, i) => {
    const post = posts[Math.floor(i / grainsPerPost)],
      theta = noise(i) * tau,
      fringe = 0.19 + 0.13 * noise(i + 24),
      speed = 0.18 + 0.41 * noise(i + 73);
    const x = post.x + fringe * Math.cos(theta),
      z = post.z + fringe * Math.sin(theta);
    const y = 1.5 + noise(i + 58) * 0.14,
      vy = 0.015 + noise(i + 127) * 0.19;
    const vx = speed * Math.cos(theta), vz = speed * Math.sin(theta);
    const fallTo = (level: number) => (vy + Math.sqrt(vy * vy + 8.9 * (y - level))) / 4.45;
    const shelfTime = fallTo(.17), deckTime = fallTo(.02);
    const meetsShelf = Math.hypot(x + vx*shelfTime - post.x, z + vz*shelfTime - post.z) < .55;
    const meetsDeck = wardWalkway(Math.floor(x + vx*deckTime), Math.floor(z + vz*deckTime));
    const ground = meetsShelf ? .17 : meetsDeck ? .02 : -.641;
    const hit = fallTo(ground);
    return {
      x,
      y,
      z,
      ground,
      hit,
      vy,
      vx, vz,
      at: post.arrival + 0.09 + 0.22 * noise(i + 211),
      life: 1.6 + 0.48 * noise(i + 215),
      size: 0.035 + 0.046 * noise(i + 34),
    };
  });
  const specks = new BufferGeometry(),
    coords = new Float32BufferAttribute(positions, 3),
    strength = new Float32BufferAttribute(strengths, 1);
  specks.setAttribute('position', coords);
  specks.setAttribute('strength', strength);
  specks.setAttribute(
    'size',
    new Float32BufferAttribute(
      grits.map(g => g.size),
      1,
    ),
  );
  const dustPaint = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { height: { value: 480 } },
    vertexShader: `uniform float height;attribute float size;attribute float strength;varying float alpha;varying float hue;
      void main(){vec4 mv=modelViewMatrix*vec4(position,1.);alpha=strength;hue=fract(size*73.);gl_PointSize=clamp(height*size/max(1.,-mv.z),1.,4.5);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `varying float alpha;varying float hue;void main(){float r=length(gl_PointCoord-.5)*2.;
      float opacity=(1.-smoothstep(.41,1.,r))*alpha;if(opacity<.012)discard;
      gl_FragColor=vec4(mix(vec3(.48,.45,.36),vec3(.74,.88,.88),hue),opacity);
      #include <colorspace_fragment>
    }`,
  });
  const dust = new Points(specks, dustPaint);
  dust.frustumCulled = false;
  dust.renderOrder = 4;
  root.add(dust);
  let lastAge = -1,
    lastAdjustment = -1,
    lastSettlement = -1,
    lastWard: WardSurvey | undefined,
    lastReduced = false;
  return {
    root,
    landmarkAt: capstans.landmarkAt,
    handwheel: capstans.handwheel,
    update(age: number, frame: FortressInteriorFrame, height: number) {
      const { reduced, ward, wardAdjustmentAge = Infinity, wardSettledAge = Infinity } = frame;
      dustPaint.uniforms.height.value = height;
      // The cell is quiet between events. Keep unchanged instance buffers on the GPU.
      const phase = age > 4.1 ? Infinity : age;
      const adjustment = Math.min(1, Math.max(0, wardAdjustmentAge / 0.86));
      const settlement = Math.min(2,Math.max(0,wardSettledAge));
      if (
        phase === lastAge &&
        reduced === lastReduced &&
        adjustment === lastAdjustment &&
        settlement === lastSettlement &&
        lastWard?.phase === ward?.phase &&
        lastWard?.fault === ward?.fault
      )
        return;
      lastAge = phase;
      lastWard = ward;
      lastAdjustment = adjustment;
      lastSettlement = settlement;
      lastReduced = reduced;
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i],
          dt = phase - post.arrival;
        const underLoad = dt >= 0 && dt < 1.13;
        const pinDt = dt - 0.102;
        const faulty = ward?.fault === post.id;
        const takeup = reduced ? 1 : adjustment * adjustment * (3 - 2 * adjustment);
        const slack = faulty && ward.phase === 'seeking' ? 1 : faulty && ward.phase === 'braced' ? 1 - takeup : 0;
        // A loose dog on the ratchet rebounds a second time after the load
        // has passed; turning the wheel winds this excess chain onto its drum.
        const echo =
          faulty && ward.phase === 'seeking' && pinDt >= 0.31 && pinDt < 1.35
            ? Math.exp(-(pinDt - 0.31) * 5) * Math.sin((pinDt - 0.31) * 17)
            : 0;
        const kick = !reduced && pinDt >= 0 && pinDt < 0.94 ? 0.056 * Math.exp(-pinDt * 5.6) * Math.sin(pinDt * 22) : 0;
        const sway = kick + (reduced ? 0 : echo * 0.085);
        const winding = faulty && (ward.phase === 'braced' || ward.phase === 'stable') ? 2.7 * Math.PI * takeup : 0;
        const receipt = ward?.phase === 'stable' ? wardServiceLight(post.a,settlement,reduced) : 0;
        capstans.pose(i, slack, 0.27 + post.a * 0.4 + winding + sway * 2.8, sway, receipt);
        place.position.set(post.x + post.nx * sway, 1.83, post.z + post.nz * sway);
        place.rotation.set(sway * 0.41, post.a * 0.65, -sway * 0.7);
        place.scale.set(1, 1.06, 1);
        place.updateMatrix();
        eyes.setMatrixAt(i, place.matrix);
        place.position.set(post.x, 1.595, post.z);
        place.rotation.set(0, 0, 0);
        place.scale.set(1, 1, 1);
        place.updateMatrix();
        cuffs.setMatrixAt(i, place.matrix);
        const flash = underLoad ? Math.sin(Math.min(Math.PI * 0.5, dt * 18)) * Math.exp(-dt * 3.2) : 0;
        cuffs.setColorAt(
          i,
          tint
            .copy(dim)
            .lerp(looseMetal, slack * 0.9)
            .lerp(lit, Math.max(receipt,flash * (reduced ? 0.24 : 1))),
        );
        across.set(post.nz, 0, -post.nx);
        function pointAt(u: number, out: Vector3) {
          const propagation = dt - u * 0.102;
          const pull =
            !reduced && underLoad && propagation >= 0 ? Math.sin(propagation * 17.2) * Math.exp(-propagation * 6.3) : 0;
          const sag = Math.sin(Math.PI * u) * (-0.14 - 0.58 * slack + 0.115 * pull + (reduced ? 0 : 0.09 * echo));
          return out.set(
            post.toeX + (post.x + post.nx * sway - post.toeX) * u,
            -0.41 + 2.256 * u + sag,
            post.toeZ + (post.z + post.nz * sway - post.toeZ) * u,
          );
        }
        // Keep link spacing uniform down a sagging chain, including while the ratchet takes up slack.
        pointAt(0, near);
        for (let k = 1; k < arc.length; k++) {
          pointAt(k / (arc.length - 1), far);
          arc[k] = arc[k - 1] + far.distanceTo(near);
          near.copy(far);
        }
        let section = 1;
        for (let j = 0; j < linksPerChain; j++) {
          const distance = ((j + 0.5) * arc[arc.length - 1]) / linksPerChain;
          while (arc[section] < distance) ++section;
          const u =
            (section - 1 + (distance - arc[section - 1]) / (arc[section] - arc[section - 1])) / (arc.length - 1);
          pointAt(u, near);
          pointAt(u + 0.01, far);
          along.subVectors(far, near).normalize();
          normal.crossVectors(across, along).normalize();
          basis.makeBasis(across, along, normal);
          place.position.copy(near);
          place.quaternion.setFromRotationMatrix(basis);
          if (j % 2) place.rotateY(Math.PI / 2);
          place.scale.set(0.069, 0.115, 0.072);
          place.updateMatrix();
          chains.setMatrixAt(i * linksPerChain + j, place.matrix);
        }
      }
      capstans.upload();
      for (const inst of [chains, eyes, cuffs]) inst.instanceMatrix.needsUpdate = true;
      if (cuffs.instanceColor) cuffs.instanceColor.needsUpdate = true;
      dust.visible = !reduced && phase > 0.89 && phase < 3.91;
      if (dust.visible) {
        grits.forEach((g, i) => {
          const t = phase - g.at,
            after = Math.max(0, t - g.hit),
            fall = Math.min(g.hit, Math.max(0, t));
          const slip = fall + 0.092 * (1 - Math.exp(-after * 5.3));
          const y =
            after > 0
              ? g.ground + Math.max(0, 0.32 * after - 2.23 * after * after)
              : g.y + g.vy * fall - 2.225 * fall * fall;
          coords.setXYZ(i, g.x + g.vx * slip, y, g.z + g.vz * slip);
          strength.setX(i, t < 0 ? 0 : Math.max(0, Math.min(1, (g.life - t) / 0.46)) * 0.88);
        });
        coords.needsUpdate = strength.needsUpdate = true;
      }
    },
    dispose() {
      capstans.dispose();
      for (const item of [
        linkShape,
        eyeShape,
        cuffShape,
        crustShape,
        frost,
        steel,
        brass,
        enamel,
        chains,
        eyes,
        cuffs,
        specks,
        dustPaint,
      ])
        item.dispose();
    },
  };
}
