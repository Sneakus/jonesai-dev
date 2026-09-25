import type { FlightInput } from "./flight";
import type { ShotReading } from "./shot-rules";

/** Feed the site's flight engine with the numbers the swing rules worked out. */
export function shotToFlight(shot: Pick<ShotReading, "clubMph" | "path" | "face" | "strike" | "contact">): FlightInput {
  const strikeOffset = shot.strike === "heel" ? -0.6 : shot.strike === "toe" ? 0.6 : shot.strike === "air" ? 1.2 : 0;
  const strikeHeight = shot.contact === "fat" ? -0.7 : shot.contact === "thin" ? 0.55 : shot.contact === "top" ? 0.9 : 0;
  return {
    clubSpeed: shot.clubMph,
    path: shot.path,
    face: shot.face,
    strikeOffset,
    strikeHeight,
  };
}
