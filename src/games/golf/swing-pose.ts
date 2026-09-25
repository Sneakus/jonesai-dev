import { clubDirAt, sampleSwing } from "./swing-keys";
import { Vec } from "./swing-vec";

const deg = Math.PI / 180;
export const CLUB_LENGTH = 1.12;
export const IMPACT_TIME = 0.98;
export const SWING_END = 1.38;
const GRIP_GAP = 0.06;

const up = new Vec(0, 1, 0);
export const LEAD_ANKLE = new Vec(-0.95, 0.07, -0.02);
export const LEAD_TOE = new Vec(-0.77, 0.02, -0.06);
const TRAIL_ANKLE0 = new Vec(-0.95, 0.07, 0.44);
export const TRAIL_TOE = new Vec(-0.77, 0.02, 0.44);

function smoothstep(x: number) {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

function slerpVec(a: Vec, b: Vec, w: number) {
  const d = Math.min(1, Math.max(-1, a.dot(b)));
  const th = Math.acos(d);
  if (th < 1e-4) return a.clone();
  const s = Math.sin(th);
  return a
    .clone()
    .multiplyScalar(Math.sin((1 - w) * th) / s)
    .addScaledVector(b, Math.sin(w * th) / s)
    .normalize();
}

export function twoBone(root: Vec, target: Vec, l1: number, l2: number, pole: Vec) {
  const toT = target.clone().sub(root);
  const dist = toT.length();
  const maxR = (l1 + l2) * 0.985;
  const minR = Math.abs(l1 - l2) + 0.01;
  const d = Math.min(Math.max(dist, minR), maxR);
  const u = toT.normalize();
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const toP = pole.clone().sub(root);
  const bend = toP.sub(u.clone().multiplyScalar(toP.dot(u)));
  if (bend.lengthSq() < 1e-8) bend.set(0, -1, 0);
  bend.normalize();
  const mid = root.clone().addScaledVector(u, l1 * cosA).addScaledVector(bend, l1 * sinA);
  const end = root.clone().addScaledVector(u, d);
  return { mid, end };
}

export type SwingPose = {
  H: Vec;
  head: Vec;
  clubDir: Vec;
  faceN: Vec;
  toe: Vec;
  crown: Vec;
  hosel: Vec;
  S: Vec;
  P: Vec;
  neck: Vec;
  headPos: Vec;
  leadSh: Vec;
  trailSh: Vec;
  leadHip: Vec;
  trailHip: Vec;
  leadElbow: Vec;
  leadWrist: Vec;
  trailElbow: Vec;
  trailWrist: Vec;
  leadKnee: Vec;
  leadAnkle: Vec;
  trailKnee: Vec;
  trailAnkle: Vec;
};

export function swingPose(t: number): SwingPose {
  const H = new Vec().fromArray(sampleSwing("H", t));
  const sy = sampleSwing("sy", t)[0] * deg;
  const py = sampleSwing("py", t)[0] * deg;
  const P = new Vec().fromArray(sampleSwing("P", t));
  const tilt = sampleSwing("tilt", t)[0] * deg;
  const lift = sampleSwing("lift", t)[0];
  const sb = sampleSwing("sb", t)[0] * deg;

  const turnK = 0.5 + 0.5 * smoothstep((t - IMPACT_TIME) / 0.15);
  const fwd = new Vec(1, 0, 0).applyAxisAngle(up, Math.max(0, py) * turnK);
  const spine = fwd.multiplyScalar(Math.sin(tilt)).addScaledVector(up, Math.cos(tilt)).normalize();
  const S = P.clone().addScaledVector(spine, 0.48);
  const sLat = new Vec(0, 0, -1).applyAxisAngle(spine, sy);
  const chestF = new Vec().crossVectors(sLat, spine).normalize();
  sLat.applyAxisAngle(chestF, sb);
  const chestFwd = new Vec().crossVectors(sLat, spine).normalize();
  const leadSh = S.clone().addScaledVector(sLat, 0.17);
  const trailSh = S.clone().addScaledVector(sLat, -0.17);
  const pLat = new Vec(0, 0, -1).applyAxisAngle(up, py);
  const leadHip = P.clone().addScaledVector(pLat, 0.1);
  const trailHip = P.clone().addScaledVector(pLat, -0.1);
  const headPos = S.clone().addScaledVector(spine, 0.26);
  const neck = S.clone().addScaledVector(spine, 0.13);

  const gDeg = sampleSwing("g", t)[0];
  const gr = gDeg * deg;
  let clubDir = clubDirAt(gDeg);
  const faceN = new Vec(0.743, -0.669, 0)
    .normalize()
    .multiplyScalar(Math.sin(gr))
    .addScaledVector(new Vec(0, 0, 1), -Math.cos(gr))
    .normalize();
  const finW = smoothstep((t - 1.1) / 0.28);
  if (finW > 0) {
    const acrossNeck = sLat.clone().multiplyScalar(-0.5).addScaledVector(chestFwd, -0.7).addScaledVector(up, -0.5).normalize();
    clubDir = slerpVec(clubDir, acrossNeck, finW);
    faceN.addScaledVector(clubDir, -faceN.dot(clubDir)).normalize();
  }
  const eAx = new Vec().crossVectors(clubDir, faceN).normalize();
  const toe = clubDir.clone().multiplyScalar(Math.cos(42 * deg)).addScaledVector(eAx, Math.sin(42 * deg)).normalize();
  const crown = new Vec().crossVectors(toe, faceN).normalize();
  const head = H.clone().addScaledVector(clubDir, CLUB_LENGTH);
  const trailHand = H.clone().addScaledVector(clubDir, GRIP_GAP);
  const hosel = head.clone().addScaledVector(toe, -0.05).addScaledVector(crown, 0.02).addScaledVector(faceN, -0.01);

  const w = Math.min(1, Math.max(0, (t - IMPACT_TIME) / 0.07));
  const leadPole = P.clone().lerp(leadSh.clone().addScaledVector(spine, -0.4).addScaledVector(sLat, 0.35), w);
  const trailPole = P.clone().lerp(trailSh.clone().addScaledVector(up, -0.6).addScaledVector(sLat, -0.1), w);
  const leadArm = twoBone(leadSh, H, 0.31, 0.31, leadPole);
  const trailArm = twoBone(trailSh, trailHand, 0.31, 0.31, trailPole);

  const fw = Math.min(1, lift / 0.1);
  const trailAnkle = TRAIL_ANKLE0.clone().lerp(TRAIL_TOE.clone().add(new Vec(-0.02, 0.17, -0.03)), fw);
  const leadLeg = twoBone(leadHip, LEAD_ANKLE, 0.46, 0.44, leadHip.clone().add(new Vec(0.7, -0.3, -0.15)));
  const trailKneePole = trailHip
    .clone()
    .add(new Vec(0.7, -0.3, 0.15))
    .lerp(trailHip.clone().addScaledVector(chestFwd, 0.6).addScaledVector(sLat, 0.1).addScaledVector(up, -0.2), fw);
  const trailLeg = twoBone(trailHip, trailAnkle, 0.46, 0.44, trailKneePole);

  return {
    H,
    head,
    clubDir,
    faceN,
    toe,
    crown,
    hosel,
    S,
    P,
    neck,
    headPos,
    leadSh,
    trailSh,
    leadHip,
    trailHip,
    leadElbow: leadArm.mid,
    leadWrist: leadArm.end,
    trailElbow: trailArm.mid,
    trailWrist: trailArm.end,
    leadKnee: leadLeg.mid,
    leadAnkle: leadLeg.end,
    trailKnee: trailLeg.mid,
    trailAnkle: trailLeg.end,
  };
}

/** Grip, shaft, head and face, placed the same way as the prototype. */
export function driverFrame(p: SwingPose) {
  return {
    gripEnd: p.H.clone().addScaledVector(p.clubDir, -0.03),
    gripLow: p.H.clone().addScaledVector(p.clubDir, 0.24),
    hosel: p.hosel,
    headCentre: p.head.clone().addScaledVector(p.faceN, -0.045),
    face: p.head.clone().addScaledVector(p.faceN, 0.009),
    toe: p.toe,
    crown: p.crown,
    faceN: p.faceN,
  };
}
