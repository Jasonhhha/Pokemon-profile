import {
  AdditiveBlending,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  Quaternion,
  ShaderMaterial,
  TorusGeometry,
  Vector3,
} from 'three';

const tau = Math.PI * 2;
const noise = (n: number) => {
  const x = Math.sin(n * 271.97 + 1.37) * 47523.75;
  return x - Math.floor(x);
};

// The rounded shoulder follows a three-and-a-half-power superellipse. The collar stays fixed and the
// wider springing of the vault gives the dragon's asymmetrical wing enough overhead clearance.
export const wardCurveGLSL = `vec3 wardPoint(vec3 n){
  float h=max(0.,n.y),r=length(n.xz);
  return n/pow(max(.0001,pow(r,3.5)+pow(h,3.5)),1./3.5);
}`;
export function onWard(direction: Vector3, out: Vector3) {
  const r = Math.hypot(direction.x, direction.z),
    h = Math.max(0, direction.y);
  return out.copy(direction).divideScalar((r ** 3.5 + h ** 3.5) ** (1 / 3.5));
}

// Keep the field continuous while softer foreground glare lets the eye and jaw silhouette read through it.
export const wardGlareGLSL = `uniform vec3 eyeLine;
float facialTransmission(vec3 worldPt){
  vec3 sight=normalize(worldPt-cameraPosition);
  float d=length(cross(eyeLine-cameraPosition,sight));
  return mix(.43,1.,smoothstep(.24,.88,d));
}`;

export function buildWardResponse(center: Vector3, dimensions: Vector3, contact: Vector3, eyeLine: { value: Vector3 }) {
  const root = new Group(),
    shell = new Group();
  shell.position.copy(center);
  shell.scale.copy(dimensions);
  root.add(shell);
  const tangent = new Vector3(0, 1, 0).cross(contact).normalize(),
    bitangent = contact.clone().cross(tangent).normalize();
  const age = { value: 8 },
    gentle = { value: 0 };
  const rippleShader = new ShaderMaterial({
    uniforms: {
      age,
      gentle,
      eyeLine,
      strike: { value: contact },
      tangent: { value: tangent },
      bitangent: { value: bitangent },
    },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    vertexShader: `attribute vec3 front;uniform vec3 strike,tangent,bitangent;uniform float age,gentle;
      varying float signAcross;varying float elevation;varying float intensity;
      ${wardCurveGLSL}
      ${wardGlareGLSL}
      void main(){
        float t=age-.78-front.z*.094;
        float radius=max(0.,t*(3.85-front.z*.34));float phi=front.x;
        float fade=smoothstep(0.,.055,t)*(1.-smoothstep(.56,1.05,t))*exp(-max(0.,t)*1.31);
        radius=mix(radius,.27, gentle);fade*=1.-gentle;
        float arc=radius+front.y*(.012+.014*radius);
        vec3 vector=normalize(strike*cos(arc)+(tangent*cos(phi)+bitangent*sin(phi))*sin(arc));
        elevation=vector.y;signAcross=front.y;intensity=fade*(1.-front.z*.40);
        float kink=.013*exp(-max(0.,t)*3.)*sin(phi*5.+t*12.);
        vec4 world=modelMatrix*vec4(wardPoint(vector)*(1.008+kink),1.);
        intensity*=facialTransmission(world.xyz);gl_Position=projectionMatrix*viewMatrix*world;
      }`,
    fragmentShader: `varying float elevation,signAcross,intensity;void main(){
      float alpha=max(0.,1.-abs(signAcross))*intensity*smoothstep(0.,.035,elevation);
      if(alpha<.015)discard;gl_FragColor=vec4(.42,.88,1.,alpha*.82);
      #include <colorspace_fragment>
    }`,
  });
  const coords: number[] = [],
    indices: number[] = [],
    zeros: number[] = [];
  for (let ring = 0; ring < 2; ring++) {
    const start = coords.length / 3;
    for (let i = 0; i <= 128; i++)
      for (let edge = 0; edge < 3; edge++) {
        coords.push((tau * i) / 128, edge - 1, ring);
        zeros.push(0, 0, 0);
        const q = start + i * 3 + edge;
        if (i && edge) indices.push(q - 4, q - 3, q, q - 4, q, q - 1);
      }
  }
  const rippleShape = new BufferGeometry();
  rippleShape.setAttribute('position', new Float32BufferAttribute(zeros, 3));
  rippleShape.setAttribute('front', new Float32BufferAttribute(coords, 3));
  rippleShape.setIndex(indices);
  const ring = new Mesh(rippleShape, rippleShader);
  ring.renderOrder = 7;
  ring.frustumCulled = false;
  shell.add(ring);

  // Fractures follow the same rounded surface as the glass.
  const traces: number[] = [],
    timings: number[] = [],
    edgeDirections: number[] = [];
  function spherical(u: number, v: number) {
    const a = Math.hypot(u, v),
      s = a ? Math.sin(a) / a : 1;
    return contact
      .clone()
      .multiplyScalar(Math.cos(a))
      .addScaledVector(tangent, u * s)
      .addScaledVector(bitangent, v * s)
      .normalize();
  }
  function traceSegment(ax: number, ay: number, bx: number, by: number, w: number, seed: number) {
    const len = Math.hypot(bx - ax, by - ay) || 1,
      px = ((by - ay) * w) / len,
      py = ((ax - bx) * w) / len;
    for (const [x, y, side] of [
      [ax, ay, -1],
      [bx, by, -1],
      [ax, ay, 1],
      [bx, by, -1],
      [bx, by, 1],
      [ax, ay, 1],
    ]) {
      const d = spherical(x + side * px, y + side * py);
      const pos = onWard(d, new Vector3());
      traces.push(pos.x * 1.01, pos.y * 1.01, pos.z * 1.01);
      timings.push(Math.hypot(x, y), seed, d.y);
      edgeDirections.push(side);
    }
  }
  for (let branch = 0; branch < 14; branch++) {
    const phase = branch * 2.39996,
      length = 0.2 + noise(branch + 11) * 0.39,
      segments = 7;
    let ax = 0,
      ay = 0;
    for (let j = 1; j <= segments; j++) {
      const a = phase + (noise(branch * 31 + j * 17) - 0.5) * 0.2,
        r = (length * j) / segments;
      const bx = Math.sin(a) * r,
        by = Math.cos(a) * r;
      traceSegment(ax, ay, bx, by, 0.0028 * (1 - (0.63 * j) / segments), noise(branch));
      if (j === 3 || j === 5) {
        const s = a + (noise(branch * 17 + j) > 0.5 ? 0.54 : -0.65),
          extension = 0.046 + 0.046 * noise(j * branch + 32);
        traceSegment(bx, by, bx + extension * Math.sin(s), by + extension * Math.cos(s), 0.00165, noise(branch));
      }
      ax = bx;
      ay = by;
    }
  }
  const scars = new BufferGeometry();
  scars.setAttribute('position', new Float32BufferAttribute(traces, 3));
  scars.setAttribute('timing', new Float32BufferAttribute(timings, 3));
  scars.setAttribute('edgeSide', new Float32BufferAttribute(edgeDirections, 1));
  const stressPaint = new ShaderMaterial({
    uniforms: { age, gentle, eyeLine },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    vertexShader: `attribute vec3 timing;attribute float edgeSide;varying vec3 token;varying float across,transmission;
      ${wardGlareGLSL}
      void main(){token=timing;across=edgeSide;vec4 world=modelMatrix*vec4(position,1.);transmission=facialTransmission(world.xyz);gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader: `uniform float age,gentle;varying vec3 token;varying float across,transmission;void main(){
      float t=age-.78-token.x*.56;float develop=smoothstep(0.,.045,t);
      float fade=1.-smoothstep(.42+token.y*.25,1.43+token.y*.32,t);
      float alpha=develop*fade*(1.-gentle)*(1.-.46*abs(across))*transmission;
      if(alpha<.012||token.z<.014)discard;gl_FragColor=vec4(.57,.88,.93,alpha*.89);
      #include <colorspace_fragment>
    }`,
  });
  const hairline = new Mesh(scars, stressPaint);
  hairline.renderOrder = 7;
  shell.add(hairline);
  const windShape = new TorusGeometry(1, 0.048, 6, 56, Math.PI * 1.76);
  const fronts = Array.from({ length: 3 }, () => {
    const shader = new ShaderMaterial({
      uniforms: { amount: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: `varying vec3 point;void main(){point=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float amount;varying vec3 point;void main(){
        float a=atan(point.y,point.x);float shape=.47+.53*pow(.5+.5*cos(a*3.12+.29),2.);
        gl_FragColor=vec4(.57,.82,.85,amount*shape);
        #include <colorspace_fragment>
      }`,
    });
    const wave = new Mesh(windShape, shader);
    wave.renderOrder = 4;
    root.add(wave);
    return wave;
  });
  const zAxis = new Vector3(0, 0, 1),
    direction = new Vector3(),
    rotation = new Quaternion();
  const impact = onWard(contact, new Vector3()).multiply(dimensions).add(center);
  return {
    root,
    update(roarAge: number, reduced: boolean, source: Vector3) {
      age.value = roarAge;
      gentle.value = Number(reduced);
      shell.visible = !reduced && roarAge >= 0.77 && roarAge < 2.56;
      direction.subVectors(impact, source).normalize();
      rotation.setFromUnitVectors(zAxis, direction);
      fronts.forEach((wave, i) => {
        const life = (roarAge - 0.44 - i * 0.155) / (0.345 + i * 0.047);
        wave.visible = !reduced && life > 0 && life < 1;
        if (!wave.visible) return;
        wave.position.lerpVectors(source, impact, life);
        wave.quaternion.copy(rotation);
        wave.rotateZ(i * 2.3 + 0.56 * life);
        const r = 0.069 + 0.36 * Math.pow(life, 0.83);
        wave.scale.set(r, r * (0.88 + 0.05 * i), r * 0.56);
        wave.material.uniforms.amount.value = 0.57 * Math.sin(life * Math.PI);
      });
    },
    dispose() {
      for (const geometry of [windShape, scars, rippleShape]) geometry.dispose();
      stressPaint.dispose();
      rippleShader.dispose();
      for (const wave of fronts) wave.material.dispose();
    },
  };
}
