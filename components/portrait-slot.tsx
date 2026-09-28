"use client";

import { useEffect, useRef, useState } from "react";
import type { PortraitContent } from "@/lib/content";
import { attach, wake } from "@/src/motion/loop";
import { PORTRAIT_HIT, type PortraitHit } from "@/src/portrait/bridge";
import { PortraitSim, startHeapWarmup, PILE_H, type FallingPiece, type PackedPortrait } from "@/src/portrait/sim";

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
  const heapRef = useRef<HTMLCanvasElement>(null);
  const fallRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const crusherRef = useRef<HTMLDivElement>(null);
  const leverRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const armRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLParagraphElement>(null);
  const simRef = useRef<PortraitSim | null>(null);
  const playVoiceRef = useRef<() => void>(() => undefined);
  const voiceGainRef = useRef<GainNode | null>(null);
  const hitsRef = useRef<PortraitHit[]>([]);
  const copyRef = useRef(copy);
  const clickRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const mutedRef = useRef(false);
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    copyRef.current = copy;
  }, [copy]);

  useEffect(() => {
    startHeapWarmup();
    let alive = true;
    let loading = false;
    let lastT = 0;
    let captionUntil = 0;
    let lastWarn = 0;
    let lastSlam = 0;
    let lastHint = "";
    let audioCtx: AudioContext | null = null;

    const paintHint = (sim: PortraitSim) => {
      const hint = hintRef.current;
      if (!hint) {
        return;
      }
      const tank = sim.reservoir();
      const mode = sim.hintMode();
      const key = `${mode}:${tank.pct}`;
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
        hint.textContent = words.progress.replace("{pct}", fmt(tank.pct));
        return;
      }
      hint.textContent = words.full;
    };

    let voiceBytes: ArrayBuffer | null = null;
    let voiceBuffer: AudioBuffer | null = null;
    let voiceSource: AudioBufferSourceNode | null = null;
    let voiceGain: GainNode | null = null;
    let voiceStarted = 0;
    let rumbleBuffer: AudioBuffer | null = null;
    let rumble: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

    type Box = { left: number; top: number; width: number; height: number };
    const boxes = {
      tray: { left: 0, top: 0, width: 1, height: 240 } as Box,
      crusher: { left: 0, top: 0, width: 86, height: 92 } as Box,
      leverLeft: 0,
      face: { left: 0, top: 0, width: 1, height: 1 } as Box,
      workshop: { left: 0, top: 0, width: 1, height: 1 } as Box,
      looks: [] as Box[],
      wrapWidth: 0,
    };
    const params = new URLSearchParams(window.location.search);
    const overlayCap = params.get("overlayDpr") === "1" ? 1 : 1.5;
    const readBox = (el: HTMLElement): Box => {
      const rect = el.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    };
    const refresh = () => {
      const tray = trayRef.current;
      const crusher = crusherRef.current;
      const lever = leverRef.current;
      const face = faceRef.current;
      const root = rootRef.current;
      const wrap = wrapRef.current;
      if (!tray || !crusher || !lever || !face || !root || !wrap) {
        return;
      }
      boxes.wrapWidth = wrap.clientWidth;
      crusher.style.right = `${lever.offsetWidth + 12}px`;
      boxes.tray = readBox(tray);
      boxes.crusher = readBox(crusher);
      boxes.leverLeft = readBox(lever).left;
      boxes.face = readBox(face);
      boxes.workshop = readBox(root);
      boxes.looks = Array.from(document.querySelectorAll<HTMLElement>(".look")).map(readBox);
    };
    const faceScale = () => Math.min(window.devicePixelRatio || 1, 2);
    const overlayScale = () => Math.min(window.devicePixelRatio || 1, overlayCap);
    const sizeHeap = () => {
      const heap = heapRef.current;
      if (!heap || boxes.tray.width < 2) {
        return;
      }
      const dpr = faceScale();
      const width = Math.max(1, Math.round(boxes.tray.width * dpr));
      const height = Math.max(1, Math.round(PILE_H * dpr));
      if (heap.width !== width) {
        heap.width = width;
      }
      if (heap.height !== height) {
        heap.height = height;
      }
    };
    const sizeOverlay = () => {
      const fx = fxRef.current;
      if (!fx) {
        return;
      }
      const dpr = overlayScale();
      const width = Math.max(1, Math.round(window.innerWidth * dpr));
      const height = Math.max(1, Math.round(window.innerHeight * dpr));
      if (fx.width !== width) {
        fx.width = width;
      }
      if (fx.height !== height) {
        fx.height = height;
      }
    };
    const sizeCanvases = () => {
      const face = faceRef.current;
      const sim = simRef.current;
      sizeHeap();
      if (face && sim && sim.pw > 0) {
        const dpr = faceScale();
        const width = Math.max(1, Math.round(sim.pw * dpr));
        const height = Math.max(1, Math.round(sim.ph * dpr));
        if (face.width !== width) {
          face.width = width;
        }
        if (face.height !== height) {
          face.height = height;
        }
        face.style.height = `${sim.ph}px`;
      }
    };
    const warmCanvas = () => {
      sizeCanvases();
    };

    const decodeVoice = () => {
      if (!audioCtx || !voiceBytes || voiceBuffer) {
        return;
      }
      const bytes = voiceBytes.slice(0);
      void audioCtx.decodeAudioData(bytes).then((buffer) => {
        voiceBuffer = buffer;
      }).catch(() => undefined);
    };
    const ensureAudio = () => {
      if (audioCtx) {
        return audioCtx;
      }
      const Ctx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) {
        return null;
      }
      audioCtx = new Ctx();
      const len = audioCtx.sampleRate;
      const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
      const data = buf.getChannelData(0);
      for (let k = 0; k < len; k += 1) {
        data[k] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin((k / len) * Math.PI * 40));
      }
      rumbleBuffer = buf;
      decodeVoice();
      return audioCtx;
    };
    const playVoice = () => {
      const ctx = audioCtx;
      if (!ctx || !voiceBuffer || !barRef.current) {
        return;
      }
      barRef.current.hidden = false;
      if (voiceGain) {
        voiceGain.gain.value = mutedRef.current ? 0 : 1;
      }
      try {
        voiceSource?.stop();
      } catch {
        // The previous line may already have finished.
      }
      const src = ctx.createBufferSource();
      const gain = voiceGain ?? ctx.createGain();
      voiceGain = gain;
      gain.gain.value = mutedRef.current ? 0 : 1;
      src.buffer = voiceBuffer;
      src.connect(gain).connect(ctx.destination);
      voiceStarted = ctx.currentTime;
      src.onended = () => {
        if (voiceSource === src) {
          voiceSource = null;
          captionUntil = performance.now() + 1500;
        }
      };
      src.start();
      voiceSource = src;
      voiceGainRef.current = gain;
    };
    const stopRumble = () => {
      const ctx = audioCtx;
      if (!rumble || !ctx) {
        rumble = null;
        return;
      }
      try {
        const t = ctx.currentTime;
        rumble.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        rumble.src.stop(t + 0.7);
      } catch {
        // The rumble may already have stopped.
      }
      rumble = null;
    };
    const startRumble = () => {
      const ctx = audioCtx;
      if (!ctx || !rumbleBuffer || rumble) {
        return;
      }
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      src.buffer = rumbleBuffer;
      src.loop = true;
      filter.type = "lowpass";
      filter.frequency.value = 260;
      gain.gain.value = 0.0001;
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.3);
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start();
      rumble = { src, gain };
    };

    const wire = (sim: PortraitSim) => {
      sim.onSpeak = () => playVoice();
      sim.onThunk = (big) => {
        if (navigator.vibrate) {
          navigator.vibrate(big ? 35 : 6);
        }
        const ctx = audioCtx;
        if (ctx) {
          playThunk(ctx, big);
        }
      };
      sim.onTick = () => {
        const ctx = audioCtx;
        if (ctx) {
          playTick(ctx);
        }
      };
      sim.onRumble = (on) => {
        if (!on) {
          stopRumble();
          return;
        }
        if (navigator.vibrate) {
          navigator.vibrate([30, 60, 30, 60, 30, 60, 30, 60, 30, 60, 30]);
        }
        startRumble();
      };
    };

    let worker: Worker | null = null;
    const loadPortrait = () => {
      if (loading || simRef.current) {
        return;
      }
      loading = true;
      worker = new Worker("/portrait/unpack.js");
      worker.onmessage = (event: MessageEvent) => {
        if (!alive) {
          return;
        }
        const msg = event.data as {
          fps: number;
          cols: number;
          nr: number;
          sc: number;
          n: number;
          full: number;
          frameCount: number;
          orderCount: number;
          ramp: string;
          idle: number[];
          eyes: PackedPortrait["eyes"];
          headCol: number;
          vmax: number;
          shape: number;
          jx: number;
          jy: number;
          depth: number;
          rnd1: number;
          rnd2: number;
          order: number;
          frames: number;
          buffer: ArrayBuffer;
        };
        const buffer = msg.buffer;
        const cellCount = msg.nr * msg.cols;
        const frames: Uint8Array[] = [];
        for (let f = 0; f < msg.frameCount; f += 1) {
          frames.push(new Uint8Array(buffer, msg.frames + f * cellCount, cellCount));
        }
        const packed: PackedPortrait = {
          fps: msg.fps,
          cols: msg.cols,
          nr: msg.nr,
          sc: msg.sc,
          n: msg.n,
          full: msg.full,
          frameCount: msg.frameCount,
          ramp: msg.ramp,
          idle: msg.idle,
          eyes: msg.eyes,
          headCol: msg.headCol,
          vmax: new Float32Array(buffer, msg.vmax, msg.n),
          shape: new Float32Array(buffer, msg.shape, msg.n * 6),
          jx: new Float32Array(buffer, msg.jx, msg.n),
          jy: new Float32Array(buffer, msg.jy, msg.n),
          depth: new Float32Array(buffer, msg.depth, msg.n),
          rnd1: new Float32Array(buffer, msg.rnd1, msg.n),
          rnd2: new Float32Array(buffer, msg.rnd2, msg.n),
          order: new Uint16Array(buffer, msg.order, msg.orderCount),
          frames,
        };
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const sim = new PortraitSim(packed, { reduce });
        wire(sim);
        const wrap = wrapRef.current;
        if (wrap && boxes.wrapWidth > 0) {
          sim.sizePortrait(boxes.wrapWidth);
        }
        simRef.current = sim;
        sizeCanvases();
        wake();
        worker?.terminate();
        worker = null;
      };
      worker.postMessage("go");
    };

    let overlayOn = false;
    const usedShards = new Map<number, HTMLDivElement>();
    const freeShards: HTMLDivElement[] = [];
    const syncOverlay = (show: boolean) => {
      const node = fxRef.current;
      if (!node || overlayOn === show) {
        return;
      }
      overlayOn = show;
      node.classList.toggle("on", show);
      if (show) {
        sizeOverlay();
      }
    };
    const syncFalling = (pieces: FallingPiece[]) => {
      const host = fallRef.current;
      if (!host) {
        return;
      }
      const seen = new Set<number>();
      for (const piece of pieces) {
        seen.add(piece.id);
        let el = usedShards.get(piece.id);
        if (!el) {
          el = freeShards.pop() || document.createElement("div");
          el.className = "falling-shard";
          el.style.width = `${piece.box}px`;
          el.style.height = `${piece.box}px`;
          el.style.background = piece.color;
          el.style.clipPath = piece.clip;
          host.appendChild(el);
          usedShards.set(piece.id, el);
        }
        const half = piece.box * 0.5;
        el.style.transform = `translate3d(${(piece.x - half).toFixed(1)}px,${(piece.y - half).toFixed(1)}px,0) rotate(${piece.rot.toFixed(3)}rad)`;
      }
      for (const [id, el] of usedShards) {
        if (seen.has(id)) {
          continue;
        }
        usedShards.delete(id);
        el.className = "falling-shard parked";
        freeShards.push(el);
      }
    };

    const loop = (now: number) => {
      if (!alive) {
        return false;
      }
      const sim = simRef.current;
      const wrap = wrapRef.current;
      const crusher = crusherRef.current;
      const box = boxRef.current;
      const face = faceRef.current;
      const fx = fxRef.current;
      if (!sim || !wrap || !crusher || !box || !face || !fx) {
        lastT = now;
        return false;
      }
      const workshop = boxes.workshop;
      const faceOnScreen =
        workshop.top < window.innerHeight && workshop.top + workshop.height > 0;
      if (boxes.wrapWidth > 0 && Math.abs(boxes.wrapWidth - sim.pw) > 0.5) {
        sim.sizePortrait(boxes.wrapWidth);
        sizeCanvases();
      }
      sim.sync({
        vw: window.innerWidth,
        vh: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        dpr: faceScale(),
        fxDpr: overlayScale(),
        tray: boxes.tray,
        leverLeft: boxes.leverLeft,
        crusher: boxes.crusher,
        portrait: boxes.face,
        looks: boxes.looks,
      });
      if (sim.cw > 0 && hitsRef.current.length) {
        const queued = hitsRef.current.splice(0);
        for (const hit of queued) {
          sim.smash(hit.x, hit.y);
        }
      }
      if (!sim.awake() && !(faceOnScreen && sim.built > 0)) {
        syncFalling([]);
        syncOverlay(false);
        return false;
      }
      const dt = Math.min(0.033, lastT ? (now - lastT) / 1000 : 0.016);
      lastT = now;
      const speaking = Boolean(
        voiceSource &&
          voiceBuffer &&
          audioCtx &&
          audioCtx.currentTime < voiceStarted + voiceBuffer.duration,
      );
      const showOverlay = sim.overlayActive();
      syncOverlay(showOverlay);
      sizeHeap();
      const heap = heapRef.current;
      sim.step(
        dt,
        now,
        {
          fx: showOverlay ? fx.getContext("2d") : null,
          face: face.getContext("2d"),
          heap: heap ? heap.getContext("2d") : null,
        },
        { speaking, time: audioCtx ? Math.max(0, audioCtx.currentTime - voiceStarted) : 0 },
        faceOnScreen,
      );
      syncFalling(sim.fallingViews());
      const nextHeight = `${sim.winH.toFixed(2)}px`;
      if (wrap.style.height !== nextHeight) {
        wrap.style.height = nextHeight;
      }
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
        const nextFill = `${tank.share * 100}%`;
        if (fillRef.current.style.height !== nextFill) {
          fillRef.current.style.height = nextFill;
        }
      }
      if (countRef.current && countRef.current.textContent !== `${tank.pct}%`) {
        countRef.current.textContent = `${tank.pct}%`;
      }
      crusher.classList.toggle("up", sim.crusherUp);
      crusher.classList.toggle("sinking", sim.crusherSinking);
      crusher.classList.toggle("on", sim.crusherOn);
      box.classList.toggle("grabbing", sim.dragging);
      box.classList.toggle("ready", sim.isFull());
      box.classList.toggle("locked", !sim.isFull());
      if (sim.slam !== lastSlam) {
        lastSlam = sim.slam;
        box.classList.remove("slam");
        window.setTimeout(() => box.classList.add("slam"), 0);
      }
      paintHint(sim);
      const hint = hintRef.current;
      if (hint && sim.warns !== lastWarn) {
        lastWarn = sim.warns;
        hint.classList.remove("warn");
        window.setTimeout(() => hint.classList.add("warn"), 0);
      }
      captionRef.current?.classList.toggle("on", speaking || now < captionUntil);
      return sim.awake() || (faceOnScreen && sim.built > 0);
    };

    const onHit = (event: Event) => {
      const detail = (event as CustomEvent<PortraitHit>).detail;
      if (!detail) {
        return;
      }
      hitsRef.current.push(detail);
      wake();
    };

    const onScroll = () => {
      refresh();
      simRef.current?.noteScroll(window.scrollY, performance.now());
      const root = rootRef.current;
      if (!root || simRef.current || loading) {
        return;
      }
      if (root.getBoundingClientRect().top < window.innerHeight + 240) {
        loadPortrait();
      }
    };

    const onPointer = (event: PointerEvent) => {
      simRef.current?.movePointer(event.clientX, event.clientY, performance.now());
      if (simRef.current?.awake()) {
        wake();
      }
    };

    const onKey = () => {
      simRef.current?.noteKey(performance.now());
    };

    const onFirstPointer = () => {
      const ctx = ensureAudio();
      void ctx?.resume();
    };

    const watched = [
      rootRef.current,
      wrapRef.current,
      trayRef.current,
      leverRef.current,
      crusherRef.current,
      faceRef.current,
    ];
    const observer = new ResizeObserver(() => {
      refresh();
      sizeCanvases();
    });
    for (const el of watched) {
      if (el) {
        observer.observe(el);
      }
    }
    for (const link of document.querySelectorAll<HTMLElement>(".look")) {
      observer.observe(link);
    }
    refresh();
    window.requestAnimationFrame(warmCanvas);
    void fetch("/portrait/voice.mp3")
      .then((response) => response.arrayBuffer())
      .then((bytes) => {
        voiceBytes = bytes;
        decodeVoice();
      })
      .catch(() => undefined);
    if (params.get("preload") === "1" || typeof window.requestIdleCallback !== "function") {
      window.setTimeout(loadPortrait, 2000);
    } else {
      window.requestIdleCallback(() => loadPortrait(), { timeout: 2000 });
    }
    const detach = attach(loop);
    playVoiceRef.current = playVoice;
    window.addEventListener("pointerdown", onFirstPointer, { capture: true });
    window.addEventListener(PORTRAIT_HIT, onHit);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", refresh);
    window.addEventListener("pointermove", onPointer);
    window.addEventListener("keydown", onKey);

    return () => {
      alive = false;
      detach();
      observer.disconnect();
      worker?.terminate();
      window.removeEventListener("pointerdown", onFirstPointer, { capture: true });
      window.removeEventListener(PORTRAIT_HIT, onHit);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", refresh);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("keydown", onKey);
      try {
        voiceSource?.stop();
      } catch {
        // Already finished.
      }
      simRef.current = null;
    };
  }, []);

  const toggleSound = () => {
    mutedRef.current = !mutedRef.current;
    const gain = voiceGainRef.current;
    if (gain) {
      gain.gain.value = mutedRef.current ? 0 : 1;
    }
    setSoundOn(!mutedRef.current);
  };

  const sayAgain = () => {
    playVoiceRef.current();
  };

  return (
    <div className="workshop" id="workshop" ref={rootRef}>
      <canvas ref={fxRef} className="portrait-fx" data-canvas="portrait-fx" aria-hidden="true" />
      <div ref={fallRef} className="falling-layer" aria-hidden="true" />
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
        <canvas ref={heapRef} className="heap-canvas" data-canvas="heap-canvas" aria-hidden="true" />
        <div className="crusher" ref={crusherRef} aria-hidden="true">
          <div className="body">
            <div className="nozzle" />
            <div className="housing">
              <div className="intake" />
              <div className="window">
                <svg viewBox="0 0 60 30" aria-hidden="true">
                  <g className="gear g1">
                    <circle cx="0" cy="0" r="10" />
                    <path d="M0 -13 L3 -9 L-3 -9 Z M0 13 L3 9 L-3 9 Z M-13 0 L-9 3 L-9 -3 Z M13 0 L9 3 L9 -3 Z M9 -9 L9 -5 L5 -9 Z M-9 9 L-9 5 L-5 9 Z M-9 -9 L-5 -9 L-9 -5 Z M9 9 L5 9 L9 5 Z" />
                  </g>
                  <g className="gear g2">
                    <circle cx="0" cy="0" r="10" />
                    <path d="M0 -13 L3 -9 L-3 -9 Z M0 13 L3 9 L-3 9 Z M-13 0 L-9 3 L-9 -3 Z M13 0 L9 3 L9 -3 Z M9 -9 L9 -5 L5 -9 Z M-9 9 L-9 5 L-5 9 Z M-9 -9 L-5 -9 L-9 -5 Z M9 9 L5 9 L9 5 Z" />
                  </g>
                </svg>
              </div>
            </div>
          </div>
        </div>
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
              0%
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
