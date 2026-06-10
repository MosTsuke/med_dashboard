"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { REPORT_BANNER_BG } from "@/components/ReportNote";
import TablePagination, { type PageSize } from "@/components/TablePagination";
import { formatNumber } from "@/lib/formatNumber";
import type { ItemData } from "@/types";

interface Props {
  items: ItemData[];
}

export default function ItemTable({ items }: Props) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(20);

  // Check if any item has department data
  const hasDept = items.some((i) => !!i.department);

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const q = query.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          (item.department?.toLowerCase().includes(q) ?? false)
        );
      }),
    [items, query]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * perPage, safePage * perPage);
  const colSpan = hasDept ? 6 : 5;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
      <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          รายการอุปกรณ์ ({items.length} รายการ)
        </h2>
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
                ราคา/หน่วย
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-white uppercase tracking-wide w-28">
                ราคารวม
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {paged.map((item) => (
              <tr
                key={`${item.rank}-${item.name}`}
                className="hover:bg-blue-50/30 transition-colors"
              >
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                  {item.rank}
                </td>
                <td className="px-4 py-3 text-gray-700 font-medium">
                  {item.name}
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
                  {formatNumber(item.pricePerUnit, { decimals: 2 })}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {formatNumber(item.totalPrice, { decimals: 2 })}
                </td>
              </tr>
            ))}
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
