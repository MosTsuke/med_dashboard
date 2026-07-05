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
import { ArrowLeft, Package, DollarSign, Layers, CalendarCheck } from "lucide-react";
import ReportSectionHeader from "@/components/ReportSectionHeader";
import StatCard from "@/components/StatCard";
import { formatNumber } from "@/lib/formatNumber";
import { formatMonthLabel } from "@/lib/monthlyView";
import type { ItemData, ValueKind } from "@/types";

interface Props {
  item: ItemData;
  /** Full fiscal-year month order (e.g. ["2567-10", ..., "2568-09"]) so the
   * chart/table always shows all 12 months in the right order, regardless
   * of which single month happens to be selected elsewhere in the app. */
  monthOrder: string[];
  onBack: () => void;
  /** Relabels the price-shaped fields for non-monetary reports (e.g.
   * "สถิติล้าง" tracks pieces-per-set, not baht). */
  valueKind?: ValueKind;
}

const makeTooltip = (quantityUnit: string) =>
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
          <p className="font-medium text-gray-700">{label}</p>
          <p className="text-blue-600 font-bold">
            {formatNumber(payload[0].value)} {quantityUnit}
          </p>
        </div>
      );
    }
    return null;
  };

export default function ItemMonthlyDetail({ item, monthOrder, onBack, valueKind }: Props) {
  const isMonetary = valueKind?.isMonetary ?? true;
  const perUnitLabel = valueKind?.perUnitLabel ?? "ราคา/หน่วย";
  const totalLabel = valueKind?.totalLabel ?? "ราคารวม";
  const decimals = valueKind?.decimals ?? 2;
  const unit = valueKind?.unit ?? "บาท";
  const quantityUnit = valueKind?.quantityUnit ?? "ชิ้น";
  const CustomTooltip = makeTooltip(quantityUnit);

  // "pricePerUnit" is only a real per-piece rate when the report is
  // monetary — multiplying it by monthly quantity gives baht spent that
  // month. When it's a ratio like "จำนวนชิ้น/เซต" (pieces per set),
  // quantity × ratio isn't a meaningful number, so we don't compute or show
  // a derived monthly total in that case. The yearly total shown in the
  // stat card always comes straight from the file (`item.totalPrice`)
  // rather than being re-derived here, so it stays reconciled.
  const rows = monthOrder.map((month) => {
    const quantity = item.monthlyQuantity?.[month] ?? 0;
    return {
      month,
      label: formatMonthLabel(month),
      quantity,
      monthlyTotal: isMonetary ? quantity * item.pricePerUnit : null,
    };
  });

  const totalQuantity = rows.reduce((s, r) => s + r.quantity, 0);
  const activeMonths = rows.filter((r) => r.quantity > 0).length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
      <div className="p-5 border-b border-gray-100 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors shrink-0"
        >
          <ArrowLeft size={13} />
          กลับ
        </button>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-800 truncate">{item.name}</h2>
          <p className="text-xs text-gray-400">
            รายละเอียดรายเดือน ทั้งปีงบประมาณ ({monthOrder.length} เดือน)
          </p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard
            variant="report"
            icon={Package}
            label="จำนวนรวมทั้งปี"
            value={totalQuantity}
            unit={quantityUnit}
            color="blue"
          />
          <StatCard
            variant="report"
            icon={isMonetary ? DollarSign : Layers}
            label={valueKind ? `${totalLabel}ทั้งปี` : "ราคารวมทั้งปี"}
            value={item.totalPrice}
            decimals={decimals}
            unit={unit}
            color="green"
          />
          <StatCard
            variant="report"
            icon={CalendarCheck}
            label="เดือนที่มีการใช้งาน"
            value={activeMonths}
            unit={`จาก ${monthOrder.length} เดือน`}
            color="purple"
          />
        </div>

        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <ReportSectionHeader title={`แนวโน้มรายเดือน — ${item.name}`} />
          <div className="p-5">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={rows}
                margin={{ top: 10, right: 16, left: 4, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} />
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

        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  เดือน
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  จำนวน
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {perUnitLabel}
                </th>
                {isMonetary && (
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {totalLabel}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const empty = r.quantity === 0;
                return (
                  <tr key={r.month} className={empty ? "text-gray-300" : ""}>
                    <td className="px-4 py-2.5">{r.label}</td>
                    <td
                      className={`px-4 py-2.5 text-right font-medium ${empty ? "" : "text-blue-700"}`}
                    >
                      {formatNumber(r.quantity)}
                    </td>
                    <td className={`px-4 py-2.5 text-right ${empty ? "" : "text-gray-500"}`}>
                      {formatNumber(item.pricePerUnit, { decimals })}
                    </td>
                    {isMonetary && (
                      <td className={`px-4 py-2.5 text-right ${empty ? "" : "text-gray-500"}`}>
                        {formatNumber(r.monthlyTotal ?? 0, { decimals })}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
