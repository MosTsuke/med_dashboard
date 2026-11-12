import { NextResponse } from "next/server";
import { supplySource } from "@/lib/supply/source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/db/supply/status → { source: "db" | "demo" | "none" } (the same
 * for every report — the app asks under "supply").
 * Answers from the server's settings alone and never touches the database,
 * so the empty screen can lay itself out at once — database first, or Excel
 * import only — even while a configured database is slow or unreachable.
 */
export function GET() {
  return NextResponse.json({ source: supplySource() });
}
