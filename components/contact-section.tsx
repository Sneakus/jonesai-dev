"use client";

import { useEffect, useRef } from "react";
import type { ContactContent } from "@/lib/content";

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

  const copy = () => {
    if (!navigator.clipboard) {
      return;
    }
    void navigator.clipboard.writeText(mailbox());
  };

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
          className="shrink-0 rounded-full border border-line bg-card px-3 py-1 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {contact.copyLabel}
        </button>
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
