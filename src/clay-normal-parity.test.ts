import { afterEach, describe, expect, it } from "vitest";
import {
  perfectCelebrationDuration,
  perfectHandOpacity,
  type PerfectCelebrationSettings,
} from "./clay-celebration";
import {
  clayFeel,
  desktopClaySettings,
  setClayFeel,
  touchClay,
} from "./clay-feel";
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

const difficultyKeys = [
  "claySize",
  "hitAreaSize",
  "reloadTime",
  "pauseBetweenClays",
  "speedMin",
  "speedMax",
  "sizeNear",
  "sizeFar",
  "sizeStandard",
  "sizeMidi",
  "sizeMini",
  "throwCrosser",
  "throwAway",
  "throwIncomer",
  "throwHigh",
  "throwRabbit",
  "throwBattue",
  "throwTeal",
  "fairVisible",
  "fairMargin",
  "fairTime",
  "fairHand",
  "fairTries",
  "nearDistance",
  "farDistance",
  "windStrength",
] as const;

function hitRadiiForSize(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  api: any,
  sizeScale: number,
  distance: number,
  feelHit: number,
) {
  const clay = {
    kind: "crosser" as const,
    distance,
    sizeScale,
    roll: 0,
  };
  const look = api.lookOf(clay);
  return {
    hitX: (look.rx + api.settings.hitAreaSize) * feelHit,
    hitY: (look.ry + api.settings.hitAreaSize) * feelHit,
    drawRx: look.rx,
    drawRy: look.ry,
  };
}

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

  it("matches main difficulty settings and throw frequencies", () => {
    for (const key of difficultyKeys) {
      expect(live.settings[key], key).toBe(mainMirror.settings[key]);
    }
    expect(desktopClaySettings).toEqual({
      claySize: 51,
      hitAreaSize: 8,
      speedMin: 0.64,
      speedMax: 0.96,
    });
  });

  for (const [label, coarse] of [
    ["desktop", false],
    ["phone", true],
  ] as const) {
    it(`matches main feel, sizes, and hit areas on ${label}`, () => {
      setClayFeel(coarse, false);
      const feel = clayFeel(coarse, false);
      expect(feel).toEqual(coarse ? touchClay : { draw: 1, hit: 1, speed: 1 });
      // Hard-mode hit multiplier must not leak into normal.
      expect(feel.hit).toBe(coarse ? touchClay.hit : 1);

      for (const sizeScale of [1, 0.75, 0.5]) {
        for (const distance of [0.42, 0.7, 1]) {
          const liveHit = hitRadiiForSize(live, sizeScale, distance, feel.hit);
          const mirrorHit = hitRadiiForSize(
            mainMirror,
            sizeScale,
            distance,
            feel.hit,
          );
          expect(liveHit, `size ${sizeScale} d ${distance}`).toEqual(mirrorHit);
        }
      }
    });
  }

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
