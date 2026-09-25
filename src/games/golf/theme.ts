export type ShotCopy = {
  name: string;
  lines: string[];
};

/** Colours, font and words for the 3D range. Numbers stay in settings.ts. */

export const golfTheme = {
  paper: "#f3efe6",
  ink: "#161514",
  muted: "#5c5751",
  line: "#ddd6c9",
  field: "#eae4d7",
  card: "#fbf8f2",
  clay: "#e8480c",
  clayDark: "#9e2f06",
  /** Muted grass so the ground reads as a range, kept dull next to the paper sky. */
  grass: "#8d9074",
  grassStripe: "#7f8268",
  sun: "#e8a05a",
  grip: "#2c2926",
  shaft: "#c8c2b6",
  /** Skeleton. Blue bones, green joints and a green head ring. */
  bone: "#2f6fed",
  joint: "#1f8a4c",
  /** Balance bullseye and the meter's good band. */
  gold: "#e6b428",
  /** Locked marker off the bullseye, and the meter's too-far zone. */
  miss: "#d63027",
  font: "Instrument Sans",
  fontUrl: "/games/golf/InstrumentSans-Medium.ttf",
  copy: {
    title: "Driving range",
    swing: "Swing",
    loading: "Loading the golfer",
    distance: "Distance",
    offline: "Offline",
    left: "left",
    right: "right",
    yards: "yards",
    scrub: "Swing moment",
    slow: "Slow motion",
  },
};
