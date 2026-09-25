import { Object3D, Quaternion, Vector3 } from "three";

const from = new Vector3();
const to = new Vector3();
const worldQ = new Quaternion();
const parentQ = new Quaternion();
const deltaQ = new Quaternion();
const dirN = new Vector3();
const rootPos = new Vector3();
const midPos = new Vector3();
const endPos = new Vector3();
const dir = new Vector3();
const bend = new Vector3();
const joint = new Vector3();

/** Turn a bone so its world rotation matches `world`. */
export function setWorldQuaternion(bone: Object3D, world: Quaternion) {
  const parent = bone.parent;
  if (!parent) {
    bone.quaternion.copy(world);
    return;
  }
  parent.updateWorldMatrix(true, false);
  parent.getWorldQuaternion(parentQ);
  bone.quaternion.copy(parentQ.invert()).multiply(world);
  bone.updateMatrixWorld(true);
}

/** Point the bone-to-child direction at `direction` (world, any length). */
export function aimBone(bone: Object3D, child: Object3D, direction: Vector3) {
  bone.updateWorldMatrix(true, false);
  bone.getWorldPosition(from);
  child.getWorldPosition(to);
  to.sub(from);
  if (to.lengthSq() < 1e-10 || direction.lengthSq() < 1e-10) return;
  to.normalize();
  dirN.copy(direction).normalize();
  bone.getWorldQuaternion(worldQ);
  deltaQ.setFromUnitVectors(to, dirN);
  deltaQ.multiply(worldQ);
  setWorldQuaternion(bone, deltaQ);
}

/**
 * Analytic two-bone IK. Pins `end` on `target` and bends `mid` toward `pole`.
 * Lengths come from the current pose. Law of cosines, same idea as the Little Polygon two-bone note.
 */
export function solveTwoBone(root: Object3D, mid: Object3D, end: Object3D, target: Vector3, pole: Vector3) {
  root.updateWorldMatrix(true, true);
  root.getWorldPosition(rootPos);
  mid.getWorldPosition(midPos);
  end.getWorldPosition(endPos);
  const upper = Math.max(1e-4, rootPos.distanceTo(midPos));
  const lower = Math.max(1e-4, midPos.distanceTo(endPos));
  dir.subVectors(target, rootPos);
  const reach = dir.length();
  if (reach < 1e-6) return;
  const limited = Math.min(upper + lower - 1e-4, Math.max(Math.abs(upper - lower) + 1e-4, reach));
  dir.multiplyScalar(1 / reach);

  const along = (upper * upper - lower * lower + limited * limited) / (2 * limited);
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  bend.subVectors(pole, rootPos);
  bend.addScaledVector(dir, -bend.dot(dir));
  if (bend.lengthSq() < 1e-8) bend.set(0, 0, 1);
  bend.normalize();
  joint.copy(rootPos).addScaledVector(dir, along).addScaledVector(bend, height);

  aimBone(root, mid, joint.sub(rootPos));
  mid.updateWorldMatrix(true, true);
  mid.getWorldPosition(midPos);
  const planted = rootPos.addScaledVector(dir, limited);
  const want = planted.clone().sub(midPos);
  aimBone(mid, end, want);
}
