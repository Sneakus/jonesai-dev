import { afterEach, describe, expect, it } from "vitest";
import {
  compareDifficulty,
  runDifficultyReport,
} from "./clay-difficulty";
import { setClayFeel } from "./clay-feel";
import { flightIsFair, chooseFairThrow, pickSize, settings } from "./clay-throws";

afterEach(() => {
  setClayFeel(false, false);
});

describe("hard mode difficulty", () => {
  it("is harder than normal on desktop and phone, with fair throws and low fallback", () => {
    const desktopNormal = runDifficultyReport({
      rounds: 1000,
      coarse: false,
      hard: false,
      box: { width: 1100, height: 520 },
      label: "desktop normal",
    });
    const desktopHard = runDifficultyReport({
      rounds: 1000,
      coarse: false,
      hard: true,
      box: { width: 1100, height: 520 },
      label: "desktop hard",
    });
    const phoneNormal = runDifficultyReport({
      rounds: 1000,
      coarse: true,
      hard: false,
      box: { width: 375, height: 420 },
      label: "phone normal",
    });
    const phoneHard = runDifficultyReport({
      rounds: 1000,
      coarse: true,
      hard: true,
      box: { width: 375, height: 420 },
      label: "phone hard",
    });

    for (const [normal, hard] of [
      [desktopNormal, desktopHard],
      [phoneNormal, phoneHard],
    ] as const) {
      const compare = compareDifficulty(normal, hard);
      expect(compare.smaller, `${hard.label} size`).toBe(true);
      expect(compare.faster, `${hard.label} speed`).toBe(true);
      expect(compare.shorterShootable, `${hard.label} shootable`).toBe(true);
      expect(compare.hitShrinks, `${hard.label} hit`).toBe(true);
      expect(compare.hardFallbackUnder5, `${hard.label} fallback`).toBe(true);
    }

    // Spot-check that generated hard throws still pass fairness.
    for (const coarse of [false, true]) {
      const box = coarse
        ? { width: 375, height: 420 }
        : { width: 1100, height: 520 };
      setClayFeel(coarse, true);
      for (let index = 0; index < 40; index += 1) {
        const chosen = chooseFairThrow("dropper", box, pickSize(), {
          hard: true,
          tries: Math.round(settings.fairTries),
        });
        expect(chosen.clay).not.toBeNull();
        if (chosen.clay) {
          expect(flightIsFair(chosen.clay, box.width, box.height)).toBe(true);
        }
      }
    }
  });
});
