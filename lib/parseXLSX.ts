import zlib from "zlib";
import {
  extractEmbeddedLogo,
  logoUrlFromMeta,
} from "@/lib/logoFromXlsx";
import type { DashboardData, DepartmentData, ItemData } from "@/types";

/**
 * Minimal dependency-free .xlsx reader.
 * An .xlsx file is a ZIP archive of XML parts. We read the ZIP central
 * directory, inflate the needed entries, and parse the worksheet cells.
 * Supports shared strings (t="s"), inline strings (t="inlineStr") and numbers.
 */

// ---------- ZIP ----------
function unzip(buf: Buffer): Record<string, Buffer> {
  // Locate End Of Central Directory record
  let i = buf.length - 22;
  for (; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) break;
  }
  if (i < 0) throw new Error("Invalid xlsx: EOCD not found");

  const count = buf.readUInt16LE(i + 10);
  let off = buf.readUInt32LE(i + 16);
  const files: Record<string, Buffer> = {};

  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);

    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const comp = buf.subarray(dataStart, dataStart + compSize);

    files[name] = method === 0 ? comp : zlib.inflateRawSync(comp);
    off += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

// ---------- XML helpers ----------
function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseSharedStrings(xml?: Buffer): string[] {
  if (!xml) return [];
  const out: string[] = [];
  const text = xml.toString("utf8");
  // each <si> ... </si> may contain one or more <t> runs
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(text))) {
    const runs = m[1].match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
    const value = runs
      .map((r) => decodeEntities(r.replace(/<t[^>]*>/, "").replace(/<\/t>/, "")))
      .join("");
    out.push(value);
  }
  return out;
}

function colToIndex(ref: string): number {
  const letters = ref.replace(/[0-9]/g, "");
  let n = 0;
  for (let i = 0; i < letters.length; i++) {
    n = n * 26 + (letters.charCodeAt(i) - 64);
  }
  return n - 1; // 0-based
}

type Grid = (string | number | null)[][];

function parseSheet(xml: Buffer, shared: string[]): Grid {
  const text = xml.toString("utf8");
  const grid: Grid = [];
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(text))) {
    const cells: (string | number | null)[] = [];
    const cellRe = /<c\s+r="([A-Z]+\d+)"([^>]*)>([\s\S]*?)<\/c>|<c\s+r="([A-Z]+\d+)"([^>]*)\/>/g;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rm[1]))) {
      const ref = cm[1] || cm[4];
      const attrs = cm[2] || cm[5] || "";
      const inner = cm[3] || "";
      const ci = colToIndex(ref);
      const typeMatch = attrs.match(/t="([^"]+)"/);
      const type = typeMatch ? typeMatch[1] : "n";

      let value: string | number | null = null;
      if (type === "s") {
        const v = inner.match(/<v>([\s\S]*?)<\/v>/);
        if (v) value = shared[parseInt(v[1], 10)] ?? "";
      } else if (type === "inlineStr") {
        const t = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
        if (t) value = decodeEntities(t[1]);
      } else {
        const v = inner.match(/<v>([\s\S]*?)<\/v>/);
        if (v) {
          const num = parseFloat(v[1]);
          value = isNaN(num) ? decodeEntities(v[1]) : num;
        }
      }
      cells[ci] = value;
    }
    grid.push(cells);
  }
  return grid;
}

/** Returns grids for all sheets in order */
function readAllSheetsFromFiles(files: Record<string, Buffer>): Grid[] {
  const shared = parseSharedStrings(files["xl/sharedStrings.xml"]);
  const sheetKeys = Object.keys(files)
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort((a, b) => {
      const na = parseInt(a.match(/(\d+)\.xml$/)![1]);
      const nb = parseInt(b.match(/(\d+)\.xml$/)![1]);
      return na - nb;
    });
  if (!sheetKeys.length) throw new Error("No worksheet found in xlsx");
  return sheetKeys.map((k) => parseSheet(files[k], shared));
}

// ---------- Mapping to DashboardData ----------
function cellStr(v: string | number | null | undefined): string {
  return v == null ? "" : String(v).trim();
}
function cellNum(v: string | number | null | undefined): number {
  if (typeof v === "number") return v;
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

/**
 * Find the items table header row in a grid.
 * Returns { headerIdx, colMap } or null if not found.
 * Detects by presence of "ชื่อเซต" in any header cell.
 */
function findItemsHeader(
  grid: Grid
): { headerIdx: number; colMap: Record<string, number> } | null {
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] || [];
    const joined = row.map(cellStr).join("|").toLowerCase();
    if (!joined.includes("ชื่อเซต")) continue;

    const colMap: Record<string, number> = {};
    row.forEach((cell, i) => {
      const h = cellStr(cell).toLowerCase();
      if (h.includes("ลำดับ")) colMap.rank = i;
      else if (h.includes("ชื่อเซต")) colMap.name = i;
      else if (h.includes("หน่วยงาน") || h.includes("department")) colMap.department = i;
      else if (h.includes("จำนวน") || h.includes("qty") || h.includes("count")) colMap.quantity = i;
      else if (h.includes("ราคา/หน่วย") || h.includes("unit price")) colMap.pricePerUnit = i;
      else if (h.includes("ราคารวม") || h.includes("total price")) colMap.totalPrice = i;
    });
    return { headerIdx: r, colMap };
  }
  return null;
}

export function parseXLSXBuffer(buf: Buffer): DashboardData {
  const files = unzip(buf);
  const sheets = readAllSheetsFromFiles(files);
  const grid = sheets[0]; // single sheet — both meta and items live here

  // ── 1. Read meta (key-value rows before the items table header) ──
  const meta: Record<string, string> = {};
  for (const row of grid) {
    const key = cellStr(row?.[0]);
    const val = cellStr(row?.[1]);
    // Stop when we hit the items table header (contains "ชื่อเซต")
    if ((row || []).map(cellStr).join("|").toLowerCase().includes("ชื่อเซต")) break;
    if (key && val) meta[key] = val;
  }

  const hospitalName = meta["โรงพยาบาล"] || undefined;
  const reportName   = meta["ชื่อรายงาน"] || undefined;
  const fiscalYear   = meta["ปีงบประมาณ"] || undefined;
  const from         = meta["วันที่เริ่ม"];
  const to           = meta["วันที่สิ้นสุด"];
  const period       = from && to ? { from, to } : undefined;
  // Logo: embedded picture in xlsx, or meta URL (resolved to data URL in API)
  const logoUrl = extractEmbeddedLogo(files) ?? logoUrlFromMeta(meta);

  // ── 2. Parse items table ──
  const items: ItemData[] = [];
  const found = findItemsHeader(grid);

  if (found) {
    const { headerIdx, colMap } = found;
    for (let r = headerIdx + 1; r < grid.length; r++) {
      const row = grid[r] || [];
      const name = cellStr(row[colMap.name ?? 1]);
      if (!name) continue;
      items.push({
        rank:         colMap.rank     != null ? cellNum(row[colMap.rank])         : r - headerIdx,
        name,
        department:   colMap.department != null ? cellStr(row[colMap.department]) || undefined : undefined,
        quantity:     cellNum(row[colMap.quantity     ?? 3]),
        pricePerUnit: cellNum(row[colMap.pricePerUnit ?? 4]),
        totalPrice:   cellNum(row[colMap.totalPrice   ?? 5]),
      });
    }
  }

  // ── 3. Derive departments by aggregating items ──
  const deptMap = new Map<
    string,
    { count: number; totalPrice: number; pricePerUnit: number }
  >();
  for (const item of items) {
    const dName = item.department || "ไม่ระบุ";
    const existing = deptMap.get(dName) ?? {
      count: 0,
      totalPrice: 0,
      pricePerUnit: 0,
    };
    deptMap.set(dName, {
      count: existing.count + item.quantity,
      totalPrice: existing.totalPrice + item.totalPrice,
      pricePerUnit: existing.pricePerUnit + item.pricePerUnit,
    });
  }

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + i.totalPrice, 0);
  const pricePerUnit = items.reduce((s, i) => s + i.pricePerUnit, 0);

  const departments: DepartmentData[] = Array.from(deptMap.entries())
    .map(([name, { count, totalPrice: tp, pricePerUnit: ppu }]) => ({
      name,
      count,
      totalPrice: tp,
      pricePerUnit: ppu,
      percentage: totalItems ? parseFloat(((count / totalItems) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    period,
    reportName,
    hospitalName,
    fiscalYear,
    logoUrl,
    summary: {
      totalItems,
      totalDepartments: departments.length,
      totalSets: items.length,
      pricePerUnit,
      totalPrice,
    },
    departments,
    items,
    reportType: "summary",
  };
}
