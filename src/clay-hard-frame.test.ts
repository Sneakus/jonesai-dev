import { afterEach, describe, expect, it } from "vitest";
import { hardMode, setClayFeel } from "./clay-feel";
import {
  chooseFairThrow,
  flightStaysBelowTop,
  flightVerticalSpan,
  hardDistanceIsFar,
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

    it(`keeps far hard throws nearly level on ${label}`, () => {
      setClayFeel(coarse, true);
      let farCount = 0;
      for (let index = 0; index < 120; index += 1) {
        const kind = kinds[index % kinds.length];
        const chosen = chooseFairThrow(kind, box, pickSize(), {
          hard: true,
          tries: Math.round(settings.fairTries),
        });
        expect(chosen.clay, `${kind} #${index}`).not.toBeNull();
        if (!chosen.clay) {
          continue;
        }
        const far = hardDistanceIsFar(chosen.clay.distance);
        if (far) {
          farCount += 1;
          expect(
            (hardMode.steepKinds as readonly string[]).includes(chosen.clay.kind),
            `steep ${chosen.clay.kind} at far`,
          ).toBe(false);
          expect(
            (hardMode.farLevelKinds as readonly string[]).includes(
              chosen.clay.kind,
            ),
            `far kind ${chosen.clay.kind}`,
          ).toBe(true);
          const span = flightVerticalSpan(
            chosen.clay,
            box.width,
            box.height,
          );
          expect(
            span,
            `${chosen.clay.kind} far vertical ${span}`,
          ).toBeLessThanOrEqual(box.height * hardMode.farMaxVerticalFrac + 1);
        }
      }
      expect(farCount).toBeGreaterThan(8);
    });
  }

  it("weights level far crossers ahead of steep throws", () => {
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
    const levelFarish =
      hardMode.throwCrosser + hardMode.throwCurler + hardMode.throwBattue;
    expect(levelFarish / throwTotal).toBeGreaterThanOrEqual(0.45);
    expect(hardMode.farLaunchChance).toBeGreaterThanOrEqual(0.5);
    expect(hardMode.steepDistanceTo).toBeLessThanOrEqual(0.55);
    expect(hardMode.farMaxVerticalFrac).toBeLessThanOrEqual(0.16);
  });
});
