"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ImagePlus, Loader2, Package, Pencil, Trash2, X } from "lucide-react";
import { saveBranding } from "@/lib/db/clientApi";
import { DEFAULT_TITLE, LOGO_TYPES, MAX_HOSPITAL_NAME, MAX_LOGO_BYTES, type BrandingInfo } from "@/lib/brandingTypes";

/** The small pencil beside the title that opens the dialog. */
export function BrandingEditButton({ branding, onSaved, disabled }: { branding: BrandingInfo; onSaved: (b: BrandingInfo) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        aria-disabled={disabled}
        aria-label="เปลี่ยนชื่อและโลโก้"
        title={disabled ? branding.reason : "เปลี่ยนชื่อและโลโก้"}
        className={`p-1 rounded-md transition-colors ${
          disabled ? "text-gray-200 cursor-not-allowed" : "text-gray-300 hover:text-blue-600 hover:bg-blue-50"
        }`}
      >
        <Pencil size={13} />
      </button>
      {open &&
        createPortal(
          <BrandingDialog
            branding={branding}
            onClose={() => setOpen(false)}
            onSaved={(b) => {
              onSaved(b);
              setOpen(false);
            }}
          />,
          document.body
        )}
    </>
  );
}

/**
 * "เปลี่ยนชื่อและโลโก้": the name shown instead of "Med Dashboard" and the
 * logo beside it, for every computer that opens this dashboard. Needs the
 * admin password set in dashboard.env on the server.
 */
function BrandingDialog({
  branding,
  onClose,
  onSaved,
}: {
  branding: BrandingInfo;
  onClose: () => void;
  onSaved: (b: BrandingInfo) => void;
}) {
  const [name, setName] = useState(branding.hospitalName ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const locked = !branding.editable || busy;

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const pick = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!(LOGO_TYPES as readonly string[]).includes(f.type)) return setError("โลโก้ต้องเป็นไฟล์รูป PNG, JPG หรือ WebP");
    if (f.size > MAX_LOGO_BYTES) return setError("ไฟล์โลโก้ใหญ่เกิน 1 MB");
    setFile(f);
    setRemoveLogo(false);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("password", password);
      form.set("hospitalName", name);
      if (file) form.set("logo", file);
      if (removeLogo) form.set("removeLogo", "1");
      onSaved(await saveBranding(form));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const shownLogo = preview ?? (removeLogo ? null : branding.logoUrl);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:pt-20"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label="เปลี่ยนชื่อและโลโก้" className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-800">เปลี่ยนชื่อและโลโก้</h2>
            <p className="text-sm text-gray-500 mt-1">แสดงแทนคำว่า {DEFAULT_TITLE} ทุกเครื่องที่เปิด dashboard นี้</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="ปิด" className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        {!branding.editable && branding.reason && (
          <p className="flex items-start gap-1.5 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            {branding.reason}
          </p>
        )}

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">ชื่อที่แสดง</span>
          <input
            type="text"
            value={name}
            maxLength={MAX_HOSPITAL_NAME}
            disabled={locked}
            onChange={(e) => setName(e.target.value)}
            placeholder="ชื่อโรงพยาบาล"
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 disabled:bg-gray-50"
          />
          <span className="block text-xs text-gray-400">เว้นว่างไว้ = ใช้ชื่อ {DEFAULT_TITLE}</span>
        </label>

        <div className="space-y-2">
          <span className="text-sm font-medium text-gray-700">โลโก้</span>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl border border-gray-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
              {shownLogo ? (
                <img src={shownLogo} alt="โลโก้" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                  <Package size={22} className="text-white" />
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={locked}
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <ImagePlus size={15} /> เลือกรูป...
              </button>
              {(branding.logoUrl || file) && !removeLogo && (
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    setFile(null);
                    setRemoveLogo(!!branding.logoUrl);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 size={15} /> เอาโลโก้ออก
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept={LOGO_TYPES.join(",")}
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </div>
          <span className="block text-xs text-gray-400">PNG, JPG หรือ WebP ไม่เกิน 1 MB · รูปสี่เหลี่ยมจัตุรัสดูดีที่สุด</span>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">รหัสผู้ดูแล</span>
          <input
            type="password"
            value={password}
            disabled={locked}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && password && !locked && save()}
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 disabled:bg-gray-50"
          />
          <span className="block text-xs text-gray-400">รหัสที่ตั้งไว้ใน dashboard.env บนเครื่องที่ติดตั้ง</span>
        </label>

        {error && (
          <p className="flex items-start gap-1.5 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="text-sm px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100">
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={save}
            disabled={locked || !password}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}
