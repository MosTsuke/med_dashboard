import type { DashboardData } from "@/types";

const THAI_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/**
 * Label for a time bucket key (พ.ศ.):
 *   "2567-10"    -> "ต.ค. 2567"      (month — Excel and DB reports)
 *   "2567-10-03" -> "3 ต.ค. 2567"    (day — DB reports)
 *   "FY2568"     -> "ปีงบ 2568"      (fiscal year — DB reports)
 * Anything else is returned unchanged.
 */
export function formatMonthLabel(key: string): string {
  const day = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (day) return `${Number(day[3])} ${THAI_MONTHS[Number(day[2]) - 1] ?? day[2]} ${day[1]}`;
  const fy = key.match(/^FY(\d{4})$/);
  if (fy) return `ปีงบ ${fy[1]}`;
  const m = key.match(/^(\d{4})-(\d{2})$/);
  if (!m) return key;
  const [, year, mm] = m;
  const idx = parseInt(mm, 10) - 1;
  const name = THAI_MONTHS[idx] ?? mm;
  return `${name} ${year}`;
}

/** Shorter axis label: days drop the year ("3 ต.ค."), the rest as above. */
export function formatBucketTick(key: string): string {
  const day = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (day) return `${Number(day[3])} ${THAI_MONTHS[Number(day[2]) - 1] ?? day[2]}`;
  return formatMonthLabel(key);
}

/** CE "2026-11-07" -> "7 พ.ย. 2569". */
export function formatThaiIsoDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${Number(m[3])} ${THAI_MONTHS[Number(m[2]) - 1] ?? m[2]} ${Number(m[1]) + 543}`;
}

/**
 * A `period.from` / `period.to` value is either already "DD/MM/YY" (template
 * / Resterile formats) or a bucket key: "2567-10" -> "10/2567",
 * "2567-10-03" -> "03/10/2567", "FY2568" -> "ปีงบ 2568". Anything else is
 * returned unchanged.
 */
export function formatPeriodValue(value: string): string {
  const day = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (day) return `${day[3]}/${day[2]}/${day[1]}`;
  const fy = value.match(/^FY(\d{4})$/);
  if (fy) return `ปีงบ ${fy[1]}`;
  const m = value.match(/^(\d{4})-(\d{2})$/);
  if (!m) return value;
  const [, year, mm] = m;
  return `${mm}/${year}`;
}

/** The time grain of a report's buckets: DB reports say so; Excel monthly
 * reports are always per month. */
export function grainOf(data: DashboardData): "day" | "month" | "year" {
  return data.source?.period.grain ?? "month";
}

/** "วัน" / "เดือน" / "ปีงบ" — the unit one bucket stands for. */
export const GRAIN_UNIT = { day: "วัน", month: "เดือน", year: "ปีงบ" } as const;
/** "รายวัน" / "รายเดือน" / "รายปี" */
export const GRAIN_LABEL = { day: "รายวัน", month: "รายเดือน", year: "รายปี" } as const;

export const ALL_MONTHS = "all" as const;
export type MonthFilter = string | typeof ALL_MONTHS;

/**
 * Returns a view of `data` scoped to a single fiscal month (monthly-matrix
 * reports only). Items with zero quantity that month are dropped and the
 * summary/rank are recomputed so the "รายละเอียด" table and dashboard charts
 * reflect that month instead of the yearly total. Anything other than
 * reportType "monthly", or month === "all", returns `data` unchanged.
 */
export function sliceByMonth(data: DashboardData, month: MonthFilter): DashboardData {
  if (month === ALL_MONTHS || data.reportType !== "monthly") return data;

  const items = data.items
    .map((item) => {
      const quantity = item.monthlyQuantity?.[month] ?? 0;
      return {
        ...item,
        quantity,
        totalPrice: quantity * item.pricePerUnit,
      };
    })
    .filter((item) => item.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity)
    .map((item, i) => ({ ...item, rank: i + 1 }));

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + i.totalPrice, 0);
  const pricePerUnit = items.reduce((s, i) => s + i.pricePerUnit, 0);

  // DB-backed reports also carry a department breakdown — rescope it to
  // this month too so the department charts agree with the item charts.
  const departments =
    data.departments.length > 0 && items.some((i) => i.departmentMonthlyQuantity)
      ? departmentsFromItems(items, (perMonth) => perMonth[month] ?? 0, totalItems)
      : data.departments;

  return {
    ...data,
    items,
    departments,
    summary: {
      ...data.summary,
      totalItems,
      totalPrice,
      pricePerUnit,
      totalSets: items.length,
      totalDepartments: departments.length || data.summary.totalDepartments,
    },
  };
}

/** Department totals from items' per-department monthly quantities. */
function departmentsFromItems(
  items: DashboardData["items"],
  pick: (perMonth: Record<string, number>) => number,
  total: number
): DashboardData["departments"] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const [dept, perMonth] of Object.entries(item.departmentMonthlyQuantity ?? {})) {
      const n = pick(perMonth);
      if (n) counts.set(dept, (counts.get(dept) ?? 0) + n);
    }
  }
  return Array.from(counts, ([name, count]) => ({
    name,
    count,
    percentage: total ? (count / total) * 100 : 0,
  })).sort((a, b) => b.count - a.count);
}

export const ALL_DEPARTMENTS = "all" as const;
export type DepartmentFilter = string | typeof ALL_DEPARTMENTS;

/**
 * Returns a view of `data` scoped to a single department — Resterile-list
 * reports (each item carries a `department`) or DB-backed monthly reports
 * (each item carries `departmentMonthlyQuantity`). Drops the
 * department breakdown and re-ranks the filtered items, so the dashboard
 * falls back to the item-based charts (bar/pie/top 5) for that one
 * department instead of the department-level overview. Anything without a
 * department breakdown, or `department === "all"`, returns `data` unchanged.
 */
export function sliceByDepartment(data: DashboardData, department: DepartmentFilter): DashboardData {
  if (department === ALL_DEPARTMENTS || data.departments.length === 0) return data;

  if (data.items.some((i) => i.departmentMonthlyQuantity)) {
    return sliceMonthlyByDepartment(data, department);
  }

  const items = data.items
    .filter((item) => item.department === department)
    .sort((a, b) => b.quantity - a.quantity)
    .map((item, i) => ({ ...item, rank: i + 1 }));

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + i.totalPrice, 0);
  const pricePerUnit = items.reduce((s, i) => s + i.pricePerUnit, 0);

  return {
    ...data,
    departments: [],
    items,
    summary: {
      ...data.summary,
      totalItems,
      totalPrice,
      pricePerUnit,
      totalDepartments: 1,
      totalSets: items.length,
    },
  };
}

/**
 * Department slice for DB-backed monthly reports: every item's monthly
 * breakdown is swapped for that one department's, so the month filter, the
 * trend chart and the per-item "รายละเอียดย่อย" all follow the department.
 * Apply this BEFORE `sliceByMonth`.
 */
function sliceMonthlyByDepartment(data: DashboardData, department: string): DashboardData {
  const monthKeys = (data.monthly ?? []).map((m) => m.month);

  const items = data.items
    .map((item) => {
      const monthlyQuantity = item.departmentMonthlyQuantity?.[department] ?? {};
      const quantity = Object.values(monthlyQuantity).reduce((s, n) => s + n, 0);
      return {
        ...item,
        monthlyQuantity,
        departmentMonthlyQuantity: undefined,
        quantity,
        totalPrice: quantity * item.pricePerUnit,
      };
    })
    .filter((item) => item.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity)
    .map((item, i) => ({ ...item, rank: i + 1 }));

  const monthly = monthKeys.map((month) => ({
    month,
    quantity: items.reduce((s, i) => s + (i.monthlyQuantity[month] ?? 0), 0),
  }));

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + i.totalPrice, 0);
  const pricePerUnit = items.reduce((s, i) => s + i.pricePerUnit, 0);

  return {
    ...data,
    departments: [],
    items,
    monthly,
    summary: {
      ...data.summary,
      totalItems,
      totalPrice,
      pricePerUnit,
      totalDepartments: 1,
      totalSets: items.length,
    },
  };
}
