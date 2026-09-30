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

export const highGunTiming = {
  slowMoMs: 1000,
  slowMoScale: 0.25,
  smokeMs: 2000,
  handLowerMs: 900,
  rosetteDropMs: 650,
  rosetteSwingMs: 1800,
  bannerAfterRosetteMs: 280,
  holdAfterBannerMs: 900,
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
  // Keep the hand solid through the last recoil at least.
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
    return (
      highGunTiming.handLowerMs * 0.45 +
      highGunTiming.rosetteDropMs * 0.2 +
      highGunTiming.holdAfterBannerMs
    );
  }
  return (
    highGunTiming.slowMoMs +
    highGunTiming.handLowerMs +
    highGunTiming.rosetteDropMs +
    highGunTiming.bannerAfterRosetteMs +
    highGunTiming.holdAfterBannerMs
  );
}

export function highGunPhases(elapsed: number, reducedMotion: boolean) {
  if (reducedMotion) {
    const handLower = Math.min(
      highGunTiming.handLowerMs * 0.45,
      highGunTiming.handLowerMs,
    );
    const rosetteAt = handLower * 0.2;
    return {
      slowMo: false,
      smoke: false,
      handLowerProgress: clamp01(elapsed / Math.max(1, handLower)),
      rosetteProgress: clamp01((elapsed - rosetteAt) / Math.max(1, handLower * 0.5)),
      showBanner: elapsed >= rosetteAt,
      done: elapsed >= highGunDuration(true),
    };
  }
  const afterSlow = Math.max(0, elapsed - highGunTiming.slowMoMs);
  const handLowerProgress = clamp01(afterSlow / highGunTiming.handLowerMs);
  const rosetteAt = highGunTiming.slowMoMs + highGunTiming.handLowerMs * 0.55;
  const rosetteProgress = clamp01(
    (elapsed - rosetteAt) / highGunTiming.rosetteDropMs,
  );
  const bannerAt =
    rosetteAt + highGunTiming.rosetteDropMs + highGunTiming.bannerAfterRosetteMs;
  return {
    slowMo: elapsed < highGunTiming.slowMoMs,
    smoke: elapsed < highGunTiming.smokeMs,
    handLowerProgress,
    rosetteProgress,
    showBanner: elapsed >= bannerAt,
    done: elapsed >= highGunDuration(false),
  };
}
