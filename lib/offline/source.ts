import { decodeEvents, type ExportRow, type OfflineFile } from "@/lib/offline/format";
import {
  UNKNOWN_DEPARTMENT,
  buildReport,
  dataRangeFrom,
  fixWallClockToday,
  formatDate,
  formatDateTime,
  itemNameFor,
  parseIsoDate,
  periodRange,
  type AggregateRow,
} from "@/lib/supply/shape";
import type { DashboardData, DbPeriod, DbReportKind, ReportRecord, ReportRecordsPage } from "@/types";

/**
 * Inside an exported HTML file, the reports come from the events the file
 * carries instead of the server: same answers as /api/db/*, built with the
 * same code (buildReport) and the same filters as the SQL. Outside such a
 * file `offlineFile()` is null and nothing here runs.
 */

let file: OfflineFile | null = null;
const decoded = new Map<DbReportKind, ExportRow[]>();

/** Called once, before the page renders, by the exported file's start-up code. */
export function openOfflineFile(f: OfflineFile) {
  file = f;
  decoded.clear();
  // The file shows the data as it was on the day it was exported.
  fixWallClockToday(parseIsoDate(f.exportedAt.slice(0, 10)));
}

export function offlineFile(): OfflineFile | null {
  return file;
}

/** A report's events, oldest first. */
function eventsOf(kind: DbReportKind): ExportRow[] {
  if (!file) throw new Error("ไม่ใช่ไฟล์ข้อมูลที่ส่งออก");
  let rows = decoded.get(kind);
  if (!rows) decoded.set(kind, (rows = decodeEvents(file, kind)));
  return rows;
}

function inRange(rows: ExportRow[], from: Date, to: Date): ExportRow[] {
  const a = from.getTime();
  const b = to.getTime();
  return rows.filter((r) => r.at.getTime() >= a && r.at.getTime() < b);
}

export function offlineDataRange(kind: DbReportKind) {
  const rows = eventsOf(kind);
  const range = dataRangeFrom(rows[0]?.at ?? null, rows[rows.length - 1]?.at ?? null);
  return { configured: true, demo: file?.demo, ...range };
}

export function offlineReport(kind: DbReportKind, period: DbPeriod): DashboardData {
  const { from, to } = periodRange(period);
  const rows: AggregateRow[] = inRange(eventsOf(kind), from, to).map((r) => ({
    setId: r.setId,
    setName: r.setName,
    setPrice: r.setPrice,
    packPrice: r.packPrice,
    department: r.department,
    bucket: r.at,
    qty: r.qty,
  }));
  return buildReport(kind, period, rows, { demo: file?.demo });
}

/** The record list, as getDbRecords() pages it: newest first, filtered by
 * department and by set name / code / barcode. */
export function offlineRecords(
  kind: DbReportKind,
  q: { from: string; to: string; department?: string; q?: string; page: number; pageSize: number }
): ReportRecordsPage {
  const { from, to } = periodRange({ from: q.from, to: q.to, grain: "year" });
  const noDepartment = q.department === UNKNOWN_DEPARTMENT;
  const search = q.q?.trim().toLowerCase();
  const matches = inRange(eventsOf(kind), from, to)
    .filter((r) => {
      const dept = r.department?.trim();
      if (q.department && (noDepartment ? !!dept : dept !== q.department)) return false;
      return (
        !search ||
        !!r.setName?.toLowerCase().includes(search) ||
        !!r.setCode?.toLowerCase().includes(search) ||
        !!r.barcode?.toLowerCase().includes(search)
      );
    })
    .reverse(); // events are oldest first (time, then id)

  const formatAt = kind === "pack" || kind === "wash" ? formatDate : formatDateTime;
  const rows: ReportRecord[] = matches.slice((q.page - 1) * q.pageSize, q.page * q.pageSize).map((r) => ({
    id: r.id,
    date: formatAt(r.at),
    itemName: itemNameFor(r.setId, r.setName),
    barcode: r.barcode,
    quantity: r.qty,
    expiryDate: r.expiry ? formatDate(r.expiry) : null,
    department: r.department?.trim() || UNKNOWN_DEPARTMENT,
    person: r.person?.trim() || "-",
    note: r.note?.trim() || null,
  }));
  return { rows, total: matches.length };
}
