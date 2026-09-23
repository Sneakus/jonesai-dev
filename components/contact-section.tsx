"use client";

import { useEffect, useRef, useState } from "react";
import type { ContactContent } from "@/lib/content";

type CopyState = "copy" | "copied" | "control" | "command";

function mailbox() {
  // Keep the address out of the HTML and downloaded JavaScript as readable text.
  const coded = [
    114, 127, 118, 107, 83, 121, 124, 125, 118, 96, 114, 122, 61, 119, 118,
    101,
  ];
  const mask = coded.length + 3;
  let text = "";
  for (const code of coded) {
    text += String.fromCharCode(code ^ mask);
  }
  return text;
}

export function ContactSection({ contact }: { contact: ContactContent }) {
  const emailRef = useRef<HTMLAnchorElement>(null);
  const copyRef = useRef<HTMLButtonElement>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const [copyState, setCopyState] = useState<CopyState>("copy");
  const [copyVisible, setCopyVisible] = useState(true);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const link = emailRef.current;
    const button = copyRef.current;
    if (!link || !button) {
      return;
    }
    const address = mailbox();
    link.textContent = address;
    link.href = `mailto:${address}`;
    button.hidden = false;
  }, []);

  useEffect(() => {
    return () => {
      if (fadeTimerRef.current !== null) {
        window.clearTimeout(fadeTimerRef.current);
      }
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const changeState = (next: CopyState) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCopyState(next);
      setCopyVisible(true);
      return;
    }
    setCopyVisible(false);
    fadeTimerRef.current = window.setTimeout(() => {
      setCopyState(next);
      setCopyVisible(true);
    }, 90);
  };

  const showFeedback = (
    next: CopyState,
    duration: number,
    liveMessage = "",
  ) => {
    if (fadeTimerRef.current !== null) {
      window.clearTimeout(fadeTimerRef.current);
    }
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    setAnnouncement(liveMessage);
    changeState(next);
    resetTimerRef.current = window.setTimeout(() => {
      setAnnouncement("");
      changeState("copy");
    }, duration);
  };

  const selectEmail = () => {
    const link = emailRef.current;
    if (!link) {
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(link);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const copy = async () => {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(mailbox());
      showFeedback("copied", 2000, contact.copiedAnnouncement);
    } catch {
      selectEmail();
      const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
      showFeedback(isMac ? "command" : "control", 3000);
    }
  };

  const copyText = {
    copy: contact.copyLabel,
    copied: contact.copiedLabel,
    control: contact.copyFallbackControl,
    command: contact.copyFallbackCommand,
  }[copyState];

  return (
    <section className="border-t border-line pt-8 pb-16">
      <h2 className="text-[22px] font-semibold tracking-[-0.035em]">
        {contact.heading}
      </h2>
      <p className="mt-4 text-base text-muted">{contact.intro}</p>
      <div className="mt-6 flex max-w-full flex-wrap items-center gap-3">
        <a
          ref={emailRef}
          className="max-w-full break-all text-base underline underline-offset-4"
        />
        <button
          ref={copyRef}
          type="button"
          onClick={copy}
          hidden
          className="w-36 shrink-0 rounded-full border border-line bg-card px-3 py-1 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <span
            className={`flex items-center justify-center gap-1.5 transition-opacity duration-100 motion-reduce:transition-none ${
              copyVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            {copyState === "copied" ? (
              <svg
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5 shrink-0 text-clay"
                aria-hidden="true"
              >
                <path
                  d="M3 8.5 6.2 12 13 4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
            <span>{copyText}</span>
          </span>
        </button>
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </span>
      </div>
      <ul className="mt-6 flex max-w-full flex-wrap gap-x-6 gap-y-2">
        <li>
          <a
            href={contact.linkedInUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            {contact.linkedInLabel}
          </a>
        </li>
        <li>
          <a
            href={contact.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            {contact.githubLabel}
          </a>
        </li>
        <li>
          <a href={contact.cvUrl} download className="underline underline-offset-4">
            {contact.cvLabel}
          </a>
        </li>
      </ul>
    </section>
  );
}
