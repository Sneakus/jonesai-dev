"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fly, type FlightInput, type FlightPoint, type FlightResult } from "@/src/games/golf/flight";
import { labCopy, presets } from "@/src/games/golf/lab";
import { curveYards, shotKey } from "@/src/games/golf/outcomes";

export type OutcomeText = {
  name: string;
  line: string;
};

type Props = {
  outcomes: { [key: string]: OutcomeText };
};

const start: FlightInput = presets[0].input;

function signed(value: number, unit: string, negative: string, positive: string): string {
  const side = value < -0.05 ? negative : value > 0.05 ? positive : "";
  const amount = `${Math.abs(value).toFixed(1)} ${unit}`;
  return side ? `${amount} ${side}` : amount;
}

function paint(canvas: HTMLCanvasElement, points: FlightPoint[], mode: "top" | "side") {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  const style = getComputedStyle(document.documentElement);
  const ink = style.getPropertyValue("--color-ink").trim();
  const clay = style.getPropertyValue("--color-clay").trim();
  const line = style.getPropertyValue("--color-line").trim();
  const field = style.getPropertyValue("--color-field").trim();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = field;
  ctx.fillRect(0, 0, rect.width, rect.height);

  let maxX = 40;
  let maxSide = 10;
  for (const point of points) {
    maxX = Math.max(maxX, point.x);
    maxSide = Math.max(maxSide, mode === "top" ? Math.abs(point.y) : point.z);
  }
  const pad = 16;
  const width = rect.width - pad * 2;
  const height = rect.height - pad * 2;
  const xOf = (x: number) => pad + (x / maxX) * width;
  const yOf = (value: number) => {
    if (mode === "top") {
      return pad + height / 2 - (value / (maxSide * 2)) * height;
    }
    return pad + height - (value / maxSide) * height;
  };

  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, mode === "top" ? pad + height / 2 : pad + height);
  ctx.lineTo(pad + width, mode === "top" ? pad + height / 2 : pad + height);
  ctx.stroke();

  ctx.strokeStyle = clay;
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((point, index) => {
    const px = xOf(point.x);
    const py = yOf(mode === "top" ? point.y : point.z);
    if (index === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  });
  ctx.stroke();

  const last = points[points.length - 1];
  if (last) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(xOf(last.x), yOf(mode === "top" ? last.y : last.z), 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function View({ label, points, mode }: { label: string; points: FlightPoint[]; mode: "top" | "side" }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) {
      return;
    }
    paint(canvas, points, mode);
  }, [points, mode]);
  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 text-sm text-muted">{label}</figcaption>
      <canvas ref={ref} className="h-44 w-full rounded-md border border-line bg-field" />
    </figure>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  left,
  right,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  left?: string;
  right?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="text-muted">{value.toFixed(step < 1 ? 2 : 0)}</span>
      </span>
      <input
        className="mt-2 w-full accent-clay"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {left && right ? (
        <span className="mt-1 flex justify-between text-xs text-muted">
          <span>{left}</span>
          <span>{right}</span>
        </span>
      ) : null}
    </label>
  );
}

export function GolfLab({ outcomes }: Props) {
  const [input, setInput] = useState<FlightInput>(start);
  const shot: FlightResult = useMemo(() => fly(input), [input]);
  const key = shotKey({
    strikeOffset: input.strikeOffset,
    strikeHeight: input.strikeHeight,
    startDirection: shot.startDirection,
    curve: curveYards(shot.offline, shot.total, shot.startDirection),
  });
  const outcome = outcomes[key] ?? { name: key, line: "" };
  const set = (patch: Partial<FlightInput>) => setInput((current) => ({ ...current, ...patch }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{labCopy.title}</h1>
      <p className="mt-2 text-sm text-muted">{labCopy.intro}</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className="rounded-full border border-line bg-card px-3 py-2 text-sm"
            onClick={() => setInput(preset.input)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-5">
        <Slider
          label={labCopy.clubSpeed}
          value={input.clubSpeed}
          min={60}
          max={130}
          step={1}
          onChange={(clubSpeed) => set({ clubSpeed })}
        />
        <Slider
          label={labCopy.face}
          value={input.face}
          min={-15}
          max={15}
          step={0.5}
          left={labCopy.left}
          right={labCopy.right}
          onChange={(face) => set({ face })}
        />
        <Slider
          label={labCopy.path}
          value={input.path}
          min={-15}
          max={15}
          step={0.5}
          left={labCopy.left}
          right={labCopy.right}
          onChange={(path) => set({ path })}
        />
        <Slider
          label={labCopy.strikeOffset}
          value={input.strikeOffset}
          min={-1.2}
          max={1.2}
          step={0.05}
          left={labCopy.heel}
          right={labCopy.toe}
          onChange={(strikeOffset) => set({ strikeOffset })}
        />
        <Slider
          label={labCopy.strikeHeight}
          value={input.strikeHeight}
          min={-1.2}
          max={1.2}
          step={0.05}
          left={labCopy.low}
          right={labCopy.high}
          onChange={(strikeHeight) => set({ strikeHeight })}
        />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <View label={labCopy.topDown} points={shot.trajectory} mode="top" />
        <View label={labCopy.side} points={shot.trajectory} mode="side" />
      </div>

      <section className="mt-8 rounded-md border border-line bg-card p-4">
        <h2 className="text-xl font-semibold">{outcome.name}</h2>
        {outcome.line ? <p className="mt-2 text-sm text-muted">{outcome.line}</p> : null}
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-muted">{labCopy.ballSpeed}</dt>
            <dd>{shot.ballSpeed.toFixed(0)} {labCopy.mph}</dd>
          </div>
          <div>
            <dt className="text-muted">{labCopy.launch}</dt>
            <dd>{shot.launchAngle.toFixed(1)} {labCopy.degrees}</dd>
          </div>
          <div>
            <dt className="text-muted">{labCopy.spin}</dt>
            <dd>{shot.spinRate.toFixed(0)} {labCopy.rpm}</dd>
          </div>
          <div>
            <dt className="text-muted">{labCopy.spinAxis}</dt>
            <dd>{signed(shot.spinAxis, labCopy.degrees, labCopy.left, labCopy.right)}</dd>
          </div>
          <div>
            <dt className="text-muted">{labCopy.start}</dt>
            <dd>{signed(shot.startDirection, labCopy.degrees, labCopy.left, labCopy.right)}</dd>
          </div>
          <div>
            <dt className="text-muted">{labCopy.carry}</dt>
            <dd>{shot.carry.toFixed(0)} {labCopy.yards}</dd>
          </div>
          <div>
            <dt className="text-muted">{labCopy.total}</dt>
            <dd>{shot.total.toFixed(0)} {labCopy.yards}</dd>
          </div>
          <div>
            <dt className="text-muted">{labCopy.offline}</dt>
            <dd>{signed(shot.offline, labCopy.yards, labCopy.left, labCopy.right)}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
