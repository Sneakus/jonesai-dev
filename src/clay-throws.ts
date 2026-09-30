import {
  activeClayFeel,
  desktopClaySettings,
  hardCrosserSpeedMul,
  hardSizeWeights,
  hardWindMul,
  isHardModeActive,
  type HardThrowKind,
} from "./clay-feel";

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
  fairTime: 1.2,
  fairHand: 0.25,
  fairTries: 20,
  perfectDuration: 5200,
  perfectSpinTime: 1800,
  perfectSweepStart: 1800,
  perfectSweepTime: 2500,
  perfectShotCount: 14,
  perfectRecoilTime: 120,
  perfectFireworkTravel: 260,
  perfectSparkTime: 450,
  winnerBannerStart: 4600,
  winnerBannerDropTime: 400,
  perfectFireworkSize: 4,
  perfectSparkCount: 10,
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
  const u = Math.max(0, Math.min(1, amount));
  if (target.kind === "away") {
    const ease = 1 - (1 - u) * (1 - u);
    target.x = lerp(target.x0, target.x1, ease) + Math.sin(ease * Math.PI) * target.cx;
    target.y = lerp(target.y0, target.y1, ease);
    target.distance = lerp(target.distance0, target.distance1, ease);
    target.x += target.wind * boxWidth * 0.42 * Math.sin(u * Math.PI);
    return;
  }
  if (target.kind === "dropper") {
    const approach = Math.min(1, u / 0.72);
    const drop = u > 0.72 ? ((u - 0.72) / 0.28) ** 2 : 0;
    target.x =
      lerp(target.x0, target.x1, approach) + Math.sin(approach * Math.PI) * target.cx;
    target.y = lerp(target.y0, target.y1, approach) + drop * (target.cy || boxWidth * 0.22);
    target.distance = lerp(
      target.distance0,
      target.distance1,
      Math.min(1, approach + drop * 0.35),
    );
    target.x += target.wind * boxWidth * 0.42 * Math.sin(u * Math.PI);
    return;
  }
  if (target.kind === "curler") {
    const rest = 1 - u;
    target.x = rest * rest * target.x0 + 2 * rest * u * target.cx + u * u * target.x1;
    target.y = rest * rest * target.y0 + 2 * rest * u * target.cy + u * u * target.y1;
    target.x += Math.sin(u * Math.PI * 2) * target.curl * boxWidth;
    target.distance = lerp(target.distance0, target.distance1, u);
    target.x += target.wind * boxWidth * 0.42 * Math.sin(u * Math.PI);
    return;
  }
  const rest = 1 - u;
  target.x = rest * rest * target.x0 + 2 * rest * u * target.cx + u * u * target.x1;
  target.y = rest * rest * target.y0 + 2 * rest * u * target.cy + u * u * target.y1;
  target.distance = lerp(target.distance0, target.distance1, u);
  target.x += target.wind * boxWidth * 0.42 * Math.sin(u * Math.PI);
}

export function stepClay(clay: Clay, dt: number, boxWidth: number, boxHeight: number) {
  if (
    clay.kind === "away" ||
    clay.kind === "incomer" ||
    clay.kind === "dropper" ||
    clay.kind === "curler" ||
    clay.kind === "looper"
  ) {
    const prevX = clay.x;
    const prevY = clay.y;
    clay.age += dt;
    if (clay.kind === "looper") {
      placeLooper(clay, clay.age / Math.max(clay.duration, 0.001), boxWidth, boxHeight);
    } else if (clay.kind === "incomer") {
      placePath(clay, clay.age / Math.max(clay.duration, 0.001), boxWidth);
    } else {
      placePath(clay, clay.age / Math.max(clay.duration, 0.001), boxWidth);
    }
    clay.vx = (clay.x - prevX) / Math.max(dt, 0.001);
    clay.vy = (clay.y - prevY) / Math.max(dt, 0.001);
    return;
  }
  const bow = (age: number, span: number, wind: number) =>
    Math.sin(Math.min(1, Math.max(0, age) / Math.max(span, 0.4)) * Math.PI) *
    wind *
    boxWidth *
    0.42;
  const sideways = clay.kind === "teal";
  const before = bow(clay.age, clay.duration, clay.wind);
  clay.age += dt;
  let gravityScale = clay.gravityScale;
  if (
    clay.kind === "teal" &&
    clay.y < boxHeight * 0.45 &&
    Math.abs(clay.vy) < boxHeight * 0.22 &&
    clay.hang < clay.hangLimit
  ) {
    clay.hang += dt;
    gravityScale = 0.14;
  }
  if (clay.kind === "battue" && clay.age > clay.duration * 0.7) {
    gravityScale += 1.2;
    clay.roll += dt * 8;
  }
  clay.vy += settings.gravity * gravityScale * dt;
  clay.x += clay.vx * dt;
  clay.y += clay.vy * dt;
  const after = bow(clay.age, clay.duration, clay.wind);
  if (clay.kind === "rabbit") {
    clay.vx += clay.wind * boxWidth * 0.25 * dt;
  } else if (sideways) {
    clay.x += after - before;
  } else {
    clay.y += after - before;
  }
  if (clay.kind === "teal") {
    const look = lookOf(clay);
    if (clay.y < look.ry + 8 && clay.vy < 0) {
      clay.y = look.ry + 8;
      clay.vy = 0;
    }
  }
  if (clay.kind === "rabbit") {
    const look = lookOf(clay);
    const floor = boxHeight - look.ry;
    if (clay.y >= floor && clay.vy >= 0) {
      clay.y = floor;
      const hop =
        boxHeight * (0.05 + 0.1 * Math.abs(Math.sin(clay.age * 4.7 + clay.wind * 18)));
      clay.vy = -Math.sqrt(2 * Math.max(settings.gravity, 1) * hop);
    }
    clay.roll += clay.vx * dt * 0.035;
  }
}

function placeLooper(
  target: Clay,
  amount: number,
  boxWidth: number,
  boxHeight: number,
) {
  const u = Math.max(0, Math.min(1, amount));
  // Slow climb, brief hang near the top, then fall away fast.
  // Hard mode hangs less so the clay is shootable for less time.
  const hangEnd = isHardModeActive() ? 0.48 : 0.62;
  const climb = Math.min(1, u / 0.45);
  const hang = u > 0.45 && u < hangEnd ? (u - 0.45) / Math.max(0.01, hangEnd - 0.45) : 0;
  const fall = u >= hangEnd ? ((u - hangEnd) / Math.max(0.01, 1 - hangEnd)) ** 2 : 0;
  const peak = Math.min(target.y0, target.y1);
  const startY = Math.max(target.y0, target.y1);
  target.x = lerp(target.x0, target.x1, u) + Math.sin(u * Math.PI) * target.cx;
  target.y =
    lerp(startY, peak, climb * (1 - hang * 0.15)) +
    fall * (boxHeight * 0.55 - peak);
  target.distance = lerp(target.distance0, target.distance1, clamp01(climb * 0.7 + fall));
  target.x += target.wind * boxWidth * 0.3 * Math.sin(u * Math.PI);
}

export function clayGone(clay: Clay, boxWidth: number, boxHeight: number) {
  const look = lookOf(clay);
  const left = clay.vx < 0 && clay.x < -look.rx * 1.6;
  const right = clay.vx > 0 && clay.x > boxWidth + look.rx * 1.6;
  const dropped = clay.y > boxHeight + look.ry * 1.6;
  const climbed = clay.kind !== "rabbit" && clay.y < -look.ry * 2.4;
  const finishedPath =
    (clay.kind === "away" ||
      clay.kind === "incomer" ||
      clay.kind === "dropper" ||
      clay.kind === "curler" ||
      clay.kind === "looper") &&
    clay.age >= clay.duration;
  return finishedPath || left || right || dropped || climbed;
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
  clay.duration /= speed;
  if (
    clay.kind === "away" ||
    clay.kind === "incomer" ||
    clay.kind === "dropper" ||
    clay.kind === "curler" ||
    clay.kind === "looper"
  ) {
    return clay;
  }
  if (clay.kind === "rabbit") {
    clay.vx *= speed;
    return clay;
  }
  clay.vx *= speed;
  clay.vy *= speed;
  clay.gravityScale *= speed * speed;
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
    gravityScale: 0,
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

function aimPath(target: Clay, width: number) {
  placePath(target, 0, width);
  const startX = target.x;
  const startY = target.y;
  placePath(target, 0.03, width);
  const slice = Math.max(0.03 * target.duration, 0.001);
  target.vx = (target.x - startX) / slice;
  target.vy = (target.y - startY) / slice;
  placePath(target, 0, width);
}

function holdLongEnough(target: Clay, width: number, height: number) {
  const steps = 28;
  let hits = 0;
  for (let index = 0; index < steps; index += 1) {
    const ghost = { ...target };
    if (ghost.kind === "looper") {
      placeLooper(ghost, (index + 0.5) / steps, width, height);
    } else {
      placePath(ghost, (index + 0.5) / steps, width);
    }
    const look = lookOf(ghost);
    const on =
      ghost.y > -look.ry &&
      ghost.y < height + look.ry &&
      ghost.x > -look.rx &&
      ghost.x < width + look.rx;
    if (on) {
      hits += 1;
    }
  }
  const share = hits / steps;
  if (share < 0.08) {
    return;
  }
  const visible = target.duration * share;
  if (visible < minAirTime) {
    target.duration = Math.min(2.8, (target.duration * minAirTime) / visible);
  }
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
  if (isHardModeActive()) {
    // Keep a fair wall-clock window after applyTouchSpeed chops by feel.speed.
    time = Math.max(settings.fairTime + 0.05, time) * Math.max(1, activeClayFeel().speed);
  }
  const look = lookOf(target);
  const riseLimit = kind === "high" ? 0.06 : 0.2;
  const yMin = kind === "high" ? height * 0.14 : height * 0.32;
  const yMax = kind === "high" ? height * 0.34 : height * 0.66;
  target.y = rand(yMin, Math.max(yMin + 8, yMax));
  const riseRoom = kind === "high" ? target.y - height * 0.08 : target.y - 14;
  const rise = Math.min(
    height * rand(kind === "high" ? 0.02 : 0.07, riseLimit),
    Math.max(riseRoom, 8),
  );
  const duration = time;
  const gravity = Math.max(rise, 12) / (0.125 * duration * duration);
  const span = width + look.rx * 2;
  target.x = direction > 0 ? -look.rx - 2 : width + look.rx + 2;
  target.vx = (direction * span) / duration;
  target.vy = -0.5 * gravity * duration;
  target.gravityScale = gravity / Math.max(settings.gravity, 1);
  target.duration = duration;
  return applyTouchSpeed(target);
}

function launchAway({ width, height }: LaunchBox, sizeScale: number) {
  const side = Math.random() < 0.5 ? -1 : 1;
  const target = freshClay("away", settings.nearDistance, sizeScale);
  target.distance0 = rand(
    settings.nearDistance,
    lerp(settings.nearDistance, settings.farDistance, 0.28),
  );
  target.distance1 = rand(
    lerp(settings.nearDistance, settings.farDistance, 0.72),
    settings.farDistance,
  );
  target.distance = target.distance0;
  target.x0 = width * 0.5 + side * width * rand(0.1, 0.2);
  target.y0 = height * rand(0.66, 0.86);
  target.x1 = width * rand(0.22, 0.78);
  target.y1 = height * rand(0.1, 0.28);
  target.cx = (Math.random() - 0.5) * width * 0.18;
  target.duration = pathDuration(
    flightTime(
      (target.distance0 + target.distance1) / 2,
      pickPace(0.15, 0.9),
      sizeScale,
    ) * (isHardModeActive() ? 0.7 : 1),
  );
  holdLongEnough(target, width, height);
  aimPath(target, width);
  return applyTouchSpeed(target);
}

function launchIncomer({ width, height }: LaunchBox, sizeScale: number) {
  const target = freshClay("incomer", settings.farDistance, sizeScale);
  target.distance0 = rand(
    lerp(settings.nearDistance, settings.farDistance, 0.78),
    settings.farDistance,
  );
  target.distance1 = rand(
    settings.nearDistance,
    lerp(settings.nearDistance, settings.farDistance, 0.32),
  );
  target.distance = target.distance0;
  target.x0 = width * rand(0.22, 0.78);
  target.y0 = height * rand(0.16, 0.34);
  target.x1 = Math.max(
    width * 0.18,
    Math.min(width * 0.82, target.x0 + width * rand(-0.24, 0.24)),
  );
  target.y1 = -height * rand(0.08, 0.16);
  target.cx = Math.max(
    width * 0.16,
    Math.min(width * 0.84, lerp(target.x0, target.x1, 0.4) + width * rand(-0.1, 0.1)),
  );
  target.cy = height * rand(0.4, 0.62);
  target.duration = pathDuration(
    flightTime(
      (target.distance0 + target.distance1) / 2,
      pickPace(0.1, 0.7),
      sizeScale,
    ) * (isHardModeActive() ? 0.7 : 1),
  );
  holdLongEnough(target, width, height);
  aimPath(target, width);
  return applyTouchSpeed(target);
}

function launchRabbit({ width, height }: LaunchBox, sizeScale: number) {
  const distance = pickDistance(0, 0.5);
  const target = freshClay("rabbit", distance, sizeScale);
  const direction = Math.random() < 0.5 ? 1 : -1;
  let time = flightTime(distance, lerp(0.48, 0.7, Math.random()), sizeScale);
  if (isHardModeActive()) {
    time =
      Math.max(settings.fairTime + 0.05, time * 0.88) *
      Math.max(1, activeClayFeel().speed);
  }
  const look = lookOf(target);
  const span = width + look.rx * 2;
  target.x = direction > 0 ? -look.rx - 2 : width + look.rx + 2;
  target.y = height - look.ry;
  target.vx = (direction * span) / time;
  target.vy = -Math.sqrt(2 * Math.max(settings.gravity, 1) * height * rand(0.06, 0.14));
  target.gravityScale = 1;
  target.duration = time;
  return applyTouchSpeed(target);
}

function launchBattue({ width, height }: LaunchBox, sizeScale: number) {
  const distance = pickDistance(0.1, 0.8);
  const target = freshClay("battue", distance, sizeScale);
  const direction = Math.random() < 0.5 ? 1 : -1;
  let duration = Math.max(flightTime(distance, pickPace(0.4, 0.95), sizeScale), 1.7);
  if (isHardModeActive()) {
    duration =
      Math.max(settings.fairTime + 0.05, duration * 0.82) *
      Math.max(1, activeClayFeel().speed);
  }
  target.roll = 0;
  const look = lookOf(target);
  target.y = rand(height * 0.28, height * 0.52);
  const rise = Math.min(height * rand(0.02, 0.05), target.y - 14);
  const gravity = Math.max(rise, 10) / (0.125 * duration * duration);
  const span = width + look.rx * 2;
  target.x = direction > 0 ? -look.rx - 2 : width + look.rx + 2;
  target.vx = (direction * span) / duration;
  target.vy = -0.5 * gravity * duration;
  target.gravityScale = gravity / Math.max(settings.gravity, 1);
  target.duration = duration;
  return applyTouchSpeed(target);
}

function launchTeal({ width, height }: LaunchBox, sizeScale: number) {
  const distance = pickDistance(0.15, 0.7);
  const target = freshClay("teal", distance, sizeScale);
  const boost = sizeScale <= 0.55 ? 1.28 : 1;
  target.x = width * rand(0.3, 0.7);
  target.y = height * rand(0.62, 0.8);
  const peak = height * rand(0.12, 0.24);
  const rise = Math.max(48, target.y - peak);
  const gravity = settings.gravity * 0.62 * boost;
  target.gravityScale = 0.62 * boost;
  target.vy = -Math.sqrt(2 * gravity * rise);
  target.vx = (Math.random() - 0.5) * width * 0.05;
  let time = 1.7;
  if (isHardModeActive()) {
    time =
      Math.max(settings.fairTime + 0.05, 1.35) * Math.max(1, activeClayFeel().speed);
  }
  target.duration = time;
  return applyTouchSpeed(target);
}

function pathDuration(base: number) {
  // Hard mode pre-scales by feel speed so applyTouchSpeed leaves a fair window.
  // Soft mode leaves duration raw so phone speed still shortens the flight.
  const pad = isHardModeActive() ? 0.05 : 0.55;
  const wall = Math.max(settings.fairTime + pad, base);
  if (!isHardModeActive()) {
    return wall;
  }
  return wall * Math.max(1, activeClayFeel().speed);
}

function isPathKind(kind: ThrowKind) {
  return (
    kind === "away" ||
    kind === "incomer" ||
    kind === "dropper" ||
    kind === "curler" ||
    kind === "looper"
  );
}

/** Nudge an almost-fair throw until it passes, without turning it into an easy clay. */
export function nudgeTowardFair(
  source: Clay,
  box: LaunchBox,
  hidden: (x: number, y: number) => boolean = () => false,
): Clay | null {
  const candidate: Clay = { ...source };
  // Duration is already in wall-clock time (after applyTouchSpeed).
  const startDuration = Math.max(0.01, candidate.duration);
  const maxDuration = Math.max(
    startDuration * (isHardModeActive() ? 1.2 : 1.18),
    settings.fairTime + (isHardModeActive() ? 0.08 : 0.45),
  );
  for (let step = 0; step < 16; step += 1) {
    if (flightIsFair(candidate, box.width, box.height, hidden)) {
      return candidate;
    }
    candidate.wind *= 0.5;
    if (isPathKind(candidate.kind)) {
      candidate.duration = Math.min(candidate.duration * 1.04, maxDuration);
      aimPath(candidate, box.width);
    } else if (candidate.kind === "rabbit") {
      candidate.vx *= 0.97;
      candidate.duration = Math.min(candidate.duration * 1.03, maxDuration);
    } else {
      candidate.vx *= 0.97;
      candidate.vy *= 0.97;
      candidate.gravityScale *= 0.97 * 0.97;
      candidate.duration = Math.min(candidate.duration * 1.03, maxDuration);
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
  const feel = activeClayFeel();
  const target = freshClay(
    "battue",
    lerp(settings.nearDistance, settings.farDistance, 0.4),
    Math.min(sizeScale, settings.fastClaySize + 0.15),
  );
  target.wind = 0;
  target.roll = 0;
  const direction = Math.random() < 0.5 ? 1 : -1;
  const duration =
    (settings.fairTime + 0.08 + Math.max(0, extraTime)) *
    Math.max(1, feel.speed);
  const look = lookOf(target);
  target.y = height * 0.4;
  const rise = height * 0.035;
  const gravity = rise / (0.125 * duration * duration);
  const span = width + look.rx * 2;
  target.x = direction > 0 ? -look.rx - 2 : width + look.rx + 2;
  target.vx = (direction * span) / duration;
  target.vy = -0.5 * gravity * duration;
  target.gravityScale = gravity / Math.max(settings.gravity, 1);
  target.duration = duration;
  return applyTouchSpeed(target);
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

function launchLooper({ width, height }: LaunchBox, sizeScale: number) {
  const distance = pickDistance(0.2, 0.7);
  const target = freshClay("looper", distance, sizeScale);
  const direction = Math.random() < 0.5 ? 1 : -1;
  target.distance0 = distance;
  target.distance1 = Math.min(settings.farDistance, distance + 0.25);
  target.x0 = direction > 0 ? width * 0.08 : width * 0.92;
  target.x1 = direction > 0 ? width * 0.78 : width * 0.22;
  target.y0 = height * rand(0.55, 0.7);
  target.y1 = height * rand(0.12, 0.22);
  target.cx = direction * width * rand(0.04, 0.1);
  target.duration = pathDuration(
    Math.max(
      isHardModeActive() ? 1.28 : 2.2,
      flightTime(distance, pickPace(0.05, 0.25), sizeScale) *
        (isHardModeActive() ? 0.62 : 1),
    ),
  );
  holdLongEnough(target, width, height);
  placeLooper(target, 0, width, height);
  return applyTouchSpeed(target);
}

function launchDropper({ width, height }: LaunchBox, sizeScale: number) {
  const target = freshClay("dropper", settings.farDistance, sizeScale);
  target.distance0 = rand(
    lerp(settings.nearDistance, settings.farDistance, 0.7),
    settings.farDistance,
  );
  target.distance1 = rand(
    settings.nearDistance,
    lerp(settings.nearDistance, settings.farDistance, 0.35),
  );
  target.distance = target.distance0;
  target.x0 = width * rand(0.28, 0.72);
  target.y0 = height * rand(0.18, 0.32);
  target.x1 = Math.max(
    width * 0.2,
    Math.min(width * 0.8, target.x0 + width * rand(-0.18, 0.18)),
  );
  target.y1 = height * rand(0.34, 0.48);
  target.cx = width * rand(-0.08, 0.08);
  target.cy = height * rand(0.28, 0.4);
  target.duration = pathDuration(
    Math.max(
      isHardModeActive() ? 1.28 : 1.9,
      flightTime(
        (target.distance0 + target.distance1) / 2,
        pickPace(0.15, 0.55),
        sizeScale,
      ) * (isHardModeActive() ? 0.68 : 1),
    ),
  );
  holdLongEnough(target, width, height);
  aimPath(target, width);
  return applyTouchSpeed(target);
}

function launchCurler({ width, height }: LaunchBox, sizeScale: number) {
  const distance = pickDistance(0.15, 0.75);
  const target = freshClay("curler", distance, sizeScale);
  const direction = Math.random() < 0.5 ? 1 : -1;
  target.distance0 = distance;
  target.distance1 = distance;
  target.x0 = direction > 0 ? -width * 0.05 : width * 1.05;
  target.x1 = direction > 0 ? width * 1.05 : -width * 0.05;
  target.y0 = height * rand(0.36, 0.58);
  target.y1 = height * rand(0.28, 0.52);
  target.cx = width * 0.5 + direction * width * rand(0.05, 0.18);
  target.cy = height * rand(0.22, 0.4);
  target.curl = direction * rand(0.1, 0.18);
  target.duration = pathDuration(
    Math.max(
      isHardModeActive() ? 1.28 : 1.9,
      flightTime(distance, pickPace(0.2, 0.7), sizeScale) *
        (isHardModeActive() ? 0.68 : 1),
    ),
  );
  holdLongEnough(target, width, height);
  aimPath(target, width);
  return applyTouchSpeed(target);
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
  const duration =
    Math.max(1.8, settings.fairTime + 0.55) + Math.max(0, extraTime);
  const look = lookOf(target);
  target.y = height * 0.42;
  const rise = height * 0.05;
  const gravity = rise / (0.125 * duration * duration);
  const span = width + look.rx * 2;
  target.x = direction > 0 ? -look.rx - 2 : width + look.rx + 2;
  target.vx = (direction * span) / duration;
  target.vy = -0.5 * gravity * duration;
  target.gravityScale = gravity / Math.max(settings.gravity, 1);
  target.duration = duration;
  return applyTouchSpeed(target);
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
      tries: 1,
    });
    if (chosen.clay) {
      return chosen.clay;
    }
  }
  return null;
}
