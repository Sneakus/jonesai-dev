import { rangeSettings as range } from "./settings";
import { LEAD_TOE, SWING_END, swingPose, TRAIL_TOE } from "./swing-pose";

/** Vertical lens angle, degrees. Same as the range canvas. */
export const SWING_FOV = 42;

/** How far from the edge a point may sit. 0.78 leaves a clear margin. */
const FRAME = 0.78;

const places = [
  "H",
  "head",
  "hosel",
  "S",
  "P",
  "neck",
  "headPos",
  "leadSh",
  "trailSh",
  "leadHip",
  "trailHip",
  "leadElbow",
  "leadWrist",
  "trailElbow",
  "trailWrist",
  "leadKnee",
  "leadAnkle",
  "trailKnee",
  "trailAnkle",
] as const;

type Point = { x: number; y: number; z: number };

function add(points: Point[], x: number, y: number, z: number) {
  points.push({ x, y, z });
}

function pad(points: Point[], at: Point, radius: number) {
  add(points, at.x + radius, at.y, at.z);
  add(points, at.x - radius, at.y, at.z);
  add(points, at.x, at.y + radius, at.z);
  add(points, at.x, at.y - radius, at.z);
  add(points, at.x, at.y, at.z + radius);
  add(points, at.x, at.y, at.z - radius);
}

/** Joints, clubhead, ball, tee, mat and a strip of grass, for the whole swing. */
export function swingFramePoints(): Point[] {
  const points: Point[] = [];
  const steps = Math.round(SWING_END / 0.02);
  for (let i = 0; i <= steps; i += 1) {
    const pose = swingPose((SWING_END * i) / steps);
    for (const name of places) {
      const at = pose[name];
      add(points, at.x, at.y, at.z);
    }
    pad(points, pose.head, 0.07);
    pad(points, pose.headPos, 0.11);
    add(points, LEAD_TOE.x, LEAD_TOE.y, LEAD_TOE.z);
    add(points, TRAIL_TOE.x, TRAIL_TOE.y, TRAIL_TOE.z);
  }
  const [bx, by, bz] = range.ball;
  pad(points, { x: bx, y: by, z: bz }, 0.03);
  const matX = -0.55;
  const matZ = 0.2;
  for (const x of [matX - 0.85, matX + 0.85]) {
    for (const z of [matZ - 0.65, matZ + 0.65]) add(points, x, 0, z);
  }
  for (const x of [matX - 0.85, 0, matX + 0.85]) add(points, x, 0, matZ + 0.65 + 0.4);
  return points;
}

function cross(a: Point, b: Point): Point {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function unit(v: Point): Point {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

function dot(a: Point, b: Point) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function projectSwing(
  point: Point,
  camera: Point,
  look: Point,
  aspect: number,
  fov = SWING_FOV,
): { x: number; y: number; depth: number } {
  const forward = unit({ x: look.x - camera.x, y: look.y - camera.y, z: look.z - camera.z });
  const right = unit(cross(forward, { x: 0, y: 1, z: 0 }));
  const up = cross(right, forward);
  const from = { x: point.x - camera.x, y: point.y - camera.y, z: point.z - camera.z };
  const depth = dot(from, forward);
  const tanV = Math.tan((fov * Math.PI) / 180 / 2);
  const tanH = tanV * aspect;
  return {
    x: dot(from, right) / depth / tanH,
    y: dot(from, up) / depth / tanV,
    depth,
  };
}

function widest(points: Point[], camera: Point, look: Point, aspect: number) {
  let edge = 0;
  for (const point of points) {
    const placed = projectSwing(point, camera, look, aspect);
    if (placed.depth < 0.3) return Infinity;
    edge = Math.max(edge, Math.abs(placed.x), Math.abs(placed.y));
  }
  return edge;
}

export type SwingFrame = {
  position: [number, number, number];
  look: [number, number, number];
};

/** Camera on the target line, behind the ball, pulled back until the swing fits. */
export function fitSwingCamera(aspect: number): SwingFrame {
  const points = swingFramePoints();
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const point of points) {
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }
  const lookY = (minY + maxY) / 2;
  const lookZ = (minZ + maxZ) / 2;
  const safeAspect = Math.max(0.4, aspect);
  let bestPitch = 0.2;
  let bestDist = 40;
  for (let step = 0; step <= 50; step += 1) {
    const pitch = 0.04 + step * 0.01;
    let low = 1.5;
    let high = 40;
    for (let i = 0; i < 18; i += 1) {
      const dist = (low + high) / 2;
      const camera = {
        x: 0,
        y: lookY + Math.sin(pitch) * dist,
        z: lookZ + Math.cos(pitch) * dist,
      };
      const look = { x: 0, y: lookY, z: lookZ };
      if (widest(points, camera, look, safeAspect) <= FRAME) high = dist;
      else low = dist;
    }
    if (high < bestDist) {
      bestDist = high;
      bestPitch = pitch;
    }
  }
  return {
    position: [
      0,
      lookY + Math.sin(bestPitch) * bestDist,
      lookZ + Math.cos(bestPitch) * bestDist,
    ],
    look: [0, lookY, lookZ],
  };
}

/** Same lens as the prototype driving range. */
export const GAME_FOV = 50;

const gameLook = { x: -0.35, y: 0.2, z: -10 };
const gameHome = { x: -0.35, y: 1.55, z: 3.6 };

function fitsGame(points: Point[], camera: Point, look: Point, aspect: number) {
  for (const point of points) {
    const placed = projectSwing(point, camera, look, aspect, GAME_FOV);
    if (placed.depth < 0.3 || Math.abs(placed.x) > 1 || Math.abs(placed.y) > 1) return false;
  }
  return true;
}

/** Prototype camera. On a narrow picture, pull straight back until the golfer and club fit. */
export function placeGameCamera(aspect: number): SwingFrame {
  const look = gameLook;
  const home = gameHome;
  if (aspect >= 1 || fitsGame(swingFramePoints(), home, look, aspect)) {
    return {
      position: [home.x, home.y, home.z],
      look: [look.x, look.y, look.z],
    };
  }
  const backX = home.x - look.x;
  const backY = home.y - look.y;
  const backZ = home.z - look.z;
  const base = Math.hypot(backX, backY, backZ);
  const points = swingFramePoints();
  let low = base;
  let high = base * 2.4;
  for (let step = 0; step < 16; step += 1) {
    const dist = (low + high) / 2;
    const camera = {
      x: look.x + (backX / base) * dist,
      y: look.y + (backY / base) * dist,
      z: look.z + (backZ / base) * dist,
    };
    if (fitsGame(points, camera, look, aspect)) high = dist;
    else low = dist;
  }
  return {
    position: [
      look.x + (backX / base) * high,
      look.y + (backY / base) * high,
      look.z + (backZ / base) * high,
    ],
    look: [look.x, look.y, look.z],
  };
}
