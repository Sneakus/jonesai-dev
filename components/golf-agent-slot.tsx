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
  const [touch, setTouch] = useState(false);
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
      {Game ? (
        <div className="relative">
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
