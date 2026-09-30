import { afterEach, describe, expect, it } from "vitest";
import {
  activeClayFeel,
  clayFeel,
  desktopClaySettings,
  hardMode,
  isTrickyKind,
  pickAvoidingRepeat,
  planHardRound,
  setClayFeel,
  touchClay,
} from "./clay-feel";
import { fairSample } from "./clay-throws";
import { hardBeatsWithStore } from "../app/api/hard-beats/route";

afterEach(() => {
  setClayFeel(false, false);
});

describe("clay feel on phones and hard mode", () => {
  it("keeps the PC settings at their desktop values", () => {
    expect(desktopClaySettings).toEqual({
      claySize: 51,
      hitAreaSize: 8,
      speedMin: 0.64,
      speedMax: 0.96,
    });
    expect(clayFeel(false, false)).toEqual({ draw: 1, hit: 1, speed: 1 });
  });

  it("applies the new phone settings only on a coarse pointer", () => {
    expect(touchClay).toEqual({
      draw: 0.6375,
      hit: 0.6,
      speed: 1.38,
    });
    expect(clayFeel(true, false)).toEqual(touchClay);
    setClayFeel(false, false);
    expect(activeClayFeel()).toEqual({ draw: 1, hit: 1, speed: 1 });
    setClayFeel(true, false);
    expect(activeClayFeel()).toEqual(touchClay);
  });

  it("applies hard settings only in hard mode, on top of phone settings", () => {
    expect(hardMode.draw).toBe(0.8);
    expect(hardMode.hit).toBe(0.8);
    expect(hardMode.speed).toBe(1.45);
    expect(hardMode.windMul).toBe(1.5);
    expect(hardMode.crosserSpeedMul).toBe(1.6);
    expect(hardMode.minTricky).toBe(3);
    setClayFeel(false, true);
    expect(activeClayFeel()).toEqual({
      draw: 0.8,
      hit: 0.8,
      speed: 1.45,
    });
    setClayFeel(true, true);
    expect(activeClayFeel()).toEqual({
      draw: touchClay.draw * hardMode.draw,
      hit: touchClay.hit * hardMode.hit,
      speed: touchClay.speed * hardMode.speed,
    });
  });

  it("plans hard rounds with at least three tricky throws", () => {
    for (let index = 0; index < 40; index += 1) {
      const round = planHardRound(5);
      expect(round).toHaveLength(5);
      expect(round.filter(isTrickyKind).length).toBeGreaterThanOrEqual(3);
    }
  });

  it("never repeats an end-of-round message twice in a row when it can help it", () => {
    const messages = ["a", "b", "c"];
    let previous = "a";
    for (let index = 0; index < 30; index += 1) {
      const next = pickAvoidingRepeat(messages, previous, () => 0);
      expect(next).not.toBe(previous);
      previous = next;
    }
  });
});

describe("hard throws and fairness", () => {
  const boxes = [
    { width: 1100, height: 520 },
    { width: 375, height: 420 },
  ];
  const kinds = ["looper", "dropper", "curler"] as const;

  for (const coarse of [false, true]) {
    for (const hard of [false, true]) {
      for (const box of boxes) {
        for (const kind of kinds) {
          it(`finds a fair ${kind} on ${box.width}x${box.height} coarse=${coarse} hard=${hard}`, () => {
            setClayFeel(coarse, hard);
            expect(fairSample(kind, box, 50, hard)).not.toBeNull();
          });
        }
      }
    }
  }
});

describe("hard beats count", () => {
  it("increments once per visitor address per minute against a mock store", async () => {
    const store = new Map<string, string>();
    const first = await hardBeatsWithStore(store, "POST", "1.1.1.1");
    expect(first).toEqual({ count: 1, ok: true });
    const again = await hardBeatsWithStore(store, "POST", "1.1.1.1");
    expect(again).toEqual({ count: 1, ok: false, limited: true });
    const other = await hardBeatsWithStore(store, "POST", "2.2.2.2");
    expect(other).toEqual({ count: 2, ok: true });
    const read = await hardBeatsWithStore(store, "GET");
    expect(read).toEqual({ count: 2 });
  });
});
