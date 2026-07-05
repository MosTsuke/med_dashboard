import zlib from "zlib";
import {
  extractEmbeddedLogo,
  logoUrlFromMeta,
} from "@/lib/logoFromXlsx";
import type { DashboardData, DepartmentData, ItemData, MonthlyPoint, ValueKind } from "@/types";

/**
 * Minimal dependency-free .xlsx reader.
 * An .xlsx file is a ZIP archive of XML parts. We read the ZIP central
 * directory, inflate the needed entries, and parse the worksheet cells.
 * Supports shared strings (t="s"), inline strings (t="inlineStr") and numbers.
 *
 * Three source formats are recognized and routed to their own parser:
 *  1. Template format   — meta key/value rows + "ชื่อเซต" items table (see public/template-data.xlsx)
 *  2. Resterile list    — "รายการ" items table with "ยอดรวม" rows marking department subtotals
 *                         (or a single overall "ยอดรวม" row when there is no department breakdown)
 *  3. Monthly matrix    — "รายการ" items table with one column per fiscal month (YYYY-MM headers)
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
  // Handles both `<row ...>...</row>` and self-closing `<row .../>` (blank rows).
  // Row placement uses the row's own r="N" attribute rather than sequential
  // push order, since blank self-closing rows would otherwise be skipped and
  // shift every subsequent row's index.
  const rowRe = /<row\s*([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
  let rm: RegExpExecArray | null;
  let seq = 0;
  while ((rm = rowRe.exec(text))) {
    const rowAttrs = rm[1] || "";
    const rowInner = rm[2] || "";
    const rNumMatch = rowAttrs.match(/\br="(\d+)"/);
    const rowIdx = rNumMatch ? parseInt(rNumMatch[1], 10) - 1 : seq;
    seq = rowIdx + 1;

    const cells: (string | number | null)[] = [];
    // Cell attributes (t=, r=, s=...) can appear in any order, so match the
    // whole tag first and then pull out `r=` / `t=` independently.
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rowInner))) {
      const attrs = cm[1] || "";
      const inner = cm[2] || "";
      const refMatch = attrs.match(/\br="([A-Z]+\d+)"/);
      if (!refMatch) continue;
      const ci = colToIndex(refMatch[1]);
      const typeMatch = attrs.match(/\bt="([^"]+)"/);
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
    grid[rowIdx] = cells;
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

// ---------- generic helpers ----------
function cellStr(v: string | number | null | undefined): string {
  return v == null ? "" : String(v).trim();
}
function cellNum(v: string | number | null | undefined): number {
  if (typeof v === "number") return v;
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

/** Finds the first cell in `grid` whose text exactly matches `label`, then
 * returns the nearest non-empty cell to its right on the same row (used for
 * "วันที่ <date>" / "ถึงวันที่ <date>" style label+value pairs). */
function findLabeledValue(grid: Grid, exactLabel: string): string | number | null {
  for (const row of grid) {
    const idx = (row || []).findIndex((c) => cellStr(c) === exactLabel);
    if (idx === -1) continue;
    for (let j = idx + 1; j < row.length && j < idx + 10; j++) {
      const v = row[j];
      if (v != null && cellStr(v) !== "") return v;
    }
  }
  return null;
}

/** First cell (before `beforeRow`) containing the word "รายงาน" — used as a
 * fallback report title when there's no explicit "ชื่อรายงาน" meta row. */
function findReportTitle(grid: Grid, beforeRow: number): string | undefined {
  for (let r = 0; r < beforeRow; r++) {
    for (const c of grid[r] || []) {
      const s = cellStr(c);
      if (s.includes("รายงาน")) return s;
    }
  }
  return undefined;
}

function extractFiscalYearFromTitle(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const m = s.match(/(\d{4})\s*$/);
  return m ? m[1] : undefined;
}

/** Excel serial date (1900 date system) -> UTC Date. */
function excelSerialToDate(n: number): Date {
  const utcDays = Math.floor(n - 25569); // 25569 = days between 1899-12-30 and 1970-01-01
  return new Date(utcDays * 86400 * 1000);
}

function formatDateBuddhist(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = String((d.getUTCFullYear() + 543) % 100).padStart(2, "0");
  return `${dd}/${mm}/${yy}`;
}

// =====================================================================
// Format 1 — template (meta rows + "ชื่อเซต" items table)
// =====================================================================

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

function parseTemplateFormat(grid: Grid, files: Record<string, Buffer>): DashboardData {
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

// =====================================================================
// Format 2 — Resterile list ("รายการ" header + "ยอดรวม" department markers,
// e.g. "สถิติ Resterile แยกหน่วยงาน" / "สถิติ Resterile เรียงตาม Set")
// =====================================================================

function findResterileHeader(
  grid: Grid
): { headerIdx: number; colMap: Record<string, number> } | null {
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] || [];
    if (!row.some((c) => cellStr(c) === "รายการ")) continue;

    const colMap: Record<string, number> = {};
    row.forEach((cell, i) => {
      const h = cellStr(cell);
      if (h === "ลำดับ") colMap.rank = i;
      else if (h === "รายการ") colMap.name = i;
      else if (h === "จำนวน") colMap.quantity = i;
      else if (h === "ราคา/หน่วย") colMap.pricePerUnit = i;
      else if (h === "ราคารวม") colMap.totalPrice = i;
    });
    return { headerIdx: r, colMap };
  }
  return null;
}

function parseResterileList(grid: Grid, files: Record<string, Buffer>): DashboardData {
  const found = findResterileHeader(grid);
  if (!found) throw new Error("Resterile list header not found");
  const { headerIdx, colMap } = found;

  const rankCol = colMap.rank ?? 1;
  const nameCol = colMap.name ?? 2;

  const items: ItemData[] = [];
  let currentDept: string | undefined;

  for (let r = headerIdx + 1; r < grid.length; r++) {
    const row = grid[r] || [];
    const rankCell = cellStr(row[rankCol]);
    const nameCell = cellStr(row[nameCol]);

    if (rankCell === "ยอดรวม") {
      // Department subtotal marker row. Name cell holds the department name,
      // or is empty when the report has no department breakdown at all.
      currentDept = nameCell || undefined;
      continue;
    }
    // A real item row always has a numeric rank; a blank row has neither
    // rank nor name. Some source files clear an item's name but leave its
    // numbered row and data intact — keep those under a placeholder name so
    // totals still reconcile with the file's own declared grand total.
    if (!nameCell && !/^\d+$/.test(rankCell)) continue;

    items.push({
      rank: items.length + 1,
      name: nameCell || `(ไม่ระบุชื่อรายการ แถว ${r + 1})`,
      department: currentDept,
      quantity:     colMap.quantity     != null ? cellNum(row[colMap.quantity])     : 0,
      pricePerUnit: colMap.pricePerUnit != null ? cellNum(row[colMap.pricePerUnit]) : 0,
      totalPrice:   colMap.totalPrice   != null ? cellNum(row[colMap.totalPrice])   : 0,
    });
  }

  // Aggregate departments — but only when items actually carry a department
  // (falls back to a flat item list, like the "เรียงตาม Set" variant, when not).
  const deptMap = new Map<
    string,
    { count: number; totalPrice: number; pricePerUnit: number }
  >();
  for (const item of items) {
    if (!item.department) continue;
    const existing = deptMap.get(item.department) ?? {
      count: 0,
      totalPrice: 0,
      pricePerUnit: 0,
    };
    deptMap.set(item.department, {
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

  // ── meta ──
  const reportName = findReportTitle(grid, headerIdx);
  const startRaw = findLabeledValue(grid, "วันที่");
  const endRaw = findLabeledValue(grid, "ถึงวันที่");
  let period: { from: string; to: string } | undefined;
  let fiscalYear: string | undefined;
  if (typeof startRaw === "number" && typeof endRaw === "number") {
    const startDate = excelSerialToDate(startRaw);
    const endDate = excelSerialToDate(endRaw);
    period = { from: formatDateBuddhist(startDate), to: formatDateBuddhist(endDate) };
    fiscalYear = String(endDate.getUTCFullYear() + 543);
  }
  fiscalYear = fiscalYear ?? extractFiscalYearFromTitle(reportName);

  const logoUrl = extractEmbeddedLogo(files);

  return {
    period,
    reportName,
    hospitalName: undefined,
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
    reportType: departments.length > 0 ? "summary" : "items",
  };
}

// =====================================================================
// Format 3 — Monthly matrix ("รายการ" header + one column per fiscal month,
// e.g. "สถิติ pack / ล้าง / จ่าย ปีงบประมาณ")
// =====================================================================

const MONTH_RE = /^\d{4}-\d{2}$/;

function parseMonthlyMatrix(grid: Grid, files: Record<string, Buffer>): DashboardData {
  let headerIdx = -1;
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] || [];
    if (row.some((c) => cellStr(c) === "รายการ") && row.some((c) => MONTH_RE.test(cellStr(c)))) {
      headerIdx = r;
      break;
    }
  }
  if (headerIdx === -1) throw new Error("Monthly matrix header not found");

  const headerRow = grid[headerIdx] || [];
  const subRow = grid[headerIdx + 1] || [];

  const nameCol = headerRow.findIndex((c) => cellStr(c) === "รายการ");

  // The per-unit column is usually a price ("ราคา" / "ราคา(ต่อหน่วย)"), but
  // some files (e.g. "สถิติล้าง") have no pricing at all — that column is a
  // quantity ratio instead, like "จำนวนชิ้น/เซต" (pieces per set). Detect
  // which kind it is directly from the header text rather than assuming.
  let perUnitCol = -1;
  let perUnitLabel = "";
  let isMonetary = true;
  const monthCols: { col: number; label: string }[] = [];
  headerRow.forEach((c, i) => {
    const s = cellStr(c);
    if (MONTH_RE.test(s)) { monthCols.push({ col: i, label: s }); return; }
    if (i === nameCol || !s || s.includes("รวม")) return; // "รวม" cell is the merged total-group label, not per-unit
    if (s.includes("ราคา")) {
      perUnitCol = i;
      perUnitLabel = s.replace(/[\r\n]+/g, "");
      isMonetary = true;
    } else if (s.includes("จำนวน")) {
      perUnitCol = i;
      perUnitLabel = s.replace(/[\r\n]+/g, "");
      isMonetary = false;
    }
  });
  monthCols.sort((a, b) => a.col - b.col);
  const firstMonthCol = monthCols.length ? monthCols[0].col : Infinity;

  // Sub-header row carries the two totals under the merged "มูลค่ารวม" /
  // "ยอดรวม" group. For monetary files it's unambiguous: (จำนวน, ราคารวม).
  // But some files (e.g. "สถิติล้าง") have two *quantity* subheaders side by
  // side — (จำนวนเชต, จำนวนชิ้น) — and which one the monthly columns actually
  // track isn't predictable from the label alone (verified: for "ล้าง" the
  // months sum to "จำนวนเชต", not "จำนวนชิ้น", even though the latter sounds
  // like the obvious pick). So when there's ambiguity, disambiguate against
  // real data: whichever candidate column's value matches a sample row's own
  // month-sum is the one actually tracked per month.
  const subHeaderCells: { col: number; label: string }[] = [];
  subRow.forEach((c, i) => {
    if (i >= firstMonthCol) return;
    const s = cellStr(c);
    if (s) subHeaderCells.push({ col: i, label: s });
  });

  const explicitTotalCell = subHeaderCells.find((c) => c.label === "ราคารวม");
  const qtyCandidates = subHeaderCells.filter((c) => c !== explicitTotalCell);

  let qtyTotalCol = qtyCandidates.length === 1 ? qtyCandidates[0].col : -1;
  if (qtyTotalCol === -1 && qtyCandidates.length > 1) {
    for (let r = headerIdx + 2; r < grid.length; r++) {
      const row = grid[r] || [];
      const rowName = cellStr(row[nameCol]);
      if (!rowName || rowName.includes("ยอดรวม")) continue;
      const monthSum = monthCols.reduce((s, m) => s + cellNum(row[m.col]), 0);
      if (monthSum === 0) continue;
      const match = qtyCandidates.find((c) => cellNum(row[c.col]) === monthSum);
      if (match) {
        qtyTotalCol = match.col;
        break;
      }
    }
    if (qtyTotalCol === -1) qtyTotalCol = qtyCandidates[0].col; // fallback: can't disambiguate, just pick one
  }

  const totalCell = explicitTotalCell ?? qtyCandidates.find((c) => c.col !== qtyTotalCol);
  const priceTotalCol = totalCell?.col ?? -1;
  const totalLabel = totalCell?.label ?? "ราคารวม";

  // "จำนวนรวมทั้งหมด" (the main quantity stat) is normally pieces ("ชิ้น"),
  // but whichever subheader actually won qtyTotalCol tells us the real unit —
  // e.g. "จำนวนเชต" means the tracked quantity is sets, not pieces.
  const qtyCellLabel = qtyCandidates.find((c) => c.col === qtyTotalCol)?.label ?? "";
  const qtyUnitSuffix = qtyCellLabel.replace(/^จำนวน/, "").trim();
  const quantityUnit = qtyUnitSuffix || "ชิ้น";

  const valueKind: ValueKind = isMonetary
    ? { isMonetary: true, perUnitLabel: perUnitLabel || "ราคา/หน่วย", totalLabel, unit: "บาท", decimals: 2, quantityUnit }
    : { isMonetary: false, perUnitLabel: perUnitLabel || "จำนวน/หน่วย", totalLabel, unit: "", decimals: 0, quantityUnit };

  const items: ItemData[] = [];
  const monthlyTotals = new Map<string, number>();
  monthCols.forEach((m) => monthlyTotals.set(m.label, 0));

  for (let r = headerIdx + 2; r < grid.length; r++) {
    const row = grid[r] || [];
    const name = cellStr(row[nameCol]);
    if (name.includes("ยอดรวม")) continue; // the grand-total row (label varies: "ยอดรวม" / "ยอดรวมทั้งหมด")

    const quantity = qtyTotalCol >= 0 ? cellNum(row[qtyTotalCol]) : 0;
    const totalPrice = priceTotalCol >= 0 ? cellNum(row[priceTotalCol]) : 0;
    const pricePerUnit = perUnitCol >= 0 ? cellNum(row[perUnitCol]) : 0;
    const monthSum = monthCols.reduce((s, m) => s + cellNum(row[m.col]), 0);

    // Some source files have rows with a blank item name but real usage data
    // (the item's name was apparently cleared upstream while its historical
    // records stayed). Skip only genuinely empty rows; keep real data rows
    // under a placeholder name so totals still reconcile with the file's own
    // declared grand total.
    if (!name && quantity === 0 && totalPrice === 0 && monthSum === 0) continue;

    const monthlyQuantity: Record<string, number> = {};
    monthCols.forEach((m) => {
      monthlyQuantity[m.label] = cellNum(row[m.col]);
    });

    // Tag each blank-name row with its source row number so two such rows
    // never render under the exact same label (and so it's traceable back
    // to the original file if someone needs to double-check it).
    items.push({
      rank: items.length + 1,
      name: name || `(ไม่ระบุชื่อรายการ แถว ${r + 1})`,
      quantity,
      pricePerUnit,
      totalPrice,
      monthlyQuantity,
    });

    monthCols.forEach((m) => {
      monthlyTotals.set(m.label, (monthlyTotals.get(m.label) ?? 0) + monthlyQuantity[m.label]);
    });
  }

  // Rank by quantity so the "top items" view is meaningful (source order is
  // arbitrary alphabetical/registration order, not usage volume).
  items.sort((a, b) => b.quantity - a.quantity);
  items.forEach((it, i) => {
    it.rank = i + 1;
  });

  const monthly: MonthlyPoint[] = monthCols.map((m) => ({
    month: m.label,
    quantity: monthlyTotals.get(m.label) ?? 0,
  }));

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + i.totalPrice, 0);
  const pricePerUnit = items.reduce((s, i) => s + i.pricePerUnit, 0);

  const reportName = findReportTitle(grid, headerIdx) ??
    (() => {
      for (let r = 0; r < headerIdx; r++) {
        const s = cellStr((grid[r] || [])[0]);
        if (s) return s;
      }
      return undefined;
    })();
  const fiscalYear = extractFiscalYearFromTitle(reportName);
  const period = monthCols.length
    ? { from: monthCols[0].label, to: monthCols[monthCols.length - 1].label }
    : undefined;
  const logoUrl = extractEmbeddedLogo(files);

  return {
    period,
    reportName,
    hospitalName: undefined,
    fiscalYear,
    logoUrl,
    summary: {
      totalItems,
      totalDepartments: 0,
      totalSets: items.length,
      pricePerUnit,
      totalPrice,
    },
    departments: [],
    items,
    monthly,
    valueKind,
    reportType: "monthly",
  };
}

// =====================================================================
// Dispatcher
// =====================================================================

export function parseXLSXBuffer(buf: Buffer): DashboardData {
  const files = unzip(buf);
  const sheets = readAllSheetsFromFiles(files);
  const grid = sheets[0]; // single sheet — both meta and items live here

  const hasSetNameHeader = grid.some((row) =>
    (row || []).some((c) => cellStr(c).toLowerCase().includes("ชื่อเซต"))
  );
  if (hasSetNameHeader) {
    return parseTemplateFormat(grid, files);
  }

  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] || [];
    if (row.some((c) => cellStr(c) === "รายการ")) {
      const isMonthly = row.some((c) => MONTH_RE.test(cellStr(c)));
      return isMonthly ? parseMonthlyMatrix(grid, files) : parseResterileList(grid, files);
    }
  }

  // Nothing recognized — return an empty result; the API route treats an
  // empty items list as a parse failure and shows a friendly error.
  return {
    summary: { totalItems: 0, totalDepartments: 0, totalSets: 0, pricePerUnit: 0, totalPrice: 0 },
    departments: [],
    items: [],
    reportType: "unknown",
  };
}
