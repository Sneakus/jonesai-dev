import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
