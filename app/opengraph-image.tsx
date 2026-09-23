import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { readHome } from "@/lib/content";

export const runtime = "nodejs";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

const home = readHome();
export const alt = `${home.title} ${home.name}`;

const instrumentSans = readFile(
  path.join(
    process.cwd(),
    "assets",
    "fonts",
    "InstrumentSans-Medium.ttf",
  ),
).then(
  (font) =>
    font.buffer.slice(
      font.byteOffset,
      font.byteOffset + font.byteLength,
    ) as ArrayBuffer,
);

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          background: "#f3efe6",
          color: "#161514",
          fontFamily: "Instrument Sans",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 68,
            top: 80,
            display: "flex",
            width: 880,
            fontSize: 172,
            fontWeight: 500,
            letterSpacing: "-0.055em",
            lineHeight: 0.88,
          }}
        >
          {home.title}
        </div>

        <svg
          width="280"
          height="140"
          viewBox="0 0 280 140"
          style={{
            position: "absolute",
            right: 92,
            bottom: 82,
            transform: "rotate(-8deg)",
          }}
        >
          <ellipse
            cx="140"
            cy="82"
            rx="112"
            ry="39"
            fill="#e8480c"
          />
          <path
            d="M 38 80 C 72 27, 208 27, 242 80"
            fill="none"
            stroke="#9e2f06"
            strokeWidth="7"
            strokeLinecap="round"
          />
        </svg>

        <div
          style={{
            position: "absolute",
            right: 54,
            top: 42,
            display: "flex",
            fontSize: 34,
            fontWeight: 500,
            letterSpacing: "-0.025em",
          }}
        >
          {home.name}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Instrument Sans",
          data: await instrumentSans,
          weight: 500,
          style: "normal",
        },
      ],
    },
  );
}
