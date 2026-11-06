import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/db/apiErrors";
import { fiscalYears, supplySource } from "@/lib/supply/source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/db/supply/years → { configured, demo, years }. The UI calls this
 * first: `configured: false` just hides the "ดึงจากฐานข้อมูล" option (file
 * import keeps working without a database); `demo: true` means the years
 * and everything after them are made-up demo data.
 */
export async function GET() {
  const source = supplySource();
  if (source === "none") {
    return NextResponse.json({ configured: false, demo: false, years: [] });
  }
  try {
    return NextResponse.json({ configured: true, demo: source === "demo", years: await fiscalYears() });
  } catch (err) {
    return dbErrorResponse(err, "supply fiscal years");
  }
}
