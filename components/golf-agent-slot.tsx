"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import type { GolfRangeCopy } from "@/lib/golf-range";

export function GolfAgentSlot({ copy }: { copy: GolfRangeCopy }) {
  const spot = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [Game, setGame] = useState<ComponentType<{
    copy: GolfRangeCopy;
    touch: boolean;
    armed: boolean;
    onDone: () => void;
  }> | null>(null);
  const [touch, setTouch] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches,
  );
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const node = spot.current;
    if (!node) return;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTouch(coarse);
          setNear(true);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!near || Game) return;
    let cancel = false;
    import("@/components/golf-agent-game").then((mod) => {
      if (!cancel) setGame(() => mod.GolfAgentGame);
    });
    return () => {
      cancel = true;
    };
  }, [Game, near]);

  return (
    <div ref={spot}>
      <p className="mt-8 max-w-[640px]">{copy.words.intro}</p>
      {copy.words.howTo.length > 0 ? (
        <div className="mt-4 max-w-[640px] space-y-1 text-sm text-muted">
          {copy.words.howTo.map((line) => (
            <p key={line}>
              {touch ? line.replace(/\bPress\b/g, "Tap") : line}
            </p>
          ))}
        </div>
      ) : null}
      {Game ? (
        <div className="relative mt-4">
          <Game copy={copy} touch={touch} armed={armed} onDone={() => setArmed(false)} />
          {touch && !armed ? (
            <button
              type="button"
              className="absolute inset-x-0 top-4 flex aspect-square items-center justify-center bg-paper/80 text-base min-[600px]:aspect-[16/10] w-[min(1040px,calc(100vw-2.5rem))] min-[900px]:w-[min(1040px,calc(100vw-4rem))]"
              onClick={() => setArmed(true)}
            >
              {copy.words.play}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 aspect-square w-[min(1040px,calc(100vw-2.5rem))] rounded-md border border-line bg-paper min-[600px]:aspect-[16/10] min-[900px]:w-[min(1040px,calc(100vw-4rem))]" />
      )}
    </div>
  );
}
