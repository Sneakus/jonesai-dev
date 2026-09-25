import { flightSettings as s } from "./settings";

export type FlightInput = {
  /** Clubhead speed in miles per hour. */
  clubSpeed: number;
  /** Face angle in degrees. Positive points right. */
  face: number;
  /** Swing path in degrees. Positive points right. */
  path: number;
  /** Across the face. Negative is heel, positive is toe, 0 is the middle. */
  strikeOffset: number;
  /** Up the face. Negative is low, positive is high, 0 is the middle. */
  strikeHeight: number;
};

export type FlightPoint = {
  t: number;
  /** Yards down the range. */
  x: number;
  /** Yards right of the target line. */
  y: number;
  /** Yards above the ground. */
  z: number;
};

export type FlightResult = {
  ballSpeed: number;
  launchAngle: number;
  spinRate: number;
  /** Degrees. Positive curves right. */
  spinAxis: number;
  /** Degrees. Positive starts right. */
  startDirection: number;
  trajectory: FlightPoint[];
  /** Yards to the first bounce. */
  carry: number;
  /** Yards to where it stops. */
  total: number;
  /** Yards right of the target line at the finish. */
  offline: number;
};

const MPH_TO_MS = 0.44704;
const YARD = 0.9144;
const RPM_TO_RAD = (2 * Math.PI) / 60;

type Launch = {
  ballSpeed: number;
  launchAngle: number;
  spinRate: number;
  spinAxis: number;
  startDirection: number;
  moving: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function launchFrom(input: FlightInput): Launch {
  const offset = input.strikeOffset;
  const height = input.strikeHeight;
  const missed = height >= s.airHeight || height <= -s.airHeight || Math.abs(offset) >= s.airOffset;
  if (missed || input.clubSpeed <= 0) {
    return {
      ballSpeed: 0,
      launchAngle: 0,
      spinRate: 0,
      spinAxis: 0,
      startDirection: 0,
      moving: false,
    };
  }

  const startDirection = s.faceShare * input.face + s.pathShare * input.path;
  const faceToPath = input.face - input.path;
  const spinAxis = faceToPath - offset * s.strikeAxisDeg;

  let speedScale = 1 - Math.min(1, Math.abs(offset)) * s.strikeSpeedLoss;
  let spinScale = input.clubSpeed / s.referenceClubSpeed;
  let launch = s.baseLaunchDeg;

  if (height <= s.fatHeight) {
    const deep = clamp((s.fatHeight - height) / (s.airHeight + s.fatHeight), 0, 1);
    speedScale *= s.fatSpeedScale - deep * 0.2;
    spinScale *= s.fatSpinScale + deep;
    launch += s.fatLaunchAdd + deep * 6;
  } else if (height >= s.topHeight) {
    speedScale *= s.topSpeedScale;
    spinScale *= s.topSpinScale;
    launch = s.topLaunch;
  } else if (height >= s.thinHeight) {
    const amount = clamp((height - s.thinHeight) / (s.topHeight - s.thinHeight), 0, 1);
    speedScale *= s.thinSpeedScale;
    spinScale *= s.thinSpinScale + (1 - amount) * 0.15;
    launch = s.thinLaunch + (1 - amount) * 2;
  }

  const ballSpeed = Math.max(0, input.clubSpeed * s.smash * speedScale);
  const spinRate = Math.max(0, s.baseSpinRpm * spinScale);

  return { ballSpeed, launchAngle: launch, spinRate, spinAxis, startDirection, moving: ballSpeed > 0 };
}

function dragCd(speed: number): number {
  const t = 1 / (1 + Math.exp(-(speed - s.dragMidSpeed) / s.dragWidth));
  return s.dragCdSlow + (s.dragCdFast - s.dragCdSlow) * t;
}

type State = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  w: number;
};

function derive(state: State, axis: number): State {
  const speed = Math.hypot(state.vx, state.vy, state.vz);
  const area = Math.PI * s.ballRadius * s.ballRadius;
  let ax = 0;
  let ay = 0;
  let az = -s.gravity;
  if (speed > 0.05) {
    const cd = dragCd(speed);
    const spinParam = (state.w * s.ballRadius) / speed;
    const cl = Math.min(s.liftCap, s.liftK * spinParam);
    const drag = (0.5 * cd * s.airDensity * area * speed * speed) / s.ballMass;
    const lift = (0.5 * cl * s.airDensity * area * speed * speed) / s.ballMass;
    ax -= drag * (state.vx / speed);
    ay -= drag * (state.vy / speed);
    az -= drag * (state.vz / speed);
    const axisRad = (axis * Math.PI) / 180;
    const oy = -state.w * Math.cos(axisRad);
    const oz = state.w * Math.sin(axisRad);
    const cx = oy * state.vz - oz * state.vy;
    const cy = oz * state.vx;
    const cz = -oy * state.vx;
    const clen = Math.hypot(cx, cy, cz);
    if (clen > 1e-8) {
      ax += lift * (cx / clen);
      ay += lift * (cy / clen);
      az += lift * (cz / clen);
    }
  }
  return {
    x: state.vx,
    y: state.vy,
    z: state.vz,
    vx: ax,
    vy: ay,
    vz: az,
    w: -s.spinDecay * state.w,
  };
}

function add(a: State, b: State, scale: number): State {
  return {
    x: a.x + b.x * scale,
    y: a.y + b.y * scale,
    z: a.z + b.z * scale,
    vx: a.vx + b.vx * scale,
    vy: a.vy + b.vy * scale,
    vz: a.vz + b.vz * scale,
    w: a.w + b.w * scale,
  };
}

function rk4(state: State, axis: number, dt: number): State {
  const k1 = derive(state, axis);
  const k2 = derive(add(state, k1, dt / 2), axis);
  const k3 = derive(add(state, k2, dt / 2), axis);
  const k4 = derive(add(state, k3, dt), axis);
  return {
    x: state.x + (dt / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
    y: state.y + (dt / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
    z: state.z + (dt / 6) * (k1.z + 2 * k2.z + 2 * k3.z + k4.z),
    vx: state.vx + (dt / 6) * (k1.vx + 2 * k2.vx + 2 * k3.vx + k4.vx),
    vy: state.vy + (dt / 6) * (k1.vy + 2 * k2.vy + 2 * k3.vy + k4.vy),
    vz: state.vz + (dt / 6) * (k1.vz + 2 * k2.vz + 2 * k3.vz + k4.vz),
    w: Math.max(0, state.w + (dt / 6) * (k1.w + 2 * k2.w + 2 * k3.w + k4.w)),
  };
}

export function fly(input: FlightInput): FlightResult {
  const launch = launchFrom(input);
  const empty: FlightResult = {
    ballSpeed: launch.ballSpeed,
    launchAngle: launch.launchAngle,
    spinRate: launch.spinRate,
    spinAxis: launch.spinAxis,
    startDirection: launch.startDirection,
    trajectory: [{ t: 0, x: 0, y: 0, z: 0 }],
    carry: 0,
    total: 0,
    offline: 0,
  };
  if (!launch.moving) {
    return empty;
  }

  const speed = launch.ballSpeed * MPH_TO_MS;
  const launchRad = (launch.launchAngle * Math.PI) / 180;
  const aimRad = (launch.startDirection * Math.PI) / 180;
  const flat = speed * Math.cos(launchRad);
  let state: State = {
    x: 0,
    y: 0,
    z: 0,
    vx: flat * Math.cos(aimRad),
    vy: flat * Math.sin(aimRad),
    vz: speed * Math.sin(launchRad),
    w: launch.spinRate * RPM_TO_RAD,
  };

  const points: FlightPoint[] = [{ t: 0, x: 0, y: 0, z: 0 }];
  let carry = 0;
  let landed = false;
  let rolling = launch.launchAngle < 1;
  let sinceSample = 0;
  const dt = s.dt;

  for (let t = 0; t < s.maxTime; t += dt) {
    if (rolling) {
      const horiz = Math.hypot(state.vx, state.vy);
      if (horiz < s.stopSpeed) {
        break;
      }
      const drop = Math.min(horiz, s.rollDecel * dt);
      const scale = (horiz - drop) / horiz;
      state = { ...state, x: state.x + state.vx * dt, y: state.y + state.vy * dt, z: 0, vx: state.vx * scale, vy: state.vy * scale, vz: 0 };
    } else {
      const next = rk4(state, launch.spinAxis, dt);
      if (next.z <= 0 && next.vz < 0) {
        if (!landed) {
          carry = next.x;
          landed = true;
        }
        const bounceVz = -next.vz * s.bounceRestitution;
        const grip = 1 - s.bounceGrip;
        state = { ...next, z: 0, vz: bounceVz, vx: next.vx * grip, vy: next.vy * grip };
        if (bounceVz < 1.2) {
          rolling = true;
          state.vz = 0;
        }
      } else {
        state = next;
      }
    }

    sinceSample += dt;
    if (sinceSample >= s.sampleDt) {
      sinceSample = 0;
      points.push({
        t: t + dt,
        x: state.x / YARD,
        y: state.y / YARD,
        z: state.z / YARD,
      });
    }
  }

  if (!landed) {
    carry = state.x;
  }

  return {
    ballSpeed: launch.ballSpeed,
    launchAngle: launch.launchAngle,
    spinRate: launch.spinRate,
    spinAxis: launch.spinAxis,
    startDirection: launch.startDirection,
    trajectory: points,
    carry: carry / YARD,
    total: state.x / YARD,
    offline: state.y / YARD,
  };
}

export function withinFivePercent(actual: number, target: number): boolean {
  return Math.abs(actual - target) <= Math.abs(target) * 0.05;
}
