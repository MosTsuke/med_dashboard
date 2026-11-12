"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { formatThaiIsoDate, GRAIN_LABEL } from "@/lib/monthlyView";
import { fiscalYearPeriod, formatDate, parseIsoDate, periodFiscalYear, periodRange } from "@/lib/supply/shape";
import type { DbGrain, DbPeriod } from "@/types";

/** What the database has for the chosen report. */
export interface PeriodBounds {
  /** Fiscal years with data, newest first. */
  years: number[];
  /** First / last date with data, CE "YYYY-MM-DD". */
  minDate: string | null;
  maxDate: string | null;
}

interface Props {
  bounds: PeriodBounds;
  value: DbPeriod;
  onChange: (period: DbPeriod) => void;
  disabled?: boolean;
}

const GRAINS: DbGrain[] = ["day", "month", "year"];
const DAY_MS = 86_400_000;
const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const toDate = (s: string) => parseIsoDate(s)!;
const addDays = (s: string, n: number) => formatDate(new Date(toDate(s).getTime() + n * DAY_MS));
const firstOfMonth = (s: string, offset = 0) => {
  const d = toDate(s);
  return formatDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1)));
};
const lastOfMonth = (s: string) => {
  const d = toDate(s);
  return formatDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
};
const monthName = (s: string) => {
  const d = toDate(s);
  return `${THAI_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear() + 543}`;
};
const fiscalYearOfIso = (s: string) => {
  const d = toDate(s);
  return (d.getUTCMonth() >= 9 ? d.getUTCFullYear() + 1 : d.getUTCFullYear()) + 543;
};

/** "Today" for the quick choices: the real date — unless the data stops
 * well before it (a copy of old data, the demo), then its last day, so the
 * choices are never empty. */
function anchorDate(bounds: PeriodBounds): string {
  const now = new Date();
  const today = formatDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
  if (!bounds.maxDate || bounds.maxDate >= addDays(today, -7)) return today;
  return bounds.maxDate;
}

interface Preset {
  id: string;
  label: string;
  from: string;
  to: string;
  grain: DbGrain;
}

function presets(anchor: string): Preset[] {
  const fy = fiscalYearOfIso(anchor);
  const thisFy = fiscalYearPeriod(fy);
  const lastFy = fiscalYearPeriod(fy - 1);
  const lastMonthStart = firstOfMonth(anchor, -1);
  return [
    { id: "today", label: "วันนี้", from: anchor, to: anchor, grain: "day" },
    { id: "last7", label: "7 วันล่าสุด", from: addDays(anchor, -6), to: anchor, grain: "day" },
    { id: "last30", label: "30 วันล่าสุด", from: addDays(anchor, -29), to: anchor, grain: "day" },
    { id: "thisMonth", label: "เดือนนี้", from: firstOfMonth(anchor), to: anchor, grain: "day" },
    { id: "lastMonth", label: "เดือนที่แล้ว", from: lastMonthStart, to: lastOfMonth(lastMonthStart), grain: "day" },
    { id: "thisFy", label: "ปีงบนี้", from: thisFy.from, to: thisFy.to, grain: "month" },
    { id: "lastFy", label: "ปีงบที่แล้ว", from: lastFy.from, to: lastFy.to, grain: "month" },
  ];
}

/** A sensible way to show a range picked on the calendar: by day up to two
 * months, by month up to two years, by fiscal year beyond. */
function suggestedGrain(from: string, to: string): DbGrain {
  const days = Math.round((toDate(to).getTime() - toDate(from).getTime()) / DAY_MS) + 1;
  return days <= 62 ? "day" : days <= 731 ? "month" : "year";
}

/** The period's error in Thai, or null when it can be loaded. */
export function periodError(p: DbPeriod): string | null {
  try {
    periodRange(p);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** "ปีงบ 2569 · รายเดือน", "1 ต.ค. 68 – 15 พ.ย. 68 · รายวัน" — for the header button. */
export function periodShortLabel(p: DbPeriod): string {
  const fy = periodFiscalYear(p);
  const range = fy
    ? `ปีงบ ${fy}`
    : p.from === p.to
      ? shortDate(p.from)
      : `${shortDate(p.from)} – ${shortDate(p.to)}`;
  return `${range} · ${GRAIN_LABEL[p.grain]}`;
}
function shortDate(s: string): string {
  const d = parseIsoDate(s);
  if (!d) return s;
  return `${d.getUTCDate()} ${THAI_MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear() + 543).slice(2)}`;
}

/**
 * Pick a time range on a Buddhist-era calendar — click the first day, then
 * the last — or with a quick choice on the left (today, the last 7 / 30
 * days, this / last month, this / last fiscal year). Then choose how to
 * show it: รายวัน / รายเดือน / รายปี (fiscal years); picking a range
 * suggests one.
 */
export default function PeriodPicker({ bounds, value, onChange, disabled }: Props) {
  const anchor = anchorDate(bounds);
  const options = presets(anchor);
  const current = options.find((o) => o.from === value.from && o.to === value.to);
  // Earliest and latest day you can click: from the first data to "today".
  const minDay = bounds.minDate ?? addDays(anchor, -365);
  const maxDay = anchor > (bounds.maxDate ?? anchor) ? anchor : bounds.maxDate ?? anchor;

  const [view, setView] = useState(() => firstOfMonth(value.to > maxDay ? maxDay : value.to));
  /** Set after the first click: waiting for the last day of the range. */
  const [pickingEnd, setPickingEnd] = useState(false);

  // A quick choice or a new report moves the calendar to the range's end.
  useEffect(() => {
    if (!pickingEnd) setView(firstOfMonth(value.to > maxDay ? maxDay : value.to));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.from, value.to]);

  const pick = (day: string) => {
    if (!pickingEnd) {
      setPickingEnd(true);
      onChange({ from: day, to: day, grain: "day" });
      return;
    }
    setPickingEnd(false);
    const [from, to] = day < value.from ? [day, value.from] : [value.from, day];
    onChange({ from, to, grain: suggestedGrain(from, to) });
  };

  // Months you can jump to, newest first.
  const months: string[] = [];
  for (let m = firstOfMonth(maxDay); m >= firstOfMonth(minDay); m = firstOfMonth(m, -1)) months.push(m);

  const lead = toDate(view).getUTCDay();
  const daysInView: string[] = [];
  for (let d = view; d <= lastOfMonth(view); d = addDays(d, 1)) daysInView.push(d);

  const error = periodError(value);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
        {/* Quick choices: a column beside the calendar, chips above it on phones. */}
        <div className="flex flex-wrap gap-1.5 sm:flex-col sm:flex-nowrap">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              disabled={disabled}
              aria-pressed={current?.id === o.id}
              onClick={() => {
                setPickingEnd(false);
                onChange({ from: o.from, to: o.to, grain: o.grain });
              }}
              className={`text-sm px-3 py-1.5 rounded-lg border text-left transition-colors ${
                current?.id === o.id
                  ? "bg-blue-50 border-blue-300 text-blue-700 font-medium"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1 mb-2">
            <button
              type="button"
              aria-label="เดือนก่อนหน้า"
              disabled={disabled || view <= firstOfMonth(minDay)}
              onClick={() => setView(firstOfMonth(view, -1))}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <select
              aria-label="เดือนที่แสดงในปฏิทิน"
              value={view}
              disabled={disabled}
              onChange={(e) => setView(e.target.value)}
              className="flex-1 min-w-0 text-sm font-medium text-center text-gray-700 bg-transparent rounded-lg py-1 hover:bg-gray-50 focus:outline-none"
            >
              {months.map((m) => (
                <option key={m} value={m}>{monthName(m)}</option>
              ))}
            </select>
            <button
              type="button"
              aria-label="เดือนถัดไป"
              disabled={disabled || view >= firstOfMonth(maxDay)}
              onClick={() => setView(firstOfMonth(view, 1))}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-[11px] font-medium text-gray-400 py-1">{w}</div>
            ))}
            {Array.from({ length: lead }, (_, i) => <div key={`lead${i}`} />)}
            {daysInView.map((d) => {
              const out = d < minDay || d > maxDay;
              const isEnd = d === value.from || d === value.to;
              const inRange = d > value.from && d < value.to;
              return (
                <button
                  key={d}
                  type="button"
                  disabled={disabled || out}
                  aria-label={formatThaiIsoDate(d)}
                  aria-pressed={isEnd || inRange}
                  onClick={() => pick(d)}
                  className={`h-8 text-sm rounded-md tabular-nums transition-colors ${
                    out
                      ? "text-gray-300 cursor-default"
                      : isEnd
                        ? "bg-blue-600 text-white font-medium"
                        : inRange
                          ? "bg-blue-50 text-blue-700"
                          : "text-gray-700 hover:bg-gray-100"
                  } ${d === anchor && !isEnd ? "ring-1 ring-blue-300" : ""}`}
                >
                  {toDate(d).getUTCDate()}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500">แสดงผล</span>
        <div role="radiogroup" aria-label="แสดงผล" className="flex gap-1 p-1 bg-gray-100 rounded-lg">
          {GRAINS.map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={value.grain === g}
              disabled={disabled}
              onClick={() => onChange({ ...value, grain: g })}
              className={`text-sm px-3 py-1 rounded-md transition-colors ${
                value.grain === g ? "bg-white text-blue-700 shadow-sm font-medium" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {GRAIN_LABEL[g]}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
        <span className="text-gray-500">ช่วงที่เลือก: </span>
        {value.from === value.to
          ? formatThaiIsoDate(value.from)
          : `${formatThaiIsoDate(value.from)} – ${formatThaiIsoDate(value.to)}`}
        {pickingEnd && <span className="text-blue-600"> · กดวันสุดท้ายของช่วง</span>}
      </p>

      {error && !pickingEnd && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700">
          <AlertCircle size={14} className="shrink-0 mt-px" />
          {error}
        </p>
      )}
    </div>
  );
}
