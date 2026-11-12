import { reportTitle } from "@/lib/supply/reports";
import type { DashboardData, DbReportKind, DepartmentData, ItemData, MonthlyPoint, ValueKind } from "@/types";

/**
 * Pure helpers shared by every data source for the database reports
 * (สถิติจ่าย, สถิติแพ็ค, Resterile — from the CSSD database or the built-in
 * demo data). No database imports here on purpose.
 */

/** Label for rows whose department didn't resolve to a name. */
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

export function monthKey(ceYear: number, month: number): string {
  return `${ceYear + BE_OFFSET}-${String(month).padStart(2, "0")}`;
}

/** Half-open [from, to) in wall-clock time carried as UTC (see lib/db/client.ts useUTC). */
export function rangeForFiscalYear(fy: number): { from: Date; to: Date } {
  const ce = fy - BE_OFFSET;
  return { from: new Date(Date.UTC(ce - 1, 9, 1)), to: new Date(Date.UTC(ce, 9, 1)) };
}

export function rangeForMonth(key: string): { from: Date; to: Date } {
  const [beYear, mm] = key.split("-").map(Number);
  const ce = beYear - BE_OFFSET;
  return { from: new Date(Date.UTC(ce, mm - 1, 1)), to: new Date(Date.UTC(ce, mm, 1)) };
}

export function itemNameFor(setId: number | null, setName: string | null): string {
  if (setId == null) return "(ไม่ระบุชื่อรายการ — ไม่มีรหัสเซต)";
  // A null name with a set id = the set was deleted from SetTb afterwards.
  const name = setName?.trim();
  return name || `(ไม่ระบุชื่อรายการ รหัสเซต ${setId})`;
}

const pad = (n: number) => String(n).padStart(2, "0");
export function formatDateTime(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
export function formatDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** One group of events (dispenses, packs, resterile packs): set ×
 * department × calendar month. */
export interface AggregateRow {
  setId: number | null;
  setName: string | null;
  /** Current set price — null when the set has since been deleted. */
  setPrice: number | null;
  /** Price stamped on the packs involved (packs only). */
  packPrice: number | null;
  department: string | null;
  y: number;
  m: number;
  qty: number;
}

export interface RecordsQuery {
  fy: number;
  /** "2567-10"-style key; must fall inside `fy`. Omit for the whole year. */
  month?: string;
  department?: string;
  search?: string;
  page: number;
  pageSize: number;
}

/** The [from, to) range a rows query covers; throws RangeError for a month outside `fy`. */
export function rangeForRowsQuery(q: RecordsQuery): { from: Date; to: Date } {
  if (q.month && !fiscalMonthKeys(q.fy).includes(q.month)) {
    throw new RangeError(`เดือน ${q.month} ไม่อยู่ในปีงบประมาณ ${q.fy}`);
  }
  return q.month ? rangeForMonth(q.month) : rangeForFiscalYear(q.fy);
}

/** Unit of one counted event, for the "จำนวนรวม" stat. */
const QUANTITY_UNIT: Record<DbReportKind, string> = {
  supply: "ชิ้น",
  pack: "ห่อ",
  resterile: "ห่อ",
};

/**
 * One report for one fiscal year, shaped exactly like the monthly-matrix
 * Excel report (so every existing chart/table works unchanged), plus a
 * per-department breakdown the Excel report never had.
 */
export function buildReport(
  kind: DbReportKind,
  fy: number,
  rows: AggregateRow[],
  opts: { demo?: boolean } = {}
): DashboardData {
  const months = fiscalMonthKeys(fy);
  const emptyMonths = () => Object.fromEntries(months.map((k) => [k, 0])) as Record<string, number>;

  const items = new Map<string, ItemData>();
  const deptTotals = new Map<string, number>();
  const monthTotals = emptyMonths();

  for (const r of rows) {
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
        pricePerUnit: 0,
        totalPrice: 0,
        monthlyQuantity: emptyMonths(),
        departmentMonthlyQuantity: {},
      };
      items.set(key, item);
    }
    // One price per item (the app recomputes totals as qty × price when
    // slicing): the set's current price, else the highest price stamped on a
    // pack of a set that no longer exists.
    item.pricePerUnit =
      r.setPrice != null
        ? Number(r.setPrice)
        : Math.max(item.pricePerUnit, Number(r.packPrice ?? 0));
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

  // The period shown is first to last month that actually has events, so
  // a fiscal year still in progress reads "10/2569 – 11/2569", not as if the
  // whole year were in. (The charts still lay out all 12 fiscal months.)
  const monthsWithData = months.filter((m) => monthTotals[m] > 0);
  const period = monthsWithData.length
    ? { from: monthsWithData[0], to: monthsWithData[monthsWithData.length - 1] }
    : undefined;

  const valueKind: ValueKind = {
    isMonetary: true,
    perUnitLabel: "ราคา(ต่อหน่วย)",
    totalLabel: "ราคารวม",
    unit: "บาท",
    decimals: 2,
    quantityUnit: QUANTITY_UNIT[kind],
  };

  return {
    period,
    reportName: `${reportTitle(kind, fy)}${opts.demo ? " (ข้อมูลจำลอง)" : ""}`,
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
    source: { kind: "db", report: kind, fiscalYear: fy, ...(opts.demo ? { demo: true } : {}) },
  };
}
