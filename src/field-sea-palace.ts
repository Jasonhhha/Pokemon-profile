import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, ExtrudeGeometry, Group, IcosahedronGeometry, InstancedMesh,
  LatheGeometry, Matrix4, Mesh, MeshStandardMaterial, Object3D, Shape, TorusGeometry, Vector2,
  type Material, type Texture,
} from 'three';

const tau = Math.PI * 2;
type Triple = [number, number, number];

function archRing() {
  const stones: Shape[] = [];
  for (let i = 0; i < 15; i++) {
    const start = (i + .056) * Math.PI / 15, end = (i + .944) * Math.PI / 15;
    const mid = (start + end) * .5, rise = i === 7 ? 1.28 : 1.19;
    const s = new Shape();
    s.moveTo(Math.cos(start), Math.sin(start));
    s.lineTo(1.17 * Math.cos(start), rise * Math.sin(start));
    s.lineTo(1.17 * Math.cos(mid), rise * Math.sin(mid));
    s.lineTo(1.17 * Math.cos(end), rise * Math.sin(end));
    s.lineTo(Math.cos(end), Math.sin(end));
    s.lineTo(Math.cos(mid), Math.sin(mid)); s.closePath();
    stones.push(s);
  }
  const geometry = new ExtrudeGeometry(stones, { depth: .972, bevelEnabled: true, bevelThickness: .014, bevelSize: .003, bevelSegments: 1 });
  geometry.translate(0, 0, -.5);
  return geometry;
}

function pillar() {
  const profile = [[.65, 0], [.69, .035], [.70, .075], [.58, .105], [.52, .15], [.47, .20], [.43, .69],
  [.45, .79], [.52, .85], [.51, .88], [.67, .93], [.70, .97], [.72, 1]];
  return new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), 12);
}

function sleeve(outer: number, inner: number, y: number, thickness: number) {
  const profile = [[inner, y], [inner, y - thickness], [outer - .15, y - thickness], [outer, y - thickness + .14], [outer, y - .08], [outer - .09, y], [inner, y]];
  return new LatheGeometry(profile.map(([r, h]) => new Vector2(r, h)), 128);
}

function tidalStone(mat: MeshStandardMaterial) {
  mat.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 stonePosition;');
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
      vec4 tidalPoint=vec4(transformed,1.);
      #ifdef USE_INSTANCING
        tidalPoint=instanceMatrix*tidalPoint;
      #endif
      stonePosition=(modelMatrix*tidalPoint).xyz;
      #include <project_vertex>`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 stonePosition;
      float mineralHash(vec2 p) {return fract(sin(dot(p,vec2(23.718,77.13)))*8714.641);}
      float stoneNoise(vec2 p) {
        vec2 c=floor(p), f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mineralHash(c),mineralHash(c+vec2(1.,0.)),f.x),
          mix(mineralHash(c+vec2(0.,1.)),mineralHash(c+1.),f.x),f.y);
      }`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float along=atan(stonePosition.x,stonePosition.z)*29.;
      float level=stonePosition.y;
      float streak=stoneNoise(vec2(along*3.2,level*.27));
      float blot=stoneNoise(vec2(along*.79,level*.87))*.60+stoneNoise(vec2(along*5.11,level*3.6))*.40;
      float wet=1.-smoothstep(-21.,-14.9,level+1.7*blot+streak);
      float saltY=-18.26+.45*blot+.29*streak;
      float salt=(1.-smoothstep(.035,.24,abs(level-saltY)))*smoothstep(.33,.65,blot);
      float mineral=(.84+.18*blot+.07*streak)*(1.-.17*smoothstep(.3,.8,streak)*(1.-blot));
      float algae=wet*(.22+.58*blot+.18*streak);
      diffuseColor.rgb*=mineral*mix(vec3(1.),vec3(.49,.66,.61),wet);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.046,.103,.086),algae*.45);
      diffuseColor.rgb+=vec3(.14,.142,.116)*salt;
    `);
  };
}

export function buildSeaPalace(radius: number, west: number, mineral: Texture, wear: Texture) {
  const group = new Group();
  const limestone = new MeshStandardMaterial({ color: 0xbcb8a2, map: mineral, roughness: .77 });
  const grey = new MeshStandardMaterial({ color: 0x85938e, map: mineral, roughness: .65 });
  const basalt = new MeshStandardMaterial({ color: 0x46595c, map: mineral, roughness: .52, metalness: .10 });
  const vault = new MeshStandardMaterial({ color: 0x365056, map: mineral, roughness: .57 });
  const bronze = new MeshStandardMaterial({ color: 0xb9965d, map: wear, roughness: .43, metalness: .46 });
  const patina = new MeshStandardMaterial({ color: 0x4e8380, map: wear, roughness: .39, metalness: .41 });
  const channel = new MeshStandardMaterial({ color: 0x78bfb2, emissive: 0x278680, emissiveIntensity: .44, roughness: .26, metalness: .34 });
  const receiver = new MeshStandardMaterial({ color: 0x507a70, emissive: 0x52d9bd, emissiveIntensity: .02, roughness: .31, metalness: .32 });
  const amber = new MeshStandardMaterial({ color: 0xe0b578, emissive: 0xf4af60, emissiveIntensity: .74, roughness: .45 });
  const oyster = new MeshStandardMaterial({ color: 0xc0baa2, map: mineral, roughness: .91 });
  for (const mat of [limestone, grey, basalt, vault]) tidalStone(mat);
  vault.emissive.setHex(0x385458); vault.emissiveIntensity = .19;
  const cube = new BoxGeometry(), drum = new CylinderGeometry(1, 1, 1, 24);
  const shellStone = new IcosahedronGeometry(1, 0), octagon = new CylinderGeometry(1, .84, 1, 8);
  const arch = archRing(), column = pillar(), wheel = new TorusGeometry(1, .066, 7, 48);
  const insert = new TorusGeometry(1, .028, 5, 40);
  const geometry = new Set<BufferGeometry>([cube, drum, arch, column, wheel, insert, shellStone, octagon]);
  const batches = new Map<BufferGeometry, Map<Material, { matrix: Matrix4; shade: number }[]>>();
  const place = new Object3D(), basis = new Object3D();
  const rotors: Group[] = [];
  let previousRotation = -1;

  function bay(angle: number, r: number) {
    basis.position.set(r * Math.sin(angle), 0, r * Math.cos(angle));
    basis.rotation.y = angle;
    basis.updateMatrix();
  }
  function put(shape: BufferGeometry, mat: Material, p: Triple, size: Triple, rotate: Triple = [0, 0, 0], shade = 1) {
    place.position.set(...p); place.scale.set(...size); place.rotation.set(...rotate); place.updateMatrix();
    const pair = batches.get(shape) ?? new Map();
    const row = pair.get(mat) ?? [];
    row.push({ matrix: new Matrix4().multiplyMatrices(basis.matrix, place.matrix), shade });
    pair.set(mat, row); batches.set(shape, pair);
  }
  function ledge(r: number, inner: number, y: number, h: number, mat: Material) {
    const solid = sleeve(r, inner, y, h);
    geometry.add(solid);
    const mesh = new Mesh(solid, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Recessed masonry shafts give the two colonnades actual depth behind their exposed ribs.
  const core = new CylinderGeometry(radius - 3.70, radius - 1.90, 18.64, 96, 1, true);
  geometry.add(core); const coreMesh = new Mesh(core, vault); coreMesh.position.y = -14.84;
  coreMesh.receiveShadow = true; group.add(coreMesh);
  ledge(radius + 1.36, radius - 3.2, -5.46, .88, grey);
  ledge(radius + 1.58, radius - 1, -5.54, .24, limestone);
  ledge(radius + 2.60, radius - 3.1, -11.62, .69, grey);
  ledge(radius + 2.86, radius - 1, -11.82, .32, limestone);
  ledge(radius + 2.75, radius - 1, -12.14, .32, basalt);
  ledge(radius + 5.23, radius - 2, -18.95, .79, grey);
  ledge(radius + 5.56, radius - 1, -19.16, .39, limestone);
  ledge(radius + 6.12, radius - 1, -19.73, .64, grey);
  ledge(radius + 6.56, radius - 1, -20.34, .67, basalt);
  ledge(radius + 6.82, radius - 1, -20.98, 4.1, basalt);

  for (const [count, r, floor, spring, rise, halfWidth] of [
    [36, radius + .80, -11.62, -8.48, 2.05, 1.82], [24, radius + 3.55, -18.95, -15.62, 2.57, 3.12],
  ]) {
    for (let i = 0; i < count; i++) {
      const a = west + i * tau / count;
      const tint = .87 + .13 * (.5 + .5 * Math.sin(i * 13.42 + floor));
      bay(a, r);
      put(arch, limestone, [0, spring, .04], [halfWidth, rise, .91], [0, 0, 0], tint);
      // Distant arches, column pairs and lamp niches remain visible through the openings.
      put(arch, grey, [0, spring - .14, -2.19], [halfWidth * .94, rise * .98, .60], [0, 0, 0], .86);
      put(cube, basalt, [0, floor + .11, -1.42], [2 * halfWidth + .63, .22, 4]);
      put(cube, bronze, [0, spring + rise + .18, .51], [.29, .49, .18]);
      put(cube, amber, [0, spring + .03, -2.97], [.099, .40, .11], [0, 0, 0], .85);
      if (i % 3 === 0) put(cube, patina, [0, spring - .68, -2.86], [.14, 1.06, .17]);
      bay(a + Math.PI / count, r);
      const thick = count === 36 ? 1 : 1.31;
      put(cube, basalt, [0, floor + .22, 0], [1.02 * thick, .44, 1.31 * thick]);
      put(column, grey, [0, floor + .37, 0], [1.13 * thick, spring - floor - .45, 1.21 * thick], [0, Math.PI / 12, 0], tint);
      put(cube, limestone, [0, spring - .045, 0], [1.32 * thick, .34, 1.45 * thick], [0, 0, 0], tint);
      put(column, grey, [0, floor + .12, -2.28], [thick, spring - floor - .20, thick], [0, 0, 0], .84);
      for (const h of [.53, .78]) put(drum, patina, [0, floor + h, 0], [.61 * thick, .085, .64 * thick]);
    }
  }
  for (let i = 0; i < 8; i++) {
    const a = west + i * Math.PI / 4;
    // Eight axial sanctuaries have deep-set tide wheels above twin flights of steps.
    bay(a, radius + 3.62);
    put(octagon, basalt, [0, -15.56, -1.21], [2.92, 1.52, 3.16], [Math.PI / 2, Math.PI / 8, 0]);
    put(drum, patina, [0, -15.12, -.22], [2.18, .46, 2.18], [Math.PI / 2, 0, 0]);
    put(drum, basalt, [0, -15.12, .055], [1.95, .18, 1.95], [Math.PI / 2, 0, 0]);
    for (const [size, z] of [[2.02, .23], [1.62, .32], [.87, .43]]) {
      put(wheel, bronze, [0, -15.12, z], [size, size, 1.10]);
      put(insert, channel, [0, -15.12, z + .09], [size - .14, size - .14, .65]);
    }
    for (let spoke = 0; spoke < 12; spoke++) {
      const angle = spoke * tau / 12, x = Math.sin(angle), y = Math.cos(angle);
      put(cube, bronze, [1.29 * x, -15.12 + 1.29 * y, .34], [.11, .69, .19], [0, 0, -angle]);
      put(cube, channel, [1.87 * x, -15.12 + 1.87 * y, .37], [.09, .14, .11], [0, 0, -angle]);
    }
    put(drum, bronze, [0, -15.12, .46], [.51, .29, .51], [Math.PI / 2, 0, 0]);
    put(drum, channel, [0, -15.12, .63], [.29, .11, .29], [Math.PI / 2, 0, 0]);
    put(wheel, receiver, [0, -15.12, .62], [1.16, 1.16, .72]);
    const pedestal = new Group(), spinner = new Group();
    pedestal.position.set(Math.sin(a) * (radius + 4.26), -15.12, Math.cos(a) * (radius + 4.26));
    pedestal.rotation.y = a;
    for (let k = 0; k < 3; k++) {
      const blade = new Mesh(cube, patina), theta = k * tau / 3;
      blade.position.set(Math.sin(theta) * .66, Math.cos(theta) * .66, 0);
      blade.rotation.z = -theta - .36; blade.scale.set(.23, .72, .139); spinner.add(blade);
    }
    pedestal.add(spinner); group.add(pedestal); rotors.push(spinner);
    for (const side of [-1, 1]) {
      put(cube, grey, [side * 2.56, -15.99, -.09], [.72, 5.5, 1.44]);
      put(cube, bronze, [side * 2.56, -13.29, .49], [.94, .22, .62]);
      for (let k = 0; k < 9; k++) {
        const y = -19.94 + k * .25, z = 3.47 - k * .39;
        put(cube, k % 3 === 0 ? limestone : grey, [side * 2.10, y, z], [1.83, .32, .51]);
        put(cube, basalt, [side * 3.14, y + .25, z], [.20, .89, .51]);
      }
    }
    // Deeper octagonal towers interrupt the drum and carry the spillways across the terraces.
    bay(a + Math.PI / 8, radius);
    for (const [level, rOffset, width, length] of [[-3.53, .56, 4.0, 1.70], [-10.83, 2.38, 5.05, 3.2], [-15.09, 5.29, 6.20, 3.50]]) {
      put(cube, grey, [0, level - .29, rOffset], [width + .82, .65, length]);
      put(cube, patina, [0, level + .035, rOffset], [width, .08, length]);
      for (const side of [-1, 1]) {
        put(cube, basalt, [side * (width * .5 + .15), level + .18, rOffset], [.34, .58, length + .15]);
        put(cube, bronze, [side * (width * .5 + .15), level + .49, rOffset], [.41, .09, length + .22]);
        put(cube, channel, [side * (width * .5 - .12), level + .091, rOffset], [.088, .04, length]);
      }
    }
    for (const side of [-1, 1]) {
      put(cube, grey, [side * 2.68, -12.83, 2.92], [.80, 11.9, 1.92]);
      put(cube, basalt, [side * 2.68, -18.40, 3.23], [1.13, 1.04, 2.30]);
      put(cube, limestone, [side * 2.68, -7.03, 2.88], [1.15, .60, 2.3]);
      put(cube, patina, [side * 2.68, -11.43, 3.93], [.25, 7.85, .22]);
      put(cube, channel, [side * 2.68, -11.33, 4.07], [.072, 7.27, .082]);
      // Paired stone consoles carry the outermost spillway as it projects over the sea.
      put(octagon, basalt, [side * 2.32, -18.10, 3.82], [.65, 2.56, .83], [0, Math.PI/8, 0]);
      put(cube, grey, [side * 2.32, -17.20, 5.30], [.64, .71, 4.78], [-.68, 0, 0]);
      put(cube, limestone, [side * 2.32, -15.74, 6.78], [.87, .44, 1.04]);
    }
    put(cube, basalt, [0, -15.59, 6.62], [6.30, .35, .79]);
    put(cube, basalt, [0, -2.83, .13], [4.42, 1.43, .40]);
    put(cube, bronze, [0, -2.07, .49], [4.85, .36, 1.06]);
    for (const x of [-1.96, 0, 1.96]) put(cube, patina, [x, -2.80, .54], [.19, 1.44, .55]);
  }
  // Four battered cutwaters run through both terrace levels. Secondary chambers have intakes and service bridges.
  for (let k = 0; k < 16; k++) {
    const a = west + (k + .48) * tau / 16;
    bay(a, radius + 1.04);
    if (k % 4 === 0 || k % 4 === 3) {
      put(octagon, basalt, [0, -19.74, 4.64], [1.52, 3.81, 2.27], [0, Math.PI / 8, 0]);
      put(octagon, grey, [0, -17.13, 3.77], [1.41, 3.01, 1.87], [0, Math.PI / 8, 0]);
      put(octagon, limestone, [0, -15.53, 3.76], [1.53, .29, 2.00], [0, Math.PI / 8, 0]);
      put(cube, grey, [0, -13.01, 2.62], [2.23, 4.94, 2.08], [-.29, 0, 0]);
      put(cube, basalt, [0, -12.92, 3.61], [1.34, 3.68, .16], [-.29, 0, 0]);
      put(cube, grey, [0, -12.92, 3.73], [1.12, 3.43, .16], [-.29, 0, 0]);
      for (let j = 0; j < 6; j++) {
        const h = j * .41;
        put(cube, bronze, [.34, -14.28 + h, 4.23 - .29 * h], [j % 3 === 0 ? .36 : .21, .066, .12], [-.29, 0, 0]);
      }
      put(wheel, patina, [-.06, -12.34, 3.68], [.40, .40, .51], [-.29, 0, 0]);
      put(drum, bronze, [-.06, -12.34, 3.68], [.17, .11, .17], [1.28, 0, 0]);
      put(cube, limestone, [0, -10.43, 2.03], [2.45, .42, 2.1]);
      put(octagon, grey, [0, -8.20, .92], [1.00, 4.36, 1.17], [-.31, Math.PI / 8, 0]);
      put(cube, grey, [0, -6.21, .53], [2.06, .67, 1.91]);
      for (const side of [-1, 1]) put(cube, patina, [side * .92, -13.00, 3.52], [.13, 4.4, .24], [-.29, 0, 0]);
    } else {
      put(arch, grey, [0, -9.24, -1.32], [1.56, 1.55, .88]);
      for (let n = 0; n < 8; n++)put(cube, patina, [(n - 3.5) * .39, -9.77, -1.06], [.092, 2.3, .16]);
      put(cube, basalt, [0, -10.31, -.26], [3.12, .39, 2.05]);
      put(cube, bronze, [0, -9.91, .55], [3.37, .13, .29]);
    }
  }
  for (let i = 0; i < 200; i++) {
    const a = west + i * 2.39996, r = Math.sin(i * 33.21) * .5 + .5;
    const y = -20.97 + .92 * Math.sin(a * 9.0) + .57 * r;
    const outer = radius + (y > -19.70 ? 5.52 : y > -20.34 ? 6.08 : y > -20.98 ? 6.52 : 6.81);
    bay(a, outer);
    for (let n = 0; n < 3; n++) {
      const size = (.041 + .12 * r) * (1 - n * .20);
      put(shellStone, n === 1 ? grey : oyster, [(n - 1) * .128, y + Math.sin(n + i) * .08, .014], [size * 1.28, size, size * .53]);
    }
  }
  const col = new Color();
  batches.forEach((materials, shape) => materials.forEach((instances, mat) => {
    const model = new InstancedMesh(shape, mat, instances.length);
    instances.forEach(({ matrix, shade }, i) => {
      model.setMatrixAt(i, matrix); model.setColorAt(i, col.setScalar(shade));
    });
    model.castShadow = mat !== channel && mat !== amber;
    model.receiveShadow = true; model.computeBoundingSphere(); group.add(model);
  }));
  group.name = 'Terraced sea palace, colonnades and eight tide sanctuaries';
  return {
    group,
    update(night: number, lift: number, resonance: number, drain: number) {
      channel.emissiveIntensity = .26 + .15 * lift + .24 * night + .65 * resonance;
      receiver.emissiveIntensity = .013 + 1.65 * resonance;
      const motion = lift * 3.8 + 1.9 * (1 - (1 - drain) ** 2) + resonance * Math.PI / 4;
      if (motion !== previousRotation) {
        rotors.forEach((rotor, i) => { rotor.rotation.z = (i % 2 ? -1 : 1) * motion; });
        previousRotation = motion;
      }
    },
    dispose() {
      group.traverse(object => { if (object instanceof InstancedMesh) object.dispose(); });
      geometry.forEach(shape => shape.dispose());
      for (const mat of [limestone, grey, basalt, vault, bronze, patina, channel, receiver, amber, oyster]) mat.dispose();
    },
  };
}
