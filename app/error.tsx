"use client";

import { AlertCircle, RotateCcw } from "lucide-react";

/**
 * Shown instead of a blank "Application error" page when something on the
 * page breaks: what happened, in Thai, with a way back. The technical
 * message is kept small for whoever looks into it.
 */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#f4f7fb" }}>
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-6 text-center space-y-3">
        <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto">
          <AlertCircle size={24} className="text-red-500" />
        </div>
        <h1 className="text-base font-semibold text-gray-800">หน้านี้แสดงผลไม่สำเร็จ</h1>
        <p className="text-sm text-gray-500">
          ลองกด "ลองใหม่" ถ้ายังเป็นอีก ให้แคปหน้าจอนี้ส่งให้ผู้ดูแลระบบ
        </p>
        <div className="flex justify-center gap-2 pt-1">
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RotateCcw size={15} />
            ลองใหม่
          </button>
          <button
            type="button"
            onClick={() => (window.location.href = "/")}
            className="text-sm px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            กลับหน้าแรก
          </button>
        </div>
        <p className="text-[11px] text-gray-400 break-words">{error.message}</p>
      </div>
    </div>
  );
}
