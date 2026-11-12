import { DbNotConfiguredError, isDbConfigured } from "@/lib/db/client";
import { getDbDataRange, getDbRecords, getDbReport } from "@/lib/db/reports";
import { getDemoDataRange, getDemoRecords, getDemoReport } from "@/lib/supply/demo";
import type { DataRange, RecordsQuery } from "@/lib/supply/shape";
import type { DashboardData, DbPeriod, DbReportKind, ReportRecordsPage } from "@/types";

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

export async function dataRange(kind: DbReportKind): Promise<DataRange> {
  const src = supplySource();
  if (src === "demo") return getDemoDataRange(kind);
  if (src === "db") return getDbDataRange(kind);
  throw new DbNotConfiguredError();
}

export async function report(kind: DbReportKind, period: DbPeriod): Promise<DashboardData> {
  const src = supplySource();
  if (src === "demo") return getDemoReport(kind, period);
  if (src === "db") return getDbReport(kind, period);
  throw new DbNotConfiguredError();
}

export async function records(kind: DbReportKind, q: RecordsQuery): Promise<ReportRecordsPage> {
  const src = supplySource();
  if (src === "demo") return getDemoRecords(kind, q);
  if (src === "db") return getDbRecords(kind, q);
  throw new DbNotConfiguredError();
}
