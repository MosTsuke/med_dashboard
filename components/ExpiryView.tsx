"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, AlertOctagon, CalendarClock, Clock, Loader2, MapPin, Search, TableProperties, Warehouse, X } from "lucide-react";
import ReportSectionHeader from "@/components/ReportSectionHeader";
import SearchableSelect from "@/components/SearchableSelect";
import TablePagination, { type PageSize } from "@/components/TablePagination";
import { fetchExpiry } from "@/lib/db/clientApi";
import {
  CENTRAL_STORE,
  DEFAULT_NEAR_EXPIRY,
  EXPIRED_AGE_CHOICES,
  NEAR_EXPIRY_CHOICES,
  daysLeft,
  daysText,
  expiryStatus,
  groupBy,
  summarize,
  type ExpiredAge,
  type ExpiryList,
  type ExpiryPack,
  type ExpiryStatus,
  type GroupRow,
  type NearExpiryDays,
} from "@/lib/expiry";
import { formatNumber } from "@/lib/formatNumber";
import { formatThaiIsoDate } from "@/lib/monthlyView";

/** Status colours (fixed status palette): critical for expired, warning
 * for due soon. Always shown with an icon and words, never colour alone. */
const STATUS_COLOR: Record<ExpiryStatus, string> = { expired: "#d03b3b", soon: "#fab219" };
const TODAY_COLOR = "#ec835a";
const STATUS_LABEL: Record<ExpiryStatus, string> = { expired: "หมดอายุแล้ว", soon: "ใกล้หมดอายุ" };
const STATUSES: ExpiryStatus[] = ["expired", "soon"];
const AGE_LABEL: Record<ExpiredAge, string> = { 0: "ทั้งหมด", 30: "ไม่เกิน 30 วัน", 90: "ไม่เกิน 90 วัน", 365: "ไม่เกิน 1 ปี" };
const ALL_PLACES = "all";
/** Places shown before "ดูทุกที่". */
const PLACES_SHOWN = 12;

const count = (n: number) => formatNumber(n);
const money = (n: number) => formatNumber(n, { decimals: 2 });

/**
 * "หมดอายุ/ใกล้หมดอายุ" — where the packs that have expired, or are about
 * to, are right now: the central store or the department they went to.
 * Packs not back at CSSD only (lib/expiry.ts has the hospital's rule).
 */
export default function ExpiryView() {
  const [list, setList] = useState<ExpiryList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [within, setWithin] = useState<NearExpiryDays>(DEFAULT_NEAR_EXPIRY);
  const [show, setShow] = useState<ExpiryStatus[]>(STATUSES);
  const [maxAge, setMaxAge] = useState<ExpiredAge>(0);
  const [place, setPlace] = useState<string>(ALL_PLACES);

  useEffect(() => {
    fetchExpiry()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const today = list?.asOf ?? "";
  // Expired longer ago than asked for are left out everywhere.
  const packs = useMemo(
    () =>
      (list?.packs ?? []).filter((p) => {
        const d = daysLeft(p.expiryDate, today);
        return d >= 0 || !maxAge || -d <= maxAge;
      }),
    [list, today, maxAge]
  );
  const here = useMemo(() => (place === ALL_PLACES ? packs : packs.filter((p) => p.location === place)), [packs, place]);
  const summary = useMemo(() => summarize(here, today, within), [here, today, within]);
  const places = useMemo(() => groupBy(packs, (p) => p.location, today, within, show), [packs, today, within, show]);

  const placeOptions = useMemo(
    () => [
      { value: ALL_PLACES, label: "ทุกที่" },
      ...places.map((r) => ({ value: r.name, label: r.name })),
      ...(place !== ALL_PLACES && !places.some((r) => r.name === place) ? [{ value: place, label: place }] : []),
    ],
    [places, place]
  );

  const toggle = (s: ExpiryStatus) =>
    setShow((cur) => (cur.includes(s) ? (cur.length > 1 ? cur.filter((x) => x !== s) : cur) : STATUSES.filter((x) => x === s || cur.includes(x))));

  if (error) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm rounded-xl border px-4 py-6 text-red-600 bg-red-50 border-red-100">
        <AlertCircle size={16} className="shrink-0" />
        {error}
      </div>
    );
  }
  if (!list) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm rounded-xl border px-4 py-6 text-gray-500 bg-white border-gray-200">
        <Loader2 size={16} className="animate-spin" />
        กำลังดึงรายการที่หมดอายุ / ใกล้หมดอายุ...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <CalendarClock size={16} className="text-blue-600" />
            หมดอายุ / ใกล้หมดอายุ · ข้อมูล ณ {formatThaiIsoDate(today)}
          </h2>
          <div className="sm:ml-auto">
            <SearchableSelect
              icon={MapPin}
              value={place}
              onChange={setPlace}
              searchPlaceholder="ค้นหาหน่วยงาน..."
              options={placeOptions}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <div className="flex flex-wrap gap-2" role="group" aria-label="สถานะที่แสดง">
            {STATUSES.map((s) => {
              const on = show.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(s)}
                  title={on && show.length === 1 ? "ต้องเปิดไว้อย่างน้อย 1 สถานะ" : undefined}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border transition-colors ${
                    on
                      ? "bg-blue-50 border-blue-300 text-gray-900 font-medium"
                      : "bg-white border-gray-200 text-gray-500 hover:border-blue-300 hover:text-gray-900"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full border"
                    style={on ? { background: STATUS_COLOR[s], borderColor: STATUS_COLOR[s] } : { borderColor: "#d1d5db" }}
                  />
                  {STATUS_LABEL[s]}
                </button>
              );
            })}
          </div>
          <Segmented
            label="ใกล้หมดอายุ = ภายใน"
            value={String(within)}
            options={NEAR_EXPIRY_CHOICES.map((d) => [String(d), `${d} วัน`] as const)}
            onChange={(v) => setWithin(Number(v) as NearExpiryDays)}
          />
          <Segmented
            label="หมดอายุมาแล้ว"
            value={String(maxAge)}
            options={EXPIRED_AGE_CHOICES.map((d) => [String(d), AGE_LABEL[d]] as const)}
            onChange={(v) => setMaxAge(Number(v) as ExpiredAge)}
          />
        </div>
        {place !== ALL_PLACES && (
          <p className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            แสดงเฉพาะ <span className="font-semibold text-gray-800">{place}</span>
            <button
              type="button"
              onClick={() => setPlace(ALL_PLACES)}
              className="flex items-center gap-1 text-gray-500 px-2 py-0.5 rounded-md border border-gray-200 hover:bg-gray-50 hover:text-gray-700"
            >
              <X size={12} /> ดูทุกที่
            </button>
          </p>
        )}
      </div>

      {/* Totals */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatusCard
          icon={<AlertOctagon size={16} style={{ color: STATUS_COLOR.expired }} />}
          title="หมดอายุแล้ว"
          tally={summary.expired}
          note={
            summary.expired.count
              ? `หมดมาไม่เกิน 30 วัน ${count(summary.expired.byAge[0])} · 31–90 วัน ${count(summary.expired.byAge[1])} · เกิน 90 วัน ${count(summary.expired.byAge[2])}`
              : "ไม่มีรายการที่หมดอายุ"
          }
        />
        <StatusCard
          icon={<Clock size={16} style={{ color: STATUS_COLOR.soon }} />}
          title={`ใกล้หมดอายุ (วันนี้–${within} วัน)`}
          tally={summary.soon}
          note={
            summary.soon.today
              ? `รวมที่ครบวันหมดอายุวันนี้ ${count(summary.soon.today)}`
              : `หมดอายุภายใน ${within} วันข้างหน้า`
          }
        />
        <PlaceCountCard rows={places} />
      </div>

      <PlaceGrid rows={places} selected={place} onSelect={(n) => setPlace((cur) => (cur === n ? ALL_PLACES : n))} />

      <PackList packs={here} today={today} within={within} show={show} />

      <p className="text-xs text-gray-400">
        นับเฉพาะของที่ยังไม่ส่งคืน CSSD · ยังไม่ได้จ่ายออก = อยู่{CENTRAL_STORE} · จ่ายแล้ว = อยู่ที่หน่วยงานที่จ่ายให้ ·
        ราคาเป็นราคาปัจจุบันของเซต
      </p>
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-gray-500">{label}</span>
      <div className="inline-flex gap-1 p-1 bg-gray-100 rounded-lg" role="radiogroup" aria-label={label}>
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
    </div>
  );
}

function StatusCard({ icon, title, tally, note }: { icon: ReactNode; title: string; tally: { count: number; value: number }; note: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-gray-600">
        {icon}
        {title}
      </p>
      <p className="mt-2 text-2xl font-bold text-gray-900">
        {count(tally.count)}
      </p>
      <p className="text-sm text-gray-600">{money(tally.value)} บาท</p>
      <p className="mt-2 text-xs text-gray-500">{note}</p>
    </div>
  );
}

/** How many places hold something expired or due soon, and which holds
 * the most — the cards below add up to this. */
function PlaceCountCard({ rows }: { rows: GroupRow[] }) {
  const top = rows[0];
  const departments = rows.filter((r) => r.name !== CENTRAL_STORE).length;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-gray-600">
        <MapPin size={16} className="text-blue-600" />
        อยู่ใน
      </p>
      <p className="mt-2 text-2xl font-bold text-gray-900">
        {count(rows.length)} <span className="text-sm font-medium text-gray-500">ที่</span>
      </p>
      <p className="text-sm text-gray-600 truncate">
        {top ? `มากสุด: ${top.name} (${count(top.expired + top.soon)})` : "ไม่มีที่ไหนมีของหมดอายุ"}
      </p>
      <p className="mt-2 text-xs text-gray-500">
        {rows.some((r) => r.name === CENTRAL_STORE) ? `${CENTRAL_STORE} และ ${count(departments)} หน่วยงาน` : `${count(departments)} หน่วยงาน`}
      </p>
    </div>
  );
}

/** One card per place, most packs first: how many have expired there and
 * how many are about to. Clicking one shows only that place. */
function PlaceGrid({ rows, selected, onSelect }: { rows: GroupRow[]; selected: string; onSelect: (name: string) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, PLACES_SHOWN);
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
      <ReportSectionHeader title="อยู่ที่ไหน" icon={MapPin} />
      <div className="p-4 space-y-3">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">ไม่มีรายการที่หมดอายุหรือใกล้หมดอายุ</p>
        ) : (
          <>
            <p className="text-xs text-gray-500">คลิกที่ใดที่หนึ่งเพื่อดูรายการของที่นั่น คลิกซ้ำเพื่อดูทุกที่</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {shown.map((r) => {
                const on = selected === r.name;
                const Icon = r.name === CENTRAL_STORE ? Warehouse : MapPin;
                return (
                  <button
                    key={r.name}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onSelect(r.name)}
                    className={`text-left rounded-xl border p-3 transition-colors ${
                      on ? "border-blue-400 bg-blue-50 ring-2 ring-blue-200" : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40"
                    }`}
                  >
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                      <Icon size={14} className="text-gray-400 shrink-0" />
                      <span className="truncate">{r.name}</span>
                      <span className="ml-auto text-xs font-medium text-gray-500 tabular-nums whitespace-nowrap">
                        รวม {count(r.expired + r.soon)}
                      </span>
                    </p>
                    <p className="mt-2 flex flex-wrap gap-1.5 text-xs">
                      <StatusPill status="expired" n={r.expired} />
                      <StatusPill status="soon" n={r.soon} />
                    </p>
                  </button>
                );
              })}
            </div>
            {rows.length > PLACES_SHOWN && (
              <button type="button" onClick={() => setAll((v) => !v)} className="text-sm font-medium text-blue-700 hover:underline">
                {all ? "แสดงน้อยลง" : `ดูทุกที่ (${count(rows.length)} ที่)`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Tinted background per status, so expired and due-soon stand out (with
 * the icon and words, never the colour alone). */
const PILL_CLASS: Record<ExpiryStatus, string> = {
  expired: "bg-red-50 border-red-200 text-red-800",
  soon: "bg-amber-50 border-amber-200 text-amber-900",
};
const STATUS_ICON: Record<ExpiryStatus, typeof Clock> = { expired: AlertOctagon, soon: Clock };

/** "หมดอายุแล้ว 288" on a place's card; grey when there are none. */
function StatusPill({ status, n }: { status: ExpiryStatus; n: number }) {
  const Icon = STATUS_ICON[status];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 ${
        n ? PILL_CLASS[status] : "bg-gray-50 border-gray-200 text-gray-400"
      }`}
    >
      <Icon size={12} style={n ? { color: STATUS_COLOR[status] } : undefined} />
      {STATUS_LABEL[status]} <span className="font-semibold tabular-nums">{count(n)}</span>
    </span>
  );
}

function StatusBadge({ days, within }: { days: number; within: number }) {
  const status = expiryStatus(days, within);
  if (!status) return null;
  const Icon = STATUS_ICON[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${PILL_CLASS[status]}`}
    >
      <Icon size={13} style={{ color: days === 0 ? TODAY_COLOR : STATUS_COLOR[status] }} />
      {daysText(days)}
    </span>
  );
}

const dash = <span className="text-gray-300">—</span>;

function PackList({
  packs,
  today,
  within,
  show,
}: {
  packs: ExpiryPack[];
  today: string;
  within: number;
  show: ExpiryStatus[];
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(20);

  const q = search.trim().toLowerCase();
  const list = useMemo(
    () =>
      packs.filter((p) => {
        const status = expiryStatus(daysLeft(p.expiryDate, today), within);
        if (!status || !show.includes(status)) return false;
        return !q || p.itemName.toLowerCase().includes(q) || !!p.barcode?.includes(q);
      }),
    [packs, today, within, show, q]
  );
  const totalPages = Math.max(1, Math.ceil(list.length / perPage));
  const current = Math.min(page, totalPages);
  const from = (current - 1) * perPage;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
      <ReportSectionHeader title="รายการที่หมดอายุ / ใกล้หมดอายุ" icon={TableProperties} />
      <div className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex-1 min-w-[12rem] max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="ค้นหารายการ หรือบาร์โค้ด..."
              className="w-full text-sm pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
            />
          </label>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs">
              <tr className="text-gray-600">
                <th className="px-3 py-2 text-left font-semibold">สถานะ</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">วันหมดอายุ</th>
                <th className="px-3 py-2 text-left font-semibold">รายการ</th>
                <th className="px-3 py-2 text-left font-semibold">บาร์โค้ด</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">อยู่ที่</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">จ่ายไปเมื่อ</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">วันที่แพ็ค</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(from, from + perPage).map((p) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    <StatusBadge days={daysLeft(p.expiryDate, today)} within={within} />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-700">{formatThaiIsoDate(p.expiryDate)}</td>
                  <td className="px-3 py-2 text-gray-900">{p.itemName}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600">{p.barcode ?? dash}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-700">{p.location}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">{p.supplyDate ? formatThaiIsoDate(p.supplyDate) : dash}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">{formatThaiIsoDate(p.packDate)}</td>
                </tr>
              ))}
              {list.length === 0 && <EmptyRow span={7} />}
            </tbody>
          </table>
        </div>
      </div>
      <TablePagination
        page={current}
        perPage={perPage}
        totalItems={list.length}
        unitLabel="รายการ"
        onPageChange={setPage}
        onPerPageChange={setPerPage}
      />
    </div>
  );
}

function EmptyRow({ span }: { span: number }) {
  return (
    <tr>
      <td colSpan={span} className="px-3 py-6 text-center text-gray-400">
        ไม่พบรายการที่หมดอายุหรือใกล้หมดอายุ
      </td>
    </tr>
  );
}
