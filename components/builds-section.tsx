import Link from "next/link";
import type { Build } from "@/lib/content";

export function BuildsSection({
  heading,
  builds,
}: {
  heading: string;
  builds: Build[];
}) {
  if (builds.length === 0) {
    return null;
  }

  return (
    <section className="mt-16 pb-16">
      <h2 className="text-[22px] font-semibold tracking-[-0.035em]">
        {heading}
      </h2>
      <ul className="mt-4 flex flex-col gap-3">
        {builds.map((build) => (
          <li key={build.slug}>
            <Link
              href={`/${build.slug}`}
              className="flex items-center gap-4 rounded-2xl border border-line bg-card px-4 py-4 min-[900px]:px-5 min-[900px]:py-5"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-medium leading-snug">
                  {build.title}
                </span>
                <span className="mt-1 block text-base leading-snug text-muted">
                  {build.summary}
                </span>
              </span>
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 shrink-0 text-clay"
                aria-hidden="true"
              >
                <path
                  d="M5 12h14M13 6l6 6-6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
