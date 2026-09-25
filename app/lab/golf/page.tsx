import type { Metadata } from "next";
import { GolfLab, type OutcomeText } from "@/components/golf-lab";
import { readGolfRange } from "@/lib/golf-range";

export const metadata: Metadata = {
  title: "Lab: ball flight",
  robots: { index: false, follow: false },
  openGraph: { images: [] },
  twitter: { images: [] },
};

function outcomeText(): { [key: string]: OutcomeText } {
  const copy = readGolfRange();
  const outcomes: { [key: string]: OutcomeText } = {};
  for (const shot of copy.good) {
    outcomes[shot.key] = { name: shot.name, line: shot.cause };
  }
  for (const shot of copy.faults) {
    outcomes[shot.key] = { name: shot.name, line: shot.tip };
  }
  outcomes[copy.air.key] = { name: copy.air.name, line: copy.air.cause };
  return outcomes;
}

export default function GolfLabPage() {
  return <GolfLab outcomes={outcomeText()} />;
}
