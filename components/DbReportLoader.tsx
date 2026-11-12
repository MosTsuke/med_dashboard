"use client";

import { useEffect, useRef, useState } from "react";
import { Database, Loader2, AlertCircle, CalendarRange, ChevronDown } from "lucide-react";
import PeriodPicker, { periodError, periodShortLabel, type PeriodBounds } from "@/components/PeriodPicker";
import { fetchReport, fetchReportYears, fetchSupplySource } from "@/lib/db/clientApi";
import { DB_REPORTS, DB_REPORT_KINDS } from "@/lib/supply/reports";
import { fiscalYearPeriod } from "@/lib/supply/shape";
import type { SupplySource } from "@/lib/supply/source";
import type { DashboardData, DbPeriod, DbReportKind } from "@/types";

interface Props {
  onDataLoaded: (data: DashboardData) => void;
  onLoadingChange?: (loading: boolean) => void;
  /** "card" = the main box on the empty screen; "compact" = header control. */
  variant?: "card" | "compact";
  /** Report and period currently shown (compact variant), so the controls
   * match them. */
  currentReport?: DbReportKind;
  currentPeriod?: DbPeriod;
  /** Told once where the reports come from, so the page can lay itself out. */
  onSourceChange?: (source: SupplySource) => void;
}

type BoundsState = { bounds?: PeriodBounds; error?: string };

/**
 * "ดึงจากฐานข้อมูล" — loads a report (สถิติจ่าย, สถิติแพ็ค or Resterile)
 * for a time range, day by day, month by month or per fiscal year, straight
 * from the CSSD database. Renders nothing at all when the server has no DB
 * configured.
 */
export default function DbReportLoader({
  onDataLoaded,
  onLoadingChange,
  variant = "card",
  currentReport,
  currentPeriod,
  onSourceChange,
}: Props) {
  const [source, setSource] = useState<SupplySource | null>(null);
  const [kind, setKind] = useState<DbReportKind>(currentReport ?? "supply");
  // What each report has data for differs, so it's fetched (once) per report.
  const [boundsByKind, setBoundsByKind] = useState<Partial<Record<DbReportKind, BoundsState>>>({});
  const [period, setPeriod] = useState<DbPeriod | null>(currentPeriod ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSourceChangeRef = useRef(onSourceChange);
  onSourceChangeRef.current = onSourceChange;
  // One request per report, shared by everyone who asks while it's in flight.
  const boundsRequests = useRef(new Map<DbReportKind, Promise<PeriodBounds | undefined>>());

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

  const loadBounds = (k: DbReportKind): Promise<PeriodBounds | undefined> => {
    const pending = boundsRequests.current.get(k);
    if (pending) return pending;
    const request = fetchReportYears(k)
      .then(({ years, minDate, maxDate }) => {
        const bounds = { years, minDate, maxDate };
        setBoundsByKind((s) => ({ ...s, [k]: { bounds } }));
        return bounds;
      })
      .catch((e) => {
        boundsRequests.current.delete(k); // allow a retry
        setBoundsByKind((s) => ({ ...s, [k]: { error: e instanceof Error ? e.message : String(e) } }));
        return undefined;
      });
    boundsRequests.current.set(k, request);
    return request;
  };

  useEffect(() => {
    if (source !== "db" && source !== "demo") return;
    loadBounds(kind).then((bounds) => {
      // Start on the latest fiscal year, month by month — as before.
      if (bounds?.years.length) setPeriod((cur) => cur ?? fiscalYearPeriod(bounds.years[0]));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, kind]);

  useEffect(() => {
    if (currentPeriod) setPeriod(currentPeriod);
  }, [currentPeriod]);
  useEffect(() => {
    if (currentReport) setKind(currentReport);
  }, [currentReport]);

  const load = async (k: DbReportKind, p: DbPeriod): Promise<boolean> => {
    const invalid = periodError(p);
    if (invalid) {
      setError(invalid);
      return false;
    }
    setLoading(true);
    onLoadingChange?.(true);
    setError(null);
    try {
      onDataLoaded(await fetchReport(k, p));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  };

  const isDemo = source === "demo";
  const { bounds, error: boundsError } = boundsByKind[kind] ?? {};

  if (variant === "compact") {
    if (source !== "db" && source !== "demo") return null;
    return (
      <CompactControls
        kind={kind}
        period={period}
        bounds={bounds}
        loading={loading}
        error={error ?? boundsError ?? null}
        onReportChange={(next) => {
          setKind(next);
          loadBounds(next);
          if (period) load(next, period);
        }}
        onLoad={async (p) => {
          setPeriod(p);
          return load(kind, p);
        }}
      />
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
        <p className="text-sm text-gray-500 mt-1">เลือกรายงานและช่วงเวลา แล้วกดดึงข้อมูล</p>
      </div>

      {isDemo && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          เว็บนี้ไม่ได้ต่อฐานข้อมูลของโรงพยาบาล ชื่อรายการ หน่วยงาน และตัวเลขทั้งหมดเป็นข้อมูลสมมติสำหรับสาธิต
        </p>
      )}

      <p className="text-xs font-medium text-gray-500 mb-2">รายงาน</p>
      <div role="radiogroup" aria-label="รายงาน" className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-xl mb-4">
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

      {boundsError ? (
        <p className="flex items-start gap-1.5 text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {boundsError}
        </p>
      ) : bounds === undefined || period === null ? (
        bounds?.years.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-2.5">{DB_REPORTS[kind].emptyText}</p>
        ) : (
          <p className="flex items-center justify-center gap-2 text-sm text-gray-500 py-2.5">
            <Loader2 size={16} className="animate-spin" />
            กำลังเชื่อมต่อฐานข้อมูล...
          </p>
        )
      ) : bounds.years.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-2.5">{DB_REPORTS[kind].emptyText}</p>
      ) : (
        <div className="space-y-3">
          <PeriodPicker bounds={bounds} value={period} onChange={setPeriod} disabled={loading} />
          <button
            type="button"
            onClick={() => load(kind, period)}
            disabled={loading || periodError(period) != null}
            className="w-full flex items-center justify-center gap-2 text-base font-medium px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
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

/** Header version: report select + a button showing the period that opens
 * the period picker in a small panel. */
function CompactControls({
  kind,
  period,
  bounds,
  loading,
  error,
  onReportChange,
  onLoad,
}: {
  kind: DbReportKind;
  period: DbPeriod | null;
  bounds?: PeriodBounds;
  loading: boolean;
  error: string | null;
  onReportChange: (kind: DbReportKind) => void;
  onLoad: (period: DbPeriod) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DbPeriod | null>(period);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={boxRef} className="relative flex items-center gap-1.5 text-xs text-gray-500 px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white">
      {loading ? (
        <Loader2 size={13} className="animate-spin" />
      ) : (
        <Database size={13} className={error ? "text-red-500" : ""} />
      )}
      <select
        aria-label="รายงาน"
        value={kind}
        disabled={loading}
        onChange={(e) => onReportChange(e.target.value as DbReportKind)}
        title={error ?? undefined}
        className="bg-transparent text-gray-700 font-medium focus:outline-none"
      >
        {DB_REPORT_KINDS.map((k) => (
          <option key={k} value={k}>{DB_REPORTS[k].label}</option>
        ))}
      </select>
      {period && (
        <>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            aria-expanded={open}
            disabled={loading}
            onClick={() => {
              setDraft(period);
              setOpen((o) => !o);
            }}
            className="flex items-center gap-1 text-gray-700 font-medium hover:text-blue-700"
          >
            <CalendarRange size={13} />
            {periodShortLabel(period)}
            <ChevronDown size={12} />
          </button>
        </>
      )}

      {open && draft && bounds && (
        <div className="absolute right-0 top-full mt-2 w-[min(34rem,calc(100vw-2rem))] bg-white border border-gray-200 rounded-xl shadow-lg p-4 z-30 space-y-3">
          <PeriodPicker bounds={bounds} value={draft} onChange={setDraft} disabled={loading} />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="button"
            disabled={loading || periodError(draft) != null}
            onClick={async () => {
              if (await onLoad(draft)) setOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 text-sm font-medium px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Database size={15} />}
            ดึงข้อมูล
          </button>
        </div>
      )}
    </div>
  );
}
