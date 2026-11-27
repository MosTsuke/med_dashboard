import type { ExpiryList } from "@/lib/expiry";
import type { DbPeriod, DbReportKind } from "@/types";

/**
 * The data inside an exported HTML file ("ส่งออก HTML"): every event of the
 * four database reports in the chosen range — one dispense, pack, wash or
 * resterile each — with what the reports and record lists show about it.
 * The file builds every report and record list from these, with the same
 * code the server uses, so it shows what the live dashboard showed.
 *
 * Pure code: used by the server (encode) and the browser (decode).
 */

/** One event, as read from the database (or the demo data). */
export interface ExportRow {
  id: number;
  /** Wall-clock time as a UTC Date (see lib/db/client.ts useUTC). */
  at: Date;
  setId: number | null;
  /** SetTbName2, else SetTbName1 — what the reports call the item. */
  setName: string | null;
  /** SetTbName1, which the record search also looks in. */
  setCode: string | null;
  /** The set's current price; null once the set is deleted. */
  setPrice: number | null;
  /** The price stamped on the pack; null without a pack. */
  packPrice: number | null;
  barcode: string | null;
  qty: number;
  expiry: Date | null;
  department: string | null;
  person: string | null;
  note: string | null;
}

/** One report's events, column by column (smaller, and packs well). Rows
 * are in time order; `id` and `at` are stored as the change from the row
 * before. */
export interface EventColumns {
  id: number[];
  /** Whole seconds (wall clock), rounded down so an event never moves
   * into the next day. */
  at: number[];
  /** Index into `sets`. */
  set: number[];
  /** Index into `text`; -1 = none. */
  dept: number[];
  qty: number[];
  barcode: (string | null)[];
  /** Days since 1970-01-01; null = none. */
  expiry: (number | null)[];
  person: number[];
  note: number[];
  packPrice: (number | null)[];
}

export interface ExportPayload {
  version: 1;
  /** Wall clock on the server when exported, "YYYY-MM-DD HH:mm". */
  exportedAt: string;
  /** The range exported, CE "YYYY-MM-DD", both inclusive. */
  from: string;
  to: string;
  demo: boolean;
  /** [setId, name, code, price] */
  sets: [number | null, string | null, string | null, number | null][];
  text: string[];
  events: Record<DbReportKind, EventColumns>;
  /** หมดอายุ/ใกล้หมดอายุ as of the export (whatever the range). */
  expiry?: ExpiryList;
}

/** What the HTML file carries: the payload plus where it came from and
 * what to open on. */
export interface OfflineFile extends ExportPayload {
  /** Address of the dashboard it was exported from (for รายงานเพิ่มเติม). */
  origin: string;
  start: { report: DbReportKind; period: DbPeriod };
  /** The hospital's name and logo (a data: URL) at the time. */
  branding?: { hospitalName: string | null; logoDataUrl: string | null };
}

const SECOND = 1_000;
const DAY = 86_400_000;

export function encodeExport(
  rows: Record<DbReportKind, ExportRow[]>,
  meta: Pick<ExportPayload, "exportedAt" | "from" | "to" | "demo">
): ExportPayload {
  const sets: ExportPayload["sets"] = [];
  const setIndex = new Map<string, number>();
  const text: string[] = [];
  const textIndex = new Map<string, number>();
  const textOf = (s: string | null) => {
    if (s == null) return -1;
    let i = textIndex.get(s);
    if (i === undefined) {
      i = text.push(s) - 1;
      textIndex.set(s, i);
    }
    return i;
  };
  const setOf = (r: ExportRow) => {
    const key = JSON.stringify([r.setId, r.setName, r.setCode, r.setPrice]);
    let i = setIndex.get(key);
    if (i === undefined) {
      i = sets.push([r.setId, r.setName, r.setCode, r.setPrice == null ? null : Number(r.setPrice)]) - 1;
      setIndex.set(key, i);
    }
    return i;
  };

  const encode = (list: ExportRow[]): EventColumns => {
    const sorted = [...list].sort((a, b) => a.at.getTime() - b.at.getTime() || a.id - b.id);
    const c: EventColumns = { id: [], at: [], set: [], dept: [], qty: [], barcode: [], expiry: [], person: [], note: [], packPrice: [] };
    let prevId = 0;
    let prevAt = 0;
    for (const r of sorted) {
      const at = Math.floor(r.at.getTime() / SECOND);
      c.id.push(r.id - prevId);
      c.at.push(at - prevAt);
      prevId = r.id;
      prevAt = at;
      c.set.push(setOf(r));
      c.dept.push(textOf(r.department));
      c.qty.push(Number(r.qty));
      c.barcode.push(r.barcode);
      c.expiry.push(r.expiry ? Math.round(r.expiry.getTime() / DAY) : null);
      c.person.push(textOf(r.person));
      c.note.push(textOf(r.note));
      c.packPrice.push(r.packPrice == null ? null : Number(r.packPrice));
    }
    return c;
  };

  return {
    version: 1,
    ...meta,
    sets,
    text,
    events: {
      supply: encode(rows.supply),
      pack: encode(rows.pack),
      wash: encode(rows.wash),
      resterile: encode(rows.resterile),
    },
  };
}

export function decodeEvents(payload: ExportPayload, kind: DbReportKind): ExportRow[] {
  const c = payload.events[kind];
  const str = (i: number) => (i < 0 ? null : payload.text[i]);
  const rows: ExportRow[] = new Array(c.id.length);
  let id = 0;
  let at = 0;
  for (let i = 0; i < c.id.length; i++) {
    id += c.id[i];
    at += c.at[i];
    const [setId, setName, setCode, setPrice] = payload.sets[c.set[i]];
    const expiry = c.expiry[i];
    rows[i] = {
      id,
      at: new Date(at * SECOND),
      setId,
      setName,
      setCode,
      setPrice,
      packPrice: c.packPrice[i],
      barcode: c.barcode[i],
      qty: c.qty[i],
      expiry: expiry == null ? null : new Date(expiry * DAY),
      department: str(c.dept[i]),
      person: str(c.person[i]),
      note: str(c.note[i]),
    };
  }
  return rows;
}

/** Longest range one export may cover — about three fiscal years. */
export const MAX_EXPORT_DAYS = 1096;
