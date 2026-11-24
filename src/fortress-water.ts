import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  PlaneGeometry,
  Points,
  Path,
  Shape,
  ShapeGeometry,
  ShaderMaterial,
  Vector2,
} from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import type { FortressRoom, FortressInteriorFrame } from './field-fortress-state';

type Puddle = { x: number; z: number; w: number; d: number; angle: number };

const waterVertex = `
  varying vec3 point;

  void main(){
    vec4 p=modelMatrix*vec4(position,1.);
    point=p.xyz;
    gl_Position=projectionMatrix*viewMatrix*p;
  }`;

const waterFragment = `
  uniform float clock;
  varying vec3 point;
  float hash(vec2 p){return fract(sin(dot(p,vec2(73.17,31.79)))*41791.27);}
  float noise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
  }
  float band(float x,float width){return 1.-smoothstep(width,width+max(.028,fwidth(x)),abs(x));}
  void main(){
    vec2 uv=point.xz;
    float t=clock;
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
    gl_FragColor=vec4(water,.38+.17*chop);
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

function cisternSurface() {
  const outline = new Shape();
  outline.moveTo(-21, -21);
  outline.lineTo(-21, 21);
  outline.lineTo(21, 21);
  outline.lineTo(21, -21);
  outline.closePath();
  // The open stair trench drops below the surrounding reservoir's waterline.
  const trench = new Path();
  trench.moveTo(-1.64, -1.15);
  trench.lineTo(1.64, -1.15);
  trench.lineTo(1.64, 8.9);
  trench.lineTo(-1.64, 8.9);
  trench.closePath();
  outline.holes.push(trench);
  return new ShapeGeometry(outline);
}

export function buildFortressWater(room: FortressRoom, puddles: Puddle[]) {
  const group = new Group();
  const clock = { value: 0 };
  const steps = wetFootfalls(puddles);
  group.add(steps.mesh);
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
  if (room !== 'sluice')
    return {
      group,
      update(time: number, _width: number, _height: number, frame: FortressInteriorFrame) {
        steps.update(frame);
        clock.value = time;
      },
      dispose() {
        steps.dispose();
        plane.dispose();
        puddleMaterial.dispose();
      },
    };
  const seaMaterial = new ShaderMaterial({
    uniforms: { clock },
    vertexShader: waterVertex,
    fragmentShader: waterFragment,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  const seaGeometry = cisternSurface().rotateX(-Math.PI / 2);
  const water = new Mesh(seaGeometry, seaMaterial);
  water.position.set(8.5, -0.57, 2);
  water.renderOrder = 2;
  group.add(water);
  // One small planar capture reflects the real column grid and arches across the shallow upper cistern.
  const mirrorGeometry = cisternSurface();
  const mirror = new Reflector(mirrorGeometry, {
    color: 0xa7b9a7,
    clipBias: 0.002,
    textureWidth: 448,
    textureHeight: 288,
    multisample: 0,
  });
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.set(8.5, -0.585, 2);
  const material = mirror.material as ShaderMaterial;
  material.onBeforeCompile = shader => {
    shader.uniforms.waterTime = clock;
    shader.fragmentShader =
      'uniform float waterTime;\n' +
      shader.fragmentShader.replace(
        'vec4 base = texture2DProj( tDiffuse, vUv );',
        `
      vec2 q=vUv.xy/vUv.w;
      q.x+=.0013*sin(q.y*158.+waterTime*1.12)+.00050*sin(q.y*478.-waterTime*.8);
      q.y+=.00046*sin(q.x*120.+waterTime);
      vec4 base=texture2D(tDiffuse,q);
    `,
      );
  };
  const capture = mirror.onBeforeRender.bind(mirror);
  mirror.onBeforeRender = (...args) => {
    water.visible = false;
    try {
      capture(...args);
    } finally {
      water.visible = true;
    }
  };
  group.add(mirror);
  const sprayCount = 28;
  const spray = new Float32Array(sprayCount * 3);
  const sprayGeometry = new BufferGeometry();
  const sprayPoints = new Float32BufferAttribute(spray, 3);
  sprayGeometry.setAttribute('position', sprayPoints);
  const drops = new ShaderMaterial({
    uniforms: {
      viewport: { value: new Vector2(1, 1) },
      color: { value: new Color(0xafd7d2) },
      drop: { value: 1 },
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
      for (let i = 0; i < sprayCount; i++) {
        const life = (time * 0.58 + ((i * 0.61803399) % 1)) % 1;
        const x = (i % 2 ? 4.47 : 12.53) + 0.17 * Math.sin(i * 53);
        sprayPoints.setXYZ(i, x, 3.27 - life * life * 3.78, 4.5 + (i % 12) * 0.9 + 0.07 * Math.sin(i * 47));
      }
      sprayPoints.needsUpdate = true;
    },
    dispose() {
      steps.dispose();
      mirror.dispose();
      mirrorGeometry.dispose();
      seaGeometry.dispose();
      seaMaterial.dispose();
      plane.dispose();
      puddleMaterial.dispose();
      sprayGeometry.dispose();
      drops.dispose();
    },
  };
}
