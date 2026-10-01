import { describe, expect, it } from "vitest";
import { CLAY_TEST_SHORTCUTS_ENABLED } from "./clay-test-shortcuts";
import {
  clayTestNormalIsFreshVisitor,
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

  it("sets storage so only ?test=hard unlocks, and win or highgun can play", () => {
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
    expect(clayTestStorageFor("win").unlocked).toBe(false);
    expect(clayTestStorageFor("highgun").mode).toBe("hard");
    expect(clayTestStorageFor("highgun").unlocked).toBe(false);
    expect(clayTestStartsPlaying("win")).toBe(true);
    expect(clayTestStartsPlaying("highgun")).toBe(true);
    expect(clayTestStartsPlaying("hard")).toBe(false);
  });

  it("resets ?test=normal to a locked new visitor", () => {
    const store: Record<string, string> = {
      "clay-hard-unlocked": "1",
      "clay-mode": "hard",
      "clay-hard-counted": "1",
      "clay-last-score-message": "old",
      "clay-legacy-preview": "1",
    };
    const storage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      get length() {
        return Object.keys(store).length;
      },
      key: (index: number) => Object.keys(store)[index] ?? null,
    };
    // Simulate clearAllClayStorage + normal mode write.
    for (const key of Object.keys(store)) {
      if (key.startsWith("clay-")) {
        storage.removeItem(key);
      }
    }
    storage.setItem("clay-mode", "normal");
    expect(
      clayTestNormalIsFreshVisitor(storage, {
        unlocked: "clay-hard-unlocked",
        mode: "clay-mode",
        counted: "clay-hard-counted",
      }),
    ).toBe(true);
    expect(store["clay-legacy-preview"]).toBeUndefined();
    expect(clayTestStorageFor("normal")).toEqual({
      unlocked: false,
      mode: "normal",
      counted: false,
    });
  });
});

describe("clay test shortcuts build flag", () => {
  it("reports whether the public preview flag is on", () => {
    expect(CLAY_TEST_SHORTCUTS_ENABLED).toBe(
      process.env.NEXT_PUBLIC_CLAY_TEST_SHORTCUTS === "1",
    );
  });
});
