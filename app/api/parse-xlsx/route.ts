import { NextRequest, NextResponse } from "next/server";
import { resolveLogoUrl } from "@/lib/logoFromXlsx";
import { parseXLSXBuffer } from "@/lib/parseXLSX";

const ACCEPTED = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "application/octet-stream",
];

/** Shared by both the manual-upload (POST) and open-by-URL (GET) paths so
 * the parse/validate/logo steps only live in one place. */
async function parseAndRespond(buffer: Buffer) {
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
          "ไม่พบข้อมูลในไฟล์ ตรวจสอบว่ามีหัวตาราง 'ชื่อเซต' หรือ 'รายการ' อยู่ในชีท",
      },
      { status: 422 }
    );
  }

  const logoUrl = await resolveLogoUrl(data.logoUrl);
  return NextResponse.json({ ...data, logoUrl });
}

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
    return await parseAndRespond(buffer);
  } catch (err) {
    console.error("XLSX parse error:", err);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการอ่านไฟล์" },
      { status: 500 }
    );
  }
}

/**
 * Lets another local app (e.g. a PHP page listing xlsx files) open this
 * dashboard pre-loaded with a specific file: link to
 * `/?src=<url-encoded xlsx URL>` and the client fetches this route, which
 * fetches the file server-side (no CORS issue since it's server-to-server)
 * and parses it exactly like a manual upload.
 */
export async function GET(req: NextRequest) {
  try {
    const src = req.nextUrl.searchParams.get("src");
    if (!src) {
      return NextResponse.json({ error: "ไม่พบพารามิเตอร์ src" }, { status: 400 });
    }

    let url: URL;
    try {
      url = new URL(src);
    } catch {
      return NextResponse.json(
        { error: "src ต้องเป็น URL ที่สมบูรณ์ เช่น http://localhost:8080/uploads/xxx.xlsx" },
        { status: 400 }
      );
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return NextResponse.json({ error: "รองรับเฉพาะ http/https" }, { status: 400 });
    }

    const upstream = await fetch(url.toString());
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `ไม่สามารถดึงไฟล์จาก ${src} ได้ (${upstream.status})` },
        { status: 502 }
      );
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    return await parseAndRespond(buffer);
  } catch (err) {
    console.error("XLSX fetch/parse error:", err);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการอ่านไฟล์" },
      { status: 500 }
    );
  }
}
