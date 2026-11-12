"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
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

const iso = (d: Date) => formatDate(d);
const addDays = (s: string, n: number) => iso(new Date(parseIsoDate(s)!.getTime() + n * DAY_MS));
function monthBounds(s: string, offset = 0): { from: string; to: string } {
  const d = parseIsoDate(s)!;
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset + 1, 0));
  return { from: iso(first), to: iso(last) };
}
const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const monthName = (s: string) => {
  const d = parseIsoDate(s)!;
  return `${THAI_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear() + 543}`;
};

interface Preset {
  id: string;
  label: string;
  from: string;
  to: string;
}

/** Quick choices, counted back from the last day that has data (not
 * today), so they're never empty on a copy of old data. */
function presets(bounds: PeriodBounds): Preset[] {
  const out: Preset[] = bounds.years.map((fy) => {
    const p = fiscalYearPeriod(fy);
    return { id: `fy${fy}`, label: `ปีงบประมาณ ${fy}`, from: p.from, to: p.to };
  });
  const anchor = bounds.maxDate;
  if (anchor) {
    const thisMonth = monthBounds(anchor);
    const lastMonth = monthBounds(anchor, -1);
    out.push(
      { id: "thisMonth", label: `เดือน ${monthName(anchor)}`, ...thisMonth },
      { id: "lastMonth", label: `เดือน ${monthName(lastMonth.from)}`, ...lastMonth },
      { id: "last30", label: `30 วันล่าสุด (ถึง ${formatThaiIsoDate(anchor)})`, from: addDays(anchor, -29), to: anchor },
      { id: "last7", label: `7 วันล่าสุด (ถึง ${formatThaiIsoDate(anchor)})`, from: addDays(anchor, -6), to: anchor }
    );
  }
  if (bounds.minDate && bounds.maxDate) {
    out.push({ id: "all", label: "ทั้งหมดที่มีข้อมูล", from: bounds.minDate, to: bounds.maxDate });
  }
  return out;
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
 * Pick a time range and how to break it down: รายวัน / รายเดือน / รายปี
 * (ปีงบประมาณ). The range is a quick choice (a fiscal year, this or last
 * month, the last 30 or 7 days, everything) or any two dates.
 */
export default function PeriodPicker({ bounds, value, onChange, disabled }: Props) {
  const options = presets(bounds);
  const current = options.find((o) => o.from === value.from && o.to === value.to);
  // "กำหนดเอง" can be picked while the dates still match a quick choice.
  const [customMode, setCustomMode] = useState(false);
  const showCustom = customMode || !current;
  const error = periodError(value);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-500">แสดงผล</p>
      <div role="radiogroup" aria-label="แสดงผล" className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-xl">
        {GRAINS.map((g) => (
          <button
            key={g}
            type="button"
            role="radio"
            aria-checked={value.grain === g}
            disabled={disabled}
            onClick={() => onChange({ ...value, grain: g })}
            className={`text-sm font-medium py-1.5 rounded-lg transition-colors ${
              value.grain === g ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {GRAIN_LABEL[g]}
          </button>
        ))}
      </div>

      <p className="text-xs font-medium text-gray-500 pt-1">ช่วงเวลา</p>
      <select
        aria-label="ช่วงเวลา"
        value={showCustom ? "custom" : current!.id}
        disabled={disabled}
        onChange={(e) => {
          const picked = options.find((o) => o.id === e.target.value);
          setCustomMode(!picked);
          // "กำหนดเอง" keeps the dates and just shows the date inputs.
          if (picked) onChange({ from: picked.from, to: picked.to, grain: value.grain });
        }}
        className="w-full text-base border border-gray-200 rounded-xl px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
        <option value="custom">กำหนดช่วงเอง…</option>
      </select>

      {showCustom && (
        <div className="grid grid-cols-2 gap-2">
          {(["from", "to"] as const).map((end) => (
            <label key={end} className="block">
              <span className="block text-xs text-gray-500 mb-1">{end === "from" ? "ตั้งแต่" : "ถึง"}</span>
              <input
                type="date"
                value={value[end]}
                min={bounds.minDate ?? undefined}
                max={bounds.maxDate ?? undefined}
                disabled={disabled}
                onChange={(e) => e.target.value && onChange({ ...value, [end]: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
              />
              <span className="block text-xs text-gray-400 mt-0.5">{formatThaiIsoDate(value[end])}</span>
            </label>
          ))}
        </div>
      )}

      {error && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700">
          <AlertCircle size={14} className="shrink-0 mt-px" />
          {error}
        </p>
      )}
    </div>
  );
}
