import type { NextConfig } from "next";

// Preview and local development can use ?test= shortcuts. Production cannot.
const clayTestShortcuts =
  process.env.NODE_ENV !== "production" ||
  process.env.VERCEL_ENV === "preview"
    ? "1"
    : "";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_CLAY_TEST_SHORTCUTS: clayTestShortcuts,
  },
  async headers() {
    return [
      {
        // Files in public/ are not renamed when they change. Ask every time
        // so a replaced CV is not kept from an earlier visit.
        source: "/Alex_Jones_CV.pdf",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
  images: {
    qualities: [90],
  },
  outputFileTracingIncludes: {
    "/opengraph-image": [
      "./assets/fonts/InstrumentSans-Medium.ttf",
    ],
  },
};

export default nextConfig;
