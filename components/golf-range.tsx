"use client";

import { useEffect, useRef, useState } from "react";
import type { GolfRangeCopy } from "@/lib/golf-range";

const paper = "#f3efe6";
const ink = "#161514";
const clay = "#e8480c";

const settings = {
  fullPowerFraction: 0.35,
  smoothSpeed: 0.55,
  minYards: 150,
  fullYards: 235,
  directionDeadzone: 18,
  pathGain: 0.35,
  pathMax: 12,
  curlDeadzone: 12,
  curlGain: 0.45,
  curlMax: 16,
  centreFraction: 0.07,
  missFraction: 0.16,
  tempoSlow: 0.45,
  tempoRush: 1.75,
  tempoSnatch: 2.5,
  startFault: 7,
  curveFault: 9,
  goodStart: 7,
  drawMin: 3,
  heelCurve: 4,
  toeCurve: 4,
  heelKeep: 0.86,
  toeKeep: 0.86,
  fatKeep: 0.55,
  thinKeep: 0.72,
  topKeep: 0.12,
  horizonYards: 280,
  halfWidthYards: 46,
  flightMs: 1100,
  bounceMs: 420,
  reteeMs: 1500,
  airSlow: 0.35,
  airHard: 0.75,
};

type Sample = { x: number; y: number; t: number };
type Shape = "carry" | "low" | "runner" | "ground" | "none";
type Shot = {
  key: string;
  yards: number;
  lateral: number;
  shape: Shape;
  start: number;
  curve: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function angleOf(dx: number, dy: number) {
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

function heading(points: Sample[]) {
  if (points.length < 2) {
    return 0;
  }
  const first = points[0];
  const last = points[points.length - 1];
  return angleOf(last.x - first.x, last.y - first.y);
}

function pathLength(points: Sample[]) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return total;
}

function crossX(points: Sample[], ballY: number) {
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if ((previous.y - ballY) * (current.y - ballY) > 0) {
      continue;
    }
    const span = previous.y - current.y;
    const mix = span === 0 ? 0 : (previous.y - ballY) / span;
    return previous.x + (current.x - previous.x) * mix;
  }
  return null;
}

function pickMessage(options: string[], previous: string) {
  const choices = options.length > 1 ? options.filter((line) => line !== previous) : options;
  return choices[Math.floor(Math.random() * choices.length)] || "";
}

function readSwing(samples: Sample[], ballX: number, ballY: number, width: number, height: number): Shot {
  const bottom = samples.reduce((best, point) => (point.y > best.y ? point : best), samples[0]);
  const split = samples.findIndex((point) => point === bottom);
  const back = samples.slice(0, Math.max(split, 1) + 1);
  const forward = samples.slice(Math.max(split, 1));
  const backDistance = Math.max(0, bottom.y - samples[0].y);
  const backTime = Math.max(16, back[back.length - 1].t - back[0].t);
  const forwardTime = Math.max(16, forward[forward.length - 1].t - forward[0].t);
  const backSpeed = backDistance / backTime;
  const forwardSpeed = pathLength(forward) / forwardTime;
  const depth = clamp(backDistance / (settings.fullPowerFraction * height), 0, 1);
  const speedNorm = clamp(((backSpeed + forwardSpeed) / 2) / settings.smoothSpeed, 0, 1);
  const power = clamp(depth * 0.62 + speedNorm * 0.38, 0, 1);
  let yards = settings.minYards + power * (settings.fullYards - settings.minYards);
  const ratio = forwardSpeed / Math.max(backSpeed, 0.05);
  const pass = crossX(forward, ballY);
  const crossed = pass !== null && forward[forward.length - 1].y < ballY;
  const centre = width * settings.centreFraction;
  const miss = width * settings.missFraction;
  const offset = pass === null ? miss + 1 : pass - ballX;
  const strike = !crossed || Math.abs(offset) > miss ? "miss" : Math.abs(offset) < centre ? "centre" : offset < 0 ? "heel" : "toe";
  const near = forward.filter((point) => point.y < ballY + height * 0.08 && point.y > ballY - height * 0.16);
  const bend = near.length > 3 ? heading(near.slice(Math.floor(near.length / 2))) - heading(near.slice(0, Math.ceil(near.length / 2))) : 0;
  const through = near.length > 1 ? heading(near) : 0;
  const path = Math.abs(through) < settings.directionDeadzone ? 0 : clamp(through * settings.pathGain, -settings.pathMax, settings.pathMax);
  const curl = Math.abs(bend) < settings.curlDeadzone ? 0 : clamp(bend * settings.curlGain, -settings.curlMax, settings.curlMax);
  const face = path + curl;
  const start = face * 0.75 + path * 0.25;
  let curve = face - path;
  let shape: Shape = "carry";
  let key = "straight";

  if (strike === "miss") {
    const pace = power < settings.airSlow ? "slow" : power > settings.airHard ? "hard" : "normal";
    return { key: `air-${pace}`, yards: 0, lateral: 0, shape: "none", start: 0, curve: 0 };
  }
  if (ratio >= settings.tempoSnatch) {
    key = "topped";
    yards *= settings.topKeep;
    shape = "ground";
  } else if (ratio >= settings.tempoRush) {
    key = "thin";
    yards *= settings.thinKeep;
    shape = "runner";
  } else if (ratio <= settings.tempoSlow && backDistance > height * 0.08) {
    key = "fat";
    yards *= settings.fatKeep;
    shape = "low";
  } else if (strike === "heel") {
    key = "heel";
    curve += settings.heelCurve;
    yards *= settings.heelKeep;
  } else if (strike === "toe") {
    key = "toe";
    curve -= settings.toeCurve;
    yards *= settings.toeKeep;
  } else if (start < -settings.startFault && curve > settings.curveFault) {
    key = "pull-slice";
  } else if (start > settings.startFault && curve > settings.curveFault) {
    key = "push-slice";
  } else if (curve > settings.curveFault) {
    key = "slice";
  } else if (curve < -settings.curveFault) {
    key = "hook";
  } else if (start < -settings.startFault) {
    key = "pull";
  } else if (start > settings.startFault) {
    key = "push";
  } else if (Math.abs(start) <= settings.goodStart && curve <= -settings.drawMin) {
    key = "draw";
  } else if (Math.abs(start) <= settings.goodStart && curve >= settings.drawMin) {
    key = "fade";
  } else {
    key = "straight";
  }

  const lateral =
    yards * Math.tan((start * Math.PI) / 180) + yards * Math.tan((curve * Math.PI) / 180) * 0.45;
  return { key, yards, lateral, shape, start, curve };
}

function project(yards: number, lateral: number, width: number, height: number) {
  const teeY = height * 0.84;
  const horizonY = height * 0.28;
  const depth = Math.pow(clamp(yards / settings.horizonYards, 0, 1), 0.82);
  const y = teeY - (teeY - horizonY) * depth;
  const half = width * 0.46 - (width * 0.46 - width * 0.05) * depth;
  const x = width / 2 + (lateral / settings.halfWidthYards) * half;
  return { x, y, depth };
}

export function GolfRange({ copy }: { copy: GolfRangeCopy }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const copyRef = useRef(copy);
  const lastMessage = useRef("");
  const [panel, setPanel] = useState<{ name: string; lines: string[] } | null>(null);

  useEffect(() => {
    copyRef.current = copy;
  }, [copy]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let visible = true;
    let width = 0;
    let height = 0;
    let power = 0;
    let dragging = false;
    const samples: Sample[] = [];
    let shot: Shot | null = null;
    let started = 0;
    let phase: "ready" | "fly" | "hold" = "ready";
    let retee = 0;
    let result = "";

    const resize = () => {
      const next = Math.round(wrap.clientWidth);
      const box = wrap.getBoundingClientRect();
      if (next < 2 || box.height < 2) {
        return false;
      }
      width = next;
      height = Math.round(box.height);
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      return true;
    };

    const ballPoint = () => ({ x: width / 2, y: height * 0.84 });

    const paint = (now: number) => {
      if (!resize()) {
        return;
      }
      const ball = ballPoint();
      context.clearRect(0, 0, width, height);
      context.fillStyle = paper;
      context.fillRect(0, 0, width, height);
      const horizon = height * 0.28;
      context.strokeStyle = ink;
      context.lineWidth = 1.25;
      context.beginPath();
      context.moveTo(width * 0.08, horizon);
      context.lineTo(width * 0.92, horizon);
      context.stroke();
      context.beginPath();
      context.moveTo(width * 0.08, horizon);
      context.lineTo(width * 0.18, height);
      context.moveTo(width * 0.92, horizon);
      context.lineTo(width * 0.82, height);
      context.stroke();
      for (const yards of [50, 100, 150, 200, 250]) {
        const left = project(yards, -settings.halfWidthYards, width, height);
        const right = project(yards, settings.halfWidthYards, width, height);
        context.strokeStyle = "rgba(22, 21, 20, 0.35)";
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(left.x, left.y);
        context.lineTo(right.x, right.y);
        context.stroke();
        context.strokeStyle = ink;
        context.strokeRect(left.x - 16, left.y - 9, 32, 14);
        context.fillStyle = ink;
        context.font = "11px Instrument Sans, Arial, sans-serif";
        context.textAlign = "center";
        context.fillText(String(yards), left.x, left.y + 3);
        if (yards === 200) {
          const flag = project(200, 8, width, height);
          context.beginPath();
          context.moveTo(flag.x, flag.y);
          context.lineTo(flag.x, flag.y - 28 * (1 - flag.depth));
          context.stroke();
          context.beginPath();
          context.moveTo(flag.x, flag.y - 28 * (1 - flag.depth));
          context.lineTo(flag.x + 12, flag.y - 22 * (1 - flag.depth));
          context.lineTo(flag.x, flag.y - 16 * (1 - flag.depth));
          context.stroke();
        }
      }

      if (power > 0 && phase === "ready") {
        context.strokeStyle = "rgba(22, 21, 20, 0.28)";
        context.lineWidth = 3;
        context.beginPath();
        context.arc(ball.x, ball.y, 36 + power * 28, Math.PI * 0.15, Math.PI * (0.15 + 0.7 * power), false);
        context.stroke();
      }

      let progress = 0;
      if (shot && phase !== "ready") {
        const elapsed = now - started;
        progress = reduced ? 1 : clamp(elapsed / (settings.flightMs + settings.bounceMs), 0, 1);
      }
      if (shot && shot.shape !== "none" && progress > 0) {
        const points: { x: number; y: number; ground: number }[] = [];
        const steps = 28;
        for (let step = 0; step <= steps; step += 1) {
          const along = step / steps;
          const flying = Math.min(along / 0.82, 1);
          const rolling = along > 0.82 ? (along - 0.82) / 0.18 : 0;
          const yards = shot.yards * (0.9 * flying + 0.1 * rolling);
          const lateral = shot.lateral * flying * flying;
          const place = project(yards, lateral, width, height);
          const hop = rolling > 0 ? Math.sin(rolling * Math.PI * 2) * (1 - rolling) * 8 : 0;
          const lift =
            shot.shape === "ground"
              ? hop
              : Math.sin(flying * Math.PI) *
                  (shot.shape === "carry" ? 70 : shot.shape === "low" ? 28 : 12) *
                  (1 - place.depth) +
                hop;
          points.push({ x: place.x, y: place.y - lift, ground: place.y });
        }
        const drawn = Math.max(1, Math.floor(progress * steps));
        context.strokeStyle = "rgba(22, 21, 20, 0.18)";
        context.lineCap = "round";
        for (let index = 1; index <= drawn; index += 1) {
          context.lineWidth = 2.2 * (1 - index / steps) + 0.6;
          context.beginPath();
          context.moveTo(points[index - 1].x, points[index - 1].ground);
          context.lineTo(points[index].x, points[index].ground);
          context.stroke();
          context.strokeStyle = clay;
          context.beginPath();
          context.moveTo(points[index - 1].x, points[index - 1].y);
          context.lineTo(points[index].x, points[index].y);
          context.stroke();
          context.strokeStyle = "rgba(22, 21, 20, 0.18)";
        }
        const tip = points[drawn];
        context.fillStyle = clay;
        context.beginPath();
        context.arc(tip.x, tip.y, 3.2 * (1 - (shot.yards / settings.horizonYards) * progress), 0, Math.PI * 2);
        context.fill();
        if (progress >= 1) {
          context.fillStyle = ink;
          context.font = "14px Instrument Sans, Arial, sans-serif";
          context.textAlign = "center";
          context.fillText(result, width / 2, horizon - 16);
        }
      }

      if (!shot || shot.shape === "none" || progress < 0.15) {
        context.fillStyle = ink;
        context.beginPath();
        context.arc(ball.x, ball.y, 5, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = ink;
        context.beginPath();
        context.moveTo(ball.x, ball.y + 5);
        context.lineTo(ball.x, ball.y + 16);
        context.stroke();
      }
    };

    const showOutcome = (next: Shot) => {
      const book = copyRef.current;
      const good = book.good.find((item) => item.key === next.key);
      const fault = book.faults.find((item) => item.key === next.key);
      let name = next.key;
      let lines: string[] = [];
      if (next.key.startsWith("air-")) {
        const pace = next.key.slice(4) as "hard" | "normal" | "slow";
        name = book.air.name;
        lines = [pickMessage(book.air[pace], lastMessage.current)];
      } else if (good) {
        name = good.name;
        lines = [pickMessage(good.messages, lastMessage.current)];
      } else if (fault) {
        name = fault.name;
        lines = [fault.swipe, fault.tip];
      }
      lastMessage.current = lines[0] || "";
      const side = next.lateral < -0.5 ? "left" : next.lateral > 0.5 ? "right" : "left";
      const offline = Math.abs(Math.round(next.lateral));
      result = next.shape === "none" ? "" : `${Math.round(next.yards)} yds, ${offline} ${side}`;
      setPanel({ name, lines });
      shot = next;
      started = performance.now();
      phase = "fly";
      retee = 0;
    };

    const kick = () => {
      if (!frame && visible) {
        frame = requestAnimationFrame(tick);
      }
    };

    const tick = (now: number) => {
      frame = 0;
      if (!visible) {
        return;
      }
      paint(now);
      if (phase === "fly" && (reduced || now - started > settings.flightMs + settings.bounceMs)) {
        phase = "hold";
        retee = now + settings.reteeMs;
      }
      if (phase === "hold" && now > retee) {
        phase = "ready";
        shot = null;
        power = 0;
        result = "";
        setPanel(null);
      }
      if (phase !== "ready" || dragging || power > 0) {
        frame = requestAnimationFrame(tick);
      }
    };

    const onDown = (event: PointerEvent) => {
      if (phase !== "ready") {
        return;
      }
      dragging = true;
      power = 0;
      samples.length = 0;
      samples.push({ x: event.offsetX, y: event.offsetY, t: event.timeStamp });
      canvas.setPointerCapture(event.pointerId);
      kick();
    };

    const onMove = (event: PointerEvent) => {
      if (!dragging) {
        return;
      }
      samples.push({ x: event.offsetX, y: event.offsetY, t: event.timeStamp });
      const first = samples[0];
      power = clamp((event.offsetY - first.y) / (settings.fullPowerFraction * height), 0, 1);
      kick();
    };

    const onUp = (event: PointerEvent) => {
      if (!dragging) {
        return;
      }
      dragging = false;
      samples.push({ x: event.offsetX, y: event.offsetY, t: event.timeStamp });
      const ball = ballPoint();
      if (samples.length > 3) {
        showOutcome(readSwing(samples, ball.x, ball.y, width, height));
      }
      power = 0;
      kick();
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        kick();
      } else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    const resizeObserver = new ResizeObserver(() => kick());
    observer.observe(wrap);
    resizeObserver.observe(wrap);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    kick();

    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
      observer.disconnect();
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div
      className="mt-8 w-full rounded-2xl bg-field p-3"
      role="group"
      aria-label="Golf driving range game. Optional, just for fun."
    >
      <div ref={wrapRef} className="relative aspect-[3/4] w-full min-[900px]:aspect-[16/10]">
        <canvas ref={canvasRef} className="block h-full w-full rounded-xl" style={{ touchAction: "none" }} />
        {panel ? (
          <div className="pointer-events-none absolute right-3 bottom-3 left-3 rounded-lg border border-line bg-card px-3 py-2 text-sm leading-snug text-ink min-[900px]:left-auto min-[900px]:max-w-[260px]">
            <p className="font-semibold">{panel.name}</p>
            {panel.lines.map((line) => (
              <p key={line} className="text-muted">
                {line}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
