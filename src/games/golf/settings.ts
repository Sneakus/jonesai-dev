/** Plain numbers for the ball-flight kit. No colours or visitor copy. */

export const flightSettings = {
  /** Centred driver smash: 167 mph ball speed from 113 mph club speed. */
  smash: 167 / 113,
  /** Reference club speed the spin number is quoted at. */
  referenceClubSpeed: 113,
  baseLaunchDeg: 11,
  baseSpinRpm: 2700,
  /** Start direction is mostly the face, with a little of the path. */
  faceShare: 0.85,
  pathShare: 0.15,
  /** How much a full heel or toe strike leans the spin axis, in degrees. Toe is hook (negative). */
  strikeAxisDeg: 8,
  /** Speed lost at a full heel or toe strike, as a fraction of ball speed. */
  strikeSpeedLoss: 0.08,
  /** Strike height below this is fat. Above the thin and top lines are those strikes. Past the air line is a miss. */
  fatHeight: -0.55,
  thinHeight: 0.4,
  topHeight: 0.75,
  airHeight: 1.15,
  /** Offset past this misses the face entirely. */
  airOffset: 1.15,
  fatSpeedScale: 0.55,
  fatSpinScale: 2.1,
  fatLaunchAdd: 4,
  thinSpeedScale: 0.92,
  thinSpinScale: 0.25,
  thinLaunch: 3,
  topSpeedScale: 0.7,
  topSpinScale: 0.05,
  topLaunch: 0.6,
  ballMass: 0.04593,
  ballRadius: 0.02135,
  airDensity: 1.225,
  gravity: 9.80665,
  /** Drag coefficient at low and high speed. High speed is lower (the ball's dimples). */
  dragCdSlow: 0.32,
  dragCdFast: 0.13,
  /** Speed (m/s) where drag is halfway between those two. */
  dragMidSpeed: 66,
  dragWidth: 6,
  /** Lift grows with spin. Tuned so the two calibration drives land in range. */
  liftK: 2.45,
  liftCap: 0.35,
  /** Spin lost per second, as a fraction of the current spin. */
  spinDecay: 0.04,
  /** Seconds. Fixed step for the flight sum. */
  dt: 0.002,
  maxTime: 15,
  bounceRestitution: 0.35,
  bounceGrip: 0.45,
  rollDecel: 4.5,
  stopSpeed: 0.4,
  /** How often a point is kept for drawing. The sum still uses dt. */
  sampleDt: 0.02,
};

export const outcomeSettings = {
  /** Strike height and offset use the same -1 to 1 feel as the flight inputs. */
  fatHeight: flightSettings.fatHeight,
  thinHeight: flightSettings.thinHeight,
  topHeight: flightSettings.topHeight,
  airHeight: flightSettings.airHeight,
  airOffset: flightSettings.airOffset,
  /** Heel or toe once the strike is this far off centre. */
  heelToe: 0.45,
  /** Start direction, degrees. Past this, the ball has begun left or right. */
  startFaultDeg: 3,
  /** Curve, yards. Past this it is a slice or a hook, not a draw or a fade. */
  curveFaultYards: 12,
  /** Curve, yards, before a shot counts as a draw or a fade. */
  shapeYards: 4,
};

/** Numbers for the 3D range. Colours and words live in theme.ts. */
export const rangeSettings = {
  /** Ball on the tee. The range runs toward -Z. Matches the signed-off swing. */
  ball: [0, 0.046, 0] as [number, number, number],
  cameraHome: [0, 1.5, 3.5] as [number, number, number],
  cameraLook: [0, 0.8, -16.5] as [number, number, number],
  yards: [100, 150, 200, 250, 300],
  yardToMetre: 0.9144,
  fadeSeconds: 1.4,
};
