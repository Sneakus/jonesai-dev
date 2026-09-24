"use client";

import { geoContains, geoOrthographic, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { useEffect, useRef, useState } from "react";
import { feature, type GeometryCollection } from "topojson-client";

const paper = [243, 239, 230];
const ink = "#161514";
const missingFill = "#e4ddd0";
const ukId = "826";

type PickRow = {
  iso: string;
  topPick: string;
  topVotes: number;
  totalVotes: number;
};

type PicksFile = {
  teamColors: Record<string, string>;
  countries: PickRow[];
};

type Atlas = {
  objects: {
    countries: GeometryCollection<{ name: string }>;
  };
};

type NationFeature = {
  type: "Feature";
  properties: { iso2: string; name: string };
  geometry: GeoPermissibleObjects;
};

type Land = {
  iso: string;
  name: string;
  shape: GeoPermissibleObjects;
};

type Label = {
  name: string;
  team: string;
  topVotes: number;
  totalVotes: number;
  x: number;
  y: number;
};

function soften(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  const mixed = channels.map((channel, index) =>
    Math.round(channel * 0.7 + paper[index] * 0.3),
  );
  return `rgb(${mixed.join(",")})`;
}

function countryName(iso: string, fallback: string) {
  if (fallback) {
    return fallback;
  }
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  return names.of(iso) || iso;
}

export function WorldcupGlobe({ caption }: { caption: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState<Label | null>(null);
  const labelRef = useRef<Label | null>(null);

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
    let cancelled = false;
    let frame = 0;
    let visible = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const rotation = { lambda: -20, phi: -15 };
    const spin = reduced.matches ? 0 : 0.008;
    let nudge = 0;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let lastTime = 0;
    let moved = 0;
    let lands: Land[] = [];
    let picks = new Map<string, PickRow>();
    let fills = new Map<string, string>();

    const projection = geoOrthographic().clipAngle(90);
    const drawPath = geoPath(projection, context);

    const resize = () => {
      const size = Math.max(1, Math.round(wrap.clientWidth));
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(size * ratio);
      canvas.height = Math.round(size * ratio);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      projection.translate([size / 2, size / 2]).scale(size * 0.46);
    };

    const paint = () => {
      const size = wrap.clientWidth;
      context.clearRect(0, 0, size, size);
      projection.rotate([rotation.lambda, rotation.phi, 0]);
      context.beginPath();
      drawPath({ type: "Sphere" });
      context.fillStyle = `rgb(${paper.join(",")})`;
      context.fill();
      for (const land of lands) {
        context.beginPath();
        drawPath(land.shape);
        context.fillStyle = fills.get(land.iso) || missingFill;
        context.fill();
      }
      context.beginPath();
      for (const land of lands) {
        drawPath(land.shape);
      }
      context.strokeStyle = ink;
      context.lineWidth = 0.6;
      context.stroke();
      context.beginPath();
      drawPath({ type: "Sphere" });
      context.strokeStyle = "rgba(22, 21, 20, 0.35)";
      context.lineWidth = 1.25;
      context.stroke();
    };

    const hit = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      const localX = event.clientX - bounds.left;
      const localY = event.clientY - bounds.top;
      const point = projection.invert?.([localX, localY]);
      if (!point) {
        return null;
      }
      const land = lands.find((item) => geoContains(item.shape, point));
      if (!land) {
        return null;
      }
      const row = picks.get(land.iso);
      if (!row) {
        return null;
      }
      return {
        name: land.name,
        team: row.topPick,
        topVotes: row.topVotes,
        totalVotes: row.totalVotes,
        x: Math.min(localX + 12, bounds.width - 188),
        y: Math.max(8, localY - 72),
      };
    };

    const tick = (now: number) => {
      frame = 0;
      if (!visible) {
        return;
      }
      if (!dragging) {
        const step = lastTime ? Math.min(40, now - lastTime) : 16;
        rotation.lambda += (spin + nudge) * step;
        nudge *= Math.exp(-step / 260);
      }
      lastTime = now;
      paint();
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (!frame && visible) {
        lastTime = 0;
        frame = requestAnimationFrame(tick);
      }
    };

    const stop = () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
      frame = 0;
    };

    const onDown = (event: PointerEvent) => {
      dragging = true;
      moved = 0;
      lastX = event.clientX;
      lastY = event.clientY;
      lastTime = performance.now();
      canvas.setPointerCapture(event.pointerId);
    };

    const onMove = (event: PointerEvent) => {
      if (!dragging) {
        if (event.pointerType === "mouse") {
          const next = hit(event);
          if (next?.name !== labelRef.current?.name || next?.x !== labelRef.current?.x) {
            labelRef.current = next;
            setLabel(next);
          }
        }
        return;
      }
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      const touch = event.pointerType === "touch";
      if (touch && Math.abs(dy) > Math.abs(dx)) {
        return;
      }
      rotation.lambda += dx * 0.45;
      if (!touch) {
        rotation.phi = Math.max(-70, Math.min(70, rotation.phi - dy * 0.35));
      }
      const now = performance.now();
      const step = Math.max(1, now - lastTime);
      nudge = (dx * 0.45) / step;
      lastTime = now;
    };

    const onUp = (event: PointerEvent) => {
      const wasDrag = moved > 6;
      dragging = false;
      if (!wasDrag && event.pointerType !== "mouse") {
        const next = hit(event);
        labelRef.current = next;
        setLabel(next);
      }
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
      { threshold: 0.05 },
    );

    const boot = async () => {
      const [picksFile, atlas, nations, ids] = await Promise.all([
        import("@/data/worldcup-picks.json").then((mod) => mod.default as PicksFile),
        fetch("/globe/countries-110m.json").then((response) => response.json() as Promise<Atlas>),
        fetch("/globe/uk-nations.geojson").then(
          (response) => response.json() as Promise<{ features: NationFeature[] }>,
        ),
        fetch("/globe/country-ids.json").then(
          (response) => response.json() as Promise<Record<string, string>>,
        ),
      ]);
      if (cancelled) {
        return;
      }
      const data = picksFile;
      picks = new Map(data.countries.map((row) => [row.iso, row]));
      fills = new Map(
        data.countries.map((row) => [row.iso, soften(data.teamColors[row.topPick])]),
      );
      const countries = feature(atlas as never, atlas.objects.countries);
      const shapes = countries.features
        .filter((item: { id?: string | number }) => String(item.id ?? "") !== ukId)
        .map((item: { id?: string | number }) => {
          const iso = ids[String(item.id ?? "")] || "";
          return {
            iso,
            name: countryName(iso, ""),
            shape: item as GeoPermissibleObjects,
          };
        });
      const homeNations = nations.features.map((item) => ({
        iso: item.properties.iso2,
        name: item.properties.name,
        shape: item.geometry,
      }));
      lands = [...shapes, ...homeNations];
      resize();
      observer.observe(wrap);
      start();
    };

    void boot();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    return () => {
      cancelled = true;
      stop();
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div className="mx-auto mt-8 w-[86%] min-[900px]:w-full">
      <div ref={wrapRef} className="relative aspect-square w-full">
        <canvas
          ref={canvasRef}
          className="block h-full w-full"
          style={{ touchAction: "pan-y" }}
          aria-hidden="true"
        />
        {label ? (
          <div
            className="pointer-events-none absolute z-10 max-w-[220px] rounded-lg border border-line bg-card px-3 py-2 text-sm leading-snug text-ink"
            style={{ left: label.x, top: label.y }}
          >
            <p className="font-semibold">{label.name}</p>
            <p>{label.team} was the favourite</p>
            <p>
              {label.topVotes} of {label.totalVotes} picks
            </p>
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-center text-sm text-muted">{caption}</p>
    </div>
  );
}
