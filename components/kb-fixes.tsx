"use client";

import { useLayoutEffect, useRef } from "react";
import type { BuildFixes } from "@/lib/content";

export function KbFixes({ fixes }: { fixes: BuildFixes }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedRef = useRef(false);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = motion.matches;
    if (motion.matches) {
      root.dataset.kbState = "done";
      return;
    }

    const arm = () => {
      root.classList.remove("is-play");
      root.classList.add("is-armed");
      root.dataset.kbState = "armed";
    };
    const play = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          root.dataset.kbStarted = String(performance.now());
          root.classList.add("is-play");
          root.dataset.kbState = "play";
        });
      });
    };
    arm();

    let played = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || played) {
          return;
        }
        played = true;
        play();
      },
      { threshold: 0.4 },
    );
    observer.observe(root);

    const onEnd = (event: AnimationEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || target.dataset.last !== "true") {
        return;
      }
      const started = Number(root.dataset.kbStarted || 0);
      if (!started || performance.now() - started < 6000) {
        return;
      }
      root.classList.remove("is-armed", "is-play");
      root.dataset.kbState = "done";
    };
    const onClick = () => {
      if (reducedRef.current) {
        return;
      }
      arm();
      play();
    };
    const onMotion = () => {
      if (motion.matches) {
        reducedRef.current = true;
        root.classList.remove("is-armed", "is-play");
        root.dataset.kbState = "done";
      }
    };
    root.addEventListener("animationend", onEnd);
    root.addEventListener("click", onClick);
    motion.addEventListener("change", onMotion);
    return () => {
      observer.disconnect();
      root.removeEventListener("animationend", onEnd);
      root.removeEventListener("click", onClick);
      motion.removeEventListener("change", onMotion);
    };
  }, []);

  return (
    <div ref={rootRef} className="kb-stage" data-kb-state="done" aria-hidden="true">
      <p className="kb-update">{fixes.update}</p>
      <div className="kb-ripple" />
      <div className="kb-docs">
        {fixes.items.map((item, index) => (
          <div className="kb-doc" key={item.title}>
            <p className="kb-title">{item.title}</p>
            <p className="kb-line">{item.clash}</p>
            <p className="kb-fix">
              <s>{item.clash}</s>
              <span>{item.fix}</span>
            </p>
            <p
              className="kb-tick"
              data-last={index === fixes.items.length - 1 ? "true" : undefined}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M3 8.5 6.2 12 13 4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {fixes.approved}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
