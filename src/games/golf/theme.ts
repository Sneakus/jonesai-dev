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
  font: "Instrument Sans",
  fontUrl: "/games/golf/InstrumentSans-Medium.ttf",
  copy: {
    title: "Driving range",
    swing: "Swing",
    loading: "Loading the golfer",
    noWebgl: "This view needs 3D graphics, which this browser can't show.",
    flatLink: "Open the flat test page",
    distance: "Distance",
    offline: "Offline",
    left: "left",
    right: "right",
    yards: "yards",
  },
};
