"use client";

import { Analytics } from "@vercel/analytics/next";
import { analyticsBeforeSend } from "@/src/site-analytics";

/** Client-only so beforeSend stays in the browser and does not block first paint. */
export function SiteAnalytics() {
  return <Analytics mode="auto" beforeSend={analyticsBeforeSend} />;
}
