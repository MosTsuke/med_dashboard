import type { DashboardData, SupplyRowsPage } from "@/types";

/** Browser-side helpers for the /api/db/* routes. */

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "ดึงข้อมูลจากฐานข้อมูลไม่สำเร็จ");
  return body as T;
}

export function fetchSupplyYears() {
  return getJson<{ configured: boolean; years: number[] }>("/api/db/supply/years");
}

export function fetchSupplyReport(fy: number) {
  return getJson<DashboardData>(`/api/db/supply?fy=${fy}`);
}

export function fetchSupplyRows(params: {
  fy: number;
  month?: string;
  department?: string;
  q?: string;
  page: number;
  pageSize: number;
}) {
  const qs = new URLSearchParams({
    fy: String(params.fy),
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.month) qs.set("month", params.month);
  if (params.department) qs.set("department", params.department);
  if (params.q) qs.set("q", params.q);
  return getJson<SupplyRowsPage>(`/api/db/supply/rows?${qs}`);
}
