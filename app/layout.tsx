import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import { readHome } from "@/lib/content";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-instrument-sans",
});

const home = readHome();

export const metadata: Metadata = {
  title: home.name,
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
