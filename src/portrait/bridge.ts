export const PORTRAIT_HIT = "jones:portrait-hit";

export type PortraitHit = {
  x: number;
  y: number;
};

export function reportClayBreak(x: number, y: number) {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<PortraitHit>(PORTRAIT_HIT, { detail: { x, y } }),
  );
}
