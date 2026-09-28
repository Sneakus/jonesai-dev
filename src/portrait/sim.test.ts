import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { PortraitSim, type PortraitData, type PortraitLayout, type PortraitRect } from "./sim";

const data = JSON.parse(
  fs.readFileSync("public/portrait/portrait.json", "utf8"),
) as PortraitData;

const LEVER_W = 116;
const CRUSHER_W = 86;
const CRUSHER_H = 92;

function layoutFor(
  sim: PortraitSim,
  vw: number,
  vh: number,
  dpr: number,
  tray: PortraitRect,
  portraitWidth: number,
): PortraitLayout {
  const leverLeft = tray.left + tray.width - LEVER_W;
  const crusherLeft = tray.left + tray.width - (LEVER_W + 12) - CRUSHER_W;
  return {
    vw,
    vh,
    scrollX: 0,
    scrollY: 0,
    dpr,
    tray,
    leverLeft,
    crusher: {
      left: crusherLeft,
      top: tray.top + tray.height - 8 - CRUSHER_H,
      width: CRUSHER_W,
      height: CRUSHER_H,
    },
    portrait: { left: 20, top: 40, width: portraitWidth, height: sim.ph },
    looks: [{ left: 24, top: 360, width: 140, height: 18 }],
  };
}

function mount(reduce = false) {
  const sim = new PortraitSim(data, { reduce });
  sim.sizePortrait(350);
  sim.sync(
    layoutFor(
      sim,
      390,
      844,
      2,
      { left: 16, top: 520, width: 358, height: 240 },
      350,
    ),
  );
  return sim;
}

function run(sim: PortraitSim, seconds: number, now = 1000) {
  const steps = Math.ceil(seconds / 0.033);
  for (let i = 0; i < steps; i += 1) {
    now += 33;
    sim.step(0.033, now);
    const pile = sim.pileAudit();
    if (pile.crossed || pile.left > 0) {
      throw new Error(`heap passed the wall ${JSON.stringify(pile)}`);
    }
  }
  return now;
}

function until(
  sim: PortraitSim,
  done: () => boolean,
  seconds: number,
  now = 1000,
) {
  const steps = Math.ceil(seconds / 0.033);
  for (let i = 0; i < steps; i += 1) {
    now += 33;
    sim.step(0.033, now);
    const pile = sim.pileAudit();
    if (pile.crossed || pile.left > 0) {
      throw new Error(`heap passed the wall ${JSON.stringify(pile)}`);
    }
    if (done()) {
      return now;
    }
  }
  throw new Error("timed out");
}

function smashClays(sim: PortraitSim, count: number, x = 120, y = 700) {
  for (let i = 0; i < count; i += 1) {
    sim.smash(x, y);
  }
}

function pullAndBuild(sim: PortraitSim, now: number) {
  now = until(sim, () => !sim.latched && sim.isFull(), 8, now);
  sim.leverKey();
  now = until(sim, () => sim.latched, 3, now);
  return until(
    sim,
    () =>
      sim.flightsLength() === 0 &&
      sim.faceAudit().missing === 0 &&
      sim.pileAudit().pieces === 0 &&
      Math.abs(sim.winH - sim.ph) < 0.05,
    30,
    now,
  );
}

class SoftPath {
  subs: { x: number; y: number }[][] = [];
  private cur: { x: number; y: number }[] | null = null;
  moveTo(x: number, y: number) {
    this.cur = [{ x, y }];
    this.subs.push(this.cur);
  }
  lineTo(x: number, y: number) {
    this.cur?.push({ x, y });
  }
  closePath() {}
}

class SoftCtx {
  fillStyle = "#000000";
  private dpr = 1;
  private pixels: Uint8Array;
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.pixels = new Uint8Array(width * height * 4);
  }
  setTransform(a: number) {
    this.dpr = a;
  }
  clearRect() {
    this.pixels.fill(0);
  }
  fill(path: SoftPath) {
    const color = hex(this.fillStyle);
    for (const sub of path.subs) {
      fillPoly(this.pixels, this.width, this.height, sub, this.dpr, color);
    }
  }
}

function hex(color: string) {
  const n = Number.parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function fillPoly(
  pixels: Uint8Array,
  width: number,
  height: number,
  pts: { x: number; y: number }[],
  dpr: number,
  color: number[],
) {
  if (pts.length < 3) {
    return;
  }
  let minY = Infinity;
  let maxY = -Infinity;
  const scaled = pts.map((p) => ({ x: p.x * dpr, y: p.y * dpr }));
  for (const p of scaled) {
    if (p.y < minY) {
      minY = p.y;
    }
    if (p.y > maxY) {
      maxY = p.y;
    }
  }
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(height - 1, Math.ceil(maxY));
  for (let y = y0; y <= y1; y += 1) {
    const scan = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < scaled.length; i += 1) {
      const a = scaled[i];
      const b = scaled[(i + 1) % scaled.length];
      if ((a.y <= scan && b.y > scan) || (b.y <= scan && a.y > scan)) {
        xs.push(a.x + ((scan - a.y) * (b.x - a.x)) / (b.y - a.y));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const x0 = Math.max(0, Math.floor(xs[i]));
      const x1 = Math.min(width - 1, Math.ceil(xs[i + 1]));
      for (let x = x0; x <= x1; x += 1) {
        const o = (y * width + x) * 4;
        pixels[o] = color[0];
        pixels[o + 1] = color[1];
        pixels[o + 2] = color[2];
        pixels[o + 3] = 255;
      }
    }
  }
}

function viewFor(sim: PortraitSim, vw: number, vh: number, dpr: number) {
  const fx = new SoftCtx(Math.round(vw * dpr), Math.round(vh * dpr));
  const face = new SoftCtx(
    Math.max(1, Math.round(sim.pw * dpr)),
    Math.max(1, Math.round(sim.ph * dpr)),
  );
  return {
    fx: fx as unknown as CanvasRenderingContext2D,
    face: face as unknown as CanvasRenderingContext2D,
  };
}

function stats(samples: number[]) {
  const sorted = samples.slice().sort((a, b) => a - b);
  return {
    median: sorted[Math.floor(sorted.length / 2)] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    frames: sorted.length,
  };
}

describe("clay portrait", () => {
  it("keeps the reference piece counts", () => {
    const sim = mount();
    expect(data).not.toHaveProperty("audio");
    expect(sim.full).toBe(5295);
    expect(sim.perClay).toBe(212);
    expect(sim.headPieces()).toBe(2605);
    const voice = fs.readFileSync("public/portrait/voice.mp3");
    expect(voice.subarray(0, 3).toString("ascii")).toBe("ID3");
  });

  it("breaks a clay into about 22 chunky fragments", () => {
    const sim = mount();
    sim.smash(120, 700);
    const n = sim.pileAudit().falling;
    expect(n).toBeGreaterThanOrEqual(19);
    expect(n).toBeLessThanOrEqual(25);
    expect(sim.overlayActive()).toBe(false);
    const falling = sim.fallingViews();
    expect(falling).toHaveLength(n);
    expect(falling[0].clip.startsWith("polygon(")).toBe(true);
  });

  it("lets the pile sleep within 1.5 seconds of the last landing", () => {
    const sim = mount();
    smashClays(sim, 5, 80, 200);
    sim.step(0.05, 1100);
    expect(sim.pileAudit().falling).toBeGreaterThan(0);
    const landed = until(sim, () => sim.pileAudit().falling === 0, 8);
    expect(sim.pileAudit().pieces).toBeGreaterThan(0);
    until(sim, () => sim.pileAudit().awake === 0, 1.5, landed);
    expect(sim.pileAudit().awake).toBe(0);
    expect(sim.overlayActive()).toBe(false);
  });

  it("fills the reservoir to 100% from 27 clays and builds the whole face", () => {
    const sim = mount();
    let rumbled = false;
    sim.onRumble = (on) => {
      if (on) {
        rumbled = true;
      }
    };
    smashClays(sim, 27);
    let now = until(sim, () => sim.pileAudit().falling === 0, 12);
    now = run(sim, 2, now);
    const tank = sim.reservoir();
    expect(tank.pct).toBe(100);
    expect(tank.full).toBe(true);
    expect(sim.hintMode()).toBe("full");
    expect(sim.pileAudit().past).toBe(0);
    expect(sim.pileAudit().left).toBe(0);
    expect(sim.deepOverlaps()).toBe(0);
    now = pullAndBuild(sim, now);
    const face = sim.faceAudit();
    expect(face.missing).toBe(0);
    expect(face.strays).toBe(0);
    expect(sim.pileAudit().pieces).toBe(0);
    expect(rumbled).toBe(true);
    now = run(sim, 2, now);
    expect(sim.crusherUp).toBe(false);
    expect(sim.crusherOn).toBe(false);
    void now;
  }, 120000);

  it("reaches each quarter of the face at an even pace", () => {
    const sim = mount();
    smashClays(sim, 27);
    let now = until(sim, () => sim.pileAudit().falling === 0, 12);
    now = run(sim, 1, now);
    now = until(sim, () => !sim.latched && sim.isFull(), 8, now);
    sim.leverKey();
    now = until(sim, () => sim.latched, 3, now);
    const started = until(
      sim,
      () => sim.flightsLength() > 0 || sim.faceFilled() > 0,
      3,
      now,
    );
    const marks = [0.25, 0.5, 0.75, 1];
    const times: number[] = [];
    let next = 0;
    const steps = Math.ceil(8 / 0.033);
    for (let i = 0; i < steps && next < marks.length; i += 1) {
      now += 33;
      sim.step(0.033, now);
      const pile = sim.pileAudit();
      if (pile.crossed || pile.left > 0) {
        throw new Error(`heap passed the wall ${JSON.stringify(pile)}`);
      }
      while (next < marks.length && sim.faceFilled() >= marks[next] - 1e-9) {
        times.push((now - started) / 1000);
        next += 1;
      }
    }
    expect(times).toHaveLength(4);
    const total = times[3];
    const mean = total / 4;
    const gaps = [times[0], times[1] - times[0], times[2] - times[1], times[3] - times[2]];
    for (const gap of gaps) {
      expect(gap).toBeGreaterThan(mean * 0.6);
      expect(gap).toBeLessThan(mean * 1.6);
    }
    expect(total).toBeGreaterThan(3.6);
    expect(total).toBeLessThan(5.5);
  }, 120000);

  it("lands edge smashes inside the tray", () => {
    const sim = new PortraitSim(data);
    sim.sizePortrait(350);
    sim.sync(
      layoutFor(
        sim,
        390,
        844,
        2,
        { left: 70, top: 520, width: 250, height: 240 },
        350,
      ),
    );
    sim.smash(8, 40);
    sim.smash(382, 40);
    until(sim, () => sim.pileAudit().falling === 0, 8);
    const pile = sim.pileAudit();
    expect(pile.pieces).toBeGreaterThan(0);
    expect(pile.past).toBe(0);
    expect(pile.left).toBe(0);
  }, 30000);

  it("jams the lever when only 4 clays have been smashed", () => {
    const sim = mount();
    smashClays(sim, 4);
    const now = until(sim, () => sim.pileAudit().falling === 0, 8);
    expect(sim.reservoir().pct).toBeLessThan(100);
    expect(sim.isFull()).toBe(false);
    sim.leverDown(0);
    let clock = now;
    for (let i = 0; i < 90; i += 1) {
      sim.leverMove(800);
      clock += 33;
      sim.step(0.033, clock);
    }
    expect(sim.pos).toBeLessThanOrEqual(0.1);
    expect(sim.built).toBe(0);
    sim.leverUp();
    expect(sim.warns).toBeGreaterThan(0);
    expect(sim.faceAudit().missing).toBe(5295);
    expect(sim.flightsLength()).toBe(0);
  }, 30000);

  it("pops 2605 head pieces and a second pull rebuilds them", () => {
    const sim = mount();
    smashClays(sim, 27);
    let now = until(sim, () => sim.pileAudit().falling === 0, 12);
    now = pullAndBuild(sim, now);
    expect(sim.popHeadPieces()).toBe(2605);
    expect(sim.pileAudit().falling).toBe(271);
    expect(sim.faceAudit().missing).toBe(2605);
    now = until(sim, () => sim.pileAudit().falling === 0, 12, now);
    expect(sim.isFull()).toBe(true);
    now = pullAndBuild(sim, now);
    expect(sim.faceAudit().missing).toBe(0);
    expect(sim.faceAudit().strays).toBe(0);
    expect(sim.pileAudit().pieces).toBe(0);
    void now;
  }, 180000);

  it("runs every easter egg through to the end", () => {
    const sim = mount();
    smashClays(sim, 27);
    let now = until(sim, () => sim.pileAudit().falling === 0, 12);
    now = pullAndBuild(sim, now);
    sim.tryClick(0, 10);
    now = until(sim, () => sim.lastEffect === "words" && sim.effect === null, 8, now);
    sim.tryClick(0, 10);
    now = until(sim, () => sim.lastEffect === "decode" && sim.effect === null, 8, now);
    sim.tryClick(0, 10);
    expect(sim.effect?.type).toBe("swarm");
    now = run(sim, 0.5, now);
    sim.pressFace();
    now = until(sim, () => sim.lastEffect === "swarm" && sim.effect === null, 12, now);
    sim.tryClick(0, 10);
    now = until(sim, () => sim.lastEffect === "balloon" && sim.effect === null, 8, now);
    expect(sim.faceAudit().missing).toBe(2605);
    expect(sim.pileAudit().falling).toBe(271);
    void now;
  }, 180000);

  it("builds instantly and stays quiet when motion is reduced", () => {
    const sim = mount(true);
    let rumbled = false;
    sim.onRumble = () => {
      rumbled = true;
    };
    smashClays(sim, 27);
    expect(sim.pileAudit().falling).toBe(0);
    expect(sim.isFull()).toBe(true);
    expect(sim.reservoir().pct).toBe(100);
    sim.leverKey();
    const now = until(sim, () => sim.faceAudit().missing === 0, 2, 1000);
    expect(sim.faceAudit().missing).toBe(0);
    expect(sim.faceAudit().strays).toBe(0);
    expect(sim.pileAudit().pieces).toBe(0);
    expect(Math.abs(sim.winH - sim.ph)).toBeLessThan(0.05);
    expect(sim.crusherUp).toBe(false);
    expect(rumbled).toBe(false);
    sim.tryClick(0, 10);
    expect(sim.effect?.type).toBe("decode");
    until(sim, () => sim.lastEffect === "decode" && sim.effect === null, 4, now);
  }, 30000);

  it("measures whole frames, including drawing, on a phone and on a desktop", () => {
    const previous = globalThis.Path2D;
    globalThis.Path2D = SoftPath as unknown as typeof Path2D;
    const phone = measure(390, 844, 2, 350, {
      left: 16,
      top: 520,
      width: 358,
      height: 240,
    });
    const desktop = measure(1280, 800, 1, 620, {
      left: 200,
      top: 480,
      width: 880,
      height: 240,
    });
    if (previous) {
      globalThis.Path2D = previous;
    }
    console.log(
      `portrait frame ms phone smash median ${phone.smash.median.toFixed(2)} max ${phone.smash.max.toFixed(2)} (${phone.smash.frames} frames); phone build median ${phone.build.median.toFixed(2)} max ${phone.build.max.toFixed(2)} (${phone.build.frames} frames)`,
    );
    console.log(
      `portrait frame ms desktop smash median ${desktop.smash.median.toFixed(2)} max ${desktop.smash.max.toFixed(2)} (${desktop.smash.frames} frames); desktop build median ${desktop.build.median.toFixed(2)} max ${desktop.build.max.toFixed(2)} (${desktop.build.frames} frames)`,
    );
    expect(phone.smash.frames).toBeGreaterThan(0);
    expect(phone.build.frames).toBeGreaterThan(0);
    expect(desktop.smash.frames).toBeGreaterThan(0);
    expect(desktop.build.frames).toBeGreaterThan(0);
  }, 180000);
});

function measure(
  vw: number,
  vh: number,
  dpr: number,
  portraitWidth: number,
  tray: PortraitRect,
) {
  const sim = new PortraitSim(data);
  sim.sizePortrait(portraitWidth);
  sim.sync(layoutFor(sim, vw, vh, dpr, tray, portraitWidth));
  const view = viewFor(sim, vw, vh, dpr);
  const smash: number[] = [];
  let now = 1000;
  for (let clay = 0; clay < 8; clay += 1) {
    sim.smash(vw * 0.5, 40);
    const frames = Math.round(560 / 16.7);
    for (let i = 0; i < frames; i += 1) {
      now += 16.7;
      const started = performance.now();
      sim.step(0.0167, now, view);
      smash.push(performance.now() - started);
    }
  }
  for (let clay = 0; clay < 27; clay += 1) {
    sim.smash(tray.left + tray.width * 0.4, tray.top + 40);
  }
  now = until(sim, () => sim.isFull() && sim.pileAudit().falling === 0, 15, now);
  const build: number[] = [];
  sim.leverKey();
  const steps = Math.ceil(20 / 0.0167);
  for (let i = 0; i < steps; i += 1) {
    now += 16.7;
    const started = performance.now();
    sim.step(0.0167, now, view);
    build.push(performance.now() - started);
    if (
      sim.latched &&
      sim.flightsLength() === 0 &&
      sim.faceAudit().missing === 0 &&
      sim.pileAudit().pieces === 0 &&
      !sim.crusherOn &&
      !sim.crusherUp
    ) {
      break;
    }
  }
  expect(sim.faceAudit().missing).toBe(0);
  expect(sim.pileAudit().pieces).toBe(0);
  return { smash: stats(smash), build: stats(build) };
}
