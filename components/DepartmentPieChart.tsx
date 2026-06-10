"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import ReportNote from "@/components/ReportNote";
import ReportSectionHeader from "@/components/ReportSectionHeader";
import { PieChart as PieChartIcon } from "lucide-react";
import { formatNumber } from "@/lib/formatNumber";
import type { DepartmentData } from "@/types";

const COLORS = [
  "#1d6fb8",
  "#22a06b",
  "#f59e0b",
  "#e03e3e",
  "#7c3aed",
  "#0d9488",
  "#db2777",
  "#94a3b8",
];

interface Props {
  data: DepartmentData[];
  total: number;
}

export default function DepartmentPieChart({ data, total }: Props) {
  const sorted = [...data].sort((a, b) => b.count - a.count);
  const top7 = sorted.slice(0, 7);
  const otherCount = sorted.slice(7).reduce((s, d) => s + d.count, 0);

  const chartData = [
    ...top7,
    ...(otherCount > 0 ? [{ name: "อื่น ๆ", count: otherCount }] : []),
  ];

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: { name: string; value: number }[];
  }) => {
    if (active && payload && payload.length) {
      const pct = ((payload[0].value / total) * 100).toFixed(2);
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
          <p className="font-medium text-gray-700">{payload[0].name}</p>
          <p className="text-blue-600 font-bold">
            {formatNumber(payload[0].value)} ชิ้น ({pct}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
      <ReportSectionHeader
        title="สัดส่วนจำนวนรายการแยกตามหน่วยงาน"
        icon={PieChartIcon}
      />
      <div className="p-5">
      <div className="flex items-center gap-2">
        {/* Donut chart with center label */}
        <div className="relative w-[55%] shrink-0">
          <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-[10px] text-gray-400">รวม</p>
              <p className="text-base font-bold text-gray-800 leading-tight">
                {formatNumber(total)}
              </p>
              <p className="text-[10px] text-gray-400">ชิ้น</p>
            </div>
          </div>
          <div className="relative z-10">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={2}
                  dataKey="count"
                >
                  {chartData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={<CustomTooltip />}
                  wrapperStyle={{ zIndex: 50 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-1 min-w-0">
          {chartData.map((item, index) => {
            const pct = ((item.count / total) * 100).toFixed(2);
            return (
              <div key={item.name} className="flex items-center gap-1.5 text-[11px]">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-gray-600 truncate flex-1">{item.name}</span>
                <span className="text-gray-400 shrink-0">{pct}%</span>
              </div>
            );
          })}
          {otherCount > 0 && (
            <ReportNote className="text-[10px] mt-1 leading-tight">
              * อื่น ๆ คือหน่วยงานที่เหลือรวมกัน
            </ReportNote>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
