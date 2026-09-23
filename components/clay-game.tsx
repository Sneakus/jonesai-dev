"use client";

import { useEffect, useRef, useState } from "react";
import { clayBoxClass } from "@/components/clay-scene";
import { drawFingerGun } from "@/components/finger-gun";

// Feel settings. Change these numbers to tune the game.
export const settings = {
  gravity: 1000, // how fast clays and pieces fall
  launchSpeed: 680, // how hard each clay is thrown
  pauseBetweenClays: 560, // wait after one clay before the next, in milliseconds
  claySize: 86, // width of a clay
  hitAreaSize: 32, // extra pixels around a clay that still count as a hit
  shardCount: 8, // pieces when a clay breaks
  shardSpeed: 340, // how fast those pieces fly apart
  recoilDistance: 18, // how far the hand kicks back
  recoilAngle: 16, // how far the hand tips up, in degrees
  recoilTime: 150, // how long the kick lasts, in milliseconds
};

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

type MissRing = {
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

const launchAngle = 1.12;

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

function hitsClay(clay: Clay, x: number, y: number) {
  const { rx, ry } = clayRadii();
  const hitX = rx + settings.hitAreaSize;
  const hitY = ry + settings.hitAreaSize;
  const dx = (x - clay.x) / hitX;
  const dy = (y - clay.y) / hitY;
  return dx * dx + dy * dy <= 1;
}

export function ClayGame({
  hint,
  replayLabel,
  liveLabel,
  onFail,
}: {
  hint: string;
  replayLabel: string;
  liveLabel: string;
  onFail: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const replayRef = useRef<HTMLButtonElement>(null);
  const onFailRef = useRef(onFail);
  const [score, setScore] = useState({ hits: 0, launched: 0 });
  const [over, setOver] = useState(false);

  useEffect(() => {
    onFailRef.current = onFail;
  }, [onFail]);

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
    let nextLaunchAt = performance.now() + 280;
    let recoilAt = 0;
    let clay: Clay | null = null;
    let aimX = 0;
    let aimY = 0;
    let pointerDown: { x: number; y: number } | null = null;
    let finePointer = window.matchMedia("(pointer: fine)").matches;
    let pointerInside = false;
    const shards: Shard[] = [];
    const misses: MissRing[] = [];

    const publish = () => {
      setScore({ hits, launched });
      if (finished) {
        setOver(true);
      }
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
      const speed = settings.launchSpeed;
      const direction = fromLeft ? 1 : -1;
      clay = {
        x: fromLeft ? -settings.claySize * 0.2 : width + settings.claySize * 0.2,
        y: height * 0.82,
        vx: Math.cos(launchAngle) * speed * direction,
        vy: -Math.sin(launchAngle) * speed,
        alive: true,
      };
      fromLeft = !fromLeft;
      launched += 1;
      nextLaunchAt = 0;
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

    const shoot = (x: number, y: number, now: number) => {
      aimX = x;
      aimY = y;
      recoilAt = now;
      if (clay && hitsClay(clay, x, y)) {
        shards.push(...createShards(clay));
        hits += 1;
        resolveClay(now);
        publish();
        return;
      }
      misses.push({ x, y, born: now });
    };

    const localPoint = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
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
      clay = null;
      shards.length = 0;
      misses.length = 0;
      recoilAt = 0;
      nextLaunchAt = performance.now() + 280;
      publish();
      start();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!pointerDown) {
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

    const draw = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = colors.field;
      ctx.fillRect(0, 0, width, height);

      for (const miss of misses) {
        const age = (now - miss.born) / 280;
        if (age >= 1) {
          continue;
        }
        ctx.save();
        ctx.globalAlpha = 0.35 * (1 - age);
        ctx.strokeStyle = colors.ink;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.arc(miss.x, miss.y, 7 + age * 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      for (const shard of shards) {
        drawShard(ctx, shard, colors.clay);
      }

      if (clay) {
        drawClay(ctx, clay, colors);
      }

      const kick = kickAmount(now, recoilAt);
      const handX = width / 2;
      const handY = height + 8;
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
    };

    const tick = (now: number) => {
      if (stopped) {
        return;
      }
      if (document.hidden || !visible) {
        frame = 0;
        last = now;
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

      for (let index = misses.length - 1; index >= 0; index -= 1) {
        if (now - misses[index].born > 280) {
          misses.splice(index, 1);
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
      {score.launched > 0 ? (
        <p
          className="pointer-events-none absolute right-4 bottom-4 text-[13px] font-medium text-ink"
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
