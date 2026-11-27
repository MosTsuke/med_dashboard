import { formatDate } from "@/lib/supply/shape";

/**
 * "หมดอายุ/ใกล้หมดอายุ": packs not yet back at CSSD whose expiry date has
 * passed or is coming up, and where they are. Pure helpers, shared by the
 * server, the page and exported HTML files.
 *
 * From the hospital (2026-11): a pack is still out there while
 * PackTb.ReturnTbNo = 0. PackTb.SupplyTbNo = 0 means it hasn't been
 * dispensed — it's in the central store (คลังกลาง); otherwise it is the
 * SupplyTb row (SupplyNo) that dispensed it, whose DepartTbId says which
 * department has it. Expiry = PackTb.SetTbExpireDate.
 */

export interface ExpiryPack {
  id: number;
  barcode: string | null;
  itemName: string;
  /** Where the pack is: CENTRAL_STORE, or the department it went to. */
  location: string;
  /** CE "YYYY-MM-DD". */
  packDate: string;
  expiryDate: string;
  /** When it was dispensed to `location`; null while in the central store. */
  supplyDate: string | null;
  /** Sterilization method. */
  method: string | null;
  /** บาท — the set's price. */
  price: number;
}

/** The list as of one day: every pack expired, or due within
 * MAX_NEAR_EXPIRY days of `asOf`. */
export interface ExpiryList {
  /** CE "YYYY-MM-DD" — "today" for this list. */
  asOf: string;
  packs: ExpiryPack[];
}

export const CENTRAL_STORE = "คลังกลาง";
/** Dispensed, but the dispense record isn't there (any more). */
export const UNKNOWN_PLACE = "(ไม่พบข้อมูลการจ่าย)";

/** Choices for "ใกล้หมดอายุภายใน … วัน". */
export const NEAR_EXPIRY_CHOICES = [3, 7, 14, 30] as const;
export type NearExpiryDays = (typeof NEAR_EXPIRY_CHOICES)[number];
export const DEFAULT_NEAR_EXPIRY: NearExpiryDays = 7;
export const MAX_NEAR_EXPIRY = 30;

/** Choices for how long ago an expired pack's date passed: everything, or
 * within N days (old leftovers can swamp the recent ones). */
export const EXPIRED_AGE_CHOICES = [0, 30, 90, 365] as const;
export type ExpiredAge = (typeof EXPIRED_AGE_CHOICES)[number];

export type ExpiryStatus = "expired" | "soon";

const DAY = 86_400_000;

/** Days from `today` to the expiry date (both CE "YYYY-MM-DD"): negative
 * once it has passed, 0 on the day itself. */
export function daysLeft(expiryDate: string, today: string): number {
  return Math.round((Date.parse(expiryDate) - Date.parse(today)) / DAY);
}

/** "expired" once the expiry date has passed (and, with `maxAge`, not
 * longer ago than that); "soon" from the day itself up to `within` days
 * ahead; null otherwise. */
export function expiryStatus(days: number, within: number, maxAge: ExpiredAge = 0): ExpiryStatus | null {
  if (days < 0) return !maxAge || -days <= maxAge ? "expired" : null;
  return days <= within ? "soon" : null;
}

/** "หมดอายุแล้ว 5 วัน", "หมดอายุวันนี้", "เหลือ 3 วัน". */
export function daysText(days: number): string {
  if (days < 0) return `หมดอายุแล้ว ${-days} วัน`;
  if (days === 0) return "หมดอายุวันนี้";
  return `เหลือ ${days} วัน`;
}

export interface Tally {
  count: number;
  value: number;
}
const tally = (): Tally => ({ count: 0, value: 0 });

export interface ExpirySummary {
  /** Expired, any time ago (whatever `maxAge` says). */
  expired: Tally & {
    /** How long ago: within 30 days, 31–90, more than 90. */
    byAge: [number, number, number];
  };
  /** Due from today up to `within` days ahead — the same packs the
   * places' "ใกล้หมดอายุ" counts add up to. */
  soon: Tally & {
    /** Of which due today. */
    today: number;
  };
}

export function summarize(packs: ExpiryPack[], today: string, within: number): ExpirySummary {
  const s: ExpirySummary = { expired: { ...tally(), byAge: [0, 0, 0] }, soon: { ...tally(), today: 0 } };
  for (const p of packs) {
    const d = daysLeft(p.expiryDate, today);
    const t = d < 0 ? s.expired : d <= within ? s.soon : null;
    if (!t) continue;
    t.count++;
    t.value += p.price;
    if (d < 0) s.expired.byAge[-d <= 30 ? 0 : -d <= 90 ? 1 : 2]++;
    else if (d === 0) s.soon.today++;
  }
  return s;
}

export interface GroupRow {
  name: string;
  expired: number;
  soon: number;
  /** Earliest expiry date in the group. */
  first: string;
}

/** Packs per place or per item, expired and soon (each only if `show` has
 * it), most first. */
export function groupBy(
  packs: ExpiryPack[],
  key: (p: ExpiryPack) => string,
  today: string,
  within: number,
  show: ExpiryStatus[],
  maxAge: ExpiredAge = 0
): GroupRow[] {
  const rows = new Map<string, GroupRow>();
  for (const p of packs) {
    const status = expiryStatus(daysLeft(p.expiryDate, today), within, maxAge);
    if (!status || !show.includes(status)) continue;
    const name = key(p);
    let row = rows.get(name);
    if (!row) rows.set(name, (row = { name, expired: 0, soon: 0, first: p.expiryDate }));
    row[status]++;
    if (p.expiryDate < row.first) row.first = p.expiryDate;
  }
  return Array.from(rows.values()).sort(
    (a, b) => b.expired + b.soon - (a.expired + a.soon) || a.name.localeCompare(b.name, "th")
  );
}

// ── Demo data ────────────────────────────────────────────────────────────

/** mulberry32 — tiny deterministic PRNG, so the demo is the same every time. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generic CSSD set names — nothing from any hospital. */
const DEMO_SETS: { name: string; price: number; shelf: number; method: string }[] = [
  { name: "Set Dressing", price: 120, shelf: 180, method: "STEAM AUTOCLAVE" },
  { name: "Set Flush", price: 60, shelf: 180, method: "STEAM AUTOCLAVE" },
  { name: "ชุดทำแผล", price: 80, shelf: 180, method: "STEAM AUTOCLAVE" },
  { name: "ชุดเย็บแผล", price: 150, shelf: 180, method: "STEAM AUTOCLAVE" },
  { name: "ชุดคลอด", price: 300, shelf: 180, method: "STEAM AUTOCLAVE" },
  { name: "ชุดตรวจฟัน", price: 100, shelf: 14, method: "STEAM AUTOCLAVE" },
  { name: "ชุดถอนฟัน", price: 120, shelf: 14, method: "STEAM AUTOCLAVE" },
  { name: "ชุดสวนปัสสาวะ", price: 90, shelf: 180, method: "STEAM AUTOCLAVE" },
  { name: "ชุดเจาะไขสันหลัง", price: 200, shelf: 180, method: "HYDROGEN PLASMA" },
  { name: "ชุดผ่าตัดเล็ก", price: 350, shelf: 180, method: "STEAM AUTOCLAVE" },
  { name: "ชุดใส่ท่อช่วยหายใจ", price: 250, shelf: 180, method: "ETHYLENE OXIDE" },
  { name: "Ambu ผู้ใหญ่", price: 250, shelf: 180, method: "ETHYLENE OXIDE" },
  { name: "Speculum", price: 40, shelf: 14, method: "STEAM AUTOCLAVE" },
  { name: "ชุดตรวจภายใน", price: 90, shelf: 180, method: "STEAM AUTOCLAVE" },
  { name: "ชุดล้างตา", price: 60, shelf: 180, method: "STEAM AUTOCLAVE" },
  { name: "ชุดเปลี่ยนสายสวน", price: 70, shelf: 180, method: "STEAM AUTOCLAVE" },
];
const DEMO_DEPARTMENTS = ["ER", "OPD", "IPD ชาย", "IPD หญิง", "LR", "ทันตกรรม", "ห้องผ่าตัด", "รพ.สต. 1", "รพ.สต. 2"];

/** Made-up packs for the demo site: about a quarter already expired (more
 * of them recently), the rest due within 30 days; four in ten still in the
 * central store. Dated around `today` (CE "YYYY-MM-DD"). */
export function demoExpiryPacks(today: string): ExpiryPack[] {
  const rand = prng(20261127);
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
  const start = Date.parse(today);
  const packs: ExpiryPack[] = [];
  for (let i = 0; i < 160; i++) {
    const expired = rand() < 0.25;
    const offset = expired ? -1 - Math.floor(rand() ** 2 * 30) : Math.floor(rand() * (MAX_NEAR_EXPIRY + 1));
    const set = pick(DEMO_SETS);
    const expiry = start + offset * DAY;
    const packed = expiry - set.shelf * DAY;
    const inStore = rand() < 0.4;
    const supplied = packed + Math.floor(rand() * Math.min(set.shelf - 1, 20) + 1) * DAY;
    packs.push({
      id: i + 1,
      barcode: String(6_900_000_000 + Math.floor(rand() * 99_999_999)),
      itemName: set.name,
      location: inStore ? CENTRAL_STORE : pick(DEMO_DEPARTMENTS),
      packDate: formatDate(new Date(packed)),
      expiryDate: formatDate(new Date(expiry)),
      supplyDate: inStore ? null : formatDate(new Date(supplied)),
      method: set.method,
      price: set.price,
    });
  }
  return packs.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.id - b.id);
}
