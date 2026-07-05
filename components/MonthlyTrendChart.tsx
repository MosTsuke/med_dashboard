"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { MonthlyPoint } from "@/types";
import { formatNumber } from "@/lib/formatNumber";
import { formatMonthLabel } from "@/lib/monthlyView";
import ReportSectionHeader from "@/components/ReportSectionHeader";
import { TrendingUp } from "lucide-react";

interface Props {
  data: MonthlyPoint[];
  onMonthClick?: (month: string) => void;
  /** Unit shown in the tooltip — "ชิ้น" by default, but e.g. "เซต" for
   * reports like "สถิติล้าง" whose quantity actually tracks sets. */
  unit?: string;
}

const makeTooltip = (unit: string) =>
  function CustomTooltip({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: { value: number }[];
    label?: string;
  }) {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
          <p className="font-medium text-gray-700">{label ? formatMonthLabel(label) : label}</p>
          <p className="text-blue-600 font-bold">
            {formatNumber(payload[0].value)} {unit}
          </p>
        </div>
      );
    }
    return null;
  };

export default function MonthlyTrendChart({ data, onMonthClick, unit = "ชิ้น" }: Props) {
  const CustomTooltip = makeTooltip(unit);
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
      <ReportSectionHeader title="แนวโน้มจำนวนรายเดือน" icon={TrendingUp} />
      <div className="p-5">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={data}
            margin={{ top: 10, right: 16, left: 4, bottom: 10 }}
            className={onMonthClick ? "cursor-pointer" : undefined}
            onClick={(state) => {
              const label = state?.activeLabel;
              if (onMonthClick && typeof label === "string") onMonthClick(label);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickFormatter={(v) => formatMonthLabel(String(v))}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickFormatter={(v) => formatNumber(Number(v))}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="quantity"
              stroke="#1d6fb8"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#1d6fb8" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
