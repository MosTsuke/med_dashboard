"use client";

import { useEffect, useRef, useState } from "react";
import { Database, Loader2, AlertCircle } from "lucide-react";
import { fetchReport, fetchReportYears, fetchSupplySource } from "@/lib/db/clientApi";
import { DB_REPORTS, DB_REPORT_KINDS } from "@/lib/supply/reports";
import type { SupplySource } from "@/lib/supply/source";
import type { DashboardData, DbReportKind } from "@/types";

interface Props {
  onDataLoaded: (data: DashboardData) => void;
  onLoadingChange?: (loading: boolean) => void;
  /** "card" = the main box on the empty screen; "compact" = header control. */
  variant?: "card" | "compact";
  /** Report and fiscal year currently shown (compact variant), so the
   * selects match them. */
  currentReport?: DbReportKind;
  currentFiscalYear?: number;
  /** Told once where the reports come from, so the page can lay itself out. */
  onSourceChange?: (source: SupplySource) => void;
}

type YearsState = { years?: number[]; error?: string };

/**
 * "ดึงจากฐานข้อมูล" — loads a report (สถิติจ่าย, สถิติแพ็ค or Resterile)
 * for a fiscal year straight from the CSSD database. Renders nothing at all
 * when the server has no DB configured.
 */
export default function DbReportLoader({
  onDataLoaded,
  onLoadingChange,
  variant = "card",
  currentReport,
  currentFiscalYear,
  onSourceChange,
}: Props) {
  const [source, setSource] = useState<SupplySource | null>(null);
  const [kind, setKind] = useState<DbReportKind>(currentReport ?? "supply");
  // Fiscal years differ per report, so they're fetched (once) per report.
  const [yearsByKind, setYearsByKind] = useState<Partial<Record<DbReportKind, YearsState>>>({});
  const [fy, setFy] = useState<number | null>(currentFiscalYear ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSourceChangeRef = useRef(onSourceChange);
  onSourceChangeRef.current = onSourceChange;
  // One request per report, shared by everyone who asks while it's in flight.
  const yearsRequests = useRef(new Map<DbReportKind, Promise<number[] | undefined>>());

  // Step 1 answers at once (no DB call), so the page knows its layout even
  // when the database itself is slow to answer or unreachable.
  useEffect(() => {
    let cancelled = false;
    fetchSupplySource()
      .catch(() => "none" as const) // can't tell — treat as no database
      .then((src) => {
        if (cancelled) return;
        setSource(src);
        onSourceChangeRef.current?.(src);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadYears = (k: DbReportKind): Promise<number[] | undefined> => {
    const pending = yearsRequests.current.get(k);
    if (pending) return pending;
    const request = fetchReportYears(k)
      .then((r) => {
        setYearsByKind((s) => ({ ...s, [k]: { years: r.years } }));
        return r.years;
      })
      .catch((e) => {
        yearsRequests.current.delete(k); // allow a retry
        setYearsByKind((s) => ({ ...s, [k]: { error: e instanceof Error ? e.message : String(e) } }));
        return undefined;
      });
    yearsRequests.current.set(k, request);
    return request;
  };

  useEffect(() => {
    if (source !== "db" && source !== "demo") return;
    loadYears(kind).then((years) => {
      if (years) setFy((cur) => (cur != null && years.includes(cur) ? cur : years[0] ?? null));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, kind]);

  useEffect(() => {
    if (currentFiscalYear) setFy(currentFiscalYear);
  }, [currentFiscalYear]);
  useEffect(() => {
    if (currentReport) setKind(currentReport);
  }, [currentReport]);

  const load = async (k: DbReportKind, year: number) => {
    setLoading(true);
    onLoadingChange?.(true);
    setError(null);
    try {
      onDataLoaded(await fetchReport(k, year));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  };

  const isDemo = source === "demo";
  const { years, error: yearsError } = yearsByKind[kind] ?? {};

  if (variant === "compact") {
    if (source !== "db" && source !== "demo") return null;
    const switchReport = async (next: DbReportKind) => {
      setKind(next);
      const nextYears = await loadYears(next);
      if (!nextYears?.length) return;
      const year = fy != null && nextYears.includes(fy) ? fy : nextYears[0];
      setFy(year);
      load(next, year);
    };
    return (
      <div
        className="flex items-center gap-1.5 text-xs text-gray-500 px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white"
        title={error ?? yearsError ?? "เปลี่ยนรายงาน / ปีงบประมาณ (ดึงจากฐานข้อมูล)"}
      >
        {loading ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Database size={13} className={error || yearsError ? "text-red-500" : ""} />
        )}
        <select
          aria-label="รายงาน"
          value={kind}
          disabled={loading}
          onChange={(e) => switchReport(e.target.value as DbReportKind)}
          className="bg-transparent text-gray-700 font-medium focus:outline-none"
        >
          {DB_REPORT_KINDS.map((k) => (
            <option key={k} value={k}>{DB_REPORTS[k].label}</option>
          ))}
        </select>
        {years && years.length > 0 && (
          <>
            <span className="text-gray-300">|</span>
            <span className="hidden md:inline">ปีงบ</span>
            <select
              aria-label="ปีงบประมาณ"
              value={fy ?? ""}
              disabled={loading}
              onChange={(e) => {
                const next = Number(e.target.value);
                setFy(next);
                load(kind, next);
              }}
              className="bg-transparent text-gray-700 font-medium focus:outline-none"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </>
        )}
      </div>
    );
  }

  // Card variant: nothing when no DB is configured. Otherwise it's the main
  // thing on the empty screen — including while connecting, and with the
  // error when the DB is configured but unreachable, so IT can see why.
  if (source === null || source === "none") return null;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 shadow-sm">
      <div className="text-center mb-6">
        <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Database size={26} className="text-blue-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-800">
          {isDemo ? "ตัวอย่างสถิติ (ข้อมูลจำลอง)" : "สถิติจากฐานข้อมูล CSSD"}
        </h2>
        <p className="text-sm text-gray-500 mt-1">เลือกรายงานและปีงบประมาณ แล้วกดดึงข้อมูล</p>
      </div>

      {isDemo && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          เว็บนี้ไม่ได้ต่อฐานข้อมูลของโรงพยาบาล ชื่อรายการ หน่วยงาน และตัวเลขทั้งหมดเป็นข้อมูลสมมติสำหรับสาธิต
        </p>
      )}

      <div role="radiogroup" aria-label="รายงาน" className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-xl mb-3">
        {DB_REPORT_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            disabled={loading}
            onClick={() => {
              setKind(k);
              setError(null);
            }}
            className={`text-sm font-medium py-2 rounded-lg transition-colors ${
              kind === k ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {DB_REPORTS[k].label}
          </button>
        ))}
      </div>

      {yearsError ? (
        <p className="flex items-start gap-1.5 text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {yearsError}
        </p>
      ) : years === undefined ? (
        <p className="flex items-center justify-center gap-2 text-sm text-gray-500 py-2.5">
          <Loader2 size={16} className="animate-spin" />
          กำลังเชื่อมต่อฐานข้อมูล...
        </p>
      ) : years.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-2.5">{DB_REPORTS[kind].emptyText}</p>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={fy ?? ""}
            onChange={(e) => setFy(Number(e.target.value))}
            disabled={loading}
            aria-label="ปีงบประมาณ"
            className="flex-1 text-base border border-gray-200 rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
          >
            {years.map((y) => (
              <option key={y} value={y}>ปีงบประมาณ {y}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => fy && load(kind, fy)}
            disabled={loading || !fy}
            className="flex items-center justify-center gap-2 text-base font-medium px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Database size={18} />}
            ดึงข้อมูล
          </button>
        </div>
      )}

      {error && (
        <p className="flex items-start gap-1.5 text-sm text-red-500 mt-3">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </p>
      )}
    </div>
  );
}
