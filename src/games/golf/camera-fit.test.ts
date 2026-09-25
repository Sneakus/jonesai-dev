import { describe, expect, it } from "vitest";
import { fitSwingCamera, projectSwing, swingFramePoints } from "./camera-fit";

describe("swing camera", () => {
  it("keeps the swing, ball and grass inside the frame", () => {
    const points = swingFramePoints();
    for (const aspect of [0.55, 0.75, 1, 1.4, 1.8]) {
      const frame = fitSwingCamera(aspect);
      expect(frame.position[0]).toBe(0);
      expect(frame.look[0]).toBe(0);
      expect(frame.position[2]).toBeGreaterThan(frame.look[2]);
      expect(frame.position[2]).toBeGreaterThan(0);
      const camera = { x: frame.position[0], y: frame.position[1], z: frame.position[2] };
      const look = { x: frame.look[0], y: frame.look[1], z: frame.look[2] };
      for (const point of points) {
        const placed = projectSwing(point, camera, look, aspect);
        expect(placed.depth).toBeGreaterThan(0.3);
        expect(Math.abs(placed.x)).toBeLessThanOrEqual(0.78);
        expect(Math.abs(placed.y)).toBeLessThanOrEqual(0.78);
      }
    }
  });
});
