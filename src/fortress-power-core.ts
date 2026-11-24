import { AdditiveBlending, BoxGeometry, CatmullRomCurve3, Color, CylinderGeometry, Group, Mesh, MeshStandardMaterial,
  ShaderMaterial, TubeGeometry, Vector3, type Material } from 'three';
import { createPressureThrone } from './fortress-pressure-throne-3d';
import { batchStaticMeshes } from './field-mesh-batch';
import { nominalPower, type GridReading } from './fortress-power';
import { collectorArc, outletFlow, pointOnPowerLine, powerBranches, type PowerPoint } from './fortress-power-paths';

const axis = new Vector3(0, 1, 0);
const vec = (p: PowerPoint) => new Vector3(...p);

export function createPowerCore() {
  const fittings = new Group();
  const copper = new MeshStandardMaterial({ color: 0x986f42, roughness: .46, metalness: .57 });
  const iron = new MeshStandardMaterial({ color: 0x36434b, roughness: .62, metalness: .55 });
  const ceramic = new MeshStandardMaterial({ color: 0xbcbba2, roughness: .53, metalness: .12 });
  function pipe(path: PowerPoint[], radius: number, material: Material, group = fittings) {
    const curve = new CatmullRomCurve3(path.map(vec), false, 'centripetal');
    const mesh = new Mesh(new TubeGeometry(curve, Math.max(12, path.length * 2), radius, 8, false), material);
    group.add(mesh);
    return mesh;
  }
  function beam(a: PowerPoint, b: PowerPoint, thick: number, material: Material, box = false) {
    const lower = vec(a), upper = vec(b), direction = upper.sub(lower);
    const shape = box ? new BoxGeometry(thick * 2, direction.length(), thick * 2) : new CylinderGeometry(thick, thick, direction.length(), 10);
    const mesh = new Mesh(shape, material);
    mesh.position.copy(lower).addScaledVector(direction, .5);
    mesh.quaternion.setFromUnitVectors(axis, direction.normalize());
    fittings.add(mesh);
  }
  const centre = Array.from({ length: 43 }, (_, i) => collectorArc(i / 42));
  const back = Array.from({ length: 43 }, (_, i) => collectorArc(i / 42, 1));
  pipe(centre, .14, copper); pipe(back, .115, iron);
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    beam(collectorArc(t), collectorArc(t, 1), i % 3 ? .043 : .10, i % 3 ? iron : ceramic, true);
  }
  for (const t of [.10, .26, .42, .58, .74, .90]) {
    const a = collectorArc(t - .016), b = collectorArc(t + .016);
    beam(a, b, .198, iron, true);
    for (const offset of [-.013, .013]) beam(collectorArc(t + offset - .002), collectorArc(t + offset + .002), .220, copper, true);
    const inset = collectorArc(t, .3), spine = collectorArc(t + .046, 1);
    beam(inset, spine, .069, ceramic);
  }
  const phase = { value: 0 }, source = { value: .8 }, bus = { value: .78 }, still = { value: 0 };
  const sockets = powerBranches.map(branch => vec(branch.stream[0]));
  const offsets = sockets.map(() => new Vector3());
  const middle = (sockets[0].x + sockets[1].x) / 2;
  function glow(level: typeof source, start: number, span: number, halo = false) {
    return new ShaderMaterial({
      uniforms: { phase, level, still, offsetL: { value: offsets[0] }, offsetR: { value: offsets[1] },
        middle: { value: middle }, attached: { value: Number(level === source) }, start: { value: start }, span: { value: span }, halo: { value: Number(halo) }, tint: { value: new Color(0x75efdb) } },
      transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false,
      vertexShader: `uniform vec3 offsetL,offsetR;uniform float middle,attached;varying float path;
      void main(){path=uv.x;vec3 anchor=mix(offsetL,offsetR,step(middle,position.x));
      vec3 moving=position+anchor*attached*pow(1.-path,2.);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(moving,1.);}`,
      fragmentShader: `uniform float phase,level,still,halo,start,span;uniform vec3 tint;varying float path;
      void main(){float t=fract(start+span*path-phase+.5);float d=(t-.5)*11.;float crest=exp(-d*d)*(1.-still);
      float a=(.13+.65*level+crest*.75*level)*mix(1.,.13,halo);
      gl_FragColor=vec4(mix(tint,vec3(.89,1.,.79),crest*.72),a);
      #include <colorspace_fragment>
      }`,
    });
  }
  const root = new Group();
  root.name = 'Kyurem induction collectors and rising city mains';
  const coil = glow(source, 0, .42), plasma = glow(source, 0, .42, true), rising = glow(bus, .42, .38), rim = glow(bus, .42, .55);
  const throat = glow(bus, .80, .20), afterglow = glow(bus, .80, .20, true);
  pipe(outletFlow, .083, throat, root);
  pipe(outletFlow, .23, afterglow, root);
  for (const branch of powerBranches) {
    const [x, y, z] = branch.gate;
    beam([x, -.60, z], [x, y + .30, z], .23, iron);
    for (let i=0;i<5;i++) {
      const h = -.30 + i * .32;
      beam([x, h, z], [x, h + .13, z], i === 0 ? .48 : .32, i % 2 ? ceramic : copper);
    }
    pipe(branch.stream, .044, coil, root);
    pipe(branch.stream, .14, plasma, root);
    pipe(branch.upper, .177, iron);
    const exposed = branch.upper.map(([px, py, pz], i): PowerPoint =>
      [px, py, pz + .165 * Math.min(1, (branch.upper.length - 1 - i) / 2)]);
    pipe(exposed, .060, rising, root);
    for (const t of [.12, .29, .47, .63, .77]) {
      const a = pointOnPowerLine(branch.upper, t);
      beam([a[0],a[1]-.06,a[2]], [a[0],a[1]+.06,a[2]], .25, copper);
    }
  }
  pipe(centre.map(([px,py,pz]) => [px,py,pz+.119]), .045, rim, root);
  const throne = createPressureThrone();
  const hardware = batchStaticMeshes(fittings, false); root.add(hardware, throne.root);
  fittings.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); });
  return {
    root,
    update(reading: GridReading = nominalPower, reduced = false, crystals?: Vector3[], now = 0) {
      throne.update(now, reading.bus, reduced);
      crystals?.forEach((point, i) => offsets[i].subVectors(point, sockets[i]));
      phase.value = reading.phase; source.value = reading.source; bus.value = reading.bus; still.value = Number(reduced);
    },
    dispose() {
      root.remove(throne.root); throne.dispose();
      root.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); });
      for (const material of [copper, iron, ceramic, coil, plasma, rising, rim, throat, afterglow]) material.dispose();
    },
  };
}
