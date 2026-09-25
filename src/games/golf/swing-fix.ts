import { AnimationAction, Matrix4, Object3D, Quaternion, Vector3 } from "three";
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
const grip = new Vector3();
const head = new Vector3();
const target = new Vector3();
const animated = new Vector3();
const correction = new Vector3();
const prevLead = new Vector3();
const prevTrail = new Vector3();
const pole = new Vector3();
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

const handQ = new Quaternion();
const clubQ = new Quaternion();
const offsetQ = new Quaternion();
const rawQ = new Quaternion();
const smoothQ = new Quaternion();
const prevRaw = new Quaternion();
const basisX = new Vector3();
const basisZ = new Vector3();
const CLUB_LENGTH = 0.98;

let fix: Fix | null = null;
let clubReady = false;

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

function clubFromLead(model: Object3D) {
  const hand = bone(model, "LeftHand");
  hand.getWorldQuaternion(handQ);
  hand.getWorldPosition(grip);
  rawQ.copy(handQ).multiply(offsetQ);
  if (!clubReady) {
    smoothQ.copy(rawQ);
    clubReady = true;
  } else {
    clubQ.copy(prevRaw).slerp(rawQ, 0.5);
    smoothQ.slerp(clubQ, 0.55);
  }
  prevRaw.copy(rawQ);
  shaft.set(0, 1, 0).applyQuaternion(smoothQ);
  head.copy(grip).addScaledVector(shaft, CLUB_LENGTH);
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
  return { arms: 0, trailLeg: trailLegWeight(time), armMoved };
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
  clubFromLead(model);
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
  const baseYaw = rig.rotation.y;
  const groundY = rig.position.y;
  const shaftDelta = new Vector3();
  const pick: { pose: { x: number; z: number; yaw: number; score: number } | null } = { pose: null };
  const tryPose = (x: number, z: number, yaw: number) => {
    rig.rotation.set(0, baseYaw + yaw, 0);
    rig.position.set(x, groundY, z);
    rig.updateMatrixWorld(true);
    model.updateMatrixWorld(true);
    hands(model);
    shaftDelta.subVectors(ball, mid);
    const length = shaftDelta.length();
    const horiz = Math.hypot(shaftDelta.x, shaftDelta.z);
    const lie = (Math.atan2(-shaftDelta.y, horiz) * 180) / Math.PI;
    const lengthMiss = length < 1.12 ? 1.12 - length : length > 1.16 ? length - 1.16 : 0;
    const lieMiss = lie < 55 ? 55 - lie : lie > 60 ? lie - 60 : 0;
    bone(model, "LeftFoot").getWorldPosition(tmp);
    const heel = Math.abs(tmp.z - ball.z);
    const score = lengthMiss * 8 + lieMiss + heel;
    if (!pick.pose || score < pick.pose.score) pick.pose = { x, z, yaw, score };
  };
  for (let x = -1.35; x <= -0.4; x += 0.04) {
    for (let z = -0.45; z <= 0.45; z += 0.04) {
      for (let yaw = -0.12; yaw <= 0.12; yaw += 0.03) {
        tryPose(x, z, yaw);
      }
    }
  }
  if (pick.pose) {
    const around = pick.pose;
    for (let x = around.x - 0.05; x <= around.x + 0.05; x += 0.01) {
      for (let z = around.z - 0.05; z <= around.z + 0.05; z += 0.01) {
        for (let yaw = around.yaw - 0.03; yaw <= around.yaw + 0.03; yaw += 0.01) {
          tryPose(x, z, yaw);
        }
      }
    }
    rig.rotation.set(0, baseYaw + pick.pose.yaw, 0);
    rig.position.set(pick.pose.x, groundY, pick.pose.z);
  }
  rig.updateMatrixWorld(true);
  holdFrame(action, 0);
  model.updateMatrixWorld(true);
  const lead = bone(model, "LeftHand");
  lead.getWorldQuaternion(handQ);
  lead.getWorldPosition(grip);
  shaft.subVectors(ball, grip);
  if (shaft.lengthSq() < 1e-8) shaft.set(0, -1, 0);
  shaft.normalize();
  basisX.crossVectors(upAxis, shaft);
  if (basisX.lengthSq() < 1e-8) basisX.set(1, 0, 0);
  basisX.normalize();
  basisZ.crossVectors(basisX, shaft).normalize();
  const basis = new Matrix4();
  basis.makeBasis(basisX, shaft, basisZ);
  clubQ.setFromRotationMatrix(basis);
  offsetQ.copy(handQ).invert().multiply(clubQ);
  head.copy(grip).addScaledVector(shaft, CLUB_LENGTH);
  const addressGap = head.distanceTo(ball);
  ballSpot.x = head.x;
  ballSpot.y = head.y;
  ballSpot.z = head.z;
  const length = CLUB_LENGTH;
  hands(model);
  const trailAlong = tmp.subVectors(trailPos, mid).dot(across);

  const duration = action.getClip()?.duration ?? 1;
  const step = 1 / 60;
  const samples: { time: number; head: Vector3; speed: number; hand: number }[] = [];
  const previous = new Vector3();
  let primed = false;
  clubReady = false;
  fix = {
    impactTime: 0,
    addressGap,
    ballMoved: head.distanceTo(ball),
    length,
    shaftX: shaft.dot(across),
    shaftY: shaft.dot(rawUp),
    shaftZ: shaft.dot(side),
    trailAlong,
    leftFoot: bone(model, "LeftFoot").getWorldPosition(new Vector3()),
    rightFoot: bone(model, "RightFoot").getWorldPosition(new Vector3()),
    rightToe: bone(model, "RightToe_End").getWorldPosition(new Vector3()),
    rigHome: rig.position.clone(),
    topTime: duration,
    endTime: duration,
    rest: restLengths(model),
  };
  const lie = (Math.atan2(-shaft.y, Math.hypot(shaft.x, shaft.z)) * 180) / Math.PI;
  const feetX = (fix.leftFoot.x + fix.rightFoot.x) / 2;
  const feetZ = (fix.leftFoot.z + fix.rightFoot.z) / 2;
  console.log(`feet sideways ${(feetX - ball.x).toFixed(3)} along ${(feetZ - ball.z).toFixed(3)}`);
  console.log(`lead heel ${(fix.leftFoot.z - ball.z).toFixed(3)}`);
  console.log(`club length ${length.toFixed(3)} lie ${lie.toFixed(1)}`);

  let highest = -Infinity;
  for (let time = 0; time <= duration + 1e-6; time += step) {
    const now = Math.min(time, duration);
    holdFrame(action, now);
    correctFrame(model, now);
    const speed = primed ? head.distanceTo(previous) / step : 0;
    previous.copy(head);
    primed = true;
    bone(model, "LeftHand").getWorldPosition(tmp);
    samples.push({ time: Math.min(time, duration), head: head.clone(), speed, hand: tmp.y });
  }

  const ballThere = new Vector3(ballSpot.x, ballSpot.y, ballSpot.z);
  let impact: (typeof samples)[number] | null = null;
  let closest = Infinity;
  for (const sample of samples) {
    if (sample.time < 0.3) continue;
    const gap = sample.head.distanceTo(ballThere);
    if (gap < closest) {
      closest = gap;
      impact = sample;
    }
  }
  fix.impactTime = impact?.time ?? 0;
  for (const sample of samples) {
    if (sample.time > fix.impactTime) break;
    if (sample.hand > highest) {
      highest = sample.hand;
      fix.topTime = sample.time;
    }
  }
  const frameTravel = (impact?.speed ?? 0) * step;
  console.log(`closest pass ${closest.toFixed(4)}`);
  console.log(`frame travel ${frameTravel.toFixed(4)}`);
  fix.addressGap = 0;
  prevLead.set(0, 0, 0);
  prevTrail.set(0, 0, 0);
  holdFrame(action, 0);
  console.log(`address gap ${fix.addressGap.toFixed(4)}`);
  console.log(`ball moved ${fix.ballMoved.toFixed(4)}`);
  clubReady = false;
  return fix;
}
