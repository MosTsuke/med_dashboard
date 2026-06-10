import { NextResponse } from "next/server";

// PDF import is no longer supported. The dashboard now accepts .xlsx / .xls only.
// Use POST /api/parse-xlsx instead.
export async function POST() {
  return NextResponse.json(
    { error: "ไม่รองรับไฟล์ PDF แล้ว กรุณาใช้ไฟล์ .xlsx หรือ .xls" },
    { status: 410 }
  );
}
