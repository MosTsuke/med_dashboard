import { fiscalYearPeriod, formatDate, rangeForFiscalYear } from "@/lib/supply/shape";
import type { DashboardData, DbPeriod } from "@/types";

/**
 * Fiscal-year comparison (เปรียบเทียบปีงบประมาณ): two or three fiscal years
 * of one database report side by side. Built from the ordinary report of
 * each year, month by month, so there is no query of its own. Pure helpers,
 * shared by the comparison view and its checks.
 *
 * Dates are CE "YYYY-MM-DD" strings (inclusive), like DbPeriod.
 */

export const MIN_COMPARE_YEARS = 2;
/** More than three gets hard to read (the hospital's own request). */
export const MAX_COMPARE_YEARS = 3;

/** ต.ค. … ก.ย. — a fiscal year's months in order. */
export const FISCAL_MONTHS = [
  "ต.ค.", "พ.ย.", "ธ.ค.", "ม.ค.", "ก.พ.", "มี.ค.",
  "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.",
];

const THAI_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];
const DAY_MS = 86_400_000;
/** An average month, for "เฉลี่ยต่อเดือน" over spans that aren't whole months. */
const MONTH_DAYS = 365.25 / 12;

/** Place in the fiscal year (ต.ค. = 0 … ก.ย. = 11) of a month bucket "2569-11". */
export function fiscalMonthIndex(bucket: string): number {
  return (Number(bucket.slice(5, 7)) + 2) % 12;
}

/** "12 พ.ย." */
export function dayMonthLabel(date: string): string {
  return `${Number(date.slice(8, 10))} ${THAI_MONTHS[Number(date.slice(5, 7)) - 1]}`;
}

/** Days from `from` to `to`, both counted. */
export function daysInclusive(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;
}

// ── Which part of a year has data ────────────────────────────────────────

/** The part of fiscal year `fy` the database has data for. */
export interface YearCoverage {
  fy: number;
  from: string;
  to: string;
  /** Data only begins after 1 ต.ค. (the program started mid-year). */
  startsLate: boolean;
  /** Data stops before 30 ก.ย. — the year still in progress. */
  endsEarly: boolean;
}

export function yearCoverage(fy: number, minDate: string, maxDate: string): YearCoverage {
  const { from, to } = rangeForFiscalYear(fy);
  const first = formatDate(from);
  const last = formatDate(new Date(to.getTime() - DAY_MS));
  return {
    fy,
    from: minDate > first ? minDate : first,
    to: maxDate < last ? maxDate : last,
    startsLate: minDate > first,
    endsEarly: maxDate < last,
  };
}

/** Years to start on: the latest whole fiscal years (as the hospital's own
 * comparison does), or simply the latest years when fewer than two are whole.
 * `years` newest first, as the API gives them; the result oldest first. */
export function defaultCompareYears(years: number[], coverage: (fy: number) => YearCoverage): number[] {
  const whole = years.filter((fy) => !coverage(fy).startsLate && !coverage(fy).endsEarly);
  const pick = whole.length >= MIN_COMPARE_YEARS ? whole : years;
  return pick.slice(0, MAX_COMPARE_YEARS).sort((a, b) => a - b);
}

// ── Same period of each year ─────────────────────────────────────────────

/** Fiscal year `fy` from 1 ต.ค. to the day and month of `endDate`, month by
 * month: the same stretch of the year as a year still in progress. 29 ก.พ.
 * becomes 28 ก.พ. in a year without one. */
export function samePeriod(fy: number, endDate: string): DbPeriod {
  const start = rangeForFiscalYear(fy).from;
  const month = Number(endDate.slice(5, 7));
  const day = Number(endDate.slice(8, 10));
  const year = start.getUTCFullYear() + (month >= 10 ? 0 : 1);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = new Date(Date.UTC(year, month - 1, Math.min(day, lastDay)));
  return { from: formatDate(start), to: formatDate(end), grain: "month" };
}

/** The period of `fy` the comparison reads: the whole year, or the same
 * stretch as the year in progress (`sameEnd` = its last day with data). */
export function comparePeriod(fy: number, sameEnd: string | null): DbPeriod {
  return sameEnd ? samePeriod(fy, sameEnd) : fiscalYearPeriod(fy, "month");
}

// ── Figures per year ─────────────────────────────────────────────────────

export interface Amount {
  quantity: number;
  /** บาท: quantity × the set's price, as on the dashboard. */
  value: number;
}

export interface YearFigures {
  fy: number;
  total: Amount;
  /** Quantity per fiscal month, ต.ค. first; null = not reached yet. */
  monthly: (number | null)[];
  departments: Map<string, Amount>;
  items: Map<string, Amount>;
  /** department → item → amount */
  departmentItems: Map<string, Map<string, Amount>>;
}

function add(map: Map<string, Amount>, key: string, quantity: number, value: number) {
  const a = map.get(key);
  if (a) {
    a.quantity += quantity;
    a.value += value;
  } else {
    map.set(key, { quantity, value });
  }
}

/** Totals of one year's report (month by month, as comparePeriod asks).
 * Items are matched across years by name, so two sets with one name count
 * as one row. */
export function yearFigures(fy: number, data: DashboardData): YearFigures {
  const monthly: (number | null)[] = FISCAL_MONTHS.map(() => null);
  for (const p of data.monthly ?? []) monthly[fiscalMonthIndex(p.month)] = p.quantity;

  const items = new Map<string, Amount>();
  const departments = new Map<string, Amount>();
  const departmentItems = new Map<string, Map<string, Amount>>();
  for (const item of data.items) {
    const price = item.pricePerUnit;
    add(items, item.name, item.quantity, item.quantity * price);
    for (const [dept, months] of Object.entries(item.departmentMonthlyQuantity ?? {})) {
      const quantity = Object.values(months).reduce((s, n) => s + n, 0);
      if (!quantity) continue;
      add(departments, dept, quantity, quantity * price);
      let byItem = departmentItems.get(dept);
      if (!byItem) departmentItems.set(dept, (byItem = new Map()));
      add(byItem, item.name, quantity, quantity * price);
    }
  }
  return {
    fy,
    total: { quantity: data.summary.totalItems, value: data.summary.totalPrice },
    monthly,
    departments,
    items,
    departmentItems,
  };
}

/** Average per month over the days a year's figures cover. */
export function perMonth(total: number, from: string, to: string): number {
  const days = daysInclusive(from, to);
  return days > 0 ? (total / days) * MONTH_DAYS : 0;
}

/** Busiest month: its place in the fiscal year and its quantity. */
export function peakMonth(monthly: (number | null)[]): { index: number; quantity: number } | null {
  let best: { index: number; quantity: number } | null = null;
  monthly.forEach((q, index) => {
    if (q != null && (best == null || q > best.quantity)) best = { index, quantity: q };
  });
  return best;
}

// ── Change and rows ──────────────────────────────────────────────────────

export type Change = { kind: "pct"; pct: number } | { kind: "new" } | { kind: "none" };

/** Change from `previous` to `current`: a percentage, "new" (nothing
 * before) or nothing at all. */
export function change(current: number, previous: number): Change {
  if (!previous) return current ? { kind: "new" } : { kind: "none" };
  return { kind: "pct", pct: ((current - previous) / previous) * 100 };
}

export type Metric = keyof Amount;

export interface CompareRow {
  name: string;
  /** One per year, oldest first. */
  values: number[];
}

/** One row per name found in any year, biggest over all years first. */
export function compareRows(perYear: Map<string, Amount>[], metric: Metric): CompareRow[] {
  const names = new Set<string>();
  perYear.forEach((m) => m.forEach((_, name) => names.add(name)));
  const sum = (values: number[]) => values.reduce((s, n) => s + n, 0);
  return Array.from(names)
    .map((name) => ({ name, values: perYear.map((m) => m.get(name)?.[metric] ?? 0) }))
    .sort((a, b) => sum(b.values) - sum(a.values) || a.name.localeCompare(b.name, "th"));
}
