import { afterEach, describe, expect, it } from "vitest";
import { compareDifficulty, runDifficultyReport } from "./clay-difficulty";
import { setClayFeel } from "./clay-feel";

afterEach(() => {
  setClayFeel(false, false);
});

describe("difficulty: normal matches main, hard stays harder", () => {
  it(
    "keeps hard harder than normal on desktop and phone",
    () => {
      const desktopNormal = runDifficultyReport({
        rounds: 400,
        coarse: false,
        hard: false,
        box: { width: 1100, height: 520 },
        label: "desktop normal",
      });
      const desktopHard = runDifficultyReport({
        rounds: 400,
        coarse: false,
        hard: true,
        box: { width: 1100, height: 520 },
        label: "desktop hard",
      });
      const phoneNormal = runDifficultyReport({
        rounds: 400,
        coarse: true,
        hard: false,
        box: { width: 375, height: 420 },
        label: "phone normal",
      });
      const phoneHard = runDifficultyReport({
        rounds: 400,
        coarse: true,
        hard: true,
        box: { width: 375, height: 420 },
        label: "phone hard",
      });

      for (const report of [
        desktopNormal,
        desktopHard,
        phoneNormal,
        phoneHard,
      ]) {
        console.log(
          JSON.stringify({
            label: report.label,
            avgSize: Number(report.avgSize.toFixed(2)),
            avgHit: Number(report.avgHit.toFixed(2)),
            avgSpeed: Number(report.avgSpeed.toFixed(2)),
            avgShootable: Number(report.avgShootable.toFixed(3)),
            fallbackRate: `${(report.fallbackRate * 100).toFixed(1)}%`,
          }),
        );
      }

      for (const [normal, hard] of [
        [desktopNormal, desktopHard],
        [phoneNormal, phoneHard],
      ] as const) {
        const compare = compareDifficulty(normal, hard);
        expect(compare.smaller, `${hard.label} size`).toBe(true);
        expect(compare.hitShrinks, `${hard.label} hit`).toBe(true);
        expect(compare.faster, `${hard.label} speed`).toBe(true);
        expect(compare.shorterShootable, `${hard.label} shootable`).toBe(true);
        expect(compare.hardFallbackUnder5, `${hard.label} fallback`).toBe(true);
        expect(normal.fallbackRate).toBeLessThan(0.08);
      }
    },
    120_000,
  );
});
