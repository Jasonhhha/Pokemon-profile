import { BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial } from 'three';
import type { FortressInteriorFrame } from './field-fortress-state';
import { createFrostCloud, frostParticleLimit } from './fortress-frost-contact';

export function createFrostFootfalls() {
  const count = frostParticleLimit;
  const clouds = createFrostCloud();
  const starts = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) starts[i * 4 + 3] = -100;
  const origins = new Float32BufferAttribute(new Float32Array(count * 3), 3);
  const flight = new Float32BufferAttribute(starts, 4);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', origins);
  geometry.setAttribute('flight', flight);
  const kind = new Float32BufferAttribute(new Float32Array(count), 1);
  geometry.setAttribute('frostCloud', kind);
  geometry.setDrawRange(0, 0);
  const material = new ShaderMaterial({
    depthWrite: false,
    transparent: true,
    uniforms: { clock: { value: 0 }, viewport: { value: 1 } },
    vertexShader: `
      uniform float clock,viewport; attribute vec4 flight; attribute float frostCloud;
      varying float mist,fade;
      void main(){
        mist=frostCloud;
        float age=max(0.,clock-flight.w),life=mix(.34,.68,mist);
        fade=max(0.,1.-age/life);
        vec3 p=position+flight.xyz*age;
        p.y=mix(max(.028,p.y-2.35*age*age),p.y+age*age*.09,mist);
        vec4 eye=modelViewMatrix*vec4(p,1.);
        float diameter=mix(.043+.012*fade,.19+.33*age,mist);
        gl_PointSize=clamp(diameter*viewport/max(.1,-eye.z),1.35,26.)*ceil(fade);
        gl_Position=projectionMatrix*eye;
      }`,
    fragmentShader: `
      varying float mist,fade;
      void main(){
        vec2 q=2.*gl_PointCoord-1.;
        float fog=exp(-3.3*dot(q,q))*(1.-smoothstep(.43,1.,length(q)));
        float chip=1.-smoothstep(.68,.94,abs(q.x*.83)+abs(q.y*1.17));
        float alpha=mix(.65*chip,.16*fog,mist)*fade;
        if(alpha<.003)discard;
        gl_FragColor=vec4(mix(vec3(.52,.76,.83),vec3(.38,.63,.70),mist),alpha);
        #include <colorspace_fragment>
      }`,
  });
  const mist = new Points(geometry, material);
  mist.frustumCulled = false;
  mist.renderOrder = 5;
  return {
    mesh: mist,
    update(frame: FortressInteriorFrame, height: number) {
      if (clouds.advance(frame)) {
        clouds.particles.forEach((p, i) => {
          origins.setXYZ(i, p.x, p.y, p.z);
          flight.setXYZW(i, p.vx, p.vy, p.vz, p.at);
          kind.setX(i, Number(p.mist));
        });
        origins.needsUpdate = flight.needsUpdate = kind.needsUpdate = true;
        geometry.setDrawRange(0, clouds.particles.length);
      }
      mist.visible = clouds.particles.length > 0;
      material.uniforms.clock.value = frame.now * 0.001;
      material.uniforms.viewport.value = height;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
