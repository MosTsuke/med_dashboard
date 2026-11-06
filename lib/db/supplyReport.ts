import { getPool, sql } from "@/lib/db/client";
import {
  SUPPLY_AGGREGATE_SQL,
  SUPPLY_DATE_RANGE_SQL,
  SUPPLY_ROWS_COUNT_SQL,
  SUPPLY_ROWS_SQL,
} from "@/lib/db/cssdQueries";
import type {
  DashboardData,
  DepartmentData,
  ItemData,
  MonthlyPoint,
  SupplyRow,
  SupplyRowsPage,
  ValueKind,
} from "@/types";

/** Label for dispense rows whose DepartTbId didn't resolve to a name. */
export const UNKNOWN_DEPARTMENT = "(ไม่ระบุหน่วยงาน)";

const BE_OFFSET = 543;

/** Thai fiscal year (พ.ศ.) N runs 1 Oct of N-1 to 30 Sep of N. */
export function fiscalYearOf(ceYear: number, month: number): number {
  return (month >= 10 ? ceYear + 1 : ceYear) + BE_OFFSET;
}

/** "2567-10"-style keys for the 12 months of fiscal year `fy`, in order. */
export function fiscalMonthKeys(fy: number): string[] {
  const ce = fy - BE_OFFSET;
  const keys: string[] = [];
  for (let i = 0; i < 12; i++) {
    const m = ((9 + i) % 12) + 1; // 10, 11, 12, 1, ..., 9
    const y = m >= 10 ? ce - 1 : ce;
    keys.push(`${y + BE_OFFSET}-${String(m).padStart(2, "0")}`);
  }
  return keys;
}

function monthKey(ceYear: number, month: number): string {
  return `${ceYear + BE_OFFSET}-${String(month).padStart(2, "0")}`;
}

/** Half-open [from, to) as DATETIME parameters (wall-clock, see client.ts useUTC). */
function rangeForFiscalYear(fy: number): { from: Date; to: Date } {
  const ce = fy - BE_OFFSET;
  return { from: new Date(Date.UTC(ce - 1, 9, 1)), to: new Date(Date.UTC(ce, 9, 1)) };
}

function rangeForMonth(key: string): { from: Date; to: Date } {
  const [beYear, mm] = key.split("-").map(Number);
  const ce = beYear - BE_OFFSET;
  return { from: new Date(Date.UTC(ce, mm - 1, 1)), to: new Date(Date.UTC(ce, mm, 1)) };
}

function itemNameFor(setId: number | null, setName: string | null): string {
  if (setId == null) return "(ไม่ระบุชื่อรายการ — แพ็คไม่ผูกกับเซต)";
  const name = setName?.trim();
  return name || `(ไม่ระบุชื่อรายการ รหัสเซต ${setId})`;
}

const pad = (n: number) => String(n).padStart(2, "0");
function formatDateTime(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
function formatDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

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

interface AggregateRow {
  setId: number | null;
  setName: string | null;
  price: number | null;
  department: string | null;
  y: number;
  m: number;
  qty: number;
}

/**
 * "สถิติจ่าย" for one fiscal year, shaped exactly like the monthly-matrix
 * Excel report (so every existing chart/table works unchanged), plus a
 * per-department breakdown the Excel report never had.
 */
export async function getSupplyReport(fy: number): Promise<DashboardData> {
  const { from, to } = rangeForFiscalYear(fy);
  const pool = await getPool();
  const { recordset } = await pool
    .request()
    .input("from", sql.DateTime, from)
    .input("to", sql.DateTime, to)
    .query<AggregateRow>(SUPPLY_AGGREGATE_SQL);

  const months = fiscalMonthKeys(fy);
  const emptyMonths = () => Object.fromEntries(months.map((k) => [k, 0])) as Record<string, number>;

  const items = new Map<string, ItemData>();
  const deptTotals = new Map<string, number>();
  const monthTotals = emptyMonths();

  for (const r of recordset) {
    const key = r.setId == null ? "none" : String(r.setId);
    const month = monthKey(r.y, r.m);
    const dept = r.department?.trim() || UNKNOWN_DEPARTMENT;
    const qty = Number(r.qty);

    let item = items.get(key);
    if (!item) {
      item = {
        rank: 0,
        name: itemNameFor(r.setId, r.setName),
        quantity: 0,
        pricePerUnit: Number(r.price ?? 0),
        totalPrice: 0,
        monthlyQuantity: emptyMonths(),
        departmentMonthlyQuantity: {},
      };
      items.set(key, item);
    }
    item.quantity += qty;
    item.monthlyQuantity![month] = (item.monthlyQuantity![month] ?? 0) + qty;
    const byDept = (item.departmentMonthlyQuantity![dept] ??= emptyMonths());
    byDept[month] = (byDept[month] ?? 0) + qty;

    deptTotals.set(dept, (deptTotals.get(dept) ?? 0) + qty);
    monthTotals[month] = (monthTotals[month] ?? 0) + qty;
  }

  const itemList = Array.from(items.values());
  for (const it of itemList) it.totalPrice = it.quantity * it.pricePerUnit;
  itemList.sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, "th"));
  itemList.forEach((it, i) => (it.rank = i + 1));

  const totalItems = itemList.reduce((s, i) => s + i.quantity, 0);
  const departments: DepartmentData[] = Array.from(deptTotals, ([name, count]) => ({
    name,
    count,
    percentage: totalItems ? (count / totalItems) * 100 : 0,
  })).sort((a, b) => b.count - a.count);

  const monthly: MonthlyPoint[] = months.map((month) => ({ month, quantity: monthTotals[month] ?? 0 }));

  const valueKind: ValueKind = {
    isMonetary: true,
    perUnitLabel: "ราคา(ต่อหน่วย)",
    totalLabel: "ราคารวม",
    unit: "บาท",
    decimals: 2,
    quantityUnit: "ชิ้น",
  };

  return {
    period: { from: months[0], to: months[months.length - 1] },
    reportName: `สถิติจ่ายปีงบประมาณ ${fy}`,
    fiscalYear: String(fy),
    summary: {
      totalItems,
      totalDepartments: departments.length,
      totalSets: itemList.length,
      pricePerUnit: itemList.reduce((s, i) => s + i.pricePerUnit, 0),
      totalPrice: itemList.reduce((s, i) => s + i.totalPrice, 0),
    },
    departments,
    items: itemList,
    monthly,
    valueKind,
    reportType: "monthly",
    source: { kind: "db", report: "supply", fiscalYear: fy },
  };
}

export interface SupplyRowsQuery {
  fy: number;
  /** "2567-10"-style key; must fall inside `fy`. Omit for the whole year. */
  month?: string;
  department?: string;
  search?: string;
  page: number;
  pageSize: number;
}

interface RawSupplyRow {
  supplyNo: number;
  supplyDate: Date;
  setId: number | null;
  setName: string | null;
  barcode: string | null;
  expiryDays: number | null;
  department: string | null;
  person: string | null;
}

/** Individual dispense records, newest first, one page at a time. */
export async function getSupplyRows(q: SupplyRowsQuery): Promise<SupplyRowsPage> {
  if (q.month && !fiscalMonthKeys(q.fy).includes(q.month)) {
    throw new RangeError(`เดือน ${q.month} ไม่อยู่ในปีงบประมาณ ${q.fy}`);
  }
  const { from, to } = q.month ? rangeForMonth(q.month) : rangeForFiscalYear(q.fy);
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

  const rows: SupplyRow[] = rowsResult.recordset.map((r) => {
    const expiry =
      r.expiryDays != null ? new Date(r.supplyDate.getTime() + r.expiryDays * 86_400_000) : null;
    return {
      supplyNo: r.supplyNo,
      supplyDate: formatDateTime(r.supplyDate),
      itemName: itemNameFor(r.setId, r.setName),
      barcode: r.barcode,
      expiryDays: r.expiryDays,
      expiryDate: expiry ? formatDate(expiry) : null,
      department: r.department?.trim() || UNKNOWN_DEPARTMENT,
      person: r.person?.trim() || "-",
    };
  });

  return { rows, total: countResult.recordset[0]?.total ?? 0 };
}
