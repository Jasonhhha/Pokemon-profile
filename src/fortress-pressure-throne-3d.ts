import { BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial } from 'three';
import { createGovernorDrive, governorPose, pressAxis, pressureThroneGeometry, thronePalette, type ThroneFace } from './fortress-pressure-throne';

export function createPressureThrone() {
  const stone = new MeshStandardMaterial({ vertexColors: true, roughness: .80, metalness: .14 });
  const bronze = new MeshStandardMaterial({ vertexColors: true, roughness: .49, metalness: .52 });
  for (const finish of [stone, bronze]) {
    const metal = finish === bronze;
    finish.customProgramCacheKey = () => metal ? 'wet-patinated-casting' : 'cut-basalt-press';
    finish.onBeforeCompile = shader => {
      shader.vertexShader = 'varying vec3 pressLocal; varying vec3 pressWorld;\n' + shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\npressLocal=position;pressWorld=(modelMatrix*vec4(position,1.)).xyz;');
      shader.fragmentShader = `varying vec3 pressLocal; varying vec3 pressWorld;
        float foundryNoise(vec3 v){
          vec3 cell=floor(v);vec3 f=fract(v);f=f*f*(3.-2.*f);
          vec3 h=vec3(1.,31.,119.);float n=dot(cell,h);
          vec4 corners=n+vec4(0.,1.,31.,32.);
          vec4 lo=fract(sin(corners)*43758.5453),hi=fract(sin(corners+119.)*43758.5453);
          vec4 z=mix(lo,hi,f.z);return mix(mix(z.x,z.y,f.x),mix(z.z,z.w,f.x),f.y);
        }
      ` + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float broad=foundryNoise(pressLocal*vec3(2.3,1.4,2.0));
        float pores=foundryNoise(pressLocal*vec3(${metal ? '19.,8.,17.' : '8.,19.,11.'}));
        float damp=1.-smoothstep(-.13,.94,pressWorld.y);
        diffuseColor.rgb*=.91+.11*broad+.07*pores-.10*damp;
        ${metal ? 'float oxide=smoothstep(.54,.86,broad+.13*pores);diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.72,1.13,1.09),oxide*.56);'
          : 'float bedding=sin(pressLocal.y*30.+broad*5.)*.5+.5;diffuseColor.rgb*=.97+.055*bedding;'}
      `).replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+.11*(pores-.5)-damp*.13,.23,.94);');
    };
  }
  const tones = Object.fromEntries(Object.entries(thronePalette).map(([key, hex]) => [key, new Color(hex)]));
  const build = (name: string, panels: ThroneFace[]) => {
    const group = new Group();
    group.name = name;
    for (const material of [stone, bronze]) {
      const vertices: number[] = [], colors: number[] = [], normals: number[] = [];
      for (const surface of panels) {
        const metal = surface.finish === 'bronze' || surface.finish === 'rubbedBronze' || surface.finish === 'patina';
        if (metal !== (material === bronze)) continue;
        const color = tones[surface.finish];
        for (let i = 1; i < surface.points.length - 1; i++) {
          for (const p of [surface.points[0], surface.points[i], surface.points[i + 1]]) {
            vertices.push(...p); normals.push(...surface.normal); colors.push(color.r, color.g, color.b);
          }
        }
      }
      if (!vertices.length) continue;
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
      geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
      geometry.computeBoundingSphere();
      const mesh = new Mesh(geometry, material);
      mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  };
  const { pressureCheeks, lowerGovernor, upperGovernor } = pressureThroneGeometry();
  const root = build('Seal press · cast ribs, bearings and outlet liner', pressureCheeks);
  const lower = build('Suspended six-part governor', lowerGovernor);
  const upper = build('Counter-rotating bronze governor', upperGovernor);
  root.add(lower, upper);
  const drive = createGovernorDrive();
  return {
    root,
    update(now: number, load: number, reduced: boolean) {
      const motion = drive(now, load, reduced);
      for (const ring of [lower, upper]) {
        const pose = governorPose(motion.phase, motion.lift, ring === upper);
        ring.position.set(pressAxis.x, pose.elevation, pressAxis.z);
        ring.rotation.y = pose.angle;
      }
    },
    dispose() {
      root.traverse(object => { if (object instanceof Mesh) object.geometry.dispose(); });
      stone.dispose(); bronze.dispose();
    },
  };
}
