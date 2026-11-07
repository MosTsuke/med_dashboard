"use client";

import { useEffect, useRef, useState } from "react";
import { Database, Loader2, AlertCircle } from "lucide-react";
import { fetchSupplyReport, fetchSupplySource, fetchSupplyYears } from "@/lib/db/clientApi";
import type { SupplySource } from "@/lib/supply/source";
import type { DashboardData } from "@/types";

interface Props {
  onDataLoaded: (data: DashboardData) => void;
  onLoadingChange?: (loading: boolean) => void;
  /** "card" = the main box on the empty screen; "compact" = header control. */
  variant?: "card" | "compact";
  /** Fiscal year currently shown (compact variant), so the select matches it. */
  currentFiscalYear?: number;
  /** Told once where สถิติจ่าย comes from, so the page can lay itself out. */
  onSourceChange?: (source: SupplySource) => void;
}

/**
 * "ดึงจากฐานข้อมูล" — loads the สถิติจ่าย report for a fiscal year straight
 * from the CSSD database. Renders nothing at all when the server has no DB
 * configured, so Excel-only installs look exactly as before.
 */
export default function DbReportLoader({
  onDataLoaded,
  onLoadingChange,
  variant = "card",
  currentFiscalYear,
  onSourceChange,
}: Props) {
  const [source, setSource] = useState<SupplySource | null>(null);
  const [years, setYears] = useState<number[] | null>(null);
  const [yearsError, setYearsError] = useState<string | null>(null);
  const [fy, setFy] = useState<number | null>(currentFiscalYear ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSourceChangeRef = useRef(onSourceChange);
  onSourceChangeRef.current = onSourceChange;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Step 1 answers at once (no DB call), so the page knows its layout
      // even when the database itself is slow to answer or unreachable.
      let src: SupplySource;
      try {
        src = await fetchSupplySource();
      } catch {
        src = "none"; // can't tell — fall back to the plain Excel screen
      }
      if (cancelled) return;
      setSource(src);
      onSourceChangeRef.current?.(src);
      if (src === "none") return;

      try {
        const r = await fetchSupplyYears();
        if (cancelled) return;
        setYears(r.years);
        setFy((cur) => cur ?? r.years[0] ?? null);
      } catch (e) {
        if (!cancelled) setYearsError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (currentFiscalYear) setFy(currentFiscalYear);
  }, [currentFiscalYear]);

  const load = async (year: number) => {
    setLoading(true);
    onLoadingChange?.(true);
    setError(null);
    try {
      onDataLoaded(await fetchSupplyReport(year));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  };

  const isDemo = source === "demo";

  if (variant === "compact") {
    if (!years?.length) return null;
    return (
      <label className="flex items-center gap-1.5 text-xs text-gray-500 px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white" title={error ?? "เปลี่ยนปีงบประมาณ (ดึงจากฐานข้อมูล)"}>
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Database size={13} className={error ? "text-red-500" : ""} />}
        <span className="hidden md:inline">ปีงบ</span>
        <select
          value={fy ?? ""}
          disabled={loading}
          onChange={(e) => {
            const next = Number(e.target.value);
            setFy(next);
            load(next);
          }}
          className="bg-transparent text-gray-700 font-medium focus:outline-none"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </label>
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
          {isDemo ? "ตัวอย่างสถิติจ่าย (ข้อมูลจำลอง)" : "สถิติจ่ายจากฐานข้อมูล CSSD"}
        </h2>
        <p className="text-sm text-gray-500 mt-1">เลือกปีงบประมาณ แล้วกดดึงข้อมูล</p>
      </div>

      {isDemo && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          เว็บนี้ไม่ได้ต่อฐานข้อมูลของโรงพยาบาล ชื่อรายการ หน่วยงาน และตัวเลขทั้งหมดเป็นข้อมูลสมมติสำหรับสาธิต
        </p>
      )}

      {yearsError ? (
        <p className="flex items-start gap-1.5 text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {yearsError}
        </p>
      ) : years === null ? (
        <p className="flex items-center justify-center gap-2 text-sm text-gray-500 py-2.5">
          <Loader2 size={16} className="animate-spin" />
          กำลังเชื่อมต่อฐานข้อมูล...
        </p>
      ) : years.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-2.5">ยังไม่พบข้อมูลการจ่ายในฐานข้อมูล</p>
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
            onClick={() => fy && load(fy)}
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
