/** Shared clay flight: gravity, quadratic drag, lift, and steady curl. */

export type FlightState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Quadratic drag coefficient. Drag only ever slows the clay. */
  drag: number;
  /** Quadratic lift coefficient, applied toward world up. Fades as speed drops. */
  lift: number;
  /**
   * Steady sideways curl from spin and tilt: constant vertical acceleration.
   * Sign is fixed for the whole flight. Applied on the screen vertical axis
   * so a crosser's path bends one way without ever increasing horizontal speed.
   */
  curl: number;
  /** Gravity multiplier set at launch. */
  gravityScale: number;
  /** How fast distance changes (approach or leave). Set at launch only. */
  distanceVel: number;
  distance: number;
  age: number;
  /** Sign of launch horizontal velocity; used for horizontal-speed checks. */
  launchDirX: number;
};

/**
 * One physics step. No scripted or time-based speed or direction changes.
 * Gravity pulls down; drag slows; lift fades with speed; curl keeps one sign.
 */
export function stepFlight(
  clay: FlightState,
  dt: number,
  gravity: number,
) {
  clay.age += dt;

  let { vx, vy } = clay;

  // Gravity pulls down (+y).
  vy += gravity * clay.gravityScale * dt;

  const speed = Math.hypot(vx, vy);
  if (speed > 1e-6 && clay.drag > 0) {
    // Air drag opposes velocity and only slows (proportional to speed squared).
    const dragAcc = clay.drag * speed * speed;
    const inv = 1 / speed;
    vx -= vx * inv * dragAcc * dt;
    vy -= vy * inv * dragAcc * dt;
  }

  // Lift toward world up (-y), proportional to speed squared.
  const speedNow = Math.hypot(vx, vy);
  if (clay.lift > 0 && speedNow > 1e-6) {
    vy -= clay.lift * speedNow * speedNow * dt;
  }

  // Steady curl: constant vertical acceleration, fixed sign for the flight.
  vy += clay.curl * dt;

  clay.vx = vx;
  clay.vy = vy;
  clay.x += clay.vx * dt;
  clay.y += clay.vy * dt;
  clay.distance = Math.max(
    0.05,
    Math.min(1.4, clay.distance + clay.distanceVel * dt),
  );
}

/** Drag and lift scale gently with clay size (smaller discs feel snappier). */
export function sizeAero(sizeScale: number) {
  const t = Math.max(0.45, Math.min(1, sizeScale));
  return {
    drag: 0.00055 / t,
    lift: 0.00035 * t,
  };
}
