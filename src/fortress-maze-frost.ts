import { BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial } from 'three';
import type { FortressInteriorFrame } from './field-fortress-state';
import { mazeFloors } from './fortress-maze';

export function createFrostFootfalls() {
  const count = 18;
  const starts = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) starts[i * 4 + 3] = -100;
  const origins = new Float32BufferAttribute(new Float32Array(count * 3), 3);
  const flight = new Float32BufferAttribute(starts, 4);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', origins);
  geometry.setAttribute('flight', flight);
  geometry.setAttribute(
    'frostCloud',
    new Float32BufferAttribute(
      Array.from({ length: count }, (_, i) => Number(i % 3 === 0)),
      1,
    ),
  );
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
  let next = 0,
    lastPhase = -1,
    lastFoot = -1,
    lastEvent = -Infinity,
    lastFrame = -Infinity;
  return {
    mesh: mist,
    update(frame: FortressInteriorFrame, height: number) {
      const now = frame.now * 0.001;
      const cut = now < lastFrame || now - lastFrame > 0.35;
      lastFrame = now;
      if (cut || frame.reduced) {
        lastEvent = -Infinity;
        lastPhase = lastFoot = -1;
        mist.visible = false;
        for (let i = 0; i < count; i++) flight.setW(i, -100);
        flight.needsUpdate = true;
        if (frame.reduced) return;
      }
      material.uniforms.clock.value = now;
      material.uniforms.viewport.value = height;
      const phase = frame.gaitPhase;
      const fraction = phase === undefined ? -1 : (phase * 2) % 1;
      const foot = phase === undefined ? -1 : Number(phase >= 0.5);
      // The puff is released at sole contact, once per stride half, only on exposed ice.
      if (phase !== undefined && fraction >= 0.43 && (foot !== lastFoot || lastPhase < 0.43) && now - lastEvent > 0.1) {
        const bearing = { up: 0, down: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 }[frame.facing];
        const offset = phase < 0.5 ? -0.11 : 0.11;
        const x = frame.x + Math.cos(bearing) * offset,
          z = frame.y + Math.sin(bearing) * offset;
        if (mazeFloors.catacomb.tiles[Math.floor(z)]?.[Math.floor(x)] === 'ice') {
          lastEvent = now;
          for (let n = 0; n < 3; n++) {
            const id = next;
            next = (next + 1) % count;
            const cloud = n === 0,
              angle = bearing + (n - 1) * 0.58 + 0.19 * Math.sin(id * 7.9);
            const speed = cloud ? 0.25 : 0.42 + 0.13 * Math.sin(id);
            origins.setXYZ(id, x, cloud ? 0.094 : 0.043, z);
            flight.setXYZW(
              id,
              -speed * Math.sin(angle),
              cloud ? 0.053 : 0.48 + 0.11 * Math.sin(id * 4.6),
              speed * Math.cos(angle),
              now,
            );
          }
          origins.needsUpdate = flight.needsUpdate = true;
        }
      }
      lastPhase = fraction;
      lastFoot = foot;
      mist.visible = now - lastEvent < 0.7;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
