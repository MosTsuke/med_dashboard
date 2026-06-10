import { Trophy } from "lucide-react";
import { CHART_COLORS } from "@/lib/chartColors";
import ReportSectionHeader from "@/components/ReportSectionHeader";
import { formatNumber } from "@/lib/formatNumber";
import type { DepartmentData } from "@/types";

interface Props {
  data: DepartmentData[];
}

export default function Top5Card({ data }: Props) {
  const top5 = [...data].sort((a, b) => b.count - a.count).slice(0, 5);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
      <ReportSectionHeader title="Top 5 หน่วยงาน" icon={Trophy} />
      <div className="px-5 py-3 divide-y divide-gray-100">
        {top5.map((dept, i) => {
          const color = CHART_COLORS[i % CHART_COLORS.length];
          return (
            <div
              key={dept.name}
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
                  {dept.name}
                </span>
              </div>
              <span className="font-bold text-sm shrink-0 ml-2">
                <span style={{ color }}>{formatNumber(dept.count)}</span>
                <span className="font-normal text-gray-400 ml-1">ชิ้น</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
