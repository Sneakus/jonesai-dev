import { outcomeSettings as s } from "./settings";

export type ShotShapeInput = {
  strikeOffset: number;
  strikeHeight: number;
  /** Degrees. Positive starts right. */
  startDirection: number;
  /** Yards the ball curved, on top of where it was aimed. Positive is right. */
  curve: number;
};

/** Keys match content/golf-range.md. Strike problems win, then aim and curve. */
export function shotKey(input: ShotShapeInput): string {
  const height = input.strikeHeight;
  const offset = input.strikeOffset;

  if (height >= s.airHeight || height <= -s.airHeight || Math.abs(offset) >= s.airOffset) {
    return "air-shot";
  }
  if (height >= s.topHeight) {
    return "topped";
  }
  if (height >= s.thinHeight) {
    return "thin";
  }
  if (height <= s.fatHeight) {
    return "fat";
  }
  if (offset <= -s.heelToe) {
    return "heel";
  }
  if (offset >= s.heelToe) {
    return "toe";
  }

  const start = input.startDirection;
  const curve = input.curve;
  const startedLeft = start <= -s.startFaultDeg;
  const startedRight = start >= s.startFaultDeg;
  const bigRight = curve >= s.curveFaultYards;
  const bigLeft = curve <= -s.curveFaultYards;

  if (startedLeft && bigRight) {
    return "pull-slice";
  }
  if (startedRight && bigRight) {
    return "push-slice";
  }
  if (bigRight) {
    return "slice";
  }
  if (bigLeft) {
    return "hook";
  }
  if (startedLeft) {
    return "pull";
  }
  if (startedRight) {
    return "push";
  }
  if (curve <= -s.shapeYards) {
    return "draw";
  }
  if (curve >= s.shapeYards) {
    return "fade";
  }
  return "straight";
}

/** Curve in yards: finish line minus where a straight start would have landed. */
export function curveYards(offline: number, distance: number, startDirectionDeg: number): number {
  const aimed = distance * Math.tan((startDirectionDeg * Math.PI) / 180);
  return offline - aimed;
}
