import { NextResponse } from "next/server";
import { DbNotConfiguredError, DbWriteAccessError } from "@/lib/db/client";
import { fiscalYearPeriod } from "@/lib/supply/shape";
import type { DbGrain, DbPeriod } from "@/types";

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

/** 404 for /api/db/<report>/… with a report that doesn't exist. */
export function unknownReportResponse() {
  return NextResponse.json(
    { error: "ไม่มีรายงานนี้ (มีแค่ supply, pack, resterile)" },
    { status: 404 }
  );
}

/**
 * The period a report request asks for: `?from=2025-10-01&to=2025-10-31
 * [&grain=day|month|year]` (CE dates, both inclusive; grain defaults to
 * month), or the older `?fy=2568` = that whole fiscal year, month by month.
 * Null when neither is given properly. (periodRange() checks the rest.)
 */
export function parsePeriodParams(p: URLSearchParams): DbPeriod | null {
  const grainParam = p.get("grain");
  const grain: DbGrain | null =
    grainParam === null ? "month" : (["day", "month", "year"] as const).find((g) => g === grainParam) ?? null;
  if (!grain) return null;
  const from = p.get("from");
  const to = p.get("to");
  if (from && to) return { from, to, grain };
  const fy = parseFiscalYear(p.get("fy"));
  return fy ? fiscalYearPeriod(fy, grain) : null;
}

export const PERIOD_HELP =
  "ระบุช่วงเวลา เช่น ?from=2025-10-01&to=2025-10-31&grain=day (grain: day, month, year) หรือ ?fy=2568";

/** Parses a พ.ศ. fiscal year query param, or returns null if invalid. */
export function parseFiscalYear(raw: string | null): number | null {
  if (!raw || !/^\d{4}$/.test(raw)) return null;
  const fy = Number(raw);
  return fy >= 2500 && fy <= 2700 ? fy : null;
}
