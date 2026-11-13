import { formatThaiIsoDate } from "@/lib/monthlyView";
import { reportTitle } from "@/lib/supply/reports";
import type {
  DashboardData,
  DbGrain,
  DbPeriod,
  DbReportKind,
  DepartmentData,
  ItemData,
  MonthlyPoint,
  ValueKind,
} from "@/types";

/**
 * Pure helpers shared by every data source for the database reports
 * (สถิติจ่าย, สถิติแพ็ค, Resterile — from the CSSD database or the built-in
 * demo data), and by the browser for periods and buckets. No database
 * imports here on purpose.
 *
 * Dates: DATETIME columns have no time zone, so wall-clock times travel as
 * UTC Date objects (see lib/db/client.ts useUTC) and are read with getUTC*.
 */

/** Label for rows whose department didn't resolve to a name. */
export const UNKNOWN_DEPARTMENT = "(ไม่ระบุหน่วยงาน)";

const BE_OFFSET = 543;
const DAY_MS = 86_400_000;

/** Thai fiscal year (พ.ศ.) N runs 1 Oct of N-1 to 30 Sep of N. */
export function fiscalYearOf(ceYear: number, month: number): number {
  return (month >= 10 ? ceYear + 1 : ceYear) + BE_OFFSET;
}

/** Half-open [from, to) of fiscal year `fy`. */
export function rangeForFiscalYear(fy: number): { from: Date; to: Date } {
  const ce = fy - BE_OFFSET;
  return { from: new Date(Date.UTC(ce - 1, 9, 1)), to: new Date(Date.UTC(ce, 9, 1)) };
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
/** Date → CE "YYYY-MM-DD". */
export function formatDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Today's date on this machine's clock, as a UTC-wall-clock midnight like
 * every other date here (the server runs on the hospital's PC, in Thai time). */
export function wallClockToday(now = new Date()): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/** CE "YYYY-MM-DD" → Date at midnight (UTC wall clock), or null if it isn't
 * a real date. */
export function parseIsoDate(s: string | null | undefined): Date | null {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return formatDate(d) === s ? d : null;
}

// ── Time buckets ─────────────────────────────────────────────────────────

/** The bucket an event at `d` falls in: "2569-11-07" (day), "2569-11"
 * (month) or "FY2570" (fiscal year), all พ.ศ. */
export function bucketKey(d: Date, grain: DbGrain): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  if (grain === "year") return `FY${fiscalYearOf(y, m)}`;
  const month = `${y + BE_OFFSET}-${pad(m)}`;
  return grain === "month" ? month : `${month}-${pad(d.getUTCDate())}`;
}

/** Half-open [from, to) a bucket key covers. */
export function rangeForBucket(key: string): { from: Date; to: Date } {
  const fy = key.match(/^FY(\d{4})$/);
  if (fy) return rangeForFiscalYear(Number(fy[1]));
  const [beYear, mm, dd] = key.split("-").map(Number);
  const ce = beYear - BE_OFFSET;
  if (dd) {
    const from = new Date(Date.UTC(ce, mm - 1, dd));
    return { from, to: new Date(from.getTime() + DAY_MS) };
  }
  return { from: new Date(Date.UTC(ce, mm - 1, 1)), to: new Date(Date.UTC(ce, mm, 1)) };
}

/** Every bucket that overlaps [from, to), in order. */
export function bucketsInRange(from: Date, to: Date, grain: DbGrain): string[] {
  const keys: string[] = [];
  let cursor = from;
  while (cursor < to) {
    const key = bucketKey(cursor, grain);
    keys.push(key);
    cursor = rangeForBucket(key).to;
  }
  return keys;
}

// ── Periods ──────────────────────────────────────────────────────────────

/** Most buckets a report may have per grain — keeps the payload and the
 * charts sane (a fiscal year has 365–366 days). */
const MAX_BUCKETS: Record<DbGrain, number> = { day: 366, month: 120, year: 50 };

/** [from, to) of a period, checked: real dates, from ≤ to, not too many
 * buckets for its grain. Throws RangeError with a Thai message otherwise. */
export function periodRange(p: DbPeriod): { from: Date; to: Date } {
  const from = parseIsoDate(p.from);
  const toDay = parseIsoDate(p.to);
  if (!from || !toDay) throw new RangeError("วันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD แบบ ค.ศ.)");
  if (toDay < from) throw new RangeError("วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด");
  const to = new Date(toDay.getTime() + DAY_MS);
  const days = Math.round((to.getTime() - from.getTime()) / DAY_MS);
  if (p.grain === "day" && days > MAX_BUCKETS.day) {
    throw new RangeError(`ดูรายวันได้ไม่เกิน ${MAX_BUCKETS.day} วัน — เลือกช่วงให้สั้นลง หรือดูรายเดือนแทน`);
  }
  if (p.grain === "month" && days > MAX_BUCKETS.month * 31) {
    throw new RangeError(`ดูรายเดือนได้ไม่เกิน ${MAX_BUCKETS.month} เดือน — ดูรายปีแทน`);
  }
  if (days > MAX_BUCKETS.year * 366) throw new RangeError("ช่วงเวลายาวเกินไป");
  return { from, to };
}

/** The whole of fiscal year `fy`, month by month — what ?fy=2568 means. */
export function fiscalYearPeriod(fy: number, grain: DbGrain = "month"): DbPeriod {
  const { from, to } = rangeForFiscalYear(fy);
  return { from: formatDate(from), to: formatDate(new Date(to.getTime() - DAY_MS)), grain };
}

/** The fiscal year a period covers exactly, or null. */
export function periodFiscalYear(p: DbPeriod): number | null {
  const from = parseIsoDate(p.from);
  if (!from) return null;
  const fy = fiscalYearOf(from.getUTCFullYear(), from.getUTCMonth() + 1);
  const whole = fiscalYearPeriod(fy);
  return whole.from === p.from && whole.to === p.to ? fy : null;
}

/** "ปีงบประมาณ 2569" for a whole fiscal year, else "1 ต.ค. 2568 – 15 พ.ย. 2568"
 * (or one date when from = to). */
export function periodLabel(p: DbPeriod): string {
  const fy = periodFiscalYear(p);
  if (fy) return `ปีงบประมาณ ${fy}`;
  return p.from === p.to
    ? formatThaiIsoDate(p.from)
    : `${formatThaiIsoDate(p.from)} – ${formatThaiIsoDate(p.to)}`;
}

/** The span of dates this report has data for, and the fiscal years in it
 * (newest first) — what the period picker offers. */
export interface DataRange {
  years: number[];
  /** CE "YYYY-MM-DD", or null when there's no data at all. */
  minDate: string | null;
  maxDate: string | null;
}

export function dataRangeFrom(minDate: Date | null, maxDate: Date | null): DataRange {
  if (!minDate || !maxDate) return { years: [], minDate: null, maxDate: null };
  const first = fiscalYearOf(minDate.getUTCFullYear(), minDate.getUTCMonth() + 1);
  const last = fiscalYearOf(maxDate.getUTCFullYear(), maxDate.getUTCMonth() + 1);
  const years: number[] = [];
  for (let fy = last; fy >= first; fy--) years.push(fy);
  return { years, minDate: formatDate(minDate), maxDate: formatDate(maxDate) };
}

/** One group of events (dispenses, packs, resterile packs): set ×
 * department × time bucket. */
export interface AggregateRow {
  setId: number | null;
  setName: string | null;
  /** Current set price — null when the set has since been deleted. */
  setPrice: number | null;
  /** Price stamped on the packs involved (packs only). */
  packPrice: number | null;
  department: string | null;
  /** Any moment inside the bucket (the DB returns the bucket's first day). */
  bucket: Date;
  qty: number;
}

/** A page of the record list: everything in [from, to). */
export interface RecordsQuery {
  from: Date;
  to: Date;
  department?: string;
  search?: string;
  page: number;
  pageSize: number;
}

/** Unit of one counted event, for the "จำนวนรวม" stat. */
const QUANTITY_UNIT: Record<DbReportKind, string> = {
  supply: "ชิ้น",
  pack: "ห่อ",
  resterile: "ห่อ",
};

/**
 * One report over one period, shaped exactly like the monthly-matrix Excel
 * report (so every existing chart/table works unchanged) — except that the
 * "months" are the period's buckets (days, months or fiscal years) — plus a
 * per-department breakdown the Excel report never had.
 */
export function buildReport(
  kind: DbReportKind,
  period: DbPeriod,
  rows: AggregateRow[],
  opts: { demo?: boolean; today?: Date } = {}
): DashboardData {
  const { from, to } = periodRange(period);
  const months = bucketsInRange(from, to, period.grain);
  const emptyMonths = () => Object.fromEntries(months.map((k) => [k, 0])) as Record<string, number>;

  const items = new Map<string, ItemData>();
  const deptTotals = new Map<string, number>();
  const monthTotals = emptyMonths();

  for (const r of rows) {
    const key = r.setId == null ? "none" : String(r.setId);
    const month = bucketKey(r.bucket, period.grain);
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

  // Buckets after today haven't happened yet: leave them off the end, or a
  // fiscal year in progress dives to 0 for every month still ahead. One
  // that has events anyway (a mistyped future date) stays, and so does the
  // first bucket, so a period can't come out with no buckets at all.
  const todayKey = bucketKey(opts.today ?? wallClockToday(), period.grain);
  let bucketCount = months.length;
  while (bucketCount > 1 && months[bucketCount - 1] > todayKey && !monthTotals[months[bucketCount - 1]]) {
    bucketCount--;
  }
  const monthly: MonthlyPoint[] = months
    .slice(0, bucketCount)
    .map((month) => ({ month, quantity: monthTotals[month] ?? 0 }));

  // The period shown is first to last bucket that actually has events, so
  // a fiscal year still in progress reads "10/2569 – 11/2569", not as if the
  // whole year were in. (The charts lay out every bucket up to today.)
  const monthsWithData = months.filter((m) => monthTotals[m] > 0);
  const shown = monthsWithData.length
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

  const fy = periodFiscalYear(period);
  return {
    period: shown,
    reportName: `${reportTitle(kind, periodLabel(period))}${opts.demo ? " (ข้อมูลจำลอง)" : ""}`,
    fiscalYear: fy ? String(fy) : undefined,
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
    source: { kind: "db", report: kind, period, ...(opts.demo ? { demo: true } : {}) },
  };
}
