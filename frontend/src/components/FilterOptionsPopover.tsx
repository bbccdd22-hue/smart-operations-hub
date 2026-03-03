/**
 * FilterOptionsPopover – قائمة خيارات موحدة بنفس الهوية البصرية
 * للفترة، نوع التقرير، الإجماليات – Popover صغير مع أيقونة
 */
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

export type FilterOption = { value: string; labelKey?: string; label?: string };

type Props = {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  icon?: React.ReactNode;
};

export default function FilterOptionsPopover({
  options,
  value,
  onChange,
  label,
  placeholder,
  icon,
}: Props) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 220 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const optionsSafe = Array.isArray(options) ? options : [];
  const selectedOption = optionsSafe.find((o) => o.value === value);
  const displayLabel = selectedOption
    ? (selectedOption.label ?? (selectedOption.labelKey ? t(selectedOption.labelKey) : selectedOption.value))
    : (placeholder ?? t("all"));

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const w = Math.min(280, Math.max(200, rect.width));
      setPosition({
        top: rect.bottom + 6,
        left: isRTL ? rect.right - w : rect.left,
        width: w,
      });
    }
  }, [open, isRTL]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        open &&
        triggerRef.current &&
        panelRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        !panelRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const defaultIcon = (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
    </svg>
  );

  const popoverContent = (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ type: "tween", duration: 0.15 }}
      className="filter-popover unified-filter-dropdown"
      data-dropdown-layer
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        width: position.width,
        maxHeight: 250,
        borderRadius: 12,
        zIndex: 9999,
      }}
    >
      <div className="dropdown-scrollable max-h-[250px] overflow-y-auto overflow-x-hidden py-1">
        {optionsSafe.map((opt) => {
          const optLabel = opt.label ?? (opt.labelKey ? t(opt.labelKey) : opt.value);
          const isActive = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-slate-700/50 ${
                isActive
                  ? "bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-400"
                  : "text-slate-700 dark:text-slate-200"
              }`}
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-500 dark:text-slate-400">
                {icon ?? defaultIcon}
              </span>
              <span className="min-w-0 flex-1 truncate">{optLabel}</span>
              {isActive && <span className="text-emerald-500">✓</span>}
            </button>
          );
        })}
      </div>
    </motion.div>
  );

  return (
    <div className="relative flex items-center gap-2">
      {label && (
        <span className="w-12 shrink-0 text-xs font-medium text-slate-600 dark:text-slate-400">
          {label}
        </span>
      )}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="filter-std flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 outline-none transition dark:text-slate-200"
        aria-expanded={open}
      >
        {icon ?? defaultIcon}
        {displayLabel}
        <svg
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[9998] bg-black/15 dark:bg-black/35"
              aria-hidden
            />
            {createPortal(popoverContent, document.body, "filter-options-portal")}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
