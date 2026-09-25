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
  addressTime: number;
  halfBackTime: number;
  topTime: number;
  halfDownTime: number;
  finishTime: number;
  endTime: number;
  rest: Map<string, number>;
};

const rawQ = new Quaternion();
const smoothQ = new Quaternion();
const prevRaw = new Quaternion();
const basisX = new Vector3();
const basisZ = new Vector3();
const impactDir = new Vector3(0, -0.4, 0.2);
const toeHint = new Vector3();
const CLUB_LENGTH = 0.98;

let fix: Fix | null = null;
const played: Quaternion[] = [];

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

function ease(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function orient(out: Quaternion, direction: Vector3, toeHint: Vector3) {
  shaft.copy(direction);
  if (shaft.lengthSq() < 1e-8) shaft.set(0, -1, 0);
  shaft.normalize();
  basisZ.copy(toeHint);
  basisZ.addScaledVector(shaft, -basisZ.dot(shaft));
  if (basisZ.lengthSq() < 1e-8) basisZ.set(0, 0, 1);
  basisZ.normalize();
  basisX.crossVectors(shaft, basisZ).normalize();
  const basis = new Matrix4();
  basis.makeBasis(basisX, shaft, basisZ);
  out.setFromRotationMatrix(basis);
}

function keyDirection(kind: string, at: Vector3) {
  if (kind === "impact") {
    shaft.copy(impactDir);
    return;
  }
  if (kind === "address") {
    shaft.subVectors(ballAt(), at);
    if (shaft.lengthSq() < 1e-8) shaft.set(1, 0, 0);
    return;
  }
  if (kind === "halfBack" || kind === "halfDown") {
    shaft.set(0, 0, 1);
    return;
  }
  if (kind === "top") {
    shaft.set(0, 0, -1);
    return;
  }
  shaft.set(0, -0.45, 0.9);
}

function keyQuat(kind: string, at: Vector3, out: Quaternion) {
  keyDirection(kind, at);
  toeHint.set(0, 1, 0);
  orient(out, shaft, toeHint);
}

function ballAt() {
  return tmp.set(ballSpot.x, ballSpot.y, ballSpot.z);
}

type KeyName = "address" | "halfBack" | "top" | "halfDown" | "impact" | "finish";

function keyTimes(): { name: KeyName; time: number }[] {
  if (!fix) return [];
  return [
    { name: "address", time: fix.addressTime },
    { name: "halfBack", time: fix.halfBackTime },
    { name: "top", time: fix.topTime },
    { name: "halfDown", time: fix.halfDownTime },
    { name: "impact", time: fix.impactTime },
    { name: "finish", time: fix.finishTime },
  ];
}

function segmentEase(from: KeyName, _to: KeyName, s: number) {
  return ease(s);
}

function clubOrientation(time: number, at: Vector3, out: Quaternion) {
  const keys = keyTimes();
  let from: KeyName = "address";
  let to: KeyName = "halfBack";
  let s = 0;
  if (time <= keys[0].time) keyQuat("address", at, out);
  else if (time >= keys[keys.length - 1].time) keyQuat("finish", at, out);
  else {
    for (let i = 0; i < keys.length - 1; i += 1) {
      if (time >= keys[i].time && time <= keys[i + 1].time) {
        from = keys[i].name;
        to = keys[i + 1].name;
        const span = Math.max(1e-4, keys[i + 1].time - keys[i].time);
        s = segmentEase(from, to, (time - keys[i].time) / span);
        break;
      }
    }
    if ((from === "halfBack" && to === "top") || (from === "top" && to === "halfDown")) {
      const spin = from === "halfBack" ? s * Math.PI : Math.PI + s * Math.PI;
      orient(rawQ, basisZ.set(0, 0, 1), upAxis);
      prevRaw.setFromAxisAngle(basisX.set(1, 0, 0), spin);
      out.copy(prevRaw).multiply(rawQ);
    } else {
      keyQuat(from, at, rawQ);
      keyQuat(to, at, prevRaw);
      if (rawQ.dot(prevRaw) < 0) prevRaw.set(-prevRaw.x, -prevRaw.y, -prevRaw.z, -prevRaw.w);
      out.copy(rawQ).slerp(prevRaw, s);
    }
  }
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
const goal = new Vector3();

function ikHand(model: Object3D, sideName: "Left" | "Right", aim: Vector3, weight: number) {
  const shoulder = bone(model, `${sideName}Arm`);
  const elbow = bone(model, `${sideName}ForeArm`);
  const hand = bone(model, `${sideName}Hand`);
  hand.getWorldPosition(animated);
  goal.copy(animated).lerp(aim, weight);
  bone(model, "Hips").getWorldPosition(pole);
  const before = animated.distanceTo(goal);
  solveTwoBone(shoulder, elbow, hand, goal, pole);
  armMoved = Math.max(armMoved, before * weight);
}

function clampElbow(model: Object3D, sideName: "Left" | "Right") {
  const shoulder = bone(model, `${sideName}Arm`);
  const elbow = bone(model, `${sideName}ForeArm`);
  const hand = bone(model, `${sideName}Hand`);
  shoulder.getWorldPosition(tmp);
  elbow.getWorldPosition(target);
  hand.getWorldPosition(animated);
  bone(model, "Hips").getWorldPosition(pole);
  want.copy(animated).sub(tmp);
  if (want.lengthSq() < 1e-8) return;
  correction.copy(target).sub(tmp);
  correction.addScaledVector(want, -correction.dot(want) / want.lengthSq());
  handShift.copy(pole).sub(tmp);
  handShift.addScaledVector(want, -handShift.dot(want) / want.lengthSq());
  if (handShift.lengthSq() < 1e-8 || correction.dot(handShift) >= -0.001) return;
  solveTwoBone(shoulder, elbow, hand, animated, pole);
}

function lengthNearImpact(time: number, reach: number) {
  const full = CLUB_LENGTH;
  const limited = Math.min(full * 1.05, Math.max(full * 0.95, reach));
  if (!fix) return full;
  const width = 0.12;
  const dt = Math.abs(time - fix.impactTime);
  if (dt >= width) return full;
  return full + (limited - full) * ease(1 - dt / width);
}

function poseClub(time: number) {
  grip.copy(mid);
  const index = Math.round(time * 60);
  if (played[index]) smoothQ.copy(played[index]);
  else clubOrientation(time, grip, smoothQ);
  shaft.set(0, 1, 0).applyQuaternion(smoothQ);
  const reach = grip.distanceTo(ballAt());
  const length = lengthNearImpact(time, reach);
  head.copy(grip).addScaledVector(shaft, length);
}

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
  clampElbow(model, "Left");
  clampElbow(model, "Right");
  model.updateMatrixWorld(true);
  hands(model);
  const apart = leadPos.distanceTo(trailPos);
  if (apart > 0.05 && time > 0.1) {
  for (const sideName of ["Left", "Right"] as const) {
    const shoulder = bone(model, `${sideName}Arm`);
    const elbow = bone(model, `${sideName}ForeArm`);
    const hand = bone(model, `${sideName}Hand`);
    shoulder.getWorldPosition(tmp);
    elbow.getWorldPosition(target);
    const upper = tmp.distanceTo(target);
    hand.getWorldPosition(animated);
    const lower = target.distanceTo(animated);
    const cap = (upper + lower) * 0.92;
    const dist = tmp.distanceTo(mid);
    if (dist > cap) mid.addScaledVector(tmp.sub(mid).normalize(), dist - cap);
  }
  }
  for (let pass = 0; pass < 3; pass += 1) {
    ikHand(model, "Left", mid, 1);
    ikHand(model, "Right", mid, 1);
    model.updateMatrixWorld(true);
    hands(model);
  }
  const width = 0.12;
  const dt = Math.abs(time - fix.impactTime);
  if (dt < width) {
    const pull = ease(1 - dt / width);
    shaft.subVectors(ballAt(), mid);
    const dist = shaft.length();
    if (dist > 1e-4) {
      shaft.multiplyScalar(1 / dist);
      goal.copy(ballAt()).addScaledVector(shaft, -CLUB_LENGTH);
      handShift.subVectors(goal, mid).multiplyScalar(pull);
      leadPos.add(handShift);
      trailPos.add(handShift);
      ikHand(model, "Left", leadPos, 1);
      ikHand(model, "Right", trailPos, 1);
      model.updateMatrixWorld(true);
      hands(model);
    }
  }
  model.updateMatrixWorld(true);
  hands(model);
  const index = Math.round(time * 60);
  if (played[index] && fix && Math.abs(time - fix.impactTime) < 1 / 120) {
    shaft.set(0, 1, 0).applyQuaternion(played[index]);
    goal.copy(ballAt()).addScaledVector(shaft, -CLUB_LENGTH);
    handShift.subVectors(goal, mid);
    leadPos.add(handShift);
    trailPos.add(handShift);
    ikHand(model, "Left", leadPos, 1);
    ikHand(model, "Right", trailPos, 1);
    model.updateMatrixWorld(true);
    hands(model);
  }
  poseClub(time);
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
  return out.copy(grip);
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
  lead.getWorldPosition(grip);
  shaft.subVectors(ball, grip);
  if (shaft.lengthSq() < 1e-8) shaft.set(0, -1, 0);
  shaft.normalize();
  head.copy(grip).addScaledVector(shaft, CLUB_LENGTH);
  ballSpot.x = head.x;
  ballSpot.y = head.y;
  ballSpot.z = head.z;
  const length = CLUB_LENGTH;
  hands(model);
  const trailAlong = tmp.subVectors(trailPos, mid).dot(across);
  const lie = (Math.atan2(-shaft.y, Math.hypot(shaft.x, shaft.z)) * 180) / Math.PI;

  const duration = action.getClip()?.duration ?? 1;
  const step = 1 / 60;
  const samples: { time: number; hand: Vector3; shoulderY: number }[] = [];
  for (let time = 0; time <= duration + 1e-6; time += step) {
    const now = Math.min(time, duration);
    holdFrame(action, now);
    model.updateMatrixWorld(true);
    const handPos = bone(model, "LeftHand").getWorldPosition(new Vector3());
    const shoulderY = bone(model, "LeftArm").getWorldPosition(tmp).y;
    samples.push({ time: now, hand: handPos, shoulderY });
  }
  const addressHand = samples[0]?.hand ?? new Vector3();
  let topTime = step;
  let topY = -Infinity;
  let risen = false;
  for (const sample of samples) {
    if (sample.hand.y > addressHand.y + 0.2) risen = true;
    if (!risen) continue;
    if (sample.hand.y >= topY) {
      topY = sample.hand.y;
      topTime = sample.time;
    }
    if (sample.time > topTime + 0.05 && sample.hand.y < topY - 0.25) break;
  }
  let impactTime = topTime + step;
  let nearest = Infinity;
  for (const sample of samples) {
    if (sample.time <= topTime) continue;
    if (sample.hand.y > sample.shoulderY) continue;
    const dist = sample.hand.distanceTo(addressHand);
    if (dist < nearest) {
      nearest = dist;
      impactTime = sample.time;
    }
  }
  const closestLevel = (from: number, until: number) => {
    let when = (from + until) / 2;
    let best = Infinity;
    for (const sample of samples) {
      if (sample.time <= from || sample.time >= until) continue;
      const gap = Math.abs(sample.hand.y - sample.shoulderY);
      if (gap < best) {
        best = gap;
        when = sample.time;
      }
    }
    return when;
  };
  const halfBackTime = closestLevel(0.05, topTime);
  const halfDownTime = closestLevel(topTime, impactTime);
  let finishTime = Math.min(duration, impactTime + 0.4);
  let finishY = -Infinity;
  for (const sample of samples) {
    if (sample.time <= impactTime) continue;
    if (sample.hand.y >= finishY) {
      finishY = sample.hand.y;
      finishTime = sample.time;
    }
  }
  holdFrame(action, 0);
  model.updateMatrixWorld(true);
  fix = {
    impactTime,
    addressGap: 0,
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
    addressTime: 0,
    halfBackTime,
    topTime,
    halfDownTime,
    finishTime,
    endTime: duration,
    rest: restLengths(model),
  };
  const feetX = (fix.leftFoot.x + fix.rightFoot.x) / 2;
  const feetZ = (fix.leftFoot.z + fix.rightFoot.z) / 2;
  console.log(`feet sideways ${(feetX - ball.x).toFixed(3)} along ${(feetZ - ball.z).toFixed(3)}`);
  console.log(`lead heel ${(fix.leftFoot.z - ball.z).toFixed(3)}`);
  console.log(`club length ${length.toFixed(3)} lie ${lie.toFixed(1)}`);
  console.log(`address ${fix.addressTime.toFixed(3)}`);
  console.log(`halfway back ${fix.halfBackTime.toFixed(3)}`);
  console.log(`top ${fix.topTime.toFixed(3)}`);
  console.log(`halfway down ${fix.halfDownTime.toFixed(3)}`);
  console.log(`impact ${fix.impactTime.toFixed(3)}`);
  console.log(`finish ${fix.finishTime.toFixed(3)}`);
  holdFrame(action, fix.impactTime);
  correctFrame(model, fix.impactTime);
  impactDir.subVectors(ballAt(), grip);
  if (impactDir.lengthSq() < 1e-8) impactDir.set(0, -1, 0);
  impactDir.normalize();
  played.length = 0;
  const raw: Quaternion[] = [];
  const durationFrames = Math.round(duration * 60);
  for (let frame = 0; frame <= durationFrames; frame += 1) {
    const now = Math.min(duration, frame / 60);
    holdFrame(action, now);
    correctFrame(model, now);
    raw.push(smoothQ.clone());
  }
  const topFrame = Math.round(fix.topTime * 60);
  const smoothPass = (source: Quaternion[]) => {
    const next = source.map((item) => item.clone());
    for (let frame = 1; frame < source.length - 1; frame += 1) {
      if (frame === topFrame || frame < 2) continue;
      const midQ = source[frame - 1].clone();
      const nextQ = source[frame + 1];
      if (midQ.dot(nextQ) < 0) nextQ.set(-nextQ.x, -nextQ.y, -nextQ.z, -nextQ.w);
      midQ.slerp(nextQ, 0.5);
      if (midQ.dot(source[frame]) < 0) midQ.set(-midQ.x, -midQ.y, -midQ.z, -midQ.w);
      next[frame].copy(source[frame]).slerp(midQ, 0.35);
    }
    return next;
  };
  let smoothed = smoothPass(raw);
  smoothed = smoothPass(smoothed);
  for (let frame = 0; frame < smoothed.length; frame += 1) played[frame] = smoothed[frame];
  holdFrame(action, 0);
  model.updateMatrixWorld(true);
  correctFrame(model, 0);
  fix.addressGap = head.distanceTo(ballAt());
  console.log(`address gap ${fix.addressGap.toFixed(4)}`);
  console.log(`ball moved ${fix.ballMoved.toFixed(4)}`);
  return fix;
}
