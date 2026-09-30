/** Sources that may unlock hard mode. Everything else must not. */

export type HardUnlockSource =
  | "normal-perfect"
  | "test-shortcut-hard";

const ALLOWED: readonly HardUnlockSource[] = [
  "normal-perfect",
  "test-shortcut-hard",
] as const;

/** True only for a normal-mode 5/5 or the preview/dev ?test=hard shortcut. */
export function hardUnlockAllowed(source: string): source is HardUnlockSource {
  return (ALLOWED as readonly string[]).includes(source);
}

/** Every known product path that writes clay-hard-unlocked, for tests. */
export const HARD_UNLOCK_SOURCES = {
  /** End of a normal 5/5 celebration (invite), or the invite button after it. */
  normalPerfect: "normal-perfect" as const,
  /** Preview/dev only: ?test=hard */
  testShortcutHard: "test-shortcut-hard" as const,
  /** Must never unlock on their own. */
  denied: [
    "test-shortcut-normal",
    "test-shortcut-win",
    "test-shortcut-highgun",
    "hard-perfect",
    "invite-without-perfect",
    "beat-count",
    "page-load",
  ] as const,
};
