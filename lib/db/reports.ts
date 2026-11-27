import { getPool, sql } from "@/lib/db/client";
import { REPORT_SQL } from "@/lib/db/cssdQueries";
import type { ExportRow } from "@/lib/offline/format";
import { CENTRAL_STORE, UNKNOWN_PLACE, type ExpiryPack } from "@/lib/expiry";
import { EXPIRY_SQL } from "@/lib/db/cssdQueries";
import {
  UNKNOWN_DEPARTMENT,
  buildReport,
  dataRangeFrom,
  formatDate,
  formatDateTime,
  itemNameFor,
  periodRange,
  type AggregateRow,
  type DataRange,
  type RecordsQuery,
} from "@/lib/supply/shape";
import type { DashboardData, DbPeriod, DbReportKind, ReportRecord, ReportRecordsPage } from "@/types";

/** The database reports (สถิติจ่าย, สถิติแพ็ค, Resterile) read live from
 * the hospital's CSSD SQL Server. */

export async function getDbDataRange(kind: DbReportKind): Promise<DataRange> {
  const pool = await getPool();
  const { recordset } = await pool
    .request()
    .query<{ minDate: Date | null; maxDate: Date | null }>(REPORT_SQL[kind].dateRange);
  const { minDate = null, maxDate = null } = recordset[0] ?? {};
  return dataRangeFrom(minDate, maxDate);
}

export async function getDbReport(kind: DbReportKind, period: DbPeriod): Promise<DashboardData> {
  const { from, to } = periodRange(period);
  const pool = await getPool();
  const { recordset } = await pool
    .request()
    .input("from", sql.DateTime, from)
    .input("to", sql.DateTime, to)
    .query<AggregateRow>(REPORT_SQL[kind].aggregate[period.grain]);
  return buildReport(kind, period, recordset);
}

interface RawRecord {
  id: number;
  /** DATETIME for dispenses and resterile; DATE for packs and washes. */
  at: Date;
  setId: number | null;
  setName: string | null;
  barcode: number | string | null;
  quantity: number;
  /** DATE column (PackTb.SetTbExpireDate); NULL when there's no pack. */
  expiryDate: Date | null;
  department: string | null;
  person: string | null;
  note: string | null;
}

/** Individual records, newest first, one page at a time. */
export async function getDbRecords(kind: DbReportKind, q: RecordsQuery): Promise<ReportRecordsPage> {
  const { from, to } = q;
  const noDepartment = q.department === UNKNOWN_DEPARTMENT;
  const search = q.search?.trim()
    ? `%${q.search.trim().replace(/[\\%_[]/g, (c) => `\\${c}`)}%`
    : null;

  const pool = await getPool();
  const bind = (req: sql.Request) =>
    req
      .input("from", sql.DateTime, from)
      .input("to", sql.DateTime, to)
      .input("department", sql.NVarChar(100), noDepartment ? null : q.department || null)
      .input("noDepartment", sql.Bit, noDepartment ? 1 : 0)
      .input("search", sql.NVarChar(210), search);

  const [countResult, rowsResult] = await Promise.all([
    bind(pool.request()).query<{ total: number }>(REPORT_SQL[kind].rowsCount),
    bind(pool.request())
      .input("offset", sql.Int, (q.page - 1) * q.pageSize)
      .input("pageSize", sql.Int, q.pageSize)
      .query<RawRecord>(REPORT_SQL[kind].rows),
  ]);

  // Packs and washes only have a date; dispenses and resterile have a time too.
  const formatAt = kind === "pack" || kind === "wash" ? formatDate : formatDateTime;
  const rows: ReportRecord[] = rowsResult.recordset.map((r) => ({
    id: r.id,
    date: formatAt(r.at),
    itemName: itemNameFor(r.setId, r.setName),
    barcode: r.barcode != null ? String(r.barcode) : null,
    quantity: Number(r.quantity),
    expiryDate: r.expiryDate ? formatDate(r.expiryDate) : null,
    department: r.department?.trim() || UNKNOWN_DEPARTMENT,
    person: r.person?.trim() || "-",
    note: r.note?.trim() || null,
  }));

  return { rows, total: countResult.recordset[0]?.total ?? 0 };
}

/** Every event of a report in [from, to), for "ส่งออก HTML". Read a month
 * at a time, so no single query runs long on the CSSD server. */
export async function getDbExportRows(kind: DbReportKind, from: Date, to: Date): Promise<ExportRow[]> {
  const pool = await getPool();
  const out: ExportRow[] = [];
  for (let start = from; start < to; ) {
    const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    const end = next < to ? next : to;
    const { recordset } = await pool
      .request()
      .input("from", sql.DateTime, start)
      .input("to", sql.DateTime, end)
      .query<Omit<ExportRow, "barcode"> & { barcode: number | string | null }>(REPORT_SQL[kind].exportRows);
    for (const r of recordset) {
      out.push({
        ...r,
        barcode: r.barcode != null ? String(r.barcode) : null,
        qty: Number(r.qty),
        setPrice: r.setPrice == null ? null : Number(r.setPrice),
        packPrice: r.packPrice == null ? null : Number(r.packPrice),
      });
    }
    start = end;
  }
  return out;
}

interface RawExpiry {
  id: number;
  barcode: number | string | null;
  setId: number | null;
  setName: string | null;
  price: number | null;
  packDate: Date;
  expiryDate: Date;
  supplyNo: number;
  supplyFound: number | null;
  supplyDate: Date | null;
  department: string | null;
  method: string | null;
}

/** Packs not back at CSSD, expired or expiring on or before `until`. */
export async function getDbExpiry(until: Date): Promise<ExpiryPack[]> {
  const pool = await getPool();
  const { recordset } = await pool.request().input("until", sql.Date, until).query<RawExpiry>(EXPIRY_SQL);
  return recordset
    .map((r) => ({
      id: r.id,
      barcode: r.barcode != null ? String(r.barcode) : null,
      itemName: itemNameFor(r.setId, r.setName),
      location:
        r.supplyNo === 0
          ? CENTRAL_STORE
          : r.supplyFound == null
            ? UNKNOWN_PLACE
            : r.department?.trim() || UNKNOWN_DEPARTMENT,
      packDate: formatDate(r.packDate),
      expiryDate: formatDate(r.expiryDate),
      supplyDate: r.supplyNo !== 0 && r.supplyDate ? formatDate(r.supplyDate) : null,
      method: r.method?.trim() || null,
      price: Number(r.price ?? 0),
    }))
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.id - b.id);
}
