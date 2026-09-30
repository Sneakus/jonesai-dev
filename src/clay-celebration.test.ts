import { describe, expect, it } from "vitest";
import {
  perfectActionEnd,
  perfectCelebrationDuration,
  perfectHandOpacity,
} from "./clay-celebration";
import { settings } from "./clay-throws";

function celebrationSettings() {
  return {
    perfectSpinTime: settings.perfectSpinTime,
    perfectSweepStart: settings.perfectSweepStart,
    perfectSweepTime: settings.perfectSweepTime,
    perfectShotCount: settings.perfectShotCount,
    perfectRecoilTime: settings.perfectRecoilTime,
    perfectFireworkTravel: settings.perfectFireworkTravel,
    perfectSparkTime: settings.perfectSparkTime,
    winnerBannerDropTime: settings.winnerBannerDropTime,
    handSettleTime: 420,
  };
}

describe("perfect celebration hand timing", () => {
  it("keeps the hand fully visible until the last shot's recoil has ended", () => {
    const cele = celebrationSettings();
    const { lastFireAt, recoilEnd, actionEnd } = perfectActionEnd(cele);
    expect(lastFireAt).toBeGreaterThan(cele.perfectSweepStart);
    expect(recoilEnd).toBeGreaterThan(lastFireAt);
    expect(actionEnd).toBeGreaterThanOrEqual(recoilEnd);

    expect(perfectHandOpacity(lastFireAt, cele)).toBe(1);
    expect(perfectHandOpacity(recoilEnd, cele)).toBe(1);
    expect(perfectHandOpacity(recoilEnd - 1, cele)).toBe(1);
    expect(perfectHandOpacity(actionEnd, cele)).toBe(1);

    const afterSettle = actionEnd + 420;
    expect(perfectHandOpacity(afterSettle, cele)).toBe(0);
    expect(perfectCelebrationDuration(cele)).toBeGreaterThan(actionEnd);
  });
});
