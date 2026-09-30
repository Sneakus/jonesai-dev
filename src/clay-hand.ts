/** When the HTML hand should show over the clay canvas. */

export function clayHandShouldShow(options: {
  handsReady: boolean;
  celebrating: boolean;
  handHolstered: boolean;
}) {
  return options.handsReady && !options.celebrating && !options.handHolstered;
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
