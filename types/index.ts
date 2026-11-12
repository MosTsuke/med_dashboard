export interface DepartmentData {
  name: string;
  count: number;
  percentage?: number;
  pricePerUnit?: number;
  totalPrice?: number;
}

export interface ItemData {
  rank: number;
  name: string;
  department?: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  /** Per-month quantity breakdown (monthly-matrix reports only), e.g. { "2567-10": 12 } */
  monthlyQuantity?: Record<string, number>;
  /** Per-department, per-month quantity (DB-backed reports only), e.g.
   * { "ER": { "2567-10": 3 } }. Lets the department filter slice a monthly
   * report — Excel monthly reports have no department breakdown at all. */
  departmentMonthlyQuantity?: Record<string, Record<string, number>>;
}

export interface SummaryStats {
  totalItems: number;
  totalDepartments: number;
  totalSets: number;
  pricePerUnit: number;
  totalPrice: number;
}

export interface MonthlyPoint {
  month: string; // e.g. "2567-10"
  quantity: number;
}

/**
 * Describes what an item's `pricePerUnit` / `totalPrice` fields actually mean.
 * Most reports track money (บาท), but some source files (e.g. "สถิติล้าง")
 * have no pricing column at all — that per-unit column is instead a
 * quantity ratio like "จำนวนชิ้น/เซต" (pieces per set). When present, UI
 * should relabel accordingly instead of showing a misleading "0.00 บาท".
 */
export interface ValueKind {
  isMonetary: boolean;
  perUnitLabel: string; // e.g. "ราคา/หน่วย" or "จำนวนชิ้น/เซต"
  totalLabel: string; // e.g. "ราคารวม" or "จำนวนชิ้น"
  unit: string; // e.g. "บาท" or ""
  decimals: number; // 2 for money, 0 for counts
  /** Unit for the main "จำนวนรวมทั้งหมด" quantity stat — usually "ชิ้น", but
   * e.g. "เซต" when the monthly columns actually track sets, not pieces. */
  quantityUnit: string;
}

export interface DashboardData {
  period?: { from: string; to: string };
  reportName?: string;
  hospitalName?: string;
  fiscalYear?: string;
  logoUrl?: string;
  summary: SummaryStats;
  departments: DepartmentData[];
  items: ItemData[];
  monthly?: MonthlyPoint[];
  /** Only set for reportType "monthly" when the source has no real pricing column. */
  valueKind?: ValueKind;
  reportType: "summary" | "items" | "monthly" | "unknown";
  /** Where the data came from. Absent = an imported file. */
  /** `demo: true` = built-in made-up data (see lib/supply/demo.ts), not the hospital's. */
  source?: { kind: "db"; report: DbReportKind; period: DbPeriod; demo?: boolean };
}

/** The reports read from the CSSD database: สถิติจ่าย, สถิติแพ็ค, Resterile. */
export type DbReportKind = "supply" | "pack" | "resterile";

/** How a DB report is bucketed over time: per day, per month or per
 * fiscal year (ปีงบประมาณ). For DB reports `monthly` / `monthlyQuantity`
 * hold these buckets — keys "2569-11-07", "2569-11" or "FY2569". */
export type DbGrain = "day" | "month" | "year";

/** The time range of a DB report: CE "YYYY-MM-DD" dates, both inclusive. */
export interface DbPeriod {
  from: string;
  to: string;
  grain: DbGrain;
}

/** One record for a DB report's record list (รายการจ่าย / รายการแพ็ค / …). */
export interface ReportRecord {
  id: number;
  /** Wall-clock "YYYY-MM-DD HH:mm" as stored, or "YYYY-MM-DD" for packs
   * (a pack only has a date). */
  date: string;
  itemName: string;
  /** Pack barcode; null when there's no pack (e.g. consumables). */
  barcode: string | null;
  /** 1 for a pack; can be more for consumables. */
  quantity: number;
  /** The pack's expiry "YYYY-MM-DD"; null when there's no pack. */
  expiryDate: string | null;
  department: string;
  person: string;
  /** Report-specific extra column: sterilization method (pack) or
   * reason (resterile); null for สถิติจ่าย. */
  note: string | null;
}

export interface ReportRecordsPage {
  rows: ReportRecord[];
  total: number;
}
