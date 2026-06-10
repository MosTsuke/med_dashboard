"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { REPORT_BANNER_BG } from "@/components/ReportNote";
import TablePagination, { type PageSize } from "@/components/TablePagination";
import { formatNumber } from "@/lib/formatNumber";
import type { DepartmentData } from "@/types";

interface Props {
  departments: DepartmentData[];
}

export default function DepartmentTable({ departments }: Props) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(20);

  const filtered = useMemo(() => {
    const sorted = [...departments].sort((a, b) => b.count - a.count);
    return sorted.filter((d) =>
      d.name.toLowerCase().includes(query.toLowerCase())
    );
  }, [departments, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (safePage - 1) * perPage,
    safePage * perPage
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
      <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-sm font-semibold text-gray-700">
          รายละเอียดแยกตามหน่วยงาน ({departments.length} หน่วยงาน)
        </h2>
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="ค้นหาหน่วยงาน..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 w-52"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={`${REPORT_BANNER_BG} border-b border-blue-900/20`}>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white uppercase tracking-wide w-14">
                #
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white uppercase tracking-wide">
                หน่วยงาน
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-white uppercase tracking-wide w-28">
                จำนวน (ชิ้น)
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
            {paged.map((dept, i) => (
              <tr
                key={dept.name}
                className="hover:bg-blue-50/30 transition-colors"
              >
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                  {(safePage - 1) * perPage + i + 1}
                </td>
                <td className="px-4 py-3 text-gray-700 font-medium">
                  {dept.name}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-semibold text-blue-700">
                    {formatNumber(dept.count)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {formatNumber(dept.pricePerUnit ?? 0, { decimals: 2 })}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {formatNumber(dept.totalPrice ?? 0, { decimals: 2 })}
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  ไม่พบหน่วยงาน
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={page}
        perPage={perPage}
        totalItems={filtered.length}
        unitLabel="หน่วยงาน"
        onPageChange={setPage}
        onPerPageChange={setPerPage}
      />
    </div>
  );
}
