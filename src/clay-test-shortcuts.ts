export type ClayTestShortcut = "hard" | "normal" | "win" | "highgun";

export const CLAY_TEST_SHORTCUTS_ENABLED =
  process.env.NEXT_PUBLIC_CLAY_TEST_SHORTCUTS === "1";

export type ClayTestStorage = {
  unlocked: boolean;
  mode: "hard" | "normal";
  counted: boolean;
};
