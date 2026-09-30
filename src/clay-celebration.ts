/** Timing helpers for perfect-round celebrations (normal fireworks and High gun). */

export type PerfectCelebrationSettings = {
  perfectSpinTime: number;
  perfectSweepStart: number;
  perfectSweepTime: number;
  perfectShotCount: number;
  perfectRecoilTime: number;
  perfectFireworkTravel: number;
  perfectSparkTime: number;
  winnerBannerDropTime: number;
  handSettleTime?: number;
};

/** Bigger High gun: about 7 seconds, skippable. */
export const highGunTiming = {
  slowMoMs: 1500,
  slowMoScale: 0.22,
  smokeMs: 4000,
  handLowerMs: 1200,
  shardAssembleMs: 1500,
  rosetteDropMs: 750,
  rosetteSwingMs: 2400,
  shineMs: 1000,
  bannerAfterRosetteMs: 350,
  holdAfterBannerMs: 1400,
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function perfectLastShotAt(settings: PerfectCelebrationSettings) {
  const shotCount = Math.max(1, Math.round(settings.perfectShotCount));
  const interval =
    shotCount <= 1
      ? settings.perfectSweepTime
      : settings.perfectSweepTime / (shotCount - 1);
  return {
    shotCount,
    interval,
    lastFireAt: settings.perfectSweepStart + (shotCount - 1) * interval,
  };
}

/** When the last shot's recoil and firework are both fully done. */
export function perfectActionEnd(settings: PerfectCelebrationSettings) {
  const { lastFireAt } = perfectLastShotAt(settings);
  const recoilEnd = lastFireAt + settings.perfectRecoilTime;
  const fireworkEnd =
    lastFireAt + settings.perfectFireworkTravel + settings.perfectSparkTime;
  return {
    lastFireAt,
    recoilEnd,
    fireworkEnd,
    actionEnd: Math.max(recoilEnd, fireworkEnd),
  };
}

export function perfectHandSettleTime(settings: PerfectCelebrationSettings) {
  return Math.max(1, settings.handSettleTime ?? 420);
}

/** Hand stays fully visible until the last recoil ends, then settles. */
export function perfectHandOpacity(
  elapsed: number,
  settings: PerfectCelebrationSettings,
) {
  const { recoilEnd, actionEnd } = perfectActionEnd(settings);
  const solidUntil = Math.max(recoilEnd, actionEnd);
  if (elapsed <= solidUntil) {
    return 1;
  }
  const settle = perfectHandSettleTime(settings);
  return 1 - clamp01((elapsed - solidUntil) / settle);
}

export function perfectBannerStart(settings: PerfectCelebrationSettings) {
  const { actionEnd } = perfectActionEnd(settings);
  return actionEnd + perfectHandSettleTime(settings) * 0.35;
}

export function perfectCelebrationDuration(settings: PerfectCelebrationSettings) {
  const bannerStart = perfectBannerStart(settings);
  const bannerDone = bannerStart + settings.winnerBannerDropTime;
  const { actionEnd } = perfectActionEnd(settings);
  const handGone = actionEnd + perfectHandSettleTime(settings);
  return Math.max(handGone, bannerDone) + 180;
}

export function highGunDuration(reducedMotion: boolean) {
  if (reducedMotion) {
    return highGunTiming.holdAfterBannerMs;
  }
  return (
    highGunTiming.slowMoMs +
    highGunTiming.handLowerMs +
    highGunTiming.shardAssembleMs +
    highGunTiming.rosetteDropMs +
    highGunTiming.bannerAfterRosetteMs +
    highGunTiming.holdAfterBannerMs
  );
}

export function highGunPhases(elapsed: number, reducedMotion: boolean) {
  if (reducedMotion) {
    return {
      slowMo: false,
      smoke: false,
      handLowerProgress: 1,
      shardProgress: 1,
      rosetteProgress: 1,
      shineProgress: 1,
      showBanner: true,
      dim: 0.18,
      done: elapsed >= highGunDuration(true),
    };
  }

  const smokeEnd = highGunTiming.smokeMs;
  const handStart = highGunTiming.slowMoMs * 0.55;
  const handLowerProgress = clamp01(
    (elapsed - handStart) / highGunTiming.handLowerMs,
  );
  const shardAt = highGunTiming.slowMoMs + highGunTiming.handLowerMs * 0.35;
  const shardProgress = clamp01(
    (elapsed - shardAt) / highGunTiming.shardAssembleMs,
  );
  const rosetteAt = shardAt + highGunTiming.shardAssembleMs * 0.72;
  const rosetteProgress = clamp01(
    (elapsed - rosetteAt) / highGunTiming.rosetteDropMs,
  );
  const shineAt = rosetteAt + highGunTiming.rosetteDropMs * 0.55;
  const shineProgress = clamp01((elapsed - shineAt) / highGunTiming.shineMs);
  const bannerAt =
    rosetteAt +
    highGunTiming.rosetteDropMs +
    highGunTiming.bannerAfterRosetteMs;

  return {
    slowMo: elapsed < highGunTiming.slowMoMs,
    smoke: elapsed < smokeEnd,
    handLowerProgress,
    shardProgress,
    rosetteProgress,
    shineProgress,
    showBanner: elapsed >= bannerAt,
    dim: 0.22,
    done: elapsed >= highGunDuration(false),
  };
}

/** 1 -> 1st, 2 -> 2nd, 3 -> 3rd, 11 -> 11th, 21 -> 21st, etc. */
export function ordinalSuffix(n: number) {
  const abs = Math.abs(Math.trunc(n));
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return "th";
  }
  switch (abs % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

export function formatOrdinal(n: number) {
  return `${Math.trunc(n)}${ordinalSuffix(n)}`;
}

/** Fill {n} / {ordinal} in the draft beat-you line. */
export function formatBeatYouLine(template: string, count: number) {
  const ordinal = formatOrdinal(count);
  return template
    .replaceAll("{ordinal}", ordinal)
    .replaceAll("{n}", String(Math.trunc(count)));
}
