import { NextRequest, NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/db/apiErrors";
import { MAX_EXPORT_DAYS, encodeExport } from "@/lib/offline/format";
import { DB_REPORT_KINDS } from "@/lib/supply/reports";
import { formatDateTime, periodRange } from "@/lib/supply/shape";
import { exportRows, expiryList, supplySource } from "@/lib/supply/source";
import type { DbReportKind } from "@/types";
import type { ExportRow } from "@/lib/offline/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/db/export?from=2025-10-01&to=2026-09-30 → every event of all four
 * reports in that range (CE, both inclusive), packed for an exported HTML
 * file (lib/offline/format.ts). At most MAX_EXPORT_DAYS days. The reports
 * are read one after another, a month at a time, to keep the load on the
 * CSSD server low.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const fromParam = p.get("from") ?? "";
  const toParam = p.get("to") ?? "";
  try {
    const { from, to } = periodRange({ from: fromParam, to: toParam, grain: "year" });
    if ((to.getTime() - from.getTime()) / 86_400_000 > MAX_EXPORT_DAYS) {
      return NextResponse.json(
        { error: "ส่งออกได้ครั้งละไม่เกิน 3 ปี เลือกช่วงให้สั้นลง" },
        { status: 400 }
      );
    }
    const rows = {} as Record<DbReportKind, ExportRow[]>;
    for (const kind of DB_REPORT_KINDS) rows[kind] = await exportRows(kind, from, to);
    const now = new Date();
    const wallClockNow = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
    return NextResponse.json({
      ...encodeExport(rows, {
        exportedAt: formatDateTime(wallClockNow),
        from: fromParam,
        to: toParam,
        demo: supplySource() === "demo",
      }),
      expiry: await expiryList(),
    });
  } catch (err) {
    return dbErrorResponse(err, `export ${fromParam}..${toParam}`);
  }
}
