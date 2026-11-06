import { getPool, sql } from "@/lib/db/client";
import {
  SUPPLY_AGGREGATE_SQL,
  SUPPLY_DATE_RANGE_SQL,
  SUPPLY_ROWS_COUNT_SQL,
  SUPPLY_ROWS_SQL,
} from "@/lib/db/cssdQueries";
import {
  UNKNOWN_DEPARTMENT,
  buildSupplyReport,
  fiscalYearOf,
  formatDate,
  formatDateTime,
  itemNameFor,
  rangeForFiscalYear,
  rangeForRowsQuery,
  type AggregateRow,
  type SupplyRowsQuery,
} from "@/lib/supply/shape";
import type { DashboardData, SupplyRow, SupplyRowsPage } from "@/types";

/** "สถิติจ่าย" read live from the hospital's CSSD SQL Server. */

/** Fiscal years that have at least one dispense record, newest first. */
export async function getSupplyFiscalYears(): Promise<number[]> {
  const pool = await getPool();
  const { recordset } = await pool.request().query<{ minDate: Date | null; maxDate: Date | null }>(
    SUPPLY_DATE_RANGE_SQL
  );
  const { minDate, maxDate } = recordset[0] ?? {};
  if (!minDate || !maxDate) return [];
  const first = fiscalYearOf(minDate.getUTCFullYear(), minDate.getUTCMonth() + 1);
  const last = fiscalYearOf(maxDate.getUTCFullYear(), maxDate.getUTCMonth() + 1);
  const years: number[] = [];
  for (let fy = last; fy >= first; fy--) years.push(fy);
  return years;
}

export async function getSupplyReport(fy: number): Promise<DashboardData> {
  const { from, to } = rangeForFiscalYear(fy);
  const pool = await getPool();
  const { recordset } = await pool
    .request()
    .input("from", sql.DateTime, from)
    .input("to", sql.DateTime, to)
    .query<AggregateRow>(SUPPLY_AGGREGATE_SQL);
  return buildSupplyReport(fy, recordset);
}

interface RawSupplyRow {
  supplyNo: number;
  supplyDate: Date;
  setId: number | null;
  setName: string | null;
  barcode: number | string | null;
  quantity: number;
  /** DATE column (PackTb.SetTbExpireDate); NULL for consumables. */
  expiryDate: Date | null;
  department: string | null;
  person: string | null;
}

/** Individual dispense records, newest first, one page at a time. */
export async function getSupplyRows(q: SupplyRowsQuery): Promise<SupplyRowsPage> {
  const { from, to } = rangeForRowsQuery(q);
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
    bind(pool.request()).query<{ total: number }>(SUPPLY_ROWS_COUNT_SQL),
    bind(pool.request())
      .input("offset", sql.Int, (q.page - 1) * q.pageSize)
      .input("pageSize", sql.Int, q.pageSize)
      .query<RawSupplyRow>(SUPPLY_ROWS_SQL),
  ]);

  const rows: SupplyRow[] = rowsResult.recordset.map((r) => ({
    supplyNo: r.supplyNo,
    supplyDate: formatDateTime(r.supplyDate),
    itemName: itemNameFor(r.setId, r.setName),
    barcode: r.barcode != null ? String(r.barcode) : null,
    quantity: Number(r.quantity),
    expiryDate: r.expiryDate ? formatDate(r.expiryDate) : null,
    department: r.department?.trim() || UNKNOWN_DEPARTMENT,
    person: r.person?.trim() || "-",
  }));

  return { rows, total: countResult.recordset[0]?.total ?? 0 };
}
