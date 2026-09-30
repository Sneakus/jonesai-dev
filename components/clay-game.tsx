"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { attach, wake } from "@/src/motion/loop";
import { clayBoxClass } from "@/components/clay-scene";
import { reportClayBreak } from "@/src/portrait/bridge";
import {
  activeClayFeel,
  clayFeel,
  hardMode,
  pickAvoidingRepeat,
  planHardRound,
  setClayFeel,
  STORAGE,
  touchClay,
  type HardThrowKind,
} from "@/src/clay-feel";
import {
  formatBeatYouLine,
  highGunDuration,
  highGunPhases,
  highGunTiming,
  perfectBannerStart,
  perfectCelebrationDuration,
  perfectHandOpacity,
  perfectLastShotAt,
} from "@/src/clay-celebration";
import type { ClayTestShortcut } from "@/src/clay-test-shortcuts";
import {
  settings,
  lookOf,
  stepClay,
  clayGone,
  chooseFairThrow,
  pickNormalThrow,
  pickSize,
  type Clay,
  type ThrowKind,
} from "@/src/clay-throws";

export { activeClayFeel, clayFeel, setClayFeel, touchClay, hardMode, settings };

const pelletFade = 400;
const shakeTime = 110;
const floaterTime = 480;
const farPattern = 0.78;

const handPoses = [
  "left",
  "straight",
  "right",
  "recoil-left",
  "recoil-straight",
  "recoil-right",
] as const;

type HandPose = (typeof handPoses)[number];
type HandFacing = "left" | "straight" | "right";

function handSrc(pose: HandPose) {
  return `/hand/hand-${pose}.webp`;
}

function recoilPose(facing: HandFacing): HandPose {
  if (facing === "left") {
    return "recoil-left";
  }
  if (facing === "right") {
    return "recoil-right";
  }
  return "recoil-straight";
}

type Pellet = {
  x: number;
  y: number;
};

type Shot = {
  pellets: Pellet[];
  arriveAt: number;
  born: number;
  dot: number;
};

type Floater = {
  x: number;
  y: number;
  born: number;
};

type GameResult = {
  score: number;
  message: string;
  perfect: boolean;
  invite?: boolean;
  hardWin?: { banner: string; quip: string } | null;
};

type Colors = {
  clay: string;
  clayDark: string;
  ink: string;
  field: string;
};

function readColors(box: HTMLElement): Colors {
  const styles = getComputedStyle(box);
  const read = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;

  return {
    clay: read("--color-clay", "#e8480c"),
    clayDark: read("--color-clay-dark", "#9e2f06"),
    ink: read("--color-ink", "#161514"),
    field: read("--color-field", "#eae4d7"),
  };
}

function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function distanceT(distance: number) {
  const span = settings.farDistance - settings.nearDistance;
  if (Math.abs(span) < 0.0001) {
    return 0;
  }
  return clamp01((distance - settings.nearDistance) / span);
}

function parseColor(value: string): [number, number, number] {
  const hex = value.trim();
  if (hex.startsWith("#") && (hex.length === 7 || hex.length === 4)) {
    const full =
      hex.length === 4
        ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
        : hex;
    return [
      Number.parseInt(full.slice(1, 3), 16),
      Number.parseInt(full.slice(3, 5), 16),
      Number.parseInt(full.slice(5, 7), 16),
    ];
  }
  const rgb = hex.match(/rgba?\(([^)]+)\)/i);
  if (rgb) {
    const parts = rgb[1].split(",").map((part) => Number.parseFloat(part));
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  }
  return [232, 72, 12];
}

function mixColor(from: string, to: string, amount: number) {
  const [ar, ag, ab] = parseColor(from);
  const [br, bg, bb] = parseColor(to);
  const red = Math.round(lerp(ar, br, amount));
  const green = Math.round(lerp(ag, bg, amount));
  const blue = Math.round(lerp(ab, bb, amount));
  return `rgb(${red}, ${green}, ${blue})`;
}

function patternRadius(distance: number | null) {
  const t = distance == null ? 0.45 : distanceT(distance);
  return settings.patternSize * lerp(1, farPattern, t);
}

function shotDelay(distance: number | null) {
  const t = distance == null ? 0.45 : distanceT(distance);
  return lerp(settings.shotTravelNear, settings.shotTravelFar, t);
}

function scatterPellets(x: number, y: number, radius: number): Pellet[] {
  const pellets: Pellet[] = [];
  const count = Math.max(1, Math.round(settings.pelletCount));
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * radius;
    pellets.push({
      x: x + Math.cos(angle) * distance,
      y: y + Math.sin(angle) * distance,
    });
  }
  return pellets;
}

function pelletHitsClay(clay: Clay, pellet: Pellet) {
  const { rx, ry } = lookOf(clay, 1);
  const hit = activeClayFeel().hit;
  const hitX = (rx + settings.hitAreaSize) * hit;
  const hitY = (ry + settings.hitAreaSize) * hit;
  const dx = (pellet.x - clay.x) / hitX;
  const dy = (pellet.y - clay.y) / hitY;
  return dx * dx + dy * dy <= 1;
}
function drawClay(
  ctx: CanvasRenderingContext2D,
  clay: Clay,
  colors: Colors,
) {
  const look = lookOf(clay);
  const fill = mixColor(colors.clay, colors.field, look.pale);
  const stroke = mixColor(colors.clayDark, colors.field, look.pale * 0.65);

  ctx.save();
  ctx.translate(clay.x, clay.y);

  if (clay.kind === "rabbit") {
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1.5, look.ry * 0.08);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.ellipse(0, 0, look.rx, look.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.rotate(clay.roll);
    ctx.beginPath();
    ctx.moveTo(0, -look.ry * 0.8);
    ctx.lineTo(0, look.ry * 0.8);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    return;
  }

  const tilt = Math.max(-0.45, Math.min(0.45, Math.atan2(clay.vy, clay.vx) * 0.28));
  if (clay.kind === "battue") {
    ctx.rotate(clay.roll + tilt * (1 - Math.min(1, Math.abs(clay.roll) / 2)));
  } else {
    ctx.rotate(tilt);
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(0, look.ry * 0.16, look.rx, look.ry, 0, 0, Math.PI * 2);
  ctx.fill();

  const scale = look.rx / 78;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(1.5, 3.5 * scale);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-72 * scale, 0);
  ctx.bezierCurveTo(-42 * scale, -30 * scale, 42 * scale, -30 * scale, 72 * scale, 0);
  ctx.stroke();
  ctx.restore();
}

export function ClayGame({
  replayLabel,
  liveLabel,
  hitMark,
  scoreMessages,
  hardScoreMessages,
  hardWins,
  hardInvites,
  hardInviteButton,
  hardModeLabel,
  normalModeLabel,
  beatLine,
  beatYou,
  beatCount,
  highGunLabel,
  hard,
  testShortcut = null,
  onHardChange,
  onHardUnlock,
  onHardPerfect,
  onFail,
}: {
  replayLabel: string;
  liveLabel: string;
  hitMark: string;
  scoreMessages: string[][];
  hardScoreMessages: string[][];
  hardWins: { banner: string; quip: string }[];
  hardInvites: string[];
  hardInviteButton: string;
  hardModeLabel: string;
  normalModeLabel: string;
  beatLine: string | null;
  beatYou: string;
  beatCount: number | null;
  highGunLabel: string;
  hard: boolean;
  testShortcut?: ClayTestShortcut | null;
  onHardChange: (hard: boolean) => void;
  onHardUnlock: () => void;
  onHardPerfect: () => void;
  onFail: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  const replayRef = useRef<HTMLButtonElement>(null);
  const scoreRef = useRef<HTMLParagraphElement>(null);
  const onFailRef = useRef(onFail);
  const hitMarkRef = useRef(hitMark);
  const scoreMessagesRef = useRef(scoreMessages);
  const hardScoreMessagesRef = useRef(hardScoreMessages);
  const hardWinsRef = useRef(hardWins);
  const highGunLabelRef = useRef(highGunLabel);
  const beatYouRef = useRef(beatYou);
  const beatCountRef = useRef(beatCount);
  const testShortcutRef = useRef<ClayTestShortcut | null>(testShortcut);
  const hardInvitesRef = useRef(hardInvites);
  const hardRef = useRef(hard);
  const onHardChangeRef = useRef(onHardChange);
  const onHardUnlockRef = useRef(onHardUnlock);
  const onHardPerfectRef = useRef(onHardPerfect);
  const [over, setOver] = useState(false);
  const [result, setResult] = useState<GameResult | null>(null);
  const [highGunDim, setHighGunDim] = useState(false);

  useEffect(() => {
    onFailRef.current = onFail;
  }, [onFail]);

  useEffect(() => {
    hitMarkRef.current = hitMark;
  }, [hitMark]);

  useEffect(() => {
    scoreMessagesRef.current = scoreMessages;
  }, [scoreMessages]);

  useEffect(() => {
    hardScoreMessagesRef.current = hardScoreMessages;
  }, [hardScoreMessages]);

  useEffect(() => {
    hardWinsRef.current = hardWins;
  }, [hardWins]);
  useEffect(() => {
    highGunLabelRef.current = highGunLabel;
  }, [highGunLabel]);
  useEffect(() => {
    beatYouRef.current = beatYou;
  }, [beatYou]);
  useEffect(() => {
    beatCountRef.current = beatCount;
  }, [beatCount]);
  useEffect(() => {
    testShortcutRef.current = testShortcut;
  }, [testShortcut]);

  useEffect(() => {
    hardInvitesRef.current = hardInvites;
  }, [hardInvites]);

  useEffect(() => {
    hardRef.current = hard;
    onHardChangeRef.current = onHardChange;
    onHardUnlockRef.current = onHardUnlock;
    onHardPerfectRef.current = onHardPerfect;
  }, [hard, onHardChange, onHardUnlock, onHardPerfect]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = canvas?.parentElement;
    if (!canvas || !box) {
      onFailRef.current();
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      onFailRef.current();
      return;
    }

    let hardPlan: HardThrowKind[] = [];
    const coarsePointer = window.matchMedia("(pointer: coarse)");

    const applyModeFeel = () => {
      setClayFeel(coarsePointer.matches, hardRef.current);
    };
    applyModeFeel();
    const onPointerKind = () => applyModeFeel();
    coarsePointer.addEventListener("change", onPointerKind);

    const colors = readColors(box);
    const uiFont = getComputedStyle(box).fontFamily || "Instrument Sans, sans-serif";
    let width = 0;
    let height = 0;
    let last = 0;
    let visible = true;
    let stopped = false;
    let launched = 0;
    let hits = 0;
    let finished = false;
    let fastClays = 0;
    let fastClayDeadline =
      1 + Math.floor(Math.random() * Math.max(1, settings.claysPerRound));
    let lastMessage = "";
    let forcePerfect = false;
    let celebrationAt = 0;
    let celebrationFinished = false;
    let highGunActive = false;
    let handHolstered = false;
    let slowMoUntil = 0;
    let pendingResult: GameResult | null = null;
    let nextLaunchAt = performance.now() + 280;
    let readyAt = 0;
    let dtHand = 0.016;
    let handsReady = false;
    let photoRatio = 208 / 228;
    let handRows: { min: number; max: number }[] = [];
    let handPixelW = 1;
    let handPixelH = 1;
    let recoilUntil = 0;
    let recoilFacing: HandFacing = "straight";
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const handImages: Partial<Record<HandPose, HTMLImageElement>> = {};
    const handOpacity: Record<HandPose, number> = {
      left: 0,
      straight: 1,
      right: 0,
      "recoil-left": 0,
      "recoil-straight": 0,
      "recoil-right": 0,
    };
    const preloadHands = Promise.all(
      handPoses.map(
        (pose) =>
          new Promise<void>((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
              handImages[pose] = image;
              if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                photoRatio = image.naturalWidth / image.naturalHeight;
              }
              if (pose === "straight") {
                rememberHand(image);
              }
              resolve();
            };
            image.onerror = () => reject(new Error(pose));
            image.src = handSrc(pose);
          }),
      ),
    );
    let onHandsReady: (() => void) | null = null;
    preloadHands
      .then(() => {
        if (!stopped) {
          handsReady = true;
          onHandsReady?.();
          wake();
        }
      })
      .catch(() => {
        if (!stopped) {
          onFailRef.current();
        }
      });

    const rememberHand = (image: HTMLImageElement) => {
      try {
        const scratch = document.createElement("canvas");
        scratch.width = image.naturalWidth;
        scratch.height = image.naturalHeight;
        const context = scratch.getContext("2d", { willReadFrequently: true });
        if (!context) {
          return;
        }
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, scratch.width, scratch.height).data;
        const rows: { min: number; max: number }[] = [];
        for (let y = 0; y < scratch.height; y += 1) {
          let min = -1;
          let max = -1;
          const start = y * scratch.width * 4;
          for (let x = 0; x < scratch.width; x += 1) {
            if (pixels[start + x * 4 + 3] > 28) {
              if (min < 0) {
                min = x;
              }
              max = x;
            }
          }
          rows.push({ min, max });
        }
        handRows = rows;
        handPixelW = scratch.width;
        handPixelH = scratch.height;
      } catch {
        handRows = [];
      }
    };

    const behindHand = (x: number, y: number) => {
      const reach = height * (height >= 500 ? settings.handSize : settings.handSizePhone);
      if (reach < 2 || handRows.length === 0) {
        return false;
      }
      const photoW = reach * photoRatio;
      const left = width / 2 - photoW / 2;
      const top = height - reach;
      const localY = ((y - top) / reach) * handPixelH;
      if (localY < 0 || localY >= handPixelH) {
        return false;
      }
      const row = handRows[Math.min(handRows.length - 1, Math.max(0, Math.round(localY)))];
      if (!row || row.min < 0) {
        return false;
      }
      const localX = ((x - left) / photoW) * handPixelW;
      const pad = (Math.max(0, settings.handSlide) / photoW) * handPixelW;
      return localX >= row.min - pad && localX <= row.max + pad;
    };

    const facingFor = (x: number): HandFacing => {
      if (width <= 0) {
        return "straight";
      }
      const across = x / width;
      if (across < settings.aimLeft) {
        return "left";
      }
      if (across > settings.aimRight) {
        return "right";
      }
      return "straight";
    };

    let shakeAt = 0;
    let clay: Clay | null = null;
    let aimX = 0;
    let aimY = 0;
    let pointerDown: { x: number; y: number } | null = null;
    let finePointer = window.matchMedia("(pointer: fine)").matches;
    let pointerInside = false;
    let pointerDirty = false;
    const shots: Shot[] = [];
    const floaters: Floater[] = [];
    const breakSpots: { x: number; y: number }[] = [];

    const endHighGunCelebration = () => {
      if (!highGunActive || celebrationFinished) {
        return;
      }
      celebrationFinished = true;
      handHolstered = true;
      celebrationAt = 0;
      highGunActive = false;
      slowMoUntil = 0;
      shots.length = 0;
      floaters.length = 0;
      clearShake();
      const reveal = pendingResult;
      window.setTimeout(() => {
        if (!reveal) {
          return;
        }
        startTransition(() => {
          setHighGunDim(false);
          setResult(reveal);
          setOver(true);
        });
      }, 0);
    };

    const publish = () => {
      const node = scoreRef.current;
      if (!node) {
        return;
      }
      if (launched <= 0) {
        node.hidden = true;
        return;
      }
      node.hidden = false;
      node.textContent = `${hits} / ${launched}`;
    };

    const pickScoreMessage = (value: number, hardRound: boolean) => {
      const messages = hardRound
        ? hardScoreMessagesRef.current[value] ?? []
        : scoreMessagesRef.current[value] ?? [];
      if (messages.length === 0) {
        return "";
      }
      const key = hardRound ? STORAGE.lastHardMessage : "clay-last-score-message";
      let previous = lastMessage;
      try {
        previous = window.sessionStorage.getItem(key) ?? previous;
      } catch {
        // The in-memory value still prevents repeats for this page.
      }
      const message = pickAvoidingRepeat(messages, previous);
      lastMessage = message;
      try {
        window.sessionStorage.setItem(key, message);
      } catch {
        // Some privacy settings block storage; the game still works.
      }
      return message;
    };

    const pickInvite = () => {
      const invites = hardInvitesRef.current;
      let previous = "";
      try {
        previous = window.localStorage.getItem(STORAGE.lastInvite) ?? "";
      } catch {
        previous = "";
      }
      const line = pickAvoidingRepeat(invites, previous);
      try {
        window.localStorage.setItem(STORAGE.lastInvite, line);
      } catch {
        // Ignore.
      }
      return line;
    };

    const pickHardWin = () => {
      const wins = hardWinsRef.current;
      if (wins.length === 0) {
        return null;
      }
      let previous = "";
      try {
        previous = window.localStorage.getItem(STORAGE.lastHardWin) ?? "";
      } catch {
        previous = "";
      }
      const banners = wins.map((win) => win.banner);
      const banner = pickAvoidingRepeat(banners, previous);
      const win = wins.find((item) => item.banner === banner) ?? wins[0];
      try {
        window.localStorage.setItem(STORAGE.lastHardWin, win.banner);
      } catch {
        // Ignore.
      }
      return win;
    };

    const finishRound = (now: number) => {
      finished = true;
      const hardRound = hardRef.current;
      const perfect =
        hits >= Math.max(1, settings.claysPerRound) || forcePerfect;
      forcePerfect = false;
      pendingResult = {
        score: hits,
        message: perfect && hardRound
          ? ""
          : pickScoreMessage(
              perfect ? 5 : Math.max(0, Math.min(4, hits)),
              hardRound,
            ),
        perfect,
        invite: perfect && !hardRound,
        hardWin: perfect && hardRound ? pickHardWin() : null,
      };
      publish();
      if (perfect && hardRound) {
        celebrationAt = now;
        celebrationFinished = false;
        highGunActive = true;
        setHighGunDim(true);
        if (
          testShortcutRef.current !== "win" &&
          testShortcutRef.current !== "highgun"
        ) {
          onHardPerfectRef.current();
        }
        if (!reducedMotion) {
          slowMoUntil = now + highGunTiming.slowMoMs;
        }
        return;
      }
      if (perfect && !reducedMotion) {
        celebrationAt = now;
        celebrationFinished = false;
        highGunActive = false;
        return;
      }
      if (perfect && !hardRound) {
        pendingResult.invite = true;
        pendingResult.message = pickInvite();
      }
      setResult(pendingResult);
      setOver(true);
    };

    const beginTestCelebration = (now: number) => {
      const shortcut = testShortcutRef.current;
      if (shortcut !== "win" && shortcut !== "highgun") {
        return;
      }
      if (finished || celebrationAt > 0) {
        return;
      }
      const high = shortcut === "highgun";
      hardRef.current = high;
      applyModeFeel();
      finished = true;
      hits = Math.max(1, settings.claysPerRound);
      launched = hits;
      clay = null;
      nextLaunchAt = 0;
      pendingResult = {
        score: hits,
        message: high ? "" : pickScoreMessage(5, false),
        perfect: true,
        invite: !high,
        hardWin: high ? pickHardWin() : null,
      };
      publish();
      if (high) {
        celebrationAt = now;
        celebrationFinished = false;
        highGunActive = true;
        setHighGunDim(true);
        if (breakSpots.length === 0) {
          for (let index = 0; index < 5; index += 1) {
            breakSpots.push({
              x: width * (0.18 + index * 0.16),
              y: height * (0.28 + (index % 2) * 0.12),
            });
          }
        }
        if (!reducedMotion) {
          slowMoUntil = now + highGunTiming.slowMoMs;
        }
        wake();
        return;
      }
      if (!reducedMotion) {
        celebrationAt = now;
        celebrationFinished = false;
        highGunActive = false;
        wake();
        return;
      }
      pendingResult.invite = true;
      pendingResult.message = pickInvite();
      setResult(pendingResult);
      setOver(true);
    };

    onHandsReady = () => {
      beginTestCelebration(performance.now());
    };
    if (handsReady) {
      onHandsReady();
    }

    const clearShake = () => {
      shakeAt = 0;
      box.style.transform = "";
    };

    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (aimX === 0 && aimY === 0) {
        aimX = width * 0.5;
        aimY = height * 0.35;
      }
    };

    const restartPlan = () => {
      try {
        hardRef.current = window.localStorage.getItem(STORAGE.mode) === "hard";
      } catch {
        // Keep the in-memory mode.
      }
      applyModeFeel();
      hardPlan = hardRef.current ? planHardRound(settings.claysPerRound) : [];
    };
    restartPlan();

    const launch = () => {
      if (width < 20 || height < 20) {
        nextLaunchAt = performance.now() + 50;
        return;
      }
      const roundLength = Math.max(1, settings.claysPerRound);
      const fastMinimum = Math.max(0, Math.round(settings.fastClaysPerRound));
      const throwsLeft = roundLength - launched;
      const fastStillNeeded = Math.max(0, fastMinimum - fastClays);
      const forceFast =
        !hardRef.current &&
        fastStillNeeded > 0 &&
        (launched + 1 >= fastClayDeadline || throwsLeft <= fastStillNeeded);
      const kind: ThrowKind = hardRef.current
        ? hardPlan[launched] || pickNormalThrow()
        : pickNormalThrow();
      const box = { width, height };
      const sizeScale = forceFast ? settings.fastClaySize : pickSize();
      const chosenThrow = chooseFairThrow(kind, box, sizeScale, {
        hard: hardRef.current,
        hidden: behindHand,
      });
      if (!chosenThrow.clay) {
        nextLaunchAt = performance.now() + 50;
        return;
      }
      clay = chosenThrow.clay;
      if (clay.sizeScale <= settings.fastClaySize + 0.001) {
        fastClays += 1;
      }
      launched += 1;
      nextLaunchAt = 0;
      publish();
    };

    const resolveClay = (now: number) => {
      clay = null;
      if (launched >= Math.max(1, settings.claysPerRound)) {
        finishRound(now);
        return;
      }
      nextLaunchAt = now + settings.pauseBetweenClays;
    };

    const breakClay = (now: number) => {
      if (!clay) {
        return;
      }
      breakSpots.push({ x: clay.x, y: clay.y });
      if (breakSpots.length > settings.claysPerRound) {
        breakSpots.shift();
      }
      floaters.push({ x: clay.x, y: clay.y, born: now });
      const rect = canvas.getBoundingClientRect();
      reportClayBreak(
        rect.left + window.scrollX + clay.x,
        rect.top + window.scrollY + clay.y,
      );
      hits += 1;
      if (settings.shakeStrength > 0) {
        shakeAt = now;
      }
      resolveClay(now);
      publish();
    };

    const shoot = (x: number, y: number, now: number) => {
      aimX = x;
      aimY = y;
      if (finished || now < readyAt) {
        return;
      }
      readyAt = now + settings.reloadTime;
      recoilFacing = facingFor(x);
      recoilUntil = now + settings.handRecoil;
      const distance = clay ? clay.distance : null;
      const t = distance == null ? 0.45 : distanceT(distance);
      shots.push({
        pellets: scatterPellets(x, y, patternRadius(distance)),
        arriveAt: now + shotDelay(distance),
        born: 0,
        dot: 2.25 * lerp(1, 0.82, t),
      });
    };

    const localPoint = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    const onPointerDown = (event: PointerEvent) => {
      if (highGunActive && celebrationAt > 0 && !celebrationFinished) {
        endHighGunCelebration();
        return;
      }
      if (event.pointerType === "mouse") {
        if (event.button !== 0) {
          return;
        }
        const point = localPoint(event);
        shoot(point.x, point.y, performance.now());
        return;
      }
      pointerDown = { x: event.clientX, y: event.clientY };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        return;
      }
      const point = localPoint(event);
      aimX = point.x;
      aimY = point.y;
      pointerInside = true;
      finePointer = true;
      pointerDirty = true;
      wake();
    };

    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType === "mouse") {
        pointerInside = false;
      }
    };

    const onPointerCancel = () => {
      pointerDown = null;
    };

    const onReplay = () => {
      if (highGunActive && celebrationAt > 0 && !celebrationFinished) {
        endHighGunCelebration();
        return;
      }
      launched = 0;
      hits = 0;
      finished = false;
      fastClays = 0;
      fastClayDeadline =
        1 + Math.floor(Math.random() * Math.max(1, settings.claysPerRound));
      celebrationAt = 0;
      celebrationFinished = false;
      highGunActive = false;
      handHolstered = false;
      slowMoUntil = 0;
      pendingResult = null;
      readyAt = 0;
      clay = null;
      shots.length = 0;
      floaters.length = 0;
      breakSpots.length = 0;
      recoilUntil = 0;
      setHighGunDim(false);
      for (const pose of handPoses) {
        handOpacity[pose] = pose === facingFor(aimX) ? 1 : 0;
      }
      clearShake();
      restartPlan();
      nextLaunchAt = performance.now() + 280;
      publish();
      start();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (highGunActive && celebrationAt > 0 && !celebrationFinished) {
        pointerDown = null;
        endHighGunCelebration();
        return;
      }
      if (event.pointerType === "mouse" || !pointerDown) {
        pointerDown = null;
        return;
      }
      const dx = event.clientX - pointerDown.x;
      const dy = event.clientY - pointerDown.y;
      pointerDown = null;
      if (dx * dx + dy * dy > 12 * 12) {
        return;
      }
      const point = localPoint(event);
      shoot(point.x, point.y, performance.now());
    };

    const applyShake = (now: number) => {
      if (settings.shakeStrength <= 0 || shakeAt <= 0) {
        if (box.style.transform) {
          box.style.transform = "";
        }
        return;
      }
      const progress = (now - shakeAt) / shakeTime;
      if (progress >= 1) {
        clearShake();
        return;
      }
      const amount = settings.shakeStrength * (1 - progress);
      const x = Math.sin(progress * 48) * amount;
      const y = Math.cos(progress * 37) * amount;
      box.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
    };

    const drawHandPhoto = (
      image: HTMLImageElement,
      x: number,
      y: number,
      handHeight: number,
      rotation: number,
      opacity: number,
    ) => {
      const handWidth = handHeight * photoRatio;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.drawImage(
        image,
        -handWidth / 2,
        -handHeight / 2,
        handWidth,
        handHeight,
      );
      ctx.restore();
    };

    const celebrationFacing = (progress: number): HandFacing => {
      if (progress < 1 / 3) {
        return "left";
      }
      if (progress > 2 / 3) {
        return "right";
      }
      return "straight";
    };

    const celebrationSettings = () => ({
      perfectSpinTime: settings.perfectSpinTime,
      perfectSweepStart: settings.perfectSweepStart,
      perfectSweepTime: settings.perfectSweepTime,
      perfectShotCount: settings.perfectShotCount,
      perfectRecoilTime: settings.perfectRecoilTime,
      perfectFireworkTravel: settings.perfectFireworkTravel,
      perfectSparkTime: settings.perfectSparkTime,
      winnerBannerDropTime: settings.winnerBannerDropTime,
      handSettleTime: settings.handSettleTime,
    });

    const drawRosette = (
      label: string,
      centerX: number,
      centerY: number,
      size: number,
      swing: number,
      shine = 0,
    ) => {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(swing);
      const petals = 14;
      for (let index = 0; index < petals; index += 1) {
        const angle = (Math.PI * 2 * index) / petals;
        ctx.save();
        ctx.rotate(angle);
        ctx.fillStyle = index % 2 === 0 ? colors.clay : colors.clayDark;
        ctx.beginPath();
        ctx.ellipse(0, -size * 0.42, size * 0.14, size * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = colors.field;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = Math.max(1, size * 0.03);
      ctx.stroke();
      ctx.fillStyle = colors.clay;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors.clay;
      ctx.beginPath();
      ctx.moveTo(-size * 0.08, size * 0.2);
      ctx.lineTo(-size * 0.28, size * 1.05);
      ctx.lineTo(-size * 0.02, size * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(size * 0.08, size * 0.2);
      ctx.lineTo(size * 0.28, size * 1.05);
      ctx.lineTo(size * 0.02, size * 0.55);
      ctx.closePath();
      ctx.fill();
      const fontSize = Math.max(11, size * 0.22);
      ctx.font = `700 ${fontSize}px ${uiFont}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = colors.field;
      ctx.fillText(label, 0, 1);
      if (shine > 0 && shine < 1) {
        const sweep = (shine - 0.5) * size * 1.4;
        ctx.save();
        ctx.beginPath();
        ctx.rect(-size * 0.28, -fontSize * 0.7, size * 0.56, fontSize * 1.4);
        ctx.clip();
        const gloss = ctx.createLinearGradient(sweep - 12, -10, sweep + 12, 10);
        gloss.addColorStop(0, "rgba(255,255,255,0)");
        gloss.addColorStop(0.5, "rgba(255,255,255,0.7)");
        gloss.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gloss;
        ctx.fillRect(sweep - 14, -fontSize, 28, fontSize * 2);
        ctx.restore();
      }
      ctx.restore();
    };

    const drawHighGun = (now: number) => {
      if (celebrationAt <= 0 || celebrationFinished) {
        return;
      }
      const elapsed = Math.max(0, now - celebrationAt);
      const phases = highGunPhases(elapsed, reducedMotion);
      const straight = handImages.straight;
      const handHeight = Math.min(height * 0.38, Math.max(86, width * 0.24));
      const restY = height - handHeight * 0.42;
      const tipX = width / 2;
      const tipY =
        restY -
        handHeight * 0.4 +
        phases.handLowerProgress * (height + handHeight);
      const rosetteX = width / 2;
      const rosetteY = height * 0.28;
      const rosetteSize = Math.min(64, width * 0.14);

      // Soft dim with a spotlight over the play area.
      if (phases.dim > 0) {
        ctx.save();
        const veil = ctx.createRadialGradient(
          width * 0.5,
          height * 0.42,
          Math.min(width, height) * 0.18,
          width * 0.5,
          height * 0.45,
          Math.max(width, height) * 0.85,
        );
        veil.addColorStop(0, "rgba(22,21,20,0)");
        veil.addColorStop(0.55, `rgba(22,21,20,${phases.dim * 0.35})`);
        veil.addColorStop(1, `rgba(22,21,20,${phases.dim})`);
        ctx.fillStyle = veil;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }

      if (phases.smoke && straight) {
        const smokeLife = highGunTiming.smokeMs;
        for (let puff = 0; puff < 7; puff += 1) {
          const born = puff * 90;
          const age = (elapsed - born) / smokeLife;
          if (age < 0 || age > 1) {
            continue;
          }
          const drift = Math.sin(elapsed * 0.003 + puff) * 10;
          const x = tipX + drift + puff * 1.4;
          const y = tipY - age * height * 0.28 - puff * 4;
          ctx.save();
          ctx.globalAlpha = (1 - age) * 0.35;
          ctx.fillStyle = "#8a8680";
          ctx.beginPath();
          ctx.ellipse(
            x,
            y,
            3 + age * 10,
            5 + age * 14,
            drift * 0.02,
            0,
            Math.PI * 2,
          );
          ctx.fill();
          ctx.restore();
        }
      }

      if (straight && phases.handLowerProgress < 1) {
        const y = restY + phases.handLowerProgress * (height * 0.55 + handHeight);
        drawHandPhoto(straight, width / 2, y, handHeight, 0, 1);
      } else {
        handHolstered = true;
      }

      // Shards of the five breaks fly in and assemble into the rosette.
      if (phases.shardProgress > 0 && phases.shardProgress < 1) {
        const spots =
          breakSpots.length > 0
            ? breakSpots
            : Array.from({ length: 5 }, (_, index) => ({
                x: width * (0.2 + index * 0.15),
                y: height * 0.35,
              }));
        const count = Math.max(5, spots.length);
        for (let index = 0; index < count; index += 1) {
          const from = spots[index % spots.length];
          const petalAngle = (Math.PI * 2 * index) / count - Math.PI / 2;
          const toX = rosetteX + Math.cos(petalAngle) * rosetteSize * 0.42;
          const toY = rosetteY + Math.sin(petalAngle) * rosetteSize * 0.42;
          const t = 1 - Math.pow(1 - phases.shardProgress, 2);
          const x = lerp(from.x, toX, t);
          const y = lerp(from.y, toY, t);
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(petalAngle + phases.shardProgress * 2);
          ctx.fillStyle = index % 2 === 0 ? colors.clay : colors.clayDark;
          ctx.beginPath();
          ctx.moveTo(0, -10);
          ctx.lineTo(8, 6);
          ctx.lineTo(-8, 6);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      if (phases.rosetteProgress > 0) {
        const drop = phases.rosetteProgress;
        const bounce = drop < 1 ? Math.sin(drop * Math.PI) * 12 * (1 - drop) : 0;
        const y =
          lerp(-80, rosetteY, 1 - Math.pow(1 - Math.min(1, drop), 3)) - bounce;
        const swing =
          Math.sin(elapsed * 0.0035) * 0.1 * Math.max(0.2, 1 - drop * 0.45);
        drawRosette(
          highGunLabelRef.current,
          rosetteX,
          y,
          rosetteSize,
          swing,
          phases.shineProgress,
        );
      }

      if (phases.showBanner && pendingResult?.hardWin) {
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const fontSize = Math.max(20, Math.min(36, width * 0.055));
        ctx.font = `700 ${fontSize}px ${uiFont}`;
        ctx.lineWidth = 6;
        ctx.strokeStyle = colors.field;
        ctx.fillStyle = colors.clay;
        const bannerY = height * 0.48;
        ctx.strokeText(pendingResult.hardWin.banner, width / 2, bannerY);
        ctx.fillText(pendingResult.hardWin.banner, width / 2, bannerY);
        ctx.font = `600 ${Math.max(15, fontSize * 0.72)}px ${uiFont}`;
        ctx.fillStyle = colors.ink;
        ctx.fillText(
          pendingResult.hardWin.quip,
          width / 2,
          bannerY + fontSize * 1.25,
        );
        const count = beatCountRef.current;
        if (count != null && beatYouRef.current) {
          ctx.font = `500 ${Math.max(13, fontSize * 0.55)}px ${uiFont}`;
          ctx.fillStyle = colors.ink;
          ctx.globalAlpha = 0.82;
          ctx.fillText(
            formatBeatYouLine(beatYouRef.current, count),
            width / 2,
            bannerY + fontSize * 2.35,
          );
        }
        ctx.restore();
      }
    };

    const drawCelebration = (now: number) => {
      if (celebrationAt <= 0) {
        return;
      }
      if (highGunActive) {
        drawHighGun(now);
        return;
      }
      const cele = celebrationSettings();
      const duration = perfectCelebrationDuration(cele);
      const elapsed = Math.min(Math.max(0, now - celebrationAt), duration);
      const straight = handImages.straight;
      const handOpacityValue = perfectHandOpacity(elapsed, cele);
      const bannerAt = perfectBannerStart(cele);
      const { shotCount, interval } = perfectLastShotAt(cele);
      const handHeight = Math.min(height * 0.38, Math.max(86, width * 0.24));

      if (straight && !celebrationFinished && elapsed < settings.perfectSpinTime) {
        const progress = clamp01(elapsed / settings.perfectSpinTime);
        const eased = 1 - Math.pow(1 - progress, 3);
        drawHandPhoto(
          straight,
          width / 2,
          height - handHeight * 0.42,
          handHeight,
          eased * Math.PI * 2,
          1,
        );
      }

      if (!celebrationFinished && elapsed >= settings.perfectSweepStart) {
        const sweep = clamp01(
          (elapsed - settings.perfectSweepStart) / cele.perfectSweepTime,
        );
        const facing = celebrationFacing(sweep);
        const latestShot = Math.min(
          shotCount - 1,
          Math.max(
            0,
            Math.floor(
              (elapsed - settings.perfectSweepStart) / Math.max(1, interval),
            ),
          ),
        );
        const latestFireAt = settings.perfectSweepStart + latestShot * interval;
        const recoiling =
          elapsed >= latestFireAt &&
          elapsed < latestFireAt + settings.perfectRecoilTime;
        const shotFacing = celebrationFacing(
          shotCount <= 1 ? 0.5 : latestShot / (shotCount - 1),
        );
        const pose = recoiling ? recoilPose(shotFacing) : facing;
        const handImage = handImages[pose];
        if (handImage && handOpacityValue > 0.01) {
          drawHandPhoto(
            handImage,
            width / 2,
            height - handHeight * 0.42,
            handHeight,
            0,
            handOpacityValue,
          );
        }

        for (let index = 0; index < shotCount; index += 1) {
          const fireAt = settings.perfectSweepStart + index * interval;
          const fireworkAge = elapsed - fireAt;
          if (
            fireworkAge < 0 ||
            fireworkAge >
              settings.perfectFireworkTravel + settings.perfectSparkTime
          ) {
            continue;
          }
          // Only draw the few fireworks that are mid-flight or bursting.
          if (index < latestShot - 2) {
            continue;
          }
          const shotProgress = shotCount <= 1 ? 0.5 : index / (shotCount - 1);
          const startFireX =
            width / 2 + lerp(-0.2, 0.2, shotProgress) * handHeight;
          const startFireY = height - handHeight * 0.82;
          const burstX =
            lerp(width * 0.12, width * 0.88, shotProgress) +
            Math.sin(index * 2.4) * width * 0.025;
          const burstY = height * (0.18 + ((index % 3) / 2) * 0.12);
          const travel = clamp01(fireworkAge / settings.perfectFireworkTravel);
          if (travel < 1) {
            const easedTravel = 1 - Math.pow(1 - travel, 2);
            const fireX = lerp(startFireX, burstX, easedTravel);
            const fireY = lerp(startFireY, burstY, easedTravel);
            ctx.save();
            ctx.globalAlpha = 0.55;
            ctx.strokeStyle = index % 2 === 0 ? colors.clay : colors.ink;
            ctx.lineWidth = Math.max(1, settings.perfectFireworkSize * 0.5);
            ctx.beginPath();
            ctx.moveTo(startFireX, startFireY);
            ctx.lineTo(fireX, fireY);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.fillStyle = index % 2 === 0 ? colors.clay : colors.ink;
            ctx.beginPath();
            ctx.arc(fireX, fireY, settings.perfectFireworkSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          const sparkAge =
            (fireworkAge - settings.perfectFireworkTravel) /
            settings.perfectSparkTime;
          if (sparkAge >= 0 && sparkAge <= 1) {
            const sparkCount = Math.max(1, Math.round(settings.perfectSparkCount));
            const radius = sparkAge * settings.perfectFireworkSize * 11;
            ctx.save();
            ctx.globalAlpha = 1 - sparkAge;
            for (let spark = 0; spark < sparkCount; spark += 1) {
              const angle = (Math.PI * 2 * spark) / sparkCount + index * 0.47;
              ctx.fillStyle =
                (spark + index) % 2 === 0 ? colors.clay : colors.ink;
              ctx.beginPath();
              ctx.arc(
                burstX + Math.cos(angle) * radius,
                burstY + Math.sin(angle) * radius,
                Math.max(1.5, settings.perfectFireworkSize * 0.55),
                0,
                Math.PI * 2,
              );
              ctx.fill();
            }
            ctx.restore();
          }
        }
      }

      if (!celebrationFinished && elapsed >= bannerAt && pendingResult) {
        const drop = clamp01(
          (elapsed - bannerAt) / settings.winnerBannerDropTime,
        );
        const eased = 1 - Math.pow(1 - drop, 3);
        const y = lerp(-36, height * 0.47, eased);
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const fontSize = Math.max(22, Math.min(42, width * 0.065));
        ctx.font = `700 ${fontSize}px ${uiFont}`;
        ctx.lineWidth = 7;
        ctx.strokeStyle = colors.field;
        ctx.fillStyle = colors.clay;
        const words = pendingResult.message.split(" ");
        const lines: string[] = [];
        const maxWidth = width * 0.82;
        for (const word of words) {
          const current = lines[lines.length - 1] ?? "";
          const next = current ? `${current} ${word}` : word;
          if (current && ctx.measureText(next).width > maxWidth) {
            lines.push(word);
          } else if (lines.length === 0) {
            lines.push(next);
          } else {
            lines[lines.length - 1] = next;
          }
        }
        const lineHeight = fontSize * 1.12;
        const firstY = y - ((lines.length - 1) * lineHeight) / 2;
        lines.forEach((line, index) => {
          const lineY = firstY + index * lineHeight;
          ctx.strokeText(line, width / 2, lineY);
          ctx.fillText(line, width / 2, lineY);
        });
        ctx.restore();
      }
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = colors.field;
      ctx.fillRect(0, 0, width, height);

      if (clay) {
        drawClay(ctx, clay, colors);
      }

      for (const shot of shots) {
        if (shot.born <= 0) {
          continue;
        }
        const age = (now - shot.born) / pelletFade;
        if (age >= 1) {
          continue;
        }
        ctx.save();
        ctx.globalAlpha = 1 - age;
        ctx.fillStyle = colors.ink;
        for (const pellet of shot.pellets) {
          ctx.beginPath();
          ctx.arc(pellet.x, pellet.y, shot.dot, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.save();
      ctx.textAlign = "center";
      ctx.font = `600 18px ${uiFont}`;
      ctx.fillStyle = colors.clay;
      for (const floater of floaters) {
        const floaterSlow =
          !reducedMotion &&
          slowMoUntil > 0 &&
          now < slowMoUntil &&
          floater.born >= celebrationAt - 50;
        const age = (now - floater.born) / (floaterTime * (floaterSlow ? 4 : 1));
        if (age >= 1) {
          continue;
        }
        ctx.globalAlpha = 1 - age;
        ctx.fillText(hitMarkRef.current, floater.x, floater.y - age * 28);
      }
      ctx.restore();

      const hand = handRef.current;
      if (hand && width > 0 && height > 0) {
        const celebrating = celebrationAt > 0;
        const reach = height * (height >= 500 ? settings.handSize : settings.handSizePhone);
        const slideLimit = Math.max(0, settings.handSlide);
        const slide = Math.max(
          -slideLimit,
          Math.min(slideLimit, (aimX / width - 0.5) * 2 * slideLimit),
        );
        hand.style.visibility =
          handsReady && !celebrating && !handHolstered ? "visible" : "hidden";
        hand.style.height = `${Math.round(reach)}px`;
        hand.style.width = `${Math.round(reach * photoRatio)}px`;
        hand.style.transform = handHolstered
          ? `translateX(calc(-50% + ${slide.toFixed(2)}px)) translateY(120%)`
          : `translateX(calc(-50% + ${slide.toFixed(2)}px))`;

        const showingRecoil = recoilUntil > 0 && now < recoilUntil;
        const targetPose = showingRecoil ? recoilPose(recoilFacing) : facingFor(aimX);
        const step =
          settings.handFade <= 0 ? 1 : ((dtHand || 0.016) * 1000) / settings.handFade;
        for (const pose of handPoses) {
          const goal = pose === targetPose ? 1 : 0;
          if (showingRecoil) {
            handOpacity[pose] = goal;
          } else {
            const gap = goal - handOpacity[pose];
            handOpacity[pose] += Math.sign(gap) * Math.min(step, Math.abs(gap));
          }
          const node = hand.querySelector<HTMLElement>(`[data-hand="${pose}"]`);
          if (node) {
            node.style.opacity = String(handOpacity[pose]);
          }
        }
      }

      drawCelebration(now);

      if (finePointer && pointerInside) {
        ctx.strokeStyle = colors.ink;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(aimX - 11, aimY);
        ctx.lineTo(aimX - 4, aimY);
        ctx.moveTo(aimX + 4, aimY);
        ctx.lineTo(aimX + 11, aimY);
        ctx.moveTo(aimX, aimY - 11);
        ctx.lineTo(aimX, aimY - 4);
        ctx.moveTo(aimX, aimY + 4);
        ctx.lineTo(aimX, aimY + 11);
        ctx.stroke();
      }

      applyShake(now);
    };

    let launchTimer = 0;
    let detach: (() => void) | null = null;

    const tick = (now: number) => {
      if (stopped || document.hidden || !visible) {
        return false;
      }

      const dt = Math.min(0.032, last === 0 ? 0.016 : (now - last) / 1000);
      dtHand = dt;
      last = now;
      const slowMo =
        !reducedMotion && slowMoUntil > 0 && now < slowMoUntil;
      const simDt = slowMo ? dt * highGunTiming.slowMoScale : dt;

      if (!clay && !finished && nextLaunchAt > 0 && now >= nextLaunchAt) {
        if (handsReady) {
          launch();
        } else {
          nextLaunchAt = now + 30;
        }
      }

      if (clay) {
        stepClay(clay, simDt, width, height);
      }

      for (const shot of shots) {
        if (shot.born > 0 || now < shot.arriveAt) {
          continue;
        }
        shot.born = now;
        const target = clay;
        if (!target) {
          continue;
        }
        if (shot.pellets.some((pellet) => pelletHitsClay(target, pellet))) {
          breakClay(now);
        }
      }

      if (clay && clayGone(clay, width, height)) {
        resolveClay(now);
      }

      for (let index = shots.length - 1; index >= 0; index -= 1) {
        const shot = shots[index];
        if (shot.born > 0 && now - shot.born > pelletFade) {
          shots.splice(index, 1);
        }
      }

      for (let index = floaters.length - 1; index >= 0; index -= 1) {
        if (now - floaters[index].born > floaterTime) {
          floaters.splice(index, 1);
        }
      }

      if (
        celebrationAt > 0 &&
        !celebrationFinished &&
        now - celebrationAt >=
          (highGunActive
            ? highGunDuration(reducedMotion)
            : perfectCelebrationDuration(celebrationSettings()))
      ) {
        if (highGunActive) {
          endHighGunCelebration();
        } else {
          celebrationFinished = true;
          celebrationAt = 0;
          highGunActive = false;
          slowMoUntil = 0;
          shots.length = 0;
          floaters.length = 0;
          clearShake();
          const reveal = pendingResult;
          window.setTimeout(() => {
            if (!reveal) {
              return;
            }
            if (reveal.invite) {
              reveal.message = pickInvite();
              onHardUnlockRef.current();
            }
            startTransition(() => {
              setResult(reveal);
              setOver(true);
            });
          }, 0);
        }
      }

      draw(now);
      const shaking = shakeAt > 0 && now - shakeAt < shakeTime;
      const celebrating = celebrationAt > 0 && !celebrationFinished;
      const live =
        Boolean(clay) || shots.length > 0 || floaters.length > 0 || shaking || celebrating;
      const waiting = !clay && !finished && nextLaunchAt > now;
      if (waiting && !live) {
        window.clearTimeout(launchTimer);
        launchTimer = window.setTimeout(() => wake(), Math.max(16, nextLaunchAt - now));
      }
      const cursor = pointerDirty;
      pointerDirty = false;
      return live || cursor;
    };

    const start = () => {
      if (stopped) {
        return;
      }
      if (!detach) {
        last = 0;
        detach = attach(tick);
        return;
      }
      wake();
    };

    const stop = () => {
      window.clearTimeout(launchTimer);
      detach?.();
      detach = null;
      if (box.style.transform) {
        box.style.transform = "";
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
        return;
      }
      start();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) {
          start();
        } else {
          stop();
        }
      },
      { threshold: 0.01 },
    );

    const resize = new ResizeObserver(() => {
      fit();
      draw(performance.now());
    });

    fit();
    draw(performance.now());
    observer.observe(box);
    resize.observe(box);
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("replay", onReplay);
    (window as Window & {
      __jonesTest?: { smash: () => boolean };
      __jonesHard?: { setHard: (on: boolean) => void; unlock: () => void };
    }).__jonesTest = {
      smash: () => {
        if (!clay || finished) {
          return false;
        }
        breakClay(performance.now());
        return true;
      },
    };
    (window as Window & {
      __jonesHard?: { setHard: (on: boolean) => void; unlock: () => void };
    }).__jonesHard = {
      setHard: (on: boolean) => {
        hardRef.current = on;
        onHardChangeRef.current(on);
        applyModeFeel();
        restartPlan();
      },
      unlock: () => onHardUnlockRef.current(),
    };
    start();

    return () => {
      stopped = true;
      coarsePointer.removeEventListener("change", onPointerKind);
      setClayFeel(false);
      delete (window as Window & { __jonesTest?: { smash: () => boolean } }).__jonesTest;
      delete (window as Window & { __jonesHard?: unknown }).__jonesHard;
      stop();
      box.style.transform = "";
      observer.disconnect();
      resize.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("replay", onReplay);
    };
  }, []);

  return (
    <div
      className={`${clayBoxClass} cursor-default select-none`}
      style={{ caretColor: "transparent", userSelect: "none" }}
      role="group"
      aria-label={liveLabel}
    >
      {highGunDim ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[4]"
          style={{
            background:
              "radial-gradient(ellipse 42% 38% at 50% 32%, transparent 0%, transparent 42%, color-mix(in srgb, var(--color-ink) 28%, transparent) 100%)",
          }}
        />
      ) : null}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-[5] h-full w-full select-none"
        data-canvas="clay-canvas"
        style={{ touchAction: "pan-y" }}
        aria-hidden="true"
      />
      <div
        ref={handRef}
        className="pointer-events-none absolute bottom-0 left-1/2"
        style={{ visibility: "hidden" }}
        aria-hidden="true"
      >
        {handPoses.map((pose) => (
          <img
            key={pose}
            data-hand={pose}
            src={handSrc(pose)}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain object-bottom"
            style={{ opacity: pose === "straight" ? 1 : 0 }}
          />
        ))}
      </div>
      <p
        ref={scoreRef}
        hidden
        className="pointer-events-none absolute top-4 right-4 text-[13px] font-medium text-ink"
        aria-live="polite"
      />
      {over && result ? (
        <div
          className="absolute top-1/2 left-1/2 z-10 flex w-[min(88%,28rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-2xl border border-line bg-card px-5 py-5 text-center"
          aria-live="polite"
        >
          {result.invite ? null : (
            <p className="text-sm font-medium text-muted">
              {result.score} / {Math.max(1, settings.claysPerRound)}
            </p>
          )}
          {result.hardWin ? (
            <>
              <p className="text-[22px] leading-snug font-semibold text-clay">
                {result.hardWin.banner}
              </p>
              <p className="mt-2 text-[17px] leading-snug text-ink">
                {result.hardWin.quip}
              </p>
              {beatCount != null && beatYou ? (
                <p className="mt-3 text-sm text-muted">
                  {formatBeatYouLine(beatYou, beatCount)}
                </p>
              ) : null}
            </>
          ) : (
            <p
              className={`mt-2 text-[20px] leading-snug font-semibold ${
                result.perfect || result.invite ? "text-clay" : "text-ink"
              }`}
            >
              {result.message}
            </p>
          )}
          {beatLine && !result.hardWin ? (
            <p className="mt-3 text-sm text-muted">{beatLine}</p>
          ) : null}
          {result.invite ? (
            <button
              type="button"
              className="mt-4 rounded-full border border-clay bg-card px-5 py-2.5 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              onClick={() => {
                onHardUnlock();
                onHardChange(true);
                setResult(null);
                setOver(false);
                const canvas = canvasRef.current;
                canvas?.dispatchEvent(new Event("replay"));
              }}
            >
              {hardInviteButton}
            </button>
          ) : (
            <button
              ref={replayRef}
              type="button"
              className="mt-4 rounded-full border border-line bg-card px-5 py-2.5 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              onClick={() => {
                setResult(null);
                setOver(false);
                const canvas = canvasRef.current;
                canvas?.dispatchEvent(new Event("replay"));
              }}
            >
              {replayLabel}
            </button>
          )}
          <div className="mt-3 flex gap-4 text-sm">
            <button
              type="button"
              className={`underline underline-offset-4 ${hard ? "text-clay" : "text-muted"}`}
              onClick={() => {
                onHardChange(true);
                setResult(null);
                setOver(false);
                const canvas = canvasRef.current;
                canvas?.dispatchEvent(new Event("replay"));
              }}
            >
              {hardModeLabel}
            </button>
            <button
              type="button"
              className={`underline underline-offset-4 ${!hard ? "text-clay" : "text-muted"}`}
              onClick={() => {
                onHardChange(false);
                setResult(null);
                setOver(false);
                const canvas = canvasRef.current;
                canvas?.dispatchEvent(new Event("replay"));
              }}
            >
              {normalModeLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
