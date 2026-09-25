import { AnimationAction, Object3D, Quaternion, Vector3 } from "three";
import { ballSpot, findBone, holdFrame, soleHeight } from "./range-play";
import { rangeSettings as range } from "./settings";
import { solveTwoBone } from "./two-bone";

const leadPos = new Vector3();
const trailPos = new Vector3();
const mid = new Vector3();
const across = new Vector3();
const side = new Vector3();
const upAxis = new Vector3(0, 1, 0);
const shaft = new Vector3();
const rawUp = new Vector3();
const clubUp = new Vector3();
const grip = new Vector3();
const head = new Vector3();
const target = new Vector3();
const animated = new Vector3();
const correction = new Vector3();
const prevLead = new Vector3();
const prevTrail = new Vector3();
const pole = new Vector3();
const hipPos = new Vector3();
const tmp = new Vector3();
const held = new Vector3();

type Fix = {
  impactTime: number;
  addressGap: number;
  ballMoved: number;
  length: number;
  shaftX: number;
  shaftY: number;
  shaftZ: number;
  trailAlong: number;
  leftFoot: Vector3;
  rightFoot: Vector3;
  rightToe: Vector3;
  rigHome: Vector3;
  topTime: number;
  endTime: number;
  rest: Map<string, number>;
};

let fix: Fix | null = null;
let rollReady = false;

function bone(root: Object3D, name: string) {
  const found = findBone(root, name);
  if (!found) throw new Error(`Missing bone ${name}`);
  return found;
}

function hands(model: Object3D) {
  bone(model, "LeftHand").getWorldPosition(leadPos);
  bone(model, "RightHand").getWorldPosition(trailPos);
  mid.addVectors(leadPos, trailPos).multiplyScalar(0.5);
  across.subVectors(trailPos, leadPos);
  if (across.lengthSq() < 1e-8) across.set(1, 0, 0);
  across.normalize();
  side.crossVectors(across, upAxis);
  if (side.lengthSq() < 1e-8) side.set(0, 0, 1);
  side.normalize();
  rawUp.crossVectors(side, across).normalize();
}

function clubFromHands() {
  if (!fix) return;
  shaft.set(0, 0, 0);
  shaft.addScaledVector(across, fix.shaftX);
  shaft.addScaledVector(rawUp, fix.shaftY);
  shaft.addScaledVector(side, fix.shaftZ);
  if (shaft.lengthSq() < 1e-8) shaft.copy(rawUp);
  shaft.normalize();
  if (!rollReady) {
    clubUp.copy(rawUp);
    rollReady = true;
  }
  clubUp.addScaledVector(shaft, -clubUp.dot(shaft));
  if (clubUp.lengthSq() < 1e-8) clubUp.copy(rawUp);
  clubUp.normalize();
  rawUp.addScaledVector(shaft, -rawUp.dot(shaft));
  if (rawUp.lengthSq() > 1e-8) {
    rawUp.normalize();
    clubUp.lerp(rawUp, 0.25).normalize();
  }
  grip.copy(mid);
  head.copy(grip).addScaledVector(shaft, fix.length);
}

function armWeight(time: number) {
  if (!fix) return 0;
  const before = fix.impactTime - 2 / 60;
  if (time <= fix.topTime || time >= fix.endTime) return 0;
  if (time < before) return (time - fix.topTime) / Math.max(1e-4, before - fix.topTime);
  return 1 - (time - before) / Math.max(1e-4, fix.endTime - before);
}

function pullHand(model: Object3D, handName: string, aim: Vector3, weight: number, previous: Vector3) {
  const hand = bone(model, handName);
  hand.getWorldPosition(animated);
  target.copy(animated).lerp(aim, weight);
  correction.subVectors(target, animated);
  tmp.subVectors(correction, previous);
  if (tmp.length() > 0.02) {
    tmp.setLength(0.02);
    correction.copy(previous).add(tmp);
  }
  previous.copy(correction);
  target.copy(animated).add(correction);
  const shoulder = bone(model, handName.startsWith("Left") ? "LeftArm" : "RightArm");
  const elbow = bone(model, handName.startsWith("Left") ? "LeftForeArm" : "RightForeArm");
  bone(model, "Hips").getWorldPosition(hipPos);
  solveTwoBone(shoulder, elbow, hand, target, hipPos);
}

function seatHips(model: Object3D, aim: Vector3, rootName: string, midName: string, endName: string) {
  const hips = bone(model, "Hips");
  const parent = hips.parent;
  if (!parent) return;
  const root = bone(model, rootName);
  const midBone = bone(model, midName);
  const end = bone(model, endName);
  root.getWorldPosition(tmp);
  midBone.getWorldPosition(target);
  const upper = tmp.distanceTo(target);
  end.getWorldPosition(target);
  const lower = midBone.getWorldPosition(animated).distanceTo(target);
  const span = (upper + lower) * 0.82;
  const dist = tmp.distanceTo(aim);
  if (dist <= span) return;
  const shift = aim.clone().sub(tmp).setLength(dist - span);
  hips.getWorldPosition(target);
  parent.worldToLocal(target.add(shift));
  hips.position.copy(target);
  model.updateMatrixWorld(true);
}

function pinFoot(model: Object3D, sideName: "Left" | "Right", aim: Vector3) {
  const hip = bone(model, `${sideName}UpLeg`);
  const knee = bone(model, `${sideName}Leg`);
  const foot = bone(model, `${sideName}Foot`);
  hip.getWorldPosition(pole);
  tmp.subVectors(aim, pole);
  target.set(0, 0, 1).cross(tmp);
  if (target.x < 0) target.negate();
  target.z += sideName === "Left" ? -0.35 : 0.35;
  if (tmp.lengthSq() > 1e-8) target.addScaledVector(tmp, -target.dot(tmp) / tmp.lengthSq());
  if (target.x < 0) target.negate();
  if (target.lengthSq() < 1e-8) target.set(0, 1, 0);
  pole.add(target.normalize());
  solveTwoBone(hip, knee, foot, aim, pole);
}

function pinToe(model: Object3D, aim: Vector3) {
  const knee = bone(model, "RightLeg");
  const foot = bone(model, "RightFoot");
  const toe = bone(model, "RightToe_End");
  foot.getWorldPosition(pole);
  pole.x += 1;
  pole.y += 0.2;
  pole.z += 0.35;
  solveTwoBone(knee, foot, toe, aim, pole);
}

function restLengths(model: Object3D) {
  const rest = new Map<string, number>();
  model.traverse((node) => {
    if (!node.parent) return;
    rest.set(node.name, node.position.length());
  });
  return rest;
}

export function correctFrame(model: Object3D, time: number) {
  if (!fix) return;
  model.updateMatrixWorld(true);
  const weight = armWeight(time);
  seatHips(model, fix.leftFoot, "LeftUpLeg", "LeftLeg", "LeftFoot");
  if (time <= fix.impactTime) seatHips(model, fix.rightFoot, "RightUpLeg", "RightLeg", "RightFoot");
  else seatHips(model, fix.rightToe, "RightLeg", "RightFoot", "RightToe_End");
  if (time <= fix.impactTime) {
    pinFoot(model, "Left", fix.leftFoot);
    pinFoot(model, "Right", fix.rightFoot);
  } else {
    pinFoot(model, "Left", fix.leftFoot);
    bone(model, "RightFoot").getWorldPosition(held);
    pinFoot(model, "Right", held);
    pinToe(model, fix.rightToe);
  }
  hands(model);
  const trailGrip = mid.clone().addScaledVector(across, fix.trailAlong);
  pullHand(model, "LeftHand", mid, weight, prevLead);
  pullHand(model, "RightHand", trailGrip, weight, prevTrail);
  model.updateMatrixWorld(true);
  hands(model);
  clubFromHands();
  }

export function clubheadPosition(_club: Object3D | null, out: Vector3) {
  return out.copy(head);
}

export function shaftEnds(gripOut: Vector3, headOut: Vector3) {
  gripOut.copy(grip);
  headOut.copy(head);
}

export function gripPoint(_club: Object3D | null, out: Vector3) {
  return out.copy(trailPos);
}

export function currentFix() {
  return fix;
}

export function placeRig(rig: Object3D, model: Object3D, action: AnimationAction) {
  rig.position.set(0, 0, 0);
  rig.rotation.set(0, 0, 0);
  rig.updateMatrixWorld(true);
  holdFrame(action, 0);
  model.updateMatrixWorld(true);
  const left = bone(model, "LeftShoulder").getWorldPosition(new Vector3());
  const right = bone(model, "RightShoulder").getWorldPosition(new Vector3());
  const leftDir = left.sub(right);
  leftDir.y = 0;
  if (leftDir.lengthSq() < 1e-8) leftDir.set(0, 0, -1);
  leftDir.normalize();
  rig.rotation.y = Math.atan2(leftDir.x, -leftDir.z);
  rig.updateMatrixWorld(true);
  holdFrame(action, 0);
  model.updateMatrixWorld(true);
  rig.position.y += -soleHeight(model);
  rig.updateMatrixWorld(true);
  holdFrame(action, 0);
  model.updateMatrixWorld(true);

  const ball = new Vector3(range.ball[0], range.ball[1], range.ball[2]);
  hands(model);
  const addressShaft = ball.clone().sub(mid);
  const length = Math.max(0.2, addressShaft.length());
  addressShaft.normalize();
  const addressGap = mid.clone().addScaledVector(addressShaft, length).distanceTo(ball);
  const trailAlong = tmp.subVectors(trailPos, mid).dot(across);

  const duration = action.getClip()?.duration ?? 1;
  const step = 1 / 60;
  const samples: { time: number; head: Vector3; speed: number; hand: number }[] = [];
  let previous = new Vector3();
  let primed = false;
  rollReady = false;
  fix = {
    impactTime: 0,
    addressGap,
    ballMoved: 0,
    length,
    shaftX: addressShaft.dot(across),
    shaftY: addressShaft.dot(rawUp),
    shaftZ: addressShaft.dot(side),
    trailAlong,
    leftFoot: bone(model, "LeftFoot").getWorldPosition(new Vector3()),
    rightFoot: bone(model, "RightFoot").getWorldPosition(new Vector3()),
    rightToe: bone(model, "RightToe_End").getWorldPosition(new Vector3()),
    rigHome: rig.position.clone(),
    topTime: duration,
    endTime: duration,
    rest: restLengths(model),
  };

  let highest = -Infinity;
  for (let time = 0; time <= duration + 1e-6; time += step) {
    holdFrame(action, Math.min(time, duration));
    correctFrame(model, Math.min(time, duration));
    const speed = primed ? head.distanceTo(previous) / step : 0;
    previous.copy(head);
    primed = true;
    bone(model, "LeftHand").getWorldPosition(tmp);
    samples.push({ time: Math.min(time, duration), head: head.clone(), speed, hand: tmp.y });
  }

  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, sample.speed);
  let impact: (typeof samples)[number] | null = null;
  for (const sample of samples) {
    if (sample.time < 0.2 || sample.speed < peak * 0.85) continue;
    if (!impact || sample.head.y < impact.head.y) impact = sample;
  }
  fix.impactTime = impact?.time ?? 0;
  for (const sample of samples) {
    if (sample.time > fix.impactTime) break;
    if (sample.hand > highest) {
      highest = sample.hand;
      fix.topTime = sample.time;
    }
  }
  const moved = impact ? impact.head.clone().sub(ball) : new Vector3();
  ballSpot.x = range.ball[0] + moved.x;
  ballSpot.y = range.ball[1] + moved.y;
  ballSpot.z = range.ball[2] + moved.z;
  fix.ballMoved = moved.length();
  prevLead.set(0, 0, 0);
  prevTrail.set(0, 0, 0);
  rollReady = false;
  holdFrame(action, 0);
  console.log(`address gap ${addressGap.toFixed(4)}`);
  console.log(`ball moved ${fix.ballMoved.toFixed(4)}`);
  return fix;
}
