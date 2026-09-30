import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { clayBreakDocumentPoint, clayHandShouldShow } from "./clay-hand";
import {
  PortraitSim,
  type PortraitData,
  type PortraitLayout,
  type PortraitRect,
} from "./portrait/sim";

const data = JSON.parse(
  fs.readFileSync("public/portrait/portrait.json", "utf8"),
) as PortraitData;

describe("clay hand visibility", () => {
  it("shows the hand at rest once hands have loaded", () => {
    expect(
      clayHandShouldShow({
        handsReady: true,
        celebrating: false,
        handHolstered: false,
      }),
    ).toBe(true);
  });

  it("hides the hand while celebrating or holstered, then shows it again after", () => {
    expect(
      clayHandShouldShow({
        handsReady: true,
        celebrating: true,
        handHolstered: false,
      }),
    ).toBe(false);
    expect(
      clayHandShouldShow({
        handsReady: true,
        celebrating: true,
        handHolstered: false,
        shotRecoiling: true,
      }),
    ).toBe(true);
    expect(
      clayHandShouldShow({
        handsReady: true,
        celebrating: false,
        handHolstered: true,
      }),
    ).toBe(false);
    // After a High gun, holster clears for the next round.
    expect(
      clayHandShouldShow({
        handsReady: true,
        celebrating: false,
        handHolstered: false,
      }),
    ).toBe(true);
  });

  it("stays hidden until the hand photos are ready", () => {
    expect(
      clayHandShouldShow({
        handsReady: false,
        celebrating: false,
        handHolstered: false,
      }),
    ).toBe(false);
  });
});

describe("clay break shards to tray", () => {
  it("maps canvas breaks into document space for the portrait tray", () => {
    const point = clayBreakDocumentPoint(
      { left: 100, top: 80 },
      { x: 220, y: 140 },
      { x: 0, y: 40 },
    );
    expect(point).toEqual({ x: 320, y: 260 });
  });

  it("lands shards from game-height breaks inside the tray for every smash", () => {
    const vw = 1100;
    const vh = 900;
    const tray: PortraitRect = { left: 40, top: 620, width: 700, height: 240 };
    const game = { left: 40, top: 120, width: 1020, height: 520 };
    const sim = new PortraitSim(data, { random: () => 0.4 });
    sim.sizePortrait(350);
    const layout: PortraitLayout = {
      vw,
      vh,
      scrollX: 0,
      scrollY: 0,
      dpr: 1,
      fxDpr: 1,
      tray,
      leverLeft: tray.left + tray.width - 116,
      crusher: {
        left: tray.left + tray.width - 210,
        top: tray.top + tray.height - 100,
        width: 86,
        height: 92,
      },
      portrait: { left: 40, top: 40, width: 200, height: sim.ph },
      looks: [],
    };
    sim.sync(layout);

    const breakPoints = [0.2, 0.35, 0.5, 0.65, 0.8].map((t) =>
      clayBreakDocumentPoint(
        { left: game.left, top: game.top },
        { x: game.width * t, y: game.height * (0.3 + t * 0.2) },
        { x: 0, y: 0 },
      ),
    );

    for (const point of breakPoints) {
      expect(point.y).toBeLessThan(tray.top + tray.height);
      sim.smash(point.x, point.y);
    }

    let now = 1000;
    for (let step = 0; step < 600; step += 1) {
      now += 1000 / 60;
      sim.step(1 / 60, now);
      if (sim.pileAudit().falling === 0) {
        break;
      }
    }

    const pile = sim.pileAudit();
    expect(pile.falling).toBe(0);
    expect(pile.pieces).toBeGreaterThan(0);
    expect(sim.smashed).toBe(5);
    expect(pile.crossed).toBe(false);
    expect(pile.left).toBe(0);
  });
});
