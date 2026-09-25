import { describe, expect, it } from "vitest";
import { fly } from "./flight";
import { presets } from "./lab";
import { curveYards, shotKey } from "./outcomes";

const expected = ["straight", "slice", "hook", "topped", "fat"];

describe("presets", () => {
  it("names each preset button", () => {
    const names = presets.map((preset) => {
      const shot = fly(preset.input);
      return shotKey({
        strikeOffset: preset.input.strikeOffset,
        strikeHeight: preset.input.strikeHeight,
        startDirection: shot.startDirection,
        curve: curveYards(shot.offline, shot.total, shot.startDirection),
      });
    });
    expect(names).toEqual(expected);
  });
});
