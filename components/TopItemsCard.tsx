import { Trophy } from "lucide-react";
import { CHART_COLORS } from "@/lib/chartColors";
import ReportSectionHeader from "@/components/ReportSectionHeader";
import { formatNumber } from "@/lib/formatNumber";
import type { ItemData } from "@/types";

interface Props {
  data: ItemData[];
  title?: string;
  limit?: number;
  /** Unit shown after each value — "ชิ้น" by default, but e.g. "เซต" for
   * reports like "สถิติล้าง" whose quantity actually tracks sets. */
  unit?: string;
}

export default function TopItemsCard({ data, title = "Top 5 รายการ", limit = 5, unit = "ชิ้น" }: Props) {
  const top = [...data].sort((a, b) => b.quantity - a.quantity).slice(0, limit);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
      <ReportSectionHeader title={title} icon={Trophy} />
      <div className="px-5 py-3 divide-y divide-gray-100">
        {top.map((item, i) => {
          const color = CHART_COLORS[i % CHART_COLORS.length];
          return (
            <div
              key={`${item.name}-${i}`}
              className="flex items-center justify-between py-2.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {i + 1}
                </span>
                <span className="font-medium text-sm truncate text-gray-700">
                  {item.name}
                </span>
              </div>
              <span className="font-bold text-sm shrink-0 ml-2">
                <span style={{ color }}>{formatNumber(item.quantity)}</span>
                <span className="font-normal text-gray-400 ml-1">{unit}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
