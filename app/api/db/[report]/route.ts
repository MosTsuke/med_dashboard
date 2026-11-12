import { NextRequest, NextResponse } from "next/server";
import { PERIOD_HELP, dbErrorResponse, parsePeriodParams, unknownReportResponse } from "@/lib/db/apiErrors";
import { isDbReportKind } from "@/lib/supply/reports";
import { report } from "@/lib/supply/source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/db/<report>?from=2025-10-01&to=2025-10-31&grain=day → DashboardData
 * for that period, bucketed per day / month / fiscal year; ?fy=2568 still
 * means that whole fiscal year, month by month. <report> is supply
 * (สถิติจ่าย), pack (สถิติแพ็ค) or resterile.
 */
export async function GET(req: NextRequest, { params }: { params: { report: string } }) {
  if (!isDbReportKind(params.report)) return unknownReportResponse();
  const period = parsePeriodParams(req.nextUrl.searchParams);
  if (!period) return NextResponse.json({ error: PERIOD_HELP }, { status: 400 });
  try {
    return NextResponse.json(await report(params.report, period));
  } catch (err) {
    return dbErrorResponse(err, `${params.report} report ${period.from}..${period.to}/${period.grain}`);
  }
}
