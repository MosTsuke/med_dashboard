"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Building2,
  Layers,
  Loader2,
  RotateCw,
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
import SearchableSelect from "@/components/SearchableSelect";
import {
  REPORT_COLORS,
  REPORT_SHORT,
  breakdownRows,
  dwarfedSeries,
  reportFigures,
  reportKey,
  unionBuckets,
  type ReportFigures,
} from "@/lib/combinedReports";
import { fetchReport } from "@/lib/db/clientApi";
import { formatNumber } from "@/lib/formatNumber";
import {
  ALL_DEPARTMENTS,
  GRAIN_LABEL,
  formatBucketTick,
  formatMonthLabel,
  sliceByDepartment,
  type DepartmentFilter,
} from "@/lib/monthlyView";
import { DB_REPORTS, DB_REPORT_KINDS } from "@/lib/supply/reports";
import { bucketKey, periodLabel, wallClockToday } from "@/lib/supply/shape";
import type { Metric } from "@/lib/yearCompare";
import type { DashboardData, DbGrain, DbPeriod, DbReportKind } from "@/types";

interface Props {
  period: DbPeriod;
  /** The report already on screen, so it isn't fetched a second time. */
  current?: DashboardData | null;
}

/** A report that is switched on and has arrived. */
interface Series {
  kind: DbReportKind;
  figures: ReportFigures;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const count = (n: number) => formatNumber(Math.round(n));
const money = (n: number) => formatNumber(n, { decimals: 2 });

/** Tailwind needs whole class names, so the card grid's column count is looked up. */
const LG_COLS = ["", "lg:grid-cols-1", "lg:grid-cols-2", "lg:grid-cols-3", "lg:grid-cols-4"];

/**
 * "รวมทุกสถิติ": สถิติจ่าย, สถิติแพ็ค, สถิติล้าง and Resterile for the
 * period on screen, together — each one switched on or off with its chip,
 * like the years on "เปรียบเทียบปีงบ". Each report is fetched and counted
 * exactly as on its own page; nothing here changes them.
 */
export default function AllReportsView({ period, current }: Props) {
  const [selected, setSelected] = useState<DbReportKind[]>(DB_REPORT_KINDS);
  const [fetched, setFetched] = useState<Record<string, DashboardData>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [department, setDepartment] = useState<DepartmentFilter>(ALL_DEPARTMENTS);
  const requests = useRef(new Set<string>());
  const topRef = useRef<HTMLDivElement>(null);

  const reports = useMemo(() => {
    const all = { ...fetched };
    if (current?.source?.kind === "db") all[reportKey(current.source.report, current.source.period)] = current;
    return all;
  }, [fetched, current]);
  // Keep the report on screen once another one replaces it (the header's
  // report switch), so switching back and forth doesn't fetch it again.
  useEffect(() => {
    if (current?.source?.kind !== "db") return;
    const key = reportKey(current.source.report, current.source.period);
    setFetched((s) => (s[key] === current ? s : { ...s, [key]: current }));
  }, [current]);
  const dataOf = (kind: DbReportKind): DashboardData | undefined => reports[reportKey(kind, period)];
  const errorOf = (kind: DbReportKind): string | undefined => errors[reportKey(kind, period)];

  // Only the reports switched on are fetched; switching one on fetches it.
  useEffect(() => {
    for (const kind of selected) {
      const key = reportKey(kind, period);
      if (reports[key] || errors[key] || requests.current.has(key)) continue;
      requests.current.add(key);
      fetchReport(kind, period)
        .then((d) => setFetched((s) => ({ ...s, [key]: d })))
        .catch((e) => setErrors((s) => ({ ...s, [key]: errorText(e) })))
        .finally(() => requests.current.delete(key));
    }
  }, [selected, period, reports, errors]);

  const retry = (kind: DbReportKind) =>
    setErrors((s) => {
      const next = { ...s };
      delete next[reportKey(kind, period)];
      return next;
    });

  const toggle = (kind: DbReportKind) =>
    setSelected((s) =>
      s.includes(kind)
        ? s.length > 1
          ? s.filter((k) => k !== kind)
          : s
        : DB_REPORT_KINDS.filter((k) => k === kind || s.includes(k))
    );

  const series: Series[] = useMemo(
    () =>
      selected.flatMap((kind) => {
        const d = reports[reportKey(kind, period)];
        return d ? [{ kind, figures: reportFigures(sliceByDepartment(d, department)) }] : [];
      }),
    [selected, reports, period, department]
  );

  // Departments of every report that has arrived (switched on or not), so
  // the list doesn't change as reports are switched on and off.
  const departmentOptions = useMemo(() => {
    const names = new Set<string>();
    DB_REPORT_KINDS.forEach((k) => reports[reportKey(k, period)]?.departments.forEach((d) => names.add(d.name)));
    if (department !== ALL_DEPARTMENTS) names.add(department);
    return [
      { value: ALL_DEPARTMENTS, label: "ทุกหน่วยงาน" },
      ...Array.from(names)
        .sort((a, b) => a.localeCompare(b, "th"))
        .map((n) => ({ value: n, label: n })),
    ];
  }, [reports, period, department]);

  const pickDepartment = (name: DepartmentFilter) => {
    setDepartment(name);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const waiting = selected.filter((k) => !dataOf(k) && !errorOf(k));

  return (
    <div ref={topRef} className="space-y-5 scroll-mt-20">
      {/* Reports and department */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Layers size={16} className="text-blue-600" />
            รวมทุกสถิติ · {periodLabel(period)}
          </h2>
          <span className="text-xs text-gray-500">กดเพื่อเปิด/ปิดแต่ละสถิติ · เปลี่ยนช่วงเวลาได้ที่ปุ่มด้านบน</span>
          <div className="sm:ml-auto">
            <SearchableSelect
              icon={Building2}
              value={department}
              onChange={setDepartment}
              searchPlaceholder="ค้นหาหน่วยงาน..."
              options={departmentOptions}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="สถิติที่แสดง">
          {DB_REPORT_KINDS.map((kind) => {
            const on = selected.includes(kind);
            const locked = on && selected.length === 1;
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(kind)}
                title={locked ? "ต้องเปิดไว้อย่างน้อย 1 สถิติ" : undefined}
                className={`flex items-center gap-2 text-sm px-3.5 py-1.5 rounded-full border transition-colors ${
                  on
                    ? "bg-blue-50 border-blue-300 text-gray-900 font-medium"
                    : "bg-white border-gray-200 text-gray-500 hover:border-blue-300 hover:text-gray-900"
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full border"
                  style={on ? { background: REPORT_COLORS[kind], borderColor: REPORT_COLORS[kind] } : { borderColor: "#d1d5db" }}
                />
                {DB_REPORTS[kind].label}
                {on && !dataOf(kind) && !errorOf(kind) && <Loader2 size={13} className="animate-spin text-gray-400" />}
                {on && errorOf(kind) && <AlertCircle size={13} className="text-red-500" />}
              </button>
            );
          })}
        </div>
        {department !== ALL_DEPARTMENTS && (
          <p className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            แสดงเฉพาะหน่วยงาน <span className="font-semibold text-gray-800">{department}</span>
            <button
              type="button"
              onClick={() => setDepartment(ALL_DEPARTMENTS)}
              className="flex items-center gap-1 text-gray-500 px-2 py-0.5 rounded-md border border-gray-200 hover:bg-gray-50 hover:text-gray-700"
            >
              <X size={12} /> ดูทุกหน่วยงาน
            </button>
          </p>
        )}
      </div>

      {/* One card per report switched on */}
      <div className={`grid gap-4 sm:grid-cols-2 ${LG_COLS[selected.length]}`}>
        {selected.map((kind) => (
          <ReportCard
            key={kind}
            kind={kind}
            figures={series.find((s) => s.kind === kind)?.figures}
            error={errorOf(kind)}
            showDepartments={department === ALL_DEPARTMENTS}
            onRetry={() => retry(kind)}
          />
        ))}
      </div>

      {series.length > 0 ? (
        <>
          <TrendChart series={series} grain={period.grain} />
          <BucketTable series={series} grain={period.grain} />
          <Breakdown series={series} department={department} onDepartment={pickDepartment} />
          <div className="text-xs text-gray-400 space-y-0.5">
            <p>
              แต่ละสถิตินับแบบเดียวกับหน้าของสถิตินั้น และนับคนละอย่าง
              {series.some((s) => s.figures.unit) &&
                ` (${series
                  .filter((s) => s.figures.unit)
                  .map((s) => `${REPORT_SHORT[s.kind]} = ${s.figures.unit}`)
                  .join(", ")})`}{" "}
              จึงไม่รวมเป็นยอดเดียวกัน
            </p>
            <p>มูลค่า = จำนวน × ราคาปัจจุบันของเซต (เหมือนหน้า Dashboard)</p>
          </div>
        </>
      ) : (
        waiting.length > 0 && <Notice loading>กำลังดึงข้อมูล...</Notice>
      )}
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────

function Notice({ children, loading }: { children: ReactNode; loading?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-2 text-sm rounded-xl border px-4 py-6 text-gray-500 bg-white border-gray-200">
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />;
}

function ReportCard({
  kind,
  figures,
  error,
  showDepartments,
  onRetry,
}: {
  kind: DbReportKind;
  figures?: ReportFigures;
  error?: string;
  showDepartments: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 min-w-0">
      <p className="flex items-center gap-2 text-sm font-medium text-gray-600">
        <Dot color={REPORT_COLORS[kind]} />
        {DB_REPORTS[kind].label}
      </p>
      {error ? (
        <div className="mt-2 space-y-2">
          <p className="flex items-start gap-1.5 text-xs text-red-600">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            {error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1 text-xs text-gray-600 px-2 py-1 rounded-md border border-gray-200 hover:bg-gray-50"
          >
            <RotateCw size={12} /> ลองใหม่
          </button>
        </div>
      ) : !figures ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-gray-400">
          <Loader2 size={15} className="animate-spin" /> กำลังดึงข้อมูล...
        </p>
      ) : (
        <>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {count(figures.total.quantity)} <span className="text-sm font-medium text-gray-500">{figures.unit}</span>
          </p>
          <p className="text-sm text-gray-600">{money(figures.total.value)} บาท</p>
          <p className="mt-2 text-xs text-gray-500">
            {showDepartments && <>{count(figures.departments.size)} หน่วยงาน · </>}
            {count(figures.items.size)} รายการ (Set)
          </p>
        </>
      )}
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

function SeriesTooltip({
  active,
  payload,
  label,
  units,
}: {
  active?: boolean;
  payload?: TooltipRow[];
  label?: string;
  units: Partial<Record<DbReportKind, string>>;
}) {
  const rows = (payload ?? []).filter((p) => p.value != null);
  if (!active || !rows.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium text-gray-700 mb-1">{label ? formatMonthLabel(label) : ""}</p>
      {rows.map((p) => {
        const kind = String(p.dataKey) as DbReportKind;
        return (
          <p key={kind} className="flex items-center gap-2 text-gray-700">
            <Dot color={REPORT_COLORS[kind]} />
            {DB_REPORTS[kind].label}: <span className="font-semibold">{count(p.value!)}</span> {units[kind]}
          </p>
        );
      })}
    </div>
  );
}

/** Plot height in pixels (chart less axis and legend), for spacing the
 * names written at the line ends. */
const PLOT_HEIGHT = 250;
const LABEL_GAP = 13;

function TrendChart({ series, grain }: { series: Series[]; grain: DbGrain }) {
  const buckets = unionBuckets(series.map((s) => s.figures));
  const data = buckets.map((bucket) => {
    const row: Record<string, string | number | null> = { bucket };
    for (const s of series) row[s.kind] = s.figures.buckets.get(bucket) ?? null;
    return row;
  });
  const units = Object.fromEntries(series.map((s) => [s.kind, s.figures.unit]));
  const asBars = buckets.length <= 2;

  // A report far smaller than the rest lies flat along the bottom of a
  // shared scale; say how to see it on its own scale instead.
  const maxes = series.map((s) => ({ kind: s.kind, max: Math.max(0, ...Array.from(s.figures.buckets.values())) }));
  const dwarfed = dwarfedSeries(maxes);

  // The bucket we're in now isn't over, so it reads lower than a whole one.
  const last = buckets[buckets.length - 1];
  const unfinished = grain !== "day" && last === bucketKey(wallClockToday(), grain) ? last : null;

  // Each line ends with its report's name; names that nearly meet are
  // pushed apart (in pixels, roughly, from the plot's height).
  const top = Math.max(1, ...maxes.map((m) => m.max)) * 1.1;
  const lastIndex = series.map((s) => data.reduce<number>((at, row, i) => (row[s.kind] != null ? i : at), -1));
  // Names at the same point go down from the top one, then — if that runs
  // past the bottom of the plot — back up from the bottom.
  const nudge: Partial<Record<DbReportKind, number>> = {};
  const ends = series
    .map((s, k) => ({ kind: s.kind, at: lastIndex[k], y: (1 - Number(data[lastIndex[k]]?.[s.kind] ?? 0) / top) * PLOT_HEIGHT }))
    .sort((a, b) => a.at - b.at || a.y - b.y);
  const placed = ends.map((e) => e.y);
  for (let i = 1; i < ends.length; i++) {
    if (ends[i].at === ends[i - 1].at) placed[i] = Math.max(placed[i], placed[i - 1] + LABEL_GAP);
  }
  for (let i = ends.length - 1; i >= 0; i--) {
    const below = ends[i + 1]?.at === ends[i].at ? placed[i + 1] - LABEL_GAP : PLOT_HEIGHT;
    placed[i] = Math.min(placed[i], below);
  }
  ends.forEach((e, i) => (nudge[e.kind] = placed[i] - e.y));
  const endLabel = (kind: DbReportKind, at: number) =>
    function EndLabel(p: { x?: number; y?: number; index?: number }) {
      return p.index === at && p.x != null && p.y != null ? (
        <text x={p.x + 8} y={p.y} dy={4 + (nudge[kind] ?? 0)} fontSize={11} fill="#374151">
          {REPORT_SHORT[kind]}
        </text>
      ) : (
        <g />
      );
    };

  const legend = (
    <Legend
      payload={series.map((s) => ({ id: s.kind, value: s.kind, type: "circle" as const, color: REPORT_COLORS[s.kind] }))}
      formatter={(v) => <span className="text-xs text-gray-600">{DB_REPORTS[v as DbReportKind].label}</span>}
      iconSize={9}
    />
  );
  const yAxis = <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} tickFormatter={(v) => count(Number(v))} width={56} />;
  const xAxis = (
    <XAxis
      dataKey="bucket"
      tick={{ fontSize: 11, fill: "#6b7280" }}
      tickFormatter={(v) => formatBucketTick(String(v))}
      interval="preserveStartEnd"
      minTickGap={8}
    />
  );
  const tooltip = <SeriesTooltip units={units} />;
  const dots = buckets.length <= 40;

  return (
    <ChartCard title={`จำนวน${GRAIN_LABEL[grain]} ทุกสถิติ`} icon={TrendingUp}>
      <ResponsiveContainer width="100%" height={320}>
        {asBars ? (
          <BarChart data={data} margin={{ top: 10, right: 16, left: 4, bottom: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            {xAxis}
            {yAxis}
            <Tooltip content={tooltip} cursor={{ fill: "rgba(37,99,235,0.06)" }} />
            {series.length > 1 && legend}
            {series.map((s) => (
              <Bar
                key={s.kind}
                dataKey={s.kind}
                fill={REPORT_COLORS[s.kind]}
                maxBarSize={48}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        ) : (
          <LineChart data={data} margin={{ top: 10, right: 64, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            {xAxis}
            {yAxis}
            <Tooltip content={tooltip} />
            {series.length > 1 && legend}
            {series.map((s, k) => (
              <Line
                key={s.kind}
                type="monotone"
                dataKey={s.kind}
                stroke={REPORT_COLORS[s.kind]}
                strokeWidth={2}
                dot={dots ? { r: 4, fill: REPORT_COLORS[s.kind], stroke: "#fff", strokeWidth: 2 } : false}
                activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }}
                connectNulls={false}
                isAnimationActive={false}
                label={endLabel(s.kind, lastIndex[k])}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
      <div className="text-xs text-gray-500 mt-1 space-y-0.5">
        {dwarfed.length > 0 && (
          <p>
            {dwarfed.map((k) => DB_REPORTS[k].label).join(", ")} มีจำนวนน้อยกว่าสถิติอื่นมาก {asBars ? "แท่ง" : "เส้น"}จึงอยู่ชิดด้านล่าง
            — ปิดสถิติอื่นด้านบนเพื่อดูในสเกลของตัวเอง
          </p>
        )}
        {unfinished && <p>{formatMonthLabel(unfinished)} ยังไม่จบ ตัวเลขช่วงนี้จึงยังน้อยกว่าช่วงเต็ม</p>}
      </div>
    </ChartCard>
  );
}

function ReportHeaders({ series }: { series: Series[] }) {
  return (
    <>
      {series.map((s) => (
        <th key={s.kind} className="px-3 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5">
            <Dot color={REPORT_COLORS[s.kind]} />
            {DB_REPORTS[s.kind].label}
            {s.figures.unit && <span className="font-normal text-gray-400">({s.figures.unit})</span>}
          </span>
        </th>
      ))}
    </>
  );
}

function BucketTable({ series, grain }: { series: Series[]; grain: DbGrain }) {
  const buckets = unionBuckets(series.map((s) => s.figures));
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
      <ReportSectionHeader title={`ตาราง${GRAIN_LABEL[grain]} ทุกสถิติ`} icon={TableProperties} />
      <div className="overflow-auto max-h-[560px]">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs sticky top-0 z-[1]">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">ช่วงเวลา</th>
              <ReportHeaders series={series} />
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b} className="border-t border-gray-100">
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{formatMonthLabel(b)}</td>
                {series.map((s) => {
                  const q = s.figures.buckets.get(b);
                  return (
                    <td key={s.kind} className="px-3 py-2 text-right tabular-nums text-gray-900 whitespace-nowrap">
                      {q == null ? <span className="text-gray-300">–</span> : count(q)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 sticky bottom-0">
            <tr className="border-t border-gray-200 font-semibold">
              <td className="px-3 py-2 text-gray-700">รวม</td>
              {series.map((s) => (
                <td key={s.kind} className="px-3 py-2 text-right tabular-nums text-gray-900 whitespace-nowrap">
                  {count(s.figures.total.quantity)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

const ROW_LIMIT = 300;

function Breakdown({
  series,
  department,
  onDepartment,
}: {
  series: Series[];
  department: DepartmentFilter;
  onDepartment: (name: DepartmentFilter) => void;
}) {
  const [chosenBy, setBy] = useState<"department" | "item">("department");
  const [metric, setMetric] = useState<Metric>("quantity");
  const [search, setSearch] = useState("");
  const [sortKind, setSortKind] = useState<DbReportKind | null>(null);

  // With one department picked, its sets are what's left to break down.
  const oneDepartment = department !== ALL_DEPARTMENTS;
  const by = oneDepartment ? "item" : chosenBy;
  const sortIndex = Math.max(0, series.findIndex((s) => s.kind === sortKind));

  const rows = useMemo(() => {
    const all = breakdownRows(
      series.map((s) => (by === "department" ? s.figures.departments : s.figures.items)),
      metric,
      sortIndex
    );
    const q = search.trim().toLowerCase();
    return q ? all.filter((r) => r.name.toLowerCase().includes(q)) : all;
  }, [series, by, metric, sortIndex, search]);

  const format = metric === "value" ? money : count;
  const shown = rows.slice(0, ROW_LIMIT);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
      <ReportSectionHeader
        title={oneDepartment ? `รายการของ ${department} ทุกสถิติ` : "รายหน่วยงาน / รายการ ทุกสถิติ"}
        icon={Building2}
      />
      <div className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {!oneDepartment && (
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
              }}
            />
          )}
          <Segmented
            label="แสดง"
            value={metric}
            options={[
              ["quantity", "จำนวน"],
              ["value", "มูลค่า (บาท)"],
            ]}
            onChange={setMetric}
          />
          <label className="relative flex-1 min-w-[12rem] max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={by === "department" ? "ค้นหาหน่วยงาน..." : "ค้นหารายการ..."}
              className="w-full text-sm pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
            />
          </label>
        </div>
        <p className="text-xs text-gray-500">
          กดหัวคอลัมน์เพื่อเรียงตามสถิตินั้น
          {by === "department" && " · คลิกหน่วยงานเพื่อดูเฉพาะหน่วยงานนั้นทั้งหน้า"}
        </p>

        <div className="border border-gray-200 rounded-lg overflow-auto max-h-[480px]">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs sticky top-0 z-[1]">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">
                  {by === "department" ? "หน่วยงาน" : "รายการ"}
                </th>
                {series.map((s, k) => (
                  <th key={s.kind} className="px-3 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setSortKind(s.kind)}
                      aria-sort={k === sortIndex ? "descending" : undefined}
                      className={`inline-flex items-center gap-1.5 hover:text-blue-700 ${k === sortIndex ? "text-gray-900" : ""}`}
                    >
                      <Dot color={REPORT_COLORS[s.kind]} />
                      {DB_REPORTS[s.kind].label}
                      {(metric === "value" || s.figures.unit) && (
                        <span className="font-normal text-gray-400">({metric === "value" ? "บาท" : s.figures.unit})</span>
                      )}
                      <span className={k === sortIndex ? "text-blue-600" : "text-transparent"}>▼</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={series.length + 1} className="px-3 py-6 text-center text-gray-400">
                    ไม่พบข้อมูล
                  </td>
                </tr>
              )}
              {shown.map((r) => (
                <tr
                  key={r.name}
                  onClick={by === "department" ? () => onDepartment(r.name) : undefined}
                  className={`border-t border-gray-100 ${by === "department" ? "cursor-pointer hover:bg-blue-50/60" : ""}`}
                >
                  <td className="px-3 py-2 text-gray-700">{r.name}</td>
                  {r.values.map((v, k) => (
                    <td key={k} className="px-3 py-2 text-right tabular-nums text-gray-900 whitespace-nowrap">
                      {v ? format(v) : <span className="text-gray-300">–</span>}
                    </td>
                  ))}
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
        {by === "department" && (
          <p className="text-xs text-gray-400">
            หน่วยงานของแต่ละสถิติ:{" "}
            {series.map((s) => `${REPORT_SHORT[s.kind]} = ${DB_REPORTS[s.kind].departmentLabel}`).join(" · ")}
          </p>
        )}
      </div>
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
