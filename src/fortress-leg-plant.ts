import { Bone, Quaternion, Vector3 } from 'three';

// Two-link inverse kinematics retains the authored knee's bend plane and the orientation of the claws.
export function createLegPlant(hip: Bone, knee: Bone, ankle: Bone) {
  const h = new Vector3(),
    k = new Vector3(),
    a = new Vector3(),
    goal = new Vector3(),
    desiredKnee = new Vector3();
  const along = new Vector3(),
    bend = new Vector3(),
    before = new Vector3(),
    after = new Vector3();
  const swing = new Quaternion(),
    parent = new Quaternion(),
    rotation = new Quaternion(),
    ankleRest = new Quaternion();
  function setWorldRotation(bone: Bone, q: Quaternion) {
    bone.parent!.getWorldQuaternion(parent);
    bone.quaternion.copy(parent.invert()).multiply(q);
    bone.updateWorldMatrix(false, true);
  }
  function aim(bone: Bone, start: Vector3, oldEnd: Vector3, newEnd: Vector3) {
    before.subVectors(oldEnd, start).normalize();
    after.subVectors(newEnd, start).normalize();
    swing.setFromUnitVectors(before, after);
    bone.getWorldQuaternion(rotation);
    rotation.premultiply(swing);
    setWorldRotation(bone, rotation);
  }
  return (drop: number) => {
    if (Math.abs(drop) < 0.0005) return;
    hip.getWorldPosition(h);
    knee.getWorldPosition(k);
    ankle.getWorldPosition(a);
    ankle.getWorldQuaternion(ankleRest);
    goal.copy(a);
    goal.y -= drop;
    const upper = h.distanceTo(k),
      lower = k.distanceTo(a);
    along.subVectors(goal, h).normalize();
    const reach = Math.min(upper + lower - 0.0001, goal.distanceTo(h));
    goal.copy(h).addScaledVector(along, reach);
    bend.subVectors(k, h);
    bend.addScaledVector(along, -bend.dot(along)).normalize();
    const projected = (upper * upper + reach * reach - lower * lower) / (2 * reach);
    desiredKnee
      .copy(h)
      .addScaledVector(along, projected)
      .addScaledVector(bend, Math.sqrt(Math.max(0, upper * upper - projected * projected)));
    aim(hip, h, k, desiredKnee);
    knee.getWorldPosition(k);
    ankle.getWorldPosition(a);
    aim(knee, k, a, goal);
    setWorldRotation(ankle, ankleRest);
  };
}
