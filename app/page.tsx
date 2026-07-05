"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import {
  Package,
  CalendarDays,
  UploadCloud,
  LayoutDashboard,
  TableProperties,
  ListTree,
  X,
  Printer,
  Loader2,
  CalendarRange,
  Building2,
} from "lucide-react";

import PDFUploader, { type FileUploaderHandle } from "@/components/PDFUploader";
import DashboardReportView from "@/components/DashboardReportView";
import ReportSummaryCards from "@/components/ReportSummaryCards";
import DepartmentTable from "@/components/DepartmentTable";
import ItemTable from "@/components/ItemTable";
import ItemMonthlyDetail from "@/components/ItemMonthlyDetail";
import SearchableSelect from "@/components/SearchableSelect";
import { exportReportPdf } from "@/lib/exportReportPdf";
import {
  sliceByMonth,
  sliceByDepartment,
  formatMonthLabel,
  formatPeriodValue,
  ALL_MONTHS,
  ALL_DEPARTMENTS,
  type MonthFilter,
  type DepartmentFilter,
} from "@/lib/monthlyView";

import type { DashboardData, ItemData } from "@/types";

type Tab = "dashboard" | "detail" | "subdetail";

/** เปิดเป็น true เมื่อพร้อมใช้งาน export PDF อีกครั้ง */
const ENABLE_PDF_EXPORT = false;

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<MonthFilter>(ALL_MONTHS);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentFilter>(ALL_DEPARTMENTS);
  const [selectedItem, setSelectedItem] = useState<ItemData | null>(null);
  const [autoLoadState, setAutoLoadState] = useState<"idle" | "loading" | "error">("idle");
  const [autoLoadError, setAutoLoadError] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const uploaderRef = useRef<FileUploaderHandle>(null);

  /** Lets another local app (e.g. a PHP page listing xlsx files) deep-link
   * straight into a report, two ways:
   *
   * 1. `/?src=<url-encoded xlsx URL>` — this page's own server fetches
   *    that URL and parses it. Simple, but only works if the file is
   *    reachable by a plain HTTP fetch (no login/session required).
   *
   * 2. Opened via `window.open()` with no `src` — the opener tab (e.g. a
   *    PHP page that already has the user's session/cookies and reads the
   *    file bytes itself) sends the raw xlsx bytes directly over
   *    `postMessage`, so the browser never has to download the file to
   *    disk or hit a public URL at all. This tab pings the opener with
   *    `{ type: "dashboard-ready" }` first so the opener knows when it's
   *    safe to send the file — see DEPLOY.md for the matching PHP-side
   *    snippet.
   */
  useEffect(() => {
    const src = new URLSearchParams(window.location.search).get("src");

    if (src) {
      let cancelled = false;
      setAutoLoadState("loading");
      fetch(`/api/parse-xlsx?src=${encodeURIComponent(src)}`)
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "เกิดข้อผิดพลาดในการอ่านไฟล์");
          }
          return (await res.json()) as DashboardData;
        })
        .then((d) => {
          if (cancelled) return;
          handleDataLoaded(d);
          setAutoLoadState("idle");
        })
        .catch((e) => {
          if (cancelled) return;
          setAutoLoadError(e instanceof Error ? e.message : "ไม่สามารถโหลดไฟล์ได้");
          setAutoLoadState("error");
        });

      return () => {
        cancelled = true;
      };
    }

    if (!window.opener) return;

    let cancelled = false;
    const trustedOrigin = process.env.NEXT_PUBLIC_TRUSTED_OPENER_ORIGIN;

    const sendToParser = (buffer: ArrayBuffer, name: string) => {
      const file = new File([buffer], name || "report.xlsx");
      const form = new FormData();
      form.append("file", file);

      fetch("/api/parse-xlsx", { method: "POST", body: form })
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "เกิดข้อผิดพลาดในการอ่านไฟล์");
          }
          return (await res.json()) as DashboardData;
        })
        .then((d) => {
          if (cancelled) return;
          handleDataLoaded(d);
          setAutoLoadState("idle");
        })
        .catch((e) => {
          if (cancelled) return;
          setAutoLoadError(e instanceof Error ? e.message : "ไม่สามารถโหลดไฟล์ได้");
          setAutoLoadState("error");
        });
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window.opener) return;
      if (trustedOrigin && event.origin !== trustedOrigin) return;
      if (event.data?.type !== "xlsx-file" || !event.data.buffer) return;
      clearTimeout(timeoutId);
      window.removeEventListener("message", handleMessage);
      sendToParser(event.data.buffer, event.data.name);
    };

    window.addEventListener("message", handleMessage);
    setAutoLoadState("loading");
    // Tell the opener we're ready — it should wait for this before posting
    // the file so the message isn't sent before this listener exists.
    window.opener.postMessage({ type: "dashboard-ready" }, trustedOrigin || "*");

    // A stray opener that never sends a file (e.g. an unrelated tab that
    // happened to open this one) shouldn't leave the page stuck loading.
    const timeoutId = setTimeout(() => {
      if (!cancelled) setAutoLoadState("idle");
    }, 15000);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      window.removeEventListener("message", handleMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Switching away from "รายละเอียดย่อย" (by any route — tab click, back
   * button, etc.) clears the selected item so the tab goes back to disabled
   * until the user picks a row again. */
  const handleTabChange = (next: Tab) => {
    if (tab === "subdetail" && next !== "subdetail") {
      setSelectedItem(null);
    }
    setTab(next);
  };

  const handleDataLoaded = (d: DashboardData) => {
    setData(d);
    setTab("dashboard");
    setSelectedMonth(ALL_MONTHS);
    setSelectedDepartment(ALL_DEPARTMENTS);
    setSelectedItem(null);
  };

  const handleClearData = () => {
    setData(null);
    setTab("dashboard");
    setSelectedMonth(ALL_MONTHS);
    setSelectedDepartment(ALL_DEPARTMENTS);
    setSelectedItem(null);
  };

  const hasMonthlyData = (data?.reportType === "monthly") && (data?.monthly?.length ?? 0) > 0;
  const hasDepartmentFilter = (data?.departments?.length ?? 0) > 0;

  const viewData = useMemo(() => {
    if (!data) return null;
    return sliceByDepartment(sliceByMonth(data, selectedMonth), selectedDepartment);
  }, [data, selectedMonth, selectedDepartment]);

  const hasItems = (viewData?.items?.length ?? 0) > 0;
  const hasDepartments = (viewData?.departments?.length ?? 0) > 0;

  const handleImportClick = () => {
    uploaderRef.current?.openFilePicker();
  };

  const handleMonthClick = (month: string) => {
    setSelectedMonth(month);
    handleTabChange("detail");
  };

  const handleItemClick = (item: ItemData) => {
    // `item` may come from a month-sliced view (`viewData.items`), whose
    // quantity/totalPrice are recomputed for that single month only. The
    // sub-detail view always shows the full fiscal year, so look up the
    // matching full-year item from the unsliced `data`. `monthlyQuantity`
    // is spread by reference in `sliceByMonth`, so it's a reliable key even
    // when item names collide (e.g. blank-name placeholder rows).
    const fullYearItem =
      data?.items.find((i) => i.monthlyQuantity === item.monthlyQuantity) ?? item;
    setSelectedItem(fullYearItem);
    setTab("subdetail");
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
                <span>
                  {formatPeriodValue(data.period.from)} – {formatPeriodValue(data.period.to)}
                </span>
              </div>
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
        {!data && autoLoadState === "loading" && (
          <div className="max-w-xl mx-auto py-24 text-center text-blue-600">
            <Loader2 size={32} className="animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium">กำลังโหลดไฟล์...</p>
          </div>
        )}
        {!data && autoLoadState !== "loading" && (
          <div className="space-y-2 max-w-xl mx-auto py-16">
            <div className="text-center mb-5">
              <div className="w-16 h-16 bg-white/70 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-white">
                <UploadCloud size={28} className="text-blue-400" />
              </div>
              <p className="text-gray-600 font-medium mb-1">ยังไม่มีข้อมูล</p>
              <p className="text-sm text-gray-400">กรุณานำเข้าไฟล์ Excel (.xlsx / .xls)</p>
            </div>
            {autoLoadState === "error" && autoLoadError && (
              <p className="text-xs text-red-500 text-center bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {autoLoadError}
              </p>
            )}
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
                  onClick={() => handleTabChange("dashboard")}
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
                  onClick={() => handleTabChange("detail")}
                  className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-all ${
                    tab === "detail"
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
                  }`}
                >
                  <TableProperties size={15} />
                  รายละเอียด
                </button>
                <button
                  onClick={() => selectedItem && setTab("subdetail")}
                  disabled={!selectedItem}
                  title={
                    selectedItem
                      ? `รายละเอียดรายเดือนของ "${selectedItem.name}"`
                      : "คลิกที่รายการในแท็บรายละเอียดก่อน เพื่อดูรายละเอียดย่อยของรายการนั้น"
                  }
                  className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-all ${
                    !selectedItem
                      ? "text-gray-300 cursor-not-allowed"
                      : tab === "subdetail"
                        ? "bg-white text-blue-700 shadow-sm"
                        : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
                  }`}
                >
                  <ListTree size={15} />
                  รายละเอียดย่อย
                </button>
              </div>

              <div className="flex items-center gap-2">
                {hasDepartmentFilter && tab !== "subdetail" && (
                  <SearchableSelect
                    icon={Building2}
                    value={selectedDepartment}
                    onChange={setSelectedDepartment}
                    searchPlaceholder="ค้นหาหน่วยงาน..."
                    options={[
                      { value: ALL_DEPARTMENTS, label: "ทุกหน่วยงาน" },
                      ...data!.departments.map((dep) => ({ value: dep.name, label: dep.name })),
                    ]}
                  />
                )}
                {hasMonthlyData && tab !== "subdetail" && (
                  <SearchableSelect
                    icon={CalendarRange}
                    value={selectedMonth}
                    onChange={setSelectedMonth}
                    widthClass="w-48"
                    searchPlaceholder="ค้นหาเดือน..."
                    options={[
                      { value: ALL_MONTHS, label: "ทั้งปี" },
                      ...data!.monthly!.map((m) => ({ value: m.month, label: formatMonthLabel(m.month) })),
                    ]}
                  />
                )}
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
            </div>

            {/* ── DASHBOARD TAB ── */}
            {tab === "dashboard" && viewData && (
              <DashboardReportView ref={reportRef} data={viewData} onMonthClick={handleMonthClick} />
            )}

            {/* ── DETAIL TAB ── */}
            {tab === "detail" && viewData && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-5 space-y-5">
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <ReportSummaryCards summary={viewData.summary} valueKind={viewData.valueKind} />
                </div>

                {hasItems ? (
                  <ItemTable
                    items={viewData.items}
                    onItemClick={handleItemClick}
                    valueKind={viewData.valueKind}
                  />
                ) : hasDepartments ? (
                  <DepartmentTable departments={viewData.departments} />
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-gray-400 shadow-sm">
                    <TableProperties size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">ไม่มีข้อมูลในไฟล์นี้</p>
                  </div>
                )}
              </div>
            )}

            {/* ── SUB-DETAIL TAB ── */}
            {tab === "subdetail" && selectedItem && data?.monthly && (
              <ItemMonthlyDetail
                item={selectedItem}
                monthOrder={data.monthly.map((m) => m.month)}
                onBack={() => handleTabChange("detail")}
                valueKind={data.valueKind}
              />
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
