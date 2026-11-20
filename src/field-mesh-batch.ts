import { Group, Mesh, type BufferGeometry, type Material, type Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function batchStaticMeshes(source: Object3D, castsShadow: boolean | ((material: Material) => boolean)) {
  const surfaces = new Map<Material, BufferGeometry[]>();
  source.updateMatrixWorld(true);
  source.traverse(object => {
    if (!(object instanceof Mesh) || Array.isArray(object.material)) return;
    const shape = object.geometry as BufferGeometry;
    const geometry = (shape.index ? shape.toNonIndexed() : shape.clone()).applyMatrix4(object.matrixWorld);
    const existing = surfaces.get(object.material);
    if (existing) existing.push(geometry);
    else surfaces.set(object.material, [geometry]);
  });

  const group = new Group();
  for (const [material, pieces] of surfaces) {
    const geometry = pieces.length === 1 ? pieces[0] : mergeGeometries(pieces);
    if (pieces.length > 1) pieces.forEach(piece => piece.dispose());
    if (!geometry) continue;
    const model = new Mesh(geometry, material);
    model.castShadow = typeof castsShadow === 'function' ? castsShadow(material) : castsShadow;
    model.receiveShadow = true;
    group.add(model);
  }
  return group;
}
