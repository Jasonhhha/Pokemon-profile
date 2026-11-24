import { BufferGeometry, Float32BufferAttribute } from 'three';
const tau = Math.PI * 2;
const noise = (i: number) => {
  const n = Math.sin(i * 73.154 + 6.67) * 46725.341;
  return n - Math.floor(n);
};
export const iceHeight = (r: number, a: number) =>
  -0.637 + 0.015 * Math.sin(a * 7 + r * 2) * Math.min(1, r * 0.5) - 0.11 * Math.max(0, r - 4.75);

export function glacier() {
  const positions: number[] = [0, iceHeight(0, 0), 0],
    indices: number[] = [];
  const rows = 21,
    sides = 112;
  for (let j = 1; j <= rows; j++)
    for (let i = 0; i < sides; i++) {
      const r = (6.03 * j) / rows,
        a = (tau * i) / sides;
      positions.push(Math.sin(a) * r, iceHeight(r, a), Math.cos(a) * r);
      const k = 1 + (j - 1) * sides + i,
        next = 1 + (j - 1) * sides + ((i + 1) % sides);
      if (j === 1) indices.push(0, k, next);
      else indices.push(k - sides, k, next, k - sides, next, next - sides);
    }
  const shape = new BufferGeometry();
  shape.setAttribute('position', new Float32BufferAttribute(positions, 3));
  shape.setIndex(indices);
  shape.computeVertexNormals();
  return shape;
}

export function faultLines() {
  const positions: number[] = [],
    tints: number[] = [];
  function segment(ax: number, az: number, bx: number, bz: number, width: number, value: number) {
    const len = Math.hypot(bx - ax, bz - az) || 1,
      nx = ((bz - az) / len) * width,
      nz = ((ax - bx) / len) * width;
    for (const [x, z, s] of [
      [ax, az, -1],
      [bx, bz, -1],
      [ax, az, 1],
      [bx, bz, -1],
      [bx, bz, 1],
      [ax, az, 1],
    ]) {
      const u = x + nx * s,
        v = z + nz * s,
        r = Math.hypot(u, v),
        a = Math.atan2(u, v);
      positions.push(u, iceHeight(r, a) + 0.008, v);
      tints.push(0.18 * value, 0.48 * value, 0.62 * value);
    }
  }
  for (let i = 0; i < 21; i++) {
    const az = i * 2.39996;
    let r = 1.15 + noise(i) * 2.0,
      x = r * Math.sin(az),
      z = r * Math.cos(az);
    for (let j = 0; j < 9; j++) {
      r += 0.33 + noise(i * 7 + j) * 0.18;
      if (r > 5.97) break;
      const a = az + (noise(i * 11 + j * 7) - 0.5) * 0.07;
      const bx = Math.sin(a) * r,
        bz = Math.cos(a) * r;
      segment(x, z, bx, bz, 0.008 + (0.008 * j) / 9, 0.55 + j * 0.042);
      if (j === 3 || j === 6) {
        const turn = a + (noise(i * 7 + j) > 0.5 ? 0.69 : -0.69);
        segment(x, z, x + Math.sin(turn) * 0.67, z + Math.cos(turn) * 0.67, 0.006, 0.55);
      }
      x = bx;
      z = bz;
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new Float32BufferAttribute(tints, 3));
  return g;
}

export function glacialHeightAt(x: number, z: number) {
  const dx = x - 8.5,
    dz = z - 6.5;
  return iceHeight(Math.hypot(dx, dz), Math.atan2(dx, dz));
}
export const floorVertex = `varying vec3 p;void main(){vec4 world=modelMatrix*vec4(position,1.);p=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`;
export const floorFragment = `uniform float age;uniform float reduced;uniform vec3 impactAt;varying vec3 p;
float hash(vec2 x){return fract(sin(dot(x,vec2(91.71,23.64)))*41357.84);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
void main(){
  vec2 q=p.xz-vec2(8.5,6.5);float r=length(q);
  float grain=noise2(q*1.15)+.41*noise2(q*4.2);
  float vein=pow(max(0.,cos(q.x*2.7+q.y*3.3+2.34*noise2(q*.62))),17.);
  float silt=pow(max(0.,sin(q.y*22.+1.8*sin(q.x*2.)+grain*5.)),18.);
  float rim=smoothstep(3.8,5.7,r);
  float snow=pow(max(0.,sin(q.x*.73+q.y*.45+2.41*grain)),6.)*rim;
  vec3 ice=mix(vec3(.009,.039,.073),vec3(.077,.198,.24),grain*.52+rim*.13);
  ice+=vec3(.070,.095,.10)*snow;
  ice+=vec3(.035,.090,.110)*vein*.57+vec3(.013,.026,.025)*silt;
  vec3 v=normalize(cameraPosition-p),n=normalize(vec3(.07*(grain-.7),1.,.023*sin(q.y*3.+grain)));
  float spec=pow(max(0.,dot(n,normalize(v+normalize(vec3(-.4,.55,-.7))))),40.);
  ice+=vec3(.091,.18,.21)*spec;
  float hit=max(0.,age-.78);float distanceFromHit=length(p.xz-impactAt.xz);
  float wave=exp(-pow((distanceFromHit-hit*6.4)*3.4,2.))*exp(-hit*1.4)*step(.78,age)*(1.-reduced);
  ice+=vec3(.08,.22,.28)*wave;
  gl_FragColor=vec4(ice,1.);
  #include <colorspace_fragment>
}`;
