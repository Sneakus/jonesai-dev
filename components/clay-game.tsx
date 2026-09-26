"use client";

import { useEffect, useRef, useState } from "react";
import { clayBoxClass } from "@/components/clay-scene";

// Feel settings. Change these numbers to tune the game.
export const settings = {
  gravity: 1000, // how fast broken pieces fall, and how quickly a rabbit drops back down
  pauseBetweenClays: 560, // wait after one clay before the next, in milliseconds
  claySize: 51, // base width of a clay, before distance makes it bigger or smaller
  hitAreaSize: 8, // extra pixels around a clay that still count when a pellet is close
  shardCount: 8, // pieces when a clay breaks
  shardSpeed: 340, // how fast those pieces fly apart
  reloadTime: 350, // wait after a shot before the next one counts, in milliseconds
  patternSize: 28, // how far pellets scatter around the aim point for a near clay
  pelletCount: 12, // dots in each shot
  shakeStrength: 2, // pixels the box shakes on a hit. 0 turns the shake off
  claysPerRound: 5, // clays in one round
  fastClaysPerRound: 1, // minimum mini clays in each round
  fastClaySize: 0.5, // size used when the round still needs its fast clay

  // How often each throw appears. A higher number means it comes up more often.
  throwCrosser: 3,
  throwAway: 2,
  throwIncomer: 2,
  throwHigh: 2,
  throwRabbit: 2,
  throwBattue: 2,
  throwTeal: 2,

  // How often each clay size appears. Most throws should stay standard.
  sizeStandard: 6,
  sizeMidi: 2, // about 25% smaller
  sizeMini: 1, // about half the size, and a bit faster

  windStrength: 0.1, // sideways drift as a share of the box width. 0 is no wind

  aimLeft: 1 / 3, // left of this share of the box, show the left hand
  aimRight: 2 / 3, // right of this share of the box, show the right hand
  handFade: 100, // milliseconds to blend between hand photos
  handRecoil: 120, // how long the recoil photo stays up, in milliseconds
  handSize: 0.45, // how far up the hand reaches on a large screen, as a share of the box height
  handSizePhone: 0.36, // a bit smaller on a phone
  handSlide: 6, // furthest the hand shifts toward the aim, in pixels

  nearDistance: 0.42, // closest a clay can be. Lower is closer to the shooter
  farDistance: 1, // furthest a clay can be

  shotTravelNear: 80, // how long a shot takes to reach a near clay, in milliseconds
  shotTravelFar: 350, // how long a shot takes to reach a far clay, in milliseconds

  // Share of the box width a clay can cover in one second, before distance slows it down.
  // 0.75 crosses most of the box in a bit over a second.
  speedMin: 0.64,
  speedMax: 0.96,

  sizeNear: 1.34, // nearest clays, compared with the base size. Bigger than 1
  sizeFar: 0.62, // furthest clays, compared with the base size. Smaller than 1

  fairVisible: 0.75, // share of the flight that must stay inside the box
  fairMargin: 0.04, // keep this share of the box clear at the edges
  fairTime: 1.2, // seconds a clay must be shootable
  fairHand: 0.25, // most of the on-screen flight that can sit behind the hand
  fairTries: 20, // new throws to try before using a safe one

  perfectDuration: 5200, // full 5/5 celebration before the result settles
  perfectSpinTime: 1800, // one full spin of the main hand
  perfectSweepStart: 1800, // when the machine-gun sweep begins
  perfectSweepTime: 2500, // left-to-right sweep time
  perfectShotCount: 14, // fireworks fired during the sweep
  perfectRecoilTime: 120, // how long each recoil photo stays up
  perfectFireworkTravel: 260, // fingertip-to-burst firework time
  perfectSparkTime: 450, // how long each firework burst lasts
  winnerBannerStart: 4600, // when the winner quip begins dropping
  winnerBannerDropTime: 400, // winner quip drop time
  perfectFireworkSize: 4, // firework dot and spark size
  perfectSparkCount: 10, // sparks in each firework burst
};

const pelletFade = 400;
const shakeTime = 110;
const floaterTime = 480;
const minAirTime = 1.08;
const farPattern = 0.78;

const handPoses = [
  "left",
  "straight",
  "right",
  "recoil-left",
  "recoil-straight",
  "recoil-right",
] as const;

type HandPose = (typeof handPoses)[number];
type HandFacing = "left" | "straight" | "right";

function handSrc(pose: HandPose) {
  return `/hand/hand-${pose}.webp`;
}

function recoilPose(facing: HandFacing): HandPose {
  if (facing === "left") {
    return "recoil-left";
  }
  if (facing === "right") {
    return "recoil-right";
  }
  return "recoil-straight";
}

type ThrowKind = "crosser" | "away" | "incomer" | "high" | "rabbit" | "battue" | "teal";

type Clay = {
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
};

export type Shard = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  size: number;
};

type Pellet = {
  x: number;
  y: number;
};

type Shot = {
  pellets: Pellet[];
  arriveAt: number;
  born: number;
  dot: number;
};

type Floater = {
  x: number;
  y: number;
  born: number;
};

type GameResult = {
  score: number;
  message: string;
  perfect: boolean;
};

type Colors = {
  clay: string;
  clayDark: string;
  ink: string;
  field: string;
};

function readColors(box: HTMLElement): Colors {
  const styles = getComputedStyle(box);
  const read = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;

  return {
    clay: read("--color-clay", "#e8480c"),
    clayDark: read("--color-clay-dark", "#9e2f06"),
    ink: read("--color-ink", "#161514"),
    field: read("--color-field", "#eae4d7"),
  };
}

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

function pickDistance(from: number, to: number) {
  const start = lerp(settings.nearDistance, settings.farDistance, from);
  const end = lerp(settings.nearDistance, settings.farDistance, to);
  return rand(Math.min(start, end), Math.max(start, end));
}

function pickPace(from: number, to: number) {
  return lerp(settings.speedMin, settings.speedMax, rand(from, to));
}

function pickThrow(): ThrowKind {
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

function parseColor(color: string) {
  const value = color.trim();
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    const full = hex.length === 3 ? hex.split("").map((part) => part + part).join("") : hex;
    return [
      Number.parseInt(full.slice(0, 2), 16),
      Number.parseInt(full.slice(2, 4), 16),
      Number.parseInt(full.slice(4, 6), 16),
    ];
  }
  const match = value.match(/(\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  return [232, 72, 12];
}

function mixColor(from: string, to: string, amount: number) {
  const [ar, ag, ab] = parseColor(from);
  const [br, bg, bb] = parseColor(to);
  const red = Math.round(lerp(ar, br, amount));
  const green = Math.round(lerp(ag, bg, amount));
  const blue = Math.round(lerp(ab, bb, amount));
  return `rgb(${red}, ${green}, ${blue})`;
}

function pickSize() {
  const options = [
    { scale: 1, weight: settings.sizeStandard },
    { scale: 0.75, weight: settings.sizeMidi },
    { scale: 0.5, weight: settings.sizeMini },
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

function lookOf(clay: Clay) {
  const t = distanceT(clay.distance);
  const width =
    settings.claySize * lerp(settings.sizeNear, settings.sizeFar, t) * clay.sizeScale;
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

function placePath(target: Clay, amount: number, boxWidth: number) {
  const u = Math.max(0, Math.min(1, amount));
  if (target.kind === "away") {
    const ease = 1 - (1 - u) * (1 - u);
    target.x = lerp(target.x0, target.x1, ease) + Math.sin(ease * Math.PI) * target.cx;
    target.y = lerp(target.y0, target.y1, ease);
    target.distance = lerp(target.distance0, target.distance1, ease);
    target.x += target.wind * boxWidth * 0.42 * Math.sin(u * Math.PI);
    return;
  }
  const rest = 1 - u;
  target.x = rest * rest * target.x0 + 2 * rest * u * target.cx + u * u * target.x1;
  target.y = rest * rest * target.y0 + 2 * rest * u * target.cy + u * u * target.y1;
  target.distance = lerp(target.distance0, target.distance1, u);
  target.x += target.wind * boxWidth * 0.42 * Math.sin(u * Math.PI);
}

function stepClay(clay: Clay, dt: number, boxWidth: number, boxHeight: number) {
  if (clay.kind === "away" || clay.kind === "incomer") {
    const prevX = clay.x;
    const prevY = clay.y;
    clay.age += dt;
    placePath(clay, clay.age / Math.max(clay.duration, 0.001), boxWidth);
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

function clayGone(clay: Clay, boxWidth: number, boxHeight: number) {
  const look = lookOf(clay);
  const left = clay.vx < 0 && clay.x < -look.rx * 1.6;
  const right = clay.vx > 0 && clay.x > boxWidth + look.rx * 1.6;
  const dropped = clay.y > boxHeight + look.ry * 1.6;
  const climbed = clay.kind !== "rabbit" && clay.y < -look.ry * 2.4;
  const finishedPath =
    (clay.kind === "away" || clay.kind === "incomer") && clay.age >= clay.duration;
  return finishedPath || left || right || dropped || climbed;
}

function flightIsFair(
  source: Clay,
  boxWidth: number,
  boxHeight: number,
  hidden: (x: number, y: number) => boolean,
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

function stepShard(shard: Shard, dt: number) {
  shard.vy += settings.gravity * dt;
  shard.x += shard.vx * dt;
  shard.y += shard.vy * dt;
  shard.angle += shard.spin * dt;
}

function createShards(clay: Clay): Shard[] {
  const shards: Shard[] = [];
  const count = Math.max(1, Math.round(settings.shardCount));
  const scale = Math.max(0.45, lookOf(clay).disc / (settings.claySize / 2));

  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count + Math.random() * 0.4;
    const speed = settings.shardSpeed * (0.45 + Math.random() * 0.7);
    shards.push({
      x: clay.x,
      y: clay.y,
      vx: Math.cos(angle) * speed + clay.vx * 0.15,
      vy: Math.sin(angle) * speed * 0.75 + clay.vy * 0.15 - 40,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 14,
      size: (4 + Math.random() * 5) * scale,
    });
  }

  return shards;
}

function patternRadius(distance: number | null) {
  const t = distance == null ? 0.45 : distanceT(distance);
  return settings.patternSize * lerp(1, farPattern, t);
}

function shotDelay(distance: number | null) {
  const t = distance == null ? 0.45 : distanceT(distance);
  return lerp(settings.shotTravelNear, settings.shotTravelFar, t);
}

function scatterPellets(x: number, y: number, radius: number): Pellet[] {
  const pellets: Pellet[] = [];
  const count = Math.max(1, Math.round(settings.pelletCount));

  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * radius;
    pellets.push({
      x: x + Math.cos(angle) * distance,
      y: y + Math.sin(angle) * distance,
    });
  }

  return pellets;
}

function pelletHitsClay(clay: Clay, pellet: Pellet) {
  const { rx, ry } = lookOf(clay);
  const hitX = rx + settings.hitAreaSize;
  const hitY = ry + settings.hitAreaSize;
  const dx = (pellet.x - clay.x) / hitX;
  const dy = (pellet.y - clay.y) / hitY;
  return dx * dx + dy * dy <= 1;
}

function drawClay(
  ctx: CanvasRenderingContext2D,
  clay: Clay,
  colors: Colors,
) {
  const look = lookOf(clay);
  const fill = mixColor(colors.clay, colors.field, look.pale);
  const stroke = mixColor(colors.clayDark, colors.field, look.pale * 0.65);

  ctx.save();
  ctx.translate(clay.x, clay.y);

  if (clay.kind === "rabbit") {
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1.5, look.ry * 0.08);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.ellipse(0, 0, look.rx, look.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.rotate(clay.roll);
    ctx.beginPath();
    ctx.moveTo(0, -look.ry * 0.8);
    ctx.lineTo(0, look.ry * 0.8);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    return;
  }

  const tilt = Math.max(-0.45, Math.min(0.45, Math.atan2(clay.vy, clay.vx) * 0.28));
  if (clay.kind === "battue") {
    ctx.rotate(clay.roll + tilt * (1 - Math.min(1, Math.abs(clay.roll) / 2)));
  } else {
    ctx.rotate(tilt);
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(0, look.ry * 0.16, look.rx, look.ry, 0, 0, Math.PI * 2);
  ctx.fill();

  const scale = look.rx / 78;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(1.5, 3.5 * scale);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-72 * scale, 0);
  ctx.bezierCurveTo(-42 * scale, -30 * scale, 42 * scale, -30 * scale, 72 * scale, 0);
  ctx.stroke();
  ctx.restore();
}

function drawShard(ctx: CanvasRenderingContext2D, shard: Shard, color: string) {
  ctx.save();
  ctx.translate(shard.x, shard.y);
  ctx.rotate(shard.angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(shard.size, 0);
  ctx.lineTo(-shard.size * 0.45, shard.size * 0.55);
  ctx.lineTo(-shard.size * 0.15, -shard.size * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function ClayGame({
  replayLabel,
  liveLabel,
  hitMark,
  scoreMessages,
  onFail,
}: {
  replayLabel: string;
  liveLabel: string;
  hitMark: string;
  scoreMessages: string[][];
  onFail: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  const replayRef = useRef<HTMLButtonElement>(null);
  const onFailRef = useRef(onFail);
  const hitMarkRef = useRef(hitMark);
  const scoreMessagesRef = useRef(scoreMessages);
  const [score, setScore] = useState({ hits: 0, launched: 0 });
  const [over, setOver] = useState(false);
  const [result, setResult] = useState<GameResult | null>(null);

  useEffect(() => {
    onFailRef.current = onFail;
  }, [onFail]);

  useEffect(() => {
    hitMarkRef.current = hitMark;
  }, [hitMark]);

  useEffect(() => {
    scoreMessagesRef.current = scoreMessages;
  }, [scoreMessages]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = canvas?.parentElement;
    if (!canvas || !box) {
      onFailRef.current();
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      onFailRef.current();
      return;
    }

    const colors = readColors(box);
    const uiFont = getComputedStyle(box).fontFamily || "Instrument Sans, sans-serif";
    let width = 0;
    let height = 0;
    let frame = 0;
    let last = 0;
    let visible = true;
    let stopped = false;
    let launched = 0;
    let hits = 0;
    let finished = false;
    let fastClays = 0;
    let fastClayDeadline =
      1 + Math.floor(Math.random() * Math.max(1, settings.claysPerRound));
    let lastMessage = "";
    let forcePerfect = window.location.href.endsWith("?perfect");
    let celebrationAt = 0;
    let celebrationFinished = false;
    let pendingResult: GameResult | null = null;
    let nextLaunchAt = performance.now() + 280;
    let readyAt = 0;
    let dtHand = 0.016;
    let handsReady = false;
    let photoRatio = 208 / 228;
    let handRows: { min: number; max: number }[] = [];
    let handPixelW = 1;
    let handPixelH = 1;
    let recoilUntil = 0;
    let recoilFacing: HandFacing = "straight";
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const handImages: Partial<Record<HandPose, HTMLImageElement>> = {};
    const handOpacity: Record<HandPose, number> = {
      left: 0,
      straight: 1,
      right: 0,
      "recoil-left": 0,
      "recoil-straight": 0,
      "recoil-right": 0,
    };
    let nextSize = 1;
    const preloadHands = Promise.all(
      handPoses.map(
        (pose) =>
          new Promise<void>((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
              handImages[pose] = image;
              if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                photoRatio = image.naturalWidth / image.naturalHeight;
              }
              if (pose === "straight") {
                rememberHand(image);
              }
              resolve();
            };
            image.onerror = () => reject(new Error(pose));
            image.src = handSrc(pose);
          }),
      ),
    );
    preloadHands
      .then(() => {
        if (!stopped) {
          handsReady = true;
        }
      })
      .catch(() => {
        if (!stopped) {
          onFailRef.current();
        }
      });

    const rememberHand = (image: HTMLImageElement) => {
      try {
        const scratch = document.createElement("canvas");
        scratch.width = image.naturalWidth;
        scratch.height = image.naturalHeight;
        const context = scratch.getContext("2d", { willReadFrequently: true });
        if (!context) {
          return;
        }
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, scratch.width, scratch.height).data;
        const rows: { min: number; max: number }[] = [];
        for (let y = 0; y < scratch.height; y += 1) {
          let min = -1;
          let max = -1;
          const start = y * scratch.width * 4;
          for (let x = 0; x < scratch.width; x += 1) {
            if (pixels[start + x * 4 + 3] > 28) {
              if (min < 0) {
                min = x;
              }
              max = x;
            }
          }
          rows.push({ min, max });
        }
        handRows = rows;
        handPixelW = scratch.width;
        handPixelH = scratch.height;
      } catch {
        handRows = [];
      }
    };

    const behindHand = (x: number, y: number) => {
      const reach = height * (height >= 500 ? settings.handSize : settings.handSizePhone);
      if (reach < 2 || handRows.length === 0) {
        return false;
      }
      const photoW = reach * photoRatio;
      const left = width / 2 - photoW / 2;
      const top = height - reach;
      const localY = ((y - top) / reach) * handPixelH;
      if (localY < 0 || localY >= handPixelH) {
        return false;
      }
      const row = handRows[Math.min(handRows.length - 1, Math.max(0, Math.round(localY)))];
      if (!row || row.min < 0) {
        return false;
      }
      const localX = ((x - left) / photoW) * handPixelW;
      const pad = (Math.max(0, settings.handSlide) / photoW) * handPixelW;
      return localX >= row.min - pad && localX <= row.max + pad;
    };

    const facingFor = (x: number): HandFacing => {
      if (width <= 0) {
        return "straight";
      }
      const across = x / width;
      if (across < settings.aimLeft) {
        return "left";
      }
      if (across > settings.aimRight) {
        return "right";
      }
      return "straight";
    };

    let shakeAt = 0;
    let clay: Clay | null = null;
    let aimX = 0;
    let aimY = 0;
    let pointerDown: { x: number; y: number } | null = null;
    let finePointer = window.matchMedia("(pointer: fine)").matches;
    let pointerInside = false;
    const shards: Shard[] = [];
    const shots: Shot[] = [];
    const floaters: Floater[] = [];

    const publish = () => {
      setScore({ hits, launched });
    };

    const pickScoreMessage = (value: number) => {
      const messages = scoreMessagesRef.current[value] ?? [];
      if (messages.length === 0) {
        return "";
      }
      let previous = lastMessage;
      try {
        previous =
          window.sessionStorage.getItem("clay-last-score-message") ?? previous;
      } catch {
        // The in-memory value still prevents repeats for this page.
      }
      const choices =
        messages.length > 1
          ? messages.filter((message) => message !== previous)
          : messages;
      const message =
        choices[Math.floor(Math.random() * Math.max(1, choices.length))] ??
        messages[0];
      lastMessage = message;
      try {
        window.sessionStorage.setItem("clay-last-score-message", message);
      } catch {
        // Some privacy settings block storage; the game still works.
      }
      return message;
    };

    const finishRound = (now: number) => {
      finished = true;
      const perfect =
        hits >= Math.max(1, settings.claysPerRound) || forcePerfect;
      forcePerfect = false;
      pendingResult = {
        score: hits,
        message: pickScoreMessage(
          perfect ? 5 : Math.max(0, Math.min(4, hits)),
        ),
        perfect,
      };
      publish();
      if (perfect && !reducedMotion) {
        celebrationAt = now;
        celebrationFinished = false;
        return;
      }
      setResult(pendingResult);
      setOver(true);
    };

    const clearShake = () => {
      shakeAt = 0;
      box.style.transform = "";
    };

    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (aimX === 0 && aimY === 0) {
        aimX = width * 0.5;
        aimY = height * 0.35;
      }
    };

    const freshClay = (kind: ThrowKind, distance: number): Clay => ({
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
      sizeScale: nextSize,
      wind: (Math.random() - 0.5) * 2 * settings.windStrength,
      hang: 0,
      hangLimit: nextSize <= 0.55 ? 0.16 : 0.28,
    });

    const visibleShare = (target: Clay) => {
      const steps = 28;
      let hits = 0;
      for (let index = 0; index < steps; index += 1) {
        const ghost = { ...target };
        placePath(ghost, (index + 0.5) / steps, width);
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
      return hits / steps;
    };

    const holdLongEnough = (target: Clay) => {
      const share = visibleShare(target);
      if (share < 0.08) {
        return;
      }
      const visible = target.duration * share;
      if (visible < minAirTime) {
        target.duration = Math.min(2.8, (target.duration * minAirTime) / visible);
      }
    };

    const aimPath = (target: Clay) => {
      placePath(target, 0, width);
      const startX = target.x;
      const startY = target.y;
      placePath(target, 0.03, width);
      const slice = Math.max(0.03 * target.duration, 0.001);
      target.vx = (target.x - startX) / slice;
      target.vy = (target.y - startY) / slice;
      placePath(target, 0, width);
    };

    const paceTime = (distance: number, pace: number) => {
      const scaled = pace * lerp(1.12, 0.78, distanceT(distance));
      const widthsPerSecond = Math.min(0.95, Math.max(0.4, scaled));
      return 1 / widthsPerSecond;
    };

    const flightTime = (distance: number, pace: number) => {
      const boost = nextSize <= 0.55 ? 1.32 : 1;
      return Math.max(minAirTime, paceTime(distance, pace) / boost);
    };

    const launchCrosser = (kind: "crosser" | "high") => {
      const distance =
        kind === "high" ? pickDistance(0.45, 1) : pickDistance(0, 1);
      const target = freshClay(kind, distance);
      const direction = Math.random() < 0.5 ? 1 : -1;
      const time = flightTime(distance, kind === "high" ? pickPace(0.15, 0.55) : pickPace(0, 1));
      const look = lookOf(target);
      const riseLimit = kind === "high" ? 0.06 : 0.2;
      const yMin = kind === "high" ? height * 0.14 : height * 0.32;
      const yMax = kind === "high" ? height * 0.34 : height * 0.66;
      target.y = rand(yMin, Math.max(yMin + 8, yMax));
      const riseRoom = kind === "high" ? target.y - height * 0.08 : target.y - 14;
      const rise = Math.min(height * rand(kind === "high" ? 0.02 : 0.07, riseLimit), Math.max(riseRoom, 8));
      const duration = time;
      const gravity = Math.max(rise, 12) / (0.125 * duration * duration);
      const span = width + look.rx * 2;
      target.x = direction > 0 ? -look.rx - 2 : width + look.rx + 2;
      target.vx = (direction * span) / duration;
      target.vy = -0.5 * gravity * duration;
      target.gravityScale = gravity / Math.max(settings.gravity, 1);
      target.duration = duration;
      return target;
    };

    const launchAway = () => {
      const side = Math.random() < 0.5 ? -1 : 1;
      const target = freshClay("away", settings.nearDistance);
      target.distance0 = rand(settings.nearDistance, lerp(settings.nearDistance, settings.farDistance, 0.28));
      target.distance1 = rand(lerp(settings.nearDistance, settings.farDistance, 0.72), settings.farDistance);
      target.distance = target.distance0;
      target.x0 = width * 0.5 + side * width * rand(0.1, 0.2);
      target.y0 = height * rand(0.66, 0.86);
      target.x1 = width * rand(0.22, 0.78);
      target.y1 = height * rand(0.1, 0.28);
      target.cx = (Math.random() - 0.5) * width * 0.18;
      target.duration = flightTime(
        (target.distance0 + target.distance1) / 2,
        pickPace(0.15, 0.9),
      );
      holdLongEnough(target);
      aimPath(target);
      return target;
    };

    const launchIncomer = () => {
      const target = freshClay("incomer", settings.farDistance);
      target.distance0 = rand(lerp(settings.nearDistance, settings.farDistance, 0.78), settings.farDistance);
      target.distance1 = rand(settings.nearDistance, lerp(settings.nearDistance, settings.farDistance, 0.32));
      target.distance = target.distance0;
      target.x0 = width * rand(0.22, 0.78);
      target.y0 = height * rand(0.16, 0.34);
      target.x1 = Math.max(width * 0.18, Math.min(width * 0.82, target.x0 + width * rand(-0.24, 0.24)));
      target.y1 = -height * rand(0.08, 0.16);
      target.cx = Math.max(
        width * 0.16,
        Math.min(width * 0.84, lerp(target.x0, target.x1, 0.4) + width * rand(-0.1, 0.1)),
      );
      target.cy = height * rand(0.4, 0.62);
      target.duration = flightTime(
        (target.distance0 + target.distance1) / 2,
        pickPace(0.1, 0.7),
      );
      holdLongEnough(target);
      aimPath(target);
      return target;
    };

    const launchRabbit = () => {
      const distance = pickDistance(0, 0.5);
      const target = freshClay("rabbit", distance);
      const direction = Math.random() < 0.5 ? 1 : -1;
      const time = flightTime(distance, lerp(0.48, 0.7, Math.random()));
      const look = lookOf(target);
      const span = width + look.rx * 2;
      target.x = direction > 0 ? -look.rx - 2 : width + look.rx + 2;
      target.y = height - look.ry;
      target.vx = (direction * span) / time;
      target.vy = -Math.sqrt(2 * Math.max(settings.gravity, 1) * height * rand(0.06, 0.14));
      target.gravityScale = 1;
      target.duration = time;
      return target;
    };

    const launchBattue = () => {
      const distance = pickDistance(0.1, 0.8);
      const target = freshClay("battue", distance);
      const direction = Math.random() < 0.5 ? 1 : -1;
      const duration = Math.max(flightTime(distance, pickPace(0.4, 0.95)), 1.7);
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
      return target;
    };

    const launchTeal = () => {
      const distance = pickDistance(0.15, 0.7);
      const target = freshClay("teal", distance);
      const boost = nextSize <= 0.55 ? 1.28 : 1;
      target.x = width * rand(0.3, 0.7);
      target.y = height * rand(0.62, 0.8);
      const peak = height * rand(0.12, 0.24);
      const rise = Math.max(48, target.y - peak);
      const gravity = settings.gravity * 0.62 * boost;
      target.gravityScale = 0.62 * boost;
      target.vy = -Math.sqrt(2 * gravity * rise);
      target.vx = (Math.random() - 0.5) * width * 0.05;
      target.duration = 1.7;
      return target;
    };

    const makeThrow = (kind: ThrowKind) => {
      if (kind === "crosser" || kind === "high") {
        return launchCrosser(kind);
      }
      if (kind === "away") {
        return launchAway();
      }
      if (kind === "incomer") {
        return launchIncomer();
      }
      if (kind === "battue") {
        return launchBattue();
      }
      if (kind === "teal") {
        return launchTeal();
      }
      return launchRabbit();
    };

    const safeCrosser = (fast = false, extraTime = 0) => {
      const target = freshClay(
        "crosser",
        lerp(settings.nearDistance, settings.farDistance, 0.45),
      );
      target.sizeScale = fast ? settings.fastClaySize : 1;
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
      return target;
    };

    const launch = () => {
      if (width < 20 || height < 20) {
        nextLaunchAt = performance.now() + 50;
        return;
      }
      const roundLength = Math.max(1, settings.claysPerRound);
      const fastMinimum = Math.max(0, Math.round(settings.fastClaysPerRound));
      const throwsLeft = roundLength - launched;
      const fastStillNeeded = Math.max(0, fastMinimum - fastClays);
      const forceFast =
        fastStillNeeded > 0 &&
        (launched + 1 >= fastClayDeadline || throwsLeft <= fastStillNeeded);
      const tries = Math.max(1, Math.round(settings.fairTries));
      const kind = pickThrow();
      let chosen: Clay | null = null;
      for (let attempt = 0; attempt < tries; attempt += 1) {
        nextSize = forceFast ? settings.fastClaySize : pickSize();
        const candidate = makeThrow(kind);
        if (flightIsFair(candidate, width, height, behindHand)) {
          chosen = candidate;
          break;
        }
      }
      if (!chosen) {
        nextSize = forceFast ? settings.fastClaySize : 1;
        for (let attempt = 0; attempt < tries; attempt += 1) {
          const fallback = safeCrosser(forceFast, attempt * 0.04);
          if (flightIsFair(fallback, width, height, behindHand)) {
            chosen = fallback;
            break;
          }
        }
      }
      if (!chosen) {
        nextLaunchAt = performance.now() + 50;
        return;
      }
      clay = chosen;
      if (clay.sizeScale <= settings.fastClaySize + 0.001) {
        fastClays += 1;
      }
      launched += 1;
      nextLaunchAt = 0;
      publish();
    };

    const resolveClay = (now: number) => {
      clay = null;
      if (launched >= Math.max(1, settings.claysPerRound)) {
        finishRound(now);
        return;
      }
      nextLaunchAt = now + settings.pauseBetweenClays;
    };

    const breakClay = (now: number) => {
      if (!clay) {
        return;
      }
      floaters.push({ x: clay.x, y: clay.y, born: now });
      shards.push(...createShards(clay));
      hits += 1;
      if (settings.shakeStrength > 0) {
        shakeAt = now;
      }
      resolveClay(now);
      publish();
    };

    const shoot = (x: number, y: number, now: number) => {
      aimX = x;
      aimY = y;
      if (finished || now < readyAt) {
        return;
      }
      readyAt = now + settings.reloadTime;
      recoilFacing = facingFor(x);
      recoilUntil = now + settings.handRecoil;
      const distance = clay ? clay.distance : null;
      const t = distance == null ? 0.45 : distanceT(distance);
      shots.push({
        pellets: scatterPellets(x, y, patternRadius(distance)),
        arriveAt: now + shotDelay(distance),
        born: 0,
        dot: 2.25 * lerp(1, 0.82, t),
      });
    };

    const localPoint = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") {
        if (event.button !== 0) {
          return;
        }
        const point = localPoint(event);
        shoot(point.x, point.y, performance.now());
        return;
      }
      pointerDown = { x: event.clientX, y: event.clientY };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        return;
      }
      const point = localPoint(event);
      aimX = point.x;
      aimY = point.y;
      pointerInside = true;
      finePointer = true;
    };

    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType === "mouse") {
        pointerInside = false;
      }
    };

    const onPointerCancel = () => {
      pointerDown = null;
    };

    const onReplay = () => {
      launched = 0;
      hits = 0;
      finished = false;
      fastClays = 0;
      fastClayDeadline =
        1 + Math.floor(Math.random() * Math.max(1, settings.claysPerRound));
      celebrationAt = 0;
      celebrationFinished = false;
      pendingResult = null;
      readyAt = 0;
      clay = null;
      shards.length = 0;
      shots.length = 0;
      floaters.length = 0;
      recoilUntil = 0;
      for (const pose of handPoses) {
        handOpacity[pose] = pose === facingFor(aimX) ? 1 : 0;
      }
      clearShake();
      nextLaunchAt = performance.now() + 280;
      publish();
      start();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || !pointerDown) {
        pointerDown = null;
        return;
      }
      const dx = event.clientX - pointerDown.x;
      const dy = event.clientY - pointerDown.y;
      pointerDown = null;
      if (dx * dx + dy * dy > 12 * 12) {
        return;
      }
      const point = localPoint(event);
      shoot(point.x, point.y, performance.now());
    };

    const applyShake = (now: number) => {
      if (settings.shakeStrength <= 0 || shakeAt <= 0) {
        if (box.style.transform) {
          box.style.transform = "";
        }
        return;
      }
      const progress = (now - shakeAt) / shakeTime;
      if (progress >= 1) {
        clearShake();
        return;
      }
      const amount = settings.shakeStrength * (1 - progress);
      const x = Math.sin(progress * 48) * amount;
      const y = Math.cos(progress * 37) * amount;
      box.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
    };

    const drawHandPhoto = (
      image: HTMLImageElement,
      x: number,
      y: number,
      handHeight: number,
      rotation: number,
      opacity: number,
    ) => {
      const handWidth = handHeight * photoRatio;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.drawImage(
        image,
        -handWidth / 2,
        -handHeight / 2,
        handWidth,
        handHeight,
      );
      ctx.restore();
    };

    const celebrationFacing = (progress: number): HandFacing => {
      if (progress < 1 / 3) {
        return "left";
      }
      if (progress > 2 / 3) {
        return "right";
      }
      return "straight";
    };

    const drawCelebration = (now: number) => {
      if (celebrationAt <= 0) {
        return;
      }
      const elapsed = Math.min(
        Math.max(0, now - celebrationAt),
        settings.perfectDuration,
      );
      const straight = handImages.straight;

      if (
        straight &&
        !celebrationFinished &&
        elapsed < settings.perfectSpinTime
      ) {
        const progress = clamp01(elapsed / settings.perfectSpinTime);
        const eased = 1 - Math.pow(1 - progress, 3);
        const handHeight = Math.min(
          height * 0.38,
          Math.max(86, width * 0.24),
        );
        drawHandPhoto(
          straight,
          width / 2,
          height - handHeight * 0.42,
          handHeight,
          eased * Math.PI * 2,
          1 - clamp01((progress - 0.82) / 0.18),
        );
      }

      if (
        !celebrationFinished &&
        elapsed >= settings.perfectSweepStart
      ) {
        const shotCount = Math.max(
          1,
          Math.round(settings.perfectShotCount),
        );
        const interval =
          shotCount <= 1
            ? settings.perfectSweepTime
            : settings.perfectSweepTime / (shotCount - 1);
        const sweep = clamp01(
          (elapsed - settings.perfectSweepStart) /
            settings.perfectSweepTime,
        );
        const facing = celebrationFacing(sweep);
        const latestShot = Math.min(
          shotCount - 1,
          Math.max(
            0,
            Math.floor(
              (elapsed - settings.perfectSweepStart) /
                Math.max(1, interval),
            ),
          ),
        );
        const latestFireAt =
          settings.perfectSweepStart + latestShot * interval;
        const recoiling =
          elapsed >= latestFireAt &&
          elapsed < latestFireAt + settings.perfectRecoilTime;
        const shotFacing = celebrationFacing(
          shotCount <= 1 ? 0.5 : latestShot / (shotCount - 1),
        );
        const pose = recoiling ? recoilPose(shotFacing) : facing;
        const handImage = handImages[pose];
        const handHeight = Math.min(
          height * 0.38,
          Math.max(86, width * 0.24),
        );
        if (handImage && elapsed <= settings.winnerBannerStart) {
          const sweepEnd =
            settings.perfectSweepStart + settings.perfectSweepTime;
          const settleGap = Math.max(
            1,
            settings.winnerBannerStart - sweepEnd,
          );
          const opacity =
            elapsed <= sweepEnd
              ? 1
              : 1 - clamp01((elapsed - sweepEnd) / settleGap);
          drawHandPhoto(
            handImage,
            width / 2,
            height - handHeight * 0.42,
            handHeight,
            0,
            opacity,
          );
        }

        for (let index = 0; index < shotCount; index += 1) {
          const shotProgress =
            shotCount <= 1 ? 0.5 : index / (shotCount - 1);
          const fireAt =
            settings.perfectSweepStart + index * interval;
          const fireworkAge = elapsed - fireAt;
          if (
            fireworkAge < 0 ||
            fireworkAge >
              settings.perfectFireworkTravel +
                settings.perfectSparkTime
          ) {
            continue;
          }
          const startFireX =
            width / 2 + lerp(-0.2, 0.2, shotProgress) * handHeight;
          const startFireY = height - handHeight * 0.82;
          const burstX =
            lerp(width * 0.12, width * 0.88, shotProgress) +
            Math.sin(index * 2.4) * width * 0.025;
          const burstY =
            height * (0.18 + ((index % 3) / 2) * 0.12);
          const travel = clamp01(
            fireworkAge / settings.perfectFireworkTravel,
          );
          if (travel < 1) {
            const easedTravel = 1 - Math.pow(1 - travel, 2);
            const fireX = lerp(startFireX, burstX, easedTravel);
            const fireY = lerp(startFireY, burstY, easedTravel);
            ctx.save();
            ctx.globalAlpha = 0.55;
            ctx.strokeStyle = index % 2 === 0 ? colors.clay : colors.ink;
            ctx.lineWidth = Math.max(
              1,
              settings.perfectFireworkSize * 0.5,
            );
            ctx.beginPath();
            ctx.moveTo(startFireX, startFireY);
            ctx.lineTo(fireX, fireY);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.fillStyle = index % 2 === 0 ? colors.clay : colors.ink;
            ctx.beginPath();
            ctx.arc(
              fireX,
              fireY,
              settings.perfectFireworkSize,
              0,
              Math.PI * 2,
            );
            ctx.fill();
            ctx.restore();
          }

          const sparkAge =
            (fireworkAge - settings.perfectFireworkTravel) /
            settings.perfectSparkTime;
          if (sparkAge >= 0 && sparkAge <= 1) {
            const sparkCount = Math.max(
              1,
              Math.round(settings.perfectSparkCount),
            );
            const radius =
              sparkAge * settings.perfectFireworkSize * 11;
            ctx.save();
            ctx.globalAlpha = 1 - sparkAge;
            for (let spark = 0; spark < sparkCount; spark += 1) {
              const angle =
                (Math.PI * 2 * spark) / sparkCount + index * 0.47;
              ctx.fillStyle =
                (spark + index) % 2 === 0 ? colors.clay : colors.ink;
              ctx.beginPath();
              ctx.arc(
                burstX + Math.cos(angle) * radius,
                burstY + Math.sin(angle) * radius,
                Math.max(1.5, settings.perfectFireworkSize * 0.55),
                0,
                Math.PI * 2,
              );
              ctx.fill();
            }
            ctx.restore();
          }
        }
      }

      if (
        !celebrationFinished &&
        elapsed >= settings.winnerBannerStart &&
        pendingResult
      ) {
        const drop = clamp01(
          (elapsed - settings.winnerBannerStart) /
            settings.winnerBannerDropTime,
        );
        const eased = 1 - Math.pow(1 - drop, 3);
        const y = lerp(-36, height * 0.47, eased);
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const fontSize = Math.max(22, Math.min(42, width * 0.065));
        ctx.font = `700 ${fontSize}px ${uiFont}`;
        ctx.lineWidth = 7;
        ctx.strokeStyle = colors.field;
        ctx.fillStyle = colors.clay;
        const words = pendingResult.message.split(" ");
        const lines: string[] = [];
        const maxWidth = width * 0.82;
        for (const word of words) {
          const current = lines[lines.length - 1] ?? "";
          const next = current ? `${current} ${word}` : word;
          if (current && ctx.measureText(next).width > maxWidth) {
            lines.push(word);
          } else if (lines.length === 0) {
            lines.push(next);
          } else {
            lines[lines.length - 1] = next;
          }
        }
        const lineHeight = fontSize * 1.12;
        const firstY = y - ((lines.length - 1) * lineHeight) / 2;
        lines.forEach((line, index) => {
          const lineY = firstY + index * lineHeight;
          ctx.strokeText(line, width / 2, lineY);
          ctx.fillText(line, width / 2, lineY);
        });
        ctx.restore();
      }
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = colors.field;
      ctx.fillRect(0, 0, width, height);

      for (const shard of shards) {
        drawShard(ctx, shard, colors.clay);
      }

      if (clay) {
        drawClay(ctx, clay, colors);
      }

      for (const shot of shots) {
        if (shot.born <= 0) {
          continue;
        }
        const age = (now - shot.born) / pelletFade;
        if (age >= 1) {
          continue;
        }
        ctx.save();
        ctx.globalAlpha = 1 - age;
        ctx.fillStyle = colors.ink;
        for (const pellet of shot.pellets) {
          ctx.beginPath();
          ctx.arc(pellet.x, pellet.y, shot.dot, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.save();
      ctx.textAlign = "center";
      ctx.font = `600 18px ${uiFont}`;
      ctx.fillStyle = colors.clay;
      for (const floater of floaters) {
        const age = (now - floater.born) / floaterTime;
        if (age >= 1) {
          continue;
        }
        ctx.globalAlpha = 1 - age;
        ctx.fillText(hitMarkRef.current, floater.x, floater.y - age * 28);
      }
      ctx.restore();

      const hand = handRef.current;
      if (hand && width > 0 && height > 0) {
        const celebrating = celebrationAt > 0;
        const reach = height * (height >= 500 ? settings.handSize : settings.handSizePhone);
        const slideLimit = Math.max(0, settings.handSlide);
        const slide = Math.max(
          -slideLimit,
          Math.min(slideLimit, (aimX / width - 0.5) * 2 * slideLimit),
        );
        hand.style.visibility =
          handsReady && !celebrating ? "visible" : "hidden";
        hand.style.height = `${Math.round(reach)}px`;
        hand.style.width = `${Math.round(reach * photoRatio)}px`;
        hand.style.transform = `translateX(calc(-50% + ${slide.toFixed(2)}px))`;

        const showingRecoil = recoilUntil > 0 && now < recoilUntil;
        const targetPose = showingRecoil ? recoilPose(recoilFacing) : facingFor(aimX);
        const step =
          settings.handFade <= 0 ? 1 : ((dtHand || 0.016) * 1000) / settings.handFade;
        for (const pose of handPoses) {
          const goal = pose === targetPose ? 1 : 0;
          if (showingRecoil) {
            handOpacity[pose] = goal;
          } else {
            const gap = goal - handOpacity[pose];
            handOpacity[pose] += Math.sign(gap) * Math.min(step, Math.abs(gap));
          }
          const node = hand.querySelector<HTMLElement>(`[data-hand="${pose}"]`);
          if (node) {
            node.style.opacity = String(handOpacity[pose]);
          }
        }
      }

      drawCelebration(now);

      if (finePointer && pointerInside) {
        ctx.strokeStyle = colors.ink;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(aimX - 11, aimY);
        ctx.lineTo(aimX - 4, aimY);
        ctx.moveTo(aimX + 4, aimY);
        ctx.lineTo(aimX + 11, aimY);
        ctx.moveTo(aimX, aimY - 11);
        ctx.lineTo(aimX, aimY - 4);
        ctx.moveTo(aimX, aimY + 4);
        ctx.lineTo(aimX, aimY + 11);
        ctx.stroke();
      }

      applyShake(now);
    };

    const tick = (now: number) => {
      if (stopped) {
        return;
      }
      if (document.hidden || !visible) {
        frame = 0;
        last = now;
        if (box.style.transform) {
          box.style.transform = "";
        }
        return;
      }
      frame = window.requestAnimationFrame(tick);

      const dt = Math.min(0.032, last === 0 ? 0.016 : (now - last) / 1000);
      dtHand = dt;
      last = now;

      if (!clay && !finished && nextLaunchAt > 0 && now >= nextLaunchAt) {
        if (handsReady) {
          launch();
        } else {
          nextLaunchAt = now + 30;
        }
      }

      if (clay) {
        stepClay(clay, dt, width, height);
      }

      for (const shot of shots) {
        if (shot.born > 0 || now < shot.arriveAt) {
          continue;
        }
        shot.born = now;
        const target = clay;
        if (!target) {
          continue;
        }
        if (shot.pellets.some((pellet) => pelletHitsClay(target, pellet))) {
          breakClay(now);
        }
      }

      if (clay && clayGone(clay, width, height)) {
        resolveClay(now);
      }

      for (let index = shards.length - 1; index >= 0; index -= 1) {
        const shard = shards[index];
        stepShard(shard, dt);
        if (shard.y > height + 80) {
          shards.splice(index, 1);
        }
      }

      for (let index = shots.length - 1; index >= 0; index -= 1) {
        const shot = shots[index];
        if (shot.born > 0 && now - shot.born > pelletFade) {
          shots.splice(index, 1);
        }
      }

      for (let index = floaters.length - 1; index >= 0; index -= 1) {
        if (now - floaters[index].born > floaterTime) {
          floaters.splice(index, 1);
        }
      }

      if (
        celebrationAt > 0 &&
        !celebrationFinished &&
        now - celebrationAt >= settings.perfectDuration
      ) {
        celebrationFinished = true;
        if (pendingResult) {
          setResult(pendingResult);
        }
        setOver(true);
      }

      draw(now);
    };

    const start = () => {
      if (frame || stopped) {
        return;
      }
      last = 0;
      frame = window.requestAnimationFrame(tick);
    };

    const stop = () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
        return;
      }
      start();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) {
          start();
        } else {
          stop();
        }
      },
      { threshold: 0.01 },
    );

    const resize = new ResizeObserver(() => {
      fit();
      draw(performance.now());
    });

    fit();
    draw(performance.now());
    observer.observe(box);
    resize.observe(box);
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("replay", onReplay);
    start();

    return () => {
      stopped = true;
      stop();
      box.style.transform = "";
      observer.disconnect();
      resize.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("replay", onReplay);
    };
  }, []);

  return (
    <div
      className={`${clayBoxClass} cursor-default select-none`}
      style={{ caretColor: "transparent", userSelect: "none" }}
      role="group"
      aria-label={liveLabel}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full select-none"
        style={{ touchAction: "pan-y" }}
        aria-hidden="true"
      />
      <div
        ref={handRef}
        className="pointer-events-none absolute bottom-0 left-1/2"
        style={{ visibility: "hidden" }}
        aria-hidden="true"
      >
        {handPoses.map((pose) => (
          <img
            key={pose}
            data-hand={pose}
            src={handSrc(pose)}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain object-bottom"
            style={{ opacity: pose === "straight" ? 1 : 0 }}
          />
        ))}
      </div>
      {score.launched > 0 ? (
        <p
          className="pointer-events-none absolute top-4 right-4 text-[13px] font-medium text-ink"
          aria-live="polite"
        >
          {score.hits} / {score.launched}
        </p>
      ) : null}
      {over && result ? (
        <div
          className="absolute top-1/2 left-1/2 flex w-[min(88%,28rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-2xl border border-line bg-card px-5 py-5 text-center"
          aria-live="polite"
        >
          <p className="text-sm font-medium text-muted">
            {result.score} / {Math.max(1, settings.claysPerRound)}
          </p>
          <p
            className={`mt-2 text-[20px] leading-snug font-semibold ${
              result.perfect ? "text-clay" : "text-ink"
            }`}
          >
            {result.message}
          </p>
          <button
            ref={replayRef}
            type="button"
            className="mt-4 rounded-full border border-line bg-card px-5 py-2.5 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            onClick={() => {
              setScore({ hits: 0, launched: 0 });
              setResult(null);
              setOver(false);
              const canvas = canvasRef.current;
              canvas?.dispatchEvent(new Event("replay"));
            }}
          >
            {replayLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
