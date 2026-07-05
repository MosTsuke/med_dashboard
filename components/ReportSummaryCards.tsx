import {
  Package,
  Building2,
  ClipboardList,
  DollarSign,
  Layers,
} from "lucide-react";
import StatCard from "@/components/StatCard";
import type { SummaryStats, ValueKind } from "@/types";

interface Props {
  summary: SummaryStats;
  valueKind?: ValueKind;
  className?: string;
}

export default function ReportSummaryCards({ summary, valueKind, className = "" }: Props) {
  const hasDepartments = summary.totalDepartments > 0;
  const isMonetary = valueKind?.isMonetary ?? true;

  return (
    <div
      className={`grid grid-cols-2 md:grid-cols-3 ${hasDepartments ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-3 ${className}`}
    >
      <StatCard
        variant="report"
        icon={Package}
        label="จำนวนรวมทั้งหมด"
        value={summary.totalItems}
        unit={valueKind?.quantityUnit ?? "ชิ้น"}
        color="blue"
      />
      {hasDepartments && (
        <StatCard
          variant="report"
          icon={Building2}
          label="หน่วยงานทั้งหมด"
          value={summary.totalDepartments}
          unit="หน่วยงาน"
          color="green"
        />
      )}
      <StatCard
        variant="report"
        icon={ClipboardList}
        label="รายการ (Set)"
        value={summary.totalSets}
        unit="รายการ"
        color="purple"
      />
      <StatCard
        variant="report"
        icon={isMonetary ? DollarSign : Layers}
        label={valueKind ? `${valueKind.totalLabel}ทั้งหมด` : "ราคารวมทั้งหมด"}
        value={summary.totalPrice}
        decimals={valueKind?.decimals ?? 2}
        unit={valueKind?.unit ?? "บาท"}
        color="blue"
      />
    </div>
  );
}
