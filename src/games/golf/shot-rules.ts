/** Shot rules from the signed-off prototype. Every number matches that file. */

export type SwipePoint = { x: number; y: number; t: number; w: number; h: number };

export type BalanceLock = { x: number; y: number };

export type PerfectChecks = {
  balance: boolean;
  length: boolean;
  tempo: boolean;
  path: boolean;
  face: boolean;
  strike: boolean;
};

export type LetDown = { what: string; fix: string };

export type ShotReading = {
  key: string;
  clubMph: number;
  path: number;
  face: number;
  strike: "air" | "heel" | "toe" | "center";
  contact: "clean" | "fat" | "thin" | "top";
  speedTier: "hard" | "normal" | "slow";
  bal: number;
  checks: PerfectChecks;
  perfect: boolean;
  purity: number;
  letDown: LetDown[];
  over: number;
  strikeOff: number;
  offN: number;
};

const BULL = 0.14;

function angleOf(a: SwipePoint, b: SwipePoint) {
  return (Math.atan2(b.x - a.x, a.y - b.y) * 180) / Math.PI;
}

function deadzone(v: number, d: number) {
  return Math.abs(v) <= d ? 0 : v - Math.sign(v) * d;
}

function pathFrom(a: SwipePoint, b: SwipePoint, n: number) {
  const soft = n < 3 ? 0.5 : 1;
  return Math.max(-14, Math.min(14, deadzone(angleOf(a, b), n < 3 ? 10 : 3) * 0.45 * soft));
}

export function classifyShot(sh: { strike: string; contact: string; face: number; path: number }) {
  if (sh.strike === "air") return "air-shot";
  if (sh.contact === "top") return "topped";
  if (sh.contact === "thin") return "thin";
  if (sh.contact === "fat") return "fat";
  if (sh.strike === "heel") return "heel";
  if (sh.strike === "toe") return "toe";
  const start = 0.85 * sh.face + 0.15 * sh.path;
  const curve = sh.face - sh.path;
  if (curve > 6) return start < -3 ? "pull-slice" : start > 3 ? "push-slice" : "slice";
  if (curve < -6) return "hook";
  if (start < -4) return "pull";
  if (start > 4) return "push";
  if (curve >= 2.5) return "fade";
  if (curve <= -2.5) return "draw";
  return "straight";
}

function closeness(v: number) {
  return Math.max(0, Math.min(1, v));
}

/** Tuned so the site's flight lands the signed-off yardages. The shape of the old mapping stays. */
export function swingSpeedMul(speedN: number, balanceDist: number) {
  return Math.max(0.8, Math.min(1.12, 0.8 + 0.08 * speedN)) * (1 - 0.25 * Math.min(1, balanceDist));
}

export function perfectSpeedMul(purity: number) {
  return 1.2784 + 0.1192 * purity;
}

export function clubSpeedMph(backLength: number, speedMul: number) {
  return (50.8 + 41.5 * Math.min(backLength, 1)) * speedMul;
}

export function judgeSwipe(input: {
  samples: SwipePoint[];
  start: SwipePoint;
  cross: SwipePoint;
  letGo: boolean;
  backLength: number;
  locked: BalanceLock;
  shotsTaken: number;
}): ShotReading | null {
  const samples = input.samples;
  const g0 = input.start;
  const cross = input.cross;
  const letGo = input.letGo;
  const bLen = input.backLength;
  const n = input.shotsTaken;
  const soft = n < 3 ? 1.3 : 1;
  const rev = samples[0];
  const progress = (rev.y - cross.y) / Math.max(1, rev.y - g0.y);
  const hC = cross.h;
  const wC = cross.w;
  let j = samples.length - 1;
  while (j > 0 && cross.t - samples[j].t < 0.08) j -= 1;
  const dtS = Math.max(0.016, cross.t - samples[j].t);
  const speedN = (samples[j].y - cross.y) / dtS / hC;
  let peak = 0;
  for (let k = 1; k < samples.length; k += 1) {
    let m = k;
    while (m > 0 && samples[k].t - samples[m].t < 0.05) m -= 1;
    const d = samples[k].t - samples[m].t;
    if (d >= 0.03) peak = Math.max(peak, (samples[m].y - samples[k].y) / d / hC);
  }
  const tBack = Math.max(0.05, rev.t - g0.t);
  const tDown = Math.max(0.02, cross.t - rev.t);
  const ratio = tDown / tBack;
  const cut = Math.max(1, Math.floor(samples.length * 0.65));
  const a1 = angleOf(samples[0], samples[cut]);
  const a2 = angleOf(samples[cut], samples[samples.length - 1]);
  const curl = samples.length > 4 ? a2 - a1 : 0;
  let path = pathFrom(rev, cross, n);
  const faceOff = Math.max(-12, Math.min(12, deadzone(curl, n < 3 ? 14 : 5) * 0.4 * (n < 3 ? 0.5 : 1)));
  let contact: ShotReading["contact"] = "clean";
  if (letGo && progress < 0.8) contact = "fat";
  else if (speedN < 0.55 * peak && samples.length > 5) contact = "fat";
  else if (speedN > 6.5 * soft) contact = "top";
  else if (speedN > 4.6 * soft || ratio < 0.08 / soft) contact = "thin";
  const offN = (cross.x - g0.x) / wC;
  if (bLen < 0.15) return null;

  const L = input.locked;
  const bx = -L.x;
  const by = L.y;
  const bDist = Math.hypot(L.x, L.y);
  const balOK = bDist < BULL;
  const strikeOff = offN - by * 0.12;
  let strike: ShotReading["strike"] =
    Math.abs(strikeOff) > 0.2 * soft ? "air" : strikeOff < -0.07 * soft ? "heel" : strikeOff > 0.07 * soft ? "toe" : "center";
  if (contact === "clean" && bx > 0.4) contact = bx > 0.7 ? "thin" : "fat";
  if (bx < 0) path += bx * 12;
  let face = path + faceOff + (contact === "thin" || contact === "top" ? 2 : 0) - Math.max(0, bx) * 5;
  let speedMul = swingSpeedMul(speedN, bDist);
  const over = Math.max(0, (bLen - 1) / 0.2);

  const checks: PerfectChecks = {
    balance: balOK,
    length: bLen >= 0.93 && bLen <= 1.07,
    tempo: ratio >= 0.18 && ratio <= 0.5 && speedN >= 1.8 && speedN <= 4.5,
    path: Math.abs(angleOf(rev, cross)) <= 3.5,
    face: Math.abs(curl) <= 7,
    strike: Math.abs(strikeOff) <= 0.04,
  };
  const perfect = n >= 3 && contact === "clean" && Object.keys(checks).every((k) => checks[k as keyof PerfectChecks]);
  const purity =
    (closeness(1 - bDist / BULL) +
      closeness(1 - Math.abs(bLen - 1) / 0.07) +
      closeness(1 - 0.5 * Math.abs(ratio - 0.33) / 0.17 - 0.5 * Math.abs(speedN - 3) / 1.5) +
      closeness(1 - Math.abs(angleOf(rev, cross)) / 3.5) +
      closeness(1 - Math.abs(curl) / 7) +
      closeness(1 - Math.abs(strikeOff) / 0.04)) /
    6;
  if (perfect) {
    strike = "center";
    path = angleOf(rev, cross) * 0.12;
    face = path + curl * 0.12;
    speedMul = perfectSpeedMul(purity);
  }

  const ang = angleOf(rev, cross);
  const issues: { s: number; what: string; fix: string }[] = [];
  const weight =
    Math.abs(by) > Math.abs(bx)
      ? by > 0
        ? "forward on your toes"
        : "back on your heels"
      : bx > 0
        ? "back on your trail side"
        : "lunging onto your lead side";
  if (!checks.balance) {
    issues.push({
      s: bDist * 3,
      what: "You pressed with your weight " + weight + ".",
      fix: "Press as the marker crosses the bullseye.",
    });
  }
  if (letGo && progress < 0.8) {
    issues.push({
      s: 3,
      what: "You let go before your swipe got back to the dotted line.",
      fix: "Swipe all the way up through where you started.",
    });
  }
  if (!checks.length) {
    issues.push({
      s: Math.abs(bLen - 1) * 6,
      what: bLen < 1 ? "Your backswing was too short." : "You overswung.",
      fix: "Stop in the gold band on the meter.",
    });
  }
  if (!checks.tempo) {
    issues.push({
      s: 1.5,
      what: speedN > 4.5 || ratio < 0.18 ? "You rushed the downswing." : "Your downswing was too slow.",
      fix: "Swipe up at a smooth, even pace.",
    });
  }
  if (!checks.path) {
    issues.push({
      s: Math.abs(ang) / 6,
      what: "Your swipe went up to the " + (ang < 0 ? "left" : "right") + ".",
      fix: "Swipe straight back up.",
    });
  }
  if (!checks.face) {
    issues.push({
      s: Math.abs(curl) / 8,
      what: "Your swipe curled " + (curl < 0 ? "left" : "right") + " at the end.",
      fix: "Keep the end of your swipe straight.",
    });
  }
  if (!checks.strike) {
    issues.push({
      s: Math.abs(strikeOff) * 20,
      what:
        "You came back up " +
        (strikeOff < 0 ? "left" : "right") +
        " of the dotted line" +
        (Math.abs(by) > 0.3 ? ", partly from your balance" : "") +
        ".",
      fix: "Come back up through the middle of the dotted line.",
    });
  }
  issues.sort((a, b) => b.s - a.s);

  const reading: ShotReading = {
    key: "",
    clubMph: clubSpeedMph(bLen, speedMul),
    path,
    face,
    strike,
    contact,
    speedTier: speedN > 4 ? "hard" : speedN < 1.5 ? "slow" : "normal",
    bal: Math.min(1, 0.6 * over + (contact === "top" ? 0.5 : contact === "thin" ? 0.3 : 0) + (balOK ? 0 : bDist)),
    checks,
    perfect,
    purity,
    letDown: issues.map((item) => ({ what: item.what, fix: item.fix })),
    over,
    strikeOff,
    offN,
  };
  reading.key = classifyShot(reading);
  return reading;
}
