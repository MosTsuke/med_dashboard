"use client";

import { useState, useRef, forwardRef, useImperativeHandle } from "react";
import { Upload, FileSpreadsheet, Loader2, AlertCircle } from "lucide-react";
import type { DashboardData } from "@/types";

interface Props {
  onDataLoaded: (data: DashboardData) => void;
  onLoadingChange?: (loading: boolean) => void;
}

export interface FileUploaderHandle {
  openFilePicker: () => void;
}

function isExcel(file: File) {
  const n = file.name.toLowerCase();
  return n.endsWith(".xlsx") || n.endsWith(".xls");
}

export default forwardRef<FileUploaderHandle, Props>(function FileUploader(
  { onDataLoaded, onLoadingChange },
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

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
      className="border-2 border-dashed border-blue-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all group"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

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
