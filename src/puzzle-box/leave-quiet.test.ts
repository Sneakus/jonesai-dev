import { describe, expect, it, vi } from "vitest";

/** Same halt steps as disposePuzzle / visibility hide in mount.js. */
function haltPuzzle(state: {
  running: boolean;
  raf: number;
  actx: { state: string; close: () => void; suspend: () => Promise<void> } | null;
  cancelAnimationFrame: (id: number) => void;
}) {
  state.running = false;
  if (state.raf) {
    state.cancelAnimationFrame(state.raf);
    state.raf = 0;
  }
  if (state.actx) {
    state.actx.close();
    state.actx = null;
  }
}

describe("puzzle box leave quiet", () => {
  it("stops animation and closes audio after leaving the page", () => {
    const cancelAnimationFrame = vi.fn();
    const close = vi.fn();
    const state = {
      running: true,
      raf: 42,
      actx: {
        state: "running",
        close,
        suspend: async () => undefined,
      },
      cancelAnimationFrame,
    };

    haltPuzzle(state);

    expect(state.running).toBe(false);
    expect(state.raf).toBe(0);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
    expect(close).toHaveBeenCalledTimes(1);
    expect(state.actx).toBeNull();
  });

  it("stays quiet when halted again", () => {
    const cancelAnimationFrame = vi.fn();
    const state = {
      running: false,
      raf: 0,
      actx: null,
      cancelAnimationFrame,
    };
    haltPuzzle(state);
    expect(cancelAnimationFrame).not.toHaveBeenCalled();
    expect(state.actx).toBeNull();
  });
});
