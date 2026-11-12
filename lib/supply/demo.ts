import {
  UNKNOWN_DEPARTMENT,
  bucketKey,
  dataRangeFrom,
  buildReport,
  formatDate,
  formatDateTime,
  periodRange,
  rangeForFiscalYear,
  type AggregateRow,
  type DataRange,
  type RecordsQuery,
} from "@/lib/supply/shape";
import type { DashboardData, DbPeriod, DbReportKind, ReportRecord, ReportRecordsPage } from "@/types";

/**
 * Built-in MADE-UP data for the database reports (สถิติจ่าย, สถิติแพ็ค,
 * Resterile) for online demos (e.g. the Vercel deployment), so every
 * DB-backed screen works without a database.
 *
 * Nothing here comes from any hospital: set names are generic CSSD terms,
 * departments and staff are placeholders, and the numbers come from a
 * seeded random generator (same output on every run). It mimics the real
 * data's shape: barcoded packs dispensed one per row with an expiry date,
 * consumables dispensed in batches without one, fewer dispenses at
 * weekends, and a handful of packs dispensed after their expiry date.
 * Every dispensed pack was packed first; a few percent more packs are made
 * but never go out, and come back for resterile — mostly once expired.
 */

export const DEMO_FISCAL_YEARS = [2569, 2568];

const DEPARTMENTS = [
  "ER", "OPD", "IPD ชาย", "IPD หญิง", "LR", "ทันตกรรม", "LAB",
  "ห้องผ่าตัด", "ห้องฉีดยา", "แพทย์แผนไทย", "รพ.สต. 1", "รพ.สต. 2",
];
const STAFF = ["เจ้าหน้าที่ 2", "เจ้าหน้าที่ 3", "เจ้าหน้าที่ 4", "เจ้าหน้าที่ 5", "เจ้าหน้าที่ 6"];

interface DemoSet {
  id: number;
  name: string;
  price: number;
  /** Shelf life in days; 0 = consumable (no pack, no expiry). */
  shelf: number;
  /** Mean dispense rows per weekday. */
  perDay: number;
  /** Where it mostly goes (index into DEPARTMENTS). */
  home: number[];
  /** Consumables: pieces per row, picked at random. */
  batch?: number[];
}

const SETS: DemoSet[] = [
  { id: 1, name: "Set Dressing", price: 120, shelf: 180, perDay: 9, home: [0, 1, 2, 3] },
  { id: 2, name: "Set Flush", price: 60, shelf: 180, perDay: 5, home: [2, 3] },
  { id: 3, name: "ชุดทำแผล", price: 80, shelf: 180, perDay: 6, home: [0, 8, 10, 11] },
  { id: 4, name: "ชุดเย็บแผล", price: 150, shelf: 180, perDay: 3, home: [0, 8] },
  { id: 5, name: "ชุดคลอด", price: 300, shelf: 180, perDay: 1.2, home: [4] },
  { id: 6, name: "ชุดตรวจฟัน", price: 100, shelf: 14, perDay: 7, home: [5, 10, 11] },
  { id: 7, name: "เครื่องมือทันตกรรม", price: 30, shelf: 7, perDay: 12, home: [5] },
  { id: 8, name: "ชุดถอนฟัน", price: 120, shelf: 14, perDay: 3, home: [5] },
  { id: 9, name: "ชุดสวนปัสสาวะ", price: 90, shelf: 180, perDay: 2.5, home: [2, 3, 4] },
  { id: 10, name: "ชุดเจาะไขสันหลัง", price: 200, shelf: 180, perDay: 0.3, home: [2, 3] },
  { id: 11, name: "Forceps", price: 30, shelf: 180, perDay: 2.5, home: [0, 1] },
  { id: 12, name: "กรรไกรตัดไหม", price: 30, shelf: 180, perDay: 2, home: [0, 1, 8] },
  { id: 13, name: "กรรไกรตัดเนื้อ", price: 40, shelf: 180, perDay: 1, home: [7] },
  { id: 14, name: "ชุดผ่าตัดเล็ก", price: 350, shelf: 180, perDay: 1.5, home: [7] },
  { id: 15, name: "ชุดใส่ท่อช่วยหายใจ", price: 250, shelf: 180, perDay: 0.4, home: [0] },
  { id: 16, name: "Ambu ผู้ใหญ่", price: 250, shelf: 180, perDay: 0.3, home: [0, 2, 3] },
  { id: 17, name: "Ambu เด็ก", price: 200, shelf: 180, perDay: 0.2, home: [0, 4] },
  { id: 18, name: "Speculum", price: 40, shelf: 14, perDay: 2, home: [1, 4] },
  { id: 19, name: "ชุดตรวจภายใน", price: 90, shelf: 180, perDay: 1.5, home: [1] },
  { id: 20, name: "ชุดล้างตา", price: 60, shelf: 180, perDay: 0.6, home: [0] },
  { id: 21, name: "ชุดพ่นยา", price: 50, shelf: 7, perDay: 3, home: [0, 2, 3] },
  { id: 22, name: "ถาดสแตนเลส", price: 20, shelf: 180, perDay: 1.5, home: [2, 3, 6] },
  { id: 23, name: "ชุดเปลี่ยนสายสวน", price: 70, shelf: 180, perDay: 1, home: [2, 3] },
  { id: 24, name: "ชุดฝังเข็ม", price: 80, shelf: 14, perDay: 1.5, home: [9] },
  { id: 5001, name: "สำลีก้อนเล็ก", price: 10, shelf: 0, perDay: 2.5, home: [0, 2, 3, 8], batch: [10, 10, 20, 20, 30, 50] },
  { id: 5002, name: "ผ้าก๊อซ 3x3", price: 10, shelf: 0, perDay: 2, home: [0, 2, 3, 10, 11], batch: [10, 10, 20, 30] },
  { id: 5003, name: "ผ้าก๊อซ 2x2", price: 8, shelf: 0, perDay: 1, home: [5, 8], batch: [10, 20, 25] },
  { id: 5004, name: "Top gauze 4x6", price: 12, shelf: 0, perDay: 0.8, home: [2, 3, 7], batch: [5, 10, 10, 20] },
  { id: 5005, name: "สำลีพันไม้", price: 5, shelf: 0, perDay: 0.7, home: [1, 6], batch: [20, 50, 50] },
  { id: 5006, name: "ไม้กดลิ้น", price: 3, shelf: 0, perDay: 0.4, home: [0, 1], batch: [10, 20] },
];

/** Sterilization method per set; anything not listed is steam. */
const STERILE: Record<number, string> = {
  10: "HYDROGEN PLASMA",
  15: "ETHYLENE OXIDE",
  16: "ETHYLENE OXIDE",
  17: "ETHYLENE OXIDE",
};
const sterileOf = (set: DemoSet) => STERILE[set.id] ?? "STEAM AUTOCLAVE";

/** Resterile reasons; the first (expired) is by far the most common. */
const CAUSES = ["หมดอายุ", "ความสะอาด", "เครื่องมือไม่ถูกต้อง", "หีบห่อมีปัญหา"];

/** One dispense, pack or resterile pack. */
interface DemoEvent {
  id: number;
  /** Wall-clock time as a UTC timestamp (same convention as the DB code);
   * midnight for packs, which only have a date. */
  at: number;
  set: DemoSet;
  dept: string;
  person: string;
  qty: number;
  barcode: number | null;
  expiry: number | null;
  /** Sterilization method (pack) or reason (resterile). */
  note: string | null;
}

const withIds = (events: Omit<DemoEvent, "id">[]): DemoEvent[] =>
  events.sort((a, b) => a.at - b.at).map((e, i) => ({ ...e, id: i + 1 }));

/** mulberry32 — tiny deterministic PRNG. */
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

const DAY = 86_400_000;

function generateSupply(): DemoEvent[] {
  const rand = prng(2568);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const poisson = (lambda: number) => {
    const limit = Math.exp(-lambda);
    let k = 0;
    let p = rand();
    while (p > limit) {
      k++;
      p *= rand();
    }
    return k;
  };

  const out: Omit<DemoEvent, "id">[] = [];
  let barcode = 100000;
  const first = rangeForFiscalYear(Math.min(...DEMO_FISCAL_YEARS)).from.getTime();
  const end = rangeForFiscalYear(Math.max(...DEMO_FISCAL_YEARS)).to.getTime();

  for (let day = first; day < end; day += DAY) {
    const d = new Date(day);
    const weekday = d.getUTCDay();
    const weekend = weekday === 0 || weekday === 6 ? 0.35 : 1;
    // Gentle seasonality + a little growth in the later year.
    const season = 1 + 0.12 * Math.sin(((d.getUTCMonth() + 1) / 12) * 2 * Math.PI);
    const growth = day >= rangeForFiscalYear(2569).from.getTime() ? 1.06 : 1;

    for (const set of SETS) {
      const n = poisson(set.perDay * weekend * season * growth);
      for (let i = 0; i < n; i++) {
        const at = day + (8 * 60 + Math.floor(rand() * 510)) * 60_000; // 08:00–16:30
        const dept = rand() < 0.85 ? DEPARTMENTS[pick(set.home)] : pick(DEPARTMENTS);
        if (set.shelf === 0) {
          out.push({ at, set, dept, person: pick(STAFF), qty: pick(set.batch!), barcode: null, expiry: null, note: null });
          continue;
        }
        // Packed 0–4 days earlier; ~1 in 300 short-shelf packs went out late.
        const late = set.shelf <= 14 && rand() < 1 / 300;
        const packedDaysAgo = late ? set.shelf + 1 + Math.floor(rand() * 3) : Math.floor(rand() * 5);
        const packDay = Math.floor(at / DAY) * DAY - packedDaysAgo * DAY;
        out.push({
          at,
          set,
          dept,
          person: pick(STAFF),
          qty: 1,
          barcode: barcode++,
          expiry: packDay + (set.shelf - 1) * DAY,
          note: null,
        });
      }
    }
  }

  return withIds(out);
}

/**
 * Packs and resterile, from their own random stream so the สถิติจ่าย demo
 * numbers stay exactly as they were: every barcoded pack dispensed was
 * packed on the day its expiry implies, plus ~3% more packs that never go
 * out and come back for resterile.
 */
function generatePacksAndResterile(supply: DemoEvent[]): { pack: DemoEvent[]; resterile: DemoEvent[] } {
  const rand = prng(2570);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const poisson = (lambda: number) => {
    const limit = Math.exp(-lambda);
    let k = 0;
    let p = rand();
    while (p > limit) {
      k++;
      p *= rand();
    }
    return k;
  };

  const packs: Omit<DemoEvent, "id">[] = [];
  const back: Omit<DemoEvent, "id">[] = [];

  for (const r of supply) {
    if (r.barcode == null || r.expiry == null) continue;
    packs.push({
      at: r.expiry - (r.set.shelf - 1) * DAY,
      set: r.set,
      dept: r.dept,
      person: pick(STAFF),
      qty: 1,
      barcode: r.barcode,
      expiry: r.expiry,
      note: sterileOf(r.set),
    });
  }

  let barcode = 900000;
  const first = rangeForFiscalYear(Math.min(...DEMO_FISCAL_YEARS)).from.getTime();
  const end = rangeForFiscalYear(Math.max(...DEMO_FISCAL_YEARS)).to.getTime();
  for (let day = first; day < end; day += DAY) {
    const weekday = new Date(day).getUTCDay();
    const weekend = weekday === 0 || weekday === 6 ? 0.35 : 1;
    for (const set of SETS) {
      if (set.shelf === 0) continue;
      const n = poisson(set.perDay * weekend * 0.03);
      for (let i = 0; i < n; i++) {
        const expiry = day + (set.shelf - 1) * DAY;
        const dept = rand() < 0.85 ? DEPARTMENTS[pick(set.home)] : pick(DEPARTMENTS);
        const pack = { at: day, set, dept, person: pick(STAFF), qty: 1, barcode: barcode++, expiry, note: sterileOf(set) };
        packs.push(pack);
        // Mostly sent back a day or three after expiring; now and then
        // earlier, for another reason.
        const expired = rand() < 0.92;
        const backDay = expired
          ? expiry + (1 + Math.floor(rand() * 3)) * DAY
          : day + (1 + Math.floor(rand() * Math.min(10, set.shelf - 1))) * DAY;
        back.push({
          at: backDay + (8 * 60 + Math.floor(rand() * 510)) * 60_000,
          set,
          dept,
          person: pick(STAFF),
          qty: 1,
          barcode: pack.barcode,
          expiry,
          note: expired ? CAUSES[0] : pick(CAUSES.slice(1)),
        });
      }
    }
  }
  return { pack: withIds(packs), resterile: withIds(back) };
}

let cache: Record<DbReportKind, DemoEvent[]> | null = null;
function events(kind: DbReportKind): DemoEvent[] {
  if (!cache) {
    const supply = generateSupply();
    cache = { supply, ...generatePacksAndResterile(supply) };
  }
  return cache[kind];
}

function inRange(e: DemoEvent, from: Date, to: Date) {
  return e.at >= from.getTime() && e.at < to.getTime();
}

/** First to last event, kept inside the demo fiscal years (a few packs are
 * made just before them, and a few come back just after). */
export function getDemoDataRange(kind: DbReportKind): DataRange {
  const all = events(kind);
  if (!all.length) return dataRangeFrom(null, null);
  const start = rangeForFiscalYear(Math.min(...DEMO_FISCAL_YEARS)).from.getTime();
  const end = rangeForFiscalYear(Math.max(...DEMO_FISCAL_YEARS)).to.getTime() - 1;
  return dataRangeFrom(
    new Date(Math.max(all[0].at, start)),
    new Date(Math.min(all[all.length - 1].at, end))
  );
}

export function getDemoReport(kind: DbReportKind, period: DbPeriod): DashboardData {
  const { from, to } = periodRange(period);
  const groups = new Map<string, AggregateRow>();
  for (const r of events(kind)) {
    if (!inRange(r, from, to)) continue;
    const bucket = new Date(r.at);
    const key = `${r.set.id}|${r.dept}|${bucketKey(bucket, period.grain)}`;
    const g = groups.get(key);
    if (g) g.qty += r.qty;
    else
      groups.set(key, {
        setId: r.set.id,
        setName: r.set.name,
        setPrice: r.set.price,
        packPrice: r.barcode != null ? r.set.price : null,
        department: r.dept,
        bucket,
        qty: r.qty,
      });
  }
  return buildReport(kind, period, Array.from(groups.values()), { demo: true });
}

export function getDemoRecords(kind: DbReportKind, q: RecordsQuery): ReportRecordsPage {
  const { from, to } = q;
  const search = q.search?.trim().toLowerCase();
  // Every demo row has a department, so the "unknown" filter matches nothing.
  const deptOk = (r: DemoEvent) =>
    !q.department || (q.department !== UNKNOWN_DEPARTMENT && r.dept === q.department);
  const searchOk = (r: DemoEvent) =>
    !search ||
    r.set.name.toLowerCase().includes(search) ||
    (r.barcode != null && String(r.barcode).includes(search));
  const matches = events(kind)
    .filter((r) => inRange(r, from, to) && deptOk(r) && searchOk(r))
    .sort((a, b) => b.at - a.at || b.id - a.id);

  const page = matches.slice((q.page - 1) * q.pageSize, q.page * q.pageSize);
  const formatAt = kind === "pack" ? formatDate : formatDateTime;
  const out: ReportRecord[] = page.map((r) => ({
    id: r.id,
    date: formatAt(new Date(r.at)),
    itemName: r.set.name,
    barcode: r.barcode != null ? String(r.barcode) : null,
    quantity: r.qty,
    expiryDate: r.expiry != null ? formatDate(new Date(r.expiry)) : null,
    department: r.dept,
    person: r.person,
    note: r.note,
  }));
  return { rows: out, total: matches.length };
}
