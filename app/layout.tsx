import type { Metadata } from "next";
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
