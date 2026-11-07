import { NextResponse } from "next/server";
import { DbNotConfiguredError, DbWriteAccessError } from "@/lib/db/client";

/**
 * Turns a DB failure into a Thai message for the UI. Details (server names,
 * driver errors) only go to the server log, never to the browser.
 */
export function dbErrorResponse(err: unknown, context: string) {
  if (err instanceof DbNotConfiguredError) {
    return NextResponse.json({ error: err.message, configured: false }, { status: 503 });
  }
  if (err instanceof RangeError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof DbWriteAccessError) {
    console.error(`[db] ${context}: refused a login with write access`);
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
  console.error(`[db] ${context}:`, err);
  const code = (err as { code?: string })?.code;
  const message =
    code === "ELOGIN"
      ? "เข้าสู่ฐานข้อมูลไม่สำเร็จ (ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง)"
      : code === "ESOCKET" || code === "ETIMEOUT" || code === "EINSTLOOKUP"
        ? "เชื่อมต่อฐานข้อมูลไม่ได้ ตรวจสอบว่า SQL Server เปิดอยู่และตั้งค่า server/port ถูกต้อง"
        : "เกิดข้อผิดพลาดในการดึงข้อมูลจากฐานข้อมูล";
  return NextResponse.json({ error: message }, { status: 502 });
}

/** Parses a พ.ศ. fiscal year query param, or returns null if invalid. */
export function parseFiscalYear(raw: string | null): number | null {
  if (!raw || !/^\d{4}$/.test(raw)) return null;
  const fy = Number(raw);
  return fy >= 2500 && fy <= 2700 ? fy : null;
}
