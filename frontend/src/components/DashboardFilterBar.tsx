import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { brandDisplayName } from "../lib/api";
import { format, subDays, startOfMonth, isSameDay } from "date-fns";
import { ar } from "date-fns/locale";
import type { Brand, Branch } from "../lib/api";
import { branchDisplayName } from "../lib/api";
import SavedViewsDropdown from "./SavedViewsDropdown";

const PRESETS = [
  { id: "today", labelKey: "today", getRange: () => ({ from: new Date(), to: new Date() }) },
  { id: "week", labelKey: "week", getRange: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { id: "month", labelKey: "month", getRange: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
] as const;

export type DateRange = { from: Date; to: Date };

const REPORT_TYPES = [
  { value: "daily_sales", labelKey: "Daily Totals" },
  { value: "hourly_sales", labelKey: "Hourly Trends" },
  { value: "product_sales", labelKey: "Product Sales" },
  { value: "receipts", labelKey: "Receipts" },
] as const;

function RefreshIcon({ className, spin }: { className?: string; spin?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className ?? ""} ${spin ? "animate-spin" : ""}`}
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 21h5v-5" />
    </svg>
  );
}

type Props = {
  brands: Brand[];
  branches: Branch[];
  selectedBrands: string[];
  selectedBranches: number[];
  selectedReportType: string;
  dateRange: DateRange;
  submittedBranchIds?: number[];
  isSAIF?: boolean;
  refreshing?: boolean;
  onBrandChange: (slugs: string[]) => void;
  onBranchChange: (ids: number[]) => void;
  onReportTypeChange?: (type: string) => void;
  onDateRangeChange: (range: DateRange) => void;
  onRefresh?: () => void;
  onApplySavedView?: (v: {
    brand: string | null;
    brandSlugs?: string[];
    branchIds: number[];
    reportType: string;
    dateRange: DateRange;
  }) => void;
};

export default function DashboardFilterBar({
  brands,
  branches,
  selectedBrands,
  selectedBranches,
  selectedReportType = "daily_sales",
  dateRange,
  submittedBranchIds = [],
  isSAIF = false,
  refreshing = false,
  onBrandChange,
  onBranchChange,
  onReportTypeChange,
  onDateRangeChange,
  onRefresh,
  onApplySavedView,
}: Props) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [brandOpen, setBrandOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const brandRef = useRef<HTMLDivElement>(null);
  const branchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = () => setIsMobile(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        brandOpen &&
        brandRef.current &&
        !brandRef.current.contains(e.target as Node)
      )
        setBrandOpen(false);
      if (
        branchOpen &&
        branchRef.current &&
        !branchRef.current.contains(e.target as Node)
      )
        setBranchOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [brandOpen, branchOpen]);

  const toggleBrand = (slug: string) => {
    if (selectedBrands.includes(slug)) {
      onBrandChange(selectedBrands.filter((s) => s !== slug));
    } else {
      onBrandChange([...selectedBrands, slug]);
    }
  };
  const selectAllBrands = () => onBrandChange(brands.map((b) => b.slug));
  const clearBrands = () => onBrandChange([]);

  const formatDate = (d: Date) =>
    format(d, "dd MMM yyyy", { locale: isRTL ? ar : undefined });

  const activePreset = PRESETS.find((p) => {
    const r = p.getRange();
    return isSameDay(r.from, dateRange.from) && isSameDay(r.to, dateRange.to);
  });
  const isCustom = !activePreset;

  const toggleBranch = (id: number) => {
    if (selectedBranches.includes(id)) {
      onBranchChange(selectedBranches.filter((b) => b !== id));
    } else {
      onBranchChange([...selectedBranches, id]);
    }
  };

  const selectAllBranches = () => onBranchChange(branches.map((b) => b.id));
  const clearBranches = () => onBranchChange([]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-14 z-10 -mt-2 mb-6"
    >
      <div className="float-card glass-card flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 backdrop-blur-xl">
        {/* Brand multi-select [Ref: 872afa] Smart positioning, scrollable, mobile bottom sheet */}
        <div ref={brandRef} className="relative flex items-center gap-2">
          <span className="w-12 shrink-0 text-xs font-medium text-slate-600 dark:text-slate-400">{t("brand")}</span>
          <button
            type="button"
            onClick={() => setBrandOpen((o) => !o)}
            className="filter-std flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none transition"
          >
            {selectedBrands.length === 0 ? t("all") : `${selectedBrands.length} ${t("selected")}`}
          </button>
          <AnimatePresence>
            {brandOpen && (
              <>
                {isMobile ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setBrandOpen(false)}
                    className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                  />
                ) : null}
                <motion.div
                  initial={isMobile ? { y: "100%" } : { opacity: 0, y: -8 }}
                  animate={isMobile ? { y: 0 } : { opacity: 1, y: 0 }}
                  exit={isMobile ? { y: "100%" } : { opacity: 0, y: -8 }}
                  transition={{ type: "tween", duration: 0.25 }}
                  className={`filter-dropdown z-50 rounded-xl py-2 ${
                    isMobile
                      ? "fixed bottom-0 left-0 right-0 max-h-[70vh] w-full rounded-b-none rounded-t-2xl border-t-2 border-[#10B981]/30 shadow-2xl"
                      : `absolute top-full mt-1 w-64 ${isRTL ? "right-0" : "left-0"}`
                  }`}
                >
                  <div className="sticky top-0 z-10 flex gap-2 bg-inherit px-3 pb-2 pt-1">
                    <button
                      type="button"
                      onClick={selectAllBrands}
                      className="text-xs font-medium text-[#10B981] hover:underline"
                    >
                      {t("all")}
                    </button>
                    <button
                      type="button"
                      onClick={clearBrands}
                      className="text-xs font-medium text-slate-500 hover:underline"
                    >
                      {t("clear")}
                    </button>
                    {isMobile && (
                      <button
                        type="button"
                        onClick={() => setBrandOpen(false)}
                        className="ml-auto text-xs font-medium text-slate-500 hover:underline"
                      >
                        {t("close")}
                      </button>
                    )}
                  </div>
                  <div className={isMobile ? "pb-6" : ""}>
                    {brands.map((b) => (
                      <label
                        key={b.slug}
                        className="flex cursor-pointer items-center gap-2 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedBrands.includes(b.slug)}
                          onChange={() => toggleBrand(b.slug)}
                          className="h-4 w-4 rounded border-slate-300 text-[#10B981] focus:ring-[#10B981]"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-200">{brandDisplayName(b, i18n.language)}</span>
                      </label>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Report Type */}
        {onReportTypeChange && (
          <div className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-xs font-medium text-slate-600 dark:text-slate-400">{t("filter")}</span>
            <select
              value={selectedReportType}
              onChange={(e) => onReportTypeChange(e.target.value)}
              className="filter-std rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
            >
              {REPORT_TYPES.map((r) => (
                <option key={r.value} value={r.value}>
                  {t(r.labelKey)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Branch multi-select [Ref: 872afa] Smart positioning, scrollable, mobile bottom sheet */}
        <div ref={branchRef} className="relative flex items-center gap-2">
          <span className="w-12 shrink-0 text-xs font-medium text-slate-600 dark:text-slate-400">{t("branch")}</span>
          <button
            type="button"
            onClick={() => setBranchOpen((o) => !o)}
            className="filter-std flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none transition"
          >
            {selectedBranches.length === 0 ? t("all") : `${selectedBranches.length} ${t("selected")}`}
          </button>
          <AnimatePresence>
            {branchOpen && (
              <>
                {isMobile ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setBranchOpen(false)}
                    className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                  />
                ) : null}
                <motion.div
                  initial={isMobile ? { y: "100%" } : { opacity: 0, y: -8 }}
                  animate={isMobile ? { y: 0 } : { opacity: 1, y: 0 }}
                  exit={isMobile ? { y: "100%" } : { opacity: 0, y: -8 }}
                  transition={{ type: "tween", duration: 0.25 }}
                  className={`filter-dropdown z-50 rounded-xl py-2 ${
                    isMobile
                      ? "fixed bottom-0 left-0 right-0 max-h-[70vh] w-full rounded-b-none rounded-t-2xl border-t-2 border-[#10B981]/30 shadow-2xl"
                      : `absolute top-full mt-1 w-64 ${isRTL ? "right-0" : "left-0"}`
                  }`}
                >
                  <div className="sticky top-0 z-10 flex gap-2 bg-inherit px-3 pb-2 pt-1">
                    <button
                      type="button"
                      onClick={selectAllBranches}
                      className="text-xs font-medium text-[#10B981] hover:underline"
                    >
                      {t("all")}
                    </button>
                    <button
                      type="button"
                      onClick={clearBranches}
                      className="text-xs font-medium text-slate-500 hover:underline"
                    >
                      {t("clear")}
                    </button>
                    {isMobile && (
                      <button
                        type="button"
                        onClick={() => setBranchOpen(false)}
                        className="ml-auto text-xs font-medium text-slate-500 hover:underline"
                      >
                        {t("close")}
                      </button>
                    )}
                  </div>
                  <div className={isMobile ? "pb-6" : ""}>
                    {branches.map((b) => (
                      <label
                        key={b.id}
                        className="flex cursor-pointer items-center gap-2 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedBranches.includes(b.id)}
                          onChange={() => toggleBranch(b.id)}
                          className="h-4 w-4 rounded border-slate-300 text-[#10B981] focus:ring-[#10B981]"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-200">{branchDisplayName(b, i18n.language)}</span>
                        {submittedBranchIds.includes(b.id) && (
                          <span className="text-[#10B981]" title="Shift submitted">
                            ✓
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Date presets [Ref: 141326, 141333] اليوم، الأسبوع، الشهر، مخصص */}
        <div className="flex items-center gap-1">
          {PRESETS.map((p) => {
            const isActive = activePreset?.id === p.id;
            return (
              <motion.button
                key={p.id}
                type="button"
                onClick={() => onDateRangeChange(p.getRange())}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? "border-[#10B981] bg-[#10B981]/12 text-[#10B981]"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {t(p.labelKey as "today" | "week" | "month")}
              </motion.button>
            );
          })}
          <motion.button
            type="button"
            onClick={() => setCustomOpen((o) => !o)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              isCustom
                ? "border-[#10B981] bg-[#10B981]/12 text-[#10B981]"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {t("custom")}
          </motion.button>
        </div>

        {customOpen && (
          <div className="flex w-full items-center gap-2 border-t border-slate-200 pt-3">
            <input
              type="date"
              value={format(dateRange.from, "yyyy-MM-dd")}
              onChange={(e) => {
                const d = e.target.valueAsDate;
                if (d) onDateRangeChange({ from: d, to: dateRange.to });
              }}
              className="filter-std rounded-lg px-2 py-1.5 text-sm text-slate-800 dark:text-slate-200"
            />
            <span className="text-slate-400">→</span>
            <input
              type="date"
              value={format(dateRange.to, "yyyy-MM-dd")}
              onChange={(e) => {
                const d = e.target.valueAsDate;
                if (d) onDateRangeChange({ from: dateRange.from, to: d });
              }}
              className="filter-std rounded-lg px-2 py-1.5 text-sm text-slate-800 dark:text-slate-200"
            />
          </div>
        )}

        <div className="text-xs text-slate-500 dark:text-slate-400">
          {formatDate(dateRange.from)} → {formatDate(dateRange.to)}
        </div>

        {/* Refresh Data button [Ref: 141333] */}
        {onRefresh && (
          <motion.button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 rounded-lg border border-[#10B981] bg-[#10B981]/12 px-4 py-2 text-sm font-medium text-[#10B981] transition hover:bg-[#10B981]/20 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <RefreshIcon spin={refreshing} className="shrink-0" />
            <span>{refreshing ? t("loading") : t("refreshData")}</span>
          </motion.button>
        )}

        {/* Saved Views (SAIF only) */}
        {isSAIF && onApplySavedView && (
          <SavedViewsDropdown
            isSAIF
            currentState={{
              brand: selectedBrands[0] ?? null,
              brandSlugs: selectedBrands,
              branchIds: selectedBranches,
              reportType: selectedReportType,
              dateRange,
            }}
            onApplyView={onApplySavedView}
          />
        )}
      </div>
    </motion.div>
  );
}
