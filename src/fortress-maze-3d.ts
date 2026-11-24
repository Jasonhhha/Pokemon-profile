import { outerWall, palaceOverlook, wallFacesCamera } from './palace-overlook';
import {processionalSign} from './fortress-palace-sign';
import { behindTraveller, palaceView } from './fortress-palace-camera';
import { collectorSpokes, highSluices, sluiceVeil, suspendedHeight } from './fortress-palace-monuments';
import {
  armillaryRotation,
  palaceArmillary,
  palaceConductors,
  palaceWorks,
  wheelAngle,
  worksPower,
} from './fortress-palace-current';
import {
  BackSide,
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  FogExp2,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  Raycaster,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector2,
  type Material,
  type Texture,
} from 'three';
import type { FortressInteriorFrame } from './field-fortress-state';
import { mazeFieldMap, mazeFloors, palaceElevation, type MazeRoom } from './fortress-maze';
import { archStone, createMazeMaterials, crystalShape, funeraryLid, noise, stairSign } from './fortress-maze-materials';
import { carvedDrum } from './fortress-tide-dial';
import { channelSurface, cisternMirror, outfalls } from './fortress-maze-water';
import { createFrostFootfalls } from './fortress-maze-frost';
import { buildFortressWater } from './fortress-water';
import { palaceArchitecture, palaceVault, type Form, type Stone } from './fortress-palace-architecture';
import { palaceLandmarkRay } from './fortress-palace-picking';

export function buildMazeRoom3D(room: MazeRoom, glow: Texture) {
  const plan = mazeFloors[room],
    cold = room === 'catacomb',
    map = mazeFieldMap(room);
  const scene = new Scene(),
    air = cold ? 0x213449 : 0x304543;
  scene.background = new Color(air);
  scene.fog = new FogExp2(air, cold ? 0.016 : 0.014);
  const palette = createMazeMaterials(cold);
  const royal = new MeshStandardMaterial({ color: cold ? 0x355778 : 0x28645b, metalness: 0.32, roughness: 0.42 });
  const basalt = palette.dark.clone();
  basalt.color.setHex(cold ? 0x293946 : 0x4f5549);
  basalt.metalness = 0.12;
  basalt.roughness = 0.61;
  basalt.onBeforeCompile = palette.dark.onBeforeCompile;
  const gilt = new MeshStandardMaterial({
    color: 0xd3a758,
    metalness: 0.38,
    roughness: 0.34,
    emissive: 0x553311,
    emissiveIntensity: 0.13,
  });
  const copper = palette.face.clone();
  copper.color.setHex(0xb98454);
  copper.metalness = 0.32;
  copper.roughness = 0.42;
  copper.onBeforeCompile = palette.face.onBeforeCompile;
  const tones: Record<Stone, Material> = {
    body: palette.face,
    trim: palette.wallCap,
    bright: palette.chalk,
    dark: palette.wet,
    bronze: palette.brass,
    iron: palette.iron,
    jade: palette.jade,
    lamp: cold ? palette.glowGlass : palette.amberGlass,
    ice: palette.gem,
    royal,
    basalt,
    gilt,
    copper,
  };
  const shapes: Record<Form, BufferGeometry> = {
    box: new BoxGeometry(),
    column: new CylinderGeometry(1, 1, 1, 16),
    shaft: carvedDrum(
      [
        [0, 1],
        [0.04, 1],
        [0.12, 0.88],
        [0.77, 0.76],
        [0.95, 0.71],
        [1, 0.78],
      ],
      14,
      0.077,
    ),
    capital: carvedDrum(
      [
        [0, 0.63],
        [0.13, 0.71],
        [0.35, 0.65],
        [0.69, 0.87],
        [0.89, 1],
        [1, 1.01],
      ],
      12,
      0.105,
    ),
    arch: archStone(),
    orb: new SphereGeometry(1, 14, 9),
    ring: new TorusGeometry(1, 0.104, 8, 40),
    spike: crystalShape(),
    lid: funeraryLid(),
  };
  const batches = new Map<BufferGeometry, Map<Material, { matrix: Matrix4; tint: number }[]>>();
  const dummy = new Object3D(),
    col = new Color();
  function stamp(
    form: Form,
    material: Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    yaw = 0,
    roll = 0,
    pitch = 0,
    tint = 1,
  ) {
    const geom = shapes[form];
    let materials = batches.get(geom);
    if (!materials) {
      materials = new Map();
      batches.set(geom, materials);
    }
    let items = materials.get(material);
    if (!items) {
      items = [];
      materials.set(material, items);
    }
    dummy.position.set(x, y, z);
    dummy.rotation.set(pitch, yaw, roll, 'YXZ');
    dummy.scale.set(w, h, d);
    dummy.updateMatrix();
    items.push({ matrix: dummy.matrix.clone(), tint });
  }
  const box = (m: Material, x: number, y: number, z: number, w: number, h: number, d: number, tint = 1) =>
    stamp('box', m, x, y, z, w, h, d, 0, 0, 0, tint);
  const actorCut = { value: new Vector2(24.5, 43.5) };
  const overhead = new Map<Material, Material>();
  function flyover(original: Material) {
    const cached = overhead.get(original);
    if (cached) return cached;
    const material = original.clone();
    material.customProgramCacheKey = () => original.customProgramCacheKey() + '-overhead';
    material.onBeforeCompile = (shader, renderer) => {
      original.onBeforeCompile(shader, renderer);
      shader.uniforms.walkerAt = actorCut;
      shader.vertexShader =
        'varying vec2 vaultSite;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\n vaultSite=(modelMatrix*instanceMatrix*vec4(position,1.)).xz;',
        );
      shader.fragmentShader =
        'uniform vec2 walkerAt;varying vec2 vaultSite;\n' +
        shader.fragmentShader.replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
        vec2 forward=normalize(cameraPosition.xz-walkerAt),delta=vaultSite-walkerAt;
        float advance=dot(delta,forward),across=abs(dot(delta,vec2(-forward.y,forward.x)));
        if(cameraPosition.y<16. && advance>2.7 && across<5.5 && distance(cameraPosition.xz,vaultSite)<14.0)discard;`,
        );
    };
    overhead.set(original, material);
    return material;
  }
  const perimeter = new Map<string, {side: NonNullable<ReturnType<typeof outerWall>>; material: Material}>();
  function bayMaterial(x:number,z:number,original:Material,isOverhead?:boolean) {
    const side = outerWall(x,z);
    if (!side) return isOverhead ? flyover(original) : original;
    const key = side + original.uuid;
    let entry = perimeter.get(key);
    if (!entry) {
      const material = original.clone();
      material.onBeforeCompile = original.onBeforeCompile;
      material.customProgramCacheKey = () => original.customProgramCacheKey();
      entry = {side,material};
      perimeter.set(key,entry);
    }
    return entry.material;
  }
  for (const bay of palaceArchitecture(room))
    for (const v of bay.parts)
      stamp(
        v.form,
        bayMaterial(bay.x,bay.z,tones[v.finish],bay.overhead),
        v.x,
        v.y,
        v.z,
        v.w,
        v.h,
        v.d,
        v.yaw,
        v.roll,
        v.pitch,
        0.9 + 0.11 * noise(v.x + v.z * 3.1 + v.y),
      );
  for (let z = 3; z < 46; z++)
    for (let x = 3; x < 46; x++) {
      if (!map.walkable[z][x]) continue;
      const bridge = plan.tiles[z][x] === 'bridge',
        liquid = plan.tiles[z][x] === 'ice';
      for (let slice = 0; slice < 2; slice++) {
        const cz = z + 0.25 + 0.5 * slice,
          h = palaceElevation(room, x + 0.5, cz),
          low = bridge ? -0.32 : -1.34;
        box(palette.dark, x + 0.5, (h + low) / 2 - 0.038, cz, 1.009, h - low, 0.504);
        box(
          liquid ? palette.ice : palette.ground,
          x + 0.5,
          h - 0.033,
          cz,
          0.985,
          0.066,
          0.486,
          0.83 + 0.15 * noise(z * 17 + x + slice),
        );
        const grand = x === 22 || x === 26,
          threshold = z === 12 || z === 13 || z === 38 || z === 40;
        if (grand || x === 8 || x === 40) box(palette.brass, x + 0.5, h + 0.004, cz, 0.036, 0.012, 0.49, 0.8);
        if (threshold && x >= 22 && x <= 26)
          box(palette.chalk, x + 0.5, h + 0.007, cz + 0.211, 0.96, 0.013, 0.049, 0.96);
      }
      const h = palaceElevation(room, x + 0.5, z + 0.5);
      for (const side of [-1, 1])
        if (!map.walkable[z][x + side])
          box(palette.wallCap, x + 0.5 + 0.45 * side, h + 0.018, z + 0.5, 0.1, 0.075, 0.996);
      if (bridge && (z === 9 || z === 11 || z === 23 || z === 25 || z === 35 || z === 37)) {
        const edge = z + (z === 9 || z === 23 || z === 35 ? 0.055 : 0.945);
        box(palette.brass, x + 0.5, h + 0.29, edge, 1.008, 0.055, 0.055);
        if (x % 2 === 0) box(palette.iron, x + 0.5, h + 0.15, edge, 0.062, 0.29, 0.062);
      }
    }
  const verts: number[] = [],
    shades: number[] = [],
    coords: number[] = [],
    elements: number[] = [];
  for (const panel of palaceVault(room)) {
    const base = verts.length / 3;
    for (const [x, z, y] of panel.vertices) {
      verts.push(x, y, z);
      coords.push((x + 0.18 * y) * 0.67, z * 0.64);
      shades.push(panel.shade, panel.shade * 0.98, panel.shade * 0.95);
    }
    elements.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const roof = new BufferGeometry();
  roof.setAttribute('position', new Float32BufferAttribute(verts, 3));
  roof.setAttribute('uv', new Float32BufferAttribute(coords, 2));
  roof.setAttribute('color', new Float32BufferAttribute(shades, 3));
  roof.setIndex(elements);
  roof.computeVertexNormals();
  const soffit = new MeshStandardMaterial({
    color: cold ? 0x728595 : 0x8c907c,
    map: palette.face.map,
    side: BackSide,
    vertexColors: true,
    roughness: 0.91,
  });
  const front = { value: 44 };
  soffit.onBeforeCompile = (shader) => {
    shader.uniforms.cut = front;
    shader.vertexShader =
      'varying float vaultZ;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvaultZ=position.z;');
    shader.fragmentShader =
      'uniform float cut; varying float vaultZ;\n' +
      shader.fragmentShader.replace(
        '#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\nif(vaultZ>cut)discard;',
      );
  };
  const cover = new Mesh(roof, soffit);
  cover.receiveShadow = true;
  scene.add(cover);
  const stripXYZ: number[] = [],
    bedUV: number[] = [],
    bands: number[] = [];
  for (const line of palaceConductors(room)) {
    for (let i = 0; i < line.length; i++) {
      const a = line[i],
        b = line[Math.min(i + 1, line.length - 1)],
        previous = line[Math.max(0, i - 1)];
      const dx = b.x - previous.x,
        dz = b.z - previous.z,
        length = Math.hypot(dx, dz);
      const first = stripXYZ.length / 3;
      for (const side of [-1, 1]) {
        stripXYZ.push(a.x + (dz / length) * 0.069 * side, a.h, a.z - (dx / length) * 0.069 * side);
        bedUV.push(side, a.run);
      }
      if (i) bands.push(first - 2, first - 1, first, first - 1, first + 1, first);
    }
  }
  const linework = new BufferGeometry();
  linework.setAttribute('position', new Float32BufferAttribute(stripXYZ, 3));
  linework.setAttribute('uv', new Float32BufferAttribute(bedUV, 2));
  linework.setIndex(bands);
  const enamel = new ShaderMaterial({
    side: DoubleSide,
    uniforms: { bus: { value: 0.78 }, phase: { value: 0.45 }, clock: { value: 0 }, aligned: { value: 0 } },
    vertexShader: `varying vec2 track;void main(){track=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 track;uniform float bus,phase,clock,aligned;void main(){
      float energy=1.-smoothstep(.26,.68,abs(track.x));
      float beat=pow(max(0.,cos(track.y*.79-clock*1.28-phase*2.3)),10.);
      vec3 brass=vec3(.27,.19,.10), base=mix(vec3(.019,.12,.14),vec3(.09,.36,.32),bus);
      vec3 core=base+vec3(.22,.57,.46)*beat*bus*(.55+aligned*.45);
      gl_FragColor=vec4(mix(brass,core,energy),1.);
      #include <colorspace_fragment>
    }`,
  });
  scene.add(new Mesh(linework, enamel));
  const wheels: Group[] = [];
  if (!cold)
    for (const [x, z] of palaceWorks) {
      const wheel = new Group();
      wheel.position.set(x, 1.68, z + 0.8);
      const rings = new InstancedMesh(shapes.ring, palette.brass, 2);
      for (let j = 0; j < 2; j++) {
        dummy.position.set(0, 0, (j - 0.5) * 0.23);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(0.83, 0.83, 0.7);
        dummy.updateMatrix();
        rings.setMatrixAt(j, dummy.matrix);
      }
      wheel.add(rings);
      const blades = new InstancedMesh(shapes.box, palette.jade, 16);
      for (let j = 0; j < 8; j++) {
        const a = (j * Math.PI) / 4;
        dummy.position.set(0.39 * Math.cos(a), 0.39 * Math.sin(a), 0);
        dummy.rotation.set(0, 0, a);
        dummy.scale.set(0.76, 0.053, 0.1);
        dummy.updateMatrix();
        blades.setMatrixAt(2 * j, dummy.matrix);
        dummy.position.set(0.68 * Math.cos(a), 0.68 * Math.sin(a), 0);
        dummy.rotation.set(0, 0.23, a + 0.19);
        dummy.scale.set(0.16, 0.31, 0.32);
        dummy.updateMatrix();
        blades.setMatrixAt(2 * j + 1, dummy.matrix);
      }
      wheel.add(blades);
      wheels.push(wheel);
      scene.add(wheel);
    }
  const spheres = cold
    ? palaceArmillary.map((part) => {
        const ring = new Mesh(shapes.ring, tones[part.finish]);
        ring.position.set(part.x, part.y, part.z);
        ring.scale.set(part.w, part.h, part.d);
        scene.add(ring);
        return ring;
      })
    : [];
  const spillGeometry = new BufferGeometry(),
    spillVertices: number[] = [],
    spillUV: number[] = [],
    spillFaces: number[] = [];
  const flywheel = new Group();
  flywheel.position.set(24.5, 13.3, -1.68);
  if (!cold) {
    for (const a of collectorSpokes) {
      const bar = new Mesh(shapes.box, gilt);
      bar.scale.set(0.21, 1.63, 0.22);
      bar.rotation.z = a;
      bar.position.set(-Math.sin(a) * 1.86, Math.cos(a) * 1.86, 0);
      flywheel.add(bar);
      const root = new Mesh(shapes.box, palette.iron);
      root.scale.set(0.37, 1.2, 0.28);
      root.rotation.z = a + 0.33;
      root.position.set(-Math.sin(a + 0.16) * 0.73, Math.cos(a + 0.16) * 0.73, 0);
      flywheel.add(root);
    }
    scene.add(flywheel);
    for (const gate of highSluices) {
      const start = spillVertices.length / 3;
      for (let row = 0; row <= 24; row++)
        for (let col = 0; col <= 10; col++) {
          const u = col / 10,
            t = row / 24;
          spillVertices.push(...sluiceVeil(gate, u * 2 - 1, t));
          spillUV.push(u, t);
          const i = start + row * 11 + col;
          if (row < 24 && col < 10) spillFaces.push(i, i + 11, i + 12, i, i + 12, i + 1);
        }
    }
  }
  spillGeometry.setAttribute('position', new Float32BufferAttribute(spillVertices, 3));
  spillGeometry.setAttribute('uv', new Float32BufferAttribute(spillUV, 2));
  spillGeometry.setIndex(spillFaces);
  const veil = new ShaderMaterial({
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    uniforms: { clock: { value: 0 }, fogTone: { value: new Color(air) } },
    vertexShader: `varying vec2 v;varying float depth;void main(){v=uv;vec4 eye=modelViewMatrix*vec4(position,1.);depth=-eye.z;gl_Position=projectionMatrix*eye;}`,
    fragmentShader: `varying vec2 v;varying float depth;uniform float clock;uniform vec3 fogTone;
      float hash(float n){return fract(sin(n*71.93)*43691.57);}
      void main(){float lanes=v.x*21.3,seed=hash(floor(lanes));float run=v.y*7.1-clock*2.3+seed*9.;
      float lace=pow(.5+.5*cos(run*6.28+sin(v.x*61.+v.y*5.)),5.);
      float thread=pow(1.-abs(fract(lanes+sin(v.y*11.-clock)*.18)*2.-1.),3.);
      float air=v.y*v.y;vec3 stream=mix(vec3(.025,.195,.184),vec3(.71,.89,.82),.30+.39*thread+.24*lace+.24*air);
      float fog=1.-exp(-depth*depth*.00018);gl_FragColor=vec4(mix(stream,fogTone,fog),(.59+.24*lace)*smoothstep(0.,.045,min(v.x,1.-v.x)));
      #include <colorspace_fragment>
    }`,
  });
  if (!cold) {
    const curtains = new Mesh(spillGeometry, veil);
    curtains.renderOrder = 4;
    scene.add(curtains);
  }
  let cutEntrance = false;
  const signs: Mesh[] = [];
  for(const down of [false,true]){
    const board=processionalSign(room,down);
    const plate=new Mesh(shapes.box,stairSign(board.text,down));
    plate.scale.set(board.w,board.h,.048);
    plate.position.set(board.x,board.y,board.z);
    scene.add(plate);
    signs.push(plate);
  }
  for (const [geometry, materials] of batches)
    for (const [material, items] of materials) {
      const packed = new InstancedMesh(geometry, material, items.length);
      items.forEach(({ matrix, tint }, i) => {
        packed.setMatrixAt(i, matrix);
        packed.setColorAt(i, col.setRGB(tint, tint, tint));
      });
      packed.castShadow = material !== palette.ground;
      packed.receiveShadow = true;
      packed.computeBoundingSphere();
      scene.add(packed);
    }
  const water = channelSurface(room);
  scene.add(water);
  let tick = 0;
  const mirror = cold ? undefined : cisternMirror(water, () => tick);
  if (mirror) scene.add(mirror);
  const pools = cold ? undefined : buildFortressWater(room);
  if (pools) scene.add(pools.group);
  const frost = cold ? createFrostFootfalls() : undefined;
  if (frost) scene.add(frost.mesh);
  const drains = cold
    ? []
    : palaceWorks.map(([x, z]) => outfalls([{ x, y: 1.1, z: z + 1.06, dx: 0, dz: 1, width: 0.42, reach: 0.91 }]));
  for (const drain of drains) scene.add(drain);
  palaceWorks.forEach(([x, z], i) => water.material.uniforms.release.value[i].set(x, z + 1.92));
  const beacon = new SpriteMaterial({
    map: glow,
    color: cold ? 0xa8ecf4 : 0xffc479,
    transparent: true,
    opacity: 0.54,
    depthWrite: false,
  });
  for (const z of [6.5, 20.5, 33.5, 41.5])
    for (const x of [19.5, 29.5]) {
      const glow = new Sprite(beacon);
      glow.position.set(x + (x < 24 ? 0.71 : -0.71), palaceElevation(room, x, z) + 1.7, z);
      glow.scale.setScalar(1.12);
      scene.add(glow);
    }
  scene.add(new HemisphereLight(cold ? 0xe1f0ff : 0xffefc9, cold ? 0x627580 : 0x665c45, cold ? 1.48 : 1.34));
  const key = new DirectionalLight(cold ? 0xe6f3ff : 0xffdfab, cold ? 1.72 : 1.84);
  key.position.set(13, 24, 29);
  key.target.position.set(24, 0, 20);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -25, right: 25, top: 24, bottom: -24, near: 0.1, far: 70 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.normalBias = 0.064;
  key.shadow.bias = -0.00015;
  key.shadow.autoUpdate = false;
  key.shadow.needsUpdate = true;
  scene.add(key, key.target);
  const rim = new DirectionalLight(cold ? 0xd8bd96 : 0xaed3bf, 1.09);
  rim.position.set(30, 9, 1);
  rim.target.position.set(24.5, 4, 24.5);
  scene.add(rim, rim.target);
  const lantern = new PointLight(cold ? 0x92dbef : 0xfdd097, 53, 18, 2);
  lantern.position.set(24.5, 4, 6.5);
  scene.add(lantern);
  if (cold) {
    const oculus = new PointLight(0x9ce9e3, 78, 18, 2);
    oculus.position.set(22.8, suspendedHeight + 2.3, 25.4);
    scene.add(oculus);
  } else {
    const collectorLight = new PointLight(0xffddaa, 163, 27, 2);
    collectorLight.position.set(24.5, 14.3, 5.7);
    scene.add(collectorLight);
  }
  const needle = new Group();
  needle.position.set(24.5, 8.58, 3.13);
  for (const [a, long, w] of [
    [0.27, 1.88, 0.094],
    [-0.81, 1.14, 0.14],
  ]) {
    const pointer = new Mesh(shapes.box, palette.brass);
    pointer.scale.set(w, long, 0.087);
    pointer.rotation.z = a;
    pointer.position.set((-Math.sin(a) * long) / 2, (Math.cos(a) * long) / 2, 0);
    needle.add(pointer);
  }
  scene.add(needle);
  const device = new Group(),
    { x, y } = plan.instrument;
  device.position.set(x + 0.5, 1.25, y + 0.49);
  for (let i = 0; i < 4; i++) {
    const bar = new Mesh(shapes.box, palette.brass);
    bar.scale.set(0.073, 0.68, 0.058);
    bar.rotation.z = (i * Math.PI) / 4;
    device.add(bar);
  }
  scene.add(device);
  return {
    scene,
    surfaceAt: (x: number, z: number) => palaceElevation(room, x, z),
    landmarkAt: (ray: Raycaster) => palaceLandmarkRay(room, ray.ray.origin, ray.ray.direction, cutEntrance),
    update(t: number, w: number, h: number, frame: FortressInteriorFrame) {
      const view = frame.palaceView ? palaceOverlook(frame.palaceView, w / h) : palaceView(room, frame.x, frame.y, w / h);
      cutEntrance = behindTraveller(view.eye, frame.x, frame.y, 24.5, 43.7);
      signs[0].visible = !cutEntrance;
      tick = frame.now;
      cover.visible = !frame.palaceView;
      for (const {side,material} of perimeter.values()) material.visible = !wallFacesCamera(side,frame.palaceView);
      if (scene.fog instanceof FogExp2) scene.fog.density = frame.palaceView ? 0.004 : cold ? 0.016 : 0.014;
      veil.uniforms.clock.value = t;
      flywheel.rotation.z = t * 0.055;
      front.value = frame.y + 0.45;
      actorCut.value.set(frame.x, frame.y);
      water.material.uniforms.clock.value = t;
      water.material.uniforms.wheel.value.set(x + 0.5, y + 0.5);
      for (let i = 0; i < drains.length; i++) {
        const flow = worksPower(frame, i);
        drains[i].material.uniforms.clock.value = t;
        drains[i].material.uniforms.volume.value = flow;
        const splash = worksPower(frame, i, 0.657);
        drains[i].material.uniforms.arrival.value = splash;
        water.material.uniforms.flow.value.setComponent(i, splash);
        wheels[i].rotation.z = wheelAngle(frame, i, t);
      }
      const charge = frame.shortcutOpen,
        bus = frame.power?.bus ?? 0.78,
        phase = frame.power?.phase ?? 0.45;
      enamel.uniforms.bus.value = bus;
      enamel.uniforms.phase.value = phase;
      enamel.uniforms.clock.value = t;
      enamel.uniforms.aligned.value = Number(charge);
      needle.rotation.z = (cold ? -1 : 1) * (0.12 + bus * 0.61 + phase * 0.07);
      spheres.forEach((ring, i) => {
        const [pitch, yaw, roll] = armillaryRotation(frame, i, t);
        ring.rotation.set(pitch, yaw, roll, 'YXZ');
      });
      palette.jade.emissiveIntensity = 0.21 + 0.62 * bus;
      lantern.intensity = (cold ? 40 : 48) + bus * 18;
      device.rotation.z = charge ? 0.87 + (frame.reduced ? 0 : Math.sin(t * 0.24) * 0.08) : 0;
      pools?.update(t, w, h, frame);
      frost?.update(frame, h);
      beacon.opacity = frame.reduced ? 0.54 : 0.49 + 0.055 * Math.sin(t * 0.82);
    },
    dispose() {
      scene.traverse((child) => {
        if (child instanceof InstancedMesh) child.dispose();
      });
      key.shadow.dispose();
      beacon.dispose();
      spillGeometry.dispose();
      veil.dispose();
      royal.dispose();
      basalt.dispose();
      gilt.dispose();
      copper.dispose();
      for (const {material} of perimeter.values()) material.dispose();
      for (const material of overhead.values()) material.dispose();
      roof.dispose();
      soffit.dispose();
      linework.dispose();
      enamel.dispose();
      water.material.uniforms.shore.value.dispose();
      water.material.dispose();
      water.geometry.dispose();
      mirror?.geometry.dispose();
      mirror?.dispose();
      pools?.dispose();
      frost?.dispose();
      for (const drain of drains) {
        drain.geometry.dispose();
        drain.material.dispose();
      }
      for (const sign of signs) {
        const material = sign.material as MeshBasicMaterial;
        material.map?.dispose();
        material.dispose();
      }
      for (const g of Object.values(shapes)) g.dispose();
      palette.disposeMaps();
      for (const m of palette.mats) m.dispose();
    },
  };
}
