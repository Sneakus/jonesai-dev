"use client";

import { useEffect, useState } from "react";
import { ClayScene } from "@/components/clay-scene";

type ClayGameHostProps = {
  label: string;
  hint: string;
  startLabel: string;
  replayLabel: string;
  liveLabel: string;
  hitMark: string;
  scoreMessages: string[][];
};

export function ClayGameHost({
  label,
  hint,
  startLabel,
  replayLabel,
  liveLabel,
  hitMark,
  scoreMessages,
}: ClayGameHostProps) {
  const [Game, setGame] = useState<
    typeof import("@/components/clay-game").ClayGame | null
  >(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);

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

    return () => {
      cancelled = true;
    };
  }, []);

  if (playing && Game && !failed) {
    return (
      <Game
        hint={hint}
        replayLabel={replayLabel}
        liveLabel={liveLabel}
        hitMark={hitMark}
        scoreMessages={scoreMessages}
        onFail={() => {
          setPlaying(false);
          setFailed(true);
        }}
      />
    );
  }

  return (
    <div className="relative">
      <ClayScene label={label} hint={hint} />
      {Game && !failed ? (
        <button
          type="button"
          className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line bg-card px-5 py-2.5 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          onClick={() => setPlaying(true)}
        >
          {startLabel}
        </button>
      ) : null}
    </div>
  );
}
