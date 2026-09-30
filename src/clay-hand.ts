/** When the HTML hand should show over the clay canvas. */

export function clayHandShouldShow(options: {
  handsReady: boolean;
  celebrating: boolean;
  handHolstered: boolean;
  /**
   * True while the last real shot's recoil is still playing.
   * Keeps the hand up through recoil even after a 5/5 celebration starts.
   */
  shotRecoiling?: boolean;
}) {
  if (!options.handsReady || options.handHolstered) {
    return false;
  }
  if (options.celebrating && !options.shotRecoiling) {
    return false;
  }
  return true;
}

/**
 * How much longer the hand stays visible after a normal 5/5 starts,
 * compared with hiding it the instant celebration begins. Celebration
 * timing itself is unchanged.
 */
export function clayHandRecoilHoldMs(handRecoilMs: number) {
  return Math.max(0, handRecoilMs);
}

/**
 * Document position of a clay break, matching what reportClayBreak receives.
 * Shards use this page point so they can fall into the tray.
 */
export function clayBreakDocumentPoint(
  canvasRect: { left: number; top: number },
  clay: { x: number; y: number },
  scroll: { x: number; y: number },
) {
  return {
    x: canvasRect.left + scroll.x + clay.x,
    y: canvasRect.top + scroll.y + clay.y,
  };
}
