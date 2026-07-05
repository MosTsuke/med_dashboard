import type { DashboardData } from "@/types";

const THAI_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/** "2567-10" -> "ต.ค. 2567" */
export function formatMonthLabel(month: string): string {
  const m = month.match(/^(\d{4})-(\d{2})$/);
  if (!m) return month;
  const [, year, mm] = m;
  const idx = parseInt(mm, 10) - 1;
  const name = THAI_MONTHS[idx] ?? mm;
  return `${name} ${year}`;
}

/**
 * A `period.from` / `period.to` value is either already "DD/MM/YY" (template
 * / Resterile formats) or a raw fiscal-month label like "2567-10" (monthly
 * matrix format). Only the latter needs reformatting, into "MM/YYYY" —
 * everything else is returned unchanged.
 */
export function formatPeriodValue(value: string): string {
  const m = value.match(/^(\d{4})-(\d{2})$/);
  if (!m) return value;
  const [, year, mm] = m;
  return `${mm}/${year}`;
}

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

  return {
    ...data,
    items,
    summary: {
      ...data.summary,
      totalItems,
      totalPrice,
      pricePerUnit,
      totalSets: items.length,
    },
  };
}

export const ALL_DEPARTMENTS = "all" as const;
export type DepartmentFilter = string | typeof ALL_DEPARTMENTS;

/**
 * Returns a view of `data` scoped to a single department (Resterile-list
 * reports only, where each item carries a `department`). Drops the
 * department breakdown and re-ranks the filtered items, so the dashboard
 * falls back to the item-based charts (bar/pie/top 5) for that one
 * department instead of the department-level overview. Anything without a
 * department breakdown, or `department === "all"`, returns `data` unchanged.
 */
export function sliceByDepartment(data: DashboardData, department: DepartmentFilter): DashboardData {
  if (department === ALL_DEPARTMENTS || data.departments.length === 0) return data;

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
