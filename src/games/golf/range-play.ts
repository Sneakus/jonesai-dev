import type { Line, Mesh, PerspectiveCamera } from "three";
import type { FlightPoint, FlightResult } from "./flight";
import { rangeSettings as range } from "./settings";

export type FlightHold = {
  shot: FlightResult;
  born: number;
  reported: boolean;
  /** World positions are written into the tracer once. Later frames only reveal more of that line. */
  tracerReady: boolean;
  shown: number;
  landAt: number;
};

const yard = range.yardToMetre;

export const ballSpot = { x: range.ball[0], y: range.ball[1], z: range.ball[2] };

export function landingTime(points: FlightPoint[]): number {
  let airborne = false;
  for (const point of points) {
    if (point.z > 0.4) airborne = true;
    if (airborne && point.z < 0.08) return point.t;
  }
  return points[points.length - 1]?.t ?? 0;
}

const scratch: FlightPoint = { t: 0, x: 0, y: 0, z: 0 };

function pointAt(points: FlightPoint[], time: number): FlightPoint {
  if (points.length === 0) {
    scratch.t = 0;
    scratch.x = 0;
    scratch.y = 0;
    scratch.z = 0;
    return scratch;
  }
  if (time <= points[0].t) return points[0];
  const last = points[points.length - 1];
  if (time >= last.t) return last;
  for (let i = 1; i < points.length; i += 1) {
    const next = points[i];
    const prev = points[i - 1];
    if (time <= next.t) {
      const span = next.t - prev.t || 1;
      const mix = (time - prev.t) / span;
      scratch.t = time;
      scratch.x = prev.x + (next.x - prev.x) * mix;
      scratch.y = prev.y + (next.y - prev.y) * mix;
      scratch.z = prev.z + (next.z - prev.z) * mix;
      return scratch;
    }
  }
  return last;
}

function toWorld(point: FlightPoint): [number, number, number] {
  return [ballSpot.x + point.y * yard, ballSpot.y + point.z * yard, ballSpot.z - point.x * yard];
}

export function stepShot(
  hold: FlightHold | null,
  ball: Mesh | null,
  tracer: Line,
  positions: Float32Array,
  age: number,
  reduce: boolean,
): FlightHold | null {
  if (!hold || !ball) return null;
  const points = hold.shot.trajectory;
  const spot = pointAt(points, reduce ? points[points.length - 1].t : age);
  ball.position.set(ballSpot.x + spot.y * yard, ballSpot.y + spot.z * yard, ballSpot.z - spot.x * yard);
  ball.visible = true;

  const limit = Math.min(points.length, 600);
  if (!hold.tracerReady) {
    for (let i = 0; i < limit; i += 1) {
      const place = toWorld(points[i]);
      positions[i * 3] = place[0];
      positions[i * 3 + 1] = place[1];
      positions[i * 3 + 2] = place[2];
    }
    hold.tracerReady = true;
    hold.shown = 0;
    hold.landAt = landingTime(points);
    tracer.geometry.getAttribute("position").needsUpdate = true;
  }
  let count = limit;
  if (!reduce) {
    count = hold.shown;
    while (count < limit && points[count].t <= age) count += 1;
    hold.shown = count;
  }
  tracer.geometry.setDrawRange(0, Math.max(count, 0));
  const material = tracer.material as { opacity: number };
  const fade = Math.max(0, age - (reduce ? 0.6 : hold.landAt)) / range.fadeSeconds;
  material.opacity = Math.max(0, 1 - fade);
  if (!hold.reported && (reduce || age >= hold.landAt)) {
    hold.reported = true;
    return hold;
  }
  return null;
}

export function stepCamera(
  camera: PerspectiveCamera,
  look: { x: number; y: number; z: number },
  hold: FlightHold | null,
  age: number,
  delta: number,
  reduce: boolean,
  home: { position: [number, number, number]; look: [number, number, number] },
) {
  const homeLook = home.look;
  let goalX = home.position[0];
  let goalY = home.position[1];
  let goalZ = home.position[2];
  let lookX = homeLook[0];
  let lookY = homeLook[1];
  let lookZ = homeLook[2];
  if (!reduce && hold) {
    const land = landingTime(hold.shot.trajectory);
    const back = Math.min(1, Math.max(0, (age - land) / 1.6));
    const spot = pointAt(hold.shot.trajectory, age);
    const [x, y, z] = toWorld(spot);
    const follow = 1 - back;
    goalX = home.position[0] * back + x * 0.25 * follow;
    goalY = home.position[1] * back + (y + 2.2) * follow;
    goalZ = home.position[2] * back + (z + 8) * follow;
    lookX = homeLook[0] * back + x * follow;
    lookY = homeLook[1] * back + y * follow;
    lookZ = homeLook[2] * back + z * follow;
  }
  const ease = reduce ? 1 : 1 - Math.exp(-delta * 2.2);
  camera.position.x += (goalX - camera.position.x) * ease;
  camera.position.y += (goalY - camera.position.y) * ease;
  camera.position.z += (goalZ - camera.position.z) * ease;
  look.x += (lookX - look.x) * ease;
  look.y += (lookY - look.y) * ease;
  look.z += (lookZ - look.z) * ease;
  camera.lookAt(look.x, look.y, look.z);
}
