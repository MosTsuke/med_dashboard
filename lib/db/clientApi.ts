import { offlineDataRange, offlineFile, offlineRecords, offlineReport } from "@/lib/offline/source";
import type { ExpiryList } from "@/lib/expiry";
import type { BrandingInfo } from "@/lib/brandingTypes";
import type { SupplySource } from "@/lib/supply/source";
import type { DashboardData, DbPeriod, DbReportKind, ReportRecordsPage } from "@/types";

/** Browser-side helpers for the /api/db/* routes. Inside an exported HTML
 * file they answer from the file's own data instead (lib/offline/source.ts). */

/** Runs `answer` as if it were a request, so its errors reject like one. */
const local = <T>(answer: () => T): Promise<T> => Promise.resolve().then(answer);

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "ดึงข้อมูลจากฐานข้อมูลไม่สำเร็จ");
  return body as T;
}

/** Where the database reports come from on this server; instant, no
 * database call. */
export function fetchSupplySource() {
  const file = offlineFile();
  if (file) return Promise.resolve<SupplySource>(file.demo ? "demo" : "db");
  return getJson<{ source: SupplySource }>("/api/db/supply/status").then((r) => r.source);
}

export interface ReportDataRange {
  configured: boolean;
  demo?: boolean;
  /** Fiscal years with data, newest first. */
  years: number[];
  /** First / last date with data (CE "YYYY-MM-DD"), null when none. */
  minDate: string | null;
  maxDate: string | null;
}

export function fetchReportYears(kind: DbReportKind): Promise<ReportDataRange> {
  if (offlineFile()) return local(() => offlineDataRange(kind));
  return getJson<ReportDataRange>(`/api/db/${kind}/years`);
}

/** Query string for a period: from, to (CE, inclusive) and grain. */
export function periodQuery(period: DbPeriod): string {
  return new URLSearchParams({ from: period.from, to: period.to, grain: period.grain }).toString();
}

export function fetchReport(kind: DbReportKind, period: DbPeriod): Promise<DashboardData> {
  if (offlineFile()) return local(() => offlineReport(kind, period));
  return getJson<DashboardData>(`/api/db/${kind}?${periodQuery(period)}`);
}

export function fetchReportRecords(
  kind: DbReportKind,
  params: {
    /** CE "YYYY-MM-DD", both inclusive. */
    from: string;
    to: string;
    department?: string;
    q?: string;
    page: number;
    pageSize: number;
  }
) {
  if (offlineFile()) return local(() => offlineRecords(kind, params));
  const qs = new URLSearchParams({
    from: params.from,
    to: params.to,
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.department) qs.set("department", params.department);
  if (params.q) qs.set("q", params.q);
  return getJson<ReportRecordsPage>(`/api/db/${kind}/rows?${qs}`);
}

/** หมดอายุ/ใกล้หมดอายุ as of today — or, in an exported file, as of the export. */
export function fetchExpiry(): Promise<ExpiryList> {
  const file = offlineFile();
  if (file) return local(() => file.expiry ?? { asOf: file.exportedAt.slice(0, 10), packs: [] });
  return getJson<ExpiryList>("/api/db/expiry");
}

/** The hospital's name and logo — or, in an exported file, the ones it was
 * exported with (not editable there). */
export function fetchBranding(): Promise<BrandingInfo> {
  const file = offlineFile();
  if (file) {
    return local(() => ({
      hospitalName: file.branding?.hospitalName ?? null,
      logoUrl: file.branding?.logoDataUrl ?? null,
      editable: false,
      reason: "ไฟล์ที่ส่งออกแก้ชื่อและโลโก้ไม่ได้ แก้ได้ที่ dashboard บนเครื่องที่ติดตั้ง",
    }));
  }
  return getJson<BrandingInfo>("/api/branding");
}

/** Saves a new name / logo (multipart: password, hospitalName, logo?, removeLogo?). */
export async function saveBranding(form: FormData): Promise<BrandingInfo> {
  const res = await fetch("/api/branding", { method: "POST", body: form, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "บันทึกไม่สำเร็จ");
  return body as BrandingInfo;
}
