import type { AnimationAction, Object3D } from "three";
import { Euler, Quaternion, Vector3 } from "three";
import { rangeSettings as range } from "./settings";
import { findBone, holdFrame, soleHeight } from "./range-play";
import { setWorldQuaternion, solveTwoBone } from "./two-bone";

const ball = new Vector3(range.ball[0], range.ball[1], range.ball[2]);
const shaftUp = new Vector3(0, 1, 0);
const headLocal = new Vector3();
const handPos = new Vector3();
const headPos = new Vector3();
const gripPos = new Vector3();
const pole = new Vector3();
const fromDir = new Vector3();
const toDir = new Vector3();
const turn = new Quaternion();
const worldQ = new Quaternion();
const limited = new Quaternion();

export type SwingFix = {
  impactTime: number;
  times: number[];
  impactIndex: number;
  leftFoot: Vector3;
  rightFoot: Vector3;
  leftFootQ: Quaternion;
  rightFootQ: Quaternion;
  toeLocal: { bone: Object3D; q: Quaternion }[];
  palmRel: Quaternion;
  /** World-space nudge that puts the clubhead on the ball at impact, before the cap. */
  impactGap: Vector3;
};

let fix: SwingFix | null = null;

export function clubLength() {
  return range.clubLength;
}

export function clubheadPosition(club: Object3D, target: Vector3) {
  target.set(0, clubLength(), 0);
  club.localToWorld(target);
  return target;
}

export function gripPoint(club: Object3D, target: Vector3) {
  target.set(0, range.trailGrip, 0);
  club.localToWorld(target);
  return target;
}

/** A point on the grip the trail arm can actually reach, preferring 8 to 10 cm down the shaft. */
function closestOnShaft(club: Object3D, shoulder: Object3D, elbow: Object3D, hand: Object3D) {
  const origin = new Vector3();
  const tip = new Vector3(0, 1, 0);
  club.getWorldPosition(origin);
  club.localToWorld(tip);
  tip.sub(origin).normalize();
  const shoulderPos = new Vector3();
  const elbowPos = new Vector3();
  const handPosNow = new Vector3();
  shoulder.getWorldPosition(shoulderPos);
  elbow.getWorldPosition(elbowPos);
  hand.getWorldPosition(handPosNow);
  const limit = shoulderPos.distanceTo(elbowPos) + elbowPos.distanceTo(handPosNow) - 0.01;
  let best = origin.clone();
  let bestScore = Infinity;
  for (let step = 0; step <= 16; step += 1) {
    const along = 0.04 + (step / 16) * 0.16;
    const point = origin.clone().addScaledVector(tip, along);
    const short = Math.max(0, shoulderPos.distanceTo(point) - limit);
    const prefer = Math.abs(along - range.trailGrip);
    const score = short * 10 + prefer;
    if (score < bestScore) {
      bestScore = score;
      best = point;
    }
  }
  return best;
}

export function mountClub(club: Object3D, hand: Object3D, euler = range.gripEuler, shaft = shaftUp) {
  const aim = new Quaternion().setFromUnitVectors(shaftUp, shaft.clone().normalize());
  const extra = new Quaternion().setFromEuler(new Euler(euler[0], euler[1], euler[2]));
  club.quaternion.copy(aim).multiply(extra);
  club.position.set(0, 0, 0);
  club.scale.set(1, 1, 1);
  if (club.parent !== hand) hand.add(club);
  club.updateMatrixWorld(true);
}

/** Direction, in the lead hand, that stays closest to the trail hand across the swing. */
function shaftThroughTrailHand(model: Object3D, action: AnimationAction, times: number[]) {
  const left = findBone(model, "LeftHand");
  const right = findBone(model, "RightHand");
  const samples: Vector3[] = [];
  const point = new Vector3();
  if (left && right) {
    for (const time of times) {
      holdFrame(action, time);
      model.updateMatrixWorld(true);
      right.getWorldPosition(point);
      left.worldToLocal(point);
      samples.push(point.clone());
    }
  }
  let bestDir = new Vector3(0, 1, 0);
  let best = Infinity;
  for (let tilt = 0; tilt < 12; tilt += 1) {
    for (let turn = 0; turn < 16; turn += 1) {
      const rise = (Math.PI * tilt) / 11 - Math.PI / 2;
      const spin = (Math.PI * 2 * turn) / 16;
      const dir = new Vector3(Math.sin(spin) * Math.cos(rise), Math.sin(rise), Math.cos(spin) * Math.cos(rise));
      if (dir.y < 0) dir.negate();
      let worst = 0;
      for (const sample of samples) {
        const along = sample.dot(dir);
        const off = Math.sqrt(Math.max(0, sample.lengthSq() - along * along));
        worst = Math.max(worst, off);
      }
      if (worst < best) {
        best = worst;
        bestDir = dir;
      }
    }
  }
  return bestDir;
}

function frameTimes(action: AnimationAction) {
  const clip = action.getClip();
  const track = clip?.tracks.find((item) => item.name.includes("Hips") && item.name.endsWith("position"));
  return track ? Array.from(track.times) : [0];
}

function bones(model: Object3D) {
  return {
    leftUp: findBone(model, "LeftUpLeg"),
    leftLeg: findBone(model, "LeftLeg"),
    leftFoot: findBone(model, "LeftFoot"),
    rightUp: findBone(model, "RightUpLeg"),
    rightLeg: findBone(model, "RightLeg"),
    rightFoot: findBone(model, "RightFoot"),
    leftHand: findBone(model, "LeftHand"),
    rightArm: findBone(model, "RightArm"),
    rightFore: findBone(model, "RightForeArm"),
    rightHand: findBone(model, "RightHand"),
  };
}

function reach(up: Object3D, mid: Object3D, end: Object3D) {
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  up.getWorldPosition(a);
  mid.getWorldPosition(b);
  end.getWorldPosition(c);
  return a.distanceTo(b) + b.distanceTo(c) - 0.02;
}

function moveToWorld(bone: Object3D, world: Vector3) {
  const parent = bone.parent;
  if (!parent) {
    bone.position.copy(world);
    return;
  }
  parent.updateWorldMatrix(true, false);
  const local = world.clone();
  parent.worldToLocal(local);
  bone.position.copy(local);
  bone.updateMatrixWorld(true);
}

/** Shift the hips the minimum amount so both legs can still reach their planted feet. */
function seatHips(model: Object3D, leftHome: Vector3, rightHome: Vector3) {
  const hips = findBone(model, "Hips");
  const leftUp = findBone(model, "LeftUpLeg");
  const leftLeg = findBone(model, "LeftLeg");
  const leftFoot = findBone(model, "LeftFoot");
  const rightUp = findBone(model, "RightUpLeg");
  const rightLeg = findBone(model, "RightLeg");
  const rightFoot = findBone(model, "RightFoot");
  if (!hips || !leftUp || !leftLeg || !leftFoot || !rightUp || !rightLeg || !rightFoot) return;
  const leftReach = reach(leftUp, leftLeg, leftFoot);
  const rightReach = reach(rightUp, rightLeg, rightFoot);
  const here = new Vector3();
  hips.getWorldPosition(here);
  for (const [home, limit] of [
    [leftHome, leftReach],
    [rightHome, rightReach],
  ] as const) {
    const gap = here.distanceTo(home);
    if (gap > limit) here.addScaledVector(home.clone().sub(here).normalize(), gap - limit);
  }
  moveToWorld(hips, here);
}

function pinFoot(up: Object3D | undefined, knee: Object3D | undefined, foot: Object3D | undefined, home: Vector3, rotation: Quaternion) {
  if (!up || !knee || !foot) return;
  knee.getWorldPosition(pole);
  solveTwoBone(up, knee, foot, home, pole);
  setWorldQuaternion(foot, rotation);
}

/** After the clip has posed this frame: plant the feet, then the hands and the clubhead. */
export function correctFrame(model: Object3D, club: Object3D, time: number) {
  if (!fix) return;
  model.updateMatrixWorld(true);
  const rigBones = bones(model);
  seatHips(model, fix.leftFoot, fix.rightFoot);
  pinFoot(rigBones.leftUp, rigBones.leftLeg, rigBones.leftFoot, fix.leftFoot, fix.leftFootQ);
  pinFoot(rigBones.rightUp, rigBones.rightLeg, rigBones.rightFoot, fix.rightFoot, fix.rightFootQ);
  for (const toe of fix.toeLocal) toe.bone.quaternion.copy(toe.q);
  model.updateMatrixWorld(true);

  if (!rigBones.leftHand || !club.parent) return;
  const index = nearestFrame(fix.times, time);
  const span = Math.abs(index - fix.impactIndex);
  const fade = span >= range.impactFrames ? 0 : smooth(1 - span / range.impactFrames);
  if (fade > 0 && fix.impactGap.lengthSq() > 1e-8) {
    rigBones.leftHand.getWorldPosition(handPos);
    clubheadPosition(club, headPos);
    fromDir.subVectors(headPos, handPos);
    const room = Math.min(range.impactCap, fix.impactGap.length());
    toDir.copy(fix.impactGap).setLength(room * fade);
    toDir.add(fromDir);
    if (fromDir.lengthSq() > 1e-8 && toDir.lengthSq() > 1e-8) {
      rigBones.leftHand.getWorldQuaternion(worldQ);
      turn.setFromUnitVectors(fromDir.normalize(), toDir.normalize());
      turn.multiply(worldQ);
      setWorldQuaternion(rigBones.leftHand, turn);
      club.updateMatrixWorld(true);
    }
  }

  if (rigBones.rightArm && rigBones.rightFore && rigBones.rightHand) {
    const onShaft = closestOnShaft(club, rigBones.rightArm, rigBones.rightFore, rigBones.rightHand);
    gripPos.copy(onShaft);
    rigBones.rightFore.getWorldPosition(pole);
    solveTwoBone(rigBones.rightArm, rigBones.rightFore, rigBones.rightHand, gripPos, pole);
    club.getWorldQuaternion(worldQ);
    setWorldQuaternion(rigBones.rightHand, worldQ.multiply(fix.palmRel));
  }
}

function nearestFrame(times: number[], time: number) {
  let best = 0;
  let gap = Infinity;
  for (let i = 0; i < times.length; i += 1) {
    const next = Math.abs(times[i] - time);
    if (next < gap) {
      gap = next;
      best = i;
    }
  }
  return best;
}

function smooth(value: number) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

function faceAndGround(rig: Object3D, model: Object3D, action: AnimationAction) {
  rig.position.set(0, 0, 0);
  rig.rotation.set(0, 0, 0);
  rig.updateMatrixWorld(true);
  holdFrame(action, 0);
  model.updateMatrixWorld(true);
  const leftShoulder = findBone(model, "LeftShoulder") ?? findBone(model, "LeftArm");
  const rightShoulder = findBone(model, "RightShoulder") ?? findBone(model, "RightArm");
  const left = new Vector3();
  const right = new Vector3();
  leftShoulder?.getWorldPosition(left);
  rightShoulder?.getWorldPosition(right);
  left.sub(right);
  left.y = 0;
  if (left.lengthSq() < 1e-8) left.set(0, 0, -1);
  left.normalize();
  rig.rotation.y = Math.atan2(left.x, -left.z);
  rig.updateMatrixWorld(true);
  holdFrame(action, 0);
  model.updateMatrixWorld(true);
  rig.position.y += -soleHeight(model);
  rig.updateMatrixWorld(true);
}

/** One placement. The lowest clubhead sits just behind the ball, and the feet are remembered there. */
export function placeRig(rig: Object3D, model: Object3D, action: AnimationAction, club: Object3D) {
  const hand = findBone(model, "LeftHand");
  if (!hand) throw new Error("Lead hand missing");
  faceAndGround(rig, model, action);
  const timesForShaft = frameTimes(action);
  const shaft = shaftThroughTrailHand(model, action, timesForShaft);
  mountClub(club, hand, range.gripEuler, shaft);

  const times = frameTimes(action);
  const rightHand = findBone(model, "RightHand");
  const heads: Vector3[] = [];
  const speeds: number[] = [];
  const right = new Vector3();
  let previous: Vector3 | null = null;
  let previousTime = times[0] ?? 0;
  for (const time of times) {
    holdFrame(action, time);
    model.updateMatrixWorld(true);
    const point = new Vector3();
    clubheadPosition(club, point);
    heads.push(point.clone());
    rightHand?.getWorldPosition(right);
    const step = Math.max(1e-4, time - previousTime);
    speeds.push(previous ? right.distanceTo(previous) / step : 0);
    previous = right.clone();
    previousTime = time;
  }
  let impactIndex = 0;
  for (let i = 1; i < speeds.length; i += 1) {
    if (speeds[i] > speeds[impactIndex]) impactIndex = i;
  }
  let low = 0;
  for (let i = 1; i < heads.length; i += 1) {
    if (heads[i].y < heads[low].y) low = i;
  }
  rig.position.x += ball.x - heads[low].x;
  rig.position.z += ball.z + range.behindBall - heads[low].z;
  rig.updateMatrixWorld(true);

  holdFrame(action, 0);
  model.updateMatrixWorld(true);
  const rigBones = bones(model);
  const toeLocal: SwingFix["toeLocal"] = [];
  for (const name of ["LeftToeBase", "LeftToe_End", "RightToeBase", "RightToe_End"]) {
    const bone = findBone(model, name);
    if (bone) toeLocal.push({ bone, q: bone.quaternion.clone() });
  }
  const leftFoot = new Vector3();
  const rightFoot = new Vector3();
  const leftFootQ = new Quaternion();
  const rightFootQ = new Quaternion();
  rigBones.leftFoot?.getWorldPosition(leftFoot);
  rigBones.rightFoot?.getWorldPosition(rightFoot);
  rigBones.leftFoot?.getWorldQuaternion(leftFootQ);
  rigBones.rightFoot?.getWorldQuaternion(rightFootQ);
  const palmRel = new Quaternion();
  if (rigBones.rightHand) {
    club.getWorldQuaternion(worldQ);
    rigBones.rightHand.getWorldQuaternion(palmRel);
    palmRel.premultiply(worldQ.invert());
  }

  holdFrame(action, times[impactIndex] ?? 0);
  model.updateMatrixWorld(true);
  clubheadPosition(club, headPos);
  const impactGap = ball.clone().sub(headPos);
  if (impactGap.length() > range.impactCap) impactGap.setLength(range.impactCap);

  fix = {
    impactTime: times[impactIndex] ?? 0,
    times,
    impactIndex,
    leftFoot,
    rightFoot,
    leftFootQ,
    rightFootQ,
    toeLocal,
    palmRel,
    impactGap,
  };
  holdFrame(action, 0);
  correctFrame(model, club, 0);
  return fix;
}

export function currentFix() {
  return fix;
}

export function gripDistance(club: Object3D, hand: Vector3) {
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
