import { describe, expect, it } from "vitest";
import { fly, withinFivePercent } from "./flight";

const square = { face: 0, path: 0, strikeOffset: 0, strikeHeight: 0 };

describe("driver calibration", () => {
  it("113 mph, square and centred, matches a tour drive within 5%", () => {
    const shot = fly({ clubSpeed: 113, ...square });
    expect(withinFivePercent(shot.ballSpeed, 167)).toBe(true);
    expect(withinFivePercent(shot.launchAngle, 11)).toBe(true);
    expect(withinFivePercent(shot.spinRate, 2700)).toBe(true);
    expect(withinFivePercent(shot.carry, 275)).toBe(true);
  });

  it("94 mph, square and centred, carries about 218 yards within 5%", () => {
    const shot = fly({ clubSpeed: 94, ...square });
    expect(withinFivePercent(shot.carry, 218)).toBe(true);
  });
});
