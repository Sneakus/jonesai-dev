import { judgeSwipe, type BalanceLock, type ShotReading, type SwipePoint } from "./shot-rules";
import { IMPACT_TIME, SWING_END } from "./swing-pose";

export const TOP_TIME = 0.76;
export const BULL = 0.14;

export type Pendulum = {
  phase: number;
  plane: number;
  planeVel: number;
  amp: number;
  miss: number;
  missT: number;
};

export type Marker = { x: number; y: number };

export function makePendulum(random: () => number = Math.random): Pendulum {
  return { phase: 0, plane: random() * Math.PI, planeVel: 0.8, amp: 0.85, miss: 0, missT: 0 };
}

export function stepMarker(pend: Pendulum, dt: number, random: () => number = Math.random): Marker {
  const turn = (2 * Math.PI) / 1;
  pend.phase += turn * dt;
  pend.planeVel += (random() - 0.5) * 1.5 * dt;
  pend.planeVel = Math.max(0.4, Math.min(1.4, pend.planeVel));
  pend.plane += pend.planeVel * dt;
  pend.missT += dt * 0.37;
  pend.miss = 0.13 * Math.sin(pend.missT * 2.1) * Math.sin(pend.missT * 0.9 + 1);
  pend.amp = 0.8 + 0.15 * Math.sin(pend.phase * 0.13);
  const along = pend.amp * Math.sin(pend.phase);
  const across = pend.miss * Math.cos(pend.phase);
  const ux = Math.cos(pend.plane);
  const uy = Math.sin(pend.plane);
  return { x: ux * along - uy * across, y: uy * along + ux * across };
}

export type Gesture = {
  phase: "idle" | "back" | "down" | "through" | "demo";
  tDisp: number;
  tVel: number;
  tSwing: number;
  backLength: number;
  locked: BalanceLock | null;
  marker: Marker;
  pend: Pendulum;
  start: SwipePoint | null;
  bottom: SwipePoint | null;
  maxDy: number;
  samples: SwipePoint[];
  trail: SwipePoint[];
  shot: ShotReading | null;
  launched: boolean;
  shotsTaken: number;
  slow: boolean;
  perfectOn: boolean;
};

export function makeGesture(): Gesture {
  return {
    phase: "idle",
    tDisp: 0,
    tVel: 0,
    tSwing: 0,
    backLength: 0,
    locked: null,
    marker: { x: 0, y: 0 },
    pend: makePendulum(),
    start: null,
    bottom: null,
    maxDy: 0,
    samples: [],
    trail: [],
    shot: null,
    launched: false,
    shotsTaken: 0,
    slow: false,
    perfectOn: false,
  };
}

function bell(t: number, c: number, w: number) {
  const x = (t - c) / w;
  return Math.exp(-x * x);
}

function smooth(x: number) {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

export function stepGesture(play: Gesture, dt: number, reduce: boolean) {
  if (!play.locked) play.marker = stepMarker(play.pend, dt);
  let launch = false;
  if (play.phase === "back" || play.phase === "idle") {
    const target = play.phase === "back" ? TOP_TIME * Math.min(1, play.backLength) : play.tSwing >= SWING_END ? null : 0;
    if (target !== null) {
      play.tVel += (90 * (target - play.tDisp) - 14 * play.tVel) * dt;
      play.tDisp += play.tVel * dt;
      play.tDisp = Math.max(0, Math.min(TOP_TIME, play.tDisp));
    } else if (play.shot && play.phase === "idle") {
      play.locked = null;
    }
  } else if (play.phase === "down") {
    const last = play.samples[play.samples.length - 1];
    const rev = play.samples[0];
    const start = play.start;
    const prog = start ? Math.max(0, Math.min(1, (rev.y - last.y) / Math.max(1, rev.y - start.y))) : 0;
    const tgt = TOP_TIME + (IMPACT_TIME - 0.02 - TOP_TIME) * prog;
    play.tSwing += (tgt - play.tSwing) * Math.min(1, dt * 25);
  } else if (play.phase === "through" || play.phase === "demo") {
    const prev = play.tSwing;
    const slow = !reduce && play.slow ? 1 - 0.85 * bell(play.tSwing, IMPACT_TIME + 0.02, 0.06) : 1;
    play.perfectOn = !reduce && play.slow && play.tSwing > 0.93 && play.tSwing < 1.1;
    play.tSwing = Math.min(SWING_END, play.tSwing + dt * slow);
    if (!play.launched && prev < IMPACT_TIME && play.tSwing >= IMPACT_TIME) {
      play.launched = true;
      launch = true;
    }
    if (play.tSwing >= SWING_END) play.phase = "idle";
  }
  const time = play.phase === "back" || (play.phase === "idle" && play.tSwing < SWING_END) ? play.tDisp : play.tSwing;
  const trail = play.phase === "down" || ((play.phase === "through" || play.phase === "demo") && play.tSwing < SWING_END);
  return { time, trail, launch, slowScale: play.perfectOn ? 1 - 0.85 * bell(play.tSwing, IMPACT_TIME + 0.02, 0.06) : 1 };
}

export function beginSwing(play: Gesture, point: SwipePoint) {
  play.phase = "back";
  play.tDisp = 0;
  play.tVel = 0;
  play.tSwing = 0;
  play.trail = [point];
  play.locked = { x: play.marker.x, y: play.marker.y };
  play.start = point;
  play.bottom = point;
  play.maxDy = 0;
  play.backLength = 0;
  play.samples = [];
  play.shot = null;
  play.launched = false;
  play.slow = false;
  play.perfectOn = false;
}

export function moveSwing(play: Gesture, point: SwipePoint) {
  if (play.phase !== "back" && play.phase !== "down") return null;
  play.trail.push(point);
  if (play.trail.length > 40) play.trail.shift();
  if (play.phase === "back") {
    const start = play.start;
    if (!start) return null;
    const dy = point.y - start.y;
    if (dy > play.maxDy) {
      play.maxDy = dy;
      play.bottom = point;
    }
    play.backLength = Math.min(1.25, play.maxDy / (0.3 * point.h));
    if (play.maxDy > 20 && play.bottom && play.bottom.y - point.y > 12) {
      play.phase = "down";
      play.samples = [play.bottom, point];
      play.tSwing = TOP_TIME;
    }
    return null;
  }
  play.samples.push(point);
  const start = play.start;
  if (start && point.y <= start.y) return finishSwing(play, point, false);
  return null;
}

export function finishSwing(play: Gesture, point: SwipePoint, letGo: boolean): ShotReading | null {
  if (play.phase === "back") {
    play.phase = "idle";
    play.locked = null;
    return null;
  }
  if (play.phase !== "down" || !play.start || !play.locked) return null;
  play.samples.push(point);
  const shot = judgeSwipe({
    samples: play.samples,
    start: play.start,
    cross: point,
    letGo,
    backLength: play.backLength,
    locked: play.locked,
    shotsTaken: play.shotsTaken,
  });
  if (!shot) {
    play.phase = "idle";
    play.locked = null;
    return null;
  }
  play.shot = shot;
  play.slow = shot.perfect;
  play.phase = "through";
  play.launched = false;
  play.shotsTaken += 1;
  return shot;
}

export function demoSwing(play: Gesture, shot: ShotReading) {
  play.phase = "demo";
  play.tSwing = 0;
  play.launched = false;
  play.trail = [];
  play.locked = null;
  play.slow = false;
  play.perfectOn = false;
  play.shot = shot;
}

export { smooth };
