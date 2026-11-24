import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry } from 'three';
import type { GridReading } from './fortress-power';
import { wallFaces, wallPulse } from './fortress-wall-walk';

export function buildWallPassage() {
  const group = new Group();
  group.name = 'West bridge, descending ramparts and lower royal gate';
  for (const lit of [false,true]) {
    const positions: number[]=[], colors: number[]=[];
    const shade = new Color();
    for(const face of wallFaces()){
      if(Boolean(face.light)!==lit)continue;
      shade.set(face.color);
      for(let i=1;i<face.vertices.length-1;i++)for(const p of [face.vertices[0],face.vertices[i],face.vertices[i+1]]){
        positions.push(p.x,p.y,p.z);colors.push(shade.r,shade.g,shade.b);
      }
    }
    const geometry=new BufferGeometry();
    geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
    geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
    geometry.computeVertexNormals();geometry.computeBoundingSphere();
    const material=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:lit?.46:.83,emissive:lit?0x3b8885:0,emissiveIntensity:lit?.7:0});
    const mesh=new Mesh(geometry,material);mesh.castShadow=!lit;mesh.receiveShadow=true;group.add(mesh);
  }
  const glow=new MeshBasicMaterial({color:0xa7f6e8});
  const packets=new InstancedMesh(new SphereGeometry(.085,6,4),glow,10);
  packets.frustumCulled=false;
  group.add(packets);
  const translation=new Matrix4();
  return { group, update(power:GridReading) {
    glow.color.setRGB(.12+.48*power.bus,.15+1.02*power.bus,.15+.86*power.bus);
    for(let i=0;i<10;i++){
      const p=wallPulse(i,power.phase);
      packets.setMatrixAt(i,translation.makeTranslation(p.x,p.y,p.z));
    }
    packets.instanceMatrix.needsUpdate=true;
  }};
}
