import { describe, expect, it } from "vitest";
import { runDifficultyReport } from "./clay-difficulty";

/**
 * Baseline difficulty from before the unified physics rewrite
 * (hard-mode branch, pre-flight change).
 * Speeds are path-per-second while the clay is on screen.
 */
export const DIFFICULTY_BEFORE = {
  "desktop normal": {
    avgSize: 43.17,
    avgHit: 59.17,
    avgSpeed: 542.63,
    avgShootable: 1.573,
    fallbackRate: 0,
  },
  "desktop hard": {
    avgSize: 32.42,
    avgHit: 38.74,
    avgSpeed: 613.84,
    avgShootable: 1.351,
    fallbackRate: 0,
  },
  "phone normal": {
    avgSize: 26.96,
    avgHit: 25.77,
    avgSpeed: 275.08,
    avgShootable: 1.274,
    fallbackRate: 0,
  },
  "phone hard": {
    avgSize: 20.58,
    avgHit: 17.56,
    avgSpeed: 298.28,
    avgShootable: 1.258,
    fallbackRate: 0,
  },
} as const;

describe("difficulty before and after physics rewrite", () => {
  it(
    "prints before constants and after measured numbers",
    () => {
      const reports = [
        runDifficultyReport({
          rounds: 1000,
          coarse: false,
          hard: false,
          box: { width: 1100, height: 520 },
          label: "desktop normal",
        }),
        runDifficultyReport({
          rounds: 1000,
          coarse: false,
          hard: true,
          box: { width: 1100, height: 520 },
          label: "desktop hard",
        }),
        runDifficultyReport({
          rounds: 1000,
          coarse: true,
          hard: false,
          box: { width: 375, height: 420 },
          label: "phone normal",
        }),
        runDifficultyReport({
          rounds: 1000,
          coarse: true,
          hard: true,
          box: { width: 375, height: 420 },
          label: "phone hard",
        }),
      ];

      for (const report of reports) {
        const before =
          DIFFICULTY_BEFORE[report.label as keyof typeof DIFFICULTY_BEFORE];
        console.log(
          JSON.stringify({
            label: report.label,
            before,
            after: {
              avgSize: Number(report.avgSize.toFixed(2)),
              avgHit: Number(report.avgHit.toFixed(2)),
              avgSpeed: Number(report.avgSpeed.toFixed(2)),
              avgShootable: Number(report.avgShootable.toFixed(3)),
              fallbackRate: `${(report.fallbackRate * 100).toFixed(1)}%`,
            },
          }),
        );
      }

      const [desktopNormal, desktopHard, phoneNormal, phoneHard] = reports;
      expect(desktopNormal.samples).toBeGreaterThan(0);

      // Normal mode stays within about 5% of the pre-physics baseline.
      for (const report of [desktopNormal, phoneNormal]) {
        const before =
          DIFFICULTY_BEFORE[report.label as keyof typeof DIFFICULTY_BEFORE];
        for (const key of ["avgSize", "avgHit", "avgSpeed", "avgShootable"] as const) {
          const delta = Math.abs(report[key] - before[key]) / before[key];
          expect(
            delta,
            `${report.label} ${key} within 5% (was ${before[key]}, now ${report[key]})`,
          ).toBeLessThanOrEqual(0.055);
        }
        expect(report.fallbackRate).toBeLessThan(0.08);
      }

      // Hard stays harder than normal on every measure.
      for (const [normal, hard] of [
        [desktopNormal, desktopHard],
        [phoneNormal, phoneHard],
      ] as const) {
        expect(hard.avgSize).toBeLessThan(normal.avgSize);
        expect(hard.avgHit).toBeLessThan(normal.avgHit);
        expect(hard.avgSpeed).toBeGreaterThan(normal.avgSpeed);
        expect(hard.avgShootable).toBeLessThan(normal.avgShootable);
        expect(hard.fallbackRate).toBeLessThan(0.05);
      }
    },
    120_000,
  );
});
