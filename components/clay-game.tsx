"use client";

import { useEffect, useRef, useState } from "react";
import { clayBoxClass } from "@/components/clay-scene";
import { drawFingerGun } from "@/components/finger-gun";

// Feel settings. Change these numbers to tune the game.
export const settings = {
  gravity: 1000, // how fast broken pieces fall, and how quickly a rabbit drops back down
  pauseBetweenClays: 560, // wait after one clay before the next, in milliseconds
  claySize: 51, // base width of a clay, before distance makes it bigger or smaller
  hitAreaSize: 8, // extra pixels around a clay that still count when a pellet is close
  shardCount: 8, // pieces when a clay breaks
  shardSpeed: 340, // how fast those pieces fly apart
  recoilDistance: 18, // how far the hand kicks back
  recoilAngle: 16, // how far the hand tips up, in degrees
  recoilTime: 150, // how long the kick lasts, in milliseconds
  patternSize: 28, // how far pellets scatter around the aim point for a near clay
  pelletCount: 12, // dots in each shot
  shakeStrength: 2, // pixels the box shakes on a hit. 0 turns the shake off
  claysPerRound: 5, // clays in one round

  // How often each throw appears. A higher number means it comes up more often.
  throwCrosser: 3,
  throwAway: 2,
  throwIncomer: 2,
  throwHigh: 2,
  throwRabbit: 2,

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
};

const pelletFade = 400;
const shakeTime = 110;
const floaterTime = 480;
const minAirTime = 1.08;
const farPattern = 0.78;

type ThrowKind = "crosser" | "away" | "incomer" | "high" | "rabbit";

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

function lookOf(clay: Clay) {
  const t = distanceT(clay.distance);
  const width = settings.claySize * lerp(settings.sizeNear, settings.sizeFar, t);
  const disc = width / 2;
  const pale = t * 0.4;
  if (clay.kind === "rabbit") {
    return { rx: Math.max(disc * 0.38, 6), ry: disc, pale, disc };
  }
  return { rx: disc, ry: disc * (24 / 78), pale, disc };
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

function kickAmount(now: number, startedAt: number) {
  if (startedAt <= 0) {
    return 0;
  }
  const progress = (now - startedAt) / settings.recoilTime;
  if (progress <= 0 || progress >= 1) {
    return 0;
  }
  return Math.sin(Math.pow(progress, 0.45) * Math.PI);
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
  ctx.rotate(tilt);
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

function Shell({ full }: { full: boolean }) {
  return (
    <svg viewBox="0 0 18 40" className="h-8 w-4 text-ink" aria-hidden="true">
      <path
        d="M4 12 L9 4 L14 12"
        fill={full ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <rect
        x="3.5"
        y="11"
        width="11"
        height="18"
        rx="1.5"
        fill={full ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="2.5"
        y="27"
        width="13"
        height="7"
        rx="1.5"
        fill={full ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
      />
      {full ? <rect x="3.5" y="17" width="11" height="3.5" className="fill-clay" /> : null}
    </svg>
  );
}

export function ClayGame({
  hint,
  replayLabel,
  liveLabel,
  hitMark,
  onFail,
}: {
  hint: string;
  replayLabel: string;
  liveLabel: string;
  hitMark: string;
  onFail: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const replayRef = useRef<HTMLButtonElement>(null);
  const onFailRef = useRef(onFail);
  const hitMarkRef = useRef(hitMark);
  const [score, setScore] = useState({ hits: 0, launched: 0 });
  const [over, setOver] = useState(false);
  const [shells, setShells] = useState(0);

  useEffect(() => {
    onFailRef.current = onFail;
  }, [onFail]);

  useEffect(() => {
    hitMarkRef.current = hitMark;
  }, [hitMark]);

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
    let shellsLeft = 0;
    let nextLaunchAt = performance.now() + 280;
    let recoilAt = 0;
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
      if (finished) {
        setOver(true);
      }
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
    });

    const placePath = (target: Clay, amount: number) => {
      const u = Math.max(0, Math.min(1, amount));
      if (target.kind === "away") {
        const ease = 1 - (1 - u) * (1 - u);
        target.x = lerp(target.x0, target.x1, ease) + Math.sin(ease * Math.PI) * target.cx;
        target.y = lerp(target.y0, target.y1, ease);
        target.distance = lerp(target.distance0, target.distance1, ease);
        return;
      }
      const rest = 1 - u;
      target.x = rest * rest * target.x0 + 2 * rest * u * target.cx + u * u * target.x1;
      target.y = rest * rest * target.y0 + 2 * rest * u * target.cy + u * u * target.y1;
      target.distance = lerp(target.distance0, target.distance1, u);
    };

    const visibleShare = (target: Clay) => {
      const steps = 28;
      let hits = 0;
      for (let index = 0; index < steps; index += 1) {
        const ghost = { ...target };
        placePath(ghost, (index + 0.5) / steps);
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
      placePath(target, 0);
      const startX = target.x;
      const startY = target.y;
      placePath(target, 0.03);
      const slice = Math.max(0.03 * target.duration, 0.001);
      target.vx = (target.x - startX) / slice;
      target.vy = (target.y - startY) / slice;
      placePath(target, 0);
    };

    const paceTime = (distance: number, pace: number) => {
      const scaled = pace * lerp(1.12, 0.78, distanceT(distance));
      const widthsPerSecond = Math.min(0.95, Math.max(0.4, scaled));
      return 1 / widthsPerSecond;
    };

    const launchCrosser = (kind: "crosser" | "high") => {
      const distance =
        kind === "high" ? pickDistance(0.45, 1) : pickDistance(0, 1);
      const target = freshClay(kind, distance);
      const direction = Math.random() < 0.5 ? 1 : -1;
      const time = paceTime(distance, kind === "high" ? pickPace(0.62, 1) : pickPace(0, 1));
      const look = lookOf(target);
      const riseLimit = kind === "high" ? 0.1 : 0.2;
      const yMin = kind === "high" ? height * 0.1 : height * 0.32;
      const yMax = kind === "high" ? height * 0.28 : height * 0.66;
      target.y = rand(yMin, Math.max(yMin + 8, yMax));
      const rise = Math.min(height * rand(kind === "high" ? 0.03 : 0.07, riseLimit), target.y - 14);
      const duration = Math.max(time, minAirTime);
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
      target.y0 = height * rand(0.86, 0.96);
      target.x1 = width * rand(0.22, 0.78);
      target.y1 = -height * rand(0.06, 0.14);
      target.cx = (Math.random() - 0.5) * width * 0.18;
      target.duration = Math.max(
        paceTime((target.distance0 + target.distance1) / 2, pickPace(0.15, 0.9)),
        minAirTime,
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
      target.duration = Math.max(
        paceTime((target.distance0 + target.distance1) / 2, pickPace(0.25, 1)),
        minAirTime,
      );
      holdLongEnough(target);
      aimPath(target);
      return target;
    };

    const launchRabbit = () => {
      const distance = pickDistance(0, 0.5);
      const target = freshClay("rabbit", distance);
      const direction = Math.random() < 0.5 ? 1 : -1;
      const time = Math.max(paceTime(distance, pickPace(0.2, 0.62)), minAirTime);
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

    const launch = () => {
      if (width < 20 || height < 20) {
        nextLaunchAt = performance.now() + 50;
        return;
      }
      const kind = pickThrow();
      if (kind === "crosser" || kind === "high") {
        clay = launchCrosser(kind);
      } else if (kind === "away") {
        clay = launchAway();
      } else if (kind === "incomer") {
        clay = launchIncomer();
      } else {
        clay = launchRabbit();
      }
      launched += 1;
      nextLaunchAt = 0;
      shellsLeft = 2;
      setShells(2);
      publish();
    };

    const resolveClay = (now: number) => {
      clay = null;
      if (launched >= Math.max(1, settings.claysPerRound)) {
        finished = true;
        publish();
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
      if (shellsLeft <= 0) {
        return;
      }
      shellsLeft -= 1;
      setShells(shellsLeft);
      aimX = x;
      aimY = y;
      recoilAt = now;
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
      shellsLeft = 0;
      setShells(0);
      clay = null;
      shards.length = 0;
      shots.length = 0;
      floaters.length = 0;
      recoilAt = 0;
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

      const kick = kickAmount(now, recoilAt);
      const handX = width / 2;
      const handY = height + 20;
      const aim = Math.atan2(aimY - handY, aimX - handX);
      ctx.save();
      ctx.translate(handX, handY);
      ctx.rotate(aim - kick * ((settings.recoilAngle * Math.PI) / 180));
      ctx.translate(-kick * settings.recoilDistance, 0);
      drawFingerGun(ctx, colors.ink, kick);
      ctx.restore();

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
      last = now;

      if (!clay && !finished && nextLaunchAt > 0 && now >= nextLaunchAt) {
        launch();
      }

      if (clay) {
        if (clay.kind === "away" || clay.kind === "incomer") {
          const prevX = clay.x;
          const prevY = clay.y;
          clay.age += dt;
          placePath(clay, clay.age / Math.max(clay.duration, 0.001));
          clay.vx = (clay.x - prevX) / Math.max(dt, 0.001);
          clay.vy = (clay.y - prevY) / Math.max(dt, 0.001);
        } else {
          clay.age += dt;
          clay.vy += settings.gravity * clay.gravityScale * dt;
          clay.x += clay.vx * dt;
          clay.y += clay.vy * dt;
          if (clay.kind === "rabbit") {
            const look = lookOf(clay);
            const floor = height - look.ry;
            if (clay.y >= floor && clay.vy >= 0) {
              clay.y = floor;
              const hop = height * rand(0.05, 0.15);
              clay.vy = -Math.sqrt(2 * Math.max(settings.gravity, 1) * hop);
            }
            clay.roll += clay.vx * dt * 0.035;
          }
        }
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

      if (clay) {
        const look = lookOf(clay);
        const left = clay.vx < 0 && clay.x < -look.rx * 1.6;
        const right = clay.vx > 0 && clay.x > width + look.rx * 1.6;
        const dropped = clay.y > height + look.ry * 1.6;
        const climbed = clay.kind !== "rabbit" && clay.y < -look.ry * 2.4;
        const finishedPath =
          (clay.kind === "away" || clay.kind === "incomer") && clay.age >= clay.duration;
        if (finishedPath || left || right || dropped || climbed) {
          resolveClay(now);
        }
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
    <div className={clayBoxClass} role="group" aria-label={liveLabel}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ touchAction: "pan-y" }}
        aria-hidden="true"
      />
      <p className="pointer-events-none absolute bottom-4 left-4 max-w-[58%] text-[13px] leading-snug text-muted">
        {hint}
      </p>
      <div className="pointer-events-none absolute right-4 bottom-4 flex items-end gap-1.5">
        <Shell full={shells > 0} />
        <Shell full={shells > 1} />
      </div>
      {score.launched > 0 ? (
        <p
          className="pointer-events-none absolute top-4 right-4 text-[13px] font-medium text-ink"
          aria-live="polite"
        >
          {score.hits} / {score.launched}
        </p>
      ) : null}
      {over ? (
        <button
          ref={replayRef}
          type="button"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line bg-card px-5 py-2.5 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          onClick={() => {
            setScore({ hits: 0, launched: 0 });
            setOver(false);
            setShells(0);
            const canvas = canvasRef.current;
            canvas?.dispatchEvent(new Event("replay"));
          }}
        >
          {replayLabel}
        </button>
      ) : null}
    </div>
  );
}
