"use client";

import { useState, useRef } from "react";
import {
  Package,
  CalendarDays,
  UploadCloud,
  LayoutDashboard,
  TableProperties,
  X,
  Printer,
  Loader2,
  Download,
} from "lucide-react";

import PDFUploader, { type FileUploaderHandle } from "@/components/PDFUploader";
import DashboardReportView from "@/components/DashboardReportView";
import ReportSummaryCards from "@/components/ReportSummaryCards";
import DepartmentTable from "@/components/DepartmentTable";
import ItemTable from "@/components/ItemTable";
import { exportReportPdf } from "@/lib/exportReportPdf";

import type { DashboardData } from "@/types";

type Tab = "dashboard" | "detail";

/** เปิดเป็น true เมื่อพร้อมใช้งาน export PDF อีกครั้ง */
const ENABLE_PDF_EXPORT = false;

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const uploaderRef = useRef<FileUploaderHandle>(null);

  const handleDataLoaded = (d: DashboardData) => {
    setData(d);
    setTab("dashboard");
  };

  const handleClearData = () => {
    setData(null);
    setTab("dashboard");
  };

  const hasItems = (data?.items?.length ?? 0) > 0;
  const hasDepartments = (data?.departments?.length ?? 0) > 0;

  const handleImportClick = () => {
    uploaderRef.current?.openFilePicker();
  };

  const handleExportPdf = async () => {
    if (!reportRef.current || exporting || !data) return;
    setExporting(true);
    try {
      await exportReportPdf(reportRef.current, {
        hospitalName: data.hospitalName,
        period: data.period,
      });
    } catch {
      alert("ไม่สามารถบันทึก PDF ได้ กรุณาลองอีกครั้ง");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #e8f0fe 0%, #f0f7ff 40%, #e8f5f0 100%)" }}>
      {/* Header */}
      <header className="bg-white/80 backdrop-blur border-b border-white/60 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {data?.logoUrl ? (
              <img
                src={data.logoUrl}
                alt="logo"
                className="w-9 h-9 rounded-xl object-contain border border-gray-100 shadow-sm bg-white"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-sm">
                <Package size={17} className="text-white" />
              </div>
            )}
            <div>
              <h1 className="text-sm font-bold text-gray-800 leading-tight">
                Med Dashboard
              </h1>
              <p className="text-xs text-gray-500 leading-snug max-w-md sm:max-w-lg">
                {data ? (
                  <>
                    {data.reportName?.trim() || "รายงาน"}
                    {data.hospitalName?.trim() &&
                      !(data.reportName?.trim() || "").includes(
                        data.hospitalName.trim()
                      ) && (
                        <span className="text-gray-400">
                          {" "}
                          · {data.hospitalName.trim()}
                        </span>
                      )}
                  </>
                ) : (
                  <span className="text-gray-400">ระบบติดตามรายงาน</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {data?.period && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                <CalendarDays size={12} />
                <span>{data.period.from} – {data.period.to}</span>
              </div>
            )}
            {data && (
              <a
                href="/template-data.xlsx"
                download="template-data.xlsx"
                title="ดาวน์โหลดเทมเพลตข้อมูล"
                className="flex items-center gap-1.5 text-xs text-gray-600 px-2.5 py-1.5 border border-gray-200 rounded-lg hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors"
              >
                <Download size={13} />
                ดาวน์โหลดเทมเพลต
              </a>
            )}
            {data && (
              <button
                onClick={handleClearData}
                title="ล้างข้อมูล"
                className="flex items-center gap-1.5 text-xs text-gray-500 px-2.5 py-1.5 border border-gray-200 rounded-lg hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
              >
                <X size={13} />
                ล้างข้อมูล
              </button>
            )}
            {data && (
              <button
                onClick={handleImportClick}
                disabled={importing}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {importing ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <UploadCloud size={13} />
                )}
                นำเข้าไฟล์ใหม่
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-5">

        {/* ตัวเลือกไฟล์ซ่อน — ใช้เมื่อมีข้อมูลแล้ว (กดปุ่ม header) */}
        {data && (
          <div className="sr-only" aria-hidden>
            <PDFUploader
              ref={uploaderRef}
              onDataLoaded={handleDataLoaded}
              onLoadingChange={setImporting}
            />
          </div>
        )}

        {/* กล่องนำเข้า — แสดงเฉพาะตอนยังไม่มีข้อมูล */}
        {!data && (
          <div className="space-y-2 max-w-xl mx-auto py-16">
            <div className="text-center mb-5">
              <div className="w-16 h-16 bg-white/70 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-white">
                <UploadCloud size={28} className="text-blue-400" />
              </div>
              <p className="text-gray-600 font-medium mb-1">ยังไม่มีข้อมูล</p>
              <p className="text-sm text-gray-400">กรุณานำเข้าไฟล์ Excel (.xlsx / .xls)</p>
              <a
                href="/template-data.xlsx"
                download="template-data.xlsx"
                className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-blue-600 px-4 py-2 border border-blue-200 bg-white/80 rounded-lg hover:bg-blue-50 transition-colors shadow-sm"
              >
                <Download size={16} />
                ดาวน์โหลดเทมเพลตข้อมูล
              </a>
            </div>
            <PDFUploader
              ref={uploaderRef}
              onDataLoaded={handleDataLoaded}
              onLoadingChange={setImporting}
            />
            <p className="text-xs text-gray-400 text-center">
              รองรับเฉพาะไฟล์ <span className="font-medium">.xlsx</span> และ{" "}
              <span className="font-medium">.xls</span>
            </p>
          </div>
        )}

        {/* Tab bar — shown only when data is loaded */}
        {data && (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-1 bg-white/60 backdrop-blur border border-white/80 rounded-xl p-1 w-fit shadow-sm">
                <button
                  onClick={() => setTab("dashboard")}
                  className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-all ${
                    tab === "dashboard"
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
                  }`}
                >
                  <LayoutDashboard size={15} />
                  Dashboard
                </button>
                <button
                  onClick={() => setTab("detail")}
                  className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-all ${
                    tab === "detail"
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
                  }`}
                >
                  <TableProperties size={15} />
                  รายละเอียด
                </button>
              </div>
              {ENABLE_PDF_EXPORT && tab === "dashboard" && (
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={exporting}
                  title="บันทึกเป็น PDF"
                  className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 bg-white/80 backdrop-blur text-gray-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors shadow-sm disabled:opacity-50 shrink-0"
                >
                  {exporting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Printer size={18} />
                  )}
                </button>
              )}
            </div>

            {/* ── DASHBOARD TAB ── */}
            {tab === "dashboard" && data && (
              <DashboardReportView ref={reportRef} data={data} />
            )}

            {/* ── DETAIL TAB ── */}
            {tab === "detail" && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-5 space-y-5">
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <ReportSummaryCards summary={data.summary} />
                </div>

                {hasItems ? (
                  <ItemTable items={data.items} />
                ) : hasDepartments ? (
                  <DepartmentTable departments={data.departments} />
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-gray-400 shadow-sm">
                    <TableProperties size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">ไม่มีข้อมูลในไฟล์นี้</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="text-center py-6 text-xs text-gray-400">
        Med Dashboard{data?.hospitalName ? ` · ${data.hospitalName}` : ""}{data?.fiscalYear ? ` · ปีงบประมาณ ${data.fiscalYear}` : ""}
      </footer>
    </div>
  );
}
