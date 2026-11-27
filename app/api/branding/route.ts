import { NextRequest, NextResponse } from "next/server";
import { BrandingInputError, brandingInfo, editability, passwordOk, saveBranding } from "@/lib/branding";
import { MAX_LOGO_BYTES } from "@/lib/brandingTypes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/branding → BrandingInfo: the hospital's name and logo. */
export async function GET() {
  return NextResponse.json(await brandingInfo());
}

/**
 * POST /api/branding (multipart form): password, hospitalName, and
 * optionally logo (a PNG/JPG/WebP file) or removeLogo=1. Needs the admin
 * password from dashboard.env. → the new BrandingInfo.
 */
export async function POST(req: NextRequest) {
  const can = editability();
  if (!can.editable) return NextResponse.json({ error: can.reason }, { status: 403 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_LOGO_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "ไฟล์โลโก้ใหญ่เกิน 1 MB" }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 });
  }
  if (!passwordOk(String(form.get("password") ?? ""))) {
    // Slow down anyone guessing.
    await new Promise((r) => setTimeout(r, 1000));
    return NextResponse.json({ error: "รหัสผู้ดูแลไม่ถูกต้อง" }, { status: 401 });
  }

  const logo = form.get("logo");
  try {
    await saveBranding({
      hospitalName: String(form.get("hospitalName") ?? ""),
      logo: logo instanceof Blob && logo.size ? new Uint8Array(await logo.arrayBuffer()) : null,
      removeLogo: form.get("removeLogo") === "1",
    });
  } catch (err) {
    if (err instanceof BrandingInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[branding] save failed:", err);
    return NextResponse.json({ error: "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
  return NextResponse.json(await brandingInfo());
}
