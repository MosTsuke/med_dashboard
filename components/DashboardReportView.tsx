"use client";

import { forwardRef } from "react";
import { CalendarDays } from "lucide-react";

import LogoPlaceholder from "@/components/LogoPlaceholder";
import ReportNote, { REPORT_BANNER_BG, REPORT_TEXT_COLOR } from "@/components/ReportNote";
import { formatNumber } from "@/lib/formatNumber";
import ReportSummaryCards from "@/components/ReportSummaryCards";
import DepartmentBarChart from "@/components/DepartmentBarChart";
import DepartmentPieChart from "@/components/DepartmentPieChart";
import Top5Card from "@/components/Top5Card";
import TopItemsCard from "@/components/TopItemsCard";
import ItemBarChart from "@/components/ItemBarChart";
import ItemPieChart from "@/components/ItemPieChart";
import MonthlyTrendChart from "@/components/MonthlyTrendChart";
import { formatPeriodValue } from "@/lib/monthlyView";
import type { DashboardData } from "@/types";

interface Props {
  data: DashboardData;
  onMonthClick?: (month: string) => void;
}

const reportTitles: Record<DashboardData["reportType"], string> = {
  summary: "สรุปผลแยกตามหน่วยงาน",
  items: "รายงานตามปริมาณ",
  monthly: "สถิติรายเดือน",
  unknown: "รายงานสรุปผล",
};

const DashboardReportView = forwardRef<HTMLDivElement, Props>(
  function DashboardReportView({ data, onMonthClick }, ref) {
  const hasDepartments = data.departments.length > 0;
  const title =
    data.reportName?.trim() || reportTitles[data.reportType];
  const hospital = data.hospitalName?.trim() ?? "";
  const showHospital =
    hospital.length > 0 && !title.includes(hospital);

  return (
    <div
      ref={ref}
      data-report-export
      className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden"
    >
      {/* Header: Logo + Title Banner */}
      <div className="p-5 md:p-6 pb-0">
        <div className="flex items-start gap-4">
          {data.logoUrl && <LogoPlaceholder src={data.logoUrl} />}
          <div className="flex-1 min-w-0">
            <div
              className={`${REPORT_BANNER_BG} rounded-xl px-5 py-4 text-center shadow-sm`}
            >
              <h2 className="report-title text-base md:text-lg font-bold text-white leading-snug">
                {title}
                {showHospital && (
                  <>
                    {" "}
                    <span className="text-yellow-300">{hospital}</span>
                  </>
                )}
              </h2>
            </div>
            {data.period && (
              <div className="flex justify-center mt-2.5">
                <ReportNote className="text-xs md:text-sm">
                  <CalendarDays size={13} className="shrink-0" />
                  <span className="font-semibold">
                    {data.reportType === "monthly" ? "เดือน" : "วันที่"}{" "}
                    {formatPeriodValue(data.period.from)} ถึง {formatPeriodValue(data.period.to)}
                    {data.fiscalYear && ` (ปีงบประมาณ ${data.fiscalYear})`}
                  </span>
                </ReportNote>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mx-5 md:mx-6 mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <ReportSummaryCards
          summary={data.summary}
          valueKind={data.valueKind}
          className="report-stats-grid"
        />
      </div>

      {/* Charts */}
      {hasDepartments ? (
        <div className="px-5 md:px-6 pb-6">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="report-charts-grid grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="report-charts-main lg:col-span-2 space-y-2">
                <DepartmentBarChart data={data.departments} />
                <p className={`px-1 text-xs leading-relaxed ${REPORT_TEXT_COLOR}`}>
                  <strong className="font-semibold">หมายเหตุ :</strong> ราคา/หน่วย และ
                  ราคารวม ของทุกรายการเท่ากับ{" "}
                  {formatNumber(data.summary.pricePerUnit, { decimals: 2 })} บาท
                </p>
              </div>
              <div className="space-y-4">
                <Top5Card data={data.departments} />
                <DepartmentPieChart
                  data={data.departments}
                  total={data.summary.totalItems}
                />
              </div>
            </div>
          </div>
        </div>
      ) : data.reportType === "monthly" && (data.monthly?.length ?? 0) > 0 ? (
        <div className="px-5 md:px-6 pb-6">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
            <MonthlyTrendChart
              data={data.monthly!}
              onMonthClick={onMonthClick}
              unit={data.valueKind?.quantityUnit}
            />
            <div className="report-charts-grid grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="report-charts-main lg:col-span-2">
                <ItemBarChart data={data.items} unit={data.valueKind?.quantityUnit} />
              </div>
              <div className="space-y-4">
                <TopItemsCard data={data.items} unit={data.valueKind?.quantityUnit} />
                <ItemPieChart
                  data={data.items}
                  total={data.summary.totalItems}
                  unit={data.valueKind?.quantityUnit}
                />
              </div>
            </div>
          </div>
        </div>
      ) : data.items.length > 0 ? (
        <div className="px-5 md:px-6 pb-6">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="report-charts-grid grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="report-charts-main lg:col-span-2">
                <ItemBarChart data={data.items} unit={data.valueKind?.quantityUnit} />
              </div>
              <div className="space-y-4">
                <TopItemsCard data={data.items} unit={data.valueKind?.quantityUnit} />
                <ItemPieChart
                  data={data.items}
                  total={data.summary.totalItems}
                  unit={data.valueKind?.quantityUnit}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-5 md:px-6 pb-6">
          <div className="border border-dashed border-gray-200 rounded-xl p-10 text-center text-gray-400 bg-gray-50/50">
            <p className="text-sm">
              ไฟล์นี้เป็นรายงานรายการอุปกรณ์ — ดูข้อมูลได้ที่แท็บ{" "}
              <span className="font-medium text-gray-500">รายละเอียด</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

export default DashboardReportView;
