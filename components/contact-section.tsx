"use client";

import { useEffect, useRef, useState } from "react";
import {
  createShardFlights,
  shardFlightPoint,
  shardFlightsDone,
  type Point,
  type ShardFlight,
} from "@/components/shard-flight";
import type { ContactContent } from "@/lib/content";

export const contactClaySettings = {
  shardCount: 110,
  travelTime: 620,
  stagger: 140,
  easing: "easeInOutCubic" as const,
  pelletCount: 12,
  pelletTime: 120,
  scatterTime: 170,
  fadeTime: 130,
};

type Shard = Point & {
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  size: number;
};

type Pellet = Point & {
  size: number;
};

type Phase = "idle" | "animating" | "revealed";

const clayWidth = 120;
const gravity = 1000;
const shardSpeed = 340;

function mailbox() {
  // Keep the address out of the HTML and downloaded JavaScript as readable text.
  const coded = [
    114, 127, 118, 107, 83, 121, 124, 125, 118, 96, 114, 122, 61, 119, 118,
    101,
  ];
  const mask = coded.length + 3;
  let text = "";
  for (const code of coded) {
    text += String.fromCharCode(code ^ mask);
  }
  return text;
}

function readPaint(element: HTMLElement) {
  const styles = getComputedStyle(element);
  const read = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;
  return {
    clay: read("--color-clay", "#e8480c"),
    clayDark: read("--color-clay-dark", "#9e2f06"),
    ink: read("--color-ink", "#161514"),
    font: styles.fontFamily || "Instrument Sans, sans-serif",
  };
}

function textTargets(
  text: string,
  width: number,
  height: number,
  count: number,
  font: string,
): Point[] {
  const scratch = document.createElement("canvas");
  scratch.width = Math.max(1, Math.round(width));
  scratch.height = Math.max(1, Math.round(height));
  const context = scratch.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return [];
  }

  let fontSize = Math.min(27, Math.max(17, width / 13));
  context.font = `600 ${fontSize}px ${font}`;
  const available = Math.max(120, width - 24);
  const measured = context.measureText(text).width;
  if (measured > available) {
    fontSize *= available / measured;
  }
  context.font = `600 ${fontSize}px ${font}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#000";
  context.fillText(text, width / 2, height / 2);

  const pixels = context.getImageData(0, 0, scratch.width, scratch.height).data;
  const candidates: Point[] = [];
  for (let y = 0; y < scratch.height; y += 2) {
    for (let x = 0; x < scratch.width; x += 2) {
      if (pixels[(y * scratch.width + x) * 4 + 3] > 80) {
        candidates.push({ x, y });
      }
    }
  }
  if (candidates.length === 0) {
    return Array.from({ length: count }, (_, index) => ({
      x: width / 2 + (index - count / 2) * 2,
      y: height / 2,
    }));
  }

  const targets: Point[] = [];
  for (let index = 0; index < count; index += 1) {
    const at = Math.floor((index * candidates.length) / count);
    targets.push(candidates[Math.min(candidates.length - 1, at)]);
  }
  return targets;
}

function makeShards(x: number, y: number): Shard[] {
  const shards: Shard[] = [];
  for (let index = 0; index < contactClaySettings.shardCount; index += 1) {
    const angle =
      (Math.PI * 2 * index) / contactClaySettings.shardCount +
      Math.random() * 0.4;
    const speed = shardSpeed * (0.32 + Math.random() * 0.45);
    shards.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.65 - 35,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 14,
      size: 2.2 + Math.random() * 2.6,
    });
  }
  return shards;
}

function makePellets(x: number, y: number): Pellet[] {
  const pellets: Pellet[] = [];
  for (let index = 0; index < contactClaySettings.pelletCount; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * 24;
    pellets.push({
      x: x + Math.cos(angle) * distance,
      y: y + Math.sin(angle) * distance,
      size: 1.5 + Math.random() * 1.4,
    });
  }
  return pellets;
}

function drawShard(
  context: CanvasRenderingContext2D,
  shard: Shard,
  color: string,
  opacity = 1,
) {
  context.save();
  context.globalAlpha = opacity;
  context.translate(shard.x, shard.y);
  context.rotate(shard.angle);
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(shard.size, 0);
  context.lineTo(-shard.size * 0.45, shard.size * 0.55);
  context.lineTo(-shard.size * 0.15, -shard.size * 0.5);
  context.closePath();
  context.fill();
  context.restore();
}

function drawClay(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  clay: string,
  clayDark: string,
) {
  const rx = clayWidth / 2;
  const ry = rx * (24 / 78);
  context.save();
  context.translate(x, y);
  context.fillStyle = clay;
  context.beginPath();
  context.ellipse(0, ry * 0.16, rx, ry, 0, 0, Math.PI * 2);
  context.fill();
  const scale = rx / 78;
  context.strokeStyle = clayDark;
  context.lineWidth = Math.max(1.5, 3.5 * scale);
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(-72 * scale, 0);
  context.bezierCurveTo(-42 * scale, -30 * scale, 42 * scale, -30 * scale, 72 * scale, 0);
  context.stroke();
  context.restore();
}

export function ContactSection({ contact }: { contact: ContactContent }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const addressRef = useRef<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [address, setAddress] = useState<string | null>(null);
  const [emailVisible, setEmailVisible] = useState(false);

  const reveal = () => {
    const next = addressRef.current ?? mailbox();
    addressRef.current = next;
    setAddress(next);
    setEmailVisible(true);
    setPhase("revealed");
  };

  const activate = () => {
    if (phase !== "idle") {
      return;
    }
    addressRef.current = mailbox();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      reveal();
      return;
    }
    setPhase("animating");
  };

  useEffect(() => {
    if (phase !== "animating") {
      return;
    }
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) {
      reveal();
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      reveal();
      return;
    }

    let width = 0;
    let height = 0;
    let frame = 0;
    let last = 0;
    let startedAt = 0;
    let shards: Shard[] = [];
    let pellets: Pellet[] = [];
    let flights: ShardFlight[] = [];
    let assembledAt = 0;
    let emailShown = false;
    let stopped = false;
    const colors = readPaint(stage);

    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    fit();
    const center = { x: width / 2, y: height / 2 - 8 };
    pellets = makePellets(center.x, center.y);
    shards = makeShards(center.x, center.y);

    const tick = (now: number) => {
      if (stopped) {
        return;
      }
      frame = window.requestAnimationFrame(tick);
      if (startedAt === 0) {
        startedAt = now;
      }
      const dt = Math.min(0.032, last === 0 ? 0.016 : (now - last) / 1000);
      last = now;
      const age = now - startedAt;
      const assembleAt =
        contactClaySettings.pelletTime + contactClaySettings.scatterTime;

      context.clearRect(0, 0, width, height);

      if (age < contactClaySettings.pelletTime) {
        drawClay(
          context,
          center.x,
          center.y,
          colors.clay,
          colors.clayDark,
        );
        const opacity = 1 - age / contactClaySettings.pelletTime;
        context.save();
        context.globalAlpha = opacity;
        context.fillStyle = colors.ink;
        for (const pellet of pellets) {
          context.beginPath();
          context.arc(pellet.x, pellet.y, pellet.size, 0, Math.PI * 2);
          context.fill();
        }
        context.restore();
      }

      if (age >= contactClaySettings.pelletTime && age < assembleAt) {
        for (const shard of shards) {
          shard.vy += gravity * dt;
          shard.x += shard.vx * dt;
          shard.y += shard.vy * dt;
          shard.angle += shard.spin * dt;
          drawShard(context, shard, colors.clay);
        }
      } else if (age >= assembleAt) {
        if (flights.length === 0) {
          const text = addressRef.current ?? mailbox();
          const targets = textTargets(
            text,
            width,
            height,
            contactClaySettings.shardCount,
            colors.font,
          );
          flights = createShardFlights(
            shards.map(({ x, y }) => ({ x, y })),
            targets,
            now,
            contactClaySettings,
          );
        }

        const done = shardFlightsDone(
          flights,
          now,
          contactClaySettings,
        );
        if (done && assembledAt === 0) {
          assembledAt = now;
          const next = addressRef.current ?? mailbox();
          setAddress(next);
          window.requestAnimationFrame(() => setEmailVisible(true));
        }
        const opacity =
          assembledAt === 0
            ? 1
            : Math.max(
                0,
                1 - (now - assembledAt) / contactClaySettings.fadeTime,
              );
        shards.forEach((shard, index) => {
          const point = shardFlightPoint(
            flights[index],
            now,
            contactClaySettings,
          );
          shard.x = point.x;
          shard.y = point.y;
          shard.angle += shard.spin * dt * (done ? 0.08 : 0.35);
          drawShard(context, shard, colors.clay, opacity);
        });

        if (
          assembledAt > 0 &&
          now - assembledAt >= contactClaySettings.fadeTime &&
          !emailShown
        ) {
          emailShown = true;
          setPhase("revealed");
        }
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => {
      stopped = true;
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [phase]);

  const copy = () => {
    if (!address || !navigator.clipboard) {
      return;
    }
    void navigator.clipboard.writeText(address);
  };

  return (
    <section className="border-t border-line pt-8 pb-16">
      <h2 className="text-[22px] font-semibold tracking-[-0.035em]">
        {contact.heading}
      </h2>
      <p className="mt-4 text-base text-muted">{contact.intro}</p>
      <div
        ref={stageRef}
        className="relative mt-6 flex h-[150px] max-w-full items-center justify-center overflow-hidden"
      >
        {phase === "idle" ? (
          <button
            type="button"
            aria-label={contact.emailButtonAria}
            onClick={activate}
            className="flex min-w-0 flex-col items-center gap-2 rounded-2xl px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <svg
              viewBox="0 0 120 48"
              className="h-12 w-[120px] max-w-full"
              aria-hidden="true"
            >
              <ellipse
                cx="60"
                cy="27"
                rx="56"
                ry="17"
                className="fill-clay stroke-clay-dark"
                strokeWidth="2"
              />
              <path
                d="M8 23 C30 2 90 2 112 23"
                className="fill-none stroke-clay-dark"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-sm text-muted">{contact.emailButtonLabel}</span>
          </button>
        ) : null}
        {phase === "animating" ? (
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
          />
        ) : null}
        {address ? (
          <div
            className={`absolute inset-0 flex max-w-full flex-wrap items-center justify-center gap-3 px-2 transition-opacity duration-150 ${
              emailVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            <a
              href={`mailto:${address}`}
              className="max-w-full break-all text-base underline underline-offset-4"
            >
              {address}
            </a>
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded-full border border-line bg-card px-3 py-1 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {contact.copyLabel}
            </button>
          </div>
        ) : null}
      </div>
      <ul className="mt-6 flex max-w-full flex-wrap gap-x-6 gap-y-2">
        <li>
          <a
            href={contact.linkedInUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            {contact.linkedInLabel}
          </a>
        </li>
        <li>
          <a
            href={contact.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            {contact.githubLabel}
          </a>
        </li>
        <li>
          <a href={contact.cvUrl} download className="underline underline-offset-4">
            {contact.cvLabel}
          </a>
        </li>
      </ul>
    </section>
  );
}
