import { LucideIcon } from "lucide-react";
import { formatNumber } from "@/lib/formatNumber";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  unit?: string;
  /** จำนวนทศนิยม (เช่น ราคา = 2) */
  decimals?: number;
  color?: "blue" | "green" | "purple" | "amber" | "teal";
  variant?: "default" | "report";
}

function formatStatValue(
  value: string | number,
  decimals?: number
): string {
  if (typeof value === "string" && (value === "—" || value.trim() === "")) {
    return value;
  }
  const n =
    typeof value === "number"
      ? value
      : parseFloat(String(value).replace(/,/g, ""));
  if (Number.isNaN(n)) return String(value);
  return formatNumber(n, decimals != null ? { decimals } : undefined);
}

const colorMap = {
  blue: "bg-blue-50 text-blue-600 border-blue-100",
  green: "bg-green-50 text-green-600 border-green-100",
  purple: "bg-purple-50 text-purple-600 border-purple-100",
  amber: "bg-amber-50 text-amber-600 border-amber-100",
  teal: "bg-teal-50 text-teal-600 border-teal-100",
};

const iconBgMap = {
  blue: "bg-blue-100 text-blue-700",
  green: "bg-green-100 text-green-700",
  purple: "bg-purple-100 text-purple-700",
  amber: "bg-amber-100 text-amber-700",
  teal: "bg-teal-100 text-teal-700",
};

export default function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  decimals,
  color = "blue",
  variant = "default",
}: StatCardProps) {
  const formatted = formatStatValue(value, decimals);

  if (variant === "report") {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3 shadow-md report-stat-card">
        <div className={`p-2.5 rounded-lg shrink-0 ${iconBgMap[color]}`}>
          <Icon size={20} strokeWidth={1.75} />
        </div>
        <div className="report-stat-card-body min-w-0">
          <p className="report-stat-label text-[11px] font-medium text-gray-500 leading-tight">
            {label}
          </p>
          <p className="report-stat-value text-xl font-bold text-gray-800 mt-0.5 leading-none">
            {formatted}
          </p>
          {unit && (
            <p className="text-xs text-gray-400 mt-1 leading-tight">{unit}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border p-5 flex items-center gap-4 ${colorMap[color]}`}
    >
      <div className={`p-3 rounded-lg ${iconBgMap[color]}`}>
        <Icon size={22} strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide opacity-70">
          {label}
        </p>
        <p className="text-2xl font-bold mt-0.5 leading-none">{formatted}</p>
        {unit && (
          <p className="text-sm opacity-60 mt-1 leading-tight">{unit}</p>
        )}
      </div>
    </div>
  );
}
