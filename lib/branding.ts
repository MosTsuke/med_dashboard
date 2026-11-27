import { createHash, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { LOGO_TYPES, MAX_HOSPITAL_NAME, MAX_LOGO_BYTES, type BrandingInfo, type LogoType } from "@/lib/brandingTypes";

/**
 * Where the hospital's name and logo live on the server, and the rules for
 * changing them. Server-only.
 *
 * Stored in BRANDING_DIR (on the hospital's machine C:\med-dashboard\branding,
 * set by scripts\run-dashboard.cmd — outside app\, so updates never touch
 * it): settings.json plus the logo file. Changing them needs the admin
 * password DASHBOARD_ADMIN_PASSWORD from dashboard.env; without one set,
 * nothing can be changed from the page.
 */

interface Stored {
  hospitalName: string | null;
  logo: { file: string; type: LogoType; savedAt: string } | null;
}

const EMPTY: Stored = { hospitalName: null, logo: null };
const EXT: Record<LogoType, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

function dir(): string {
  return process.env.BRANDING_DIR || path.join(process.cwd(), ".branding");
}

async function readStored(): Promise<Stored> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(dir(), "settings.json"), "utf8")) as Partial<Stored>;
    const type = raw.logo?.type;
    return {
      hospitalName: typeof raw.hospitalName === "string" && raw.hospitalName.trim() ? raw.hospitalName : null,
      logo:
        raw.logo && typeof raw.logo.file === "string" && LOGO_TYPES.includes(type as LogoType)
          ? { file: path.basename(raw.logo.file), type: type as LogoType, savedAt: String(raw.logo.savedAt ?? "") }
          : null,
    };
  } catch {
    return EMPTY;
  }
}

/** Whether the page may change them, and why not. */
export function editability(): { editable: boolean; reason?: string } {
  if (process.env.VERCEL === "1") return { editable: false, reason: "เว็บสาธิตเปลี่ยนชื่อและโลโก้ไม่ได้" };
  if (!process.env.DASHBOARD_ADMIN_PASSWORD?.trim()) {
    return {
      editable: false,
      reason:
        "ยังไม่ได้ตั้งรหัสผู้ดูแล ให้เพิ่มบรรทัด DASHBOARD_ADMIN_PASSWORD=\"...\" ในไฟล์ dashboard.env บนเครื่องที่ติดตั้ง แล้วเปิด dashboard ใหม่ (ดู README-TH.txt)",
    };
  }
  return { editable: true };
}

export async function brandingInfo(): Promise<BrandingInfo> {
  const s = await readStored();
  return {
    hospitalName: s.hospitalName,
    logoUrl: s.logo ? `/api/branding/logo?v=${encodeURIComponent(s.logo.savedAt)}` : null,
    ...editability(),
  };
}

export async function readLogo(): Promise<{ bytes: Buffer; type: LogoType } | null> {
  const s = await readStored();
  if (!s.logo) return null;
  try {
    return { bytes: await fs.readFile(path.join(dir(), s.logo.file)), type: s.logo.type };
  } catch {
    return null;
  }
}

/** Constant-time check of the admin password. */
export function passwordOk(given: string): boolean {
  const want = process.env.DASHBOARD_ADMIN_PASSWORD?.trim();
  if (!want) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(want).digest();
  return timingSafeEqual(a, b);
}

/** The picture's real type from its first bytes (not its name or what the
 * browser claims), or null if it isn't a PNG, JPEG or WebP. */
export function sniffImage(bytes: Uint8Array): LogoType | null {
  const at = (i: number, ...v: number[]) => v.every((x, k) => bytes[i + k] === x);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  return null;
}

/** A name as stored: no control characters, spaces collapsed, at most
 * MAX_HOSPITAL_NAME characters; "" = back to "Med Dashboard". */
export function cleanName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_HOSPITAL_NAME);
}

export class BrandingInputError extends Error {}

/** Saves a new name and, optionally, a new logo (or removes it). */
export async function saveBranding(change: {
  hospitalName: string;
  logo?: Uint8Array | null;
  removeLogo?: boolean;
}): Promise<void> {
  const current = await readStored();
  const next: Stored = { hospitalName: cleanName(change.hospitalName) || null, logo: current.logo };
  await fs.mkdir(dir(), { recursive: true });

  if (change.logo && change.logo.length) {
    if (change.logo.length > MAX_LOGO_BYTES) throw new BrandingInputError("ไฟล์โลโก้ใหญ่เกิน 1 MB");
    const type = sniffImage(change.logo);
    if (!type) throw new BrandingInputError("โลโก้ต้องเป็นไฟล์รูป PNG, JPG หรือ WebP");
    const savedAt = new Date().toISOString();
    const file = `logo-${savedAt.replace(/\D/g, "")}.${EXT[type]}`;
    await fs.writeFile(path.join(dir(), file), change.logo);
    next.logo = { file, type, savedAt };
  } else if (change.removeLogo) {
    next.logo = null;
  }

  // Write settings.json whole, then swap it in, so it's never half-written.
  const tmp = path.join(dir(), "settings.json.tmp");
  await fs.writeFile(tmp, JSON.stringify(next, null, 2), "utf8");
  await fs.rename(tmp, path.join(dir(), "settings.json"));

  // Old logo files are no longer referenced.
  for (const f of await fs.readdir(dir())) {
    if (/^logo-\d+\.(png|jpg|webp)$/.test(f) && f !== next.logo?.file) {
      await fs.unlink(path.join(dir(), f)).catch(() => {});
    }
  }
}
