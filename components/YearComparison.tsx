"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  BarChart3,
  Building2,
  GitCompareArrows,
  Loader2,
  Search,
  TableProperties,
  TrendingUp,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ReportSectionHeader from "@/components/ReportSectionHeader";
import { fetchReport, fetchReportYears, type ReportDataRange } from "@/lib/db/clientApi";
import { formatNumber, withUnit } from "@/lib/formatNumber";
import { formatThaiIsoDate } from "@/lib/monthlyView";
import { DB_REPORTS } from "@/lib/supply/reports";
import { fiscalYearPeriod } from "@/lib/supply/shape";
import {
  FISCAL_MONTHS,
  MAX_COMPARE_YEARS,
  MIN_COMPARE_YEARS,
  change,
  comparePeriod,
  compareRows,
  dayMonthLabel,
  defaultCompareYears,
  fiscalMonthIndex,
  peakMonth,
  perMonth,
  yearCoverage,
  yearFigures,
  type Change,
  type CompareRow,
  type Metric,
  type YearCoverage,
  type YearFigures,
} from "@/lib/yearCompare";
import type { DashboardData, DbPeriod, DbReportKind } from "@/types";

interface Props {
  report: DbReportKind;
}

/** One colour per chosen year (validated for colour-blind readers). A year
 * keeps its colour while others are added or removed. */
const YEAR_COLORS = ["#2a78d6", "#eb6834", "#1baf7a"];

type Basis = "same" | "full";

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const periodKey = (kind: DbReportKind, p: DbPeriod) => `${kind}:${p.from}:${p.to}`;

/**
 * "เปรียบเทียบปีงบ": two or three fiscal years of the current report side
 * by side — totals with the change from year to year, month against month,
 * departments and items. While a year is still in progress the years are
 * compared over the same stretch (1 ต.ค. to its last day) unless asked for
 * whole years.
 */
export default function YearComparison({ report }: Props) {
  const [range, setRange] = useState<ReportDataRange | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  /** Colour slot of each chosen year. */
  const [slots, setSlots] = useState<Record<number, number>>({});
  const [basis, setBasis] = useState<Basis>("same");
  const [reports, setReports] = useState<Record<string, DashboardData>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const requests = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    setRange(null);
    setRangeError(null);
    setSelected([]);
    setSlots({});
    fetchReportYears(report)
      .then((r) => {
        if (cancelled) return;
        setRange(r);
        if (r.minDate && r.maxDate) {
          const years = defaultCompareYears(r.years, (fy) => yearCoverage(fy, r.minDate!, r.maxDate!));
          setSelected(years);
          setSlots(Object.fromEntries(years.map((fy, i) => [fy, i])));
        }
      })
      .catch((e) => !cancelled && setRangeError(errorText(e)));
    return () => {
      cancelled = true;
    };
  }, [report]);

  const coverage = useMemo(() => {
    const map = new Map<number, YearCoverage>();
    if (range?.minDate && range.maxDate) {
      for (const fy of range.years) map.set(fy, yearCoverage(fy, range.minDate, range.maxDate));
    }
    return map;
  }, [range]);

  // The newest year, while it's still going, is compared over the same
  // stretch of every year (unless whole years are asked for).
  const newest = range?.years[0];
  const inProgress = newest != null && coverage.get(newest)?.endsEarly ? newest : null;
  const canSame = inProgress != null && selected.includes(inProgress);
  const sameEnd = canSame && basis === "same" ? coverage.get(inProgress!)!.to : null;

  // Every year's whole report (for month against month) and, when comparing
  // the same stretch, that stretch of each year.
  const wanted = useMemo(() => {
    const list: DbPeriod[] = [];
    for (const fy of selected) {
      list.push(fiscalYearPeriod(fy, "month"));
      if (sameEnd) list.push(comparePeriod(fy, sameEnd));
    }
    return list;
  }, [selected, sameEnd]);

  useEffect(() => {
    for (const p of wanted) {
      const key = periodKey(report, p);
      if (reports[key] || requests.current.has(key)) continue;
      requests.current.add(key);
      setLoadError(null);
      fetchReport(report, p)
        .then((d) => setReports((s) => ({ ...s, [key]: d })))
        .catch((e) => setLoadError(errorText(e)))
        .finally(() => requests.current.delete(key));
    }
  }, [wanted, report, reports]);

  const toggleYear = (fy: number) => {
    if (selected.includes(fy)) {
      if (selected.length <= MIN_COMPARE_YEARS) return;
      setSelected((s) => s.filter((y) => y !== fy));
      setSlots((s) => {
        const next = { ...s };
        delete next[fy];
        return next;
      });
    } else {
      if (selected.length >= MAX_COMPARE_YEARS) return;
      const used = new Set(Object.values(slots));
      const slot = YEAR_COLORS.findIndex((_, i) => !used.has(i));
      setSlots((s) => ({ ...s, [fy]: slot }));
      setSelected((s) => [...s, fy].sort((a, b) => a - b));
    }
  };

  const view = useMemo(() => {
    const full = selected.map((fy) => reports[periodKey(report, fiscalYearPeriod(fy, "month"))]);
    const basisData = selected.map((fy) => reports[periodKey(report, comparePeriod(fy, sameEnd))]);
    if (selected.length === 0 || full.some((d) => !d) || basisData.some((d) => !d)) return null;
    return {
      figures: selected.map((fy, i) => yearFigures(fy, basisData[i])),
      monthly: selected.map((fy, i) => yearFigures(fy, full[i]).monthly),
      unit: basisData[0].valueKind?.quantityUnit ?? "ชิ้น",
    };
  }, [selected, reports, report, sameEnd]);

  const colorOf = (fy: number) => YEAR_COLORS[slots[fy] ?? 0];
  const label = DB_REPORTS[report].label;

  /** The month a year's data stops part way through (the year in progress). */
  const partialMonthOf = (fy: number): PartialMonth | null => {
    const c = coverage.get(fy);
    if (!c?.endsEarly) return null;
    const lastDay = new Date(Date.UTC(Number(c.to.slice(0, 4)), Number(c.to.slice(5, 7)), 0)).getUTCDate();
    if (Number(c.to.slice(8, 10)) === lastDay) return null;
    return { index: fiscalMonthIndex(c.to), until: dayMonthLabel(c.to) };
  };

  if (rangeError) return <Notice error>{rangeError}</Notice>;
  if (!range) return <Notice loading>กำลังโหลดปีงบประมาณที่มีข้อมูล...</Notice>;
  if (range.years.length < MIN_COMPARE_YEARS) {
    return <Notice>ข้อมูล{label}ในฐานข้อมูลมีปีงบประมาณเดียว ยังไม่มีปีอื่นให้เปรียบเทียบ</Notice>;
  }

  /** What each year's numbers cover, for the notes under the year chips. */
  const spanOf = (fy: number): { from: string; to: string } => {
    const c = coverage.get(fy)!;
    if (!sameEnd) return c;
    const p = comparePeriod(fy, sameEnd);
    return { from: p.from > c.from ? p.from : c.from, to: p.to < c.to ? p.to : c.to };
  };
  const partialNotes = selected.flatMap((fy) => {
    const c = coverage.get(fy)!;
    const notes: string[] = [];
    if (c.startsLate) notes.push(`ปีงบ ${fy} มีข้อมูลตั้งแต่ ${formatThaiIsoDate(c.from)}`);
    if (c.endsEarly && !sameEnd) notes.push(`ปีงบ ${fy} ยังไม่ครบปี มีข้อมูลถึง ${formatThaiIsoDate(c.to)}`);
    return notes;
  });

  return (
    <div className="space-y-5">
      {/* Years and basis */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <GitCompareArrows size={16} className="text-blue-600" />
            เปรียบเทียบปีงบประมาณ · {label}
          </h2>
          <span className="text-xs text-gray-500">เลือกได้ {MIN_COMPARE_YEARS}–{MAX_COMPARE_YEARS} ปี</span>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="ปีงบประมาณที่เปรียบเทียบ">
          {[...range.years].sort((a, b) => a - b).map((fy) => {
            const on = selected.includes(fy);
            const locked = on ? selected.length <= MIN_COMPARE_YEARS : selected.length >= MAX_COMPARE_YEARS;
            const c = coverage.get(fy);
            return (
              <button
                key={fy}
                type="button"
                aria-pressed={on}
                onClick={() => toggleYear(fy)}
                title={
                  locked
                    ? on
                      ? `ต้องเลือกอย่างน้อย ${MIN_COMPARE_YEARS} ปี`
                      : `เลือกได้สูงสุด ${MAX_COMPARE_YEARS} ปี เอาปีที่เลือกไว้ออกก่อน`
                    : undefined
                }
                className={`flex items-center gap-2 text-sm px-3.5 py-1.5 rounded-full border transition-colors ${
                  on
                    ? "bg-blue-50 border-blue-300 text-gray-900 font-medium"
                    : locked
                      ? "bg-white border-gray-200 text-gray-300 cursor-not-allowed"
                      : "bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-gray-900"
                }`}
              >
                {on && <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorOf(fy) }} />}
                ปีงบ {fy}
                {c?.endsEarly && <span className="text-xs text-gray-400 font-normal">(ยังไม่ครบปี)</span>}
              </button>
            );
          })}
        </div>
        {canSame && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-500">เทียบ</span>
            <div className="inline-flex gap-1 p-1 bg-gray-100 rounded-lg" role="radiogroup" aria-label="ช่วงที่เทียบ">
              {(
                [
                  ["same", `ช่วงเดียวกัน (1 ต.ค. – ${dayMonthLabel(coverage.get(inProgress!)!.to)})`],
                  ["full", "ทั้งปีงบ"],
                ] as const
              ).map(([value, text]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={basis === value}
                  onClick={() => setBasis(value)}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    basis === value ? "bg-white text-blue-700 shadow-sm font-medium" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}
        {(sameEnd || partialNotes.length > 0) && (
          <ul className="text-xs text-gray-500 space-y-0.5">
            {sameEnd && (
              <li>
                ปีงบ {inProgress} ยังไม่ครบปี จึงเทียบทุกปีในช่วงเดียวกัน คือ 1 ต.ค. – {dayMonthLabel(sameEnd)}
              </li>
            )}
            {partialNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </div>

      {loadError && <Notice error>{loadError}</Notice>}
      {!view ? (
        !loadError && <Notice loading>กำลังดึงข้อมูลแต่ละปี...</Notice>
      ) : (
        <ComparisonBody
          figures={view.figures}
          monthly={view.monthly}
          partialMonths={selected.map(partialMonthOf)}
          unit={view.unit}
          colorOf={colorOf}
          spanOf={spanOf}
        />
      )}
    </div>
  );
}

/** A month only part of which has data so far: its place (ต.ค. = 0) and
 * the last day counted ("11 พ.ย."). */
interface PartialMonth {
  index: number;
  until: string;
}

function ComparisonBody({
  figures,
  monthly,
  partialMonths,
  unit,
  colorOf,
  spanOf,
}: {
  figures: YearFigures[];
  monthly: (number | null)[][];
  partialMonths: (PartialMonth | null)[];
  unit: string;
  colorOf: (fy: number) => string;
  spanOf: (fy: number) => { from: string; to: string };
}) {
  const years = figures.map((f) => f.fy);
  return (
    <>
      <YearCards figures={figures} unit={unit} colorOf={colorOf} />
      <div className="grid gap-5 lg:grid-cols-2">
        <MonthlyOverlay years={years} monthly={monthly} partialMonths={partialMonths} unit={unit} colorOf={colorOf} />
        <TopDepartments figures={figures} unit={unit} colorOf={colorOf} />
      </div>
      <IndicatorTable figures={figures} unit={unit} colorOf={colorOf} spanOf={spanOf} />
      <BreakdownTable figures={figures} unit={unit} colorOf={colorOf} />
      <p className="text-xs text-gray-400">
        มูลค่า = จำนวน × ราคาปัจจุบันของเซต (เหมือนหน้า Dashboard) ทุกปีใช้ราคาเดียวกัน มูลค่าจึงเปลี่ยนตามจำนวนเป็นหลัก
      </p>
    </>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────

function Notice({ children, error, loading }: { children: ReactNode; error?: boolean; loading?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center gap-2 text-sm rounded-xl border px-4 py-6 ${
        error ? "text-red-600 bg-red-50 border-red-100" : "text-gray-500 bg-white border-gray-200"
      }`}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {error && <AlertCircle size={16} className="shrink-0" />}
      {children}
    </div>
  );
}

function ChangeText({ value }: { value: Change }) {
  if (value.kind === "none") return <span className="text-gray-400">–</span>;
  if (value.kind === "new") return <span className="font-medium text-gray-600">ใหม่</span>;
  const up = value.pct >= 0;
  return (
    <span className={`font-semibold whitespace-nowrap ${up ? "text-emerald-700" : "text-amber-700"}`}>
      {up ? "▲" : "▼"} {Math.abs(value.pct).toFixed(1)}%
    </span>
  );
}

function YearDot({ color }: { color: string }) {
  return <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />;
}

const money = (n: number) => formatNumber(n, { decimals: 2 });
const count = (n: number) => formatNumber(Math.round(n));

function YearCards({ figures, unit, colorOf }: { figures: YearFigures[]; unit: string; colorOf: (fy: number) => string }) {
  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${figures.length === 3 ? "lg:grid-cols-3" : ""}`}>
      {figures.map((f, i) => {
        const prev = figures[i - 1];
        return (
          <div key={f.fy} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-gray-600">
              <YearDot color={colorOf(f.fy)} />
              ปีงบประมาณ {f.fy}
            </p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {count(f.total.quantity)} <span className="text-sm font-medium text-gray-500">{unit}</span>
            </p>
            <p className="text-sm text-gray-600">{money(f.total.value)} บาท</p>
            <p className="mt-2 text-xs text-gray-500 min-h-[1rem]">
              {prev ? (
                <>
                  จำนวน <ChangeText value={change(f.total.quantity, prev.total.quantity)} /> · มูลค่า{" "}
                  <ChangeText value={change(f.total.value, prev.total.value)} /> เทียบปีงบ {prev.fy}
                </>
              ) : (
                "ปีตั้งต้นของการเปรียบเทียบ"
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function ChartCard({ title, icon, children }: { title: string; icon: typeof TrendingUp; children: ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
      <ReportSectionHeader title={title} icon={icon} />
      <div className="p-4">{children}</div>
    </div>
  );
}

type TooltipRow = { dataKey?: string | number; value?: number | null; color?: string };

/** Series key of a year's unfinished last month (drawn dashed). */
const PARTIAL = "~partial";

function YearTooltip({
  active,
  payload,
  label,
  unit,
  partialUntil,
}: {
  active?: boolean;
  payload?: TooltipRow[];
  label?: string;
  unit: string;
  /** Year → "11 พ.ย." for the month (`label`) that is only partly counted. */
  partialUntil?: (fy: string, label?: string) => string | null;
}) {
  if (!active || !payload?.length) return null;
  // A year's solid and dashed series meet at one month: show it once.
  const seen = new Set<string>();
  const rows = payload.filter((p) => {
    const fy = String(p.dataKey).replace(PARTIAL, "");
    if (p.value == null || seen.has(fy)) return false;
    seen.add(fy);
    return true;
  });
  if (!rows.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {rows.map((p) => {
        const fy = String(p.dataKey).replace(PARTIAL, "");
        const until = partialUntil?.(fy, label);
        return (
          <p key={fy} className="flex items-center gap-2 text-gray-700">
            <YearDot color={p.color ?? "#999"} />
            ปีงบ {fy}: <span className="font-semibold">{count(p.value!)}</span> {unit}
            {until && <span className="text-xs text-gray-400">(ถึง {until})</span>}
          </p>
        );
      })}
    </div>
  );
}

function MonthlyOverlay({
  years,
  monthly,
  partialMonths,
  unit,
  colorOf,
}: {
  years: number[];
  monthly: (number | null)[][];
  partialMonths: (PartialMonth | null)[];
  unit: string;
  colorOf: (fy: number) => string;
}) {
  // A month that isn't over yet would read as a slump, so it gets its own
  // dashed series from the month before, with a hollow point.
  const data = FISCAL_MONTHS.map((month, i) => {
    const row: Record<string, string | number | null> = { month };
    years.forEach((fy, k) => {
      const partial = partialMonths[k]?.index;
      const q = monthly[k][i];
      row[String(fy)] = partial == null || i < partial ? q : null;
      if (partial != null) row[String(fy) + PARTIAL] = i === partial || i === partial - 1 ? q : null;
    });
    return row;
  });
  const partialUntil = (fy: string, label?: string) => {
    const k = years.indexOf(Number(fy));
    const p = partialMonths[k];
    return p && FISCAL_MONTHS[p.index] === label ? p.until : null;
  };
  const anyPartial = partialMonths.find((p) => p != null);

  // Each line ends with its year written beside it; two ends that nearly
  // meet are pushed apart (in pixels, roughly, from the plot's height).
  const lastIndex = monthly.map((m) => m.reduce<number>((at, q, i) => (q != null ? i : at), -1));
  const top = Math.max(1, ...monthly.flat().map((q) => q ?? 0)) * 1.15;
  const nudge: Record<number, number> = {};
  const ends = years
    .map((fy, k) => ({ fy, at: lastIndex[k], y: (1 - (monthly[k][lastIndex[k]] ?? 0) / top) * PLOT_HEIGHT }))
    .sort((a, b) => a.at - b.at || a.y - b.y);
  ends.forEach((e, i) => {
    const prev = ends[i - 1];
    const placed = prev && prev.at === e.at ? Math.max(e.y, prev.y + (nudge[prev.fy] ?? 0) + LABEL_GAP) : e.y;
    nudge[e.fy] = placed - e.y;
  });

  const endLabel = (fy: number, at: number) =>
    function EndLabel(p: { x?: number; y?: number; index?: number }) {
      return p.index === at && p.x != null && p.y != null ? (
        <text x={p.x + 8} y={p.y} dy={4 + (nudge[fy] ?? 0)} fontSize={11} fill="#374151">
          {fy}
        </text>
      ) : (
        <g />
      );
    };

  return (
    <ChartCard title={withUnit("จำนวนรายเดือน เทียบแต่ละปี", unit)} icon={TrendingUp}>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 10, right: 44, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} />
          <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} tickFormatter={(v) => count(Number(v))} width={56} />
          <Tooltip content={<YearTooltip unit={unit} partialUntil={partialUntil} />} />
          <Legend
            payload={years.map((fy) => ({ id: String(fy), value: String(fy), type: "circle" as const, color: colorOf(fy) }))}
            formatter={(v) => <span className="text-xs text-gray-600">ปีงบ {v}</span>}
            iconSize={9}
          />
          {years.flatMap((fy, k) => {
            const color = colorOf(fy);
            const last = lastIndex[k];
            const partial = partialMonths[k];
            const lines = [
              <Line
                key={fy}
                type="monotone"
                dataKey={String(fy)}
                stroke={color}
                strokeWidth={2}
                dot={{ r: 4, fill: color, stroke: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }}
                connectNulls={false}
                isAnimationActive={false}
                label={partial ? undefined : endLabel(fy, last)}
              />,
            ];
            if (partial) {
              lines.push(
                <Line
                  key={`${fy}${PARTIAL}`}
                  type="monotone"
                  dataKey={String(fy) + PARTIAL}
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  legendType="none"
                  dot={(p: { cx?: number; cy?: number; index?: number }) =>
                    p.index === partial.index && p.cx != null && p.cy != null ? (
                      <circle key={`pd-${fy}`} cx={p.cx} cy={p.cy} r={4.5} fill="#fff" stroke={color} strokeWidth={2} />
                    ) : (
                      <g key={`pd-${fy}-${p.index}`} />
                    )
                  }
                  activeDot={{ r: 6, fill: "#fff", stroke: color, strokeWidth: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                  label={endLabel(fy, partial.index)}
                />
              );
            }
            return lines;
          })}
        </LineChart>
      </ResponsiveContainer>
      {anyPartial && (
        <p className="text-xs text-gray-400 mt-1">
          เส้นประและจุดกลวง = เดือนที่ยังไม่จบ นับถึง {anyPartial.until} จึงยังน้อยกว่าเดือนเต็ม
        </p>
      )}
    </ChartCard>
  );
}

/** Plot height in pixels (chart less axis and legend), for spacing labels. */
const PLOT_HEIGHT = 250;
const LABEL_GAP = 13;

const shortName = (s: string, max = 22) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

function TopDepartments({ figures, unit, colorOf }: { figures: YearFigures[]; unit: string; colorOf: (fy: number) => string }) {
  const rows = compareRows(figures.map((f) => f.departments), "quantity").slice(0, 10);
  const data = rows.map((r) => {
    const row: Record<string, string | number> = { name: r.name };
    figures.forEach((f, k) => (row[String(f.fy)] = r.values[k]));
    return row;
  });
  const barSize = figures.length === 3 ? 7 : 9;
  const height = Math.max(240, rows.length * (figures.length * (barSize + 2) + 14) + 50);
  return (
    <ChartCard title={withUnit("10 หน่วยงานสูงสุด เทียบแต่ละปี", unit)} icon={BarChart3}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }} barGap={2} barCategoryGap={6}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
          <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} tickFormatter={(v) => count(Number(v))} />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            tick={{ fontSize: 11, fill: "#374151" }}
            tickFormatter={(v) => shortName(String(v))}
          />
          <Tooltip content={<YearTooltip unit={unit} />} cursor={{ fill: "rgba(37,99,235,0.06)" }} />
          <Legend formatter={(v) => <span className="text-xs text-gray-600">ปีงบ {v}</span>} iconType="circle" iconSize={9} />
          {figures.map((f) => (
            <Bar
              key={f.fy}
              dataKey={String(f.fy)}
              fill={colorOf(f.fy)}
              barSize={barSize}
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function YearHeaders({ figures, colorOf }: { figures: YearFigures[]; colorOf: (fy: number) => string }) {
  return (
    <>
      {figures.map((f) => (
        <th key={f.fy} className="px-3 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5">
            <YearDot color={colorOf(f.fy)} />
            ปีงบ {f.fy}
          </span>
        </th>
      ))}
    </>
  );
}

function IndicatorTable({
  figures,
  unit,
  colorOf,
  spanOf,
}: {
  figures: YearFigures[];
  unit: string;
  colorOf: (fy: number) => string;
  spanOf: (fy: number) => { from: string; to: string };
}) {
  const first = figures[0].fy;
  const last = figures[figures.length - 1].fy;
  const peaks = figures.map((f) => peakMonth(f.monthly));
  const rows: { label: string; values: number[]; format: (n: number) => string; notes?: string[] }[] = [
    { label: withUnit("จำนวนรวม", unit), values: figures.map((f) => f.total.quantity), format: count },
    { label: "มูลค่ารวม (บาท)", values: figures.map((f) => f.total.value), format: money },
    {
      label: withUnit("เฉลี่ยต่อเดือน", unit),
      values: figures.map((f) => {
        const s = spanOf(f.fy);
        return perMonth(f.total.quantity, s.from, s.to);
      }),
      format: count,
    },
    {
      label: withUnit("เดือนที่มากที่สุด", unit),
      values: peaks.map((p) => p?.quantity ?? 0),
      format: count,
      notes: peaks.map((p) => (p ? FISCAL_MONTHS[p.index] : "")),
    },
    { label: "จำนวนหน่วยงาน", values: figures.map((f) => f.departments.size), format: count },
    { label: "จำนวนรายการ (Set)", values: figures.map((f) => f.items.size), format: count },
  ];
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
      <ReportSectionHeader title="ตารางเปรียบเทียบ" icon={TableProperties} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">ตัวชี้วัด</th>
              <YearHeaders figures={figures} colorOf={colorOf} />
              <th className="px-3 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">
                เปลี่ยนแปลง {first}→{last}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-gray-100">
                <td className="px-3 py-2 text-gray-700">{r.label}</td>
                {r.values.map((v, k) => (
                  <td key={k} className="px-3 py-2 text-right text-gray-900 tabular-nums whitespace-nowrap">
                    {r.format(v)}
                    {r.notes?.[k] && <span className="ml-1 text-xs text-gray-400">({r.notes[k]})</span>}
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  <ChangeText value={change(r.values[r.values.length - 1], r.values[0])} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const ROW_LIMIT = 300;

function BreakdownTable({ figures, unit, colorOf }: { figures: YearFigures[]; unit: string; colorOf: (fy: number) => string }) {
  const [by, setBy] = useState<"department" | "item">("department");
  const [metric, setMetric] = useState<Metric>("quantity");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState("");

  const rows = useMemo(() => {
    const all = compareRows(figures.map((f) => (by === "department" ? f.departments : f.items)), metric);
    const q = search.trim().toLowerCase();
    return q ? all.filter((r) => r.name.toLowerCase().includes(q)) : all;
  }, [figures, by, metric, search]);

  const departmentRows = useMemo(() => {
    if (!department) return [];
    const all = compareRows(
      figures.map((f) => f.departmentItems.get(department) ?? new Map()),
      metric
    );
    const q = itemSearch.trim().toLowerCase();
    return q ? all.filter((r) => r.name.toLowerCase().includes(q)) : all;
  }, [figures, department, metric, itemSearch]);

  const format = metric === "value" ? money : count;
  const metricUnit = metric === "value" ? "บาท" : unit;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
      <ReportSectionHeader title="เปรียบเทียบรายหน่วยงาน / รายการ" icon={Building2} />
      <div className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="แยกตาม"
            value={by}
            options={[
              ["department", "หน่วยงาน"],
              ["item", "รายการ (Set)"],
            ]}
            onChange={(v) => {
              setBy(v);
              setSearch("");
              setDepartment(null);
            }}
          />
          <Segmented
            label="แสดง"
            value={metric}
            options={[
              ["quantity", withUnit("จำนวน", unit)],
              ["value", "มูลค่า (บาท)"],
            ]}
            onChange={setMetric}
          />
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder={by === "department" ? "ค้นหาหน่วยงาน..." : "ค้นหารายการ..."}
          />
        </div>
        {by === "department" && (
          <p className="text-xs text-gray-500">คลิกหน่วยงานเพื่อดูรายการของหน่วยงานนั้นในแต่ละปี</p>
        )}
        <CompareTable
          head={by === "department" ? "หน่วยงาน" : "รายการ"}
          rows={rows}
          figures={figures}
          colorOf={colorOf}
          format={format}
          unit={metricUnit}
          selected={by === "department" ? department : undefined}
          onSelect={by === "department" ? (n) => setDepartment((d) => (d === n ? null : n)) : undefined}
        />
      </div>

      {department && by === "department" && (
        <div className="border-t border-gray-200 bg-slate-50 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-800 mr-auto">
              รายการของ {department} ({formatNumber(departmentRows.length)} รายการ)
            </h3>
            <SearchBox value={itemSearch} onChange={setItemSearch} placeholder="ค้นหารายการ..." />
            <button
              type="button"
              onClick={() => setDepartment(null)}
              className="flex items-center gap-1 text-xs text-gray-500 px-2 py-1.5 rounded-lg hover:bg-white hover:text-gray-700"
            >
              <X size={13} /> ปิด
            </button>
          </div>
          <CompareTable head="รายการ" rows={departmentRows} figures={figures} colorOf={colorOf} format={format} unit={metricUnit} />
        </div>
      )}
    </div>
  );
}

function CompareTable({
  head,
  rows,
  figures,
  colorOf,
  format,
  unit,
  selected,
  onSelect,
}: {
  head: string;
  rows: CompareRow[];
  figures: YearFigures[];
  colorOf: (fy: number) => string;
  format: (n: number) => string;
  unit: string;
  selected?: string | null;
  onSelect?: (name: string) => void;
}) {
  const first = figures[0].fy;
  const last = figures[figures.length - 1].fy;
  const shown = rows.slice(0, ROW_LIMIT);
  return (
    <div className="border border-gray-200 rounded-lg overflow-auto max-h-[480px] bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs sticky top-0 z-[1]">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">
              {head} {unit && <span className="font-normal text-gray-400">({unit})</span>}
            </th>
            <YearHeaders figures={figures} colorOf={colorOf} />
            <th className="px-3 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">
              เปลี่ยนแปลง {first}→{last}
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.length === 0 && (
            <tr>
              <td colSpan={figures.length + 2} className="px-3 py-6 text-center text-gray-400">
                ไม่พบข้อมูล
              </td>
            </tr>
          )}
          {shown.map((r) => (
            <tr
              key={r.name}
              onClick={onSelect ? () => onSelect(r.name) : undefined}
              className={`border-t border-gray-100 ${onSelect ? "cursor-pointer hover:bg-blue-50/60" : ""} ${
                selected === r.name ? "bg-blue-50" : ""
              }`}
            >
              <td className={`px-3 py-2 ${selected === r.name ? "font-semibold text-blue-700" : "text-gray-700"}`}>{r.name}</td>
              {r.values.map((v, k) => (
                <td key={k} className="px-3 py-2 text-right tabular-nums text-gray-900 whitespace-nowrap">
                  {v ? format(v) : <span className="text-gray-300">–</span>}
                </td>
              ))}
              <td className="px-3 py-2 text-right">
                <ChangeText value={change(r.values[r.values.length - 1], r.values[0])} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > ROW_LIMIT && (
        <p className="px-3 py-2 text-xs text-gray-500 border-t border-gray-100">
          แสดง {formatNumber(ROW_LIMIT)} จาก {formatNumber(rows.length)} แถว ใช้ช่องค้นหาเพื่อหารายการอื่น
        </p>
      )}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex gap-1 p-1 bg-gray-100 rounded-lg text-sm" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`px-3 py-1 rounded-md transition-colors whitespace-nowrap ${
            value === v ? "bg-white text-blue-700 shadow-sm font-medium" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative flex-1 min-w-[12rem] max-w-xs">
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
      />
    </label>
  );
}
