import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  Vector2,
} from 'three';
import type { FortressRoom, FortressInteriorFrame } from './field-fortress-state';

const tau = Math.PI * 2;
type Puddle = { x: number; z: number; w: number; d: number; angle: number };

const waterVertex = `
  varying vec3 point;
  uniform float clock;
  uniform float whirl;
  void main(){
    vec4 p=modelMatrix*vec4(position,1.);
    vec2 delta=p.xz-vec2(8.5,6.5);
    float radius=length(delta);
    float az=atan(delta.y,delta.x);
    float crest=sin(az*5.+radius*3.1+clock*10.4);
    p.y+=whirl*(-.38*exp(-radius*radius*.10)+.092*crest*smoothstep(2.3,4.8,radius)*(1.-smoothstep(5.41,5.84,radius)));
    point=p.xyz;
    gl_Position=projectionMatrix*viewMatrix*p;
  }`;

const waterFragment = `
  uniform float clock; uniform float whirl;
  varying vec3 point;
  float hash(vec2 p){return fract(sin(dot(p,vec2(73.17,31.79)))*41791.27);}
  float noise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
  }
  float band(float x,float width){return 1.-smoothstep(width,width+max(.028,fwidth(x)),abs(x));}
  void main(){
    vec2 uv=point.xz;
    vec2 d=uv-vec2(8.5,6.5);
    float r=length(d), a=atan(d.y,d.x), t=clock;
    float s1=sin(uv.x*2.36+sin(uv.y*1.81+t*.78)+t*.84);
    float s2=sin(uv.y*3.17-uv.x*.62+sin(uv.x*.87-t*.94)-t*.80);
    float shallow=.5+.5*s1*s2;
    float chop=noise(uv*vec2(2.4,4.7)+vec2(t*.50,t*-.87));
    float cut=band(s1+s2+(chop-.5)*.59,.013);
    vec3 view=normalize(cameraPosition-point);
    vec3 n=normalize(vec3((chop-.5)*.43+.033*s1,1., .08*s2+.045*sin(uv.y*9.+t)));
    vec3 halfVector=normalize(view+normalize(vec3(-.55,.63,-.54)));
    float glimmer=pow(max(0.,dot(n,halfVector)),63.);
    float edge=pow(1.-max(0.,dot(n,view)),2.4);
    float side=min(abs(uv.x-2.33),abs(uv.x-14.69));
    float ghost=exp(-side*.70)*pow(max(0.,sin(uv.y*1.45+.21*s1)),6.);
    vec3 water=mix(vec3(.004,.029,.039),vec3(.015,.072,.078),shallow*.32+chop*.54);
    water+=vec3(.18,.088,.033)*ghost*(.22+.9*chop)+vec3(.007,.017,.015)*cut;
    water+=vec3(.14,.21,.19)*glimmer+vec3(.04,.095,.10)*edge;
    float retaining=exp(-min(abs(uv.x-7.0),abs(uv.x-10.0))*1.7);
    float bridgeShade=exp(-min(abs(uv.y-6.50),abs(uv.y-12.5))*.95);
    water*=1.-.39*max(retaining,bridgeShade);
    if(whirl>.5){
      float outer=smoothstep(1.9,4.8,r);
      float theta=a*5.+r*3.14+t*10.4+.22*sin(a*7.-r*1.73+t*1.31);
      float arm=.5+.5*cos(theta);
      float crest=smoothstep(.73,.96,arm)*outer;
      float serration=sin(a*27.+r*17.4+t*10.2)*.37+sin(a*11.-r*15.1+t*8.1)*.18;
      float foam=band(sin(theta+serration+(chop-.5)*.69),.21)*crest*(.23+.67*shallow);
      float torn=smoothstep(.54,.80,chop)*smoothstep(.65,.97,arm)*outer;
      float lines=band(sin(theta*2.0+r+.53*s1),.24)*crest;
      water=mix(vec3(.003,.027,.054),vec3(.007,.148,.177),shallow*.54+crest*.46);
      water+=vec3(.030,.133,.14)*lines+vec3(.17,.47,.43)*foam+vec3(.21,.44,.42)*torn+vec3(.08,.20,.19)*glimmer;
      float seal=band(r-4.91,.024)+.71*band(r-5.01,.012);
      water+=vec3(.015,.22,.195)*seal;
      gl_FragColor=vec4(water,.18+outer*.67);
    }else gl_FragColor=vec4(water,.96);
    #include <colorspace_fragment>
  }`;

const puddleVertex = `
  varying vec2 disk;
  void main(){disk=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const puddleFragment = `
  varying vec2 disk; uniform float clock;
  void main(){
    float a=atan(disk.y,disk.x);
    float r=length(disk);
    float edge=.79+.08*sin(a*3.+.7)+.056*sin(a*7.-.3)+.035*cos(a*11.);
    if(r>edge) discard;
    vec2 q=(disk-vec2(.11,-.13))*vec2(1.,.85);
    float ripple=pow(max(0.,cos(length(q)*35.-clock*3.)),16.)*exp(-length(q)*3.5);
    float glint=pow(max(0.,sin(disk.y*20.+disk.x*.14+sin(disk.x*4.8)*1.39)),17.);
    float rim=smoothstep(edge-.045,edge,r);
    vec3 ink=mix(vec3(.008,.035,.039),vec3(.032,.077,.077),.5+.5*sin(disk.x*5.-disk.y*2.));
    ink+=vec3(.019,.044,.039)*ripple+vec3(.044,.058,.048)*glint+vec3(.033,.049,.042)*rim;
    gl_FragColor=vec4(ink,.72-rim*.19);
    #include <colorspace_fragment>
  }`;

function sealSurface() {
  const points: number[] = [0, 0, 0],
    indices: number[] = [];
  const arcs = 96,
    bands = 12;
  for (let j = 1; j <= bands; j++)
    for (let i = 0; i < arcs; i++) {
      const a = (i * tau) / arcs,
        r = (j / bands) * 6.0;
      points.push(r * Math.cos(a), 0, r * Math.sin(a));
      const vertex = 1 + (j - 1) * arcs + i,
        next = 1 + (j - 1) * arcs + ((i + 1) % arcs);
      if (j === 1) indices.push(0, next, vertex);
      else indices.push(vertex - arcs, next, vertex, vertex - arcs, next - arcs, next);
    }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
  geometry.setIndex(indices);
  return geometry;
}

// Five sheets of water curl inward. Foam concentrates at the breaking lip and breaks into droplets.
function breakingCrests() {
  const points: number[] = [],
    colors: number[] = [],
    alpha: number[] = [],
    indices: number[] = [];
  for (let arm = 0; arm < 5; arm++) {
    const base = points.length / 3;
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const envelope = Math.pow(Math.max(0, Math.sin(t * Math.PI)), 0.78);
      const az = (tau * arm) / 5 + 0.95 * t + 0.1 * Math.sin(Math.PI * t);
      const radius = 5.49 - 1.4 * t;
      const height = (0.46 + 0.15 * Math.sin(t * 18 + arm)) * envelope;
      for (let band = 0; band <= 4; band++) {
        const f = band / 4;
        const r = radius + (0.17 * Math.sin(f * Math.PI) - f * 0.18) * envelope;
        points.push(Math.cos(az) * r, -0.87 + height * f, Math.sin(az) * r);
        const white = Math.max(0, (f - 0.66) * 3);
        colors.push(0.027 + 0.55 * white, 0.23 + 0.5 * white, 0.26 + 0.49 * white);
        alpha.push((0.22 + 0.47 * white) * envelope * (0.82 + 0.18 * Math.cos(t * 53 + arm * 13)));
        if (i && band) {
          const q = base + i * 5 + band;
          indices.push(q - 6, q - 5, q, q - 6, q, q - 1);
        }
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
  geometry.setAttribute('tint', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('coverage', new Float32BufferAttribute(alpha, 1));
  geometry.setIndex(indices);
  const material = new ShaderMaterial({
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    vertexShader: `attribute vec3 tint;attribute float coverage;varying vec4 foam;
      void main(){foam=vec4(tint,coverage);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec4 foam;void main(){gl_FragColor=foam;
      #include <colorspace_fragment>
    }`,
  });
  const wave = new Mesh(geometry, material);
  wave.renderOrder = 3;
  wave.position.set(8.5, 0, 6.5);
  return wave;
}

function sealRibbons() {
  const positions: number[] = [];
  const indices: number[] = [];
  const colors: number[] = [];
  for (let arm = 0; arm < 10; arm++) {
    const base = positions.length / 3;
    const thin = arm % 2 === 1;
    for (let n = 0; n <= 88; n++) {
      const t = n / 88;
      const r = (thin ? 3.2 : 3.75) + t * (thin ? 2.55 : 2.17);
      const angle =
        (Math.floor(arm / 2) * tau) / 5 - r * 0.626 + (thin ? 0.17 : 0) + 0.022 * Math.sin(t * 26 + arm * 9);
      const fade = Math.sin(t * Math.PI);
      const half = (thin ? 0.014 : 0.056) * fade * (0.69 + 0.31 * Math.sin(t * 24.1 + arm));
      const h = -0.67 + 0.122 * Math.sin(t * Math.PI * 2.1) + 0.045 * fade;
      for (const side of [-1, 1]) {
        positions.push(
          Math.cos(angle) * (r + half * side),
          h + half * side * 0.27,
          Math.sin(angle) * (r + half * side),
        );
        const v = (0.38 + 0.59 * fade) * (thin ? 0.72 : 1);
        colors.push(0.32 * v, 0.85 * v, 0.81 * v);
      }
      if (n) {
        const i = base + n * 2;
        indices.push(i - 2, i - 1, i, i, i - 1, i + 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  const material = new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    side: DoubleSide,
  });
  const mesh = new Mesh(geometry, material);
  mesh.position.set(8.5, 0, 6.5);
  mesh.renderOrder = 3;
  return mesh;
}

function wetFootfalls(puddles: Puddle[]) {
  const count = 12;
  const centers = new Float32Array(count * 12),
    corners: number[] = [],
    indices: number[] = [];
  const state = new Float32Array(count * 16);
  for (let i = 0; i < count; i++) {
    const q = i * 4;
    indices.push(q, q + 1, q + 2, q, q + 2, q + 3);
    corners.push(-1, -1, 1, -1, 1, 1, -1, 1);
    for (let j = 0; j < 4; j++) state[(q + j) * 4] = -1000;
  }
  const geometry = new BufferGeometry();
  const points = new Float32BufferAttribute(centers, 3);
  const timing = new Float32BufferAttribute(state, 4);
  geometry.setAttribute('position', points);
  geometry.setAttribute('corner', new Float32BufferAttribute(corners, 2));
  geometry.setAttribute('stepData', timing);
  geometry.setIndex(indices);
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: { now: { value: 0 } },
    vertexShader: `attribute vec2 corner;attribute vec4 stepData;varying vec2 mark;varying vec3 fade;uniform float now;
      void main(){
        mark=corner;
        float age=max(0.,now-stepData.x);
        bool ripple=stepData.z>.5;
        vec2 size=ripple?vec2(.41):vec2(.095,.156);
        vec2 q=corner*size;float c=cos(stepData.y),s=sin(stepData.y);
        vec3 p=position+vec3(c*q.x-s*q.y,0.,s*q.x+c*q.y);
        fade=vec3(age,stepData.z,stepData.w);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      }`,
    fragmentShader: `varying vec2 mark;varying vec3 fade;
      void main(){
        if(fade.y>.5){
          if(fade.x>.72)discard;
          float age=fade.x/.72,r=length(mark);
          float ring=1.-smoothstep(.023,.069,abs(r-.10-age*.81));
          gl_FragColor=vec4(.23,.42,.39,ring*(1.-age)*.62);
        }else{
          if(fade.x>4.5)discard;
          float toe=length(vec2(mark.x*1.19,(mark.y+.25)*1.56));
          float heel=length(vec2(mark.x*1.49,(mark.y-.49)*2.50));
          float print=1.-smoothstep(.82,1.02,min(toe,heel));
          gl_FragColor=vec4(.011,.031,.036,print*(1.-fade.x/4.5)*fade.z*.64);
        }
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  let write = 0,
    previous = -1,
    wet = 0,
    lastWet = -Infinity;
  function stamp(x: number, z: number, time: number, bearing: number, kind: number, strength: number) {
    const first = write * 4;
    write = (write + 1) % count;
    for (let n = first; n < first + 4; n++) {
      points.setXYZ(n, x, 0.029, z);
      timing.setXYZW(n, time, bearing, kind, strength);
    }
    points.needsUpdate = timing.needsUpdate = true;
  }
  return {
    mesh,
    update(frame: FortressInteriorFrame) {
      const now = frame.now / 1000;
      material.uniforms.now.value = now;
      const phase = frame.gaitPhase;
      if (phase === undefined || frame.reduced) {
        previous = -1;
        return;
      }
      const fraction = (phase * 2) % 1;
      const contact = fraction >= 0.43 && previous < 0.43;
      previous = fraction;
      if (!contact) return;
      const angle = { up: 0, down: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 }[frame.facing];
      const offset = phase >= 0.5 ? 0.103 : -0.103;
      const x = frame.x + Math.cos(angle) * offset,
        z = frame.y + Math.sin(angle) * offset;
      const inWater = puddles.some(p => {
        const dx = x - p.x,
          dz = z - p.z,
          c = Math.cos(p.angle),
          s = Math.sin(p.angle);
        return ((dx * c - dz * s) / p.w) ** 2 + ((dx * s + dz * c) / p.d) ** 2 < 0.7;
      });
      if (now - lastWet > 10) wet = 0;
      if (inWater) {
        stamp(x, z, now, 0, 1, 1);
        wet = 1;
        lastWet = now;
      } else if (wet > 0.1) {
        stamp(x, z, now, angle, 0, wet);
        wet *= 0.58;
      }
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

export function buildFortressWater(room: FortressRoom, puddles: Puddle[]) {
  const group = new Group();
  const clock = { value: 0 };
  const steps = wetFootfalls(puddles);
  group.add(steps.mesh);
  const seaMaterial = new ShaderMaterial({
    uniforms: { clock, whirl: { value: Number(room === 'seal') } },
    vertexShader: waterVertex,
    fragmentShader: waterFragment,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  const seaGeometry = room === 'seal' ? sealSurface() : new PlaneGeometry(13.5, 19.0).rotateX(-Math.PI / 2);
  const water = new Mesh(seaGeometry, seaMaterial);
  water.position.set(8.5, room === 'seal' ? -0.8 : -0.57, room === 'seal' ? 6.5 : 10);
  water.renderOrder = 2;
  group.add(water);
  const puddleMaterial = new ShaderMaterial({
    uniforms: { clock },
    vertexShader: puddleVertex,
    fragmentShader: puddleFragment,
    transparent: true,
    depthWrite: false,
  });
  const plane = new PlaneGeometry(2, 2);
  plane.rotateX(-Math.PI / 2);
  for (const p of puddles) {
    const patch = new Mesh(plane, puddleMaterial);
    patch.position.set(p.x, 0.022, p.z);
    patch.scale.set(p.w, 1, p.d);
    patch.rotation.y = p.angle;
    patch.renderOrder = 2;
    group.add(patch);
  }
  const ribbons = room === 'seal' ? sealRibbons() : undefined;
  if (ribbons) group.add(ribbons);
  const crests = room === 'seal' ? breakingCrests() : undefined;
  if (crests) group.add(crests);
  const sprayCount = room === 'seal' ? 74 : 28;
  const spray = new Float32Array(sprayCount * 3);
  const sprayGeometry = new BufferGeometry();
  const sprayPoints = new Float32BufferAttribute(spray, 3);
  sprayGeometry.setAttribute('position', sprayPoints);
  const drops = new ShaderMaterial({
    uniforms: {
      viewport: { value: new Vector2(1, 1) },
      color: { value: new Color(room === 'seal' ? 0x92ece3 : 0xafd7d2) },
      drop: { value: Number(room === 'sluice') },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: `uniform vec2 viewport;uniform float drop;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);
      gl_PointSize=clamp((drop>.5?.05:.07)*viewport.y/max(1.,-mv.z),1.15,4.2);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform vec3 color;uniform float drop;void main(){vec2 uv=gl_PointCoord-.5;uv.x*=1.+drop;float r=2.*length(uv);
      if(r>1.)discard;gl_FragColor=vec4(color,(1.-r)*.64);
      #include <colorspace_fragment>
    }`,
  });
  const particles = new Points(sprayGeometry, drops);
  particles.frustumCulled = false;
  particles.renderOrder = 4;
  group.add(particles);

  return {
    group,
    update(time: number, width: number, height: number, frame: FortressInteriorFrame) {
      steps.update(frame);
      clock.value = time;
      drops.uniforms.viewport.value.set(width, height);
      if (ribbons) ribbons.rotation.y = time * 2.08;
      if (crests) crests.rotation.y = time * 2.08;
      for (let i = 0; i < sprayCount; i++) {
        const life = (time * (room === 'seal' ? 0.68 : 0.58) + ((i * 0.61803399) % 1)) % 1;
        if (room === 'seal') {
          const r = 4.2 + (i % 11) * 0.138 + 0.13 * life;
          const angle = i * 2.39996 - r * 0.626 - time * 2.08 - life * 0.39;
          sprayPoints.setXYZ(
            i,
            8.5 + Math.cos(angle) * r,
            -0.71 + Math.sin(life * Math.PI) * (0.19 + (i % 6) * 0.042),
            6.5 + Math.sin(angle) * r,
          );
        } else {
          const x = (i % 2 ? 4.47 : 12.53) + 0.17 * Math.sin(i * 53);
          sprayPoints.setXYZ(i, x, 3.27 - life * life * 3.78, 4.5 + (i % 12) * 0.9 + 0.07 * Math.sin(i * 47));
        }
      }
      sprayPoints.needsUpdate = true;
    },
    dispose() {
      steps.dispose();
      seaGeometry.dispose();
      seaMaterial.dispose();
      plane.dispose();
      puddleMaterial.dispose();
      ribbons?.geometry.dispose();
      ribbons?.material.dispose();
      crests?.geometry.dispose();
      crests?.material.dispose();
      sprayGeometry.dispose();
      drops.dispose();
    },
  };
}
