import { AnimationAction, Matrix4, Object3D, Vector3 } from "three";
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
const footAim = new Vector3();

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

function smooth(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function armWeight(time: number) {
  if (!fix) return 0;
  const top = fix.topTime;
  const impact = fix.impactTime;
  const early = top * 0.45;
  if (time <= early) return 1;
  if (time < top) return 1 - smooth((time - early) / Math.max(1e-4, top - early));
  const riseStart = Math.max(top, impact - 8 / 60);
  if (time < riseStart) return 0;
  if (time < impact) return smooth((time - riseStart) / Math.max(1e-4, impact - riseStart));
  return 1 - smooth((time - impact) / Math.max(1e-4, fix.endTime - impact));
}

function trailLegWeight(time: number) {
  if (!fix) return 0;
  if (time <= fix.impactTime) return 1;
  const fade = 5 / 60;
  if (time >= fix.impactTime + fade) return 0;
  return 1 - (time - fix.impactTime) / fade;
}

let armMoved = 0;

export function correctionWeights(time: number) {
  return { arms: armWeight(time), trailLeg: trailLegWeight(time), armMoved };
}

function pullHand(model: Object3D, handName: string, shift: Vector3, weight: number, previous: Vector3, full: boolean) {
  const hand = bone(model, handName);
  hand.getWorldPosition(animated);
  correction.copy(shift).multiplyScalar(weight);
  if (!full) {
    tmp.subVectors(correction, previous);
    if (tmp.length() > 0.02) {
      tmp.setLength(0.02);
      correction.copy(previous).add(tmp);
    }
  }
  previous.copy(correction);
  armMoved = Math.max(armMoved, correction.length());
  if (correction.lengthSq() < 1e-8) return;
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
  const span = (upper + lower) * 0.97;
  const dist = tmp.distanceTo(aim);
  if (dist <= span) return;
  const shift = tmp.clone().sub(aim);
  shift.setLength(dist - span);
  shift.negate();
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

function clampTrailKnee(model: Object3D) {
  const hip = bone(model, "RightUpLeg");
  const knee = bone(model, "RightLeg");
  const foot = bone(model, "RightFoot");
  hip.getWorldPosition(tmp);
  knee.getWorldPosition(target);
  foot.getWorldPosition(animated);
  want.copy(animated).sub(tmp);
  if (want.lengthSq() < 1e-8) return;
  correction.copy(target).sub(tmp);
  correction.addScaledVector(want, -correction.dot(want) / want.lengthSq());
  handShift.set(1, 0, 0);
  handShift.addScaledVector(want, -handShift.dot(want) / want.lengthSq());
  if (handShift.x < 0) handShift.negate();
  if (handShift.lengthSq() < 1e-8 || correction.dot(handShift) >= -0.001) return;
  footAim.copy(animated);
  pinFoot(model, "Right", footAim);
}

function restLengths(model: Object3D) {
  const rest = new Map<string, number>();
  model.traverse((node) => {
    if (!node.parent) return;
    rest.set(node.name, node.position.length());
  });
  return rest;
}

const handShift = new Vector3();
const want = new Vector3();

export function correctFrame(model: Object3D, time: number) {
  if (!fix) return;
  model.updateMatrixWorld(true);
  armMoved = 0;
  const weight = armWeight(time);
  const trail = trailLegWeight(time);
  bone(model, "RightFoot").getWorldPosition(held);
  seatHips(model, fix.leftFoot, "LeftUpLeg", "LeftLeg", "LeftFoot");
  if (trail > 0) seatHips(model, fix.rightFoot, "RightUpLeg", "RightLeg", "RightFoot");
  pinFoot(model, "Left", fix.leftFoot);
  if (trail > 0) {
    footAim.copy(fix.rightFoot).lerp(held, 1 - trail);
    pinFoot(model, "Right", footAim);
  } else clampTrailKnee(model);
  model.updateMatrixWorld(true);
  hands(model);
  clubFromHands();
  handShift.set(ballSpot.x, ballSpot.y, ballSpot.z).sub(head);
  let scale = 1;
  for (const side of ["Left", "Right"] as const) {
    const shoulder = bone(model, `${side}Arm`);
    const elbow = bone(model, `${side}ForeArm`);
    const hand = bone(model, `${side}Hand`);
    shoulder.getWorldPosition(tmp);
    elbow.getWorldPosition(target);
    const upper = tmp.distanceTo(target);
    hand.getWorldPosition(target);
    const lower = elbow.getWorldPosition(animated).distanceTo(target);
    const limit = (upper + lower) * 0.9;
    let lo = 0;
    let hi = 1;
    for (let step = 0; step < 8; step += 1) {
      const mid = (lo + hi) / 2;
      want.copy(target).addScaledVector(handShift, mid);
      if (tmp.distanceTo(want) <= limit) lo = mid;
      else hi = mid;
    }
    scale = Math.min(scale, lo);
  }
  if (scale < 0.9) handShift.set(0, 0, 0);
  else handShift.multiplyScalar(scale);
  pullHand(model, "LeftHand", handShift, weight, prevLead, time === 0);
  pullHand(model, "RightHand", handShift, weight, prevTrail, time === 0);
  model.updateMatrixWorld(true);
  hands(model);
  clubFromHands();
  }

export function drawSkeleton(
  edges: [Object3D, Object3D][],
  joints: Object3D[],
  positions: Float32Array,
  geom: { setPositions: (values: Float32Array) => void },
  spheres: { setMatrixAt: (index: number, matrix: Matrix4) => void; instanceMatrix: { needsUpdate: boolean } },
  headBone: Object3D,
  trailPositions: Float32Array,
  trailColors: Float32Array,
  trailGeom: { setPositions: (values: Float32Array) => void; setColors: (values: Float32Array) => void },
  point: Vector3,
  matrix: Matrix4,
  gripOut: Vector3,
  clubHead: Vector3,
) {
  let cursor = 0;
  for (const [parent, child] of edges) {
    parent.getWorldPosition(point);
    positions[cursor++] = point.x;
    positions[cursor++] = point.y;
    positions[cursor++] = point.z;
    child.getWorldPosition(point);
    positions[cursor++] = point.x;
    positions[cursor++] = point.y;
    positions[cursor++] = point.z;
  }
  shaftEnds(gripOut, clubHead);
  positions[cursor++] = gripOut.x;
  positions[cursor++] = gripOut.y;
  positions[cursor++] = gripOut.z;
  positions[cursor++] = clubHead.x;
  positions[cursor++] = clubHead.y;
  positions[cursor++] = clubHead.z;
  geom.setPositions(positions);
  let index = 0;
  for (const joint of joints) {
    joint.getWorldPosition(point);
    matrix.setPosition(point);
    spheres.setMatrixAt(index, matrix);
    if (joint.name.replace(/[:|]/g, "").endsWith("Head")) headBone.position.copy(point);
    index += 1;
  }
  spheres.instanceMatrix.needsUpdate = true;
  trailPositions.copyWithin(0, 3);
  trailPositions[trailPositions.length - 3] = clubHead.x;
  trailPositions[trailPositions.length - 2] = clubHead.y;
  trailPositions[trailPositions.length - 1] = clubHead.z;
  const count = trailColors.length / 4;
  for (let i = 0; i < count; i += 1) {
    const fade = i / (count - 1);
    trailColors[i * 4] = 0.97;
    trailColors[i * 4 + 1] = 0.95;
    trailColors[i * 4 + 2] = 0.9;
    trailColors[i * 4 + 3] = fade * 0.35;
  }
  trailGeom.setPositions(trailPositions);
  trailGeom.setColors(trailColors);
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
  const previous = new Vector3();
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
    const now = Math.min(time, duration);
    holdFrame(action, now);
    model.updateMatrixWorld(true);
    hands(model);
    clubFromHands();
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
  const addressHead = samples[0]?.head ?? ball;
  const impactHead = impact?.head ?? addressHead;
  const placed = addressHead.clone().add(impactHead).multiplyScalar(0.5);
  const gapAddress = addressHead.distanceTo(placed);
  const gapImpact = impactHead.distanceTo(placed);
  ballSpot.x = placed.x;
  ballSpot.y = placed.y;
  ballSpot.z = placed.z;
  fix.ballMoved = placed.distanceTo(ball);
  prevLead.set(0, 0, 0);
  prevTrail.set(0, 0, 0);
  rollReady = false;
  holdFrame(action, 0);
  console.log(`address gap before IK ${gapAddress.toFixed(4)}`);
  console.log(`impact gap before IK ${gapImpact.toFixed(4)}`);
  console.log(`address gap ${addressGap.toFixed(4)}`);
  console.log(`ball moved ${fix.ballMoved.toFixed(4)}`);
  return fix;
}
