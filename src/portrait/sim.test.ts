import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { PortraitSim, type PortraitData, type PortraitLayout } from "./sim";

const data = JSON.parse(
  fs.readFileSync("public/portrait/portrait.json", "utf8"),
) as PortraitData;

function mount(reduce = false) {
  const sim = new PortraitSim(data, { reduce });
  sim.sizePortrait(350);
  const layout: PortraitLayout = {
    vw: 390,
    vh: 844,
    scrollX: 0,
    scrollY: 0,
    dpr: 2,
    tray: { left: 16, top: 480, width: 358, height: 340 },
    leverLeft: 300,
    portrait: { left: 20, top: 40, width: 350, height: sim.ph },
    looks: [{ left: 24, top: 360, width: 140, height: 18 }],
  };
  sim.sync(layout);
  return sim;
}

function run(sim: PortraitSim, seconds: number, now = 1000) {
  const steps = Math.ceil(seconds / 0.033);
  for (let i = 0; i < steps; i += 1) {
    now += 33;
    sim.step(0.033, now);
    if (sim.pileAudit().crossed) {
      throw new Error("heap passed the wall");
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
    if (sim.pileAudit().crossed) {
      throw new Error("heap passed the wall");
    }
    if (done()) {
      return now;
    }
  }
  throw new Error("timed out");
}

function smashClays(sim: PortraitSim, count: number) {
  for (let i = 0; i < count; i += 1) {
    sim.smash(120, 760);
  }
}

function pullAndBuild(sim: PortraitSim, now: number) {
  now = until(sim, () => !sim.latched, 3, now);
  sim.leverKey();
  now = until(sim, () => sim.latched, 3, now);
  return until(
    sim,
    () =>
      sim.flightsLength() === 0 &&
      sim.faceAudit().missing === 0 &&
      Math.abs(sim.winH - sim.ph) < 0.05,
    20,
    now,
  );
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

  it("fills the reservoir from 27 clays and builds the whole face", () => {
    const sim = mount();
    smashClays(sim, 27);
    let now = until(sim, () => sim.pileAudit().falling === 0, 20);
    const tank = sim.reservoir();
    expect(tank.full).toBe(true);
    expect(tank.n).toBe(5295);
    expect(tank.total).toBe(5295);
    expect(sim.hintMode()).toBe("full");
    expect(sim.pileAudit().furthestRight).toBeLessThanOrEqual(sim.pileAudit().wall);
    now = pullAndBuild(sim, now);
    const face = sim.faceAudit();
    expect(face.missing).toBe(0);
    expect(face.strays).toBe(0);
    expect(Math.abs(sim.winH - sim.ph)).toBeLessThan(0.05);
    expect(sim.winH).toBeGreaterThan(0);
    void now;
  }, 60000);

  it("jams the lever when only 4 clays have been smashed", () => {
    const sim = mount();
    smashClays(sim, 4);
    const now = until(sim, () => sim.pileAudit().falling === 0, 15);
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

  it("pops the head back into the heap and builds it again", () => {
    const sim = mount();
    smashClays(sim, 27);
    let now = until(sim, () => sim.pileAudit().falling === 0, 20);
    now = pullAndBuild(sim, now);
    expect(sim.popHeadPieces()).toBe(2605);
    expect(sim.pileAudit().falling).toBe(2605);
    now = until(sim, () => sim.pileAudit().falling === 0, 20, now);
    expect(sim.isFull()).toBe(true);
    now = pullAndBuild(sim, now);
    expect(sim.faceAudit().missing).toBe(0);
    expect(sim.faceAudit().strays).toBe(0);
    void now;
  }, 90000);

  it("runs every easter egg through to the end", () => {
    const sim = mount();
    smashClays(sim, 27);
    let now = until(sim, () => sim.pileAudit().falling === 0, 20);
    now = pullAndBuild(sim, now);
    sim.tryClick(0, 10);
    now = until(sim, () => sim.lastEffect === "words" && sim.effect === null, 8, now);
    sim.tryClick(0, 10);
    now = until(sim, () => sim.lastEffect === "decode" && sim.effect === null, 8, now);
    sim.tryClick(0, 10);
    expect(sim.effect?.type).toBe("swarm");
    now = run(sim, 0.5, now);
    sim.pressFace();
    now = until(sim, () => sim.lastEffect === "swarm" && sim.effect === null, 8, now);
    sim.tryClick(0, 10);
    now = until(sim, () => sim.lastEffect === "balloon" && sim.effect === null, 8, now);
    expect(sim.pileAudit().falling).toBe(2605);
    void now;
  }, 90000);

  it("builds instantly when motion is reduced", () => {
    const sim = mount(true);
    smashClays(sim, 27);
    expect(sim.pileAudit().falling).toBe(0);
    expect(sim.isFull()).toBe(true);
    sim.leverKey();
    const now = until(sim, () => sim.faceAudit().missing === 0, 2, 1000);
    expect(sim.faceAudit().missing).toBe(0);
    expect(Math.abs(sim.winH - sim.ph)).toBeLessThan(0.05);
    sim.tryClick(0, 10);
    expect(sim.effect?.type).toBe("decode");
    until(sim, () => sim.lastEffect === "decode" && sim.effect === null, 4, now);
    sim.tryClick(0, 10);
    expect(sim.effect?.type).toBe("decode");
  }, 30000);

  it("measures a phone-sized frame with thousands of pieces", () => {
    const sim = mount();
    sim.accountDraw = true;
    for (let i = 0; i < 27; i += 1) {
      sim.smash(120, 40);
    }
    const falling: number[] = [];
    let now = 1000;
    for (let i = 0; i < 40; i += 1) {
      const started = performance.now();
      now += 16.7;
      sim.step(0.0167, now);
      falling.push(performance.now() - started);
    }
    expect(sim.pileAudit().falling).toBeGreaterThan(2000);
    sim.accountDraw = false;
    now = until(sim, () => sim.pileAudit().falling === 0, 20, now);
    now = until(sim, () => !sim.latched, 3, now);
    sim.leverKey();
    now = until(sim, () => sim.latched, 3, now);
    now = run(sim, 2.5, now);
    expect(sim.flightsLength()).toBeGreaterThan(2000);
    sim.accountDraw = true;
    const flying: number[] = [];
    for (let i = 0; i < 40; i += 1) {
      const started = performance.now();
      now += 16.7;
      sim.step(0.0167, now);
      flying.push(performance.now() - started);
    }
    expect(sim.flightsLength()).toBeGreaterThan(2000);

    const summarize = (samples: number[]) => {
      const sorted = [...samples].sort((a, b) => a - b);
      return {
        median: sorted[Math.floor(sorted.length / 2)],
        max: sorted[sorted.length - 1],
      };
    };
    const fall = summarize(falling);
    const fly = summarize(flying);
    console.log(
      `portrait frame ms (390px, dpr 2): falling median ${fall.median.toFixed(2)} max ${fall.max.toFixed(2)}; flying median ${fly.median.toFixed(2)} max ${fly.max.toFixed(2)}`,
    );
    expect(fall.median).toBeLessThan(50);
    expect(fly.median).toBeLessThan(50);
  }, 60000);
});
