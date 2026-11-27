import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/db/apiErrors";
import { expiryList } from "@/lib/supply/source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/db/expiry → { asOf, packs }: packs not back at CSSD that have
 * expired or expire within 30 days, with where each one is (lib/expiry.ts).
 */
export async function GET() {
  try {
    return NextResponse.json(await expiryList());
  } catch (err) {
    return dbErrorResponse(err, "expiry");
  }
}
