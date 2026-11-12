import { DbNotConfiguredError, isDbConfigured } from "@/lib/db/client";
import { getDbFiscalYears, getDbRecords, getDbReport } from "@/lib/db/reports";
import { getDemoFiscalYears, getDemoRecords, getDemoReport } from "@/lib/supply/demo";
import type { RecordsQuery } from "@/lib/supply/shape";
import type { DashboardData, DbReportKind, ReportRecordsPage } from "@/types";

/**
 * Where the database reports (สถิติจ่าย, สถิติแพ็ค, Resterile) come from:
 *  - "db"   — CSSD_DB_SERVER is set: the hospital's SQL Server.
 *  - "demo" — built-in made-up data (lib/supply/demo.ts). On by default on
 *             Vercel (no hospital database can be reachable from there),
 *             or anywhere with CSSD_DEMO=1. CSSD_DEMO=0 turns it off.
 *  - "none" — neither: the DB features stay hidden.
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

export async function fiscalYears(kind: DbReportKind): Promise<number[]> {
  const src = supplySource();
  if (src === "demo") return getDemoFiscalYears();
  if (src === "db") return getDbFiscalYears(kind);
  throw new DbNotConfiguredError();
}

export async function report(kind: DbReportKind, fy: number): Promise<DashboardData> {
  const src = supplySource();
  if (src === "demo") return getDemoReport(kind, fy);
  if (src === "db") return getDbReport(kind, fy);
  throw new DbNotConfiguredError();
}

export async function records(kind: DbReportKind, q: RecordsQuery): Promise<ReportRecordsPage> {
  const src = supplySource();
  if (src === "demo") return getDemoRecords(kind, q);
  if (src === "db") return getDbRecords(kind, q);
  throw new DbNotConfiguredError();
}
