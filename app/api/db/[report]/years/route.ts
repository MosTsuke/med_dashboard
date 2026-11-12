import { NextResponse } from "next/server";
import { dbErrorResponse, unknownReportResponse } from "@/lib/db/apiErrors";
import { isDbReportKind } from "@/lib/supply/reports";
import { fiscalYears, supplySource } from "@/lib/supply/source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/db/<report>/years → { configured, demo, years }: the fiscal
 * years that have data for this report. `configured: false` = no database
 * on this server; `demo: true` = the years and everything after them are
 * made-up demo data.
 */
export async function GET(_req: Request, { params }: { params: { report: string } }) {
  if (!isDbReportKind(params.report)) return unknownReportResponse();
  const source = supplySource();
  if (source === "none") {
    return NextResponse.json({ configured: false, demo: false, years: [] });
  }
  try {
    return NextResponse.json({
      configured: true,
      demo: source === "demo",
      years: await fiscalYears(params.report),
    });
  } catch (err) {
    return dbErrorResponse(err, `${params.report} fiscal years`);
  }
}
