import type { AnimationAction, Line, Mesh, Object3D, PerspectiveCamera } from "three";
import { LoopOnce, Vector3 } from "three";
import type { FlightPoint, FlightResult } from "./flight";
import { rangeSettings as range } from "./settings";

export type FlightHold = {
  shot: FlightResult;
  born: number;
  reported: boolean;
};

const yard = range.yardToMetre;

export const ballSpot = { x: range.ball[0], y: range.ball[1], z: range.ball[2] };

export function setBallSpot(y: number) {
  ballSpot.x = range.ball[0];
  ballSpot.y = y;
  ballSpot.z = range.ball[2];
}

const down = new Vector3();
const gripTop = new Vector3();
const headPoint = new Vector3();
const shaftUp = new Vector3(0, 1, 0);

export function clubEnds(left: Vector3, right: Vector3, grip: Vector3, head: Vector3) {
  down.subVectors(right, left);
  if (down.lengthSq() < 1e-8) down.set(0, -1, 0);
  down.normalize();
  grip.copy(left).addScaledVector(down, -range.gripOffset);
  head.copy(grip).addScaledVector(down, range.gripLength + range.shaftLength);
}

export function aimClub(club: Object3D, left: Vector3, right: Vector3) {
  clubEnds(left, right, gripTop, headPoint);
  club.position.copy(gripTop);
  club.quaternion.setFromUnitVectors(shaftUp, down);
  club.updateMatrixWorld();
}

export function clubheadPosition(left: Vector3, right: Vector3, target: Vector3) {
  clubEnds(left, right, gripTop, target);
}

/** Yaw and shift so the impact clubhead meets the ball and the feet sit on the mat. */
export function plantGolfer(leftHand: Vector3, rightHand: Vector3, leftShoulder: Vector3, rightShoulder: Vector3, footY: number) {
  const across = new Vector3().subVectors(rightShoulder, leftShoulder);
  across.y = 0;
  if (across.lengthSq() < 1e-8) across.set(-1, 0, 0);
  const forward = new Vector3().crossVectors(new Vector3(0, 1, 0), across);
  if (forward.lengthSq() < 1e-8) forward.set(0, 0, 1);
  forward.normalize();
  const yaw = -Math.atan2(forward.x, forward.z);
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const turn = (v: Vector3) => new Vector3(v.x * cos + v.z * sin, v.y, -v.x * sin + v.z * cos);
  const head = new Vector3();
  clubheadPosition(leftHand, rightHand, head);
  const turned = turn(head);
  return {
    yaw,
    x: ballSpot.x - turned.x,
    y: -footY,
    z: ballSpot.z - turned.z,
    ballY: turned.y - footY,
  };
}

export function holdFrame(action: AnimationAction, time: number) {
  action.play();
  action.paused = true;
  action.time = time;
}

export function scrubFrame(action: AnimationAction, fraction: number) {
  const clip = action.getClip();
  action.paused = true;
  action.time = fraction * (clip?.duration || 1);
}

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
  return [ballSpot.x - point.y * yard, ballSpot.y + point.z * yard, ballSpot.z + point.x * yard];
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
