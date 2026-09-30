import {
  activeClayFeel,
  desktopClaySettings,
  hardCrosserSpeedMul,
  hardSizeWeights,
  hardWindMul,
  isHardModeActive,
  type HardThrowKind,
} from "./clay-feel";
import { sizeAero, stepFlight } from "./clay-flight";

export const settings = {
  gravity: 1000,
  pauseBetweenClays: 560,
  claySize: desktopClaySettings.claySize,
  hitAreaSize: desktopClaySettings.hitAreaSize,
  reloadTime: 350,
  patternSize: 28,
  pelletCount: 12,
  shakeStrength: 2,
  claysPerRound: 5,
  fastClaysPerRound: 1,
  fastClaySize: 0.5,
  throwCrosser: 3,
  throwAway: 2,
  throwIncomer: 2,
  throwHigh: 2,
  throwRabbit: 2,
  throwBattue: 2,
  throwTeal: 2,
  sizeStandard: 6,
  sizeMidi: 2,
  sizeMini: 1,
  windStrength: 0.1,
  aimLeft: 1 / 3,
  aimRight: 2 / 3,
  handFade: 100,
  handRecoil: 120,
  handSize: 0.45,
  handSizePhone: 0.36,
  handSlide: 6,
  nearDistance: 0.42,
  farDistance: 1,
  shotTravelNear: 80,
  shotTravelFar: 350,
  speedMin: desktopClaySettings.speedMin,
  speedMax: desktopClaySettings.speedMax,
  sizeNear: 1.34,
  sizeFar: 0.62,
  fairVisible: 0.75,
  fairMargin: 0.04,
  fairTime: 1.05,
  fairHand: 0.25,
  fairTries: 28,
  perfectDuration: 5200,
  perfectSpinTime: 1800,
  perfectSweepStart: 1800,
  perfectSweepTime: 2500,
  perfectShotCount: 12,
  perfectRecoilTime: 120,
  perfectFireworkTravel: 260,
  perfectSparkTime: 450,
  winnerBannerStart: 4600,
  winnerBannerDropTime: 400,
  perfectFireworkSize: 4,
  perfectSparkCount: 6,
  handSettleTime: 420,
};

export type ThrowKind = HardThrowKind;

export type Clay = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
  kind: ThrowKind;
  distance: number;
  age: number;
  /** Soft air-time hint used only when nudging launch speed for fairness. */
  duration: number;
  gravityScale: number;
  roll: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  cx: number;
  cy: number;
  distance0: number;
  distance1: number;
  sizeScale: number;
  wind: number;
  hang: number;
  hangLimit: number;
  curl: number;
  drag: number;
  lift: number;
  distanceVel: number;
  launchDirX: number;
  /** Rabbit floor bounce energy, set at launch. */
  bounce: number;
};

function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function distanceT(distance: number) {
  const span = settings.farDistance - settings.nearDistance;
  if (Math.abs(span) < 0.0001) {
    return 0;
  }
  return clamp01((distance - settings.nearDistance) / span);
}

export function pickDistance(from: number, to: number) {
  const start = lerp(settings.nearDistance, settings.farDistance, from);
  const end = lerp(settings.nearDistance, settings.farDistance, to);
  return rand(Math.min(start, end), Math.max(start, end));
}

export function pickPace(from: number, to: number) {
  return lerp(settings.speedMin, settings.speedMax, rand(from, to));
}

export function pickSize() {
  const weights = hardSizeWeights(
    settings.sizeStandard,
    settings.sizeMidi,
    settings.sizeMini,
  );
  const options = [
    { scale: 1, weight: weights.standard },
    { scale: 0.75, weight: weights.midi },
    { scale: 0.5, weight: weights.mini },
  ];
  const total = options.reduce((sum, option) => sum + Math.max(0, option.weight), 0);
  let roll = Math.random() * (total || 1);
  for (const option of options) {
    roll -= Math.max(0, option.weight);
    if (roll <= 0) {
      return option.scale;
    }
  }
  return 1;
}

export function lookOf(clay: Clay, draw = activeClayFeel().draw) {
  const t = distanceT(clay.distance);
  const width =
    settings.claySize *
    lerp(settings.sizeNear, settings.sizeFar, t) *
    clay.sizeScale *
    draw;
  const disc = width / 2;
  const pale = t * 0.4;
  if (clay.kind === "rabbit") {
    return { rx: Math.max(disc * 0.38, 6), ry: disc, pale, disc };
  }
  if (clay.kind === "battue") {
    const flip = Math.min(1, Math.abs(clay.roll) / 2.2);
    return {
      rx: disc * lerp(0.78, 1, flip),
      ry: disc * (24 / 78) * lerp(0.28, 1.2, flip),
      pale,
      disc,
    };
  }
  return { rx: disc, ry: disc * (24 / 78), pale, disc };
}

export function placePath(target: Clay, amount: number, boxWidth: number) {
  // Kept for older call sites; live flight uses stepClay physics only.
  void amount;
  void boxWidth;
  void target;
}

export function stepClay(clay: Clay, dt: number, boxWidth: number, boxHeight: number) {
  void boxWidth;
  stepFlight(clay, dt, settings.gravity);

  if (clay.kind === "battue") {
    clay.roll += Math.abs(clay.vx) * dt * 0.02;
  }

  if (clay.kind === "rabbit") {
    const look = lookOf(clay);
    const floor = boxHeight - look.ry;
    if (clay.y >= floor && clay.vy >= 0) {
      clay.y = floor;
      // Physical bounce using energy set at launch - not a timed script.
      clay.vy = -Math.abs(clay.bounce);
      clay.bounce *= 0.72;
    }
    clay.roll += clay.vx * dt * 0.035;
  }
}

export function clayGone(clay: Clay, boxWidth: number, boxHeight: number) {
  const look = lookOf(clay);
  const left = clay.vx < 0 && clay.x < -look.rx * 1.6;
  const right = clay.vx > 0 && clay.x > boxWidth + look.rx * 1.6;
  const dropped = clay.y > boxHeight + look.ry * 1.6;
  const climbed = clay.kind !== "rabbit" && clay.y < -look.ry * 2.4;
  return left || right || dropped || climbed;
}

export function flightIsFair(
  source: Clay,
  boxWidth: number,
  boxHeight: number,
  hidden: (x: number, y: number) => boolean = () => false,
) {
  const ghost: Clay = { ...source };
  const dt = 1 / 60;
  let total = 0;
  let insideTime = 0;
  let hiddenTime = 0;
  const marginX = boxWidth * settings.fairMargin;
  const marginY = boxHeight * settings.fairMargin;
  while (total < 8 && !clayGone(ghost, boxWidth, boxHeight)) {
    const inside =
      ghost.x >= marginX &&
      ghost.x <= boxWidth - marginX &&
      ghost.y >= marginY &&
      ghost.y <= boxHeight - marginY;
    if (inside) {
      insideTime += dt;
      if (hidden(ghost.x, ghost.y)) {
        hiddenTime += dt;
      }
    }
    total += dt;
    stepClay(ghost, dt, boxWidth, boxHeight);
  }
  if (total <= 0 || insideTime <= 0) {
    return false;
  }
  const shootable = insideTime - hiddenTime;
  return (
    insideTime / total >= settings.fairVisible &&
    shootable >= settings.fairTime &&
    hiddenTime / insideTime <= settings.fairHand
  );
}

export function applyTouchSpeed(clay: Clay) {
  const speed = activeClayFeel().speed;
  if (speed === 1) {
    return clay;
  }
  clay.vx *= speed;
  clay.vy *= speed;
  clay.distanceVel *= speed;
  clay.bounce *= speed;
  clay.duration /= speed;
  return clay;
}

function windAmount() {
  return (Math.random() - 0.5) * 2 * settings.windStrength * hardWindMul();
}

export function freshClay(
  kind: ThrowKind,
  distance: number,
  sizeScale: number,
): Clay {
  const aero = sizeAero(sizeScale);
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    alive: true,
    kind,
    distance,
    age: 0,
    duration: 0,
    gravityScale: 1,
    roll: Math.random() * Math.PI * 2,
    x0: 0,
    y0: 0,
    x1: 0,
    y1: 0,
    cx: 0,
    cy: 0,
    distance0: distance,
    distance1: distance,
    sizeScale,
    wind: windAmount(),
    hang: 0,
    hangLimit: sizeScale <= 0.55 ? 0.16 : 0.28,
    curl: 0,
    drag: aero.drag,
    lift: aero.lift,
    distanceVel: 0,
    launchDirX: 1,
    bounce: 0,
  };
}

const minAirTime = 1.08;

function paceTime(distance: number, pace: number) {
  const scaled = pace * lerp(1.12, 0.78, distanceT(distance));
  const widthsPerSecond = Math.min(0.95, Math.max(0.4, scaled));
  return 1 / widthsPerSecond;
}

function flightTime(distance: number, pace: number, sizeScale: number) {
  const boost = sizeScale <= 0.55 ? 1.32 : 1;
  return Math.max(minAirTime, paceTime(distance, pace) / boost);
}

function finishLaunch(target: Clay) {
  target.launchDirX = Math.sign(target.vx) || 1;
  // Fold launch wind into a steady curl bias (launch condition only).
  target.curl += target.wind * settings.gravity * 0.014;
  if (isHardModeActive()) {
    // Hard launches: less hang, a bit more pace (launch conditions only).
    target.lift *= 0.78;
    target.vx *= 1.1;
    target.vy *= 1.04;
    target.gravityScale = Math.min(1.08, target.gravityScale * 1.1);
    target.distanceVel *= 1.08;
  }
  return applyTouchSpeed(target);
}

export type LaunchBox = { width: number; height: number };

export function launchThrow(
  kind: ThrowKind,
  box: LaunchBox,
  sizeScale: number,
): Clay {
  if (kind === "crosser" || kind === "high") {
    return launchCrosser(kind, box, sizeScale);
  }
  if (kind === "away") {
    return launchAway(box, sizeScale);
  }
  if (kind === "incomer") {
    return launchIncomer(box, sizeScale);
  }
  if (kind === "battue") {
    return launchBattue(box, sizeScale);
  }
  if (kind === "teal") {
    return launchTeal(box, sizeScale);
  }
  if (kind === "looper") {
    return launchLooper(box, sizeScale);
  }
  if (kind === "dropper") {
    return launchDropper(box, sizeScale);
  }
  if (kind === "curler") {
    return launchCurler(box, sizeScale);
  }
  return launchRabbit(box, sizeScale);
}

function launchCrosser(
  kind: "crosser" | "high",
  { width, height }: LaunchBox,
  sizeScale: number,
) {
  const distance = kind === "high" ? pickDistance(0.45, 1) : pickDistance(0, 1);
  const target = freshClay(kind, distance, sizeScale);
  const direction = Math.random() < 0.5 ? 1 : -1;
  let time = flightTime(
    distance,
    kind === "high" ? pickPace(0.15, 0.55) : pickPace(0, 1),
    sizeScale,
  );
  time /= hardCrosserSpeedMul();
  time = Math.max(settings.fairTime + (isHardModeActive() ? 0.08 : 0.22), time);
  const look = lookOf(target);
  const riseLimit = kind === "high" ? 0.06 : 0.18;
  const yMin = kind === "high" ? height * 0.14 : height * 0.34;
  const yMax = kind === "high" ? height * 0.34 : height * 0.62;
  target.y = rand(yMin, Math.max(yMin + 8, yMax));
  const riseRoom = kind === "high" ? target.y - height * 0.08 : target.y - 14;
  const rise = Math.min(
    height * rand(kind === "high" ? 0.02 : 0.06, riseLimit),
    Math.max(riseRoom, 8),
  );
  const span = width + look.rx * 2;
  target.x = direction > 0 ? -look.rx - 2 : width + look.rx + 2;
  target.vx = (direction * span) / time;
  target.vy = -Math.sqrt(2 * settings.gravity * rise);
  target.gravityScale = height < 480 ? 0.8 : 0.92;
  if (isHardModeActive()) {
    target.gravityScale = Math.min(1, target.gravityScale + 0.12);
  }
  target.lift =
    sizeAero(sizeScale).lift *
    (kind === "high" ? 0.7 : 1.05) *
    (isHardModeActive() ? 0.82 : 1);
  target.drag = sizeAero(sizeScale).drag * 0.85;
  // Gentle spin curl (vertical accel), fixed for the flight.
  target.curl = direction * rand(12, 30);
  target.duration = time;
  return finishLaunch(target);
}

function launchAway({ width, height }: LaunchBox, sizeScale: number) {
  const side = Math.random() < 0.5 ? -1 : 1;
  const target = freshClay("away", settings.nearDistance, sizeScale);
  target.distance = rand(
    settings.nearDistance,
    lerp(settings.nearDistance, settings.farDistance, 0.28),
  );
  target.x = width * 0.5 + side * width * rand(0.08, 0.18);
  target.y = height * rand(0.66, 0.84);
  const peak = height * rand(0.12, 0.28);
  target.vx = side * width * rand(0.12, 0.28);
  target.vy = -Math.sqrt(2 * settings.gravity * Math.max(40, target.y - peak));
  target.gravityScale = 1;
  target.lift = sizeAero(sizeScale).lift * 1.05;
  target.drag = sizeAero(sizeScale).drag * 1.05;
  target.curl = side * rand(22, 48);
  target.distanceVel = rand(0.18, 0.32);
  target.duration = flightTime(target.distance, pickPace(0.15, 0.9), sizeScale);
  return finishLaunch(target);
}

function launchIncomer({ width, height }: LaunchBox, sizeScale: number) {
  const target = freshClay("incomer", settings.farDistance, sizeScale);
  target.distance = rand(
    lerp(settings.nearDistance, settings.farDistance, 0.78),
    settings.farDistance,
  );
  target.x = width * rand(0.28, 0.72);
  target.y = height * rand(0.18, 0.34);
  target.vx = width * rand(-0.12, 0.12);
  target.vy = -height * rand(0.08, 0.18);
  target.gravityScale = 1;
  target.lift = sizeAero(sizeScale).lift * 1.15;
  target.drag = sizeAero(sizeScale).drag * 0.95;
  target.curl = (Math.random() < 0.5 ? -1 : 1) * rand(20, 44);
  target.distanceVel = -rand(0.22, 0.38);
  target.duration = flightTime(target.distance, pickPace(0.1, 0.7), sizeScale);
  return finishLaunch(target);
}

function launchRabbit({ width, height }: LaunchBox, sizeScale: number) {
  const distance = pickDistance(0, 0.5);
  const target = freshClay("rabbit", distance, sizeScale);
  const direction = Math.random() < 0.5 ? 1 : -1;
  let time = flightTime(distance, lerp(0.48, 0.7, Math.random()), sizeScale);
  if (isHardModeActive()) {
    time = Math.max(settings.fairTime + 0.05, time * 0.88);
  }
  const look = lookOf(target);
  const span = width + look.rx * 2;
  target.x = direction > 0 ? -look.rx - 2 : width + look.rx + 2;
  target.y = height - look.ry;
  target.vx = (direction * span) / time;
  target.vy = -Math.sqrt(2 * settings.gravity * height * rand(0.06, 0.14));
  target.gravityScale = 1;
  target.lift = sizeAero(sizeScale).lift * 0.25;
  target.drag = sizeAero(sizeScale).drag * 1.1;
  target.curl = direction * rand(10, 28);
  target.bounce = Math.sqrt(2 * settings.gravity * height * rand(0.05, 0.12));
  target.duration = time;
  return finishLaunch(target);
}

function launchBattue({ width, height }: LaunchBox, sizeScale: number) {
  const distance = pickDistance(0.1, 0.8);
  const target = freshClay("battue", distance, sizeScale);
  const direction = Math.random() < 0.5 ? 1 : -1;
  let time = Math.max(flightTime(distance, pickPace(0.35, 0.85), sizeScale), 1.7);
  if (isHardModeActive()) {
    time = Math.max(settings.fairTime + 0.1, time * 0.88);
  } else {
    time = Math.max(settings.fairTime + 0.25, time);
  }
  target.roll = 0;
  const look = lookOf(target);
  target.y = rand(height * 0.3, height * 0.48);
  const rise = Math.min(height * rand(0.02, 0.045), Math.max(8, target.y - 14));
  const span = width + look.rx * 2;
  target.x = direction > 0 ? -look.rx - 2 : width + look.rx + 2;
  target.vx = (direction * span) / time;
  target.vy = -Math.sqrt(2 * settings.gravity * rise);
  target.gravityScale = height < 480 ? 0.75 : 0.9;
  // Little lift so it drops sharply once it slows.
  target.lift = sizeAero(sizeScale).lift * 0.18;
  target.drag = sizeAero(sizeScale).drag * 1.1;
  target.curl = direction * rand(10, 28);
  target.duration = time;
  return finishLaunch(target);
}

function launchTeal({ width, height }: LaunchBox, sizeScale: number) {
  const target = freshClay("teal", pickDistance(0.15, 0.7), sizeScale);
  target.x = width * rand(0.3, 0.7);
  target.y = height * rand(0.62, 0.8);
  const peak = height * rand(0.12, 0.24);
  const rise = Math.max(48, target.y - peak);
  target.vy = -Math.sqrt(2 * settings.gravity * rise);
  target.vx = (Math.random() - 0.5) * width * 0.08;
  target.gravityScale = 0.85;
  target.lift = sizeAero(sizeScale).lift * 1.55;
  target.drag = sizeAero(sizeScale).drag * 1.2;
  target.curl = (Math.random() < 0.5 ? -1 : 1) * rand(16, 38);
  target.duration = 1.7;
  return finishLaunch(target);
}

function launchLooper({ width, height }: LaunchBox, sizeScale: number) {
  const distance = pickDistance(0.2, 0.7);
  const target = freshClay("looper", distance, sizeScale);
  const direction = Math.random() < 0.5 ? 1 : -1;
  target.x = direction > 0 ? width * 0.08 : width * 0.92;
  target.y = height * rand(0.52, 0.68);
  const peak = height * rand(0.14, 0.26);
  // Slow crossing so it stays shootable while it hangs.
  target.vx = direction * width * rand(0.14, 0.24);
  target.vy = -Math.sqrt(2 * settings.gravity * Math.max(60, target.y - peak));
  target.gravityScale = 0.88;
  // Plenty of lift so it hangs as it slows, then falls away.
  target.lift = sizeAero(sizeScale).lift * (isHardModeActive() ? 1.4 : 2.25);
  target.drag = sizeAero(sizeScale).drag * (isHardModeActive() ? 1.15 : 1.4);
  target.curl = direction * rand(16, 36);
  target.distanceVel = rand(0.04, 0.12);
  if (isHardModeActive()) {
    target.vx *= height < 480 ? 1.55 : 1.22;
    target.gravityScale = Math.min(1, target.gravityScale + (height < 480 ? 0.2 : 0.12));
    target.lift *= height < 480 ? 0.85 : 1;
  }
  target.duration = Math.max(
    settings.fairTime + (isHardModeActive() ? 0.2 : 0.35),
    flightTime(distance, pickPace(0.05, 0.25), sizeScale),
  );
  return finishLaunch(target);
}

function launchDropper({ width, height }: LaunchBox, sizeScale: number) {
  const target = freshClay("dropper", settings.farDistance, sizeScale);
  target.distance = rand(
    lerp(settings.nearDistance, settings.farDistance, 0.65),
    settings.farDistance,
  );
  // High dropping incomer: hangs, then falls as lift fades.
  target.x = width * rand(0.4, 0.6);
  target.y = height * rand(0.18, 0.32);
  target.vx = width * rand(-0.025, 0.025);
  target.vy = -height * rand(0, 0.02);
  target.gravityScale = height < 480 ? 0.55 : 0.78;
  target.lift = sizeAero(sizeScale).lift * (height < 480 ? 2.4 : 1.85);
  target.drag = sizeAero(sizeScale).drag * 1.25;
  target.curl = (Math.random() < 0.5 ? -1 : 1) * rand(6, 18);
  target.distanceVel = -rand(0.14, 0.26);
  if (isHardModeActive()) {
    target.lift *= height < 480 ? 0.55 : 0.7;
    target.gravityScale = Math.min(1, target.gravityScale + (height < 480 ? 0.32 : 0.2));
    target.distanceVel *= 1.35;
    target.vx *= height < 480 ? 1.55 : 1.3;
  }
  target.duration = Math.max(
    settings.fairTime + (isHardModeActive() ? 0.35 : 0.85),
    flightTime(target.distance, pickPace(0.05, 0.3), sizeScale),
  );
  return finishLaunch(target);
}

function launchCurler({ width, height }: LaunchBox, sizeScale: number) {
  // Curling crosser: bends one way only from steady spin curl.
  const distance = pickDistance(0.15, 0.75);
  const target = freshClay("curler", distance, sizeScale);
  const direction = Math.random() < 0.5 ? 1 : -1;
  let time = flightTime(distance, pickPace(0.1, 0.45), sizeScale);
  time = Math.max(
    settings.fairTime + (height < 480 ? 0.55 : 0.3),
    time * (isHardModeActive() ? 0.92 : 1),
  );
  const look = lookOf(target);
  const span = width + look.rx * 2;
  target.y = height * rand(0.28, 0.46);
  const rise = height * rand(0.04, 0.1);
  target.x = direction > 0 ? -look.rx - 2 : width + look.rx + 2;
  target.vx = (direction * span) / time;
  target.vy = -Math.sqrt(2 * settings.gravity * rise);
  target.gravityScale = height < 480 ? 0.7 : 0.92;
  target.lift = sizeAero(sizeScale).lift * 0.9;
  target.drag = sizeAero(sizeScale).drag * 0.95;
  // Stronger steady curl so the path bends one way like a spinning clay.
  target.curl = direction * rand(55, 100);
  target.duration = time;
  return finishLaunch(target);
}

/** Nudge launch conditions only until the flight is fair. Never rewrite flight mid-air. */
export function nudgeTowardFair(
  source: Clay,
  box: LaunchBox,
  hidden: (x: number, y: number) => boolean = () => false,
): Clay | null {
  const candidate: Clay = { ...source };
  for (let step = 0; step < 28; step += 1) {
    if (flightIsFair(candidate, box.width, box.height, hidden)) {
      return candidate;
    }
    // Launch-only tweaks: slower, more hang, milder curl.
    candidate.vx *= 0.94;
    candidate.vy *= 0.96;
    candidate.drag *= 0.94;
    candidate.lift *= 1.05;
    candidate.curl *= 0.88;
    candidate.bounce *= 0.95;
    candidate.gravityScale = Math.max(0.55, candidate.gravityScale * 0.96);
    if (candidate.y > box.height * 0.15 && candidate.y < box.height * 0.7) {
      candidate.y *= 0.995;
    }
  }
  return flightIsFair(candidate, box.width, box.height, hidden)
    ? candidate
    : null;
}

/** Hard-mode last resort: still a hard-feeling throw, never the soft safe crosser. */
export function hardFallbackThrow(
  box: LaunchBox,
  sizeScale: number,
  extraTime = 0,
) {
  const { width, height } = box;
  const target = freshClay(
    "battue",
    lerp(settings.nearDistance, settings.farDistance, 0.4),
    Math.min(sizeScale, settings.fastClaySize + 0.15),
  );
  target.wind = 0;
  target.roll = 0;
  const direction = Math.random() < 0.5 ? 1 : -1;
  const time = settings.fairTime + 0.35 + Math.max(0, extraTime);
  const look = lookOf(target);
  target.y = height * 0.36;
  const rise = Math.min(height * 0.03, 14);
  const span = width + look.rx * 2;
  target.x = direction > 0 ? -look.rx - 2 : width + look.rx + 2;
  target.vx = (direction * span) / time;
  target.vy = -Math.sqrt(2 * settings.gravity * rise);
  target.gravityScale = height < 480 ? 0.55 : 0.75;
  target.lift = sizeAero(target.sizeScale).lift * 0.55;
  target.drag = sizeAero(target.sizeScale).drag * 1.0;
  target.curl = direction * 12;
  target.duration = time;
  return finishLaunch(target);
}

export function chooseFairThrow(
  kind: ThrowKind,
  box: LaunchBox,
  sizeScale: number,
  options: {
    hard?: boolean;
    hidden?: (x: number, y: number) => boolean;
    tries?: number;
  } = {},
): { clay: Clay | null; fallback: boolean } {
  const hidden = options.hidden ?? (() => false);
  const tries = Math.max(1, options.tries ?? Math.round(settings.fairTries));
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const candidate = launchThrow(kind, box, sizeScale);
    if (flightIsFair(candidate, box.width, box.height, hidden)) {
      return { clay: candidate, fallback: false };
    }
    const nudged = nudgeTowardFair(candidate, box, hidden);
    if (nudged) {
      return { clay: nudged, fallback: false };
    }
  }
  if (options.hard) {
    for (let attempt = 0; attempt < tries; attempt += 1) {
      // Retry the planned kind with a slightly longer nudge budget before a hard fallback.
      const retry = launchThrow(kind, box, sizeScale);
      const nudgedRetry = nudgeTowardFair(retry, box, hidden);
      if (nudgedRetry) {
        return { clay: nudgedRetry, fallback: false };
      }
    }
    for (let attempt = 0; attempt < tries; attempt += 1) {
      const fallback = hardFallbackThrow(box, sizeScale, attempt * 0.06);
      if (flightIsFair(fallback, box.width, box.height, hidden)) {
        return { clay: fallback, fallback: true };
      }
      const nudged = nudgeTowardFair(fallback, box, hidden);
      if (nudged) {
        return { clay: nudged, fallback: true };
      }
    }
    return { clay: null, fallback: true };
  }
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const fallback = safeCrosser(box, sizeScale, attempt * 0.04);
    if (flightIsFair(fallback, box.width, box.height, hidden)) {
      return { clay: fallback, fallback: true };
    }
  }
  return { clay: null, fallback: true };
}

export function safeCrosser(
  box: LaunchBox,
  sizeScale: number,
  extraTime = 0,
) {
  const { width, height } = box;
  const target = freshClay(
    "crosser",
    lerp(settings.nearDistance, settings.farDistance, 0.45),
    sizeScale,
  );
  target.wind = 0;
  const direction = Math.random() < 0.5 ? 1 : -1;
  const time = Math.max(2.4, settings.fairTime + 1) + Math.max(0, extraTime);
  const look = lookOf(target);
  target.y = height * 0.34;
  const rise = Math.min(height * 0.03, 14);
  const span = width + look.rx * 2;
  target.x = direction > 0 ? -look.rx - 2 : width + look.rx + 2;
  target.vx = (direction * span) / time;
  target.vy = -Math.sqrt(2 * settings.gravity * rise);
  target.gravityScale = 0.48;
  target.lift = sizeAero(sizeScale).lift * 2.0;
  target.drag = sizeAero(sizeScale).drag * 0.7;
  target.curl = direction * 6;
  target.duration = time;
  return finishLaunch(target);
}

export function pickNormalThrow(): ThrowKind {
  const options: { kind: ThrowKind; weight: number }[] = [
    { kind: "crosser", weight: settings.throwCrosser },
    { kind: "away", weight: settings.throwAway },
    { kind: "incomer", weight: settings.throwIncomer },
    { kind: "high", weight: settings.throwHigh },
    { kind: "rabbit", weight: settings.throwRabbit },
    { kind: "battue", weight: settings.throwBattue },
    { kind: "teal", weight: settings.throwTeal },
  ];
  const total = options.reduce((sum, option) => sum + Math.max(0, option.weight), 0);
  let roll = Math.random() * (total || 1);
  for (const option of options) {
    roll -= Math.max(0, option.weight);
    if (roll <= 0) {
      return option.kind;
    }
  }
  return "crosser";
}

/** Try many random samples of a throw until one is fair, or give up. */
export function fairSample(
  kind: ThrowKind,
  box: LaunchBox,
  tries = 40,
  hard = false,
): Clay | null {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const sizeScale = hard || isHardModeActive() ? pickSize() : 1;
    const chosen = chooseFairThrow(kind, box, sizeScale, {
      hard: hard || isHardModeActive(),
      tries: 3,
    });
    if (chosen.clay) {
      return chosen.clay;
    }
  }
  return null;
}
