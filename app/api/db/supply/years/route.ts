import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db/client";
import { dbErrorResponse } from "@/lib/db/apiErrors";
import { getSupplyFiscalYears } from "@/lib/db/supplyReport";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/db/supply/years → { configured, years }. The UI calls this first:
 * `configured: false` just hides the "ดึงจากฐานข้อมูล" option (file import
 * keeps working without a database).
 */
export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ configured: false, years: [] });
  }
  try {
    return NextResponse.json({ configured: true, years: await getSupplyFiscalYears() });
  } catch (err) {
    return dbErrorResponse(err, "supply fiscal years");
  }
}
