import { createPowerCore } from './fortress-power-core';
import { sealVolume } from './fortress-portals';
import { glacier, iceHeight, glacialHeightAt, faultLines, floorFragment, floorVertex } from './fortress-glacier';
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  ShadowMaterial,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import type { FortressInteriorFrame } from './field-fortress-state';
import { buildWardResponse, onWard, wardCurveGLSL, wardGlareGLSL } from './fortress-ward-response';
import { createWardAnchors } from './fortress-ward-anchors';
import { createIceReflection } from './fortress-ice-reflection';
import { roarPose } from './fortress-kyurem';

const tau = Math.PI * 2;
const centre = new Vector3(sealVolume.x, sealVolume.y, sealVolume.z);
const barrierScale = new Vector3(sealVolume.width, sealVolume.height, sealVolume.depth);
const contact = new Vector3(-0.59, 0.67, 0.48).normalize();
const impact = onWard(contact, new Vector3()).multiply(barrierScale).add(centre);
const noise = (i: number) => {
  const n = Math.sin(i * 73.154 + 6.67) * 46725.341;
  return n - Math.floor(n);
};
function iceShard() {
  const positions: number[] = [],
    colors: number[] = [];
  const bottom: Vector3[] = [],
    neck: Vector3[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i * tau) / 6,
      r = 0.84 + noise(i) * 0.22;
    bottom.push(new Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    neck.push(new Vector3(Math.cos(a) * r * 0.73 + 0.09, 0.6 + noise(i + 13) * 0.15, Math.sin(a) * r * 0.73));
  }
  const tip = new Vector3(-0.13, 1, 0.18);
  function triangle(a: Vector3, b: Vector3, c: Vector3, k: number) {
    for (const point of [a, b, c]) {
      positions.push(point.x, point.y, point.z);
      const v = point.y;
      colors.push((0.14 + 0.44 * v) * k, (0.35 + 0.48 * v) * k, (0.5 + 0.46 * v) * k);
    }
  }
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6,
      k = 0.76 + noise(i + 110) * 0.24;
    triangle(bottom[i], neck[i], neck[j], k);
    triangle(bottom[i], neck[j], bottom[j], k);
    triangle(neck[i], tip, neck[j], k * 1.03);
  }
  const shape = new BufferGeometry();
  shape.setAttribute('position', new Float32BufferAttribute(positions, 3));
  shape.setAttribute('color', new Float32BufferAttribute(colors, 3));
  shape.computeVertexNormals();
  return shape;
}

const shellVertex = `uniform float clock;uniform float age;uniform float reduced;uniform vec3 strike;
varying vec3 direction;varying vec3 worldPoint;
${wardCurveGLSL}
void main(){
  vec3 d=normalize(position);float arc=acos(clamp(dot(d,strike),-1.,1.));
  float dt=max(0.,age-.78);
  float first=exp(-pow((arc-dt*3.7)*7.2,2.))*exp(-dt*2.);
  float second=exp(-pow((arc-.05-dt*2.75)*11.,2.))*exp(-dt*1.9);
  float bend=step(.78,age)*(first-.4*second)*.042*(1.-reduced);
  vec4 wp=modelMatrix*vec4(wardPoint(d)*(1.+bend),1.);
  direction=d;worldPoint=wp.xyz;
  gl_Position=projectionMatrix*viewMatrix*wp;
}`;
const shellFragment = `uniform float clock;uniform float age;uniform float response;uniform float reduced;uniform vec3 strike;
varying vec3 direction;varying vec3 worldPoint;
${wardGlareGLSL}
float band(float q,float size){return 1.-smoothstep(size,size+max(.008,fwidth(q)),abs(q));}
void main(){
  vec3 d=normalize(direction),view=normalize(cameraPosition-worldPoint);
  float radial=pow(length(d.xz),1.5);
  vec3 n=normalize(vec3(radial*d.x,pow(max(0.,d.y),2.5),radial*d.z)/vec3(4.74,5.65,4.55));
  float fres=pow(1.-abs(dot(n,view)),2.85);
  float a=atan(d.z,d.x),lat=asin(clamp(d.y,0.,1.)),arc=acos(clamp(dot(d,strike),-1.,1.));
  float edge=1.-smoothstep(.008,.064,d.y);
  float orders=band(sin(a*8.+lat*.58),.014)*(.30+.70*fres);
  float parallels=band(sin(lat*8.-.17),.014)*(.25+.50*fres);
  float glass=.5+.5*sin(lat*22.+a*3.1+clock*.51+sin(a*6.-clock*.34)*1.12);
  float dt=max(0.,age-.78);float onset=step(.78,age);
  float wave=exp(-pow((arc-dt*3.7)*12.,2.))*exp(-dt*1.46)*onset;
  float trail=exp(-pow((arc+.18-dt*3.7)*12.,2.))*exp(-dt*1.73)*onset;
  float contactGlow=exp(-arc*arc*20.)*exp(-dt*4.)*onset;
  float still=exp(-arc*arc*8.)*smoothstep(.45,.70,age)*(1.-smoothstep(1.75,2.10,age));
  wave=mix(wave,still*.34,reduced);trail*=1.-reduced;contactGlow=mix(contactGlow,still*.24,reduced);
  float cell=band(sin(a*19.+lat*17.+sin(lat*12.-a)*1.7),.055);
  float stress=cell*exp(-arc*arc*2.3)*exp(-dt*2.2)*onset*(1.-reduced);
  vec3 tint=mix(vec3(.080,.29,.42),vec3(.37,.75,.82),fres*.80+edge*.20);
  tint+=vec3(.008,.037,.028)*response*(orders+.68*edge);
  tint+=vec3(.36,.68,.75)*(wave+.32*trail+contactGlow*.72+stress*.29);
  float alpha=.028+.20*fres+.14*edge+.16*orders+.085*parallels+.012*glass;
  alpha+=(wave*.31+trail*.12+contactGlow*.31+stress*.12)*facialTransmission(worldPoint);
  gl_FragColor=vec4(tint,min(.75,alpha));
  #include <colorspace_fragment>
}`;

function fog(count: number) {
  const positions = new Float32Array(count * 3),
    phases = new Float32Array(count);
  const shape = new BufferGeometry();
  const points = new Float32BufferAttribute(positions, 3);
  for (let i = 0; i < count; i++) phases[i] = noise(i * 13);
  shape.setAttribute('position', points);
  shape.setAttribute('seed', new Float32BufferAttribute(phases, 1));
  const strength = new Float32BufferAttribute(new Float32Array(count), 1);
  shape.setAttribute('strength', strength);
  const material = new ShaderMaterial({
    uniforms: { h: { value: 1 } },
    transparent: true,
    depthWrite: false,
    vertexShader: `uniform float h;attribute float seed;attribute float strength;varying float alpha;varying float vSeed;
      void main(){vec4 mv=modelViewMatrix*vec4(position,1.);alpha=strength;vSeed=seed;
        gl_PointSize=clamp((.5+seed*.55)*h/max(1.,-mv.z),1.,72.);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `varying float alpha;varying float vSeed;void main(){vec2 q=(gl_PointCoord-.5)*2.;
      float r=length(q*vec2(.87,1.10));float grain=.86+.14*sin(q.x*7.+q.y*6.+vSeed*19.);
      float amount=(1.-smoothstep(.02,1.,r))*alpha*grain;if(amount<.002)discard;
      gl_FragColor=vec4(.56,.75,.80,amount);
      #include <colorspace_fragment>
    }`,
  });
  const cloud = new Points(shape, material);
  cloud.renderOrder = 3;
  cloud.frustumCulled = false;
  return {
    cloud,
    points,
    strength,
    material,
    dispose() {
      shape.dispose();
      material.dispose();
    },
  };
}

export function createIcePrison() {
  const root = new Group();
  const clock = { value: 0 },
    age = { value: 6 },
    reduced = { value: 0 },
    response = { value: 0 },
    eyeLine = { value: new Vector3() };
  const bedShape = glacier();
  const bedMaterial = new ShaderMaterial({
    uniforms: { age, reduced, impactAt: { value: impact } },
    vertexShader: floorVertex,
    fragmentShader: floorFragment,
    side: DoubleSide,
  });
  const reflection = createIceReflection();
  root.add(reflection.mesh);
  const bed = new Mesh(bedShape, bedMaterial);
  bed.position.set(centre.x, 0, centre.z);
  root.add(bed);
  const shadowFinish = new ShadowMaterial({
    color: 0x102026,
    opacity: 0.48,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const shade = new Mesh(bedShape, shadowFinish);
  shade.position.copy(bed.position);
  shade.position.y += 0.002;
  shade.receiveShadow = true;
  root.add(shade);
  const footGeometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const contactShadow = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {},
    vertexShader: `varying vec2 disk;void main(){disk=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 disk;void main(){float a=1.-smoothstep(.02,1.,dot(disk,disk));
    gl_FragColor=vec4(.018,.046,.063,a*.59);
    #include <colorspace_fragment>
    }`,
  });
  const heelShadows = Array.from({ length: 2 }, () => {
    const s = new Mesh(footGeometry, contactShadow);
    s.scale.set(1.25, 1, 1.53);
    s.rotation.y = -0.76;
    s.renderOrder = 2;
    root.add(s);
    return s;
  });
  const fractures = faultLines(),
    inlay = new MeshBasicMaterial({
      vertexColors: true,
      side: DoubleSide,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    });
  const veins = new Mesh(fractures, inlay);
  veins.position.copy(bed.position);
  veins.renderOrder = 1;
  root.add(veins);
  const shardShape = iceShard();
  const crystal = new MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.13, side: DoubleSide });
  const pillars = new InstancedMesh(shardShape, crystal, 57),
    place = new Object3D();
  for (let i = 0; i < pillars.count; i++) {
    const bunch = Math.floor(i / 3),
      a = bunch * 2.39996 + ((i % 3) - 1) * 0.049,
      r = 5.2 + noise(bunch * 2) * 0.58 + (i % 3) * 0.074;
    const h = (0.21 + 0.7 * noise(bunch + 36)) * (i % 3 === 1 ? 1.35 : 0.64);
    place.position.set(centre.x + Math.sin(a) * r, iceHeight(r, a) - 0.025, centre.z + Math.cos(a) * r);
    place.rotation.set(noise(i) * 0.47 - 0.23, a + noise(i * 2), noise(i + 3) * 0.47 - 0.23);
    place.scale.set(0.075 + h * 0.14, h, 0.11 + h * 0.12);
    place.updateMatrix();
    pillars.setMatrixAt(i, place.matrix);
  }
  pillars.castShadow = true;
  root.add(pillars);
  const shellShape = new SphereGeometry(1, 80, 38, 0, tau, 0, Math.PI / 2);
  const shellPaint = new ShaderMaterial({
    uniforms: { clock, age, reduced, response, eyeLine, strike: { value: contact } },
    vertexShader: shellVertex,
    fragmentShader: shellFragment,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  const barrier = new Mesh(shellShape, shellPaint);
  barrier.position.copy(centre);
  barrier.scale.copy(barrierScale);
  barrier.renderOrder = 5;
  root.add(barrier);
  const collarShape = new TorusGeometry(1, 0.008, 8, 112);
  collarShape.rotateX(-Math.PI / 2);
  const collarPaint = new MeshBasicMaterial({ color: 0x7bbcca, transparent: true, opacity: 0.7, depthWrite: false });
  const collar = new Mesh(collarShape, collarPaint);
  collar.position.copy(centre);
  collar.position.y += 0.04;
  collar.scale.set(barrierScale.x, 1, barrierScale.z);
  collar.renderOrder = 2;
  root.add(collar);
  const mist = fog(53);
  root.add(mist.cloud);
  const burst = new InstancedMesh(shardShape, crystal, 32);
  burst.frustumCulled = false;
  root.add(burst);
  const pieces = Array.from({ length: burst.count }, (_, i) => {
    const theta = noise(i * 11) * tau,
      speed = 0.41 + 1.14 * noise(i * 13);
    const vx = Math.sin(theta) * speed,
      vz = Math.cos(theta) * speed,
      vy = 0.39 + 1.17 * noise(i * 7);
    const first = (vy + Math.sqrt(vy * vy + 14.2 * (impact.y - centre.y))) / 7.1;
    const dx = impact.x + vx * first - centre.x,
      dz = impact.z + vz * first - centre.z;
    const ground = iceHeight(Math.hypot(dx, dz), Math.atan2(dx, dz)) + 0.012;
    const hit = (vy + Math.sqrt(vy * vy + 14.2 * (impact.y - ground))) / 7.1;
    const bounceV = (7.1 * hit - vy) * (0.13 + 0.09 * noise(i + 57));
    return {
      vx,
      vy,
      vz,
      ground,
      hit,
      bounceV,
      bounceDuration: (2 * bounceV) / 7.1,
      start: 0.78 + noise(i * 3) * 0.24,
      settle: 0.51 + 0.26 * noise(i + 2),
      melt: 0.5 + 0.29 * noise(i + 4),
      size: 0.029 + noise(i + 21) * 0.041,
      length: 1.5 + noise(i) * 1.4,
    };
  });
  const grid = createPowerCore();
  root.add(grid.root);
  const responseSkin = buildWardResponse(centre, barrierScale, contact, eyeLine);
  root.add(responseSkin.root);
  const anchors = createWardAnchors(centre, barrierScale);
  root.add(anchors.root);
  const from = new Vector3(),
    delta = new Vector3();
  return {
    root,
    landmarkAt: anchors.landmarkAt,
    handwheel: anchors.handwheel,
    update(
      time: number,
      frame: FortressInteriorFrame,
      height: number,
      muzzle: Vector3,
      feet: Vector3[],
      eyes: Vector3,
      crystals?: Vector3[],
    ) {
      grid.update(frame.power, frame.reduced, crystals, frame.now);
      eyeLine.value.copy(eyes);
      clock.value = time;
      age.value = Math.min(6, frame.roarAge ?? Infinity);
      reduced.value = Number(frame.reduced);
      response.value = frame.resonance ?? 0;
      const a = age.value,
        p = roarPose(a);
      heelShadows.forEach((shadow, i) => {
        const foot = feet[i];
        shadow.visible = foot.lengthSq() > 0;
        shadow.position.set(foot.x, glacialHeightAt(foot.x, foot.z) + 0.013, foot.z);
      });
      responseSkin.update(a, frame.reduced, muzzle);
      anchors.update(a, frame, height);
      from.copy(muzzle);
      delta.subVectors(impact, from);
      mist.material.uniforms.h.value = height;
      const breathing = a > 2.7;
      const breathStrength = frame.reduced ? 0.021 : Math.max(0, Math.sin(time * 1.18 - 0.65)) ** 1.6 * 0.095;
      for (let i = 0; i < 53; i++) {
        if (i < 27) {
          const t = (time * 0.034 + noise(i * 11)) % 1;
          const az = i * 2.39996 + t * 0.59,
            r = 2.85 + 1.71 * noise(i * 5);
          mist.points.setXYZ(
            i,
            centre.x + Math.sin(az) * r,
            centre.y + 0.1 + 0.21 * Math.sin(t * Math.PI),
            centre.z + Math.cos(az) * r,
          );
          mist.strength.setX(i, 0.042 + 0.032 * Math.sin(t * Math.PI));
        } else if (breathing) {
          const q = frame.reduced ? noise(i) : (time * 0.69 + noise(i * 3)) % 1;
          const spread = 0.035 + q * 0.32;
          mist.points.setXYZ(
            i,
            from.x - 0.88 * q + (noise(i) - 0.5) * spread,
            from.y - 0.13 * q + 0.4 * q * q + (noise(i * 3) - 0.5) * spread,
            from.z + 0.55 * q + (noise(i * 7) - 0.5) * spread,
          );
          mist.strength.setX(i, breathStrength * Math.sin(Math.PI * q));
        } else {
          const u = frame.reduced ? noise(i) : (time * 2.7 + noise(i * 3)) % 1;
          const travel = Math.min(1, Math.max(0, (a - 0.44) / 0.34));
          const q = u * travel;
          const spread = 0.06 + 0.33 * q;
          const x = from.x + delta.x * q + (noise(i * 3) - 0.5) * spread;
          const y = from.y + delta.y * q + (noise(i * 5) - 0.37) * spread;
          const z = from.z + delta.z * q + (noise(i * 7) - 0.5) * spread;
          mist.points.setXYZ(i, x, y, z);
          mist.strength.setX(i, (frame.reduced ? 0.031 : 0.15) * p.jaw * Math.sin(Math.PI * u));
        }
      }
      mist.points.needsUpdate = mist.strength.needsUpdate = true;
      burst.visible = !frame.reduced && a > 0.78 && a < 4.35;
      if (burst.visible) {
        for (let i = 0; i < burst.count; i++) {
          const piece = pieces[i],
            t = Math.max(0, a - piece.start);
          const after = Math.max(0, t - piece.hit),
            rest = Math.max(0, after - piece.bounceDuration);
          const life = a < piece.start ? 0 : Math.max(0, 1 - Math.max(0, rest - piece.settle) / piece.melt);
          const travel =
            Math.min(t, piece.hit) + 0.23 * Math.min(after, piece.bounceDuration) + 0.009 * (1 - Math.exp(-rest * 5.3));
          const y =
            t < piece.hit
              ? impact.y + piece.vy * t - 3.55 * t * t
              : piece.ground + Math.max(0, piece.bounceV * after - 3.55 * after * after);
          place.position.set(impact.x + piece.vx * travel, y, impact.z + piece.vz * travel);
          const spin = Math.min(t, piece.hit) + Math.min(after, piece.bounceDuration) * 0.51;
          place.rotation.set(i + 0.91 * spin, i * 2.3 + spin * 4.8, i * 0.49 + spin * 3.3);
          const size = piece.size * life;
          place.scale.set(size, size * piece.length, size * 0.65);
          place.updateMatrix();
          burst.setMatrixAt(i, place.matrix);
        }
        burst.instanceMatrix.needsUpdate = true;
      }
    },
    dispose() {
      for (const g of [bedShape, fractures, shardShape, shellShape, collarShape, footGeometry]) g.dispose();
      for (const m of [bedMaterial, inlay, crystal, shellPaint, collarPaint, shadowFinish, contactShadow]) m.dispose();
      reflection.dispose();
      anchors.dispose();
      grid.dispose();
      responseSkin.dispose();
      mist.dispose();
      pillars.dispose();
      burst.dispose();
    },
  };
}
