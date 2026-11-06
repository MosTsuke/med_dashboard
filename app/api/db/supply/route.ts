import { NextRequest, NextResponse } from "next/server";
import { dbErrorResponse, parseFiscalYear } from "@/lib/db/apiErrors";
import { supplyReport } from "@/lib/supply/source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/db/supply?fy=2568 → "สถิติจ่าย" DashboardData for that fiscal year. */
export async function GET(req: NextRequest) {
  const fy = parseFiscalYear(req.nextUrl.searchParams.get("fy"));
  if (!fy) {
    return NextResponse.json({ error: "ระบุปีงบประมาณ (พ.ศ.) เช่น ?fy=2568" }, { status: 400 });
  }
  try {
    return NextResponse.json(await supplyReport(fy));
  } catch (err) {
    return dbErrorResponse(err, `supply report fy=${fy}`);
  }
}
