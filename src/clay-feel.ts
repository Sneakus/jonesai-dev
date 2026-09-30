// Phone-only tuning. A PC (pointer: fine) ignores this.
// Change these three together when the touch game should feel different.
export const touchClay = {
  draw: 0.6375, // 0.85 * 0.75: a further 25% smaller than the previous phone size
  hit: 0.6, // 0.8 * 0.75: a further 25% smaller hit area than before
  speed: 1.38, // 1.15 * 1.2: a further 20% faster than before
};

// Hard mode multipliers, applied on top of normal settings (and on top of touchClay on phones).
export const hardMode = {
  draw: 0.8, // about 20% smaller than normal
  hit: 0.8, // hit area about 20% smaller than normal
  speed: 1.45, // about 45% faster than normal
  windMul: 1.5, // wind about 50% stronger
  crosserSpeedMul: 1.6, // crossers about 60% faster in hard mode
  midiWeightMul: 2, // midi clays about twice as common
  miniWeightMul: 2, // mini clays about twice as common
  minTricky: 3, // every hard round has at least this many tricky throws
  // How often each throw appears in hard mode. A higher number means it comes up more often.
  throwCrosser: 2,
  throwAway: 1,
  throwIncomer: 1,
  throwHigh: 1,
  throwRabbit: 1,
  throwBattue: 2,
  throwTeal: 2,
  throwLooper: 2,
  throwDropper: 2,
  throwCurler: 2,
};

const desktopClay = { draw: 1, hit: 1, speed: 1 };

export type ClayFeel = {
  draw: number;
  hit: number;
  speed: number;
};

export function clayFeel(coarse: boolean, hard = false): ClayFeel {
  const phone = coarse ? touchClay : desktopClay;
  if (!hard) {
    if (coarse) {
      // Phone normal: new flight paths measure faster. Pull pace back so
      // difficulty stays near the pre-physics numbers (launch feel only).
      return {
        draw: phone.draw * 0.985,
        hit: phone.hit * 0.985,
        speed: phone.speed * 0.52,
      };
    }
    return phone;
  }
  return {
    draw: phone.draw * hardMode.draw,
    hit: phone.hit * hardMode.hit,
    speed: phone.speed * hardMode.speed,
  };
}

let feel: ClayFeel = desktopClay;
let hardActive = false;
let coarseActive = false;

export function setClayFeel(coarse: boolean, hard = false) {
  coarseActive = coarse;
  hardActive = hard;
  feel = clayFeel(coarse, hard);
}

export function activeClayFeel(): ClayFeel {
  return feel;
}

export function isHardModeActive() {
  return hardActive;
}

/** True when the phone (coarse pointer) feel is active. */
export function isCoarseFeel() {
  return coarseActive;
}

export function hardWindMul() {
  return hardActive ? hardMode.windMul : 1;
}

export function hardCrosserSpeedMul() {
  return hardActive ? hardMode.crosserSpeedMul : 1;
}

export function hardSizeWeights(standard: number, midi: number, mini: number) {
  if (!hardActive) {
    return { standard, midi, mini };
  }
  return {
    standard,
    midi: midi * hardMode.midiWeightMul,
    mini: mini * hardMode.miniWeightMul,
  };
}

export function hardCelebration(settings: {
  perfectDuration: number;
  perfectShotCount: number;
  perfectSweepTime: number;
}) {
  // Hard mode uses the High gun celebration instead of a longer fireworks sweep.
  return settings;
}

// Desktop clay numbers the touch multipliers scale from. Kept here so a test
// can prove the PC game still uses these values.
export const desktopClaySettings = {
  claySize: 51,
  hitAreaSize: 8,
  speedMin: 0.64,
  speedMax: 0.96,
};

export const STORAGE = {
  unlocked: "clay-hard-unlocked",
  mode: "clay-mode",
  counted: "clay-hard-counted",
  lastInvite: "clay-hard-last-invite",
  lastHardMessage: "clay-hard-last-score-message",
  lastHardWin: "clay-hard-last-win",
} as const;

export type HardThrowKind =
  | "crosser"
  | "away"
  | "incomer"
  | "high"
  | "rabbit"
  | "battue"
  | "teal"
  | "looper"
  | "dropper"
  | "curler";

export const trickyKinds: HardThrowKind[] = [
  "battue",
  "teal",
  "looper",
  "dropper",
  "curler",
];

export function isTrickyKind(kind: HardThrowKind) {
  return trickyKinds.includes(kind);
}

export function hardThrowOptions(): { kind: HardThrowKind; weight: number }[] {
  return [
    { kind: "crosser", weight: hardMode.throwCrosser },
    { kind: "away", weight: hardMode.throwAway },
    { kind: "incomer", weight: hardMode.throwIncomer },
    { kind: "high", weight: hardMode.throwHigh },
    { kind: "rabbit", weight: hardMode.throwRabbit },
    { kind: "battue", weight: hardMode.throwBattue },
    { kind: "teal", weight: hardMode.throwTeal },
    { kind: "looper", weight: hardMode.throwLooper },
    { kind: "dropper", weight: hardMode.throwDropper },
    { kind: "curler", weight: hardMode.throwCurler },
  ];
}

function weightedPick<T extends string>(
  options: { kind: T; weight: number }[],
  rand = Math.random,
): T {
  const total = options.reduce((sum, option) => sum + Math.max(0, option.weight), 0);
  let roll = rand() * (total || 1);
  for (const option of options) {
    roll -= Math.max(0, option.weight);
    if (roll <= 0) {
      return option.kind;
    }
  }
  return options[0]?.kind as T;
}

export function pickHardThrow(rand = Math.random): HardThrowKind {
  return weightedPick(hardThrowOptions(), rand);
}

export function planHardRound(
  length = 5,
  minTricky = hardMode.minTricky,
  rand = Math.random,
): HardThrowKind[] {
  const round: HardThrowKind[] = [];
  for (let index = 0; index < length; index += 1) {
    round.push(pickHardThrow(rand));
  }
  let tricky = round.filter(isTrickyKind).length;
  let guard = 0;
  while (tricky < minTricky && guard < 40) {
    const slot = Math.floor(rand() * length);
    if (!isTrickyKind(round[slot])) {
      const trickyOptions = hardThrowOptions().filter((option) =>
        isTrickyKind(option.kind),
      );
      round[slot] = weightedPick(trickyOptions, rand);
      tricky = round.filter(isTrickyKind).length;
    }
    guard += 1;
  }
  return round;
}

export function pickAvoidingRepeat(
  messages: string[],
  previous: string,
  rand = Math.random,
): string {
  if (messages.length === 0) {
    return "";
  }
  const choices =
    messages.length > 1
      ? messages.filter((message) => message !== previous)
      : messages;
  return choices[Math.floor(rand() * Math.max(1, choices.length))] ?? messages[0];
}

export function formatBeatCount(
  count: number,
  words: { none: string; one: string; many: string },
): string {
  if (count <= 0) {
    return words.none;
  }
  if (count === 1) {
    return words.one;
  }
  return words.many.replace("{n}", String(count));
}
