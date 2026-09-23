import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import { readHome } from "@/lib/content";
import { DEFAULT_SHARE_IMAGE, SITE_URL } from "@/lib/site-config";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-instrument-sans",
});

const home = readHome();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: home.metaTitle,
  description: home.metaDescription,
  openGraph: {
    type: "website",
    url: "/",
    siteName: home.name,
    title: home.metaTitle,
    description: home.metaDescription,
    images: [DEFAULT_SHARE_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: home.metaTitle,
    description: home.metaDescription,
    images: [DEFAULT_SHARE_IMAGE.url],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={instrumentSans.variable}>
      <body className={`${instrumentSans.className} bg-paper text-ink`}>
        {children}
      </body>
    </html>
  );
}
