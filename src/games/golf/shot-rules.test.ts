import fs from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { fly } from "./flight";
import { clubSpeedMph, judgeSwipe, perfectSpeedMul, swingSpeedMul, type SwipePoint } from "./shot-rules";
import { shotToFlight } from "./shot-flight";

const html = fs.readFileSync("reference/golf-procedural.html", "utf8");
function slice(from: string, to: string) {
  const start = html.indexOf(from);
  const end = html.indexOf(to, start);
  return html.slice(start, end);
}
const source = `
  var deg = Math.PI / 180;
  var BULL = 0.14;
  var samples = [], g0 = null, bLen = 0, locked = null, shotsTaken = 0, shot = null, mods = {};
  ${slice("function classify(sh)", "function launch(sh)")}
  ${slice("function angleOf(a, b)", "function deadzone")}
  ${slice("function deadzone(v, d)", "canvas.style")}
  ${slice("function pathFrom(a, b, n)", "function commit")}
  ${slice("function commit(cross, letGo)", "var TOP_T")}
  function run(input) {
    samples = input.samples;
    g0 = input.start;
    bLen = input.backLength;
    locked = input.locked;
    shotsTaken = input.shotsTaken;
    commit(input.cross, input.letGo);
    if (shot) shot.key = classify(shot);
    return shot;
  }
  run;
`;
const prototype = vm.runInNewContext(source, { Math }) as (input: {
  samples: SwipePoint[];
  start: SwipePoint;
  cross: SwipePoint;
  letGo: boolean;
  backLength: number;
  locked: { x: number; y: number };
  shotsTaken: number;
}) => {
  key: string;
  checks: Record<string, boolean>;
  perfect: boolean;
  purity: number;
  letDown: { what: string; fix: string }[];
  clubMph: number;
  path: number;
  face: number;
  strike: string;
  contact: string;
};

function line(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  seconds: number,
  count: number,
  width = 400,
): SwipePoint[] {
  const points: SwipePoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const u = i / (count - 1);
    points.push({ x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u, t: seconds * u, w: width, h: 700 });
  }
  return points;
}

function bend(xs: number[], ys: number[], seconds: number, width = 4000): SwipePoint[] {
  const points: SwipePoint[] = [];
  for (let i = 0; i < xs.length; i += 1) {
    points.push({ x: xs[i], y: ys[i], t: (seconds * i) / (xs.length - 1), w: width, h: 700 });
  }
  return points;
}

function swipe(partial: {
  back?: SwipePoint[];
  down: SwipePoint[];
  backLength: number;
  locked?: { x: number; y: number };
  shotsTaken?: number;
  letGo?: boolean;
}) {
  const start = partial.down[0];
  return {
    samples: partial.down,
    start: partial.back?.[0] ?? { ...start, y: start.y - 220, t: start.t - 0.45 },
    cross: partial.down[partial.down.length - 1],
    letGo: partial.letGo ?? false,
    backLength: partial.backLength,
    locked: partial.locked ?? { x: 0, y: 0 },
    shotsTaken: partial.shotsTaken ?? 4,
  };
}

const wide = 2000;
const cases = [
  { name: "straight", input: swipe({ down: line(200, 500, 200, 200, 0.22, 8, wide), backLength: 1 }) },
  { name: "draw", input: swipe({ down: bend([200, 200, 200, 200, 200, 200, 188, 176], [500, 460, 420, 380, 340, 300, 250, 200], 0.2), backLength: 1 }) },
  { name: "fade", input: swipe({ down: bend([200, 200, 200, 200, 200, 200, 212, 224], [500, 460, 420, 380, 340, 300, 250, 200], 0.2), backLength: 1 }) },
  { name: "pull", input: swipe({ down: line(200, 500, 110, 200, 0.22, 8, wide), backLength: 1 }) },
  { name: "push", input: swipe({ down: line(200, 500, 290, 200, 0.22, 8, wide), backLength: 1 }) },
  { name: "slice", input: swipe({ down: bend([200, 140, 90, 50, 30, 40, 70, 59], [500, 460, 420, 380, 340, 280, 240, 200], 0.2), backLength: 1 }) },
  { name: "pull-slice", input: swipe({ down: bend([200, 80, 0, -40, -70, -40, 0, -30], [500, 460, 420, 380, 340, 280, 240, 200], 0.2), backLength: 1 }) },
  { name: "push-slice", input: swipe({ down: bend([200, 210, 220, 230, 240, 250, 320, 400], [500, 460, 420, 380, 340, 280, 240, 200], 0.2, 12000), backLength: 1 }) },
  { name: "hook", input: swipe({ down: bend([200, 200, 200, 200, 200, 160, 80, 20], [500, 460, 420, 380, 340, 280, 240, 200], 0.2), backLength: 1 }) },
  { name: "heel", input: swipe({ down: line(200, 500, 160, 200, 0.22, 8), backLength: 1 }) },
  { name: "toe", input: swipe({ down: line(200, 500, 245, 200, 0.22, 8), backLength: 1 }) },
  { name: "fat", input: swipe({ down: line(200, 500, 200, 400, 0.2, 8, wide), backLength: 1, letGo: true }) },
  { name: "thin", input: swipe({ down: line(200, 500, 200, 200, 0.08, 8, wide), backLength: 1 }) },
  { name: "topped", input: swipe({ down: line(200, 500, 200, 200, 0.04, 8, wide), backLength: 1 }) },
  { name: "air-shot", input: swipe({ down: line(200, 500, 40, 200, 0.22, 8), backLength: 1 }) },
  { name: "perfect", input: swipe({ down: line(200, 500, 200, 200, 0.15, 8, wide), backLength: 1 }) },
];

describe("shot rules", () => {
  it("matches the prototype for every outcome", () => {
    for (const item of cases) {
      const fromFile = prototype(item.input);
      const port = judgeSwipe(item.input);
      expect(port, item.name).not.toBeNull();
      if (!port) continue;
      expect(port.key, item.name).toBe(fromFile.key);
      expect(port.perfect, item.name).toBe(fromFile.perfect);
      expect(port.purity, item.name).toBeCloseTo(fromFile.purity, 8);
      expect(port.checks, item.name).toEqual(fromFile.checks);
      expect(
        port.letDown.map((line) => ({ what: line.what, fix: line.fix })),
        item.name,
      ).toEqual(fromFile.letDown.map((line) => ({ what: line.what, fix: line.fix })));
    }
  });

  it("covers a recorded swipe for every outcome", () => {
    const seen = new Set<string>();
    for (const item of cases) {
      const port = judgeSwipe(item.input);
      expect(port, item.name).not.toBeNull();
      if (port) seen.add(port.key);
    }
    expect([...seen].sort()).toEqual(
      ["air-shot", "draw", "fade", "fat", "heel", "hook", "pull", "pull-slice", "push", "push-slice", "slice", "straight", "thin", "toe", "topped"].sort(),
    );
  });
});

describe("club speed for the site flight", () => {
  it("lands a smooth full swing and a perfect strike on the yardage targets", () => {
    const smooth = judgeSwipe(swipe({ down: line(200, 500, 200, 200, 0.15, 8, wide), backLength: 1, shotsTaken: 0 }));
    expect(smooth?.perfect).toBe(false);
    expect(smooth?.checks.length).toBe(true);
    expect(smooth?.checks.balance).toBe(true);
    if (!smooth) return;
    const flown = fly(shotToFlight(smooth));
    expect(flown.carry).toBeGreaterThan(210);
    expect(flown.carry).toBeLessThan(225);
    const low = fly(shotToFlight({ ...smooth, clubMph: clubSpeedMph(1, perfectSpeedMul(0)), strike: "center", contact: "clean", path: 0, face: 0 }));
    const high = fly(shotToFlight({ ...smooth, clubMph: clubSpeedMph(1, perfectSpeedMul(1)), strike: "center", contact: "clean", path: 0, face: 0 }));
    expect(low.total).toBeGreaterThan(290);
    expect(low.total).toBeLessThan(310);
    expect(high.total).toBeGreaterThan(320);
    expect(high.total).toBeLessThan(340);
    const shorter = clubSpeedMph(0.5, swingSpeedMul(3, 0));
    const full = clubSpeedMph(1, swingSpeedMul(3, 0));
    const shaky = clubSpeedMph(1, swingSpeedMul(3, 1));
    expect(shorter).toBeLessThan(full);
    expect(shaky).toBeLessThan(full);
  });
});
