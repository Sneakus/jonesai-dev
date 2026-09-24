export const swingSettings = {
  gravity: 2400,
  armLength: 78,
  clubLength: 86,
  armMass: 1.1,
  clubMass: 0.85,
  spring: 42,
  armDamp: 4.2,
  clubDamp: 1.6,
  bodyFollow: 0.35,
  bodyDamp: 6,
  bodyLimit: 0.35,
  sweetSpeed: 0.85,
  minYards: 160,
  yardSpan: 80,
  hitRadius: 46,
  raised: 36,
  fatBelow: 18,
  thinAbove: 16,
  topAbove: 34,
  pathSquare: 8,
  faceSquare: 7,
  heelOut: 26,
  toeIn: 22,
  heelCurve: 4,
  toeCurve: 4,
  heelKeep: 0.86,
  toeKeep: 0.86,
  fatKeep: 0.55,
  thinKeep: 0.72,
  topKeep: 0.12,
  startFault: 7,
  curveFault: 9,
  goodStart: 7,
  drawMin: 3,
  pathGain: 0.55,
  faceGain: 0.7,
  pathMax: 14,
  faceMax: 16,
  airSlow: 0.45,
  airHard: 0.95,
  freezeMs: 150,
  reteeMs: 1500,
  flightMs: 1100,
  horizonYards: 280,
  halfWidthYards: 46,
};

export type SwingPose = {
  arm: number;
  armSpeed: number;
  club: number;
  clubSpeed: number;
  body: number;
  bodySpeed: number;
};

export type Point = { x: number; y: number };

export function restPose(): SwingPose {
  return { arm: 0.15, armSpeed: 0, club: 0.05, clubSpeed: 0, body: 0, bodySpeed: 0 };
}

export function joints(pose: SwingPose, shoulder: Point, settings = swingSettings) {
  const hands = {
    x: shoulder.x + Math.sin(pose.arm) * settings.armLength,
    y: shoulder.y + Math.cos(pose.arm) * settings.armLength,
  };
  const head = {
    x: hands.x + Math.sin(pose.club) * settings.clubLength,
    y: hands.y + Math.cos(pose.club) * settings.clubLength,
  };
  const elbow = {
    x: shoulder.x + Math.sin(pose.arm) * settings.armLength * 0.48 + Math.cos(pose.arm) * 10,
    y: shoulder.y + Math.cos(pose.arm) * settings.armLength * 0.48 - Math.sin(pose.arm) * 8,
  };
  return { hands, elbow, head };
}

export function clubheadVelocity(pose: SwingPose, settings = swingSettings) {
  const vx =
    Math.cos(pose.arm) * settings.armLength * pose.armSpeed +
    Math.cos(pose.club) * settings.clubLength * pose.clubSpeed;
  const vy =
    -Math.sin(pose.arm) * settings.armLength * pose.armSpeed -
    Math.sin(pose.club) * settings.clubLength * pose.clubSpeed;
  return { vx, vy, speed: Math.hypot(vx, vy) };
}

export function stepSwing(
  pose: SwingPose,
  shoulder: Point,
  pointer: Point | null,
  dt: number,
  settings = swingSettings,
) {
  const step = Math.min(dt, 0.032);
  const { head } = joints(pose, shoulder, settings);
  let fx = 0;
  let fy = 0;
  if (pointer) {
    fx = settings.spring * (pointer.x - head.x);
    fy = settings.spring * (pointer.y - head.y);
  }
  const armInertia = settings.armMass * settings.armLength * settings.armLength;
  const clubInertia = settings.clubMass * settings.clubLength * settings.clubLength;
  const armTorque =
    -Math.sin(pose.arm) * (settings.armMass * 0.5 + settings.clubMass) * settings.gravity * settings.armLength +
    settings.armLength * (Math.cos(pose.arm) * fx - Math.sin(pose.arm) * fy) -
    settings.armDamp * pose.armSpeed * armInertia;
  const clubTorque =
    -Math.sin(pose.club) * settings.clubMass * settings.gravity * settings.clubLength * 0.5 +
    settings.clubMass * settings.armLength * settings.clubLength * pose.armSpeed * pose.armSpeed * Math.sin(pose.arm - pose.club) +
    settings.clubLength * (Math.cos(pose.club) * fx - Math.sin(pose.club) * fy) -
    settings.clubDamp * pose.clubSpeed * clubInertia;
  pose.armSpeed += (armTorque / armInertia) * step;
  pose.clubSpeed += (clubTorque / clubInertia) * step;
  pose.arm += pose.armSpeed * step;
  pose.club += pose.clubSpeed * step;
  pose.bodySpeed += (pose.armSpeed * settings.bodyFollow - pose.bodySpeed * settings.bodyDamp) * step;
  pose.body += pose.bodySpeed * step;
  pose.body = Math.max(-settings.bodyLimit, Math.min(settings.bodyLimit, pose.body));
}
