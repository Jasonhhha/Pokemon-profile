import {
  BoxGeometry, BufferGeometry, CanvasTexture, CylinderGeometry, DoubleSide, ExtrudeGeometry, Float32BufferAttribute,
  Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, PlaneGeometry, RepeatWrapping, RingGeometry,
  ShaderMaterial, Shape, SphereGeometry, SRGBColorSpace, TorusGeometry, Vector3, type Material,
} from 'three';
import { batchStaticMeshes } from './field-mesh-batch';
import { harborHeight } from './field-city-layout';
import { ringAngle, ringRadius } from './field-ring-coordinates';
import type { FortressView } from './field-fortress-state';

export const fortressLift = 4.8;
export const fortressRadius = ringRadius(harborHeight + 1);
const waterline = -.58;
const top = -.43;
const gateAngle = ringAngle(3.5);
const tau = Math.PI * 2;
const unit = new BoxGeometry(1, 1, 1);
const round = new CylinderGeometry(1, 1, 1, 24);
const rim = new TorusGeometry(1, .10, 7, 32);
const sphere = new SphereGeometry(1, 10, 7);
const sheet = new PlaneGeometry(1, 1);
type Triple = [number, number, number];

function ease(value: number, lo: number, hi: number) {
  const f = Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
  return f * f * (3 - 2 * f);
}

function piece(parent: Group, geo: BufferGeometry, mat: Material, pos: Triple, size: Triple, rotationX = 0, rotationZ = 0) {
  const mesh = new Mesh(geo, mat);
  mesh.position.set(...pos);
  mesh.scale.set(...size);
  mesh.rotation.set(rotationX, 0, rotationZ);
  parent.add(mesh);
  return mesh;
}
function section(parent: Group, angle: number, radius: number) {
  const group = new Group();
  group.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
  group.rotation.y = angle;
  parent.add(group);
  return group;
}
function paint(hex: number, metalness = .06, roughness = .82) {
  return new MeshStandardMaterial({ color: hex, metalness, roughness });
}

function wornSurface(iron: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 192;
  const ctx = canvas.getContext('2d')!;
  let seed = iron ? 971 : 114;
  const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  ctx.fillStyle = iron ? '#c7cbc4' : '#d3d0c1';
  ctx.fillRect(0, 0, 192, 192);
  for (let n = 0; n < 6200; n++) {
    ctx.fillStyle = rand() < .5 ? '#32332320' : '#f9edca1a';
    ctx.fillRect(rand() * 192, rand() * 192, .6 + rand() * 3, .55 + rand() * 1.8);
  }
  for (let n = 0; n < 100; n++) {
    const x = rand() * 192, y = rand() * 192, h = (iron ? 30 : 16) * rand() + 2;
    const residue = ctx.createLinearGradient(0, y, 0, y + h);
    residue.addColorStop(0, iron ? '#60462b71' : '#394a464a');
    residue.addColorStop(1, '#53473500');
    ctx.fillStyle = residue;
    ctx.fillRect(x, y, 1 + rand() * 3.4, h);
  }
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

function tunnelArch(index: number, count: number, innerX: number, innerY: number, thickness: number, depth: number) {
  const left = (index + .023) * Math.PI / count;
  const right = (index + .977) * Math.PI / count;
  const shape = new Shape();
  shape.moveTo(innerX * Math.cos(left), innerY * Math.sin(left));
  shape.lineTo((innerX + thickness) * Math.cos(left), (innerY + thickness) * Math.sin(left));
  shape.lineTo((innerX + thickness) * Math.cos(right), (innerY + thickness) * Math.sin(right));
  shape.lineTo(innerX * Math.cos(right), innerY * Math.sin(right));
  shape.closePath();
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: false });
}

function archSpandrel() {
  const shape = new Shape();
  shape.moveTo(-1.99, 1.40); shape.lineTo(-1.99, 0);
  for (let i = 0; i <= 32; i++) {
    const a = Math.PI * (1 - i / 32);
    shape.lineTo(1.99 * Math.cos(a), 1.31 * Math.sin(a));
  }
  shape.lineTo(1.99, 1.40); shape.closePath();
  return new ExtrudeGeometry(shape, { depth: 3.85, bevelEnabled: false });
}

function nameplate() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 100;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#273a38';
  ctx.fillRect(0, 0, 512, 100);
  ctx.strokeStyle = '#a18e66'; ctx.lineWidth = 4;
  ctx.strokeRect(7, 7, 498, 86);
  ctx.fillStyle = '#e0cdaa'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 42px Georgia, serif';
  ctx.fillText('WEST TIDE LOCK', 256, 51);
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace; map.anisotropy = 4;
  return new MeshStandardMaterial({ map, roughness: .53, metalness: .16 });
}

function saltMasonry() {
  const texture = document.createElement('canvas');
  texture.width = 512; texture.height = 384;
  const ctx = texture.getContext('2d')!;
  let state = 173;
  const sample = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  ctx.fillStyle = '#42535b';
  ctx.fillRect(0, 0, 512, 384);
  for (let row = 0; row < 8; row++) {
    const offset = row % 2 * 54;
    for (let col = -1; col < 6; col++) {
      const x = col * 112 + offset, y = row * 48;
      const grain = Math.floor(sample() * 18), bottom = row * 2;
      ctx.fillStyle = `rgb(${122 + grain - bottom},${132 + grain - bottom},${130 + grain - bottom})`;
      ctx.fillRect(x + 2, y + 2, 110, 46);
      ctx.fillStyle = '#dfdbb535';
      ctx.fillRect(x + 4, y + 3, 104, 2);
      ctx.fillStyle = '#253a4166';
      ctx.fillRect(x + 3, y + 45, 108, 3);
    }
  }
  for (let grain = 0; grain < 11800; grain++) {
    ctx.fillStyle = sample() < .5 ? '#192f3716' : '#efe6c317';
    ctx.fillRect(sample() * 512, sample() * 384, 1 + sample() * 2.8, 1 + sample() * 3.1);
  }
  for (let drip = 0; drip < 140; drip++) {
    const x = sample() * 512, h = 10 + sample() ** 3 * 224, y = Math.floor(sample() * 6) * 48;
    const mark = ctx.createLinearGradient(0, y, 0, y + h);
    mark.addColorStop(0, '#24434a45'); mark.addColorStop(1, '#24434a00');
    ctx.fillStyle = mark;
    ctx.fillRect(x, y, 2 + sample() * 5, h);
  }
  const green = ctx.createLinearGradient(0, 170, 0, 384);
  green.addColorStop(0, '#234a4700'); green.addColorStop(.72, '#35565080'); green.addColorStop(1, '#193d44b2');
  ctx.fillStyle = green; ctx.fillRect(0, 170, 512, 214);
  const map = new CanvasTexture(texture);
  map.colorSpace = SRGBColorSpace; map.wrapS = RepeatWrapping; map.repeat.x = 22; map.anisotropy = 4;
  return new MeshStandardMaterial({ map, roughness: .61, metalness: .08 });
}

function pressureWater() {
  const group = new Group();
  const streams = new Group(), spray = new Group();
  group.add(streams, spray);
  const jetShape = new BufferGeometry();
  const positions: number[] = [], indices: number[] = [];
  const slices = 24, ribs = 16;
  for (let s = 0; s <= slices; s++) for (let j = 0; j <= ribs; j++) {
    const a = tau * j / ribs; positions.push(Math.cos(a), Math.sin(a), s / slices);
    const p = s * (ribs + 1) + j;
    if (s < slices && j < ribs) indices.push(p, p + 1, p + ribs + 1, p + 1, p + ribs + 2, p + ribs + 1);
  }
  jetShape.setAttribute('position', new Float32BufferAttribute(positions, 3)); jetShape.setIndex(indices);
  const jet = new ShaderMaterial({
    transparent: true, depthWrite: false, side: DoubleSide,
    uniforms: { clock: { value: 0 }, pressure: { value: 0 }, fall: { value: 1 }, night: { value: 0 } },
    vertexShader: `
      uniform float clock, pressure, fall;
      varying vec3 skin;
      varying float offset;
      void main() {
        float t=position.z;
        float phase=modelMatrix[3].x*.73 + modelMatrix[3].z*.29;
        offset=phase;
        float w=(.15+.44*pressure)*(1.-.22*t+.38*t*t);
        float surge=sin(phase+t*20.-clock*8.)*.045 + sin(t*35.-clock*12.+position.x*6.)*.027;
        w*=1.+surge*(.28+t);
        float reach=(.53+1.69*pressure)*sqrt(fall);
        vec3 p=vec3(position.x*w, -fall*t*t+position.y*w*(.91-.36*t), t*reach);
        p.x+=.032*t*sin(phase+t*20.-clock*8.);
        skin=vec3(position.x,position.y,t);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      }`,
    fragmentShader: `
      uniform float clock, pressure, night;
      varying vec3 skin;
      varying float offset;
      float hash(vec2 p) { return fract(sin(dot(p,vec2(37.1,91.7)))*43758.55); }
      float noise(vec2 p) {
        vec2 cell=floor(p), f=fract(p);
        f=f*f*(3.-2.*f);
        return mix(mix(hash(cell),hash(cell+vec2(1.,0.)),f.x),mix(hash(cell+vec2(0.,1.)),hash(cell+1.),f.x),f.y);
      }
      void main(){
        float winding=atan(skin.x,skin.y);
        vec2 p=vec2(winding*5.4+offset,skin.z*9.-clock*6.5);
        float eddies=noise(p*.58)*.54+noise(p*1.5+noise(p*.35))* .30+noise(p*3.8)*.16;
        float flow=.22+.30*max(0.,skin.y)+.18*max(0.,skin.x)+.30*skin.z;
        float froth=smoothstep(.55-.09*skin.z,.79,eddies)*(.52+.48*skin.z);
        vec3 base=mix(vec3(.036,.19,.22),vec3(.013,.075,.12),night);
        vec3 water=mix(vec3(.26,.52,.54),vec3(.075,.24,.31),night);
        vec3 glint=mix(vec3(.82,.91,.87),vec3(.32,.59,.64),night);
        gl_FragColor=vec4(mix(mix(base,water,flow),glint,froth),.69+.19*pressure);
        #include <colorspace_fragment>
      }`,
  });
  const foamGeometry = new PlaneGeometry(1, 1);
  const white = new ShaderMaterial({
    transparent: true, depthWrite: false, side: DoubleSide,
    uniforms: { clock: { value: 0 }, pressure: jet.uniforms.pressure, night: jet.uniforms.night },
    vertexShader: `varying vec2 q; void main(){q=uv*2.-1.; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `
      varying vec2 q; uniform float clock,pressure,night;
      void main(){
        float a=atan(q.y,q.x), r=length(q);
        float wav=r+.045*sin(a*7.-clock*1.8)+.024*sin(a*13.+clock*2.7);
        float rings=pow(.5+.5*cos(wav*30.-clock*5.4),5.);
        float tear=.5+.5*sin(a*8.+wav*17.+clock*.9)*cos(a*4.-clock*.5);
        float foam=.78*(1.-smoothstep(.16,.61,r))*(.64+.36*tear)
          + .32*rings*smoothstep(.37,.68,tear)*(1.-smoothstep(.53,.99,r));
        gl_FragColor=vec4(mix(vec3(.65,.87,.82),vec3(.18,.48,.57),night),foam*pressure);
        #include <colorspace_fragment>
      }`,
  });
  const splashes: Mesh[] = [];
  const centers = Array.from({ length: 8 }, (_, i) => gateAngle + Math.PI / 8 + i * Math.PI / 4);
  for (const angle of centers) {
    const mount = section(streams, angle, fortressRadius + .67);
    const water = new Mesh(jetShape, jet);
    water.position.y = -1.76; water.renderOrder = 3; water.frustumCulled = false; mount.add(water);
    const foam = new Mesh(foamGeometry, white); foam.rotation.set(-Math.PI / 2, 0, -angle); foam.renderOrder = 2;
    spray.add(foam); splashes.push(foam);
  }
  const beads = paint(0xbcdcd6, .16, .31);
  const droplets = new InstancedMesh(sphere, beads, 8 * 16), transform = new Matrix4();
  droplets.frustumCulled = false; spray.add(droplets);
  return {
    group,
    update(time: number, lift: number, drain: number, night: number, cinematic: boolean) {
      const fall = fortressLift * lift - 1.18;
      const force = ease(lift, .22, .72) * (1 - ease(drain, .60, .970));
      group.visible = cinematic && force > .018 && fall > 0;
      if (!group.visible) return;
      jet.uniforms.clock.value = white.uniforms.clock.value = time; jet.uniforms.night.value = night;
      jet.uniforms.pressure.value = force; jet.uniforms.fall.value = fall;
      const reach = (.53 + 1.69 * force) * Math.sqrt(fall);
      const radius = fortressRadius + .67 + reach;
      const y = waterline - fortressLift * lift;
      centers.forEach((a, i) => {
        const s = Math.sin(a), c = Math.cos(a);
        splashes[i].position.set(radius * s, y + .035, radius * c);
        splashes[i].scale.set(2.8 + 2.5 * force, 2.8 + 2.8 * force, 1);
        for (let j = 0; j < 16; j++) {
          const life = (time * (.82 + j % 3 * .13) + j * .618 + i * .17) % 1, dir = j * 2.4 + i * .54;
          const d = (.12 + life * (.5 + j % 4 * .26)) * force;
          const size = (.037 + (j % 4) * .015) * force * (1 - life * .7);
          transform.makeScale(size, size * 1.55, size);
          transform.setPosition(radius * s + Math.cos(dir) * d, y + .04 + force * life * (1 - life) * (1.85 + j % 3 * .8), radius * c + Math.sin(dir) * d);
          droplets.setMatrixAt(i * 16 + j, transform);
        }
      });
      droplets.instanceMatrix.needsUpdate = true;
    },
    dispose() { jetShape.dispose(); jet.dispose(); foamGeometry.dispose(); white.dispose(); beads.dispose(); droplets.dispose(); },
  };
}

function wetLanding() {
  const material = new ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { clock: { value: 0 }, wetness: { value: 0 }, night: { value: 0 } },
    vertexShader: `
      varying vec2 landing;
      varying vec3 point;
      void main() {
        landing=uv*2.-1.;
        point=(modelMatrix*vec4(position,1.)).xyz;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }`,
    fragmentShader: `
      varying vec2 landing;
      varying vec3 point;
      uniform float clock,wetness,night;
      void main() {
        vec2 p=landing;
        float edge=length(p*vec2(1.05,1.12)) + .20*sin(p.x*9.+p.y*3.) + .10*cos(p.x*19.-p.y*5.);
        float rim=.60+.19*wetness;
        float fill=(1.-smoothstep(rim-.035,rim+.035,edge))*wetness;
        if(fill<.005) discard;
        float fresnel=pow(1.-max(0.,normalize(cameraPosition-point).y),2.);
        float gleam=.5+.5*sin(p.y*16.+sin(p.x*9.+clock*.6)+clock*1.1);
        vec3 color=mix(vec3(.025,.085,.092),vec3(.28,.46,.47),fresnel+.15*gleam);
        float lip=1.-smoothstep(.0,.04,abs(edge-rim+.05));
        color+=vec3(.21,.26,.23)*lip*(.5+.5*gleam);
        gl_FragColor=vec4(color*(1.-.58*night),(.32+.20*gleam)*fill);
        #include <colorspace_fragment>
      }`,
  });
  const film = new Mesh(sheet, material);
  film.rotation.x = -Math.PI / 2;
  film.scale.set(3.90, 1.18, 1);
  film.position.y = .011;
  film.renderOrder = 1;
  return film;
}

export function buildFortressExterior() {
  const group = new Group();
  const granite = paint(0x7d8583), pale = paint(0xb3aa92), iron = paint(0x415254, .42, .45), dark = paint(0x202f34, .30, .61);
  const bronze = paint(0x977451, .44, .5), copper = paint(0x618480, .36, .50), brick = paint(0x82705f, .08, .71);
  const lamp = paint(0xffc18a, .12, .34); lamp.emissive.setHex(0xff9b40); lamp.emissiveIntensity = .65;
  const cast = paint(0x49666a, .48, .39), voidMat = paint(0x172833, .10, .9);
  const deck = new Group();
  const ang = ringAngle(3.96);
  const winch = section(deck, ang, ringRadius(11.6));
  piece(winch, unit, granite, [0, .066, 0], [.58, .13, .31]);
  piece(winch, unit, iron, [0, .37, 0], [.21, .54, .18]);
  piece(winch, unit, bronze, [0, .57, .013], [.39, .15, .22]);
  piece(winch, rim, copper, [0, .67, .149], [.22, .22, .16]);
  for (let k = 0; k < 3; k++) piece(winch, unit, bronze, [0, .67, .143], [.40, .025, .028], 0, k * Math.PI / 3);
  piece(winch, round, bronze, [0, .67, .172], [.042, .075, .042], Math.PI / 2);
  piece(winch, round, lamp, [.165, .71, 0], [.048, .082, .048]);
  winch.scale.setScalar(1.16);
  const hatch = section(deck, ang, ringRadius(11.10));
  piece(hatch, unit, iron, [-.78, .027, 0], [.88, .05, .48]);
  for (let h = 0; h < 6; h++) piece(hatch, unit, copper, [-1.12 + h * .139, .061, 0], [.085, .02, .40]);
  const controls = batchStaticMeshes(deck, true); group.add(controls);
  const landing = section(group, gateAngle, ringRadius(12.75));
  const film = wetLanding();
  landing.add(film);
  film.visible = false;

  let shell: ReturnType<typeof buildShell> | undefined;
  let opening = -1;
  function buildShell() {
    const outer = new Group(), masonry = saltMasonry(), details = new Group();
    const stoneTexture = wornSurface(false), metalTexture = wornSurface(true), plate = nameplate();
    granite.map = pale.map = brick.map = stoneTexture;
    cast.map = iron.map = bronze.map = copper.map = metalTexture;
    for (const mat of [granite, pale, brick, cast, iron, bronze, copper]) mat.needsUpdate = true;
    const gateWidth = 4.75, omit = Math.asin(gateWidth * .5 / fortressRadius);
    const bodyGeo = new CylinderGeometry(fortressRadius, fortressRadius + .28, 5.94, 144, 1, true, gateAngle + omit, tau - 2 * omit);
    const body = new Mesh(bodyGeo, masonry); body.position.y = top - 2.97; body.receiveShadow = true; outer.add(body);
    const ringSkirt = new RingGeometry(fortressRadius - 1.10, fortressRadius + .14, 144);
    ringSkirt.rotateX(-Math.PI / 2);
    const sill = new Mesh(ringSkirt, granite); sill.position.y = top; sill.receiveShadow = true; outer.add(sill);
    for (let i = 0; i < 64; i++) {
      const a = gateAngle + i * tau / 64, t = section(details, a, fortressRadius - .01), span = 2 * fortressRadius * Math.tan(Math.PI / 64);
      piece(t, unit, i % 5 === 0 ? granite : pale, [0, top - .118, .05], [span - .019, .236, .39]);
      if (Math.min(i, 64 - i) > 1) {
        piece(t, unit, iron, [0, -3.65, .14], [span + .01, .095, .14]);
        piece(t, unit, granite, [0, -5.02, .21], [span + .01, .24, .27]);
      }
      if (i > 0 && i % 4 === 0) {
        piece(t, unit, granite, [0, -3.52, .205], [.47, 5.50, .41], -.045);
        piece(t, unit, brick, [0, -1.08, .31], [.69, .53, .52]);
        piece(t, unit, pale, [0, -.86, .32], [.82, .13, .61]);
        piece(t, unit, iron, [0, -4.78, .35], [.61, .19, .51]);
      }
      if (i % 2 === 1 && Math.min(i, 64 - i) > 1) {
        piece(t, unit, dark, [0, -2.15, .06], [.32, 1.23, .16]);
        piece(t, unit, bronze, [0, -1.50, .11], [.47, .10, .23]);
        piece(t, unit, iron, [0, -2.77, .13], [.43, .11, .20]);
      }
    }
    for (let i = 0; i < 8; i++) {
      const a = gateAngle + Math.PI / 8 + i * tau / 8;
      const s = section(details, a, fortressRadius);
      piece(s, unit, granite, [0, -2.34, .25], [2.40, 3.25, .74]);
      piece(s, unit, pale, [0, -.86, .25], [2.67, .29, .97]);
      piece(s, round, iron, [0, -1.76, .52], [.80, .36, .80], Math.PI / 2);
      piece(s, round, dark, [0, -1.76, .718], [.657, .045, .657], Math.PI / 2);
      piece(s, rim, copper, [0, -1.76, .75], [.692, .692, .49]);
      for (let h = 0; h < 10; h++) {
        const an = h * tau / 10;
        piece(s, round, bronze, [Math.cos(an) * .739, -1.76 + Math.sin(an) * .739, .713], [.049, .085, .049], Math.PI / 2);
      }
      for (const side of [-1, 1]) {
        piece(s, round, cast, [side * .92, -2.70, .62], [.097, 2.16, .097]);
        piece(s, round, bronze, [side * .92, -3.45, .62], [.129, .14, .129]);
      }
    }
    const frame = section(details, gateAngle, fortressRadius);
    // The arch and its ribs continue behind the hull; the raised gate reveals the pump gallery.
    piece(frame, unit, voidMat, [0, -3.45, -4.1], [4.7, 5.7, .19]);
    piece(frame, unit, iron, [0, -4.34, -1.59], [4.5, .17, 5.30]);
    piece(frame, unit, brick, [0, -1.02, .08], [5.66, .38, 1.02]);
    piece(frame, unit, granite, [0, -.78, .14], [5.88, .18, 1.12]);
    piece(frame, unit, cast, [0, -1.05, .659], [2.01, .342, .11]);
    piece(frame, sheet, plate, [0, -1.05, .726], [1.94, .31, 1]);
    piece(frame, unit, granite, [0, -5.48, .16], [5.20, 2.06, 1.42]);
    piece(frame, unit, iron, [0, -4.43, .42], [4.66, .15, 1.47]);
    const tunnelStone = (index: number) => index % 4 === 1 ? granite : index % 4 === 3 ? brick : pale;
    const masonryTemplates: BufferGeometry[] = [];
    const spandrel = archSpandrel();
    masonryTemplates.push(spandrel);
    piece(frame, spandrel, granite, [0, -2.52, -3.32], [1, 1, 1]);
    piece(frame, unit, voidMat, [0, -1.53, -1.91], [3.72, .44, 3.85]);
    for (let i = 0; i < 13; i++) {
      const wedge = tunnelArch(i, 13, 1.68, 1.01, i === 6 ? .42 : .32, i === 6 ? 1.08 : .96);
      masonryTemplates.push(wedge);
      piece(frame, wedge, i % 5 === 1 ? granite : pale, [0, -2.52, -.12], [1, 1, 1]);
      const rib = tunnelArch(i, 13, 1.64, 1.01, .19, .13);
      masonryTemplates.push(rib);
      for (const z of [-.29, -1.45, -2.62, -3.63])
        piece(frame, rib, cast, [0, -2.52, z], [1, 1, 1]);
    }
    const terminal = section(frame, 0, -3.91);
    piece(terminal, round, iron, [0, -3.12, 0], [.81, .17, .81], Math.PI / 2);
    piece(terminal, rim, bronze, [0, -3.12, .14], [.62, .62, .26]);
    piece(terminal, round, cast, [0, -3.12, .115], [.53, .10, .53], Math.PI / 2);
    piece(terminal, rim, copper, [0, -3.12, .23], [.24, .24, .22]);
    for (let i = 0; i < 3; i++)piece(terminal, unit, bronze, [0, -3.12, .225], [.51, .056, .045], 0, i * Math.PI / 3);
    for (const side of [-1, 1]) {
      piece(frame, unit, iron, [side * 1.86, -3.36, -1.68], [.33, 2.14, 4.58]);
      piece(frame, unit, cast, [side * 1.58, -3.94, -1.84], [.11, .09, 4.14]);
      for (const z of [-.32, -1.49, -2.66, -3.69]) {
        piece(frame, unit, cast, [side * 1.67, -3.38, z], [.19, 1.85, .16]);
        piece(frame, unit, bronze, [side * 1.54, -2.90, z], [.13, .26, .15]);
        piece(frame, unit, lamp, [side * 1.45, -2.89, z + .04], [.043, .16, .12]);
      }
      // Fixed winch housings and rollers cover the leaves as they slide back.
      piece(frame, unit, iron, [side * 3.11, -2.84, .17], [1.04, 3.43, .73]);
      piece(frame, unit, cast, [side * 3.36, -2.84, .55], [.41, 3.37, .23]);
      for (let n = 0; n < 8; n++)
        piece(frame, unit, bronze, [side * 3.37, -1.64 - n * .34, .69], [.26, .063, .11]);
      for (const y of [-1.49, -2.82, -4.18]) {
        piece(frame, round, iron, [side * 2.97, y, .62], [.24, .15, .24], Math.PI / 2);
        piece(frame, rim, bronze, [side * 2.97, y, .71], [.165, .165, .23]);
      }
      piece(frame, unit, granite, [side * 2.14, -2.86, .18], [.68, 3.46, .91]);
      piece(frame, unit, iron, [side * 1.81, -2.89, .32], [.135, 3.36, .23]);
      for (let course = 0; course < 6; course++) {
        const y = -1.40 - course * .50;
        piece(frame, unit, tunnelStone(course), [side * 2.12, y, .68], [.61, .486, .23]);
      }
      piece(frame, unit, bronze, [side * 1.61, -3.21, -.35], [.09, 1.88, .07]);
      piece(frame, unit, lamp, [side * 1.61, -2.36, -.29], [.069, .38, .06]);
      piece(frame, unit, iron, [side * 2.17, -1.82, .84], [.33, .65, .24]);
      piece(frame, unit, lamp, [side * 2.17, -1.82, 1.00], [.19, .39, .105]);
    }
    for (let rib = 0; rib < 20; rib++)
      piece(frame, unit, cast, [0, -4.233, 1.08 - rib * .252], [3.29, .055, .092]);
    for (const x of [-1.35, -.68, 0, .68, 1.35])
      piece(frame, unit, iron, [x, -4.26, -1.25], [.07, .08, 4.80]);
    const leaves = [-1, 1].map(side => {
      const leaf = new Group();
      piece(leaf, unit, cast, [0, 0, 0], [1.81, 3.14, .19]);
      for (const x of [-.72, .72]) piece(leaf, unit, iron, [x, 0, .121], [.11, 3.07, .13]);
      for (const h of [-1.25, 0, 1.25]) piece(leaf, unit, bronze, [0, h, .14], [1.66, .12, .15]);
      for (let i = 0; i < 6; i++)piece(leaf, round, bronze, [side * .62, -1.31 + i * .52, .22], [.035, .045, .035], Math.PI / 2);
      const mesh = batchStaticMeshes(leaf, true);
      const mount = section(outer, gateAngle, fortressRadius + .32); mount.add(mesh);
      mesh.position.set(side * .91, -2.80, 0);
      return mesh;
    });
    const castings = batchStaticMeshes(details, true); outer.add(castings);
    masonryTemplates.forEach(geometry => geometry.dispose());
    const water = pressureWater(); outer.add(water.group);
    group.add(outer);
    return { outer, water, leaves, bodyGeo, ringSkirt, masonry, castings, stoneTexture, metalTexture, plate };
  }
  return {
    group,
    update(state: FortressView | undefined, time: number, night: number) {
      const lift = state?.lift ?? 0;
      film.visible = lift > .22;
      film.material.uniforms.wetness.value = ease(lift, .22, .80) * (1 - .25 * (state?.drain ?? 0));
      film.material.uniforms.clock.value = time / 1000;
      film.material.uniforms.night.value = night;
      if (lift <= 0 && !shell) return;
      shell ??= buildShell();
      shell.outer.visible = lift > .002;
      if (!state || !shell.outer.visible) return;
      shell.outer.position.y = -.27 * (1 - ease(lift, 0, .18));
      const gate = ease(state.drain, .80, 1);
      if (opening !== gate) {
        shell.leaves.forEach((leaf, i) => { leaf.position.x = (i ? 1 : -1) * (.91 + gate * 1.80); });
        opening = gate;
      }
      shell.water.update(time / 1000, lift, state.drain, night, state.cinematic);
    },
    dispose() {
      film.material.dispose();
      controls.traverse(m => { if (m instanceof Mesh) m.geometry.dispose(); });
      if (shell) {
        shell.water.dispose(); shell.bodyGeo.dispose(); shell.ringSkirt.dispose(); shell.masonry.map?.dispose(); shell.masonry.dispose();
        shell.stoneTexture.dispose(); shell.metalTexture.dispose(); shell.plate.map?.dispose(); shell.plate.dispose();
        for (const g of [...shell.leaves, shell.castings]) g.traverse(m => { if (m instanceof Mesh) m.geometry.dispose(); });
      }
      for (const m of [granite, pale, iron, dark, bronze, copper, brick, lamp, cast, voidMat]) m.dispose();
    }
  };
}

export function fortressShot(state: FortressView, aspect: number) {
  const reveal = ease(state.drain, .31, .94);
  const yaw = gateAngle - .30 + .28 * ease(state.lift, 0, .95) + .16 * reveal;
  const targetRadius = 2.6 + (fortressRadius - 2.2) * reveal;
  const panorama = Math.max(33.4, (fortressRadius + 3) * 2.42 / aspect);
  return {
    yaw, pitch: .39 + .018 * state.lift - .19 * reveal,
    center: new Vector3(Math.sin(gateAngle) * targetRadius, 1.35 - state.lift * 3.82 - reveal * .03, Math.cos(gateAngle) * targetRadius),
    span: panorama + (7.3 - panorama) * reveal, distance: 89 + (15 - 89) * reveal,
  };
}
