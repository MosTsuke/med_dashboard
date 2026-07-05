"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  icon?: LucideIcon;
  className?: string;
  /** Tailwind width class for the trigger label + dropdown panel. */
  widthClass?: string;
  searchPlaceholder?: string;
}

/** Compact combobox: click to open a searchable list, matches the look of
 * the pill-style filters in the toolbar. Falls back gracefully to showing
 * all options when the search box is empty. */
export default function SearchableSelect({
  value,
  options,
  onChange,
  icon: Icon,
  className = "",
  widthClass = "w-56",
  searchPlaceholder = "ค้นหา...",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 bg-white/60 backdrop-blur border border-white/80 rounded-xl px-2.5 py-1.5 shadow-sm text-sm font-medium text-gray-700 hover:bg-white/90 transition-colors"
      >
        {Icon && <Icon size={14} className="text-gray-400 shrink-0" />}
        <span className="max-w-[140px] truncate">{selected?.label ?? value}</span>
        <ChevronDown
          size={13}
          className={`text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className={`absolute right-0 mt-1.5 ${widthClass} bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden`}
        >
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-xs text-gray-400 text-center">ไม่พบรายการ</p>
            )}
            {filtered.map((o) => {
              const isSelected = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors ${
                    isSelected ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Check size={13} className={isSelected ? "opacity-100 shrink-0" : "opacity-0 shrink-0"} />
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
