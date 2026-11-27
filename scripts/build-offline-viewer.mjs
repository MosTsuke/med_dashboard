#!/usr/bin/env node
/**
 * Builds public/offline-viewer.html: the template of an exported HTML file
 * ("ส่งออก HTML"). It is the dashboard page itself (offline/viewer.tsx →
 * app/page.tsx), with React, the charts, Tailwind and the fonts all inlined,
 * and a placeholder where the export puts its data
 * (components/ExportHtmlButton.tsx). Runs before `next build`.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const work = join(root, ".offline-build");
mkdirSync(work, { recursive: true });

// 1. Tailwind, the same way Next builds app/globals.css.
execFileSync(
  join(root, "node_modules", ".bin", "tailwindcss"),
  ["-i", "app/globals.css", "-o", join(work, "tailwind.css"), "--minify"],
  { cwd: root, stdio: ["ignore", "ignore", "inherit"] }
);

// 2. The page, its styles and fonts, as one script and one stylesheet.
const result = await build({
  absWorkingDir: root,
  entryPoints: ["offline/viewer.tsx"],
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: ["chrome90", "edge90", "firefox100", "safari15"],
  jsx: "automatic",
  outdir: work,
  write: false,
  legalComments: "none",
  logLevel: "warning",
  loader: { ".woff2": "dataurl", ".woff": "dataurl" },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_TRUSTED_OPENER_ORIGIN": "undefined",
  },
  // Only used by the PDF export, which is switched off; never loaded.
  external: ["html2canvas", "jspdf"],
});
const js = result.outputFiles.find((f) => f.path.endsWith(".js")).text;
const css = result.outputFiles.find((f) => f.path.endsWith(".css")).text;

// Inline <script>/<style> must not contain their closing tags.
const safeJs = js.replace(/<\/script/gi, "<\\/script");
const safeCss = css.replace(/<\/style/gi, "<\\/style");

const html = `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Med Dashboard (ไฟล์ข้อมูล)</title>
<style>${safeCss}</style>
</head>
<body>
<div id="root"><p style="font-family:sans-serif;padding:24px;color:#6b7280">กำลังเปิดข้อมูล...</p></div>
<script id="med-offline-data" type="text/plain">__MED_OFFLINE_DATA__</script>
<script>${safeJs}</script>
</body>
</html>
`;
mkdirSync(join(root, "public"), { recursive: true });
writeFileSync(join(root, "public", "offline-viewer.html"), html);
console.log(`offline viewer: public/offline-viewer.html (${(html.length / 1024).toFixed(0)} KB)`);
