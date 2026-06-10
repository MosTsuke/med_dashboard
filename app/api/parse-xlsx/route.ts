import { NextRequest, NextResponse } from "next/server";
import { resolveLogoUrl } from "@/lib/logoFromXlsx";
import { parseXLSXBuffer } from "@/lib/parseXLSX";

const ACCEPTED = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "application/octet-stream",
];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    const okExt = name.endsWith(".xlsx") || name.endsWith(".xls");
    if (!okExt && !ACCEPTED.includes(file.type)) {
      return NextResponse.json(
        { error: "รองรับเฉพาะไฟล์ .xlsx หรือ .xls เท่านั้น" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let data;
    try {
      data = parseXLSXBuffer(buffer);
    } catch {
      return NextResponse.json(
        {
          error:
            "ไม่สามารถอ่านไฟล์ได้ หากเป็นไฟล์ .xls รุ่นเก่า กรุณาบันทึกเป็น .xlsx แล้วลองใหม่",
        },
        { status: 422 }
      );
    }

    if (!data.items.length) {
      return NextResponse.json(
        {
          error:
            "ไม่พบข้อมูลในไฟล์ ตรวจสอบว่ามีหัวตาราง 'ชื่อเซต' อยู่ในชีท",
        },
        { status: 422 }
      );
    }

    const logoUrl = await resolveLogoUrl(data.logoUrl);
    return NextResponse.json({ ...data, logoUrl });
  } catch (err) {
    console.error("XLSX parse error:", err);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการอ่านไฟล์" },
      { status: 500 }
    );
  }
}
