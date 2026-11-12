import type { SupplySource } from "@/lib/supply/source";
import type { DashboardData, DbPeriod, DbReportKind, ReportRecordsPage } from "@/types";

/** Browser-side helpers for the /api/db/* routes. */

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "ดึงข้อมูลจากฐานข้อมูลไม่สำเร็จ");
  return body as T;
}

/** Where the database reports come from on this server; instant, no
 * database call. */
export function fetchSupplySource() {
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

export function fetchReportYears(kind: DbReportKind) {
  return getJson<ReportDataRange>(`/api/db/${kind}/years`);
}

/** Query string for a period: from, to (CE, inclusive) and grain. */
export function periodQuery(period: DbPeriod): string {
  return new URLSearchParams({ from: period.from, to: period.to, grain: period.grain }).toString();
}

export function fetchReport(kind: DbReportKind, period: DbPeriod) {
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
