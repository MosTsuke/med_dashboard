import { DbNotConfiguredError, isDbConfigured } from "@/lib/db/client";
import { getSupplyFiscalYears, getSupplyReport, getSupplyRows } from "@/lib/db/supplyReport";
import { getDemoFiscalYears, getDemoReport, getDemoRows } from "@/lib/supply/demo";
import type { SupplyRowsQuery } from "@/lib/supply/shape";
import type { DashboardData, SupplyRowsPage } from "@/types";

/**
 * Where "สถิติจ่าย" comes from:
 *  - "db"   — CSSD_DB_SERVER is set: the hospital's SQL Server.
 *  - "demo" — built-in made-up data (lib/supply/demo.ts). On by default on
 *             Vercel (no hospital database can be reachable from there),
 *             or anywhere with CSSD_DEMO=1. CSSD_DEMO=0 turns it off.
 *  - "none" — neither: the DB features stay hidden, Excel import only.
 * A configured database always wins over demo mode.
 */
export type SupplySource = "db" | "demo" | "none";

export function supplySource(): SupplySource {
  if (isDbConfigured()) return "db";
  const demo = process.env.CSSD_DEMO?.trim().toLowerCase();
  if (demo === "1" || demo === "true") return "demo";
  if (demo === "0" || demo === "false") return "none";
  return process.env.VERCEL === "1" ? "demo" : "none";
}

export async function fiscalYears(): Promise<number[]> {
  const src = supplySource();
  if (src === "demo") return getDemoFiscalYears();
  if (src === "db") return getSupplyFiscalYears();
  throw new DbNotConfiguredError();
}

export async function supplyReport(fy: number): Promise<DashboardData> {
  const src = supplySource();
  if (src === "demo") return getDemoReport(fy);
  if (src === "db") return getSupplyReport(fy);
  throw new DbNotConfiguredError();
}

export async function supplyRows(q: SupplyRowsQuery): Promise<SupplyRowsPage> {
  const src = supplySource();
  if (src === "demo") return getDemoRows(q);
  if (src === "db") return getSupplyRows(q);
  throw new DbNotConfiguredError();
}
