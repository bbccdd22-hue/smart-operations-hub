import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  fetchDailyReconciliation,
  fetchCashToBank,
  fetchDiscrepancyAlerts,
  fetchBrands,
  exportReconciliation,
  exportDailyReport,
  fetchPendingSubmissions,
  finalizeDay,
  type ReconciliationRow,
  type CashToBankResponse,
  type DiscrepancyAlert,
} from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

const LABELS = {
  en: {
    title: "Accounting & Reconciliation",
    date: "Date",
    brand: "Brand",
    all: "All",
    branch: "Branch",
    systemCash: "System Cash (نقد)",
    actualCash: "Actual Cash (إجمالي المقبوضات)",
    cashVariance: "Cash Variance",
    systemCard: "System Card (الشبكة)",
    actualCard: "Actual Card",
    cardVariance: "Card Variance",
    deliveryApps: "Delivery Apps",
    foodicsCash: "Foodics Cash (ref)",
    foodicsSpan: "Foodics Span (ref)",
    foodicsCashVar: "Cash vs Foodics",
    foodicsSpanVar: "Span vs Foodics",
    notes: "Notes",
    exportExcel: "Export Excel",
    exportPdf: "Export PDF",
    cashToBank: "Cash-to-Bank Summary",
    totalCollected: "Actual Collected",
    totalExpected: "Expected (System)",
    totalVariance: "Total Variance",
    discrepancyAlerts: "Discrepancy Alerts",
    recurringShortages: "Recurring shortages (last 30 days)",
    noAlerts: "No recurring shortage alerts.",
    downloadDailyReport: "Download Daily Financial Report",
    pendingReview: "Pending Review",
    finalize: "Finalize Day",
    finalizeConfirm: "Finalize this day's accounts? No further changes allowed.",
  },
  ar: {
    title: "المحاسبة والمطابقة",
    date: "التاريخ",
    brand: "العلامة",
    all: "الكل",
    branch: "الفرع",
    systemCash: "نقد (النظام)",
    actualCash: "إجمالي المقبوضات",
    cashVariance: "فرق النقد",
    systemCard: "الشبكة (النظام)",
    actualCard: "الشبكة (الفعلية)",
    cardVariance: "فرق الشبكة",
    deliveryApps: "تطبيقات التوصيل",
    foodicsCash: "كاش (فوديكس)",
    foodicsSpan: "سبان (فوديكس)",
    foodicsCashVar: "مطابقة النقد",
    foodicsSpanVar: "مطابقة الشبكة",
    notes: "ملاحظات",
    exportExcel: "تصدير Excel",
    exportPdf: "تصدير PDF",
    cashToBank: "ملخص النقد للمصرف",
    totalCollected: "المقبوض الفعلي",
    totalExpected: "المتوقع (النظام)",
    totalVariance: "إجمالي الفرق",
    discrepancyAlerts: "تنبيهات الفروقات",
    recurringShortages: "نقص متكرر (آخر 30 يوم)",
    noAlerts: "لا توجد تنبيهات.",
    downloadDailyReport: "تحميل التقرير المالي اليومي",
    pendingReview: "قيد المراجعة",
    finalize: "اعتماد اليوم",
    finalizeConfirm: "اعتماد حسابات اليوم؟ لا يمكن إجراء تغييرات لاحقاً.",
  },
};

function sar(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "SAR" }).format(n);
}

export default function ReconciliationPage() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const isRTL = i18n.language === "ar";
  const t = (k: keyof typeof LABELS.en) => LABELS[i18n.language as "en" | "ar"]?.[k] ?? LABELS.en[k];
  const isOwner = user?.role === "owner";

  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [brands, setBrands] = useState<Awaited<ReturnType<typeof fetchBrands>>>([]);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [reconciliation, setReconciliation] = useState<{ date: string; rows: ReconciliationRow[] } | null>(null);
  const [cashToBank, setCashToBank] = useState<CashToBankResponse | null>(null);
  const [alerts, setAlerts] = useState<DiscrepancyAlert[]>([]);
  const [expandedNotes, setExpandedNotes] = useState<number | null>(null);
  const [pending, setPending] = useState({ pending_count: 0, is_finalized: false });
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  useEffect(() => {
    fetchBrands().then((r) => setBrands(Array.isArray(r) ? r : [])).catch(() => setBrands([]));
  }, []);

  useEffect(() => {
    fetchPendingSubmissions({ date, brand: selectedBrand ?? undefined })
      .then(setPending)
      .catch(() => setPending({ pending_count: 0, is_finalized: false }));
  }, [date, selectedBrand]);

  useEffect(() => {
    fetchDailyReconciliation({ date, brand: selectedBrand ?? undefined })
      .then(setReconciliation)
      .catch(() => setReconciliation({ date, rows: [] }));
  }, [date, selectedBrand]);

  useEffect(() => {
    fetchCashToBank({ date, brand: selectedBrand ?? undefined })
      .then(setCashToBank)
      .catch(() => setCashToBank(null));
  }, [date, selectedBrand]);

  useEffect(() => {
    fetchDiscrepancyAlerts({ days: 30, brand: selectedBrand ?? undefined })
      .then((r) => setAlerts(r.alerts))
      .catch(() => setAlerts([]));
  }, [selectedBrand]);

  const handleExport = async (format: "xlsx" | "pdf") => {
    try {
      const blob = await exportReconciliation({
        date,
        brand: selectedBrand ?? undefined,
        format,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reconciliation_${date}.${format === "pdf" ? "pdf" : "xlsx"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Silent fail
    }
  };

  const handleDownloadDailyReport = async () => {
    try {
      const blob = await exportDailyReport({ date, brand: selectedBrand ?? undefined });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `تقرير_الحسابات_اليومي_${date}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Silent fail
    }
  };

  const handleFinalize = async () => {
    setIsFinalizing(true);
    try {
      await finalizeDay(date);
      setPending((p) => ({ ...p, is_finalized: true }));
      setShowFinalizeModal(false);
    } catch {
      // Error
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="space-y-6 font-['Tajawal',sans-serif]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Daily reconciliation: System vs. Actual
          </p>
          {pending.pending_count > 0 && !pending.is_finalized && (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              {t("pendingReview")} ({pending.pending_count})
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="text-sm text-slate-500">{t("date")}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800/50"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-sm text-slate-500">{t("brand")}</span>
            <select
              value={selectedBrand ?? ""}
              onChange={(e) => setSelectedBrand(e.target.value || null)}
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800/50"
            >
              <option value="">{t("all")}</option>
              {(Array.isArray(brands) ? brands : []).map((b) => (
                <option key={b.id} value={b.slug}>{b.name}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleDownloadDailyReport}
            className="rounded-xl border border-emerald-500/50 bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-500/30 dark:text-emerald-300"
          >
            {t("downloadDailyReport")}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleExport("xlsx")}
              className="rounded-xl border border-slate-300/50 bg-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/20 dark:border-slate-600"
            >
              {t("exportExcel")}
            </button>
            <button
              type="button"
              onClick={() => handleExport("pdf")}
              className="rounded-xl border border-slate-300/50 bg-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/20 dark:border-slate-600"
            >
              {t("exportPdf")}
            </button>
          </div>
          {isOwner && !pending.is_finalized && (
            <button
              type="button"
              onClick={() => setShowFinalizeModal(true)}
              className="rounded-xl border border-amber-500/50 bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-500/30 dark:text-amber-300"
            >
              {t("finalize")}
            </button>
          )}
        </div>
      </div>

      {showFinalizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowFinalizeModal(false)}>
          <div className="glass-card max-w-md rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t("finalize")}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t("finalizeConfirm")}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowFinalizeModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFinalize}
                disabled={isFinalizing}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {isFinalizing ? "…" : t("finalize")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cash-to-Bank Summary */}
      {cashToBank && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-4 sm:grid-cols-3"
        >
          <div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-xl dark:border-slate-600/30 dark:bg-slate-900/40">
            <div className="text-xs font-medium uppercase text-slate-500">{t("totalCollected")}</div>
            <div className="mt-2 text-2xl font-bold">{sar(cashToBank.total_collected)}</div>
            <div className="mt-1 text-xs text-slate-500">{t("cashToBank")}</div>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-xl dark:border-slate-600/30 dark:bg-slate-900/40">
            <div className="text-xs font-medium uppercase text-slate-500">{t("totalExpected")}</div>
            <div className="mt-2 text-2xl font-bold">{sar(cashToBank.total_system_cash)}</div>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-xl dark:border-slate-600/30 dark:bg-slate-900/40">
            <div className="text-xs font-medium uppercase text-slate-500">{t("totalVariance")}</div>
            <div className={`mt-2 text-2xl font-bold ${cashToBank.total_variance !== 0 ? "text-rose-600" : ""}`}>
              {sar(cashToBank.total_variance)}
            </div>
          </div>
        </motion.div>
      )}

      {/* Reconciliation Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="glass-card overflow-hidden rounded-2xl"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-white/20 bg-white/5 dark:border-slate-600/50">
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">{t("branch")}</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">{t("systemCash")}</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">{t("actualCash")}</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">{t("cashVariance")}</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">{t("systemCard")}</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">{t("actualCard")}</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">{t("cardVariance")}</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">{t("deliveryApps")}</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-500 dark:text-slate-400" title="تقرير المقبوضات - reference only">{t("foodicsCash")}</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-500 dark:text-slate-400" title="Foodics Span - reference only">{t("foodicsSpan")}</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-500 dark:text-slate-400" title="Actual - Foodics (مطابقة)">{t("foodicsCashVar")}</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-500 dark:text-slate-400" title="Actual - Foodics">{t("foodicsSpanVar")}</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">{t("notes")}</th>
              </tr>
            </thead>
            <tbody>
              {(reconciliation?.rows ?? []).length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-slate-500">
                    No reconciliation data for this date.
                  </td>
                </tr>
              ) : (
                (reconciliation?.rows ?? []).map((r) => (
                  <tr
                    key={r.branch_id}
                    className={`border-b border-white/10 dark:border-slate-600/30 ${
                      r.has_variance ? "bg-rose-500/5" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium">{r.branch_name}</td>
                    <td className="px-4 py-3 text-right">{sar(r.system_cash)}</td>
                    <td className="px-4 py-3 text-right">{sar(r.actual_cash)}</td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        r.cash_variance !== 0 ? "text-rose-600 dark:text-rose-400" : ""
                      }`}
                    >
                      {sar(r.cash_variance)}
                    </td>
                    <td className="px-4 py-3 text-right">{sar(r.system_card)}</td>
                    <td className="px-4 py-3 text-right">{sar(r.actual_card)}</td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        r.card_variance !== 0 ? "text-rose-600 dark:text-rose-400" : ""
                      }`}
                    >
                      {sar(r.card_variance)}
                    </td>
                    <td className="px-4 py-3 text-right">{sar(r.delivery_total)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {r.foodics_cash != null ? sar(r.foodics_cash) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {r.foodics_span != null ? sar(r.foodics_span) : "—"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right text-slate-500 ${
                        r.foodics_cash_variance != null && r.foodics_cash_variance !== 0
                          ? "font-medium text-amber-600 dark:text-amber-400"
                          : ""
                      }`}
                    >
                      {r.foodics_cash_variance != null ? sar(r.foodics_cash_variance) : "—"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right text-slate-500 ${
                        r.foodics_span_variance != null && r.foodics_span_variance !== 0
                          ? "font-medium text-amber-600 dark:text-amber-400"
                          : ""
                      }`}
                    >
                      {r.foodics_span_variance != null ? sar(r.foodics_span_variance) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.manual_notes ? (
                        <button
                          type="button"
                          onClick={() => setExpandedNotes(expandedNotes === r.branch_id ? null : r.branch_id)}
                          className="max-w-[200px] truncate text-left text-xs text-amber-600 hover:underline dark:text-amber-400"
                          title={r.manual_notes}
                        >
                          {expandedNotes === r.branch_id
                            ? r.manual_notes
                            : r.manual_notes.length > 40
                              ? `${r.manual_notes.slice(0, 40)}...`
                              : r.manual_notes}
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Discrepancy Alerts */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
          className="glass-card rounded-2xl p-5"
      >
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t("discrepancyAlerts")}</h2>
        <p className="mt-1 text-xs text-slate-500">{t("recurringShortages")}</p>
        {alerts.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">{t("noAlerts")}</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {alerts.map((a) => (
              <div
                key={a.branch_id}
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 dark:border-rose-600/50"
              >
                <div className="font-medium">{a.branch_name}</div>
                <div className="mt-1 text-xs text-slate-500">{a.brand_name}</div>
                <div className="mt-2 flex justify-between text-sm">
                  <span>Occurrences:</span>
                  <span className="font-semibold">{a.occurrences}</span>
                </div>
                <div className="mt-1 flex justify-between text-sm">
                  <span>Total shortage:</span>
                  <span className="font-semibold text-rose-600">{sar(a.total_shortage)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
