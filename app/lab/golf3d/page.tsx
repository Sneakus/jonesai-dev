import type { Metadata } from "next";
import { Golf3dGate } from "@/components/golf3d-gate";
import { readGolfRange } from "@/lib/golf-range";
import { golfTheme as theme, type ShotCopy } from "@/src/games/golf/theme";

export const metadata: Metadata = {
  title: theme.copy.title,
  robots: { index: false, follow: false },
};

function shotCopy(): { [key: string]: ShotCopy } {
  const copy = readGolfRange();
  const outcomes: { [key: string]: ShotCopy } = {};
  for (const shot of copy.good) {
    outcomes[shot.key] = { name: shot.name, lines: shot.messages };
  }
  for (const shot of copy.faults) {
    outcomes[shot.key] = { name: shot.name, lines: shot.tip ? [shot.tip] : [] };
  }
  outcomes[copy.air.key] = {
    name: copy.air.name,
    lines: copy.air.normal,
  };
  return outcomes;
}

export default function Golf3dPage() {
  return <Golf3dGate outcomes={shotCopy()} />;
}
