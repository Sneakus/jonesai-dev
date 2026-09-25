import type { FlightInput } from "./flight";

/** A centred driver strike with a little natural scatter, still a playable shot. */
export function gentleStrike(): FlightInput {
  const wobble = () => Math.random() - 0.5;
  return {
    clubSpeed: 108 + wobble() * 6,
    face: wobble() * 1.8,
    path: wobble() * 1.4,
    strikeOffset: wobble() * 0.16,
    strikeHeight: wobble() * 0.16,
  };
}
