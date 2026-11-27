"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, FileDown, Loader2, X } from "lucide-react";
import PeriodPicker, { periodError, type PeriodBounds } from "@/components/PeriodPicker";
import { fetchBranding, fetchReportYears } from "@/lib/db/clientApi";
import { formatNumber } from "@/lib/formatNumber";
import { MAX_EXPORT_DAYS, type ExportPayload, type OfflineFile } from "@/lib/offline/format";
import { DATA_PLACEHOLDER, packOfflineFile } from "@/lib/offline/pack";
import { offlineFile } from "@/lib/offline/source";
import { DB_REPORT_KINDS } from "@/lib/supply/reports";
import { fiscalYearPeriod, periodLabel, periodRange } from "@/lib/supply/shape";
import type { DbPeriod, DbReportKind } from "@/types";

interface Props {
  /** What the file opens on: the report and period on screen now. */
  currentReport?: DbReportKind | null;
  currentPeriod?: DbPeriod | null;
}

type Step = { kind: "idle" } | { kind: "busy"; text: string } | { kind: "done"; name: string; size: number } | { kind: "error"; text: string };

const DAY = 86_400_000;

/** Every report's span together, for the period picker. */
function mergeBounds(list: PeriodBounds[]): PeriodBounds {
  const dates = (pick: (b: PeriodBounds) => string | null) =>
    list.map(pick).filter((d): d is string => !!d).sort();
  const mins = dates((b) => b.minDate);
  const maxes = dates((b) => b.maxDate);
  const years = Array.from(new Set(list.flatMap((b) => b.years))).sort((a, b) => b - a);
  return { years, minDate: mins[0] ?? null, maxDate: maxes[maxes.length - 1] ?? null };
}

/**
 * "ส่งออก HTML": one .html file with all four reports for a chosen range,
 * that opens anywhere without the database and works like the dashboard
 * itself — every tab, filter and button (see lib/offline/).
 */
export default function ExportHtmlButton({ currentReport, currentPeriod }: Props) {
  const [open, setOpen] = useState(false);
  const insideFile = offlineFile() != null;
  return (
    <>
      <button
        type="button"
        onClick={() => !insideFile && setOpen(true)}
        aria-disabled={insideFile}
        title={insideFile ? "ส่งออกได้จากเครื่องที่ต่อฐานข้อมูลเท่านั้น" : "บันทึกข้อมูลเป็นไฟล์ HTML ไว้เปิดดูที่เครื่องอื่น"}
        className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white transition-colors ${
          insideFile ? "text-gray-300 cursor-not-allowed" : "text-gray-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
        }`}
      >
        <FileDown size={13} />
        ส่งออก HTML
      </button>
      {/* At the page root: the header's backdrop blur would otherwise make
          the header the box the dialog is fixed to. */}
      {open &&
        createPortal(
          <ExportDialog
            report={currentReport ?? "supply"}
            initialPeriod={currentPeriod ?? null}
            onClose={() => setOpen(false)}
          />,
          document.body
        )}
    </>
  );
}

function ExportDialog({
  report,
  initialPeriod,
  onClose,
}: {
  report: DbReportKind;
  initialPeriod: DbPeriod | null;
  onClose: () => void;
}) {
  const [bounds, setBounds] = useState<PeriodBounds | null>(null);
  const [boundsError, setBoundsError] = useState<string | null>(null);
  const [period, setPeriod] = useState<DbPeriod | null>(initialPeriod);
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const busy = step.kind === "busy";

  useEffect(() => {
    Promise.all(DB_REPORT_KINDS.map((k) => fetchReportYears(k)))
      .then((list) => {
        const merged = mergeBounds(list);
        setBounds(merged);
        setPeriod((p) => p ?? (merged.years.length ? fiscalYearPeriod(merged.years[0]) : null));
      })
      .catch((e) => setBoundsError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const invalid = (p: DbPeriod | null): string | null => {
    if (!p) return "เลือกช่วงเวลา";
    const e = periodError(p);
    if (e) return e;
    const { from, to } = periodRange(p);
    return (to.getTime() - from.getTime()) / DAY > MAX_EXPORT_DAYS ? "ส่งออกได้ครั้งละไม่เกิน 3 ปี เลือกช่วงให้สั้นลง" : null;
  };
  const problem = period ? invalid(period) : null;

  const run = async (p: DbPeriod) => {
    try {
      setStep({ kind: "busy", text: "กำลังเตรียมหน้าจอ..." });
      const templateRes = await fetch("/offline-viewer.html", { cache: "no-store" });
      if (!templateRes.ok) throw new Error("ไม่พบตัวแสดงผลออฟไลน์ (offline-viewer.html) ให้สร้างโปรแกรมใหม่ด้วย npm run build");
      const template = await templateRes.text();
      if (!template.includes(DATA_PLACEHOLDER)) throw new Error("ตัวแสดงผลออฟไลน์ไม่ถูกต้อง");

      setStep({ kind: "busy", text: "กำลังดึงข้อมูลทั้ง 4 สถิติ... (ช่วงยาวอาจใช้เวลาเป็นนาที)" });
      const qs = new URLSearchParams({ from: p.from, to: p.to });
      const res = await fetch(`/api/db/export?${qs}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "ดึงข้อมูลไม่สำเร็จ");
      const payload = body as ExportPayload;

      setStep({ kind: "busy", text: "กำลังสร้างไฟล์..." });
      const branding = await fetchBranding().catch(() => null);
      const file: OfflineFile = {
        ...payload,
        origin: window.location.origin,
        start: { report, period: p },
        branding: {
          hospitalName: branding?.hospitalName ?? null,
          logoDataUrl: branding?.logoUrl ? await dataUrlOf(branding.logoUrl) : null,
        },
      };
      const data = await packOfflineFile(file);
      // The first placeholder is the data's slot (the bundled code below it
      // mentions the same text, so only the first one is replaced).
      const at = template.indexOf(DATA_PLACEHOLDER);
      const blob = new Blob([template.slice(0, at), data, template.slice(at + DATA_PLACEHOLDER.length)], {
        type: "text/html;charset=utf-8",
      });
      const name = `med-dashboard_${p.from}_${p.to}.html`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setStep({ kind: "done", name, size: blob.size });
    } catch (e) {
      setStep({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:pt-20"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label="ส่งออกเป็นไฟล์ HTML" className="w-full max-w-xl bg-white rounded-2xl shadow-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800">
              <FileDown size={18} className="text-blue-600" />
              ส่งออกเป็นไฟล์ HTML
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              ได้ไฟล์เดียว เปิดดูที่เครื่องอื่นได้โดยไม่ต้องต่อฐานข้อมูล ทุกหน้าและทุกปุ่มใช้ได้เหมือนที่นี่
              โดยมีข้อมูลทั้ง 4 สถิติเฉพาะช่วงที่เลือก
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="ปิด"
            className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {boundsError ? (
          <p className="flex items-start gap-1.5 text-sm text-red-600">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            {boundsError}
          </p>
        ) : !bounds || !period ? (
          <p className="flex items-center gap-2 text-sm text-gray-500 py-4">
            <Loader2 size={16} className="animate-spin" /> กำลังโหลดช่วงที่มีข้อมูล...
          </p>
        ) : (
          <>
            <YearShortcuts years={bounds.years} value={period} onChange={setPeriod} disabled={busy} />
            <PeriodPicker bounds={bounds} value={period} onChange={setPeriod} disabled={busy} />
            <ul className="text-xs text-gray-500 space-y-0.5 list-disc pl-4">
              <li>ส่งออกได้ครั้งละไม่เกิน 3 ปี ช่วงยิ่งยาวไฟล์ยิ่งใหญ่ (ปีละหลาย MB)</li>
              <li>ไฟล์เปิดมาที่รายงานและการแบ่งช่วง (รายวัน/รายเดือน/รายปี) ตามที่เลือก ในไฟล์เลือกช่วงย่อยได้เฉพาะในช่วงนี้</li>
              <li>ข้อมูลเป็นของ ณ ตอนกดส่งออก ไม่อัปเดตเอง ใครได้ไฟล์ก็เห็นข้อมูลทั้งหมดในไฟล์ รวมชื่อเจ้าหน้าที่ในแท็บรายการ</li>
            </ul>
            {problem && <p className="text-sm text-red-600">{problem}</p>}
            <button
              type="button"
              onClick={() => run(period)}
              disabled={busy || problem != null}
              className="w-full flex items-center justify-center gap-2 text-base font-medium px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />}
              สร้างไฟล์ HTML · {periodLabel(period)}
            </button>
          </>
        )}

        {step.kind === "busy" && <p className="text-sm text-gray-600 text-center">{step.text}</p>}
        {step.kind === "done" && (
          <p className="flex items-start gap-1.5 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <span>
              บันทึกไฟล์ <span className="font-medium">{step.name}</span> แล้ว (
              {formatNumber(step.size / 1_048_576, { decimals: 1 })} MB) ดูได้ในโฟลเดอร์ดาวน์โหลด
            </span>
          </p>
        )}
        {step.kind === "error" && (
          <p className="flex items-start gap-1.5 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            {step.text}
          </p>
        )}
      </div>
    </div>
  );
}

/** The latest 1, 2 or 3 fiscal years in one click — 2 or 3 of them let the
 * file's "เปรียบเทียบปีงบ" compare those years. Month by month, so the
 * file stays within the per-grain limits. */
function YearShortcuts({
  years,
  value,
  onChange,
  disabled,
}: {
  years: number[];
  value: DbPeriod;
  onChange: (p: DbPeriod) => void;
  disabled: boolean;
}) {
  const latest = years[0];
  if (latest == null) return null;
  const choices = [1, 2, 3]
    .filter((n) => n <= years.length)
    .map((n) => ({
      n,
      period: { from: fiscalYearPeriod(latest - n + 1).from, to: fiscalYearPeriod(latest).to, grain: "month" as const },
      label: n === 1 ? `ปีงบ ${latest}` : `${n} ปีงบล่าสุด (${latest - n + 1}–${latest})`,
    }));
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="เลือกทั้งปีงบ">
        {choices.map((c) => {
          const on = value.from === c.period.from && value.to === c.period.to;
          return (
            <button
              key={c.n}
              type="button"
              aria-pressed={on}
              disabled={disabled}
              onClick={() => onChange(c.period)}
              className={`text-sm px-3.5 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${
                on
                  ? "bg-blue-50 border-blue-300 text-blue-700 font-medium"
                  : "bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-gray-900"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>
      {years.length >= 2 && (
        <p className="text-xs text-gray-500">ส่งออก 2–3 ปีงบ เพื่อให้แท็บ &quot;เปรียบเทียบปีงบ&quot; ในไฟล์เทียบปีเหล่านั้นได้</p>
      )}
    </div>
  );
}

/** The logo as a data: URL, so the exported file carries it; null if it
 * can't be read. */
async function dataUrlOf(url: string): Promise<string | null> {
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
