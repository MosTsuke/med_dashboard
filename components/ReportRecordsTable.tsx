"use client";

import { useEffect, useState } from "react";
import { Search, Loader2, AlertCircle, Info } from "lucide-react";
import { REPORT_BANNER_BG } from "@/components/ReportNote";
import TablePagination, { type PageSize } from "@/components/TablePagination";
import { fetchReportRecords } from "@/lib/db/clientApi";
import { DB_REPORTS } from "@/lib/supply/reports";
import type { DbReportKind, ReportRecordsPage } from "@/types";

interface Props {
  report: DbReportKind;
  /** Date range shown, CE "YYYY-MM-DD", both inclusive. */
  from: string;
  to: string;
  /** What the range is, in words ("ปีงบประมาณ 2568", "พ.ย. 2568", …). */
  scope: string;
  /** Department name, or undefined for all departments. */
  department?: string;
}

const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** "2024-10-03 09:15" → "3 ต.ค. 2567 09:15" (time optional). */
function formatThaiDate(value: string): string {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}:\d{2}))?$/);
  if (!m) return value;
  const [, y, mm, dd, time] = m;
  const date = `${Number(dd)} ${THAI_MONTHS_SHORT[Number(mm) - 1]} ${Number(y) + 543}`;
  return time ? `${date} ${time}` : date;
}

const th = "text-left px-4 py-3 text-xs font-semibold text-white uppercase tracking-wide";

/**
 * The record list of a database report — รายการจ่าย, รายการแพ็ค or
 * รายการ Resterile — one row per dispense / pack / pack sent back.
 * Paginated server-side (a fiscal year is >100k rows), following the
 * dashboard's month/department filters.
 */
export default function ReportRecordsTable({ report, from, to, scope: scopeLabel, department }: Props) {
  const info = DB_REPORTS[report];
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [perPage, setPerPage] = useState<PageSize>(50);
  const [result, setResult] = useState<ReportRecordsPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Any filter change goes back to page 1 — derived in the same render, so
  // a filter change never fires a request for the old page number first.
  const filterKey = JSON.stringify([report, from, to, department, debouncedQuery, perPage]);
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (p: number) => setPageState({ key: filterKey, page: p });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchReportRecords(report, {
      from,
      to,
      department,
      q: debouncedQuery || undefined,
      page,
      pageSize: perPage,
    })
      .then((r) => !cancelled && setResult(r))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [report, from, to, department, debouncedQuery, page, perPage]);

  const scope = [scopeLabel, department].filter(Boolean).join(" · ");
  const columns = info.noteLabel ? 7 : 6;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
      <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
            {info.recordsLabel}
            {result && <span className="normal-case font-normal">({result.total.toLocaleString()} รายการ)</span>}
            {loading && <Loader2 size={14} className="animate-spin text-blue-500" />}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">{scope}</p>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อรายการ / บาร์โค้ด..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 w-60"
          />
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-red-500 bg-red-50 border-b border-red-100 px-5 py-2.5">
          <AlertCircle size={15} className="shrink-0" />
          {error}
        </p>
      )}

      <div className={`overflow-x-auto transition-opacity ${loading ? "opacity-60" : ""}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={`${REPORT_BANNER_BG} border-b border-blue-900/20`}>
              <th className={`${th} w-44`}>{info.dateLabel}</th>
              <th className={th}>ชื่อรายการ</th>
              <th className={`${th} w-20 text-right`}>จำนวน</th>
              <th className={`${th} w-40`}>วันหมดอายุ</th>
              <th className={`${th} w-40`}>{info.departmentLabel}</th>
              {info.noteLabel && <th className={`${th} w-40`}>{info.noteLabel}</th>}
              <th className={`${th} w-36`}>เจ้าหน้าที่</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {result?.rows.map((r) => (
              <tr key={r.id} className="hover:bg-blue-50/30 transition-colors">
                <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap tabular-nums">{formatThaiDate(r.date)}</td>
                <td className="px-4 py-2.5 text-gray-700">
                  <span className="font-medium">{r.itemName}</span>
                  {r.barcode && <span className="ml-2 text-xs text-gray-400 font-mono">{r.barcode}</span>}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-blue-700 tabular-nums">
                  {r.quantity.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap tabular-nums">
                  {r.expiryDate ? (
                    // Only a dispense after expiry is a problem; resterile
                    // packs are expected to be past it. Same-format
                    // "YYYY-MM-DD" strings compare correctly as text.
                    report === "supply" && r.expiryDate < r.date.slice(0, 10) ? (
                      <span className="text-red-600" title="วันที่จ่ายเลยวันหมดอายุของแพ็คนี้แล้ว">
                        {formatThaiDate(r.expiryDate)}
                        <span className="ml-1.5 text-[11px] font-medium bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                          จ่ายหลังหมดอายุ
                        </span>
                      </span>
                    ) : (
                      formatThaiDate(r.expiryDate)
                    )
                  ) : (
                    <span className="text-gray-300" title="ไม่มีห่อ จึงไม่มีวันหมดอายุ">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <span className="inline-block bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
                    {r.department}
                  </span>
                </td>
                {info.noteLabel && <td className="px-4 py-2.5 text-gray-600">{r.note ?? "-"}</td>}
                <td className="px-4 py-2.5 text-gray-600">{r.person}</td>
              </tr>
            ))}
            {result && result.rows.length === 0 && !loading && (
              <tr>
                <td colSpan={columns} className="px-4 py-8 text-center text-gray-400">
                  ไม่พบรายการ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={page}
        perPage={perPage}
        totalItems={result?.total ?? 0}
        unitLabel="รายการ"
        onPageChange={setPage}
        onPerPageChange={setPerPage}
      />

      <p className="flex items-start gap-1.5 px-5 py-3 text-xs text-gray-400 border-t border-slate-100">
        <Info size={13} className="shrink-0 mt-px" />
        {info.recordsNote}
      </p>
    </div>
  );
}
