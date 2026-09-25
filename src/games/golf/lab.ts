import type { FlightInput } from "./flight";

export const labCopy = {
  title: "Ball flight",
  intro: "A hidden page for checking the ball flight. Nothing here is linked from the site.",
  clubSpeed: "Club speed",
  face: "Face angle",
  path: "Swing path",
  strikeOffset: "Strike across the face",
  strikeHeight: "Strike height",
  heel: "Heel",
  toe: "Toe",
  low: "Low",
  high: "High",
  left: "Left",
  right: "Right",
  topDown: "From above",
  side: "From the side",
  ballSpeed: "Ball speed",
  launch: "Launch",
  spin: "Spin",
  spinAxis: "Spin axis",
  start: "Start direction",
  carry: "Carry",
  total: "Total",
  offline: "Offline",
  mph: "mph",
  degrees: "degrees",
  rpm: "rpm",
  yards: "yards",
};

export const presets: { label: string; input: FlightInput }[] = [
  { label: "Tour average", input: { clubSpeed: 113, face: 0, path: 0, strikeOffset: 0, strikeHeight: 0 } },
  { label: "Slice", input: { clubSpeed: 100, face: 4, path: -5, strikeOffset: 0, strikeHeight: 0 } },
  { label: "Hook", input: { clubSpeed: 100, face: -4, path: 5, strikeOffset: 0, strikeHeight: 0 } },
  { label: "Topped", input: { clubSpeed: 95, face: 0, path: 0, strikeOffset: 0, strikeHeight: 0.9 } },
  { label: "Fat", input: { clubSpeed: 95, face: 0, path: 0, strikeOffset: 0, strikeHeight: -0.75 } },
];
