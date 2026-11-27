/**
 * Start-up code of an exported HTML file ("ส่งออก HTML"): the dashboard's own
 * page, bundled with its styles and fonts into one file by
 * scripts/build-offline-viewer.mjs, running on the data the file carries.
 */
// Same fonts as app/layout.tsx, embedded so the file looks the same anywhere.
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/noto-sans-thai/thai-400.css";
import "@fontsource/noto-sans-thai/thai-500.css";
import "@fontsource/noto-sans-thai/thai-600.css";
import "@fontsource/noto-sans-thai/thai-700.css";
// Tailwind, compiled from app/globals.css by the build script.
import "../.offline-build/tailwind.css";

import { createRoot } from "react-dom/client";
import DashboardPage from "@/app/page";
import { unpackOfflineFile } from "@/lib/offline/pack";
import { openOfflineFile } from "@/lib/offline/source";

const root = document.getElementById("root")!;

unpackOfflineFile()
  .then((file) => {
    if (!file) throw new Error("ไฟล์นี้ไม่มีข้อมูล");
    openOfflineFile(file);
    createRoot(root).render(<DashboardPage />);
  })
  .catch((err) => {
    root.innerHTML = "";
    const p = document.createElement("p");
    p.style.cssText = "font-family:sans-serif;padding:24px;color:#b91c1c";
    p.textContent =
      "เปิดไฟล์ไม่สำเร็จ: " +
      (err instanceof Error ? err.message : String(err)) +
      " (ใช้ Chrome หรือ Edge รุ่นใหม่ และเปิดจากไฟล์ที่ดาวน์โหลดมาครบ)";
    root.appendChild(p);
  });
