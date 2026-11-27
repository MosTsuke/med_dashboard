"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { offlineFile } from "@/lib/offline/source";

/** Port of the hospital's other reports, on the same machine as the dashboard. */
export const EXTRA_REPORTS_PORT = "81";

/** The address of those reports: this page's address with port 81 and no
 * path, e.g. http://192.168.1.10:3001/?db=supply → http://192.168.1.10:81/ */
export function extraReportsUrl(pageUrl: string): string {
  const url = new URL(pageUrl);
  url.port = EXTRA_REPORTS_PORT;
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString();
}

/** "รายงานเพิ่มเติม" — opens the reports on port 81 in a new tab. */
export default function ExtraReportsLink() {
  // The address is only known in the browser. An exported HTML file
  // points at the dashboard it was exported from.
  const [href, setHref] = useState<string | null>(null);
  useEffect(() => setHref(extraReportsUrl(offlineFile()?.origin ?? window.location.href)), []);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 text-xs font-medium text-gray-600 px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors"
    >
      <ExternalLink size={13} />
      รายงานเพิ่มเติม
    </a>
  );
}
