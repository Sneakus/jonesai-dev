"use client";

import { useLayoutEffect, useRef } from "react";
import type { BuildFunnel, FunnelStep } from "@/lib/content";

const settings = {
  playMs: 6000,
  holdMs: 2000,
  cardWidth: 36,
  cardHeight: 20,
};

const description =
  "On 15 September, AJob checked 261 new jobs. A keyword check removed 177, a cheap AI model removed 77, a stronger model removed 6, and 1 reached my inbox.";

type LayoutName = "row" | "column";

type StageGeom = {
  titleX: number;
  titleY: number;
  titleWidth: number;
  detailX: number;
  detailY: number;
  passX: number;
  passY: number;
  dropX: number;
  dropY: number;
  gate: { x1: number; y1: number; x2: number; y2: number } | null;
  inbox: { x: number; y: number; width: number; height: number } | null;
};

type Scene = {
  width: number;
  height: number;
  stages: StageGeom[];
};

type LiveCard = {
  gate: number;
  stagger: number;
  side: number;
  hero: boolean;
};

function sceneFor(kind: LayoutName, stageCount: number): Scene {
  if (kind === "row") {
    const width = 640;
    const height = 292;
    const gap = width / stageCount;
    const stages = Array.from({ length: stageCount }, (_, index) => {
      const x = gap * (index + 0.5);
      const isStart = index === 0;
      const isEnd = index === stageCount - 1;
      const isGate = !isStart && !isEnd;
      return {
        titleX: x - (gap - 16) / 2,
        titleY: 14,
        titleWidth: gap - 16,
        detailX: x,
        detailY: 72,
        passX: x,
        passY: 154,
        dropX: x,
        dropY: 236,
        gate: isGate ? { x1: x, y1: 112, x2: x, y2: 186 } : null,
        inbox: isEnd ? { x: x - 36, y: 124, width: 72, height: 58 } : null,
      };
    });
    return { width, height, stages };
  }

  const width = 360;
  const pitch = 112;
  const height = pitch * stageCount;
  const stages = Array.from({ length: stageCount }, (_, index) => {
    const y = pitch * index;
    const isStart = index === 0;
    const isEnd = index === stageCount - 1;
    const isGate = !isStart && !isEnd;
    const passY = y + 78;
    return {
      titleX: 16,
      titleY: y + 8,
      titleWidth: width - 32,
      detailX: 118,
      detailY: y + 52,
      passX: 118,
      passY,
      dropX: 286,
      dropY: passY,
      gate: isGate ? { x1: 28, y1: passY, x2: 196, y2: passY } : null,
      inbox: isEnd ? { x: 82, y: passY - 28, width: 72, height: 56 } : null,
    };
  });
  return { width, height, stages };
}

function liveCards(steps: FunnelStep[]): LiveCard[] {
  const largest = Math.max(...steps.map((step) => step.out), 1);
  const cards: LiveCard[] = [];
  steps.forEach((step, gate) => {
    const count = Math.max(3, Math.min(9, Math.round(3 + (step.out / largest) * 6)));
    for (let index = 0; index < count; index += 1) {
      cards.push({
        gate,
        stagger: count === 1 ? 0.5 : index / (count - 1),
        side: (index % 2 === 0 ? -1 : 1) * (0.55 + (index % 3) * 0.18),
        hero: false,
      });
    }
  });
  cards.push({ gate: steps.length, stagger: 0, side: 0, hero: true });
  return cards;
}

function gateWindows(count: number) {
  const pour = 0.08;
  const inboxShare = 0.14;
  const slice = (1 - pour - inboxShare) / count;
  return Array.from({ length: count }, (_, index) => {
    const start = pour + index * slice;
    return [start, start + slice] as const;
  });
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function easeOut(value: number) {
  const t = clamp01(value);
  return 1 - (1 - t) * (1 - t);
}

function pointAlong(
  scene: Scene,
  from: number,
  to: number,
  progress: number,
  side: number,
  vertical: boolean,
) {
  const segments = Math.max(1, to - from);
  const scaled = clamp01(progress) * segments;
  const index = Math.min(segments - 1, Math.floor(scaled));
  const local = scaled - index;
  const start = scene.stages[from + index];
  const end = scene.stages[from + index + 1];
  const wobble = Math.sin(local * Math.PI) * side * 8;
  return {
    x: start.passX + (end.passX - start.passX) * local + (vertical ? wobble : 0),
    y: start.passY + (end.passY - start.passY) * local + (vertical ? 0 : wobble * 0.25),
  };
}

function cardPose(card: LiveCard, t: number, scene: Scene, windows: readonly (readonly [number, number])[]) {
  const vertical = scene.height > scene.width;
  const last = scene.stages.length - 1;
  if (card.hero) {
    const travelEnd = windows.length > 0 ? windows[windows.length - 1][1] : 0.86;
    if (t < 0.02) {
      return { x: scene.stages[0].passX, y: scene.stages[0].passY, opacity: 0, tilt: 0 };
    }
    if (t < travelEnd) {
      const point = pointAlong(scene, 0, last, (t - 0.02) / (travelEnd - 0.02), 0, vertical);
      return { ...point, opacity: 1, tilt: 0 };
    }
    const inbox = scene.stages[last];
    const drop = easeOut((t - travelEnd) / (1 - travelEnd));
    return {
      x: inbox.passX,
      y: inbox.passY + drop * 4,
      opacity: 1,
      tilt: 0,
    };
  }

  const [start, end] = windows[card.gate];
  const arrive = start + (end - start) * (0.12 + card.stagger * 0.62);
  const stage = scene.stages[card.gate + 1];
  if (t < arrive * 0.15) {
    return { x: scene.stages[0].passX, y: scene.stages[0].passY, opacity: 0, tilt: 0 };
  }
  if (t < arrive) {
    const point = pointAlong(
      scene,
      0,
      card.gate + 1,
      easeOut((t - arrive * 0.15) / (arrive - arrive * 0.15)),
      card.side,
      vertical,
    );
    return { ...point, opacity: 1, tilt: 0 };
  }
  const fall = easeOut((t - arrive) / Math.max(0.08, end - arrive));
  const distance = 10 + card.stagger * 8;
  return {
    x: stage.passX + (stage.dropX - stage.passX) * fall + card.side * distance * fall,
    y: stage.passY + (stage.dropY - stage.passY) * fall,
    opacity: t < end ? 1 - fall * 0.15 : 0.4,
    tilt: card.side * 10 * fall,
  };
}

function counterAt(t: number, window: readonly [number, number], target: number) {
  if (t <= window[0]) {
    return 0;
  }
  if (t >= window[1]) {
    return target;
  }
  return Math.round(easeOut((t - window[0]) / (window[1] - window[0])) * target);
}

function BlankCard({
  x,
  y,
  opacity = 1,
}: {
  x: number;
  y: number;
  opacity?: number;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={settings.cardWidth}
      height={settings.cardHeight}
      rx={3}
      fill="var(--color-card)"
      stroke="var(--color-ink)"
      strokeWidth={1.5}
      opacity={opacity}
    />
  );
}

function FunnelSvg({
  kind,
  funnel,
  cards,
}: {
  kind: LayoutName;
  funnel: BuildFunnel;
  cards: LiveCard[];
}) {
  const scene = sceneFor(kind, funnel.steps.length + 2);
  const titles = [funnel.start, ...funnel.steps.map((step) => step.label), funnel.end];

  return (
    <svg
      data-layout={kind}
      viewBox={`0 0 ${scene.width} ${scene.height}`}
      className={
        kind === "row"
          ? "hidden h-auto w-full min-[640px]:block"
          : "block h-auto w-full min-[640px]:hidden"
      }
    >
      {scene.stages.map((stage, index) => {
        const isStart = index === 0;
        const isGate = stage.gate !== null;
        const step = isGate ? funnel.steps[index - 1] : null;
        return (
          <g key={`${kind}-${titles[index]}`}>
            <foreignObject
              x={stage.titleX}
              y={stage.titleY}
              width={stage.titleWidth}
              height={40}
            >
              <div
                style={{
                  display: "flex",
                  height: "100%",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  color: "var(--color-ink)",
                  fontFamily: "inherit",
                  fontSize: "14px",
                  lineHeight: 1.2,
                  textAlign: "center",
                }}
              >
                {titles[index]}
              </div>
            </foreignObject>
            {isStart ? (
              <text
                x={stage.detailX}
                y={stage.detailY}
                textAnchor="middle"
                fill="var(--color-muted)"
                fontSize={13}
                fontFamily="inherit"
              >
                {funnel.date}
              </text>
            ) : null}
            {step ? (
              <text
                data-counter={index - 1}
                x={stage.detailX}
                y={stage.detailY}
                textAnchor="middle"
                fill="var(--color-ink)"
                fontSize={16}
                fontFamily="inherit"
              >
                {step.out}
              </text>
            ) : null}
            {stage.gate ? (
              <line
                x1={stage.gate.x1}
                y1={stage.gate.y1}
                x2={stage.gate.x2}
                y2={stage.gate.y2}
                stroke="var(--color-ink)"
                strokeWidth={1.5}
              />
            ) : null}
            {stage.inbox ? (
              <rect
                x={stage.inbox.x}
                y={stage.inbox.y}
                width={stage.inbox.width}
                height={stage.inbox.height}
                rx={8}
                fill="none"
                stroke="var(--color-ink)"
                strokeWidth={1.5}
              />
            ) : null}
            {isStart ? (
              <g data-start-stack="">
                <BlankCard x={stage.passX - 12} y={stage.passY - 8} />
                <BlankCard x={stage.passX - 20} y={stage.passY - 2} />
                <BlankCard x={stage.passX - 28} y={stage.passY + 4} />
              </g>
            ) : null}
            {isGate ? (
              <g data-final-only="">
                <BlankCard x={stage.dropX - 20} y={stage.dropY - 8} opacity={0.4} />
                <BlankCard x={stage.dropX - 4} y={stage.dropY + 4} opacity={0.28} />
              </g>
            ) : null}
            {stage.inbox ? (
              <rect
                data-final-only=""
                x={stage.passX - settings.cardWidth / 2}
                y={stage.passY - settings.cardHeight / 2}
                width={settings.cardWidth}
                height={settings.cardHeight}
                rx={3}
                fill="var(--color-clay)"
                stroke="var(--color-clay-dark)"
                strokeWidth={1.5}
              />
            ) : null}
          </g>
        );
      })}
      {cards.map((card, index) => (
        <g
          key={`${kind}-card-${index}`}
          data-live-card=""
          data-gate={card.gate}
          data-stagger={card.stagger}
          data-side={card.side}
          data-hero={card.hero ? "true" : "false"}
          opacity={0}
        >
          <rect
            width={settings.cardWidth}
            height={settings.cardHeight}
            rx={3}
            fill={card.hero ? "var(--color-clay)" : "var(--color-card)"}
            stroke={card.hero ? "var(--color-clay-dark)" : "var(--color-ink)"}
            strokeWidth={1.5}
          />
        </g>
      ))}
    </svg>
  );
}

export function JobFunnel({ funnel }: { funnel: BuildFunnel }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const cards = liveCards(funnel.steps);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const steps = funnel.steps;
    const windows = gateWindows(steps.length);
    let frame = 0;
    let elapsed = 0;
    let last = 0;
    let visible = false;
    let playing = false;

    const paint = (t: number) => {
      root.querySelectorAll<SVGElement>("[data-start-stack]").forEach((node) => {
        node.style.display = t < 0.12 ? "" : "none";
      });
      steps.forEach((step, index) => {
        const value = String(counterAt(t, windows[index], step.out));
        root.querySelectorAll<SVGTextElement>(`[data-counter="${index}"]`).forEach((node) => {
          node.textContent = value;
        });
      });
      root.querySelectorAll<SVGSVGElement>("svg[data-layout]").forEach((svg) => {
        const kind = svg.dataset.layout === "row" ? "row" : "column";
        const scene = sceneFor(kind, steps.length + 2);
        svg.querySelectorAll<SVGGElement>("[data-live-card]").forEach((node) => {
          const card = {
            gate: Number(node.dataset.gate),
            stagger: Number(node.dataset.stagger),
            side: Number(node.dataset.side),
            hero: node.dataset.hero === "true",
          };
          const pose = cardPose(card, t, scene, windows);
          const halfW = settings.cardWidth / 2;
          const halfH = settings.cardHeight / 2;
          node.setAttribute("opacity", String(pose.opacity));
          node.setAttribute(
            "transform",
            `translate(${pose.x - halfW} ${pose.y - halfH}) rotate(${pose.tilt} ${halfW} ${halfH})`,
          );
        });
      });
    };

    const showStill = () => {
      playing = false;
      root.querySelectorAll<SVGElement>("[data-final-only]").forEach((node) => {
        node.style.display = "";
      });
      root.querySelectorAll<SVGElement>("[data-start-stack]").forEach((node) => {
        node.style.display = "";
      });
      root.querySelectorAll<SVGGElement>("[data-live-card]").forEach((node) => {
        node.setAttribute("opacity", "0");
      });
      steps.forEach((step, index) => {
        root.querySelectorAll<SVGTextElement>(`[data-counter="${index}"]`).forEach((node) => {
          node.textContent = String(step.out);
        });
      });
    };

    const prepare = () => {
      root.querySelectorAll<SVGElement>("[data-final-only]").forEach((node) => {
        node.style.display = "none";
      });
      root.querySelectorAll<SVGGElement>("[data-live-card]").forEach((node) => {
        node.setAttribute("opacity", "0");
      });
      steps.forEach((_, index) => {
        root.querySelectorAll<SVGTextElement>(`[data-counter="${index}"]`).forEach((node) => {
          node.textContent = "0";
        });
      });
    };

    const stop = () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
      frame = 0;
      last = 0;
    };

    const tick = (now: number) => {
      frame = 0;
      if (!visible || motion.matches) {
        return;
      }
      if (!playing) {
        playing = true;
        elapsed = 0;
      }
      if (last === 0) {
        last = now;
      }
      elapsed += Math.min(40, now - last);
      last = now;
      const cycle = settings.playMs + settings.holdMs;
      const local = elapsed % cycle;
      paint(local < settings.playMs ? local / settings.playMs : 1);
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (!frame && !motion.matches) {
        frame = requestAnimationFrame(tick);
      }
    };

    if (motion.matches) {
      showStill();
      return;
    }

    prepare();
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) {
          start();
        } else {
          stop();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(root);
    const onMotion = () => {
      if (motion.matches) {
        stop();
        showStill();
      }
    };
    motion.addEventListener("change", onMotion);

    return () => {
      stop();
      observer.disconnect();
      motion.removeEventListener("change", onMotion);
    };
  }, [funnel]);

  return (
    <div className="mt-8">
      <p className="sr-only">{description}</p>
      <div
        ref={rootRef}
        aria-hidden="true"
        className="overflow-hidden rounded-2xl border border-line bg-paper"
      >
        <FunnelSvg kind="column" funnel={funnel} cards={cards} />
        <FunnelSvg kind="row" funnel={funnel} cards={cards} />
      </div>
    </div>
  );
}
