"use client";

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

function getPageNumbers(
  current: number,
  total: number
): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [1];
  if (current > 3) pages.push("ellipsis");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("ellipsis");
  if (total > 1) pages.push(total);

  return pages;
}

interface Props {
  page: number;
  perPage: number;
  totalItems: number;
  unitLabel: string;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: PageSize) => void;
}

export default function TablePagination({
  page,
  perPage,
  totalItems,
  unitLabel,
  onPageChange,
  onPerPageChange,
}: Props) {
  if (totalItems === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const safePage = Math.min(page, totalPages);
  const from = (safePage - 1) * perPage + 1;
  const to = Math.min(safePage * perPage, totalItems);

  return (
    <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
      <span>
        แสดง {from}–{to} จาก {totalItems.toLocaleString()} {unitLabel}
      </span>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="text-gray-400">แสดงต่อหน้า</span>
          <select
            value={perPage}
            onChange={(e) => {
              onPerPageChange(Number(e.target.value) as PageSize);
              onPageChange(1);
            }}
            className="py-1 pl-2 pr-7 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, safePage - 1))}
              disabled={safePage === 1}
              className="min-w-[2rem] px-2 py-1 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50"
              aria-label="หน้าก่อนหน้า"
            >
              ‹
            </button>
            {getPageNumbers(safePage, totalPages).map((p, i) =>
              p === "ellipsis" ? (
                <span
                  key={`ellipsis-${i}`}
                  className="px-1 text-gray-300 select-none"
                >
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  className={`min-w-[2rem] px-2 py-1 rounded border text-sm ${
                    p === safePage
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {p}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
              disabled={safePage === totalPages}
              className="min-w-[2rem] px-2 py-1 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50"
              aria-label="หน้าถัดไป"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
