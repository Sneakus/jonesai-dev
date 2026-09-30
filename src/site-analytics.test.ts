import { describe, expect, it } from "vitest";
import { analyticsBeforeSend, isClayTestShortcutUrl } from "./site-analytics";

describe("site analytics filters", () => {
  it("skips clay test shortcut addresses", () => {
    expect(isClayTestShortcutUrl("https://jonesai.dev/?test=hard")).toBe(true);
    expect(isClayTestShortcutUrl("https://jonesai.dev/?test=normal")).toBe(true);
    expect(isClayTestShortcutUrl("https://jonesai.dev/?test=win")).toBe(true);
    expect(isClayTestShortcutUrl("https://jonesai.dev/?test=highgun")).toBe(true);
    expect(isClayTestShortcutUrl("https://jonesai.dev/?test=other")).toBe(false);
    expect(isClayTestShortcutUrl("https://jonesai.dev/")).toBe(false);
  });

  it("returns null from beforeSend for those shortcuts", () => {
    expect(
      analyticsBeforeSend({
        type: "pageview",
        url: "https://preview.example/?test=highgun",
      }),
    ).toBeNull();
    expect(
      analyticsBeforeSend({
        type: "pageview",
        url: "https://jonesai.dev/",
      }),
    ).toEqual({ type: "pageview", url: "https://jonesai.dev/" });
  });
});
