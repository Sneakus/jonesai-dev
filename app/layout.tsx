import type { Metadata } from "next";
import { readHomeHeading } from "@/lib/content";
import "./globals.css";

const heading = readHomeHeading();

export const metadata: Metadata = {
  title: heading,
  description: heading,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
