import { compareRows, type Amount, type CompareRow, type Metric } from "@/lib/yearCompare";
import type { DashboardData, DbPeriod, DbReportKind } from "@/types";

/**
 * "รวมทุกสถิติ": the four database reports (สถิติจ่าย, สถิติแพ็ค, สถิติล้าง,
 * Resterile) for one period, side by side. Pure helpers — the reports
 * themselves are fetched and built exactly as on their own pages.
 */

/** One colour per report, kept whichever reports are switched on (the first
 * four slots of the validated categorical palette, in report order). */
export const REPORT_COLORS: Record<DbReportKind, string> = {
  supply: "#2a78d6",
  pack: "#eb6834",
  wash: "#1baf7a",
  resterile: "#eda100",
};

/** Short name for chart line ends and narrow table headers. */
export const REPORT_SHORT: Record<DbReportKind, string> = {
  supply: "จ่าย",
  pack: "แพ็ค",
  wash: "ล้าง",
  resterile: "Resterile",
};

export const reportKey = (kind: DbReportKind, p: DbPeriod) => `${kind}:${p.from}:${p.to}:${p.grain}`;

export interface ReportFigures {
  total: Amount;
  /** Time bucket ("2569-11", "2569-11-07", "FY2569") → quantity. */
  buckets: Map<string, number>;
  departments: Map<string, Amount>;
  items: Map<string, Amount>;
  /** "ชิ้น", "เซต", or "" for a plain count. */
  unit: string;
}

function add(map: Map<string, Amount>, name: string, quantity: number, value: number) {
  const a = map.get(name);
  if (a) {
    a.quantity += quantity;
    a.value += value;
  } else {
    map.set(name, { quantity, value });
  }
}

/** Totals, buckets, departments and items of one report (or of one
 * department's slice of it). Items are matched across reports by name. */
export function reportFigures(data: DashboardData): ReportFigures {
  const buckets = new Map<string, number>();
  for (const p of data.monthly ?? []) buckets.set(p.month, p.quantity);
  const items = new Map<string, Amount>();
  const departments = new Map<string, Amount>();
  for (const item of data.items) {
    const price = item.pricePerUnit;
    add(items, item.name, item.quantity, item.quantity * price);
    for (const [dept, months] of Object.entries(item.departmentMonthlyQuantity ?? {})) {
      let quantity = 0;
      for (const n of Object.values(months)) quantity += n;
      if (quantity) add(departments, dept, quantity, quantity * price);
    }
  }
  return {
    total: { quantity: data.summary.totalItems, value: data.summary.totalPrice },
    buckets,
    departments,
    items,
    unit: data.valueKind?.quantityUnit ?? "ชิ้น",
  };
}

/** Every bucket any of the reports has, in time order (bucket keys of one
 * grain sort as text). */
export function unionBuckets(list: ReportFigures[]): string[] {
  const keys = new Set<string>();
  list.forEach((f) => f.buckets.forEach((_, k) => keys.add(k)));
  return Array.from(keys).sort();
}

/** Department or item rows, one value per report, biggest first by the
 * column `sortBy` (an index into `list`). */
export function breakdownRows(
  list: Map<string, Amount>[],
  metric: Metric,
  sortBy: number
): CompareRow[] {
  const rows = compareRows(list, metric);
  return sortBy >= 0 && sortBy < list.length
    ? rows.sort((a, b) => b.values[sortBy] - a.values[sortBy] || a.name.localeCompare(b.name, "th"))
    : rows;
}

/** The reports among `maxes` whose biggest bucket is under 1/20 of the
 * biggest overall — they would lie flat along the bottom of a shared chart. */
export function dwarfedSeries<K extends string>(maxes: { kind: K; max: number }[]): K[] {
  if (maxes.length < 2) return [];
  const top = Math.max(...maxes.map((m) => m.max));
  return top > 0 ? maxes.filter((m) => m.max < top / 20).map((m) => m.kind) : [];
}
