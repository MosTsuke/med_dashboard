import {
  Package,
  Building2,
  ClipboardList,
  Banknote,
  DollarSign,
} from "lucide-react";
import StatCard from "@/components/StatCard";
import type { SummaryStats } from "@/types";

interface Props {
  summary: SummaryStats;
  className?: string;
}

export default function ReportSummaryCards({ summary, className = "" }: Props) {
  return (
    <div
      className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 ${className}`}
    >
      <StatCard
        variant="report"
        icon={Package}
        label="จำนวนรวมทั้งหมด"
        value={summary.totalItems}
        unit="ชิ้น"
        color="blue"
      />
      <StatCard
        variant="report"
        icon={Building2}
        label="หน่วยงานทั้งหมด"
        value={summary.totalDepartments || "—"}
        unit={summary.totalDepartments ? "หน่วยงาน" : ""}
        color="green"
      />
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
        icon={Banknote}
        label="ราคา/หน่วย"
        value={summary.pricePerUnit}
        decimals={2}
        unit="บาท"
        color="amber"
      />
      <StatCard
        variant="report"
        icon={DollarSign}
        label="ราคารวมทั้งหมด"
        value={summary.totalPrice}
        decimals={2}
        unit="บาท"
        color="blue"
      />
    </div>
  );
}
