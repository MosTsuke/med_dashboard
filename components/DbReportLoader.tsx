"use client";

import { useEffect, useState } from "react";
import { Database, Loader2, AlertCircle } from "lucide-react";
import { fetchSupplyReport, fetchSupplyYears } from "@/lib/db/clientApi";
import type { DashboardData } from "@/types";

interface Props {
  onDataLoaded: (data: DashboardData) => void;
  onLoadingChange?: (loading: boolean) => void;
  /** "card" = big box on the empty screen; "compact" = header control. */
  variant?: "card" | "compact";
  /** Fiscal year currently shown (compact variant), so the select matches it. */
  currentFiscalYear?: number;
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
}: Props) {
  const [years, setYears] = useState<number[] | null>(null);
  const [yearsError, setYearsError] = useState<string | null>(null);
  const [fy, setFy] = useState<number | null>(currentFiscalYear ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSupplyYears()
      .then((r) => {
        if (cancelled) return;
        if (!r.configured) return setYears([]);
        setYears(r.years);
        setFy((cur) => cur ?? r.years[0] ?? null);
      })
      .catch((e) => {
        if (cancelled) return;
        setYearsError(e instanceof Error ? e.message : String(e));
      });
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

  // Card variant: hide entirely when no DB is configured; show the error if
  // one IS configured but unreachable, so IT can see why.
  if (years === null && !yearsError) return null;
  if (years !== null && years.length === 0 && !yearsError) return null;

  return (
    <div className="bg-white/70 border border-white rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Database size={16} className="text-blue-500" />
        ดึงสถิติจ่ายจากฐานข้อมูล CSSD
      </div>
      {yearsError ? (
        <p className="flex items-start gap-1.5 text-xs text-red-500">
          <AlertCircle size={14} className="shrink-0 mt-px" />
          {yearsError}
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <select
            value={fy ?? ""}
            onChange={(e) => setFy(Number(e.target.value))}
            disabled={loading}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
          >
            {years!.map((y) => (
              <option key={y} value={y}>ปีงบประมาณ {y}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => fy && load(fy)}
            disabled={loading || !fy}
            className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Database size={15} />}
            ดึงข้อมูล
          </button>
        </div>
      )}
      {error && (
        <p className="flex items-start gap-1.5 text-xs text-red-500">
          <AlertCircle size={14} className="shrink-0 mt-px" />
          {error}
        </p>
      )}
    </div>
  );
}
