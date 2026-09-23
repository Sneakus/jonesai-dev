"use client";

import { useEffect, useRef, useState } from "react";
import type { ContactContent } from "@/lib/content";

type Shard = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  size: number;
};

const clayWidth = 72;
const gravity = 1000;
const shardSpeed = 340;

function mailbox() {
  const coded = [114, 127, 118, 107, 83, 121, 124, 125, 118, 96, 114, 122, 61, 119, 118, 101];
  const mask = coded.length + 3;
  let text = "";
  for (const code of coded) {
    text += String.fromCharCode(code ^ mask);
  }
  return text;
}

function readPaint(strip: HTMLElement) {
  const styles = getComputedStyle(strip);
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  return {
    clay: read("--color-clay", "#e8480c"),
    clayDark: read("--color-clay-dark", "#9e2f06"),
  };
}

export function ContactSection({ contact }: { contact: ContactContent }) {
  const stripRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spot = useRef({ x: 0, y: 0, rx: clayWidth / 2 });
  const reducedRef = useRef(false);
  const breakRef = useRef<(() => void) | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  const reveal = () => {
    setAddress((current) => current ?? mailbox());
  };

  useEffect(() => {
    if (address) {
      return;
    }
    const canvas = canvasRef.current;
    const strip = stripRef.current;
    if (!canvas || !strip) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = motion.matches;
    let width = 0;
    let height = 0;
    let frame = 0;
    let last = 0;
    let stopped = false;
    const rx = clayWidth / 2;
    const ry = rx * (24 / 78);
    const clay = { x: 48, y: 70, vx: 24 };
    let shards: Shard[] = [];
    let breaking = false;
    let breakFor = 0;
    const colors = { clay: "#e8480c", clayDark: "#9e2f06" };

    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const paint = readPaint(strip);
      colors.clay = paint.clay;
      colors.clayDark = paint.clayDark;
      if (reducedRef.current) {
        clay.x = width / 2;
        clay.y = height / 2;
      }
    };

    const drawClay = () => {
      const tilt = Math.max(-0.35, Math.min(0.35, Math.atan2(0, clay.vx) * 0.2));
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
    };

    const drawShard = (shard: Shard) => {
      ctx.save();
      ctx.translate(shard.x, shard.y);
      ctx.rotate(shard.angle);
      ctx.fillStyle = colors.clay;
      ctx.beginPath();
      ctx.moveTo(shard.size, 0);
      ctx.lineTo(-shard.size * 0.45, shard.size * 0.55);
      ctx.lineTo(-shard.size * 0.15, -shard.size * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const shatter = () => {
      if (breaking) {
        return;
      }
      if (reducedRef.current) {
        setAddress((current) => current ?? mailbox());
        return;
      }
      breaking = true;
      breakFor = 0;
      const count = 8;
      shards = [];
      for (let index = 0; index < count; index += 1) {
        const angle = (Math.PI * 2 * index) / count + Math.random() * 0.4;
        const speed = shardSpeed * (0.45 + Math.random() * 0.7);
        shards.push({
          x: clay.x,
          y: clay.y,
          vx: Math.cos(angle) * speed + clay.vx * 0.15,
          vy: Math.sin(angle) * speed * 0.75 - 40,
          angle: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 14,
          size: (4 + Math.random() * 5) * (rx / 25.5),
        });
      }
    };

    breakRef.current = shatter;

    const tick = (now: number) => {
      if (stopped) {
        return;
      }
      frame = window.requestAnimationFrame(tick);
      const dt = Math.min(0.032, last === 0 ? 0.016 : (now - last) / 1000);
      last = now;

      if (reducedRef.current) {
        clay.x = width / 2;
        clay.y = height / 2;
        clay.vx = 0;
      } else if (!breaking) {
        clay.x += clay.vx * dt;
        clay.y = height / 2 + Math.sin(now / 900) * 6;
        if (clay.x > width + rx) {
          clay.x = -rx;
        }
      } else {
        breakFor += dt;
        for (const shard of shards) {
          shard.vy += gravity * dt;
          shard.x += shard.vx * dt;
          shard.y += shard.vy * dt;
          shard.angle += shard.spin * dt;
        }
        const gone = shards.every((shard) => shard.y > height + 40);
        if (breakFor > 0.85 || gone) {
          setAddress((current) => current ?? mailbox());
          return;
        }
      }

      spot.current = { x: clay.x, y: clay.y, rx };
      ctx.clearRect(0, 0, width, height);
      if (!breaking) {
        drawClay();
      }
      for (const shard of shards) {
        drawShard(shard);
      }
    };

    const onMotion = () => {
      reducedRef.current = motion.matches;
      if (reducedRef.current) {
        shards = [];
        breaking = false;
        fit();
      }
    };

    const observer = new ResizeObserver(() => {
      fit();
    });

    fit();
    observer.observe(strip);
    motion.addEventListener("change", onMotion);
    frame = window.requestAnimationFrame(tick);

    return () => {
      stopped = true;
      breakRef.current = null;
      observer.disconnect();
      motion.removeEventListener("change", onMotion);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [address]);

  const onStripClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (address) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hit = spot.current;
    const dx = x - hit.x;
    const dy = y - hit.y;
    const reach = hit.rx * 2;
    if (dx * dx + dy * dy > reach * reach) {
      return;
    }
    breakRef.current?.();
  };

  const copy = () => {
    if (!address || !navigator.clipboard) {
      return;
    }
    void navigator.clipboard.writeText(address);
  };

  return (
    <section className="border-t border-line pt-8 pb-16">
      <h2 className="text-[22px] font-semibold tracking-[-0.035em]">{contact.heading}</h2>
      <p className="mt-4 text-base text-muted">{contact.intro}</p>
      <div className="mt-6 flex max-w-full flex-wrap items-center gap-3">
        <div
          ref={stripRef}
          className="relative h-[140px] min-w-0 flex-1 basis-[12rem] overflow-hidden rounded-2xl bg-field"
        >
          {address ? (
            <div className="flex h-full flex-wrap items-center justify-center gap-3 px-4">
              <a href={`mailto:${address}`} className="text-base break-all underline underline-offset-4">
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
          ) : (
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full"
              style={{ touchAction: "pan-y" }}
              aria-hidden="true"
              onClick={onStripClick}
            />
          )}
        </div>
        <button
          type="button"
          onClick={reveal}
          className="shrink-0 rounded-full border border-line bg-card px-5 py-2.5 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {contact.showLabel}
        </button>
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
