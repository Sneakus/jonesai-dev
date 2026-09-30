import type { ClayTestShortcut, ClayTestStorage } from "./clay-test-shortcuts";

/** Unique string used to prove this file is absent from production builds. */
export const CLAY_TEST_SHORTCUT_BUNDLE_MARKER =
  "clay-test-shortcut-bundle-marker";

const known: ClayTestShortcut[] = ["hard", "normal", "win", "highgun"];

export function parseClayTestShortcut(search: string): ClayTestShortcut | null {
  void CLAY_TEST_SHORTCUT_BUNDLE_MARKER;
  const value = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  ).get("test");
  if (value && (known as string[]).includes(value)) {
    return value as ClayTestShortcut;
  }
  return null;
}

export function readClayTestShortcut(
  search =
    typeof window !== "undefined" ? window.location.search : "",
): ClayTestShortcut | null {
  return parseClayTestShortcut(search);
}

/** Storage changes for a shortcut. Counted stays false so shortcuts never add a beat. */
export function clayTestStorageFor(
  shortcut: ClayTestShortcut,
): ClayTestStorage {
  if (shortcut === "hard") {
    return { unlocked: true, mode: "hard", counted: false };
  }
  if (shortcut === "highgun") {
    // Preview High gun: play hard that visit, but do not unlock hard mode.
    return { unlocked: false, mode: "hard", counted: false };
  }
  if (shortcut === "normal") {
    return { unlocked: false, mode: "normal", counted: false };
  }
  return { unlocked: false, mode: "normal", counted: false };
}

export function clayTestStartsPlaying(shortcut: ClayTestShortcut) {
  return shortcut === "win" || shortcut === "highgun";
}

export function clayTestIsHighGun(shortcut: ClayTestShortcut) {
  return shortcut === "highgun";
}

/** Celebration shortcuts must never report a hard-mode beat. */
export function clayTestSkipsHardCount(shortcut: ClayTestShortcut | null) {
  return shortcut === "win" || shortcut === "highgun";
}

export function writeClayTestStorage(
  shortcut: ClayTestShortcut,
  storage: {
    unlocked: string;
    mode: string;
    counted: string;
  },
) {
  const next = clayTestStorageFor(shortcut);
  try {
    if (shortcut === "hard") {
      window.localStorage.setItem(storage.unlocked, "1");
    } else if (shortcut === "normal" || shortcut === "win") {
      // Clear unlock only when explicitly returning to a normal shortcut.
      window.localStorage.removeItem(storage.unlocked);
    }
    // highgun: leave any existing unlock alone; never grant a new one.
    window.localStorage.setItem(storage.mode, next.mode);
    // Shortcuts must never leave a counted flag that could interact oddly,
    // and must never POST a beat. Clear counted so a shortcut cannot look
    // like a real hard win already stored.
    window.localStorage.removeItem(storage.counted);
  } catch {
    // Ignore blocked storage.
  }
  return next;
}
