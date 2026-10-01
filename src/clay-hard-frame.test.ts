import { afterEach, describe, expect, it } from "vitest";
import { hardMode, setClayFeel } from "./clay-feel";
import {
  chooseFairThrow,
  flightStaysBelowTop,
  pickSize,
  settings,
  type ThrowKind,
} from "./clay-throws";

afterEach(() => {
  setClayFeel(false, false);
});

const kinds: ThrowKind[] = [
  "crosser",
  "away",
  "incomer",
  "high",
  "rabbit",
  "battue",
  "teal",
  "looper",
  "dropper",
  "curler",
];

describe("hard mode stays in frame", () => {
  for (const [label, coarse, box] of [
    ["desktop", false, { width: 1100, height: 520 }],
    ["phone", true, { width: 375, height: 420 }],
  ] as const) {
    it(`never lets a fair hard throw leave the top on ${label}`, () => {
      setClayFeel(coarse, true);
      let fair = 0;
      for (let index = 0; index < 80; index += 1) {
        const kind = kinds[index % kinds.length];
        const chosen = chooseFairThrow(kind, box, pickSize(), {
          hard: true,
          tries: Math.round(settings.fairTries),
        });
        expect(chosen.clay, `${kind} #${index}`).not.toBeNull();
        if (chosen.clay) {
          fair += 1;
          expect(
            flightStaysBelowTop(chosen.clay, box.width, box.height),
            `${kind} #${index} above top`,
          ).toBe(true);
        }
      }
      expect(fair).toBe(80);
    });
  }

  it("weights away and far launches so about half of hard throws look small", () => {
    const throwTotal =
      hardMode.throwCrosser +
      hardMode.throwAway +
      hardMode.throwIncomer +
      hardMode.throwHigh +
      hardMode.throwRabbit +
      hardMode.throwBattue +
      hardMode.throwTeal +
      hardMode.throwLooper +
      hardMode.throwDropper +
      hardMode.throwCurler;
    // Away + dropper + high are the far/small-looking kinds by weight.
    const farish =
      hardMode.throwAway + hardMode.throwDropper + hardMode.throwHigh;
    expect(farish / throwTotal).toBeGreaterThanOrEqual(0.45);
    expect(hardMode.farLaunchChance).toBeGreaterThanOrEqual(0.5);
    expect(hardMode.awayDistanceFrom).toBeGreaterThanOrEqual(0.35);
  });
});
