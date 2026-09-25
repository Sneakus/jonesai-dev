import type { AnimationAction, Line, Mesh, Object3D, PerspectiveCamera } from "three";
import { LoopOnce, Matrix4, Quaternion, Vector3 } from "three";
import type { FlightPoint, FlightResult } from "./flight";
import { rangeSettings as range } from "./settings";

export type FlightHold = {
  shot: FlightResult;
  born: number;
  reported: boolean;
};

const yard = range.yardToMetre;

export const ballSpot = { x: range.ball[0], y: range.ball[1], z: range.ball[2] };

const down = new Vector3();
const shaftUp = new Vector3(0, 1, 0);
const worldGrip = new Vector3();
const worldQuat = new Quaternion();
const worldMatrix = new Matrix4();
const parentInverse = new Matrix4();

/** Line the club up once, in the lead hand, so the shaft passes through both hands. */
export function fitClub(club: Object3D, leftBone: Object3D, rightBone: Object3D) {
  const left = new Vector3();
  const right = new Vector3();
  leftBone.getWorldPosition(left);
  rightBone.getWorldPosition(right);
  down.set(0, 1, 0).transformDirection(leftBone.matrixWorld);
  if (down.y > 0) down.negate();
  if (down.lengthSq() < 1e-8) down.subVectors(right, left);
  if (down.lengthSq() < 1e-8) down.set(0, -1, 0);
  down.normalize();
  worldGrip.copy(left).addScaledVector(down, -range.gripOffset);
  worldQuat.setFromUnitVectors(shaftUp, down);
  worldMatrix.compose(worldGrip, worldQuat, shaftUp.clone().set(1, 1, 1));
  parentInverse.copy(leftBone.matrixWorld).invert();
  club.matrix.copy(parentInverse.multiply(worldMatrix));
  club.matrix.decompose(club.position, club.quaternion, club.scale);
  if (club.parent !== leftBone) leftBone.add(club);
  club.updateMatrixWorld(true);
}

export function clubheadPosition(club: Object3D, target: Vector3) {
  target.set(0, range.gripLength + range.shaftLength, 0);
  club.localToWorld(target);
  return target;
}

/** Distance from a hand to the grip, in metres. */
export function gripGap(club: Object3D, hand: Vector3) {
  const top = new Vector3(0, 0, 0);
  const end = new Vector3(0, range.gripLength, 0);
  club.localToWorld(top);
  club.localToWorld(end);
  const along = end.sub(top);
  const lengthSq = along.lengthSq();
  if (lengthSq < 1e-8) return hand.distanceTo(top);
  const t = Math.min(1, Math.max(0, hand.clone().sub(top).dot(along) / lengthSq));
  return hand.distanceTo(top.clone().addScaledVector(along, t));
}

export function findBone(root: Object3D, end: string): Object3D | undefined {
  let found: Object3D | undefined;
  root.traverse((node) => {
    const name = node.name.replace(/[:|]/g, "");
    const at = name.length - end.length;
    if (at >= 0 && name.endsWith(end) && (at === 0 || !/[A-Za-z]/.test(name.charAt(at - 1)))) found = node;
  });
  return found;
}

export function stature(root: Object3D): number {
  const names = ["LeftToe_End", "LeftFoot", "LeftLeg", "LeftUpLeg", "Hips", "Spine", "Spine1", "Spine2", "Neck", "Head"];
  let total = 0.12;
  let previous: Vector3 | null = null;
  const point = new Vector3();
  for (const name of names) {
    const bone = findBone(root, name);
    if (!bone) continue;
    bone.getWorldPosition(point);
    if (previous) total += point.distanceTo(previous);
    previous = point.clone();
  }
  return total;
}

export function soleHeight(root: Object3D): number {
  let minY = Infinity;
  const point = new Vector3();
  for (const name of ["LeftToe_End", "RightToe_End", "LeftToeBase", "RightToeBase", "LeftFoot", "RightFoot"]) {
    const bone = findBone(root, name);
    if (!bone) continue;
    bone.getWorldPosition(point);
    minY = Math.min(minY, point.y);
  }
  return Number.isFinite(minY) ? minY : 0;
}

function worldPos(bone: Object3D | undefined, target: Vector3): Vector3 {
  bone?.getWorldPosition(target);
  return target;
}

/** Face +x, plant the feet at address, and put the impact clubhead on the ball. Once. */
export function placeRig(rig: Object3D, model: Object3D, action: AnimationAction, club: Object3D) {
  rig.position.set(0, 0, 0);
  rig.rotation.set(0, 0, 0);
  rig.updateMatrixWorld(true);
  holdFrame(action, 0);
  model.updateMatrixWorld(true);
  const leftShoulder = findBone(model, "LeftShoulder") ?? findBone(model, "LeftArm");
  const rightShoulder = findBone(model, "RightShoulder") ?? findBone(model, "RightArm");
  const left = new Vector3();
  const right = new Vector3();
  worldPos(leftShoulder, left);
  worldPos(rightShoulder, right);
  const leftDir = left.sub(right);
  leftDir.y = 0;
  if (leftDir.lengthSq() < 1e-8) leftDir.set(0, 0, -1);
  leftDir.normalize();
  rig.rotation.y = Math.atan2(leftDir.x, -leftDir.z);
  rig.updateMatrixWorld(true);
  holdFrame(action, 0);
  model.updateMatrixWorld(true);

  const leftHand = findBone(model, "LeftHand");
  const rightHand = findBone(model, "RightHand");
  if (leftHand && rightHand) fitClub(club, leftHand, rightHand);

  holdFrame(action, range.impactTime);
  model.updateMatrixWorld(true);
  const head = new Vector3();
  clubheadPosition(club, head);
  rig.position.x += ballSpot.x - head.x;
  rig.position.z += ballSpot.z - head.z;
  rig.updateMatrixWorld(true);

  holdFrame(action, 0);
  model.updateMatrixWorld(true);
  const feet = soleHeight(model);
  rig.position.y += -feet;
  rig.updateMatrixWorld(true);

  return { yaw: rig.rotation.y, position: rig.position.clone() };
}

export function holdFrame(action: AnimationAction, time: number) {
  action.enabled = true;
  action.paused = false;
  action.play();
  action.getMixer().setTime(time);
  action.paused = true;
}

export function scrubFrame(action: AnimationAction, fraction: number) {
  const clip = action.getClip();
  holdFrame(action, fraction * (clip?.duration || 1));
}

export function armClip(action: AnimationAction, play: boolean) {
  action.reset();
  action.setLoop(LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  if (!play) {
    action.paused = true;
    action.time = 0;
  }
}

export function landingTime(points: FlightPoint[]): number {
  let airborne = false;
  for (const point of points) {
    if (point.z > 0.4) airborne = true;
    if (airborne && point.z < 0.08) return point.t;
  }
  return points[points.length - 1]?.t ?? 0;
}

function pointAt(points: FlightPoint[], time: number): FlightPoint {
  if (points.length === 0) return { t: 0, x: 0, y: 0, z: 0 };
  if (time <= points[0].t) return points[0];
  const last = points[points.length - 1];
  if (time >= last.t) return last;
  for (let i = 1; i < points.length; i += 1) {
    const next = points[i];
    const prev = points[i - 1];
    if (time <= next.t) {
      const span = next.t - prev.t || 1;
      const mix = (time - prev.t) / span;
      return {
        t: time,
        x: prev.x + (next.x - prev.x) * mix,
        y: prev.y + (next.y - prev.y) * mix,
        z: prev.z + (next.z - prev.z) * mix,
      };
    }
  }
  return last;
}

function toWorld(point: FlightPoint): [number, number, number] {
  return [ballSpot.x + point.y * yard, ballSpot.y + point.z * yard, ballSpot.z - point.x * yard];
}

export function stepShot(
  hold: FlightHold | null,
  ball: Mesh | null,
  tracer: Line,
  positions: Float32Array,
  age: number,
  reduce: boolean,
): FlightHold | null {
  if (!hold || !ball) return null;
  const points = hold.shot.trajectory;
  const spot = pointAt(points, reduce ? points[points.length - 1].t : age);
  const [x, y, z] = toWorld(spot);
  ball.position.set(x, y, z);
  ball.visible = true;

  const land = landingTime(points);
  const drawn = reduce ? points.length : points.filter((point) => point.t <= age).length;
  const count = Math.max(2, Math.min(drawn, 600));
  for (let i = 0; i < count; i += 1) {
    const sample = points[Math.min(i, points.length - 1)];
    const place = toWorld(sample);
    positions[i * 3] = place[0];
    positions[i * 3 + 1] = place[1];
    positions[i * 3 + 2] = place[2];
  }
  const attribute = tracer.geometry.getAttribute("position");
  attribute.needsUpdate = true;
  tracer.geometry.setDrawRange(0, count);
  const material = tracer.material as { opacity: number };
  const fade = Math.max(0, age - (reduce ? 0.6 : land)) / range.fadeSeconds;
  material.opacity = Math.max(0, 1 - fade);
  if (!hold.reported && (reduce || age >= land)) {
    hold.reported = true;
    return hold;
  }
  return null;
}

export function stepCamera(
  camera: PerspectiveCamera,
  look: { x: number; y: number; z: number },
  hold: FlightHold | null,
  age: number,
  delta: number,
  reduce: boolean,
) {
  const home = range.cameraHome;
  const homeLook = range.cameraLook;
  let goalX = home[0];
  let goalY = home[1];
  let goalZ = home[2];
  let lookX = homeLook[0];
  let lookY = homeLook[1];
  let lookZ = homeLook[2];
  if (!reduce && hold) {
    const land = landingTime(hold.shot.trajectory);
    const back = Math.min(1, Math.max(0, (age - land) / 1.6));
    const spot = pointAt(hold.shot.trajectory, age);
    const [x, y, z] = toWorld(spot);
    const follow = 1 - back;
    goalX = home[0] * back + x * 0.25 * follow;
    goalY = home[1] * back + (y + 2.2) * follow;
    goalZ = home[2] * back + (z + 8) * follow;
    lookX = homeLook[0] * back + x * follow;
    lookY = homeLook[1] * back + y * follow;
    lookZ = homeLook[2] * back + z * follow;
  }
  const ease = reduce ? 1 : 1 - Math.exp(-delta * 2.2);
  camera.position.x += (goalX - camera.position.x) * ease;
  camera.position.y += (goalY - camera.position.y) * ease;
  camera.position.z += (goalZ - camera.position.z) * ease;
  look.x += (lookX - look.x) * ease;
  look.y += (lookY - look.y) * ease;
  look.z += (lookZ - look.z) * ease;
  camera.lookAt(look.x, look.y, look.z);
}
