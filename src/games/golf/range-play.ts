import type { AnimationAction, Line, Mesh, PerspectiveCamera } from "three";
import { LoopOnce } from "three";
import type { FlightPoint, FlightResult } from "./flight";
import { rangeSettings as range } from "./settings";

export type FlightHold = {
  shot: FlightResult;
  born: number;
  reported: boolean;
};

const yard = range.yardToMetre;

export function armClip(action: AnimationAction, play: boolean) {
  action.reset();
  action.setLoop(LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  if (!play) {
    action.paused = true;
    action.time = 0;
  }
}

export function landingTime(points: FlightPoint[]): number {
  let airborne = false;
  for (const point of points) {
    if (point.z > 0.4) airborne = true;
    if (airborne && point.z < 0.08) return point.t;
  }
  return points[points.length - 1]?.t ?? 0;
}

function pointAt(points: FlightPoint[], time: number): FlightPoint {
  if (points.length === 0) return { t: 0, x: 0, y: 0, z: 0 };
  if (time <= points[0].t) return points[0];
  const last = points[points.length - 1];
  if (time >= last.t) return last;
  for (let i = 1; i < points.length; i += 1) {
    const next = points[i];
    const prev = points[i - 1];
    if (time <= next.t) {
      const span = next.t - prev.t || 1;
      const mix = (time - prev.t) / span;
      return {
        t: time,
        x: prev.x + (next.x - prev.x) * mix,
        y: prev.y + (next.y - prev.y) * mix,
        z: prev.z + (next.z - prev.z) * mix,
      };
    }
  }
  return last;
}

function toWorld(point: FlightPoint): [number, number, number] {
  const [bx, by, bz] = range.ball;
  return [bx - point.y * yard, by + point.z * yard, bz + point.x * yard];
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
  const [x, y, z] = toWorld(spot);
  ball.position.set(x, y, z);
  ball.visible = true;

  const land = landingTime(points);
  const drawn = reduce ? points.length : points.filter((point) => point.t <= age).length;
  const count = Math.max(2, Math.min(drawn, 600));
  for (let i = 0; i < count; i += 1) {
    const sample = points[Math.min(i, points.length - 1)];
    const place = toWorld(sample);
    positions[i * 3] = place[0];
    positions[i * 3 + 1] = place[1];
    positions[i * 3 + 2] = place[2];
  }
  const attribute = tracer.geometry.getAttribute("position");
  attribute.needsUpdate = true;
  tracer.geometry.setDrawRange(0, count);
  const material = tracer.material as { opacity: number };
  const fade = Math.max(0, age - (reduce ? 0.6 : land)) / range.fadeSeconds;
  material.opacity = Math.max(0, 1 - fade);
  if (!hold.reported && (reduce || age >= land)) {
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
) {
  const home = range.cameraHome;
  const homeLook = range.cameraLook;
  let goalX = home[0];
  let goalY = home[1];
  let goalZ = home[2];
  let lookX = homeLook[0];
  let lookY = homeLook[1];
  let lookZ = homeLook[2];
  if (!reduce && hold) {
    const land = landingTime(hold.shot.trajectory);
    const back = Math.min(1, Math.max(0, (age - land) / 1.6));
    const spot = pointAt(hold.shot.trajectory, age);
    const [x, y, z] = toWorld(spot);
    const follow = 1 - back;
    goalX = home[0] * back + x * 0.25 * follow;
    goalY = home[1] * back + (y + 2.2) * follow;
    goalZ = home[2] * back + (z - 7) * follow;
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
