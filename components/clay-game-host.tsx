"use client";

import { useEffect, useState } from "react";
import { ClayScene } from "@/components/clay-scene";
import { formatBeatCount, STORAGE } from "@/src/clay-feel";
import {
  type ClayTestShortcut,
} from "@/src/clay-test-shortcuts";

type ClayGameHostProps = {
  label: string;
  startLabel: string;
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
  beatNone: string;
  beatOne: string;
  beatMany: string;
  beatYou: string;
  highGunLabel: string;
};

export function ClayGameHost({
  label,
  startLabel,
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
  beatNone,
  beatOne,
  beatMany,
  beatYou,
  highGunLabel,
}: ClayGameHostProps) {
  const [Game, setGame] = useState<
    typeof import("@/components/clay-game").ClayGame | null
  >(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [testShortcut, setTestShortcut] = useState<ClayTestShortcut | null>(
    null,
  );
  const [unlocked, setUnlocked] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    try {
      return window.localStorage.getItem(STORAGE.unlocked) === "1";
    } catch {
      return false;
    }
  });
  const [hard, setHard] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    try {
      return window.localStorage.getItem(STORAGE.mode) === "hard";
    } catch {
      return false;
    }
  });
  const [beatCount, setBeatCount] = useState<number | null>(null);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_CLAY_TEST_SHORTCUTS !== "1") {
      return;
    }
    let cancelled = false;
    void import("@/src/clay-test-shortcuts-live").then((mod) => {
      if (cancelled) {
        return;
      }
      const shortcut = mod.readClayTestShortcut();
      if (!shortcut) {
        return;
      }
      const next = mod.writeClayTestStorage(shortcut, STORAGE);
      setUnlocked(next.unlocked);
      setHard(next.mode === "hard");
      setTestShortcut(shortcut);
      if (mod.clayTestStartsPlaying(shortcut)) {
        setPlaying(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) {
      return;
    }

    let cancelled = false;

    import("@/components/clay-game")
      .then((mod) => {
        if (!cancelled) {
          setGame(() => mod.ClayGame);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });

    fetch("/api/hard-beats")
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { count?: number | null } | null) => {
        if (!cancelled && body && typeof body.count === "number") {
          setBeatCount(body.count);
        }
      })
      .catch(() => {
        // Hide the count quietly.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = (next: boolean) => {
    setHard(next);
    try {
      window.localStorage.setItem(STORAGE.mode, next ? "hard" : "normal");
    } catch {
      // Ignore.
    }
  };

  const unlock = () => {
    setUnlocked(true);
    try {
      window.localStorage.setItem(STORAGE.unlocked, "1");
    } catch {
      // Ignore.
    }
  };

  const reportPerfect = () => {
    if (testShortcut === "win" || testShortcut === "highgun") {
      // Celebration shortcuts must never increase the public beat count.
      return;
    }
    try {
      if (window.localStorage.getItem(STORAGE.counted) === "1") {
        return;
      }
      window.localStorage.setItem(STORAGE.counted, "1");
    } catch {
      // Still try once if storage is blocked.
    }
    // Show the count after this win straight away; confirm with the server.
    setBeatCount((prev) => (prev == null ? 1 : prev + 1));
    fetch("/api/hard-beats", { method: "POST" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { count?: number | null } | null) => {
        if (body && typeof body.count === "number") {
          setBeatCount(body.count);
        }
      })
      .catch(() => {
        // Keep the game working without the count.
      });
  };

  const beatLine =
    beatCount == null
      ? null
      : formatBeatCount(beatCount, {
          none: beatNone,
          one: beatOne,
          many: beatMany,
        });

  if (playing && Game && !failed) {
    return (
      <Game
        replayLabel={replayLabel}
        liveLabel={liveLabel}
        hitMark={hitMark}
        scoreMessages={scoreMessages}
        hardScoreMessages={hardScoreMessages}
        hardWins={hardWins}
        hardInvites={hardInvites}
        hardInviteButton={hardInviteButton}
        hardModeLabel={hardModeLabel}
        normalModeLabel={normalModeLabel}
        beatLine={beatLine}
        beatYou={beatYou}
        beatCount={beatCount}
        highGunLabel={highGunLabel}
        hard={hard}
        testShortcut={
          testShortcut === "win" || testShortcut === "highgun"
            ? testShortcut
            : null
        }
        onHardChange={setMode}
        onHardUnlock={unlock}
        onHardPerfect={reportPerfect}
        onFail={() => {
          setPlaying(false);
          setFailed(true);
        }}
      />
    );
  }

  return (
    <div className="relative">
      <ClayScene label={label} />
      {Game && !failed ? (
        <div className="absolute top-1/2 left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
          <button
            type="button"
            className="relative rounded-full border border-line bg-card px-5 py-2.5 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            onClick={() => setPlaying(true)}
          >
            <span className="pull-ring" aria-hidden="true" />
            {startLabel}
          </button>
          {unlocked ? (
            <div className="flex gap-4 text-sm">
              <button
                type="button"
                className={`underline underline-offset-4 ${hard ? "text-clay" : "text-muted"}`}
                onClick={() => setMode(true)}
              >
                {hardModeLabel}
              </button>
              <button
                type="button"
                className={`underline underline-offset-4 ${!hard ? "text-clay" : "text-muted"}`}
                onClick={() => setMode(false)}
              >
                {normalModeLabel}
              </button>
            </div>
          ) : null}
          {unlocked && beatLine ? (
            <p className="max-w-[16rem] text-center text-sm text-muted">{beatLine}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
