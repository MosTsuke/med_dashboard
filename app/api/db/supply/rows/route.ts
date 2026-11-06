import { NextRequest, NextResponse } from "next/server";
import { dbErrorResponse, parseFiscalYear } from "@/lib/db/apiErrors";
import { supplyRows } from "@/lib/supply/source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_PAGE_SIZE = 200;

/**
 * GET /api/db/supply/rows?fy=2568[&month=2567-10][&department=ER][&q=...][&page=1&pageSize=50]
 * → { rows, total } — individual dispense records, newest first.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const fy = parseFiscalYear(p.get("fy"));
  if (!fy) {
    return NextResponse.json({ error: "ระบุปีงบประมาณ (พ.ศ.) เช่น ?fy=2568" }, { status: 400 });
  }
  const month = p.get("month") || undefined;
  if (month && !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "รูปแบบเดือนต้องเป็น YYYY-MM (พ.ศ.)" }, { status: 400 });
  }
  const page = Math.max(1, Number.parseInt(p.get("page") || "1", 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(p.get("pageSize") || "50", 10) || 50)
  );

  try {
    return NextResponse.json(
      await supplyRows({
        fy,
        month,
        department: p.get("department")?.slice(0, 100) || undefined,
        search: p.get("q")?.slice(0, 100) || undefined,
        page,
        pageSize,
      })
    );
  } catch (err) {
    return dbErrorResponse(err, `supply rows fy=${fy}`);
  }
}
