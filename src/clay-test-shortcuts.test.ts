import { describe, expect, it } from "vitest";
import { CLAY_TEST_SHORTCUTS_ENABLED } from "./clay-test-shortcuts";
import {
  CLAY_TEST_SHORTCUT_BUNDLE_MARKER,
  clayTestSkipsHardCount,
  clayTestStartsPlaying,
  clayTestStorageFor,
  parseClayTestShortcut,
} from "./clay-test-shortcuts-live";

describe("clay test shortcuts", () => {
  it("parses only the known test values", () => {
    expect(parseClayTestShortcut("?test=hard")).toBe("hard");
    expect(parseClayTestShortcut("?test=normal")).toBe("normal");
    expect(parseClayTestShortcut("?test=win")).toBe("win");
    expect(parseClayTestShortcut("?test=highgun")).toBe("highgun");
    expect(parseClayTestShortcut("?test=other")).toBeNull();
    expect(parseClayTestShortcut("")).toBeNull();
  });

  it("never treats a celebration shortcut as something that should raise the beat count", () => {
    expect(clayTestSkipsHardCount("hard")).toBe(false);
    expect(clayTestSkipsHardCount("normal")).toBe(false);
    expect(clayTestSkipsHardCount("win")).toBe(true);
    expect(clayTestSkipsHardCount("highgun")).toBe(true);
    expect(clayTestSkipsHardCount(null)).toBe(false);
  });

  it("sets storage so hard unlocks, normal resets, and win or highgun can play", () => {
    expect(clayTestStorageFor("hard")).toEqual({
      unlocked: true,
      mode: "hard",
      counted: false,
    });
    expect(clayTestStorageFor("normal")).toEqual({
      unlocked: false,
      mode: "normal",
      counted: false,
    });
    expect(clayTestStorageFor("win").mode).toBe("normal");
    expect(clayTestStorageFor("highgun").mode).toBe("hard");
    expect(clayTestStartsPlaying("win")).toBe(true);
    expect(clayTestStartsPlaying("highgun")).toBe(true);
    expect(clayTestStartsPlaying("hard")).toBe(false);
  });

  it("keeps the production-absence marker string stable for the build scan", () => {
    expect(CLAY_TEST_SHORTCUT_BUNDLE_MARKER).toBe(
      "clay-test-shortcut-bundle-marker",
    );
  });
});

describe("clay test shortcuts build flag", () => {
  it("reports whether the public preview flag is on", () => {
    expect(CLAY_TEST_SHORTCUTS_ENABLED).toBe(
      process.env.NEXT_PUBLIC_CLAY_TEST_SHORTCUTS === "1",
    );
  });
});
