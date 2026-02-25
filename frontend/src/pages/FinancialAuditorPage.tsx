/**
 * صفحة المراجع المالي – واحدة لجميع العلامات
 * فلترة حسب العلامة التجارية – مراجعة إقفالات الورديات والصور المرفقة + أزرار التعميد
 * دعم كامل للآيباد: لمس، أزرار كبيرة، مودال تفاصيل
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { format, subDays } from "date-fns";
import {
  fetchBrands,
  fetchAuditorShiftClosings,
  fetchShiftClosingAttachments,
  fetchShiftClosingDetail,
  fetchPendingSubmissions,
  finalizeDay,
  type Brand,
  type AuditorClosingItem,
  type ShiftClosingAttachmentItem,
  type ShiftClosingDetail,
} from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import UnifiedFilterSelect from "../components/UnifiedFilterSelect";
import UltimateDateRangePicker from "../components/UltimateDateRangePicker";

function sar(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "SAR", minimumFractionDigits: 2 }).format(n);
}

export default function FinancialAuditorPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRTL = i18n.language === "ar";
  const isOwner = user?.role === "owner";
  const isSAIF = user?.username === "SAIF";
  const canFinalize = isOwner || isSAIF;

  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [dateRange, setDateRange] = useState(() => {
    const to = new Date();
    const from = subDays(to, 30);
    return { from, to };
  });
  const dateFrom = format(dateRange.from, "yyyy-MM-dd");
  const dateTo = format(dateRange.to, "yyyy-MM-dd");
  const [closings, setClosings] = useState<AuditorClosingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [attachments, setAttachments] = useState<ShiftClosingAttachmentItem[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [detailModalClosing, setDetailModalClosing] = useState<AuditorClosingItem | null>(null);
  const [detailFull, setDetailFull] = useState<ShiftClosingDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [finalizeDate, setFinalizeDate] = useState("");
  const [pendingByDate, setPendingByDate] = useState<Record<string, { pending_count: number; is_finalized: boolean }>>({});
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    fetchBrands().then(setBrands);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAuditorShiftClosings({
      brand: selectedBrand || undefined,
      date_from: dateFrom,
      date_to: dateTo,
    })
      .then((r) => setClosings(r.closings))
      .catch(() => setClosings([]))
      .finally(() => setLoading(false));
  }, [selectedBrand, dateFrom, dateTo]);

  // تحميل حالة التعميد للتواريخ الواردة في الإقفالات
  useEffect(() => {
    if (!canFinalize || closings.length === 0) return;
    const dates = [...new Set(closings.map((c) => c.date))];
    const byDate: Record<string, { pending_count: number; is_finalized: boolean }> = {};
    Promise.all(
      dates.map((d) =>
        fetchPendingSubmissions({ date: d, brand: selectedBrand || undefined }).then((r) => {
          byDate[d] = r;
        })
      )
    ).then(() => setPendingByDate(byDate));
  }, [canFinalize, closings, selectedBrand]);

  const handleExpand = (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      setAttachments([]);
      return;
    }
    setExpandedId(id);
    setLoadingAttachments(true);
    fetchShiftClosingAttachments(id)
      .then(setAttachments)
      .catch(() => setAttachments([]))
      .finally(() => setLoadingAttachments(false));
  };

  const openDetailModal = useCallback((c: AuditorClosingItem) => {
    setDetailModalClosing(c);
    setDetailFull(null);
    setAttachments([]);
    setLoadingDetail(true);
    Promise.all([
      fetchShiftClosingDetail(c.id),
      fetchShiftClosingAttachments(c.id),
    ])
      .then(([full, atts]) => {
        setDetailFull(full ?? null);
        setAttachments(atts ?? []);
      })
      .catch(() => {
        setDetailFull(null);
        setAttachments([]);
      })
      .finally(() => setLoadingDetail(false));
  }, []);

  const closeDetailModal = useCallback(() => {
    setDetailModalClosing(null);
    setDetailFull(null);
    setAttachments([]);
  }, []);

  const handleFinalizeDay = async (date: string) => {
    if (!canFinalize || !date) return;
    setFinalizing(true);
    try {
      await finalizeDay(date);
      setPendingByDate((prev) => ({
        ...prev,
        [date]: { pending_count: 0, is_finalized: true },
      }));
      setFinalizeDate("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to finalize");
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <div className="w-full space-y-6" style={{ fontFamily: "Inter, Lexend, Tajawal, system-ui, sans-serif" }}>
      <div>
        <Link to="/finance" className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">
          ← {isRTL ? "العودة للمركز المالي" : "Back to Finance Hub"}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
          {isRTL ? "المراجع المالي" : "Financial Auditor"}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isRTL ? "مراجعة إقفالات الورديات والصور المرفقة – واحدة لجميع العلامات" : "Review shift closings and attached images – one page for all brands"}
        </p>
      </div>

      {/* أزرار التعميد – لمالك/سيف */}
      {canFinalize && (
        <div className="glass-card flex flex-wrap items-center gap-4 rounded-2xl p-4">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {isRTL ? "اعتماد اليوم" : "Finalize Day"}
          </span>
          <select
            value={finalizeDate}
            onChange={(e) => setFinalizeDate(e.target.value)}
            className="glass-input rounded-xl px-3 py-2 text-sm outline-none"
          >
            <option value="">{isRTL ? "اختر التاريخ..." : "Select date..."}</option>
            {[...new Set(closings.map((c) => c.date))].sort().map((d) => {
              const p = pendingByDate[d];
              const canFinalizeThis = p && p.pending_count > 0 && !p.is_finalized;
              return (
                <option key={d} value={d}>
                  {d} {p?.is_finalized ? `(${isRTL ? "معتمد" : "Finalized"})` : p?.pending_count ? `(${p.pending_count} ${isRTL ? "معلق" : "pending"})` : ""}
                </option>
              );
            })}
          </select>
          <button
            type="button"
            disabled={!finalizeDate || finalizing || !(pendingByDate[finalizeDate]?.pending_count > 0 && !pendingByDate[finalizeDate]?.is_finalized)}
            onClick={() => finalizeDate && handleFinalizeDay(finalizeDate)}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {finalizing ? (isRTL ? "جاري التعميد..." : "Finalizing...") : isRTL ? "اعتماد اليوم" : "Finalize Day"}
          </button>
        </div>
      )}

      {/* فلتر العلامة التجارية */}
      <div className="glass-card flex flex-wrap items-center gap-4 rounded-2xl p-4">
        <UnifiedFilterSelect
          mode="brand"
          items={brands}
          selected={selectedBrand}
          onChange={setSelectedBrand}
          selectionMode="single"
          label={isRTL ? "اختيار العلامة التجارية" : "Select Brand"}
          placeholder={isRTL ? "جميع العلامات" : "All Brands"}
        />
        <UltimateDateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">Loading…</div>
      ) : closings.length === 0 ? (
        <div className="aqua-glass-card rounded-2xl p-8 text-center text-slate-500">
          {isRTL ? "لا توجد إقفالات في الفترة المحددة" : "No shift closings in the selected period"}
        </div>
      ) : (
        <>
        <div className="space-y-3">
          {closings.map((c) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="aqua-glass-card overflow-hidden rounded-2xl"
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => openDetailModal(c)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDetailModal(c);
                  }
                }}
                className="flex w-full min-h-[48px] touch-manipulation cursor-pointer flex-wrap items-center justify-between gap-4 p-4 text-left transition hover:bg-slate-50/50 active:bg-slate-100/50 dark:hover:bg-slate-800/30 dark:active:bg-slate-700/30"
                style={{ touchAction: "manipulation" }}
                aria-label={isRTL ? `عرض تفاصيل إقفال ${c.date} - ${c.branch_name}` : `View closing details ${c.date} - ${c.branch_name}`}
              >
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-semibold text-slate-800 dark:text-white">{c.date}</span>
                  <span className="text-slate-600 dark:text-slate-300">{c.brand_name}</span>
                  <span className="text-slate-600 dark:text-slate-300">{c.branch_name}</span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-700">{c.shift_type}</span>
                  <span className="text-sm text-slate-500">{c.submitted_by}</span>
                </div>
                <div className="flex min-h-[44px] min-w-[44px] flex-shrink-0 flex-wrap items-center gap-3">
                  <span className="tabular-nums text-slate-600 dark:text-slate-400">{sar(c.actual_cash)}</span>
                  <span className={`tabular-nums font-semibold ${c.variance_cash >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {c.variance_cash >= 0 ? "+" : ""}{sar(c.variance_cash)}
                  </span>
                  {c.attachments_count > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                      📷 {c.attachments_count}
                    </span>
                  )}
                  <button
                    type="button"
                    className="inline-flex min-h-[44px] min-w-[44px] touch-manipulation flex-shrink-0 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]"
                    style={{ touchAction: "manipulation" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetailModal(c);
                    }}
                    aria-label={isRTL ? "عرض التفاصيل" : "View details"}
                  >
                    {isRTL ? "عرض" : "View"}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExpand(c.id);
                }}
                className="flex w-full min-h-[44px] touch-manipulation cursor-pointer items-center justify-center gap-2 border-t border-slate-200/60 bg-slate-50/30 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100/50 dark:border-white/10 dark:bg-slate-800/20 dark:text-slate-400 dark:hover:bg-slate-700/30"
                style={{ touchAction: "manipulation" }}
                aria-expanded={expandedId === c.id}
              >
                <svg className={`h-5 w-5 text-slate-400 transition ${expandedId === c.id ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                {expandedId === c.id ? (isRTL ? "إخفاء المرفقات" : "Hide attachments") : (isRTL ? "إظهار المرفقات" : "Show attachments")}
              </button>
              {expandedId === c.id && (
                <div className="border-t border-slate-200/60 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-slate-800/30">
                  <div className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                    {isRTL ? "التفاصيل" : "Details"} • {isRTL ? "المتوقع" : "Expected"}: {sar(c.system_cash)} • {isRTL ? "الفعلي" : "Actual"}: {sar(c.actual_cash)}
                  </div>
                  {loadingAttachments ? (
                    <div className="text-sm text-slate-500">Loading attachments…</div>
                  ) : attachments.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {attachments.map((a) => (
                        <a key={a.id} href={a.file_url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                          <img src={a.file_url} alt={a.caption || "Attachment"} className="h-24 w-full object-cover" />
                          {a.caption && <div className="truncate px-2 py-1 text-xs text-slate-500">{a.caption}</div>}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">{isRTL ? "لا توجد صور مرفقة" : "No attached images"}</div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* مودال تفاصيل الإقفال – كامل التفاصيل + صور */}
        <AnimatePresence>
          {detailModalClosing && (
            <>
              <div
                className="fixed inset-0 z-[9998] bg-black/50"
                onClick={closeDetailModal}
                aria-hidden
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                onClick={(e) => e.stopPropagation()}
                className="fixed inset-4 top-1/2 left-1/2 z-[9999] flex max-h-[90vh] min-h-[200px] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                    {isRTL ? "تفاصيل الإقفال" : "Closing Details"} – {detailModalClosing.date} · {detailModalClosing.branch_name}
                  </h3>
                  <button
                    type="button"
                    onClick={closeDetailModal}
                    className="flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                    style={{ touchAction: "manipulation" }}
                    aria-label={isRTL ? "إغلاق" : "Close"}
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {loadingDetail ? (
                    <div className="flex items-center justify-center py-12">
                      <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                          <div className="text-xs font-medium text-slate-500">{isRTL ? "المبيعات الإجمالية" : "Total Sales"}</div>
                          <div className="mt-1 text-lg font-semibold tabular-nums">
                            {detailFull ? sar(Number(detailFull.system_total_sales ?? 0)) : sar(detailModalClosing.actual_cash + (detailModalClosing.system_cash || 0))}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                          <div className="text-xs font-medium text-slate-500">{isRTL ? "النقد المتوقع" : "Expected Cash"}</div>
                          <div className="mt-1 text-lg font-semibold tabular-nums">{sar(detailModalClosing.system_cash)}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                          <div className="text-xs font-medium text-slate-500">{isRTL ? "النقد الفعلي" : "Actual Cash"}</div>
                          <div className="mt-1 text-lg font-semibold tabular-nums">{sar(detailModalClosing.actual_cash)}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                          <div className="text-xs font-medium text-slate-500">{isRTL ? "العجز / الزيادة" : "Shortage / Surplus"}</div>
                          <div className={`mt-1 text-lg font-semibold tabular-nums ${detailModalClosing.variance_cash >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {detailModalClosing.variance_cash >= 0 ? "+" : ""}{sar(detailModalClosing.variance_cash)}
                          </div>
                        </div>
                      </div>
                      {detailFull && (
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                            <div className="text-xs text-slate-500">{isRTL ? "الشبكة" : "Network"}</div>
                            <div className="text-sm font-medium tabular-nums">{sar(Number(detailFull.manual_network_total ?? 0))}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                            <div className="text-xs text-slate-500">{isRTL ? "التوصيل" : "Delivery"}</div>
                            <div className="text-sm font-medium tabular-nums">{sar(Number(detailFull.manual_delivery_total ?? 0))}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                            <div className="text-xs text-slate-500">{isRTL ? "تباين الشبكة" : "Network variance"}</div>
                            <div className={`text-sm font-medium tabular-nums ${Number(detailFull.variance_network ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                              {Number(detailFull.variance_network ?? 0) >= 0 ? "+" : ""}{sar(Number(detailFull.variance_network ?? 0))}
                            </div>
                          </div>
                        </div>
                      )}
                      {detailModalClosing.attachments_count > 0 && (
                        <div>
                          <div className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                            {isRTL ? "الصور المرفقة" : "Attached Images"}
                          </div>
                          {attachments.length > 0 ? (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                              {attachments.map((a) => (
                                <a key={a.id} href={a.file_url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                                  <img src={a.file_url} alt={a.caption || "Attachment"} className="h-32 w-full object-cover" />
                                  {a.caption && <div className="truncate px-2 py-1 text-xs text-slate-500">{a.caption}</div>}
                                </a>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-slate-500">{isRTL ? "جاري التحميل…" : "Loading…"}</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
        </>
      )}
    </div>
  );
}
