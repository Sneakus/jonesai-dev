"use client";

import { useEffect, useRef, useState } from "react";
import type { GolfRangeCopy } from "@/lib/golf-range";
import {
  clubheadVelocity,
  joints,
  restPose,
  stepSwing,
  swingSettings,
  type SwingPose,
} from "@/lib/golf-physics";

const paper = "#f3efe6";
const ink = "#161514";
const clay = "#e8480c";

type Shot = {
  key: string;
  yards: number;
  lateral: number;
  shape: "carry" | "low" | "runner" | "ground" | "none";
  speed: number;
  strike: "low" | "good" | "high";
  path: "left" | "square" | "right";
  face: "open" | "square" | "shut";
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function pickMessage(options: string[], previous: string) {
  const choices = options.length > 1 ? options.filter((line) => line !== previous) : options;
  return choices[Math.floor(Math.random() * choices.length)] || "";
}

function project(yards: number, lateral: number, width: number, height: number) {
  const teeY = height * 0.84;
  const horizonY = height * 0.28;
  const depth = Math.pow(clamp(yards / swingSettings.horizonYards, 0, 1), 0.82);
  const y = teeY - (teeY - horizonY) * depth;
  const half = width * 0.46 - (width * 0.46 - width * 0.05) * depth;
  const x = width / 2 + (lateral / swingSettings.halfWidthYards) * half;
  return { x, y, depth };
}

function judge(pose: SwingPose, shoulder: { x: number; y: number }, ball: { x: number; y: number }, addressX: number): Shot {
  const { hands, head } = joints(pose, shoulder);
  const velocity = clubheadVelocity(pose);
  const dx = head.x - ball.x;
  const dy = head.y - ball.y;
  const reach = hands.x - shoulder.x;
  const path = clamp(
    (Math.atan2(velocity.vx, Math.max(velocity.vy, 1)) * 180) / Math.PI * swingSettings.pathGain,
    -swingSettings.pathMax,
    swingSettings.pathMax,
  );
  const face = clamp((pose.club - pose.arm) * (180 / Math.PI) * swingSettings.faceGain, -swingSettings.faceMax, swingSettings.faceMax);
  let start = face * 0.75 + path * 0.25;
  let curve = face - path;
  const power = velocity.speed / 1000 / swingSettings.sweetSpeed;
  let yards = swingSettings.minYards + clamp(power, 0, 1.2) * swingSettings.yardSpan;
  let shape: Shot["shape"] = "carry";
  let key = "straight";
  const strike: Shot["strike"] = dy > swingSettings.fatBelow ? "low" : dy < -swingSettings.thinAbove ? "high" : "good";
  const missed = Math.hypot(dx, dy) > swingSettings.hitRadius;

  if (missed) {
    const pace = power < swingSettings.airSlow ? "slow" : power > swingSettings.airHard ? "hard" : "normal";
    key = `air-${pace}`;
    yards = 0;
    shape = "none";
  } else if (dy < -swingSettings.topAbove) {
    key = "topped";
    yards *= swingSettings.topKeep;
    shape = "ground";
  } else if (dy < -swingSettings.thinAbove) {
    key = "thin";
    yards *= swingSettings.thinKeep;
    shape = "runner";
  } else if (dy > swingSettings.fatBelow) {
    key = "fat";
    yards *= swingSettings.fatKeep;
    shape = "low";
  } else if (reach > addressX + swingSettings.heelOut) {
    key = "heel";
    curve += swingSettings.heelCurve;
    yards *= swingSettings.heelKeep;
  } else if (reach < addressX - swingSettings.toeIn) {
    key = "toe";
    curve -= swingSettings.toeCurve;
    yards *= swingSettings.toeKeep;
  } else if (start < -swingSettings.startFault && curve > swingSettings.curveFault) {
    key = "pull-slice";
  } else if (start > swingSettings.startFault && curve > swingSettings.curveFault) {
    key = "push-slice";
  } else if (curve > swingSettings.curveFault) {
    key = "slice";
  } else if (curve < -swingSettings.curveFault) {
    key = "hook";
  } else if (start < -swingSettings.startFault) {
    key = "pull";
  } else if (start > swingSettings.startFault) {
    key = "push";
  } else if (Math.abs(start) <= swingSettings.goodStart && curve <= -swingSettings.drawMin) {
    key = "draw";
  } else if (Math.abs(start) <= swingSettings.goodStart && curve >= swingSettings.drawMin) {
    key = "fade";
  }

  if (key === "heel" || key === "toe") {
    start = face * 0.75 + path * 0.25;
  }
  const lateral = yards * Math.tan((start * Math.PI) / 180) + yards * Math.tan((curve * Math.PI) / 180) * 0.45;
  return {
    key,
    yards,
    lateral,
    shape,
    speed: velocity.speed,
    strike,
    path: path < -swingSettings.pathSquare ? "left" : path > swingSettings.pathSquare ? "right" : "square",
    face: face > swingSettings.faceSquare ? "open" : face < -swingSettings.faceSquare ? "shut" : "square",
  };
}

export function GolfRange({ copy }: { copy: GolfRangeCopy }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const swingRef = useRef<HTMLCanvasElement>(null);
  const rangeRef = useRef<HTMLCanvasElement>(null);
  const copyRef = useRef(copy);
  const lastMessage = useRef("");
  const [panel, setPanel] = useState<{ name: string; lines: string[]; shot: Shot } | null>(null);

  useEffect(() => {
    copyRef.current = copy;
  }, [copy]);

  useEffect(() => {
    const swingCanvas = swingRef.current;
    const rangeCanvas = rangeRef.current;
    const box = boxRef.current;
    if (!swingCanvas || !rangeCanvas || !box) {
      return;
    }
    const swingCtx = swingCanvas.getContext("2d");
    const rangeCtx = rangeCanvas.getContext("2d");
    if (!swingCtx || !rangeCtx) {
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let visible = true;
    let last = 0;
    const pose = restPose();
    let holding = false;
    let armed = false;
    let pointer: { x: number; y: number } | null = null;
    let raised = false;
    let addressReach = 0;
    let impacted = false;
    let freezeUntil = 0;
    let shot: Shot | null = null;
    let flownAt = 0;
    let reteeAt = 0;
    let result = "";
    const trail: { x: number; y: number; life: number }[] = [];

    const fit = (canvas: HTMLCanvasElement) => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(2, Math.round(rect.width * ratio));
      canvas.height = Math.max(2, Math.round(rect.height * ratio));
      const context = canvas.getContext("2d");
      context?.setTransform(ratio, 0, 0, ratio, 0, 0);
      return { width: rect.width, height: rect.height };
    };

    const shoulderOf = (width: number, height: number) => ({
      x: width * 0.5 + Math.sin(pose.body) * 10,
      y: height * 0.34,
    });

    const paintSwing = (now: number) => {
      const { width, height } = fit(swingCanvas);
      const shoulder = shoulderOf(width, height);
      const ball = { x: width * 0.5, y: height * 0.78 };
      const { hands, elbow, head } = joints(pose, shoulder);
      const hip = { x: width * 0.5, y: height * 0.58 };
      swingCtx.clearRect(0, 0, width, height);
      swingCtx.fillStyle = paper;
      swingCtx.fillRect(0, 0, width, height);
      swingCtx.strokeStyle = ink;
      swingCtx.lineWidth = 1.6;
      swingCtx.lineCap = "round";
      swingCtx.beginPath();
      swingCtx.arc(shoulder.x, shoulder.y - 28, 11, 0, Math.PI * 2);
      swingCtx.moveTo(shoulder.x, shoulder.y);
      swingCtx.lineTo(hip.x, hip.y);
      swingCtx.moveTo(shoulder.x - 16, shoulder.y + 4);
      swingCtx.lineTo(shoulder.x + 16, shoulder.y + 4);
      swingCtx.moveTo(hip.x, hip.y);
      swingCtx.lineTo(hip.x - 16, height * 0.92);
      swingCtx.moveTo(hip.x, hip.y);
      swingCtx.lineTo(hip.x + 14, height * 0.92);
      swingCtx.moveTo(shoulder.x, shoulder.y);
      swingCtx.lineTo(elbow.x, elbow.y);
      swingCtx.lineTo(hands.x, hands.y);
      swingCtx.moveTo(hands.x, hands.y);
      swingCtx.lineTo(head.x, head.y);
      swingCtx.stroke();
      if (!reduced) {
        trail.forEach((bit) => {
          swingCtx.globalAlpha = bit.life;
          swingCtx.fillStyle = ink;
          swingCtx.beginPath();
          swingCtx.arc(bit.x, bit.y, 2, 0, Math.PI * 2);
          swingCtx.fill();
        });
        swingCtx.globalAlpha = 1;
      }
      swingCtx.fillStyle = ink;
      swingCtx.beginPath();
      swingCtx.arc(ball.x, ball.y, 5, 0, Math.PI * 2);
      swingCtx.fill();
      const speed = clubheadVelocity(pose).speed / 1000 / swingSettings.sweetSpeed;
      swingCtx.strokeRect(16, 16, 70, 8);
      swingCtx.fillStyle = clay;
      swingCtx.fillRect(16, 16, 70 * clamp(speed, 0, 1), 8);
      if (now < freezeUntil) {
        swingCtx.fillStyle = clay;
        swingCtx.globalAlpha = 0.85;
        swingCtx.beginPath();
        swingCtx.arc(ball.x, ball.y, 14, 0, Math.PI * 2);
        swingCtx.fill();
        swingCtx.globalAlpha = 1;
      }
    };

    const paintRange = (now: number) => {
      const { width, height } = fit(rangeCanvas);
      const horizon = height * 0.28;
      rangeCtx.clearRect(0, 0, width, height);
      rangeCtx.fillStyle = paper;
      rangeCtx.fillRect(0, 0, width, height);
      rangeCtx.strokeStyle = ink;
      rangeCtx.lineWidth = 1.25;
      rangeCtx.beginPath();
      rangeCtx.moveTo(width * 0.08, horizon);
      rangeCtx.lineTo(width * 0.92, horizon);
      rangeCtx.moveTo(width * 0.08, horizon);
      rangeCtx.lineTo(width * 0.18, height);
      rangeCtx.moveTo(width * 0.92, horizon);
      rangeCtx.lineTo(width * 0.82, height);
      rangeCtx.stroke();
      for (const yards of [50, 100, 150, 200, 250]) {
        const left = project(yards, -swingSettings.halfWidthYards, width, height);
        const right = project(yards, swingSettings.halfWidthYards, width, height);
        rangeCtx.strokeStyle = "rgba(22, 21, 20, 0.35)";
        rangeCtx.beginPath();
        rangeCtx.moveTo(left.x, left.y);
        rangeCtx.lineTo(right.x, right.y);
        rangeCtx.stroke();
        rangeCtx.strokeStyle = ink;
        rangeCtx.strokeRect(left.x - 14, left.y - 8, 28, 12);
        rangeCtx.font = "11px Instrument Sans, Arial, sans-serif";
        rangeCtx.textAlign = "center";
        rangeCtx.fillStyle = ink;
        rangeCtx.fillText(String(yards), left.x, left.y + 2);
        if (yards === 200) {
          const flag = project(200, 8, width, height);
          rangeCtx.beginPath();
          rangeCtx.moveTo(flag.x, flag.y);
          rangeCtx.lineTo(flag.x, flag.y - 26 * (1 - flag.depth));
          rangeCtx.moveTo(flag.x, flag.y - 26 * (1 - flag.depth));
          rangeCtx.lineTo(flag.x + 10, flag.y - 20 * (1 - flag.depth));
          rangeCtx.lineTo(flag.x, flag.y - 14 * (1 - flag.depth));
          rangeCtx.stroke();
        }
      }
      const progress = !shot || shot.shape === "none" ? 0 : reduced ? 1 : clamp((now - flownAt) / swingSettings.flightMs, 0, 1);
      if (shot && shot.shape !== "none" && progress > 0) {
        const steps = 24;
        const drawn = Math.max(1, Math.floor(progress * steps));
        for (let index = 1; index <= drawn; index += 1) {
          const before = (index - 1) / steps;
          const along = index / steps;
          const pointAt = (t: number) => {
            const flying = Math.min(t / 0.82, 1);
            const rolling = t > 0.82 ? (t - 0.82) / 0.18 : 0;
            const yards = shot!.yards * (0.9 * flying + 0.1 * rolling);
            const place = project(yards, shot!.lateral * flying * flying, width, height);
            const hop = rolling > 0 ? Math.sin(rolling * Math.PI * 2) * (1 - rolling) * 8 : 0;
            const lift =
              shot!.shape === "ground"
                ? hop
                : Math.sin(flying * Math.PI) * (shot!.shape === "carry" ? 64 : shot!.shape === "low" ? 26 : 12) * (1 - place.depth) + hop;
            return { x: place.x, y: place.y - lift, ground: place.y };
          };
          const from = pointAt(before);
          const to = pointAt(along);
          rangeCtx.strokeStyle = "rgba(22, 21, 20, 0.18)";
          rangeCtx.lineWidth = 1.4;
          rangeCtx.beginPath();
          rangeCtx.moveTo(from.x, from.ground);
          rangeCtx.lineTo(to.x, to.ground);
          rangeCtx.stroke();
          rangeCtx.strokeStyle = clay;
          rangeCtx.lineWidth = 2.4 * (1 - along) + 0.5;
          rangeCtx.beginPath();
          rangeCtx.moveTo(from.x, from.y);
          rangeCtx.lineTo(to.x, to.y);
          rangeCtx.stroke();
        }
        if (progress >= 1 && result) {
          rangeCtx.fillStyle = ink;
          rangeCtx.font = "14px Instrument Sans, Arial, sans-serif";
          rangeCtx.textAlign = "center";
          rangeCtx.fillText(result, width / 2, horizon - 12);
        }
      }
      if (!shot || shot.shape === "none") {
        const tee = project(0, 0, width, height);
        rangeCtx.fillStyle = ink;
        rangeCtx.beginPath();
        rangeCtx.arc(tee.x, tee.y, 4, 0, Math.PI * 2);
        rangeCtx.fill();
      }
    };

    const finish = (next: Shot) => {
      const book = copyRef.current;
      const good = book.good.find((item) => item.key === next.key);
      const fault = book.faults.find((item) => item.key === next.key);
      let name = next.key;
      const lines: string[] = [];
      if (next.key.startsWith("air-")) {
        const pace = next.key.slice(4) as "hard" | "normal" | "slow";
        name = book.air.name;
        const message = pickMessage(book.air[pace], lastMessage.current);
        lines.push(book.air.cause, message);
        lastMessage.current = message;
      } else if (good) {
        name = good.name;
        lines.push(good.cause);
        const message = pickMessage(good.messages, lastMessage.current);
        lines.push(message);
        lastMessage.current = message;
      } else if (fault) {
        name = fault.name;
        lines.push(fault.cause, fault.tip);
      }
      const side = next.lateral < -0.5 ? "left" : "right";
      result = next.shape === "none" ? "" : `${Math.round(next.yards)} yds, ${Math.abs(Math.round(next.lateral))} ${side}`;
      shot = next;
      flownAt = performance.now();
      setPanel({ name, lines: lines.filter(Boolean), shot: next });
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
      const dt = last ? Math.min(0.032, (now - last) / 1000) : 0.016;
      last = now;
      const swingSize = swingCanvas.getBoundingClientRect();
      const shoulder = shoulderOf(swingSize.width, swingSize.height);
      const ball = { x: swingSize.width * 0.5, y: swingSize.height * 0.78 };
      if (now >= freezeUntil && !impacted) {
        stepSwing(pose, shoulder, holding ? pointer : null, dt);
        const { head } = joints(pose, shoulder);
        if (!reduced) {
          trail.push({ x: head.x, y: head.y, life: 0.7 });
          trail.forEach((bit) => {
            bit.life -= dt * 1.8;
          });
          while (trail.length && trail[0].life <= 0) {
            trail.shift();
          }
        }
        if (head.y < ball.y - swingSettings.raised) {
          raised = true;
        }
        const velocity = clubheadVelocity(pose);
        if (armed && raised && velocity.vy > 0 && !impacted) {
          const distance = Math.hypot(head.x - ball.x, head.y - ball.y);
          const passing = distance < swingSettings.hitRadius || (head.y > ball.y - 8 && Math.abs(head.x - ball.x) < swingSettings.hitRadius);
          if (passing) {
            impacted = true;
            freezeUntil = now + (reduced ? 0 : swingSettings.freezeMs);
            const next = judge(pose, shoulder, ball, addressReach);
            finish(next);
            reteeAt = freezeUntil + swingSettings.flightMs + swingSettings.reteeMs;
            if (reduced) {
              reteeAt = now + swingSettings.reteeMs;
            }
          }
        }
      }
      if (impacted && now > reteeAt) {
        Object.assign(pose, restPose());
        holding = false;
        pointer = null;
        raised = false;
        armed = false;
        impacted = false;
        shot = null;
        result = "";
        trail.length = 0;
        setPanel(null);
      }
      paintSwing(now);
      paintRange(now);
      frame = requestAnimationFrame(tick);
    };

    const local = (event: PointerEvent) => {
      const rect = swingCanvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onDown = (event: PointerEvent) => {
      if (impacted) {
        return;
      }
      holding = true;
      armed = true;
      pointer = local(event);
      const size = swingCanvas.getBoundingClientRect();
      const shoulder = shoulderOf(size.width, size.height);
      addressReach = joints(pose, shoulder).hands.x - shoulder.x;
      swingCanvas.setPointerCapture(event.pointerId);
      kick();
    };
    const onMove = (event: PointerEvent) => {
      if (!holding) {
        return;
      }
      pointer = local(event);
    };
    const onUp = () => {
      holding = false;
      pointer = null;
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        last = 0;
        kick();
      } else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    observer.observe(box);
    swingCanvas.addEventListener("pointerdown", onDown);
    swingCanvas.addEventListener("pointermove", onMove);
    swingCanvas.addEventListener("pointerup", onUp);
    swingCanvas.addEventListener("pointercancel", onUp);
    kick();

    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
      observer.disconnect();
      swingCanvas.removeEventListener("pointerdown", onDown);
      swingCanvas.removeEventListener("pointermove", onMove);
      swingCanvas.removeEventListener("pointerup", onUp);
      swingCanvas.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div
      ref={boxRef}
      className="mt-8 w-full rounded-2xl bg-field p-3"
      role="group"
      aria-label="Golf driving range game. Optional, just for fun."
    >
      <div className="grid grid-cols-1 gap-2 min-[900px]:grid-cols-2">
        <div className="relative aspect-[4/5] w-full">
          <canvas ref={swingRef} className="block h-full w-full rounded-xl" style={{ touchAction: "none" }} />
        </div>
        <div className="relative aspect-[4/5] w-full min-[900px]:aspect-[4/5]">
          <canvas ref={rangeRef} className="pointer-events-none block h-full w-full rounded-xl" />
        </div>
      </div>
      {panel ? (
        <div className="mt-2 rounded-lg border border-line bg-card px-3 py-2 text-sm leading-snug text-ink">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-muted min-[900px]:grid-cols-4">
            <p>Club speed {Math.round((panel.shot.speed / 1000 / swingSettings.sweetSpeed) * 100)}</p>
            <p>Strike {panel.shot.strike}</p>
            <p>Path {panel.shot.path}</p>
            <p>Face {panel.shot.face}</p>
          </div>
          <p className="mt-2 font-semibold">{panel.name}</p>
          {panel.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
