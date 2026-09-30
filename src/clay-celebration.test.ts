import { describe, expect, it } from "vitest";
import {
  formatBeatYouLine,
  formatOrdinal,
  highGunDuration,
  highGunPhases,
  ordinalSuffix,
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

describe("High gun celebration", () => {
  it("lasts about seven seconds and is shorter with reduced motion", () => {
    const full = highGunDuration(false);
    expect(full).toBeGreaterThanOrEqual(6500);
    expect(full).toBeLessThanOrEqual(8000);
    expect(highGunDuration(true)).toBeLessThan(full);
  });

  it("skips motion effects when reduced motion is on", () => {
    const phases = highGunPhases(0, true);
    expect(phases.slowMo).toBe(false);
    expect(phases.smoke).toBe(false);
    expect(phases.shardProgress).toBe(1);
    expect(phases.rosetteProgress).toBe(1);
    expect(phases.showBanner).toBe(true);
  });
});

describe("ordinal beat line", () => {
  it("uses the right endings", () => {
    expect(formatOrdinal(1)).toBe("1st");
    expect(formatOrdinal(2)).toBe("2nd");
    expect(formatOrdinal(3)).toBe("3rd");
    expect(formatOrdinal(4)).toBe("4th");
    expect(formatOrdinal(11)).toBe("11th");
    expect(formatOrdinal(12)).toBe("12th");
    expect(formatOrdinal(13)).toBe("13th");
    expect(formatOrdinal(21)).toBe("21st");
    expect(ordinalSuffix(22)).toBe("nd");
    expect(ordinalSuffix(23)).toBe("rd");
    expect(
      formatBeatYouLine("You're the {ordinal} person to beat it.", 21),
    ).toBe("You're the 21st person to beat it.");
  });
});
