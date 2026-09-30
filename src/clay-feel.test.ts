import { afterEach, describe, expect, it } from "vitest";
import {
  activeClayFeel,
  clayFeel,
  desktopClaySettings,
  setClayFeel,
  touchClay,
} from "./clay-feel";

afterEach(() => {
  setClayFeel(false);
});

describe("clay feel on phones", () => {
  it("keeps the PC settings at their desktop values", () => {
    expect(desktopClaySettings).toEqual({
      claySize: 51,
      hitAreaSize: 8,
      speedMin: 0.64,
      speedMax: 0.96,
    });
    expect(clayFeel(false)).toEqual({ draw: 1, hit: 1, speed: 1 });
  });

  it("keeps the three touch numbers together for tuning", () => {
    expect(touchClay).toEqual({
      draw: 0.85,
      hit: 0.8,
      speed: 1.15,
    });
  });

  it("applies the touch settings only on a coarse pointer", () => {
    expect(clayFeel(true)).toEqual(touchClay);
    setClayFeel(false);
    expect(activeClayFeel()).toEqual({ draw: 1, hit: 1, speed: 1 });
    setClayFeel(true);
    expect(activeClayFeel()).toEqual(touchClay);
  });
});
