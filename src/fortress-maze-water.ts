import {
  BufferGeometry,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  LinearFilter,
  Mesh,
  PlaneGeometry,
  RedFormat,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
} from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mazeFloors, type MazeRoom } from './fortress-maze';

export type Outfall = { x: number; y: number; z: number; dx: number; dz: number; width: number; reach: number };

export function outfalls(sources: Outfall[]) {
  const positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  for (const { x, y, z, dx, dz, width, reach } of sources) {
    const start = positions.length / 3;
    for (let row = 0; row <= 14; row++)
      for (let col = 0; col <= 6; col++) {
        const t = row / 14,
          u = col / 6 - 0.5;
        const shoulder = 1 - Math.pow(2 * Math.abs(u), 2.2) * 0.11;
        const forward = Math.sin(t * 1.24) * reach * shoulder;
        const w = (1 + 0.32 * t) * width * u;
        positions.push(x + dx * forward + dz * w, y - (y + 0.326) * Math.pow(t, 1.7), z + dz * forward - dx * w);
        uv.push(u + 0.5, t);
        if (row < 14 && col < 6) {
          const v = start + row * 7 + col;
          indices.push(v, v + 7, v + 8, v, v + 8, v + 1);
        }
      }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  const material = new ShaderMaterial({
    uniforms: { clock: { value: 0 } },
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    vertexShader: `varying vec2 fall;varying vec3 world;uniform float clock;
      void main(){fall=uv;world=position;
        vec3 p=position;p.y+=.012*sin(uv.x*69.+uv.y*20.-clock*10.+p.x*2.)*uv.y;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `varying vec2 fall;varying vec3 world;uniform float clock;
      float hash(vec2 p){return fract(sin(dot(p,vec2(19.1,75.6)))*41328.113);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0)),f.x),mix(hash(i+vec2(0,1.)),hash(i+1.),f.x),f.y);}
      void main(){
        float id=world.x*.21+world.z*.29;
        float v=n(vec2(fall.x*15.+id,fall.y*2.-clock*4.45));
        float seam=smoothstep(.52,.88,v);
        float lace=n(vec2(fall.x*42.+id,fall.y*11.-clock*6.6));
        float air=smoothstep(.06,.97,fall.y)*(.44+.56*lace);
        float rim=smoothstep(.34,.5,abs(fall.x-.5));
        float white=clamp(seam*.77+air*.49+rim*.17+.19*lace*lace,0.,1.);
        vec3 c=mix(vec3(.026,.21,.226),vec3(.68,.85,.79),white);
        float alpha=mix(.45,.87,white)*smoothstep(0.,.044,min(fall.x,1.-fall.x));
        gl_FragColor=vec4(c,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  return new Mesh(geometry, material);
}

export function channelSurface(room: MazeRoom) {
  const { width, height, tiles } = mazeFloors[room],
    frost = room === 'catacomb';
  const edges: { x: number; y: number; dx: number; dy: number }[] = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const t = tiles[y][x];
      if (!['channel', 'bridge', 'gate'].includes(t)) continue;
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const adjacent = tiles[y + dy]?.[x + dx];
        if (adjacent && ['channel', 'bridge', 'gate'].includes(adjacent)) continue;
        edges.push({ x: x + (dx === 1 ? 1 : 0), y: y + (dy === 1 ? 1 : 0), dx: Math.abs(dy), dy: Math.abs(dx) });
      }
    }
  const res = 144,
    distances = new Uint8Array(res * res);
  for (let j = 0; j < res; j++)
    for (let i = 0; i < res; i++) {
      const x = ((i + 0.5) * width) / res,
        z = ((j + 0.5) * height) / res;
      let sq = 5.76;
      for (const edge of edges) {
        const dx = x - edge.x,
          dz = z - edge.y;
        const along = Math.max(0, Math.min(1, dx * edge.dx + dz * edge.dy));
        const a = dx - along * edge.dx,
          b = dz - along * edge.dy;
        sq = Math.min(sq, a * a + b * b);
      }
      distances[j * res + i] = Math.round((Math.sqrt(sq) * 255) / 2.4);
    }
  const shore = new DataTexture(distances, res, res, RedFormat);
  shore.minFilter = shore.magFilter = LinearFilter;
  shore.needsUpdate = true;
  const shader = new ShaderMaterial({
    transparent: !frost,
    depthWrite: frost,
    defines: { FROZEN_BED: Number(frost) },
    uniforms: {
      clock: { value: 0 },
      wheel: { value: new Vector2() },
      shore: { value: shore },
      release: { value: Array.from({ length: 4 }, () => new Vector2(-60, -60)) },
      wake: { value: Array.from({ length: 4 }, () => new Vector4(0, 0, 5, 0)) },
    },
    vertexShader: `varying vec3 surface;void main(){
      surface=(modelMatrix*vec4(position,1.)).xyz;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
    }`,
    fragmentShader: `varying vec3 surface;uniform float clock;uniform sampler2D shore;uniform vec2 release[4],wheel;uniform vec4 wake[4];
      float hash(vec2 p){return fract(sin(dot(p,vec2(23.7,79.2)))*47214.74);}
      float noise(vec2 p){vec2 i=floor(p),v=fract(p);v=v*v*(3.-2.*v);
        return mix(mix(hash(i),hash(i+vec2(1,0)),v.x),mix(hash(i+vec2(0,1)),hash(i+1.),v.x),v.y);}
      void main(){
        vec2 p=surface.xz;float bank=texture2D(shore,p/23.).r*2.4;
        #if FROZEN_BED == 1
          vec2 slate=p*vec2(.72,1.03)+vec2(.52*noise(p*.47),.43*noise(p*.63));
          vec2 cell=floor(slate),within=fract(slate); float nearest=6.,second=6.;
          for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
            vec2 tile=vec2(float(i),float(j)),seed=cell+tile;
            vec2 site=.12+.76*vec2(hash(seed),hash(seed+vec2(3.7,19.)));
            vec2 delta=tile+site-within;float sq=dot(delta,delta);
            if(sq<nearest){second=nearest;nearest=sq;}else second=min(second,sq);
          }
          float line=sqrt(second)-sqrt(nearest);
          float fissure=(1.-smoothstep(.003,.039,line))*(.18+.82*noise(p*1.54));
          float frostVeil=noise(p*vec2(.52,.33)+vec2(clock*.018,0.))*.63+noise(p*1.21)*.37;
          vec3 ravine=mix(vec3(.008,.017,.029),vec3(.033,.061,.082),smoothstep(.31,.77,frostVeil));
          ravine*=.57+.43*smoothstep(.025,.71,bank);
          ravine+=vec3(.030,.061,.084)*fissure;
          gl_FragColor=vec4(ravine,1.);
        #else
        float t=clock;
        float swell=p.y*3.22+p.x*.97-t*.91+sin(p.x*1.98-p.y*.82)*.71;
        float cross=p.x*5.9-p.y*3.24+t*1.45+sin(p.x*2.3+p.y)*1.7;
        float cap=p.y*16.3+p.x*4.12-t*3.5+2.8*noise(p*1.86);
        vec2 slope=cos(swell)*vec2(.022,.065)+cos(cross)*vec2(.064,-.039)+cos(cap)*vec2(.009,.033);
        vec3 n=normalize(vec3(-slope.x,1.,-slope.y)), eye=normalize(cameraPosition-surface);
        vec3 halfRay=normalize(eye+normalize(vec3(-.42,.80,-.33)));
        float glint=pow(max(0.,dot(n,halfRay)),64.);
        float fresco=pow(1.-dot(n,eye),2.2);
        float deep=smoothstep(.05,1.6,bank);
        vec3 base=mix(vec3(.035,.163,.151),vec3(.012,.074,.087),deep);
        base*=.84+.20*noise(p*.57);
        float mark=sin(p.x*8.4+sin(p.y*3.8+t*.58)+t*.49)+sin(p.y*7.5+sin(p.x*4.7-t*.67));
        float caustic=(1.-smoothstep(.05,.23,abs(mark)))*(.16+.84*noise(p*2.3))*(1.-.81*deep);
        float crest=smoothstep(.88,.997,.5+.5*cos(cap))*smoothstep(.55,.82,noise(p*1.42+vec2(t*.18,0)));
        float contact=(1.-smoothstep(.01,.069,abs(bank-.073-.016*sin(swell))))*(.35+.65*noise(p*8.));
        vec3 water=base+vec3(.10,.17,.15)*(caustic*.10+crest*.17+contact*.43)+vec3(.13,.21,.20)*(glint*.69+fresco);
        water*=.61+.39*smoothstep(.0,.22,bank);
          float froth=0.;
          vec2 race=p-wheel;
          for(int side=0;side<2;side++){
            vec2 dist=race-vec2(side==1?.63:-.63,0.);
            float r=length(dist*vec2(1.,1.25));
            froth+=.19*exp(-r*2.75)*(.5+.5*cos(r*23.-t*3.9+.67*noise(p*5.)))*smoothstep(.0,.20,r);
          }
          for(int i=0;i<4;i++){
            vec2 delta=(p-release[i])*vec2(1.,1.22);
            float radius=length(delta);
            float ring=smoothstep(.55,.97,.5+.5*cos(26.*radius-3.7*t+noise(delta*7.)*1.7));
            froth+=exp(-radius*5.1)*(.48+.77*noise(p*28.+t))+.29*ring*exp(-radius*1.96);
          }
          water+=vec3(.46,.57,.53)*min(.83,froth);
          for(int i=0;i<4;i++){
            float age=wake[i].z;
            float radius=length(p-wake[i].xy);
            float travel=radius-age*.91-.035;
            float pulse=exp(-travel*travel*145.)*cos(travel*52.);
            float tail=max(0.,1.-age/1.22)*wake[i].w;
            water+=vec3(.11,.18,.17)*pulse*tail*.65;
          }
        gl_FragColor=vec4(water,.53+.13*(1.-deep));
        #endif
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new Mesh(new PlaneGeometry(width, height), shader);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(width / 2, frost ? -1.12 : -0.33, height / 2);
  mesh.renderOrder = 2;
  return mesh;
}

export function cisternMirror(channel: ReturnType<typeof channelSurface>, clock: () => number) {
  const { width, height } = mazeFloors.aqueduct;
  const mirror = new Reflector(new PlaneGeometry(width, height), {
    color: 0x9db4a8,
    clipBias: 0.002,
    textureWidth: 384,
    textureHeight: 240,
    multisample: 0,
  });
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.set(width * 0.5, -0.34, height * 0.5);
  const optics = mirror.material as ShaderMaterial;
  optics.onBeforeCompile = (shader) => {
    shader.uniforms.current = channel.material.uniforms.clock;
    shader.fragmentShader =
      'uniform float current;\n' +
      shader.fragmentShader.replace(
        'vec4 base = texture2DProj( tDiffuse, vUv );',
        `
        vec2 q=vUv.xy/vUv.w;
        q.x+=.0019*sin(q.y*130.+current*1.1)+.00070*sin(q.y*320.-current*.87);
        q.y+=.00080*sin(q.x*122.+q.y*55.+current);
        vec4 base=texture2D(tDiffuse,q);
      `,
      );
  };
  const capture = mirror.onBeforeRender.bind(mirror),
    lastEye = new Vector3(Infinity, 0, Infinity);
  let lastCapture = -Infinity,
    lastAspect = -1;
  mirror.onBeforeRender = (...args) => {
    const tick = clock(),
      eye = args[2].position;
    const moved = lastEye.distanceToSquared(eye),
      aspect = args[2].projectionMatrix.elements[0];
    if (lastAspect === aspect && moved < 0.09 && tick >= lastCapture && tick - lastCapture < (moved > 0.003 ? 48 : 145))
      return;
    channel.visible = false;
    try {
      capture(...args);
      lastCapture = tick;
      lastEye.copy(eye);
      lastAspect = aspect;
    } finally {
      channel.visible = true;
    }
  };
  return mirror;
}
