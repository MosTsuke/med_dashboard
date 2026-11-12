import { NextRequest, NextResponse } from "next/server";
import { dbErrorResponse, parseFiscalYear, unknownReportResponse } from "@/lib/db/apiErrors";
import { isDbReportKind } from "@/lib/supply/reports";
import { report } from "@/lib/supply/source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/db/<report>?fy=2568 → DashboardData for that fiscal year, where
 * <report> is supply (สถิติจ่าย), pack (สถิติแพ็ค) or resterile.
 */
export async function GET(req: NextRequest, { params }: { params: { report: string } }) {
  if (!isDbReportKind(params.report)) return unknownReportResponse();
  const fy = parseFiscalYear(req.nextUrl.searchParams.get("fy"));
  if (!fy) {
    return NextResponse.json({ error: "ระบุปีงบประมาณ (พ.ศ.) เช่น ?fy=2568" }, { status: 400 });
  }
  try {
    return NextResponse.json(await report(params.report, fy));
  } catch (err) {
    return dbErrorResponse(err, `${params.report} report fy=${fy}`);
  }
}
