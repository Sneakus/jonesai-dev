import {
  activeClayFeel,
  planHardRound,
  setClayFeel,
  type HardThrowKind,
} from "./clay-feel";
import {
  chooseFairThrow,
  lookOf,
  pickNormalThrow,
  pickSize,
  settings,
  stepClay,
  type Clay,
  type LaunchBox,
  type ThrowKind,
} from "./clay-throws";

export type DifficultySample = {
  kind: ThrowKind;
  size: number;
  hit: number;
  speed: number;
  shootable: number;
  fallback: boolean;
};

export type DifficultyReport = {
  label: string;
  coarse: boolean;
  hard: boolean;
  rounds: number;
  samples: number;
  avgSize: number;
  avgHit: number;
  avgSpeed: number;
  avgShootable: number;
  fallbackRate: number;
  kinds: Record<string, number>;
  feel: { draw: number; hit: number; speed: number };
};

function measureFlight(source: Clay, box: LaunchBox) {
  const ghost: Clay = { ...source };
  const dt = 1 / 60;
  let total = 0;
  let insideTime = 0;
  let path = 0;
  let sizeSum = 0;
  let hitSum = 0;
  let samples = 0;
  const marginX = box.width * settings.fairMargin;
  const marginY = box.height * settings.fairMargin;
  const feel = activeClayFeel();
  while (total < 8) {
    const look = lookOf(ghost);
    const hitX = (look.rx + settings.hitAreaSize) * feel.hit;
    const hitY = (look.ry + settings.hitAreaSize) * feel.hit;
    const inside =
      ghost.x >= marginX &&
      ghost.x <= box.width - marginX &&
      ghost.y >= marginY &&
      ghost.y <= box.height - marginY;
    if (inside) {
      insideTime += dt;
      sizeSum += Math.max(look.rx, look.ry) * 2;
      hitSum += Math.max(hitX, hitY) * 2;
      samples += 1;
    }
    const beforeX = ghost.x;
    const beforeY = ghost.y;
    stepClay(ghost, dt, box.width, box.height);
    path += Math.hypot(ghost.x - beforeX, ghost.y - beforeY);
    total += dt;
    if (
      ghost.x < -200 ||
      ghost.x > box.width + 200 ||
      ghost.y < -200 ||
      ghost.y > box.height + 200
    ) {
      break;
    }
  }
  return {
    shootable: insideTime,
    size: samples ? sizeSum / samples : 0,
    hit: samples ? hitSum / samples : 0,
    speed: total > 0 ? path / total : 0,
  };
}

function pickKind(hard: boolean, plan: HardThrowKind[], index: number): ThrowKind {
  if (hard) {
    return plan[index] || "crosser";
  }
  return pickNormalThrow();
}

/** Simulate rounds and measure how hard each mode really is. */
export function runDifficultyReport(options: {
  rounds?: number;
  coarse: boolean;
  hard: boolean;
  box: LaunchBox;
  label: string;
}): DifficultyReport {
  const rounds = options.rounds ?? 1000;
  setClayFeel(options.coarse, options.hard);
  const feel = activeClayFeel();
  const samples: DifficultySample[] = [];
  const kinds: Record<string, number> = {};
  let fallbacks = 0;

  for (let round = 0; round < rounds; round += 1) {
    const plan = options.hard ? planHardRound(settings.claysPerRound) : [];
    for (let index = 0; index < settings.claysPerRound; index += 1) {
      const kind = pickKind(options.hard, plan, index);
      const chosen = chooseFairThrow(kind, options.box, pickSize(), {
        hard: options.hard,
      });
      if (!chosen.clay) {
        continue;
      }
      if (chosen.fallback) {
        fallbacks += 1;
      }
      const flight = measureFlight(chosen.clay, options.box);
      samples.push({
        kind: chosen.clay.kind,
        size: flight.size,
        hit: flight.hit,
        speed: flight.speed,
        shootable: flight.shootable,
        fallback: chosen.fallback,
      });
      kinds[chosen.clay.kind] = (kinds[chosen.clay.kind] || 0) + 1;
    }
  }

  const count = Math.max(1, samples.length);
  return {
    label: options.label,
    coarse: options.coarse,
    hard: options.hard,
    rounds,
    samples: samples.length,
    avgSize: samples.reduce((sum, item) => sum + item.size, 0) / count,
    avgHit: samples.reduce((sum, item) => sum + item.hit, 0) / count,
    avgSpeed: samples.reduce((sum, item) => sum + item.speed, 0) / count,
    avgShootable:
      samples.reduce((sum, item) => sum + item.shootable, 0) / count,
    fallbackRate: samples.length ? fallbacks / samples.length : 1,
    kinds,
    feel: { ...feel },
  };
}

export function compareDifficulty(
  normal: DifficultyReport,
  hard: DifficultyReport,
) {
  return {
    smaller: hard.avgSize < normal.avgSize,
    faster: hard.avgSpeed > normal.avgSpeed,
    shorterShootable: hard.avgShootable < normal.avgShootable,
    hardFallbackUnder5: hard.fallbackRate < 0.05,
    hitShrinks: hard.avgHit < normal.avgHit,
  };
}
