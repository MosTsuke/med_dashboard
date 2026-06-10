"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import type { DepartmentData } from "@/types";
import { CHART_COLORS } from "@/lib/chartColors";
import { formatNumber } from "@/lib/formatNumber";
import ReportSectionHeader from "@/components/ReportSectionHeader";
import { BarChart3 } from "lucide-react";

interface Props {
  data: DepartmentData[];
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
        <p className="font-medium text-gray-700">{label}</p>
        <p className="text-blue-600 font-bold">
          {formatNumber(payload[0].value)} ชิ้น
        </p>
      </div>
    );
  }
  return null;
};

export default function DepartmentBarChart({ data }: Props) {
  const sorted = [...data].sort((a, b) => b.count - a.count);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
      <ReportSectionHeader
        title="จำนวนรายการแยกตามหน่วยงาน (ชิ้น)"
        icon={BarChart3}
      />
      <div className="p-5">
      <ResponsiveContainer width="100%" height={340}>
        <BarChart
          data={sorted}
          margin={{ top: 24, right: 10, left: 4, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            angle={-40}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickFormatter={(v) => formatNumber(Number(v))}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {sorted.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
            <LabelList
              dataKey="count"
              content={(props) => {
                const { x, y, width, value, index } = props;
                if (
                  x == null ||
                  y == null ||
                  width == null ||
                  value == null ||
                  index == null
                ) {
                  return null;
                }
                return (
                  <text
                    x={x + width / 2}
                    y={y - 6}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={600}
                  >
                    {formatNumber(Number(value))}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
