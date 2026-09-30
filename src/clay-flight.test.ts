import { afterEach, describe, expect, it } from "vitest";
import { setClayFeel } from "./clay-feel";
import {
  clayGone,
  launchThrow,
  settings,
  stepClay,
  type ThrowKind,
} from "./clay-throws";

afterEach(() => {
  setClayFeel(false, false);
});

const ALL_KINDS: ThrowKind[] = [
  "crosser",
  "high",
  "away",
  "incomer",
  "rabbit",
  "battue",
  "teal",
  "looper",
  "dropper",
  "curler",
];

const BOX = { width: 1100, height: 520 };
const SAMPLES = 24;
const DT = 1 / 60;

describe("real clay flight physics", () => {
  it("keeps horizontal speed from rising, only gains total speed while falling, holds curl sign, and stays continuous", () => {
    for (const kind of ALL_KINDS) {
      for (let sample = 0; sample < SAMPLES; sample += 1) {
        setClayFeel(sample % 2 === 0, sample % 3 === 0);
        const clay = launchThrow(kind, BOX, sample % 3 === 0 ? 0.5 : 1);
        const curlSign = Math.sign(clay.curl) || 0;
        let prevSpeed = Math.hypot(clay.vx, clay.vy);
        let prevHoriz = Math.abs(clay.vx);
        let prevHeading = Math.atan2(clay.vy, clay.vx);
        let prevX = clay.x;
        let prevY = clay.y;

        for (let step = 0; step < 480; step += 1) {
          if (clayGone(clay, BOX.width, BOX.height)) {
            break;
          }

          const beforeY = clay.y;
          const beforeVy = clay.vy;
          const beforeVx = clay.vx;

          stepClay(clay, DT, BOX.width, BOX.height);

          expect(Math.sign(clay.curl) || 0).toBe(curlSign);

          const speed = Math.hypot(clay.vx, clay.vy);
          const horiz = Math.abs(clay.vx);
          const heading = Math.atan2(clay.vy, clay.vx);
          const didBounce =
            kind === "rabbit" && beforeVy >= 0 && clay.vy < -1;

          // Horizontal speed never increases (allow tiny numerical noise).
          expect(horiz).toBeLessThanOrEqual(prevHoriz + 0.35);

          if (!didBounce) {
            // Total speed only increases while falling (gravity feeding kinetic).
            // Near the apex, curl can add a tiny bit while vy is still slightly up.
            if (speed > prevSpeed + 0.5) {
              expect(beforeVy).toBeGreaterThanOrEqual(-12);
            }

            // No discontinuities in speed or direction during free flight.
            // Skip heading checks near zero speed where atan2 flips.
            expect(Math.abs(speed - prevSpeed)).toBeLessThan(120);
            if (prevSpeed > 40 && speed > 40) {
              let turn = heading - prevHeading;
              while (turn > Math.PI) turn -= Math.PI * 2;
              while (turn < -Math.PI) turn += Math.PI * 2;
              expect(Math.abs(turn)).toBeLessThan(1.2);
            }

            const stepDist = Math.hypot(clay.x - prevX, clay.y - prevY);
            expect(stepDist).toBeLessThan(prevSpeed * DT * 1.5 + 8);
          }

          void beforeY;
          void beforeVx;

          prevSpeed = speed;
          prevHoriz = horiz;
          prevHeading = heading;
          prevX = clay.x;
          prevY = clay.y;
        }
      }
    }
  });

  it("never rewrites curl or aero mid-flight from age alone", () => {
    const clay = launchThrow("curler", BOX, 1);
    const curl = clay.curl;
    const drag = clay.drag;
    const lift = clay.lift;
    for (let step = 0; step < 120; step += 1) {
      stepClay(clay, DT, BOX.width, BOX.height);
      expect(clay.curl).toBe(curl);
      expect(clay.drag).toBe(drag);
      expect(clay.lift).toBe(lift);
    }
    expect(settings.gravity).toBeGreaterThan(0);
  });
});
