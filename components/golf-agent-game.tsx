"use client";

import { useEffect, useRef, useState } from "react";
import { Golf3dRange, type PlayClock } from "@/components/golf3d-range";
import type { FlightResult } from "@/src/games/golf/flight";
import type { GolfRangeCopy } from "@/lib/golf-range";
import { clubSpeedMph, swingSpeedMul, type ShotReading } from "@/src/games/golf/shot-rules";
import { beginSwing, BULL, demoSwing, finishSwing, makeGesture, moveSwing, stepGesture, type Gesture } from "@/src/games/golf/swing-play";
import { golfTheme as theme } from "@/src/games/golf/theme";

function findCopy(copy: GolfRangeCopy, key: string) {
  return copy.good.find((shot) => shot.key === key) ?? copy.faults.find((shot) => shot.key === key) ?? null;
}

function drawBoard(ctx: CanvasRenderingContext2D, play: Gesture, width: number, height: number, label: string) {
  ctx.clearRect(0, 0, width, height);
  const radius = Math.max(30, Math.min(46, width * 0.05));
  const cx = width - radius - 16;
  const cy = radius + 16;
  ctx.fillStyle = "rgba(22,21,20,0.35)";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(243,239,230,0.55)";
  ctx.lineWidth = 1;
  for (const scale of [1, 0.66, 0.33]) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - radius, cy);
  ctx.lineTo(cx + radius, cy);
  ctx.moveTo(cx, cy - radius);
  ctx.lineTo(cx, cy + radius);
  ctx.stroke();
  ctx.fillStyle = theme.gold;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * BULL, 0, Math.PI * 2);
  ctx.fill();
  const marker = play.locked ?? play.marker;
  const locked = play.locked;
  ctx.fillStyle = locked ? (Math.hypot(locked.x, locked.y) < BULL ? theme.gold : theme.miss) : theme.bone;
  ctx.strokeStyle = theme.paper;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx + marker.x * radius, cy - marker.y * radius, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(243,239,230,0.85)";
  ctx.font = "600 11px Instrument Sans, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, cx, cy + radius + 14);
  ctx.textAlign = "start";
  if (play.phase === "back" || play.phase === "down") {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 1; i < play.trail.length; i += 1) {
      ctx.strokeStyle = `rgba(243,239,230,${0.15 + (0.6 * i) / play.trail.length})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(play.trail[i - 1].x, play.trail[i - 1].y);
      ctx.lineTo(play.trail[i].x, play.trail[i].y);
      ctx.stroke();
    }
    const start = play.start;
    if (start) {
      ctx.strokeStyle = "rgba(243,239,230,0.5)";
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(start.x - 40, start.y);
      ctx.lineTo(start.x + 40, start.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const meterH = height * 0.4;
    const meterX = width - 22;
    const meterY = height * 0.3;
    const yAt = (value: number) => meterY + meterH * (1 - value / 1.25);
    ctx.fillStyle = "rgba(22,21,20,0.35)";
    ctx.fillRect(meterX, meterY, 8, meterH);
    ctx.fillStyle = "rgba(214,48,39,0.35)";
    ctx.fillRect(meterX, meterY, 8, yAt(1.07) - meterY);
    ctx.fillStyle = "rgba(230,180,40,0.45)";
    ctx.fillRect(meterX, yAt(1.07), 8, yAt(0.93) - yAt(1.07));
    const filled = Math.min(1.25, play.backLength);
    ctx.fillStyle = play.backLength > 1.07 ? theme.miss : play.backLength >= 0.93 ? theme.gold : theme.paper;
    ctx.fillRect(meterX, yAt(filled), 8, meterY + meterH - yAt(filled));
    ctx.fillStyle = theme.gold;
    ctx.fillRect(meterX - 4, yAt(1.07), 16, 2);
    ctx.fillRect(meterX - 4, yAt(0.93) - 2, 16, 2);
  }
}

export function GolfAgentGame({
  copy,
  touch,
  armed,
  onDone,
}: {
  copy: GolfRangeCopy;
  touch: boolean;
  armed: boolean;
  onDone: () => void;
}) {
  const reduce = useRef(false);
  const clock = useRef<PlayClock>({
    time: 0,
    trail: false,
    token: 0,
    shot: null,
    reduce: typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  });
  const play = useRef<Gesture>(makeGesture());
  const box = useRef<HTMLDivElement | null>(null);
  const overlay = useRef<HTMLCanvasElement | null>(null);
  const [resets, setResets] = useState(0);
  const [hint, setHint] = useState(true);
  const liveText = useRef<HTMLParagraphElement>(null);
  const liveAt = useRef(0);
  const sawLand = useRef(false);
  const boardPhase = useRef("");
  const [longest, setLongest] = useState(0);
  const [perfect, setPerfect] = useState(false);
  const [panel, setPanel] = useState<ShotReading | null>(null);
  const [yards, setYards] = useState<FlightResult | null>(null);
  const [landed, setLanded] = useState(false);
  const flight = useRef<FlightResult | null>(null);
  const born = useRef(0);

  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    clock.current.reduce = reduce.current;
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const step = stepGesture(play.current, dt, reduce.current);
      clock.current.time = step.time;
      clock.current.trail = step.trail && !reduce.current;
      clock.current.shot = play.current.shot;
      clock.current.reduce = reduce.current;
      setPerfect((value) => (value === play.current.perfectOn ? value : play.current.perfectOn));
      const canvas = overlay.current;
      const stage = box.current;
      const phase = play.current.phase;
      const redraw = (phase !== "through" && phase !== "demo") || phase !== boardPhase.current;
      if (canvas && stage && redraw) {
        const rect = stage.getBoundingClientRect();
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const nextWidth = Math.round(rect.width * ratio);
        const nextHeight = Math.round(rect.height * ratio);
        if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
          canvas.width = nextWidth;
          canvas.height = nextHeight;
        }
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
          drawBoard(ctx, play.current, rect.width, rect.height, copy.words.balance);
        }
      }
      boardPhase.current = phase;
      if (step.launch && play.current.shot) {
        setPanel(play.current.shot);
        if (play.current.shot.strike === "air") {
          flight.current = null;
          setYards(null);
          setLanded(true);
        }
      }
      const current = flight.current;
      if (current && liveText.current && !reduce.current) {
        const age = (now - born.current) / 1000;
        const points = current.trajectory;
        while (liveAt.current < points.length - 1 && points[liveAt.current].t < age) liveAt.current += 1;
        const done = age >= points[points.length - 1].t;
        liveText.current.textContent = done ? "" : `${Math.round(points[liveAt.current].x)} ${theme.copy.yards}`;
        if (done && !sawLand.current) {
          sawLand.current = true;
          setLanded(true);
          setLongest((value) => Math.max(value, Math.round(current.total)));
        }
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [copy.words.balance]);

  function local(event: React.PointerEvent) {
    const stage = box.current;
    if (!stage) return null;
    const rect = stage.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top, t: performance.now() / 1000, w: rect.width, h: rect.height };
  }

  const words = copy.words;
  const onPicture = { color: "#F3EFE6", textShadow: "0 1px 2px rgba(22,21,20,0.6)" };
  const info = panel ? findCopy(copy, panel.key) : null;
  const shaped = Boolean(panel && !panel.perfect && (panel.key === "straight" || panel.key === "draw" || panel.key === "fade"));
  const reasonLabel = shaped ? words.whyNot : words.letDown;
  const airLines = panel?.key === "air-shot" ? copy.air[panel.speedTier] : [];
  const goodLines = info && "messages" in info ? info.messages : [];
  const tip = info && "tip" in info ? info.tip : "";

  return (
    <div aria-label="Golf driving range game. Optional, just for fun.">
      <div
        className="relative mt-4 aspect-square w-[min(1040px,calc(100vw-2.5rem))] min-[600px]:aspect-[16/10] min-[900px]:w-[min(1040px,calc(100vw-4rem))]"
        style={{ touchAction: touch && armed ? "none" : "auto" }}
        onPointerDown={(event) => {
          if (touch && !armed) return;
          if (play.current.phase === "down" || (play.current.phase === "through" && play.current.tSwing < 1.38)) return;
          const point = local(event);
          if (!point) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          setHint(false);
          setPanel(null);
          setYards(null);
          setLanded(false);
          if (liveText.current) liveText.current.textContent = "";
          flight.current = null;
          liveAt.current = 0;
          sawLand.current = false;
          clock.current.token += 1;
          setResets((value) => value + 1);
          beginSwing(play.current, point);
        }}
        onPointerMove={(event) => {
          const point = local(event);
          if (point) moveSwing(play.current, point);
        }}
        onPointerUp={(event) => {
          const point = local(event);
          if (point && play.current.phase === "down") finishSwing(play.current, point, true);
          else if (play.current.phase === "back") finishSwing(play.current, point ?? play.current.start!, true);
        }}
      >
        <Golf3dRange
          outcomes={{}}
          play={clock}
          embedded
          resets={resets}
          onBox={(node) => {
            box.current = node;
          }}
          onLaunch={(shot) => {
            if (play.current.shot?.strike === "air") return;
            flight.current = shot;
            born.current = performance.now();
            liveAt.current = 0;
            sawLand.current = false;
            setYards(shot);
            setLanded(reduce.current);
            if (reduce.current) setLongest((value) => Math.max(value, Math.round(shot.total)));
          }}
        />
        <canvas ref={overlay} className="pointer-events-none absolute inset-0 h-full w-full" />
        <p className="pointer-events-none absolute left-3.5 top-3 text-[0.85rem] font-semibold" style={onPicture}>
          {longest > 0 ? `${words.longest}: ${longest} ${theme.copy.yards}` : ""}
        </p>
        {hint ? (
          <p className="pointer-events-none absolute left-3.5 top-[34px] max-w-[60%] text-[0.85rem]" style={onPicture}>
            {words.hint}
          </p>
        ) : null}
        <p
          ref={liveText}
          className="pointer-events-none absolute left-1/2 top-[18%] -translate-x-1/2 text-[1.6rem] font-semibold"
          style={{ ...onPicture, textShadow: "0 2px 6px rgba(22,21,20,0.5)" }}
        />
        {perfect ? (
          <p
            className="pointer-events-none absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 text-[2.4rem] font-bold tracking-[0.02em]"
            style={{ color: theme.clay, textShadow: "0 2px 10px rgba(243,239,230,0.8)" }}
          >
            {words.perfect}
          </p>
        ) : null}
        {panel ? (
          <button
            type="button"
            className="absolute bottom-3 left-3 max-w-[min(360px,calc(100%-24px))] rounded-xl px-3.5 py-3 text-left text-[0.9rem] leading-[1.4]"
            style={{ background: "rgba(243,239,230,0.94)", color: theme.ink, boxShadow: "0 2px 12px rgba(22,21,20,0.2)" }}
            onClick={() => setPanel(null)}
          >
            <span className="block text-[1.05rem] font-semibold">{panel.perfect ? words.perfectName : panel.key === "air-shot" ? copy.air.name : info?.name}</span>
            <span className="mt-1 block" style={{ color: "#6B665E" }}>
              {panel.strike === "air" || !yards
                ? words.noContact
                : landed
                  ? `${words.carry} ${Math.round(yards.carry)} ${theme.copy.yards}, total ${Math.round(yards.total)} ${theme.copy.yards}`
                  : `${words.carry} ...`}
            </span>
            {panel.perfect ? (
              <span className="mt-2 block text-sm text-muted">
                {words.purity} {Math.round(panel.purity * 100)}
                {words.pureTail}
              </span>
            ) : (
              <span className="mt-2 block text-sm text-muted">{info && "cause" in info ? info.cause : ""}</span>
            )}
            {!panel.perfect && panel.letDown[0] ? (
              <span className="mt-2 block">
                <span className="font-semibold">{reasonLabel}:</span> {panel.letDown[0].what} {panel.letDown[0].fix}
              </span>
            ) : null}
            {!panel.perfect && panel.letDown[1] ? (
              <span className="mt-1 block text-sm text-muted">
                {words.also}: {panel.letDown[1].what}
              </span>
            ) : null}
            {panel.key === "air-shot" && airLines[0] ? <span className="mt-2 block text-sm">{airLines[0]}</span> : null}
            {panel.key !== "air-shot" && !panel.perfect && goodLines[0] ? <span className="mt-2 block text-sm">{goodLines[0]}</span> : null}
            {!panel.perfect && tip ? (
              <span className="mt-2 block text-sm">
                <span className="font-semibold">{words.onRange}:</span> {tip}
              </span>
            ) : null}
            <span className="mt-3 block text-[0.75rem]" style={{ color: "#6B665E" }}>{words.close}</span>
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className="mt-4 rounded-full border border-line bg-card px-4 py-2 text-sm"
        onClick={() => {
          setPanel(null);
          setYards(null);
          flight.current = null;
          clock.current.token += 1;
          setResets((value) => value + 1);
          demoSwing(play.current, {
            key: "straight",
            clubMph: clubSpeedMph(1, swingSpeedMul(3, 0)),
            path: 0,
            face: (Math.random() - 0.5) * 3,
            strike: "center",
            contact: "clean",
            speedTier: "normal",
            bal: 0,
            checks: { balance: true, length: true, tempo: true, path: true, face: true, strike: true },
            perfect: false,
            purity: 1,
            letDown: [],
            over: 0,
            strikeOff: 0,
            offN: 0,
          });
        }}
      >
        {theme.copy.swing}
      </button>
      {touch && armed ? (
        <button type="button" className="ml-2 mt-4 rounded-full border border-line bg-card px-4 py-2 text-sm" onClick={onDone}>
          {words.done}
        </button>
      ) : null}
    </div>
  );
}
