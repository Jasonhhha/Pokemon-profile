import { Group, Mesh, type Object3D } from 'three';
import { ringPosition } from './field-ring-coordinates';

export { RING_PERIOD, RING_CENTER_X, ringAngle, ringRadius, ringPosition, ringCoordinates, ringXDelta, wrapRingX } from './field-ring-coordinates';

export function bendCityGeometry(source: Object3D) {
  source.updateWorldMatrix(true, true);
  const group = new Group();
  group.name = source.name;
  group.userData = { ...source.userData };
  source.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const geometry = object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    const vertices = geometry.getAttribute('position');
    if (!vertices) return;
    for (let index = 0; index < vertices.count; index++) {
      const next = ringPosition(vertices.getX(index), vertices.getZ(index));
      vertices.setXYZ(index, next.x, vertices.getY(index), next.z);
    }
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, object.material);
    mesh.name = object.name;
    mesh.castShadow = object.castShadow;
    mesh.receiveShadow = object.receiveShadow;
    mesh.visible = object.visible;
    mesh.renderOrder = object.renderOrder;
    group.add(mesh);
  });
  return group;
}
