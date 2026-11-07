"use client";

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Upload, FileSpreadsheet, Loader2, AlertCircle } from "lucide-react";
import type { DashboardData } from "@/types";

interface Props {
  onDataLoaded: (data: DashboardData) => void;
  onLoadingChange?: (loading: boolean) => void;
  /** "full" = big drop zone (Excel is the only way in); "compact" = a
   * one-line secondary option under the database box. */
  variant?: "full" | "compact";
}

export interface FileUploaderHandle {
  openFilePicker: () => void;
}

function isExcel(file: File) {
  const n = file.name.toLowerCase();
  return n.endsWith(".xlsx") || n.endsWith(".xls");
}

export default forwardRef<FileUploaderHandle, Props>(function FileUploader(
  { onDataLoaded, onLoadingChange, variant = "full" },
  ref
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    openFilePicker: () => inputRef.current?.click(),
  }));

  const handleFile = async (file: File) => {
    if (!isExcel(file)) {
      setError("กรุณาเลือกไฟล์ .xlsx หรือ .xls เท่านั้น");
      return;
    }

    setLoading(true);
    onLoadingChange?.(true);
    setError(null);
    setFileName(file.name);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/parse-xlsx", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "เกิดข้อผิดพลาดในการอ่านไฟล์");
      }

      const data: DashboardData = await res.json();
      onDataLoaded(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // Compact variant: the strip is small, so take a file dropped anywhere on
  // the page (a near miss would otherwise make the browser open the file
  // instead) and light the strip up while a file is being dragged.
  const [dragActive, setDragActive] = useState(false);
  const handleFileRef = useRef(handleFile);
  handleFileRef.current = handleFile;

  useEffect(() => {
    if (variant !== "compact") return;
    let depth = 0; // dragenter/dragleave fire for every child element crossed
    const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes("Files");
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragActive(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragActive(false);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragActive(false);
      const file = e.dataTransfer?.files[0];
      if (file) handleFileRef.current(file);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [variant]);

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept=".xlsx,.xls"
      className="hidden"
      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
    />
  );

  if (variant === "compact") {
    return (
      // Drops are handled by the window listeners above, not here.
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 border border-dashed rounded-xl px-4 py-3 text-sm cursor-pointer transition-colors ${
          dragActive
            ? "border-blue-400 bg-blue-50/70 text-blue-600"
            : "border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700 hover:bg-white/60"
        }`}
      >
        {input}
        {dragActive ? (
          <span className="flex items-center gap-2 font-medium">
            <Upload size={16} />
            วางไฟล์ Excel เพื่อนำเข้า
          </span>
        ) : loading ? (
          <span className="flex items-center gap-2">
            <Loader2 size={16} className="animate-spin text-blue-500" />
            กำลังอ่านไฟล์...
          </span>
        ) : error ? (
          <>
            <span className="flex items-center gap-2 text-gray-600">
              <AlertCircle size={16} className="shrink-0 text-amber-500" />
              {error}
            </span>
            <span className="text-xs text-gray-400">ลากวางหรือคลิกเพื่อเลือกไฟล์ใหม่</span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-2 font-medium">
              <FileSpreadsheet size={16} />
              นำเข้าจากไฟล์ Excel แทน
            </span>
            <span className="text-xs text-gray-400">.xlsx / .xls · ลากวางหรือคลิกเลือกไฟล์</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
      className="border-2 border-dashed border-blue-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all group"
    >
      {input}

      {loading ? (
        <div className="flex flex-col items-center gap-2 text-blue-600">
          <Loader2 size={32} className="animate-spin" />
          <p className="text-sm font-medium">กำลังอ่านไฟล์...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 text-red-500">
          <AlertCircle size={32} />
          <p className="text-sm font-medium">{error}</p>
          <p className="text-xs text-gray-400">คลิกเพื่อลองใหม่</p>
        </div>
      ) : fileName ? (
        <div className="flex flex-col items-center gap-2 text-green-600">
          <FileSpreadsheet size={32} />
          <p className="text-sm font-medium">{fileName}</p>
          <p className="text-xs text-gray-400">คลิกเพื่อเปลี่ยนไฟล์</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-gray-400 group-hover:text-blue-500 transition-colors">
          <Upload size={32} />
          <p className="text-sm font-medium text-gray-600">
            นำเข้าไฟล์ Excel (.xlsx / .xls)
          </p>
          <p className="text-xs">ลากวางหรือคลิกเพื่อเลือกไฟล์</p>
        </div>
      )}
    </div>
  );
});
