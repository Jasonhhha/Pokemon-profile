import {
  BufferGeometry,
  CanvasTexture,
  ExtrudeGeometry,
  Float32BufferAttribute,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Material,
  RepeatWrapping,
  Shape,
  SRGBColorSpace,
} from 'three';

export const tau = 2 * Math.PI;
export const noise = (n: number) => {
  const v = Math.sin(n * 84.719 + 7.91) * 43758.545;
  return v - Math.floor(v);
};

function workedStone(frost: boolean, paving: boolean) {
  const sheet = document.createElement('canvas');
  sheet.width = sheet.height = 256;
  const ctx = sheet.getContext('2d')!;
  const pixels = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const i = 4 * (256 * y + x);
      const lichen =
        Math.sin((x * tau) / 256 + 0.93 * Math.cos((y * tau) / 128)) +
        0.46 * Math.cos((y * tau) / 64 - (x * tau) / 128);
      const grain = 206 + lichen * (frost ? 10 : 14) + (noise(i) - 0.5) * 35;
      pixels.data[i] = grain + (frost ? -5 : 3);
      pixels.data[i + 1] = grain + 3;
      pixels.data[i + 2] = grain + (frost ? 7 : -5);
      pixels.data[i + 3] = 255;
    }
  ctx.putImageData(pixels, 0, 0);
  const rows = paving ? 2 : 3;
  for (let k = 0; k < rows; k++) {
    const y = Math.floor((k * 256) / rows);
    ctx.fillStyle = frost ? '#47586685' : '#4a534b85';
    ctx.fillRect(0, y, 256, paving ? 3 : 4);
    ctx.fillStyle = '#f0e8cd85';
    ctx.fillRect(0, y + 3, 256, 1);
    const x = (paving ? 142 : 106) + (k % 2 ? -68 : 37);
    ctx.fillStyle = '#505853a6';
    ctx.fillRect(x, y, 3, 256 / rows);
    ctx.fillStyle = '#f4eed551';
    ctx.fillRect(x + 3, y, 1, 256 / rows);
  }
  for (let i = 0; i < 43; i++) {
    const x = noise(i * 3 + 10) * 256,
      y = noise(i + 8) * 256;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 1 + noise(i) * 13, y + noise(i + 40) * 5);
    ctx.strokeStyle = i % 3 === 0 ? '#f0e8ce5e' : '#36484651';
    ctx.lineWidth = 1 + noise(i + 23) * 1.5;
    ctx.stroke();
  }
  if (frost) {
    for (let i = 0; i < 10; i++) {
      let x = noise(i + 32) * 256,
        y = noise(i + 48) * 256;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 8; k++) {
        x += 2 + noise(k + i * 13) * 11;
        y += (noise(k * 10 + i) - 0.44) * 12;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = i % 2 ? '#cadfe44c' : '#f3fcff62';
      ctx.lineWidth = 0.6 + noise(i);
      ctx.stroke();
    }
  }
  const tex = new CanvasTexture(sheet);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function timberGrain() {
  const sheet = document.createElement('canvas');
  sheet.width = 96;
  sheet.height = 256;
  const c = sheet.getContext('2d')!;
  c.fillStyle = '#d2c2a1';
  c.fillRect(0, 0, 96, 256);
  for (let i = 0; i < 165; i++) {
    const x = 96 * noise(i + 15),
      y = 256 * noise(i + 85);
    c.strokeStyle = i % 3 ? '#594d3a42' : '#f6dfb444';
    c.lineWidth = 0.45 + noise(i + 13) * 1.1;
    c.beginPath();
    c.moveTo(x, y);
    c.bezierCurveTo(x - 1.2, y + 11, x + 1.7, y + 25, x + 0.33, y + 44 * noise(i));
    c.stroke();
  }
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.ellipse(9 + noise(i + 27) * 71, 20 + noise(i + 52) * 209, 1.3, 6.2, 0.09, 0, tau);
    c.strokeStyle = '#6957437a';
    c.stroke();
  }
  const texture = new CanvasTexture(sheet);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function glacialCrust() {
  const sheet = document.createElement('canvas');
  sheet.width = sheet.height = 256;
  const c = sheet.getContext('2d')!,
    field = c.createImageData(256, 256);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const i = (256 * y + x) * 4;
      const grain = (noise(i + 71) - 0.5) * 23;
      const cloud =
        12 * Math.cos((tau * (x + y)) / 256 + 0.74 * Math.sin((y * tau) / 128)) + 7 * Math.sin((y * tau) / 128);
      const streak = 7 * Math.cos((3 * tau * x) / 256 + (tau * y) / 128);
      field.data[i] = 145 + grain + cloud + streak;
      field.data[i + 1] = 198 + grain + cloud + streak * 0.6;
      field.data[i + 2] = 208 + grain + cloud + streak * 0.35;
      field.data[i + 3] = 255;
    }
  c.putImageData(field, 0, 0);
  function fracture(points: number[][], width: number) {
    for (const [shadow, ink] of [
      [true, '#3b839398'],
      [false, '#eefcfaad'],
    ] as const) {
      c.strokeStyle = ink;
      c.lineWidth = shadow ? width * 2.7 : width;
      c.lineJoin = 'miter';
      c.beginPath();
      points.forEach(([x, y], i) => (i ? c.lineTo(x + (shadow ? 0.8 : 0), y + (shadow ? 1.1 : 0)) : c.moveTo(x, y)));
      c.stroke();
    }
  }
  for (let i = 0; i < 8; i++) {
    let x = 10 + noise(i + 2) * 213,
      y = 20 + noise(i + 32) * 185;
    const points = [[x, y]],
      bearing = 0.2 + 0.48 * noise(i + 12);
    for (let k = 0; k < 6; k++) {
      x += 8 + noise(13 * k + i) * 18;
      y += ((k % 3 === 2 ? -1 : 1) * bearing + noise(i + k) - 0.46) * 17;
      points.push([x, y]);
    }
    fracture(points, 0.76 + noise(i) * 0.72);
    if (i % 2 === 0) {
      const [bx, by] = points[2];
      fracture(
        [
          [bx, by],
          [bx - 4, by - 9],
          [bx - 2, by - 15],
          [bx - 9, by - 21],
        ],
        0.67,
      );
    }
  }
  for (let i = 0; i < 120; i++) {
    const x = noise(i * 7) * 256,
      y = noise(i * 11) * 256,
      r = 0.4 + noise(i + 9) * 1.1;
    c.beginPath();
    c.ellipse(x, y, r * 2.1, r, 0.28, 0, tau);
    c.fillStyle = i % 3 ? '#d7f2ed4c' : '#72acb64b';
    c.fill();
  }
  const tex = new CanvasTexture(sheet);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function stairSign(text: string, down: boolean) {
  const sheet = document.createElement('canvas');
  sheet.width = 256;
  sheet.height = 100;
  const c = sheet.getContext('2d')!;
  c.fillStyle = '#182d32';
  c.fillRect(0, 0, 256, 100);
  c.strokeStyle = down ? '#8acfc4' : '#d6b97e';
  c.lineWidth = 5;
  c.strokeRect(5, 5, 246, 90);
  c.fillStyle = down ? '#c4eee1' : '#edd4a2';
  c.font = 'bold 42px system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, 127, 51);
  const tex = new CanvasTexture(sheet);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return new MeshBasicMaterial({ map: tex });
}

export function archStone() {
  const outlines: Shape[] = [];
  for (let i = 0; i < 11; i++) {
    const a = (Math.PI * (i + 0.033)) / 11,
      b = (Math.PI * (i + 0.967)) / 11;
    const s = new Shape(),
      h = i === 5 ? 1.41 : 1.26;
    s.moveTo(Math.cos(a), Math.sin(a));
    s.lineTo(1.24 * Math.cos(a), h * Math.sin(a));
    s.lineTo(1.24 * Math.cos(b), h * Math.sin(b));
    s.lineTo(Math.cos(b), Math.sin(b));
    s.closePath();
    outlines.push(s);
  }
  const geom = new ExtrudeGeometry(outlines, { depth: 1, bevelEnabled: false });
  geom.translate(0, 0, -0.5);
  return geom;
}

export function crystalShape() {
  const p: number[] = [],
    c: number[] = [];
  const side = 6;
  for (let i = 0; i < side; i++) {
    const a = (tau * i) / side,
      b = (tau * (i + 1)) / side;
    const lo = [Math.cos(a) * 0.53, 0, Math.sin(a) * 0.53],
      right = [Math.cos(b) * 0.53, 0, Math.sin(b) * 0.53];
    const upper = [Math.cos(a) * 0.45, 0.72 + noise(i) * 0.09, Math.sin(a) * 0.45];
    const next = [Math.cos(b) * 0.45, 0.72 + noise((i + 1) % side) * 0.09, Math.sin(b) * 0.45];
    p.push(...lo, ...next, ...right, ...lo, ...upper, ...next, ...upper, 0.09, 1.24, -0.02, ...next);
    const light = 0.71 + noise(i + 1) * 0.26;
    for (let j = 0; j < 9; j++) {
      const tint = j < 6 ? light : light + 0.085;
      c.push(tint * 0.82, tint, tint * 1.04);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(p, 3));
  g.setAttribute('color', new Float32BufferAttribute(c, 3));
  g.computeVertexNormals();
  return g;
}

export function funeraryLid() {
  const rim = [
    [-0.33, -0.72],
    [0.33, -0.72],
    [0.46, -0.52],
    [0.4, 0.49],
    [0.25, 0.72],
    [-0.25, 0.72],
    [-0.4, 0.49],
    [-0.46, -0.52],
  ];
  const positions: number[] = [],
    uv: number[] = [];
  function face(a: number[], b: number[], c: number[]) {
    positions.push(...a, ...b, ...c);
    for (const p of [a, b, c]) uv.push(p[0] + 0.5, p[2] / 1.5 + 0.5);
  }
  const shells = [
    [1, 0],
    [1, 0.08],
    [0.88, 0.162],
    [0.67, 0.218],
  ];
  for (let j = 0; j < rim.length; j++) {
    const n = (j + 1) % rim.length;
    const point = (i: number, k: number) => [rim[i][0] * shells[k][0], shells[k][1], rim[i][1] * shells[k][0]];
    for (let k = 0; k < shells.length - 1; k++) {
      const a = point(j, k),
        b = point(n, k),
        c = point(j, k + 1),
        d = point(n, k + 1);
      face(a, c, b);
      face(c, d, b);
    }
    face(point(n, 3), point(j, 3), [0, 0.241, -0.03]);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

export function createMazeMaterials(frost: boolean) {
  const slabMap = workedStone(frost, true),
    masonryMap = workedStone(frost, false);
  const timberMap = frost ? slabMap : timberGrain();
  const ground = new MeshStandardMaterial({ color: frost ? 0xb2c1c8 : 0xc2bd9f, map: slabMap, roughness: 0.67 });
  const face = new MeshStandardMaterial({ color: frost ? 0x72858c : 0x71867b, map: masonryMap, roughness: 0.67 });
  const chalk = new MeshStandardMaterial({ color: frost ? 0xc6dce0 : 0xd4c6a3, map: masonryMap, roughness: 0.72 });
  const dark = new MeshStandardMaterial({ color: frost ? 0x3f525f : 0x435c56, map: masonryMap, roughness: 0.63 });
  const brass = new MeshStandardMaterial({ color: 0xb39460, metalness: 0.46, roughness: 0.44 });
  const iron = new MeshStandardMaterial({ color: frost ? 0x546879 : 0x465c58, metalness: 0.41, roughness: 0.5 });
  const wallCap = new MeshStandardMaterial({ color: frost ? 0x526471 : 0x596252, map: masonryMap, roughness: 0.84 });
  const wet = new MeshStandardMaterial({
    color: frost ? 0x344653 : 0x304e48,
    map: masonryMap,
    roughness: 0.39,
    metalness: 0.14,
  });
  const wood = new MeshStandardMaterial({ color: 0xb3946a, map: timberMap, roughness: 0.71 });
  const jade = new MeshStandardMaterial({
    color: frost ? 0x83c7e2 : 0x6bb6ab,
    emissive: frost ? 0x367ca9 : 0x2f8a7c,
    emissiveIntensity: 0.51,
    roughness: 0.32,
    metalness: 0.18,
  });
  const frostMap = frost ? glacialCrust() : slabMap;
  const ice = new MeshStandardMaterial({
    color: 0xa6d3e1,
    map: frostMap,
    metalness: 0.13,
    roughness: 0.19,
    emissive: 0x183e51,
    emissiveIntensity: 0.23,
  });
  ice.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `
      #include <project_vertex>
      vec4 floorPoint=vec4(transformed,1.);
      #ifdef USE_INSTANCING
        floorPoint=instanceMatrix*floorPoint;
      #endif
      vMapUv=(modelMatrix*floorPoint).xz*.53;
    `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `
      #include <emissivemap_fragment>
      float sheen=pow(1.-max(.01,dot(normalize(normal),normalize(vViewPosition))),2.);
      totalEmissiveRadiance+=vec3(.035,.18,.23)*sheen;
    `,
    );
  };
  const gem = new MeshPhysicalMaterial({
    color: 0x83c3d8,
    vertexColors: true,
    emissive: 0x397e9d,
    emissiveIntensity: 0.43,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    roughness: 0.22,
    metalness: 0.1,
  });
  gem.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'varying vec3 shard;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n shard=position;');
    shader.fragmentShader =
      'varying vec3 shard;\n' +
      shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `
      #include <emissivemap_fragment>
      vec2 crystal=vec2(shard.y*1.7+shard.x*.8,shard.z*1.4-shard.x*.93);
      float cleft=abs(crystal.x-.55-.23*abs(crystal.y+.16)-.034*sin(crystal.y*17.));
      float vein=(1.-smoothstep(.002,.014,cleft))*(.5+.5*cos(crystal.y*7.));
      float inner=.16+.63*max(0.,.65-shard.y)*exp(-(shard.x*shard.x+shard.z*shard.z)*7.);
      vec3 mirrorDir=reflect(-normalize(vViewPosition),normalize(normal));
      float glaze=pow(max(0.,dot(mirrorDir,normalize(vec3(-.47,.74,.33)))),9.);
      totalEmissiveRadiance+=vec3(.017,.115,.165)*inner+vec3(.30,.43,.46)*glaze;
      float frostEdge=pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),3.);
      totalEmissiveRadiance+=vec3(.055,.19,.23)*vein+vec3(.045,.12,.15)*frostEdge;
    `,
      );
  };
  const glowGlass = new MeshBasicMaterial({ color: frost ? 0xc7ecff : 0xffce8c });
  const amberGlass = new MeshBasicMaterial({ color: 0xffda96 });
  for (const rock of [ground, face, chalk, dark, wallCap, wet]) {
    rock.bumpMap = rock.map;
    rock.bumpScale = 0.013;
    rock.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `
        #include <project_vertex>
        vec4 rockPoint=vec4(transformed,1.);
        #ifdef USE_INSTANCING
          rockPoint=instanceMatrix*rockPoint;
        #endif
        vec3 site=(modelMatrix*rockPoint).xyz;
        vec3 facet=abs(inverseTransformDirection(transformedNormal,viewMatrix));
        vec2 mortar=facet.y>.69?site.xz:(facet.x>facet.z?site.zy:site.xy);
        vMapUv=mortar*vec2(.77,.92);
        vBumpMapUv=vMapUv;
      `,
      );
    };
  }
  const mats: Material[] = [
    ground,
    face,
    chalk,
    dark,
    wallCap,
    wet,
    brass,
    iron,
    wood,
    jade,
    ice,
    gem,
    glowGlass,
    amberGlass,
  ];
  return {
    ground,
    face,
    chalk,
    dark,
    brass,
    iron,
    wallCap,
    wet,
    wood,
    jade,
    ice,
    gem,
    glowGlass,
    amberGlass,
    mats,
    disposeMaps() {
      for (const texture of new Set([slabMap, masonryMap, timberMap, frostMap])) texture.dispose();
    },
  };
}
