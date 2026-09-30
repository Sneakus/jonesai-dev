import type { BeforeSendEvent } from "@vercel/analytics/next";

const testShortcuts = new Set(["hard", "normal", "win", "highgun"]);

/** True when the address is a clay test shortcut that must not be counted. */
export function isClayTestShortcutUrl(url: string) {
  try {
    const parsed = new URL(url, "https://jonesai.dev");
    const value = parsed.searchParams.get("test");
    return value !== null && testShortcuts.has(value);
  } catch {
    return false;
  }
}

/** Drop development noise and clay test-shortcut pageviews. */
export function analyticsBeforeSend(event: BeforeSendEvent) {
  if (isClayTestShortcutUrl(event.url)) {
    return null;
  }
  return event;
}
