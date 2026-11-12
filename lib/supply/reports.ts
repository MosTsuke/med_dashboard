import type { DbReportKind } from "@/types";

/**
 * Wording for each report read from the CSSD database. Shared by the server
 * (report names) and the browser (switcher, record-list columns), so it
 * holds text only — no database code.
 */
export interface DbReportInfo {
  /** Switcher label and report title, e.g. "สถิติจ่าย". */
  label: string;
  /** Record-list tab, e.g. "รายการจ่าย". */
  recordsLabel: string;
  dateLabel: string;
  departmentLabel: string;
  /** Header of the extra column; absent = no extra column. */
  noteLabel?: string;
  /** Shown when the database has no rows for this report at all. */
  emptyText: string;
  /** Footnote under the record list. */
  recordsNote: string;
}

export const DB_REPORTS: Record<DbReportKind, DbReportInfo> = {
  supply: {
    label: "สถิติจ่าย",
    recordsLabel: "รายการจ่าย",
    dateLabel: "วันที่จ่าย",
    departmentLabel: "หน่วยงานที่จ่ายให้",
    emptyText: "ยังไม่พบข้อมูลการจ่ายในฐานข้อมูล",
    recordsNote:
      "วันหมดอายุมาจากแพ็คที่จ่าย ของสิ้นเปลือง (สำลี ผ้าก๊อซ ฯลฯ) ไม่มีบาร์โค้ดและวันหมดอายุ จึงแสดงเป็น —",
  },
  pack: {
    label: "สถิติแพ็ค",
    recordsLabel: "รายการแพ็ค",
    dateLabel: "วันที่แพ็ค",
    departmentLabel: "หน่วยงานเจ้าของเซต",
    noteLabel: "วิธีฆ่าเชื้อ",
    emptyText: "ยังไม่พบข้อมูลการแพ็คในฐานข้อมูล",
    recordsNote: "นับเฉพาะห่อที่ยังใช้งานอยู่ ห่อที่ถูกยกเลิกในโปรแกรม CSSD ไม่นับ · เจ้าหน้าที่คือผู้แพ็ค",
  },
  resterile: {
    label: "Resterile",
    recordsLabel: "รายการ Resterile",
    dateLabel: "วันที่ส่งทำใหม่",
    departmentLabel: "หน่วยงานที่ส่งคืน",
    noteLabel: "สาเหตุ",
    emptyText: "ยังไม่พบข้อมูล Resterile ในฐานข้อมูล",
    recordsNote: "ห่อที่ส่งกลับมาฆ่าเชื้อใหม่ วันหมดอายุคือของห่อเดิม",
  },
};

export const DB_REPORT_KINDS = Object.keys(DB_REPORTS) as DbReportKind[];

export function isDbReportKind(value: unknown): value is DbReportKind {
  return typeof value === "string" && value in DB_REPORTS;
}

/** "สถิติจ่าย ปีงบประมาณ 2568", "สถิติ Resterile 1 ต.ค. 2568 – 7 พ.ย. 2568". */
export function reportTitle(kind: DbReportKind, periodText: string): string {
  const label = kind === "resterile" ? "สถิติ Resterile" : DB_REPORTS[kind].label;
  return `${label} ${periodText}`;
}
