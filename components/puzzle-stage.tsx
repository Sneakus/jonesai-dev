"use client";

import { useEffect, useRef } from "react";

export function PuzzleStage() {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    let dispose = () => {};
    let stopped = false;
    import("@/src/puzzle-box/mount").then(async (mod) => {
      const stop = await mod.mountPuzzleBox(stage);
      if (stopped) {
        stop();
      } else {
        dispose = stop;
      }
    });
    return () => {
      stopped = true;
      dispose();
    };
  }, []);

  return (
    <div className="mt-8">
      <div
        className="puzzle-stage"
        ref={stageRef}
        aria-label="A walnut puzzle box with brass fittings and three brass combination rings. Drag the rings up or down to turn them, drag anywhere else to look around it."
      >
        <div className="loading" id="loading">
          Unpacking the box
        </div>
        <div
          className="turntable"
          id="turntable"
          role="slider"
          aria-label="Turn the box"
          aria-valuetext="Drag to turn the box"
          tabIndex={0}
        >
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <path
              d="M12 22a12 12 0 0 1 21-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M34 9v7h-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M36 26a12 12 0 0 1-21 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M14 39v-7h7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      <p className="puzzle-help">
        Drag to turn the box. Double-tap anywhere to look closer. On a phone, use two fingers or the turn button to turn it. When you&apos;re holding something, scroll or pinch to look closer at it.
      </p>
    </div>
  );
}
