import { afterEach, describe, expect, it } from "vitest";
import { wake } from "./loop";

describe("shared animation loop", () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("does not stay marked awake when wake runs with no jobs", () => {
    const host = {
      requestAnimationFrame: () => 1,
      cancelAnimationFrame: () => undefined,
      __jonesPerf: {
        asleep: false,
        samples: [] as { t: number; ms: number }[],
        shared: true as const,
      },
    };
    (globalThis as unknown as { window: typeof host }).window = host;
    wake();
    expect(host.__jonesPerf.asleep).toBe(true);
  });
});
