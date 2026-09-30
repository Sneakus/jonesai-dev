import { afterEach, describe, expect, it } from "vitest";
import {
  perfectCelebrationDuration,
  perfectHandOpacity,
  type PerfectCelebrationSettings,
} from "./clay-celebration";
import { setClayFeel } from "./clay-feel";
import {
  clayHandRecoilHoldMs,
  clayHandShouldShow,
} from "./clay-hand";
import {
  HARD_UNLOCK_SOURCES,
  hardUnlockAllowed,
} from "./clay-unlock";
import * as live from "./clay-throws";
import * as mainMirror from "./clay-throws-main-mirror";

afterEach(() => {
  setClayFeel(false, false);
});

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function withSeededRandom<T>(seed: number, run: () => T): T {
  const original = Math.random;
  Math.random = mulberry32(seed);
  try {
    return run();
  } finally {
    Math.random = original;
  }
}

function sampleFlight(
  // Live and main-mirror Clay shapes differ by hard-only aero fields.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  api: any,
  kind: live.ThrowKind,
  box: live.LaunchBox,
  sizeScale: number,
) {
  const clay = api.launchThrow(kind, box, sizeScale) as {
    x: number;
    y: number;
    age: number;
    kind: live.ThrowKind;
    sizeScale: number;
  };
  const path: { x: number; y: number; age: number }[] = [];
  const dt = 1 / 60;
  for (let step = 0; step < 240; step += 1) {
    path.push({ x: clay.x, y: clay.y, age: clay.age });
    api.stepClay(clay, dt, box.width, box.height);
    if (api.clayGone(clay, box.width, box.height)) {
      break;
    }
  }
  return { kind: clay.kind, sizeScale: clay.sizeScale, path };
}

const kinds: live.ThrowKind[] = [
  "crosser",
  "away",
  "incomer",
  "high",
  "rabbit",
  "battue",
  "teal",
];

describe("normal mode matches main", () => {
  it("keeps the hand through the last real shot recoil without changing celebration timing", () => {
    const hold = clayHandRecoilHoldMs(live.settings.handRecoil);
    expect(hold).toBe(120);
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
        celebrating: true,
        handHolstered: false,
        shotRecoiling: false,
      }),
    ).toBe(false);

    const cele: PerfectCelebrationSettings = {
      perfectSpinTime: live.settings.perfectSpinTime,
      perfectSweepStart: live.settings.perfectSweepStart,
      perfectSweepTime: live.settings.perfectSweepTime,
      perfectShotCount: live.settings.perfectShotCount,
      perfectRecoilTime: live.settings.perfectRecoilTime,
      perfectFireworkTravel: live.settings.perfectFireworkTravel,
      perfectSparkTime: live.settings.perfectSparkTime,
      winnerBannerDropTime: live.settings.winnerBannerDropTime,
      handSettleTime: live.settings.handSettleTime,
    };
    const mirrorCele: PerfectCelebrationSettings = {
      perfectSpinTime: mainMirror.settings.perfectSpinTime,
      perfectSweepStart: mainMirror.settings.perfectSweepStart,
      perfectSweepTime: mainMirror.settings.perfectSweepTime,
      perfectShotCount: mainMirror.settings.perfectShotCount,
      perfectRecoilTime: mainMirror.settings.perfectRecoilTime,
      perfectFireworkTravel: mainMirror.settings.perfectFireworkTravel,
      perfectSparkTime: mainMirror.settings.perfectSparkTime,
      winnerBannerDropTime: mainMirror.settings.winnerBannerDropTime,
      handSettleTime: mainMirror.settings.handSettleTime,
    };
    expect(perfectCelebrationDuration(cele)).toBe(
      perfectCelebrationDuration(mirrorCele),
    );
    expect(perfectHandOpacity(2000, cele)).toBe(
      perfectHandOpacity(2000, mirrorCele),
    );
  });

  for (const [label, coarse, box] of [
    ["desktop", false, { width: 1100, height: 520 }],
    ["phone", true, { width: 375, height: 420 }],
  ] as const) {
    it(`matches main throw paths on ${label} with the same seed`, () => {
      const seed = 20261001;
      setClayFeel(coarse, false);
      const liveFlights = withSeededRandom(seed, () =>
        kinds.map((kind) => sampleFlight(live, kind, box, 1)),
      );
      setClayFeel(coarse, false);
      const mirrorFlights = withSeededRandom(seed, () =>
        kinds.map((kind) => sampleFlight(mainMirror, kind, box, 1)),
      );
      expect(liveFlights).toEqual(mirrorFlights);
      expect(live.settings.perfectShotCount).toBe(
        mainMirror.settings.perfectShotCount,
      );
      expect(live.settings.fairTime).toBe(mainMirror.settings.fairTime);
      expect(live.settings.perfectSparkCount).toBe(
        mainMirror.settings.perfectSparkCount,
      );
    });
  }
});

describe("hard mode unlock paths", () => {
  it("allows only a normal 5/5 or the ?test=hard shortcut", () => {
    expect(hardUnlockAllowed(HARD_UNLOCK_SOURCES.normalPerfect)).toBe(true);
    expect(hardUnlockAllowed(HARD_UNLOCK_SOURCES.testShortcutHard)).toBe(true);
    for (const denied of HARD_UNLOCK_SOURCES.denied) {
      expect(hardUnlockAllowed(denied), denied).toBe(false);
    }
  });
});
