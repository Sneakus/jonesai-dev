"use client";

import dynamic from "next/dynamic";
import { golfTheme as theme, type ShotCopy } from "@/src/games/golf/theme";

const Golf3dRange = dynamic(() => import("@/components/golf3d-range").then((mod) => mod.Golf3dRange), {
  ssr: false,
  loading: () => (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-semibold">{theme.copy.title}</h1>
      <p className="mt-4 text-sm text-muted">{theme.copy.loading}</p>
    </main>
  ),
});

export function Golf3dGate({ outcomes }: { outcomes: { [key: string]: ShotCopy } }) {
  return <Golf3dRange outcomes={outcomes} />;
}
