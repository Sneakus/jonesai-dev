import { Vec } from "./swing-vec";

const deg = Math.PI / 180;
const CLUB = 1.12;
const ballHome = new Vec(0, 0.046, 0);
const dp = new Vec(0.743, -0.669, 0).normalize();
const away = new Vec(0, 0, 1);

export function clubDirAt(gDeg: number) {
  const g = gDeg * deg;
  return dp
    .clone()
    .multiplyScalar(Math.cos(g))
    .addScaledVector(away, Math.sin(g))
    .normalize();
}

const clubTarget = ballHome.clone().add(new Vec(0, 0, 0.03));
const addressHands = clubTarget.clone().addScaledVector(clubDirAt(0), -CLUB);
const impactHands = clubTarget.clone().addScaledVector(clubDirAt(6), -CLUB);

type Key = [number, number | number[]];

/** Every body part's keys, copied from the signed-off prototype. */
export const swingKeys: Record<string, Key[]> = {
  g: [
    [0, 0],
    [0.3, 90],
    [0.5, 175],
    [0.79, 268],
    [0.88, 215],
    [0.945, 95],
    [0.98, 6],
    [1.03, -90],
    [1.12, -175],
    [1.38, -250],
  ],
  H: [
    [0, addressHands.toArray()],
    [0.3, [-0.88, 0.8, 0.4]],
    [0.5, [-0.84, 1.1, 0.66]],
    [0.76, [-0.93, 1.56, 0.47]],
    [0.85, [-0.95, 1.37, 0.5]],
    [0.91, [-0.92, 1.1, 0.46]],
    [0.95, [-0.86, 0.88, 0.22]],
    [0.98, impactHands.toArray()],
    [1.04, [-0.8, 0.92, -0.3]],
    [1.14, [-1.045, 1.448, -0.516]],
    [1.38, [-1.018, 1.653, 0.233]],
  ],
  sy: [
    [0, 0],
    [0.3, -25],
    [0.5, -50],
    [0.74, -92],
    [0.86, -65],
    [0.98, 20],
    [1.06, 55],
    [1.16, 85],
    [1.38, 110],
  ],
  py: [
    [0, 0],
    [0.3, -10],
    [0.5, -25],
    [0.7, -45],
    [0.8, -30],
    [0.98, 40],
    [1.06, 55],
    [1.16, 70],
    [1.38, 88],
  ],
  P: [
    [0, [-1.07, 0.88, 0.19]],
    [0.7, [-1.08, 0.89, 0.22]],
    [0.84, [-1.06, 0.86, 0.15]],
    [0.98, [-1.04, 0.88, 0.1]],
    [1.1, [-0.97, 0.91, 0.05]],
    [1.38, [-0.9, 0.93, 0.01]],
  ],
  tilt: [
    [0, 38],
    [0.98, 39],
    [1.05, 34],
    [1.15, 22],
    [1.38, -6],
  ],
  sb: [
    [0, 30],
    [0.3, 18],
    [0.5, 0],
    [0.76, 0],
    [0.88, 18],
    [0.98, 35],
    [1.06, 24],
    [1.18, 8],
    [1.38, 0],
  ],
  lift: [
    [0, 0],
    [0.98, 0.01],
    [1.06, 0.04],
    [1.18, 0.08],
    [1.38, 0.1],
  ],
};

function value(keys: Key[], index: number) {
  const item = keys[index][1];
  return Array.isArray(item) ? item : [item];
}

function slope(keys: Key[], index: number) {
  if (index === 0 || index === keys.length - 1) return value(keys, index).map(() => 0);
  const before = value(keys, index - 1);
  const after = value(keys, index + 1);
  const dt = keys[index + 1][0] - keys[index - 1][0];
  return before.map((_, part) => (after[part] - before[part]) / dt);
}

/** Smooth cubic blend through the keys, still at the start and the finish. */
export function sampleSwing(field: string, t: number) {
  const keys = swingKeys[field];
  if (t <= keys[0][0]) return value(keys, 0);
  if (t >= keys[keys.length - 1][0]) return value(keys, keys.length - 1);
  let index = 0;
  while (index < keys.length - 2 && t > keys[index + 1][0]) index += 1;
  const t0 = keys[index][0];
  const span = keys[index + 1][0] - t0;
  const s = (t - t0) / span;
  const v0 = value(keys, index);
  const v1 = value(keys, index + 1);
  const m0 = slope(keys, index);
  const m1 = slope(keys, index + 1);
  const s2 = s * s;
  const s3 = s2 * s;
  const a = 2 * s3 - 3 * s2 + 1;
  const b = s3 - 2 * s2 + s;
  const c = -2 * s3 + 3 * s2;
  const d = s3 - s2;
  return v0.map((_, part) => a * v0[part] + b * span * m0[part] + c * v1[part] + d * span * m1[part]);
}
