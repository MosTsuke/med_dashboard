"use client";

import { useState, useMemo } from "react";
import { Search, AlertTriangle, ChevronRight } from "lucide-react";
import { REPORT_BANNER_BG } from "@/components/ReportNote";
import TablePagination, { type PageSize } from "@/components/TablePagination";
import { formatNumber } from "@/lib/formatNumber";
import type { ItemData, ValueKind } from "@/types";

interface Props {
  items: ItemData[];
  /** Called when a row with a per-month breakdown is clicked. Rows without
   * `monthlyQuantity` (non monthly-matrix reports) aren't clickable. */
  onItemClick?: (item: ItemData) => void;
  /** Relabels the "ราคา/หน่วย" / "ราคารวม" columns for non-monetary reports
   * (e.g. "สถิติล้าง" tracks pieces-per-set, not baht). */
  valueKind?: ValueKind;
}

/** Rows whose name in the source file was blank (see lib/parseXLSX.ts) get a
 * placeholder like "(ไม่ระบุชื่อรายการ แถว 212)" — flag them so they're easy
 * to spot/search without knowing that exact text. */
function isUnnamed(item: ItemData): boolean {
  return item.name.startsWith("(ไม่ระบุชื่อรายการ");
}

export default function ItemTable({ items, onItemClick, valueKind }: Props) {
  const perUnitLabel = valueKind?.perUnitLabel ?? "ราคา/หน่วย";
  const totalLabel = valueKind?.totalLabel ?? "ราคารวม";
  const decimals = valueKind?.decimals ?? 2;
  const [query, setQuery] = useState("");
  const [onlyUnnamed, setOnlyUnnamed] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(20);

  // Check if any item has department data
  const hasDept = items.some((i) => !!i.department);
  const unnamedCount = useMemo(() => items.filter(isUnnamed).length, [items]);

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        if (onlyUnnamed && !isUnnamed(item)) return false;
        const q = query.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          (item.department?.toLowerCase().includes(q) ?? false)
        );
      }),
    [items, query, onlyUnnamed]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * perPage, safePage * perPage);
  const colSpan = hasDept ? 7 : 6;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
      <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          รายการอุปกรณ์ ({items.length} รายการ)
        </h2>
        <div className="flex items-center gap-2">
          {unnamedCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setOnlyUnnamed((v) => !v);
                setPage(1);
              }}
              title="รายการที่ไม่มีชื่อในไฟล์ต้นฉบับ แต่มีข้อมูลจำนวน/ราคาจริง"
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
                onlyUnnamed
                  ? "bg-amber-100 text-amber-700 border-amber-300"
                  : "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
              }`}
            >
              <AlertTriangle size={13} />
              ไม่มีชื่อ ({unnamedCount})
            </button>
          )}
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="ค้นหารายการ / หน่วยงาน..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 w-56"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={`${REPORT_BANNER_BG} border-b border-blue-900/20`}>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white uppercase tracking-wide w-14">
                ลำดับ
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white uppercase tracking-wide">
                ชื่อเซต
              </th>
              {hasDept && (
                <th className="text-left px-4 py-3 text-xs font-semibold text-white uppercase tracking-wide w-36">
                  หน่วยงาน
                </th>
              )}
              <th className="text-right px-4 py-3 text-xs font-semibold text-white uppercase tracking-wide w-28">
                จำนวน/หน่วย
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-white uppercase tracking-wide w-28">
                {perUnitLabel}
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-white uppercase tracking-wide w-28">
                {totalLabel}
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {paged.map((item) => {
              const clickable = !!onItemClick && !!item.monthlyQuantity;
              return (
              <tr
                key={`${item.rank}-${item.name}`}
                onClick={clickable ? () => onItemClick!(item) : undefined}
                title={clickable ? "ดูรายละเอียดรายเดือนของรายการนี้" : undefined}
                className={`hover:bg-blue-50/30 transition-colors ${clickable ? "cursor-pointer" : ""}`}
              >
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                  {item.rank}
                </td>
                <td className="px-4 py-3 text-gray-700 font-medium">
                  {isUnnamed(item) ? (
                    <span
                      className="inline-flex items-center gap-1 text-amber-700"
                      title="ไม่มีชื่อในไฟล์ต้นฉบับ แต่มีข้อมูลจำนวน/ราคาจริง"
                    >
                      <AlertTriangle size={13} className="shrink-0" />
                      {item.name}
                    </span>
                  ) : (
                    item.name
                  )}
                </td>
                {hasDept && (
                  <td className="px-4 py-3">
                    {item.department ? (
                      <span className="inline-block bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
                        {item.department}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                )}
                <td className="px-4 py-3 text-right">
                  <span className="font-semibold text-blue-700">
                    {formatNumber(item.quantity)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {formatNumber(item.pricePerUnit, { decimals })}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {formatNumber(item.totalPrice, { decimals })}
                </td>
                <td className="px-4 py-3 text-right">
                  {clickable && <ChevronRight size={15} className="text-gray-300" />}
                </td>
              </tr>
              );
            })}
            {paged.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-4 py-8 text-center text-gray-400">
                  ไม่พบรายการ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={safePage}
        perPage={perPage}
        totalItems={filtered.length}
        unitLabel="รายการ"
        onPageChange={setPage}
        onPerPageChange={setPerPage}
      />
    </div>
  );
}
