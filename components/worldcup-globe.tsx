"use client";

import { geoContains, geoOrthographic, geoPath, type GeoPermissibleObjects } from "d3-geo";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { feature, type GeometryCollection } from "topojson-client";
import picksFile from "@/data/worldcup-picks.json";
import nationsFile from "@/data/uk-nations.json";
import dotsFile from "@/data/worldcup-dots.json";
import atlasFile from "@/public/globe/countries-110m.json";
import idsFile from "@/public/globe/country-ids.json";

const paper = [243, 239, 230];
const ink = "#161514";
const missingFill = "#e4ddd0";
const ukId = "826";
const minZoom = 1;
const maxZoom = 4;

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
  geometry: GeoPermissibleObjects & { coordinates?: unknown };
};

type Land = {
  iso: string;
  name: string;
  shape: GeoPermissibleObjects;
  box: [number, number, number, number];
  row: PickRow | null;
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
  if (!/^[A-Z]{2}$/.test(iso)) {
    return fallback || iso;
  }
  try {
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    return names.of(iso) || fallback || iso;
  } catch {
    return fallback || iso;
  }
}

function boundsOf(geometry: { coordinates?: unknown }) {
  let minLon = 180;
  let minLat = 90;
  let maxLon = -180;
  let maxLat = -90;
  const walk = (value: unknown) => {
    if (!Array.isArray(value)) {
      return;
    }
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      minLon = Math.min(minLon, value[0]);
      maxLon = Math.max(maxLon, value[0]);
      minLat = Math.min(minLat, value[1]);
      maxLat = Math.max(maxLat, value[1]);
      return;
    }
    value.forEach(walk);
  };
  walk(geometry.coordinates);
  return [minLon, minLat, maxLon, maxLat] as [number, number, number, number];
}

export function WorldcupGlobe({
  caption,
  fallback,
}: {
  caption: string;
  fallback: { src: string; alt: string; width: number; height: number };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLParagraphElement>(null);
  const teamRef = useRef<HTMLParagraphElement>(null);
  const countRef = useRef<HTMLParagraphElement>(null);
  const zoomRef = useRef<(factor: number, absolute?: boolean) => void>(() => {});
  const [showFallback, setShowFallback] = useState(false);
  const drawnRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const dotsCanvas = dotsRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !dotsCanvas || !wrap) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    let frame = 0;
    let visible = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const view = { lambda: -20, phi: -15, zoom: 1 };
    const spin = reduced.matches ? 0 : 0.008;
    let nudge = 0;
    let dragging = false;
    let hovering = false;
    let resumeTimer = 0;
    let lastX = 0;
    let lastY = 0;
    let lastTime = 0;
    let moved = 0;
    let dirty = true;
    let hoverX = -1;
    let hoverY = -1;
    let hoverQueued = false;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchDistance = 0;
    let lands: Land[] = [];
    const dots = (dotsFile as [number, number, number][]).map((dot) => {
      const lambda = (dot[0] * Math.PI) / 180;
      const phi = (dot[1] * Math.PI) / 180;
      return {
        lon: dot[0],
        lat: dot[1],
        warm: dot[2] === 0,
        sin: Math.sin(phi),
        cos: Math.cos(phi),
        lambda,
      };
    });
    const positions = new Float32Array(dots.length * 2);
    const colors = new Float32Array(dots.length * 3);
    const warm = [0.72, 0.48, 0.28];
    const gl = dotsCanvas.getContext("webgl", { alpha: true, premultipliedAlpha: false });
    const compile = (type: number, source: string) => {
      if (!gl) {
        return null;
      }
      const shader = gl.createShader(type);
      if (!shader) {
        return null;
      }
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };
    const program = gl?.createProgram() || null;
    const vertex = compile(
      gl?.VERTEX_SHADER || 0,
      `attribute vec2 aPos; attribute vec3 aCol; uniform float uW; uniform float uH; uniform float uSize; varying vec3 vCol;
       void main() { float x = (aPos.x / uW) * 2.0 - 1.0; float y = 1.0 - (aPos.y / uH) * 2.0; gl_Position = vec4(x, y, 0.0, 1.0); gl_PointSize = uSize; vCol = aCol; }`,
    );
    const fragment = compile(
      gl?.FRAGMENT_SHADER || 0,
      `precision mediump float; varying vec3 vCol; uniform float uStrength;
       void main() { float d = length(gl_PointCoord - vec2(0.5)); if (d > 0.5) discard; float core = smoothstep(0.18, 0.0, d); float halo = smoothstep(0.5, 0.05, d); vec3 color = mix(vCol, vec3(1.0), core * 0.85); float alpha = (halo * 0.55 + core * 0.45) * uStrength; gl_FragColor = vec4(color, alpha); }`,
    );
    let posBuffer: WebGLBuffer | null = null;
    let colBuffer: WebGLBuffer | null = null;
    let posLoc = -1;
    let colLoc = -1;
    let widthLoc: WebGLUniformLocation | null = null;
    let heightLoc: WebGLUniformLocation | null = null;
    let sizeLoc: WebGLUniformLocation | null = null;
    let strengthLoc: WebGLUniformLocation | null = null;
    if (gl && program && vertex && fragment) {
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.useProgram(program);
      posBuffer = gl.createBuffer();
      colBuffer = gl.createBuffer();
      posLoc = gl.getAttribLocation(program, "aPos");
      colLoc = gl.getAttribLocation(program, "aCol");
      widthLoc = gl.getUniformLocation(program, "uW");
      heightLoc = gl.getUniformLocation(program, "uH");
      sizeLoc = gl.getUniformLocation(program, "uSize");
      strengthLoc = gl.getUniformLocation(program, "uStrength");
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    }
    let fills = new Map<string, string>();
    const nameCache = new Map<string, string>();

    const projection = geoOrthographic().clipAngle(90);
    const drawPath = geoPath(projection, context);
    let drawnSize = 0;

    const resize = () => {
      const size = Math.round(wrap.clientWidth);
      if (size < 2) {
        return false;
      }
      projection.translate([size / 2, size / 2]).scale(size * 0.46 * view.zoom);
      if (size === drawnSize) {
        return true;
      }
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(size * ratio);
      canvas.height = Math.round(size * ratio);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      dotsCanvas.width = canvas.width;
      dotsCanvas.height = canvas.height;
      dotsCanvas.style.width = `${size}px`;
      dotsCanvas.style.height = `${size}px`;
      if (gl) {
        gl.viewport(0, 0, dotsCanvas.width, dotsCanvas.height);
      }
      drawnSize = size;
      return true;
    };

    const paint = () => {
      if (!resize()) {
        return;
      }
      const size = wrap.clientWidth;
      projection.rotate([view.lambda, view.phi, 0]);
      context.clearRect(0, 0, size, size);
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
      context.lineWidth = 0.7;
      context.stroke();
      if (gl && posBuffer && colBuffer) {
        const radians = Math.PI / 180;
        const centreLambda = -view.lambda * radians;
        const centrePhi = -view.phi * radians;
        const sinCentre = Math.sin(centrePhi);
        const cosCentre = Math.cos(centrePhi);
        let count = 0;
        for (const dot of dots) {
          const facing =
            sinCentre * dot.sin +
            cosCentre * dot.cos * Math.cos(dot.lambda - centreLambda);
          if (facing <= 0) {
            continue;
          }
          const point = projection([dot.lon, dot.lat]);
          if (!point) {
            continue;
          }
          positions[count * 2] = point[0];
          positions[count * 2 + 1] = point[1];
          const color = dot.warm ? warm : [1, 1, 1];
          colors[count * 3] = color[0];
          colors[count * 3 + 1] = color[1];
          colors[count * 3 + 2] = color[2];
          count += 1;
        }
        gl.useProgram(program);
        gl.viewport(0, 0, dotsCanvas.width, dotsCanvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions.subarray(0, count * 2), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, colBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, colors.subarray(0, count * 3), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(colLoc);
        gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, 0, 0);
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        const pointSize = (2.6 + (view.zoom - 1) * 1.3) * ratio;
        gl.uniform1f(widthLoc, size);
        gl.uniform1f(heightLoc, size);
        gl.uniform1f(sizeLoc, pointSize);
        gl.uniform1f(strengthLoc, 0.28);
        gl.drawArrays(gl.POINTS, 0, count);
      }
      context.beginPath();
      drawPath({ type: "Sphere" });
      context.strokeStyle = "rgba(22, 21, 20, 0.35)";
      context.lineWidth = 1.25;
      context.stroke();
      drawnRef.current = true;
    };

    const showLabel = (land: Land | null, x: number, y: number) => {
      const box = labelRef.current;
      if (!box || !nameRef.current || !teamRef.current || !countRef.current) {
        return;
      }
      if (!land?.row) {
        box.hidden = true;
        return;
      }
      nameRef.current.textContent = land.name;
      teamRef.current.textContent = `${land.row.topPick} was the favourite`;
      countRef.current.textContent = `${land.row.topVotes} of ${land.row.totalVotes} picks`;
      box.hidden = false;
      box.style.left = `${Math.min(x + 12, wrap.clientWidth - 188)}px`;
      box.style.top = `${Math.max(8, y - 72)}px`;
    };

    const landAt = (x: number, y: number) => {
      const point = projection.invert?.([x, y]);
      if (!point) {
        return null;
      }
      const [lon, lat] = point;
      for (const land of lands) {
        const [minLon, minLat, maxLon, maxLat] = land.box;
        if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) {
          continue;
        }
        if (land.row && geoContains(land.shape, point)) {
          return land;
        }
      }
      return null;
    };

    const moving = () =>
      dragging ||
      pointers.size > 1 ||
      Math.abs(nudge) > 0.0002 ||
      (spin > 0 && !hovering && visible);

    const kick = () => {
      if (!frame && visible) {
        lastTime = 0;
        frame = requestAnimationFrame(tick);
      }
    };

    const tick = (now: number) => {
      frame = 0;
      if (!visible) {
        return;
      }
      const step = lastTime ? Math.min(40, now - lastTime) : 16;
      lastTime = now;
      if (!dragging && !hovering) {
        view.lambda += spin * step;
        view.lambda += nudge * step;
        nudge *= Math.exp(-step / 260);
      }
      if (hoverQueued) {
        hoverQueued = false;
        showLabel(landAt(hoverX, hoverY), hoverX, hoverY);
      }
      if (dirty || moving()) {
        try {
          paint();
        } catch {
          setShowFallback(true);
          return;
        }
        dirty = false;
      }
      if (moving() || hoverQueued) {
        frame = requestAnimationFrame(tick);
      }
    };

    zoomRef.current = (factor: number, absolute = false) => {
      view.zoom = Math.min(maxZoom, Math.max(minZoom, absolute ? factor : view.zoom * factor));
      dirty = true;
      kick();
    };

    const boot = () => {
      try {
        const data = picksFile as PicksFile;
        const atlas = atlasFile as unknown as Atlas;
        const nations = nationsFile as { features: NationFeature[] };
        const ids = idsFile as Record<string, string>;
        const picks = new Map(data.countries.map((row) => [row.iso, row]));
        fills = new Map(
          data.countries.map((row) => [row.iso, soften(data.teamColors[row.topPick])]),
        );
        const countries = feature(atlas as never, atlas.objects.countries);
        const shapes = countries.features
          .filter((item: { id?: string | number }) => String(item.id ?? "") !== ukId)
          .map((item: { id?: string | number; properties?: { name?: string }; geometry?: { coordinates?: unknown } }) => {
            const iso = ids[String(item.id ?? "")] || "";
            const cached = nameCache.get(iso);
            const name = cached || countryName(iso, item.properties?.name || "");
            if (iso) {
              nameCache.set(iso, name);
            }
            return {
              iso,
              name,
              shape: item as GeoPermissibleObjects,
              box: boundsOf(item.geometry || { coordinates: undefined }),
              row: picks.get(iso) || null,
            };
          });
        const homeNations = nations.features.map((item) => ({
          iso: item.properties.iso2,
          name: item.properties.name,
          shape: item.geometry,
          box: boundsOf(item.geometry),
          row: picks.get(item.properties.iso2) || null,
        }));
        lands = [...shapes, ...homeNations];
        dirty = true;
        kick();
      } catch {
        setShowFallback(true);
      }
    };

    const giveUp = window.setTimeout(() => {
      if (!drawnRef.current) {
        setShowFallback(true);
      }
    }, 3000);

    const onDown = (event: PointerEvent) => {
      if ((event.target as HTMLElement).closest("button")) {
        return;
      }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2) {
        const [first, second] = [...pointers.values()];
        pinchDistance = Math.hypot(first.x - second.x, first.y - second.y);
        dragging = false;
        return;
      }
      dragging = true;
      moved = 0;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
      kick();
    };

    const onMove = (event: PointerEvent) => {
      if (pointers.has(event.pointerId)) {
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }
      if (pointers.size === 2) {
        const [first, second] = [...pointers.values()];
        const distance = Math.hypot(first.x - second.x, first.y - second.y);
        if (pinchDistance > 0) {
          zoomRef.current(distance / pinchDistance);
        }
        pinchDistance = distance;
        return;
      }
      const bounds = canvas.getBoundingClientRect();
      hoverX = event.clientX - bounds.left;
      hoverY = event.clientY - bounds.top;
      if (!dragging) {
        hoverQueued = event.pointerType === "mouse";
        kick();
        return;
      }
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (event.pointerType === "touch" && Math.abs(dy) > Math.abs(dx)) {
        return;
      }
      view.lambda += dx * 0.45;
      if (event.pointerType !== "touch") {
        view.phi = Math.max(-70, Math.min(70, view.phi - dy * 0.35));
      }
      const now = performance.now();
      nudge = (dx * 0.45) / Math.max(1, now - lastTime);
      lastTime = now;
      dirty = true;
      kick();
    };

    const onUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      pinchDistance = 0;
      const wasDrag = moved > 6;
      dragging = false;
      if (!wasDrag && event.pointerType !== "mouse") {
        const bounds = canvas.getBoundingClientRect();
        const x = event.clientX - bounds.left;
        const y = event.clientY - bounds.top;
        showLabel(landAt(x, y), x, y);
      }
      kick();
    };

    const onEnter = () => {
      hovering = true;
      window.clearTimeout(resumeTimer);
    };

    const onLeave = () => {
      hovering = false;
      showLabel(null, 0, 0);
      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => {
        kick();
      }, 1000);
    };

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();
      zoomRef.current(event.deltaY < 0 ? 1.12 : 1 / 1.12);
    };

    const onDouble = () => {
      zoomRef.current(1.5);
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        dirty = true;
        kick();
      } else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    const resizeObserver = new ResizeObserver(() => {
      dirty = true;
      kick();
    });

    boot();
    observer.observe(wrap);
    resizeObserver.observe(wrap);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerenter", onEnter);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("dblclick", onDouble);

    return () => {
      window.clearTimeout(giveUp);
      window.clearTimeout(resumeTimer);
      if (frame) {
        cancelAnimationFrame(frame);
      }
      observer.disconnect();
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerenter", onEnter);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("dblclick", onDouble);
    };
  }, []);

  return (
    <div className="mx-auto mt-8 w-[86%] min-[900px]:w-full">
      <div ref={wrapRef} className="relative aspect-square w-full">
        {showFallback ? (
          <Image
            src={fallback.src}
            alt={fallback.alt}
            width={fallback.width}
            height={fallback.height}
            quality={90}
            unoptimized
            className="h-full w-full rounded-2xl object-cover"
          />
        ) : (
          <>
            <canvas
              ref={canvasRef}
              className="block h-full w-full"
              style={{ touchAction: "pan-y" }}
              aria-hidden="true"
            />
            <canvas
              ref={dotsRef}
              className="pointer-events-none absolute inset-0 h-full w-full"
              aria-hidden="true"
            />
          </>
        )}
        <div className="absolute top-2 right-2 z-20 flex flex-col gap-1">
          <button
            type="button"
            aria-label="Zoom in"
            className="h-8 w-8 rounded-md border border-line bg-card text-ink"
            onClick={() => zoomRef.current(1.35)}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            className="h-8 w-8 rounded-md border border-line bg-card text-ink"
            onClick={() => zoomRef.current(1 / 1.35)}
          >
            -
          </button>
          <button
            type="button"
            aria-label="Reset zoom"
            className="h-8 w-8 rounded-md border border-line bg-card text-xs text-ink"
            onClick={() => zoomRef.current(1, true)}
          >
            1x
          </button>
        </div>
        <div
          ref={labelRef}
          hidden
          className="pointer-events-none absolute z-10 max-w-[220px] rounded-lg border border-line bg-card px-3 py-2 text-sm leading-snug text-ink"
        >
          <p ref={nameRef} className="font-semibold" />
          <p ref={teamRef} />
          <p ref={countRef} />
        </div>
      </div>
      <p className="mt-3 text-center text-sm text-muted">{caption}</p>
    </div>
  );
}
