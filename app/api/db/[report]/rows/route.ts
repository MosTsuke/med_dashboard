import { NextRequest, NextResponse } from "next/server";
import { dbErrorResponse, unknownReportResponse } from "@/lib/db/apiErrors";
import { isDbReportKind } from "@/lib/supply/reports";
import { periodRange } from "@/lib/supply/shape";
import { records } from "@/lib/supply/source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_PAGE_SIZE = 200;

/**
 * GET /api/db/<report>/rows?from=2025-10-01&to=2025-10-31[&department=ER][&q=...][&page=1&pageSize=50]
 * → { rows, total } — individual records in that date range (CE, both ends
 * inclusive), newest first.
 */
export async function GET(req: NextRequest, { params }: { params: { report: string } }) {
  if (!isDbReportKind(params.report)) return unknownReportResponse();
  const p = req.nextUrl.searchParams;
  const page = Math.max(1, Number.parseInt(p.get("page") || "1", 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(p.get("pageSize") || "50", 10) || 50)
  );

  try {
    // Records are paged, so any length of range is fine — "year" skips
    // the per-day limit that only matters for reports.
    const { from, to } = periodRange({ from: p.get("from") ?? "", to: p.get("to") ?? "", grain: "year" });
    return NextResponse.json(
      await records(params.report, {
        from,
        to,
        department: p.get("department")?.slice(0, 100) || undefined,
        search: p.get("q")?.slice(0, 100) || undefined,
        page,
        pageSize,
      })
    );
  } catch (err) {
    return dbErrorResponse(err, `${params.report} rows ${p.get("from")}..${p.get("to")}`);
  }
}
