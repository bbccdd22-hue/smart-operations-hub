import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { subDays } from "date-fns";
import {
  fetchSavedViews,
  createSavedView,
  updateSavedView,
  deleteSavedView,
  type SavedView,
} from "../lib/api";
import type { DateRange } from "./DashboardFilterBar";

type Props = {
  isSAIF: boolean;
  currentState: {
    brand: string | null;
    brandSlugs?: string[];
    branchIds: number[];
    reportType: string;
    dateRange: DateRange;
  };
  onApplyView: (v: {
    brand: string | null;
    brandSlugs?: string[];
    branchIds: number[];
    reportType: string;
    dateRange: DateRange;
  }) => void;
};

function dateRangeToDays(range: DateRange): number {
  const from = range.from.getTime();
  const to = range.to.getTime();
  const diff = Math.round((to - from) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
}

function daysToDateRange(days: number): DateRange {
  if (days <= 1) {
    const today = new Date();
    return { from: today, to: today };
  }
  return {
    from: subDays(new Date(), days - 1),
    to: new Date(),
  };
}

export default function SavedViewsDropdown({
  isSAIF,
  currentState,
  onApplyView,
}: Props) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [open, setOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isSAIF) {
      fetchSavedViews().then((r) => setSavedViews(Array.isArray(r) ? r : [])).catch(() => setSavedViews([]));
    }
  }, [isSAIF]);

  const handleSave = async () => {
    if (!viewName.trim()) return;
    setLoading(true);
    try {
      const days = dateRangeToDays(currentState.dateRange);
      const v = await createSavedView({
        name: viewName.trim(),
        brand_slug: currentState.brandSlugs?.[0] ?? currentState.brand ?? "",
        branch_ids: currentState.branchIds,
        report_type: currentState.reportType,
        date_range_days: days,
        is_default: setAsDefault,
      });
      if (setAsDefault) {
        await Promise.all(
          savedViews
            .filter((s) => s.is_default)
            .map((s) => updateSavedView(s.id, { is_default: false }))
        );
      }
      setSavedViews((prev) => [...prev, v]);
      setSaveModalOpen(false);
      setViewName("");
      setSetAsDefault(false);
    } catch {
      // Silent fail for now
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (v: SavedView) => {
    const dateRange = daysToDateRange(v.date_range_days);
    onApplyView({
      brand: v.brand_slug || null,
      brandSlugs: v.brand_slug ? [v.brand_slug] : [],
      branchIds: v.branch_ids ?? [],
      reportType: v.report_type || "daily_sales",
      dateRange,
    });
    setOpen(false);
  };

  const handleSetDefault = async (id: number) => {
    await Promise.all(
      savedViews.map((s) =>
        updateSavedView(s.id, { is_default: s.id === id })
      )
    );
    setSavedViews((prev) =>
      prev.map((s) => ({ ...s, is_default: s.id === id }))
    );
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm(t("delete") + "?")) return;
    try {
      await deleteSavedView(id);
      setSavedViews((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // Silent
    }
  };

  if (!isSAIF) return null;

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="filter-std flex items-center gap-2 rounded-lg border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
        >
          <span>📌</span>
          {t("savedViews")}
        </button>
        <button
          type="button"
          onClick={() => setSaveModalOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-emerald-500 bg-emerald-500/12 px-3 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400"
        >
          {t("saveCurrentView")}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="filter-dropdown absolute left-0 top-full z-20 mt-1 w-64 rounded-xl py-2"
          >
            {savedViews.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-500">
                {t("noSavedViews")}
              </div>
            ) : (
              savedViews.map((v) => (
                <div
                  key={v.id}
                  className="flex cursor-pointer items-center justify-between px-4 py-2 hover:bg-slate-50"
                  onClick={() => handleApply(v)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">{v.name}</span>
                    {v.is_default && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400">★</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetDefault(v.id);
                      }}
                      className="text-xs text-slate-400 hover:text-emerald-600 dark:text-emerald-400"
                    >
                      ★
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, v.id)}
                      className="text-xs text-rose-500 hover:text-rose-600"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {saveModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setSaveModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card w-full max-w-md rounded-2xl p-6"
              style={{
                background: "rgba(15, 23, 42, 0.9)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <h3 className="text-lg font-semibold text-white">
                {t("saveCurrentView")}
              </h3>
              <input
                type="text"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder={t("viewNamePlaceholder")}
                className="glass-input mt-4 w-full rounded-xl px-4 py-2 text-white"
              />
              <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={setAsDefault}
                  onChange={(e) => setSetAsDefault(e.target.checked)}
                />
                {t("openByDefaultOnLogin")}
              </label>
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={loading || !viewName.trim()}
                  className="rounded-xl bg-[#7c3aed] px-4 py-2 font-medium text-white disabled:opacity-50"
                >
                  {t("save")}
                </button>
                <button
                  type="button"
                  onClick={() => setSaveModalOpen(false)}
                  className="glass-btn rounded-xl px-4 py-2"
                >
                  {t("cancel")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
