import type { Metadata } from "next";
// Fonts are bundled into the build (not loaded from Google Fonts) so the
// dashboard renders the same on a hospital network with no internet.
// Inter covers Latin; Noto Sans Thai fills in the Thai glyphs.
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/noto-sans-thai/thai-400.css";
import "@fontsource/noto-sans-thai/thai-500.css";
import "@fontsource/noto-sans-thai/thai-600.css";
import "@fontsource/noto-sans-thai/thai-700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Med Dashboard",
  description: "ระบบแสดงผลข้อมูลทางการแพทย์",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
