"use client";

import { useEffect, useRef, useState } from "react";
import { clayBoxClass } from "@/components/clay-scene";
import { drawFingerGun } from "@/components/finger-gun";

// Feel settings. Change these numbers to tune the game.
export const settings = {
  gravity: 1000, // how fast clays and pieces fall
  launchSpeed: 850, // how hard each clay is thrown
  pauseBetweenClays: 560, // wait after one clay before the next, in milliseconds
  claySize: 60, // width of a clay
  hitAreaSize: 8, // extra pixels around a clay that still count when a pellet is close
  shardCount: 8, // pieces when a clay breaks
  shardSpeed: 340, // how fast those pieces fly apart
  recoilDistance: 18, // how far the hand kicks back
  recoilAngle: 16, // how far the hand tips up, in degrees
  recoilTime: 150, // how long the kick lasts, in milliseconds
  shotTravelTime: 100, // how long a shot takes to reach the aim point, in milliseconds
  patternSize: 28, // how far pellets scatter around the aim point
  pelletCount: 12, // dots in each shot
  shakeStrength: 2, // pixels the box shakes on a hit. 0 turns the shake off
};

const pelletFade = 400;
const shakeTime = 110;
const floaterTime = 480;
const launchAngle = 1.12;

type Clay = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
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

function clayRadii() {
  const rx = settings.claySize / 2;
  return { rx, ry: rx * (24 / 78) };
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
      size: 4 + Math.random() * 5,
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

function scatterPellets(x: number, y: number): Pellet[] {
  const pellets: Pellet[] = [];
  const count = Math.max(1, Math.round(settings.pelletCount));

  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * settings.patternSize;
    pellets.push({
      x: x + Math.cos(angle) * distance,
      y: y + Math.sin(angle) * distance,
    });
  }

  return pellets;
}

function pelletHitsClay(clay: Clay, pellet: Pellet) {
  const { rx, ry } = clayRadii();
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
  const { rx, ry } = clayRadii();
  const tilt = Math.max(-0.45, Math.min(0.45, Math.atan2(clay.vy, clay.vx) * 0.28));

  ctx.save();
  ctx.translate(clay.x, clay.y);
  ctx.rotate(tilt);
  ctx.fillStyle = colors.clay;
  ctx.beginPath();
  ctx.ellipse(0, ry * 0.16, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  const scale = rx / 78;
  ctx.strokeStyle = colors.clayDark;
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
    let fromLeft = true;
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

    const launch = () => {
      const angle = launchAngle + (Math.random() - 0.5) * 0.36;
      const speed = settings.launchSpeed * (0.88 + Math.random() * 0.24);
      const direction = fromLeft ? 1 : -1;
      clay = {
        x: fromLeft ? -settings.claySize * 0.2 : width + settings.claySize * 0.2,
        y: height * 0.82,
        vx: Math.cos(angle) * speed * direction,
        vy: -Math.sin(angle) * speed,
        alive: true,
      };
      fromLeft = !fromLeft;
      launched += 1;
      nextLaunchAt = 0;
      shellsLeft = 2;
      setShells(2);
      publish();
    };

    const resolveClay = (now: number) => {
      clay = null;
      if (launched >= 5) {
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
      shots.push({
        pellets: scatterPellets(x, y),
        arriveAt: now + settings.shotTravelTime,
        born: 0,
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
      fromLeft = true;
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
          ctx.arc(pellet.x, pellet.y, 2.25, 0, Math.PI * 2);
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
        clay.vy += settings.gravity * dt;
        clay.x += clay.vx * dt;
        clay.y += clay.vy * dt;
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
        const { rx, ry } = clayRadii();
        const gone =
          clay.y > height + ry ||
          clay.x < -rx * 2 ||
          clay.x > width + rx * 2;
        if (gone) {
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
