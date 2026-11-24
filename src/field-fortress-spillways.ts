import {
  Color, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, PlaneGeometry, ShaderMaterial, Vector3,
} from 'three';
import { fortressLiftDepth, type FortressView } from './field-fortress-state';

const tau = Math.PI * 2;
const noise = `
  float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.545); }
  float noise(vec2 p) {
    vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);
  }
`;
const stages = [
  { y: -3.46, lip: 1.41, width: 3.96, reach: 2.22, next: -10.77 },
  { y: -10.76, lip: 3.98, width: 5.02, reach: 2.83, next: -15.01 },
  { y: -15.02, lip: 7.05, width: 6.13, reach: 5.96, next: -23.0 },
];

export function maritimeSky() {
  const mat = new ShaderMaterial({
    depthWrite: false, depthTest: false, uniforms: { night: { value: 0 } },
    vertexShader: `varying vec3 direction;
      void main(){
        vec3 ray=vec3(position.x/projectionMatrix[0][0],position.y/projectionMatrix[1][1],-1.);
        direction=vec3(dot(viewMatrix[0].xyz,ray),dot(viewMatrix[1].xyz,ray),dot(viewMatrix[2].xyz,ray));
        gl_Position=vec4(position.xy,.99999,1.);
      }`,
    fragmentShader: `varying vec3 direction; uniform float night;
      ${noise}
      void main(){
        vec3 d=normalize(direction);float y=max(0.,d.y);
        vec2 p=d.xz/(.13+.7*y)*1.45+vec2(5.1,26.);
        float n=noise(p*.76)*.53+noise(p*1.94)*.28+noise(p*5.1)*.13+noise(p*13.)*.06;
        float cloud=smoothstep(.46,.73,n)*smoothstep(.0,.17,y);
        vec3 horizon=mix(vec3(.358,.491,.566),vec3(.071,.11,.15),night);
        vec3 sky=mix(vec3(.18,.38,.54),vec3(.017,.038,.093),night);
        vec3 c=mix(horizon,sky,1.-exp(-y*3.3));
        c=mix(c,mix(vec3(.79,.81,.74),vec3(.12,.18,.25),night),cloud*.76);
        gl_FragColor=vec4(c,1.);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new Mesh(new PlaneGeometry(2, 2), mat);
  sky.name = 'Maritime horizon'; sky.renderOrder = -150; sky.frustumCulled = false; sky.visible = false;
  return sky;
}

function smooth(x: number, a: number, b: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function buildSpillways(radius: number, west: number) {
  const group = new Group(), crest = new PlaneGeometry(2, 1, 58, 39), quad = new PlaneGeometry(1, 1);
  const time = { value: 0 }, night = { value: 0 };
  const foam = new ShaderMaterial({
    transparent: true, depthWrite: false, side: DoubleSide,
    uniforms: { clock: time, night },
    vertexShader: `varying vec2 p; varying float strength;
      void main(){ p=uv*2.-1.; strength=instanceColor.r;
        gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec2 p; varying float strength; uniform float clock,night;
      ${noise}
      void main(){
        float r=length(p), a=atan(p.y,p.x);
        float turbulence=noise(p*6.+clock*.57)*.41+noise(p*14.-clock*.83)*.27+noise(p*36.+clock*.65)*.19;
        float phase=r+.075*sin(5.*a+clock*.8)+.13*turbulence;
        float ring=smoothstep(.60,.98,.5+.5*cos(phase*41.-clock*4.7));
        float body=(1.-smoothstep(.23,.67,phase))*(.42+turbulence);
        float ripples=ring*(.25+.71*turbulence)*(1.-smoothstep(.42,.99,r));
        if(r>1.)discard;
        vec3 hue=mix(vec3(.63,.83,.83),vec3(.22,.46,.53),night);
        gl_FragColor=vec4(hue,min(.93,(body+.64*ripples)*strength));
        #include <colorspace_fragment>
      }`,
  });
  const aerosol = new ShaderMaterial({
    transparent: true, depthWrite: false, side: DoubleSide, uniforms: { clock: time, night },
    vertexShader: `varying vec2 p; varying float seed; varying float alpha;
      void main(){p=uv*2.-1.; seed=instanceColor.g; alpha=instanceColor.r;
        vec4 eye=viewMatrix*modelMatrix*vec4(instanceMatrix[3].xyz,1.);
        eye.xy+=position.xy*vec2(instanceMatrix[0][0],instanceMatrix[1][1]);
        gl_Position=projectionMatrix*eye; }`,
    fragmentShader: `varying vec2 p; varying float seed; varying float alpha; uniform float clock,night;
      ${noise}
      void main(){
        float bulk=1.-length(p)+.25*(noise(p*4.+seed)-.5);
        float w=smoothstep(.00,.60,bulk)*(.43+.54*noise(p*3.+vec2(seed,-clock*.33)));
        vec3 tint=mix(vec3(.64,.86,.86),vec3(.23,.46,.54),night);
        gl_FragColor=vec4(tint,alpha*w);
        #include <colorspace_fragment>
      }`,
  });
  const fallShader = stages.map(stage => new ShaderMaterial({
    transparent: true, depthWrite: false, side: DoubleSide,
    uniforms: { clock: time, night, width: { value: stage.width }, drop: { value: 0 }, reach: { value: 1 }, pressure: { value: 1 }, sea: { value: 0 } },
    vertexShader: `
      uniform float clock,width,drop,reach,pressure;
      varying vec2 surface; varying float phase; varying float level;
      void main() {
        float t=1.-uv.y, x=position.x;
        phase=instanceMatrix[3].x*.457 + instanceMatrix[3].z*.71;
        float pleat=sin(x*16.+phase+sin(t*10.-clock*3.6)*.48)+.38*sin(x*26.+t*7.+clock*.67);
        float crown=1.-x*x;
        float fan=1.+(.15+.16*pressure)*t*t+.055*t*sin(phase+t*9.-clock*2.);
        float along=reach*t*(.71+.29*crown)+pleat*(.018+.048*t)+.064*t*sin(t*14.-clock*5.+phase);
        float eccentric=.09*sin(t*7.+phase-clock*.46)*t;
        float h=-drop*t*t+.055*pleat*t;
        vec4 world=modelMatrix*instanceMatrix*vec4((x+eccentric)*width*.5*fan*(.47+.53*pressure),h,along,1.);
        surface=vec2(x,t);level=world.y;gl_Position=projectionMatrix*viewMatrix*world;
      }`,
    fragmentShader: `
      uniform float clock,pressure,night,sea;
      varying vec2 surface;varying float phase;varying float level;
      ${noise}
      void main(){
        if(level<sea-.08)discard;
        float x=surface.x,t=surface.y; vec2 q=vec2(x*9.+phase,t*7.-clock*3.3);
        vec2 curl=vec2(noise(q*.47)-.5,noise(q.yx*.61+47.)-.5);
        float roll=noise(q*.61+curl)*.46+noise(q*1.67+curl*3.)*.32+noise(q*4.5)*.22;
        float threads=noise(vec2(x*45.+phase+3.8*curl.x,t*4.1-clock*2.3));
        float torn=1.-(.075+.27*t)*(.33+.67*noise(q*.54+curl))-.06*t*threads;
        float gap=smoothstep(.65,.86,roll)*smoothstep(.52,.92,abs(x))*t;
        float edge=(1.-smoothstep(torn-.065,torn,abs(x)))*(1.-.74*gap);
        float froth=smoothstep(.52,.85,roll+.18*threads+.18*t);
        float rill=sin(x*22.+phase+roll*5.6)*.07+.10*(1.-t);
        vec3 deep=mix(vec3(.025,.205,.245),vec3(.010,.094,.16),night);
        vec3 jade=mix(vec3(.16,.49,.52),vec3(.052,.235,.33),night);
        vec3 pearl=mix(vec3(.74,.89,.87),vec3(.32,.60,.66),night);
        vec3 hue=mix(mix(deep,jade,clamp(.29+threads*.65+rill,0.,1.)),pearl,froth*(.52+.42*t));
        gl_FragColor=vec4(hue,edge*(.88+.09*pressure)*(1.-.035*froth));
        #include <colorspace_fragment>
      }`,
  }));
  const angle = Array.from({ length: 8 }, (_, i) => west + Math.PI / 8 + i * tau / 8);
  const position = new Vector3(), m = new Matrix4(), ground = new Matrix4().makeRotationX(-Math.PI / 2);
  const variation = new Color();
  const banks = stages.map((stage, j) => {
    const water = new InstancedMesh(crest, fallShader[j], 8), splash = new InstancedMesh(quad, foam, 8);
    const mist = new InstancedMesh(quad, aerosol, 8 * 15);
    for (const [i, a] of angle.entries()) {
      m.makeRotationY(a).setPosition(Math.sin(a) * (radius + stage.lip), stage.y, Math.cos(a) * (radius + stage.lip));
      water.setMatrixAt(i, m);
    }
    water.frustumCulled = splash.frustumCulled = mist.frustumCulled = false;
    water.renderOrder = 4; splash.renderOrder = 3; mist.renderOrder = 5;
    group.add(water, splash, mist);
    return { water, splash, mist };
  });
  return {
    group,
    update(seconds: number, state: FortressView, darkness: number) {
      const sea = -.58 - fortressLiftDepth * state.lift;
      const force = (1 - smooth(state.drain, .44, .985));
      group.visible = state.cinematic && state.lift > .10 && force > .024;
      if (!group.visible) return;
      time.value = seconds; night.value = darkness;
      stages.forEach((stage, j) => {
        const { water, splash, mist } = banks[j], available = stage.y - sea;
        const power = smooth(available, -.08, 1.48) * force;
        water.visible = splash.visible = mist.visible = power > .017;
        if (!water.visible) return;
        const planned = stage.y - stage.next;
        const drop = j === 2 ? Math.max(.02, available) : Math.max(.02, Math.min(available, planned));
        const reach = stage.reach * Math.sqrt(drop / planned) * (.61 + .39 * power), impact = stage.y - drop;
        const uniforms = fallShader[j].uniforms;
        uniforms.sea.value = sea; uniforms.drop.value = drop; uniforms.reach.value = reach; uniforms.pressure.value = power;
        angle.forEach((a, i) => {
          const s = Math.sin(a), c = Math.cos(a), r = radius + stage.lip + reach;
          const width = (stage.width + 1.7) * (j === 2 ? 2.04 : 1.08) * (.54 + power * .46);
          const length = (j === 2 ? 12.0 : 5.1) * (.44 + .56 * power);
          m.makeRotationY(a).multiply(ground).scale(position.set(width, length, 1)).setPosition(s * r, impact + .10, c * r);
          splash.setMatrixAt(i, m);
          splash.setColorAt(i, variation.setRGB(power, 0, 0));
          for (let k = 0; k < 15; k++) {
            const seed = i * .713 + k * .618 + j * .337, life = (seconds * (.34 + (k % 4) * .062) + seed) % 1;
            const tangent = Math.sin(k * 19.73 + i * 3.61) * (stage.width * .46 + life * .78);
            const spread = (j === 2 ? 2.95 : 1.30) * life * (.42 + (k % 5) * .20) * power;
            const lowSpray = k % 3 !== 0;
            const mistHeight = (j === 2 ? 4.75 : 2.3) * (lowSpray ? .44 : 1);
            const lift = life * (1 - life * .33) * mistHeight * power;
            const size = (.75 + (k % 4) * .275 + life * 1.55) * (j === 2 ? 1.40 : .85) * power;
            m.makeScale(size * (lowSpray ? 1.71 : 1.31), size * (lowSpray ? .69 : 1), 1);
            m.setPosition(s * (r + spread) + c * tangent, impact + .18 + lift, c * (r + spread) - s * tangent);
            const opacity = (.23 + .05 * (k % 3)) * Math.sin(Math.PI * life) * power;
            const index = i * 15 + k;
            mist.setMatrixAt(index, m);
            mist.setColorAt(index, variation.setRGB(opacity, 1 + seed, 0));
          }
        });
        splash.instanceMatrix.needsUpdate = mist.instanceMatrix.needsUpdate = true;
        splash.instanceColor!.needsUpdate = mist.instanceColor!.needsUpdate = true;
      });
    },
    dispose() {
      crest.dispose(); quad.dispose(); foam.dispose(); aerosol.dispose(); fallShader.forEach(m => m.dispose());
      banks.forEach(({ water, splash, mist }) => { water.dispose(); splash.dispose(); mist.dispose(); });
    },
  };
}
