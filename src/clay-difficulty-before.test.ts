import { describe, expect, it } from "vitest";
import { runDifficultyReport } from "./clay-difficulty";

/**
 * Baseline difficulty from before the unified physics rewrite
 * (hard-mode branch, pre-flight change).
 */
export const DIFFICULTY_BEFORE = {
  "desktop normal": {
    avgSize: 43.09,
    avgHit: 59.09,
    avgSpeed: 559.61,
    avgShootable: 1.585,
    fallbackRate: 0,
  },
  "desktop hard": {
    avgSize: 32.25,
    avgHit: 38.6,
    avgSpeed: 643.78,
    avgShootable: 1.351,
    fallbackRate: 0,
  },
  "phone normal": {
    avgSize: 27,
    avgHit: 25.8,
    avgSpeed: 315.6,
    avgShootable: 1.274,
    fallbackRate: 0,
  },
  "phone hard": {
    avgSize: 20.63,
    avgHit: 17.58,
    avgSpeed: 335.39,
    avgShootable: 1.259,
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
      expect(reports[0].samples).toBeGreaterThan(0);
      // Hard should still be harder than normal on desktop (smaller and/or faster).
      expect(reports[1].avgSize).toBeLessThan(reports[0].avgSize);
      expect(reports[1].avgHit).toBeLessThan(reports[0].avgHit);
      expect(reports[0].fallbackRate).toBeLessThan(0.15);
      expect(reports[1].fallbackRate).toBeLessThan(0.15);
    },
    120_000,
  );
});
