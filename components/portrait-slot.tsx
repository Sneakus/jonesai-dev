"use client";

import { useEffect, useRef, useState } from "react";
import type { PortraitContent } from "@/lib/content";
import { PORTRAIT_HIT, type PortraitHit } from "@/src/portrait/bridge";
import type { PortraitSim } from "@/src/portrait/sim";

function fmt(n: number) {
  return n.toLocaleString("en-GB");
}

function playThunk(
  ctx: AudioContext,
  big: boolean,
) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(big ? 90 : 220, t);
  osc.frequency.exponentialRampToValueAtTime(big ? 45 : 140, t + (big ? 0.18 : 0.05));
  gain.gain.setValueAtTime(big ? 0.35 : 0.08, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + (big ? 0.25 : 0.06));
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.3);
}

function playTick(ctx: AudioContext) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(900 + Math.random() * 500, t);
  gain.gain.setValueAtTime(0.04, t);
  gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.05);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.06);
}

export function PortraitSlot({ copy }: { copy: PortraitContent }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const leverRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const armRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLParagraphElement>(null);
  const simRef = useRef<PortraitSim | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hitsRef = useRef<PortraitHit[]>([]);
  const copyRef = useRef(copy);
  const clickRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const mutedRef = useRef(false);
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    copyRef.current = copy;
  }, [copy]);

  useEffect(() => {
    let alive = true;
    let frame = 0;
    let looping = false;
    let loading = false;
    let wake = false;
    let lastT = 0;
    let captionUntil = 0;
    let lastWarn = 0;
    let lastSlam = 0;
    let lastHint = "";
    let audioCtx: AudioContext | null = null;

    const sound = () => {
      if (mutedRef.current) {
        return null;
      }
      const Ctx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) {
        return null;
      }
      audioCtx = audioCtx || new Ctx();
      return audioCtx;
    };

    const paintHint = (sim: PortraitSim) => {
      const hint = hintRef.current;
      if (!hint) {
        return;
      }
      const tank = sim.reservoir();
      const mode = sim.hintMode();
      const key = `${mode}:${tank.n}:${tank.total}`;
      if (key === lastHint) {
        return;
      }
      lastHint = key;
      const words = copyRef.current;
      hint.replaceChildren();
      if (mode === "clear") {
        return;
      }
      if (mode === "needs") {
        hint.append(words.needsBefore);
        const link = document.createElement("a");
        link.href = "#top";
        link.textContent = words.smashLink;
        hint.append(link, words.needsAfter);
        return;
      }
      if (mode === "progress") {
        hint.textContent = words.progress
          .replace("{have}", fmt(tank.n))
          .replace("{need}", fmt(tank.total));
        return;
      }
      hint.textContent = words.full;
    };

    const loop = (now: number) => {
      if (!alive) {
        return;
      }
      frame = window.requestAnimationFrame(loop);
      if (!simRef.current && wake && !loading) {
        loading = true;
        void start();
      }
      const sim = simRef.current;
      const wrap = wrapRef.current;
      const tray = trayRef.current;
      const lever = leverRef.current;
      const box = boxRef.current;
      const face = faceRef.current;
      const fx = fxRef.current;
      if (!sim || !wrap || !tray || !lever || !box || !face || !fx) {
        lastT = now;
        return;
      }
      const dt = Math.min(0.033, (now - lastT) / 1000);
      lastT = now;
      const width = wrap.clientWidth;
      if (width > 0 && Math.abs(width - sim.pw) > 0.5) {
        sim.sizePortrait(width);
      }
      if (sim.cw > 0) {
        const queued = hitsRef.current.splice(0);
        for (const hit of queued) {
          sim.smash(hit.x, hit.y);
        }
      }
      const trayBox = tray.getBoundingClientRect();
      const leverBox = lever.getBoundingClientRect();
      const faceBox = face.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const fxW = Math.max(1, Math.round(window.innerWidth * dpr));
      const fxH = Math.max(1, Math.round(window.innerHeight * dpr));
      if (fx.width !== fxW) {
        fx.width = fxW;
      }
      if (fx.height !== fxH) {
        fx.height = fxH;
      }
      const faceW = Math.max(1, Math.round(sim.pw * dpr));
      const faceH = Math.max(1, Math.round(sim.ph * dpr));
      if (face.width !== faceW) {
        face.width = faceW;
      }
      if (face.height !== faceH) {
        face.height = faceH;
      }
      face.style.height = `${sim.ph}px`;
      const looks = Array.from(document.querySelectorAll<HTMLElement>(".look")).map(
        (link) => {
          const rect = link.getBoundingClientRect();
          return {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          };
        },
      );
      sim.sync({
        vw: window.innerWidth,
        vh: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        dpr,
        tray: {
          left: trayBox.left,
          top: trayBox.top,
          width: trayBox.width,
          height: trayBox.height,
        },
        leverLeft: leverBox.left,
        portrait: {
          left: faceBox.left,
          top: faceBox.top,
          width: faceBox.width,
          height: faceBox.height,
        },
        looks,
      });
      const fxCtx = fx.getContext("2d");
      const faceCtx = face.getContext("2d");
      const audio = audioRef.current;
      const speaking = Boolean(audio && !audio.paused && !audio.ended);
      sim.step(
        dt,
        now,
        { fx: fxCtx, face: faceCtx },
        { speaking, time: audio?.currentTime ?? 0 },
      );
      wrap.style.height = `${sim.winH.toFixed(2)}px`;
      if (sim.pendingScroll) {
        const dy = sim.pendingScroll;
        sim.pendingScroll = 0;
        window.scrollBy(0, dy);
      }
      if (armRef.current) {
        armRef.current.style.transform = `translateY(${(sim.pos * 148).toFixed(1)}px)`;
      }
      const tank = sim.reservoir();
      if (fillRef.current) {
        fillRef.current.style.height = `${tank.share * 100}%`;
      }
      if (countRef.current) {
        countRef.current.textContent = `${fmt(tank.n)} / ${fmt(tank.total)}`;
      }
      box.classList.toggle("grabbing", sim.dragging);
      box.classList.toggle("ready", sim.isFull());
      box.classList.toggle("locked", !sim.isFull());
      if (sim.slam !== lastSlam) {
        lastSlam = sim.slam;
        box.classList.remove("slam");
        void box.offsetWidth;
        box.classList.add("slam");
      }
      paintHint(sim);
      const hint = hintRef.current;
      if (hint && sim.warns !== lastWarn) {
        lastWarn = sim.warns;
        hint.classList.remove("warn");
        void hint.offsetWidth;
        hint.classList.add("warn");
      }
      captionRef.current?.classList.toggle(
        "on",
        speaking || now < captionUntil,
      );
    };

    const start = async () => {
      try {
        const [{ PortraitSim }, response] = await Promise.all([
          import("@/src/portrait/sim"),
          fetch("/portrait/portrait.json"),
        ]);
        if (!response.ok) {
          throw new Error("portrait data");
        }
        const portrait = (await response.json()) as ConstructorParameters<
          typeof PortraitSim
        >[0];
        if (!alive) {
          return;
        }
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const sim = new PortraitSim(portrait, { reduce });
        const voice = new Audio("/portrait/voice.mp3");
        voice.preload = "auto";
        voice.addEventListener("ended", () => {
          captionUntil = performance.now() + 1500;
        });
        sim.onSpeak = () => {
          if (!barRef.current) {
            return;
          }
          barRef.current.hidden = false;
          voice.currentTime = 0;
          voice.muted = mutedRef.current;
          void voice.play().catch(() => undefined);
        };
        sim.onThunk = (big) => {
          if (navigator.vibrate) {
            navigator.vibrate(big ? 35 : 6);
          }
          const ctx = sound();
          if (ctx) {
            playThunk(ctx, big);
          }
        };
        sim.onTick = () => {
          const ctx = sound();
          if (ctx) {
            playTick(ctx);
          }
        };
        const wrap = wrapRef.current;
        if (wrap && wrap.clientWidth > 0) {
          sim.sizePortrait(wrap.clientWidth);
        }
        simRef.current = sim;
        audioRef.current = voice;
      } catch {
        loading = true;
      }
    };

    const ensure = () => {
      if (looping) {
        return;
      }
      looping = true;
      lastT = performance.now();
      frame = window.requestAnimationFrame(loop);
    };

    const onHit = (event: Event) => {
      const detail = (event as CustomEvent<PortraitHit>).detail;
      if (!detail) {
        return;
      }
      hitsRef.current.push(detail);
      wake = true;
      ensure();
    };

    const onScroll = () => {
      simRef.current?.noteScroll(window.scrollY, performance.now());
      const root = rootRef.current;
      if (!root || wake) {
        return;
      }
      if (root.getBoundingClientRect().top < window.innerHeight + 240) {
        wake = true;
        ensure();
      }
    };

    const onPointer = (event: PointerEvent) => {
      simRef.current?.movePointer(event.clientX, event.clientY, performance.now());
    };

    const onKey = () => {
      simRef.current?.noteKey(performance.now());
    };

    window.addEventListener(PORTRAIT_HIT, onHit);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointer);
    window.addEventListener("keydown", onKey);

    return () => {
      alive = false;
      window.cancelAnimationFrame(frame);
      window.removeEventListener(PORTRAIT_HIT, onHit);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("keydown", onKey);
      audioRef.current?.pause();
      simRef.current = null;
    };
  }, []);

  const toggleSound = () => {
    mutedRef.current = !mutedRef.current;
    if (audioRef.current) {
      audioRef.current.muted = mutedRef.current;
    }
    setSoundOn(!mutedRef.current);
  };

  const sayAgain = () => {
    const voice = audioRef.current;
    if (!voice || !barRef.current) {
      return;
    }
    barRef.current.hidden = false;
    voice.currentTime = 0;
    voice.muted = mutedRef.current;
    void voice.play().catch(() => undefined);
  };

  return (
    <div className="workshop" id="workshop" ref={rootRef}>
      <canvas ref={fxRef} className="portrait-fx" aria-hidden="true" />
      <div
        className="portrait-wrap"
        ref={wrapRef}
        tabIndex={0}
        aria-label={copy.portraitLabel}
        onPointerLeave={() => simRef.current?.leavePortrait()}
        onPointerDown={(event) => {
          clickRef.current = {
            x: event.clientX,
            y: event.clientY,
            t: performance.now(),
          };
          simRef.current?.pressFace();
        }}
        onPointerUp={(event) => {
          const start = clickRef.current;
          clickRef.current = null;
          if (!start) {
            return;
          }
          const moved =
            Math.abs(event.clientX - start.x) + Math.abs(event.clientY - start.y);
          simRef.current?.tryClick(moved, performance.now() - start.t);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }
          event.preventDefault();
          simRef.current?.tryClick(0, 0);
        }}
      >
        <canvas ref={faceRef} role="img" aria-label={copy.canvasLabel} />
      </div>
      <div className="bar" ref={barRef} hidden>
        <p className="caption" ref={captionRef} aria-live="polite">
          {copy.caption}
        </p>
        <button type="button" className="chip" onClick={sayAgain}>
          {copy.sayAgain}
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={soundOn ? "false" : "true"}
          onClick={toggleSound}
        >
          {soundOn ? copy.soundOn : copy.soundOff}
        </button>
      </div>
      <div className="tray" ref={trayRef}>
        <p className="hint" id="portrait-hint" ref={hintRef}>
          {copy.needsBefore}
          <a href="#top">{copy.smashLink}</a>
          {copy.needsAfter}
        </p>
        <div className="lever" ref={leverRef}>
          <div className="reservoir">
            <div className="tube" aria-hidden="true">
              <div className="fill" ref={fillRef} />
            </div>
            <span className="count" ref={countRef}>
              0 / 0
            </span>
          </div>
          <div
            className="leverbox locked"
            ref={boxRef}
            role="button"
            tabIndex={0}
            aria-describedby="portrait-hint"
            aria-label={copy.leverLabel}
            onPointerDown={(event) => {
              simRef.current?.leverDown(event.clientY);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => simRef.current?.leverMove(event.clientY)}
            onPointerUp={() => simRef.current?.leverUp()}
            onPointerCancel={() => simRef.current?.leverUp()}
            onKeyDown={(event) => {
              if (
                event.key !== "Enter" &&
                event.key !== " " &&
                event.key !== "ArrowDown"
              ) {
                return;
              }
              event.preventDefault();
              simRef.current?.leverKey();
            }}
          >
            <div className="track" />
            <div className="arm" ref={armRef}>
              <div className="stem" />
              <div className="grip">{copy.pull}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
