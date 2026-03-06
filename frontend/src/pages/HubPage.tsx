/**
 * صفحة التوجيه المركزية – جدول ملخص المبيعات (أولوية قصوى) + الأيقونات الستة
 * الجدول في الأعلى مباشرة تحت شريط البحث • تصفية أعمدة • Popover للبراند والفرع
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { format, subDays } from "date-fns";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { fetchHubExecutiveSummary, fetchBrands, type HubExecutiveSummaryRow } from "../lib/api";
import type { Brand, Branch } from "../lib/api";
import UnifiedFilterSelect from "../components/UnifiedFilterSelect";
import UltimateDateRangePicker from "../components/UltimateDateRangePicker";

const HUB_TILES = [
  { key: "perm_shift_closing", to: "/shift-closing", icon: "🕐", labelKey: "perm_shift_closing" },
  { key: "perm_financial_reports", to: "/finance", icon: "📊", labelKey: "perm_financial_reports" },
  { key: "perm_management_reports", to: "/dashboard", icon: "📋", labelKey: "perm_management_reports" },
  { key: "perm_full_system_access", to: "/admin-hub", icon: "⚙️", labelKey: "perm_full_system_access" },
  { key: "perm_order_forecasting", to: "/forecast", icon: "📈", labelKey: "perm_order_forecasting" },
  { key: "perm_financial_auditor", to: "/finance/auditor", icon: "🔍", labelKey: "perm_financial_auditor" },
] as const;

const COLUMN_KEYS = [
  "branch",
  "branch_reference",
  "total_sales",
  "sales_pct",
  "net_sales_with_vat",
  "vat",
  "discount_amount",
  "total_sales_excl_vat",
] as const;

const COLUMN_LABELS: Record<(typeof COLUMN_KEYS)[number], { ar: string; en: string }> = {
  branch: { ar: "الفرع", en: "Branch" },
  branch_reference: { ar: "مرجع الفرع", en: "Branch Reference" },
  total_sales: { ar: "إجمالي المبيعات", en: "Total Sales" },
  sales_pct: { ar: "إجمالي المبيعات %", en: "Sales %" },
  net_sales_with_vat: { ar: "صافي المبيعات مع الضريبة", en: "Net Sales with VAT" },
  vat: { ar: "الضرائب", en: "VAT" },
  discount_amount: { ar: "مبلغ الخصم", en: "Discount Amount" },
  total_sales_excl_vat: { ar: "إجمالي المبيعات من غير ضريبة", en: "Total Sales Excl. VAT" },
};

const COLUMN_VISIBILITY_STORAGE_KEY = "hub-sales-column-visibility";

function loadColumnVisibility(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      return { ...Object.fromEntries(COLUMN_KEYS.map((k) => [k, true])), ...parsed };
    }
  } catch {
    /* ignore */
  }
  return Object.fromEntries(COLUMN_KEYS.map((k) => [k, true]));
}

function saveColumnVisibility(v: Record<string, boolean>) {
  try {
    localStorage.setItem(COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("ar-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export default function HubPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isRTL = i18n.language === "ar";
  const isSAIF = user?.username === "SAIF";
  const perms = user?.permissions ?? {};
  const { dark, toggleTheme } = useTheme();

  const [rows, setRows] = useState<HubExecutiveSummaryRow[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [columnVisibility, setColumnVisibility] = useState(loadColumnVisibility);
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [dateRange, setDateRange] = useState(() => {
    const to = new Date();
    const from = subDays(to, 30);
    return { from, to };
  });
  const dateFrom = format(dateRange.from, "yyyy-MM-dd");
  const dateTo = format(dateRange.to, "yyyy-MM-dd");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<number[]>([]);
  const colFilterBtnRef = useRef<HTMLButtonElement>(null);
  const colFilterPanelRef = useRef<HTMLDivElement>(null);
  const [colFilterPosition, setColFilterPosition] = useState<{ top: number; left: number; right: number } | null>(null);

  useEffect(() => {
    if (colMenuOpen && colFilterBtnRef.current) {
      const rect = colFilterBtnRef.current.getBoundingClientRect();
      setColFilterPosition({
        top: rect.bottom + 6,
        left: rect.left,
        right: rect.right,
      });
    } else {
      setColFilterPosition(null);
    }
  }, [colMenuOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        colMenuOpen &&
        colFilterBtnRef.current &&
        colFilterPanelRef.current &&
        !colFilterBtnRef.current.contains(e.target as Node) &&
        !colFilterPanelRef.current.contains(e.target as Node)
      ) {
        setColMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [colMenuOpen]);

  const visibleTiles = HUB_TILES.filter((tile) => {
    if (isSAIF) return true;
    return !!perms[tile.key as keyof typeof perms];
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, brandsRes] = await Promise.all([
        fetchHubExecutiveSummary({ date_from: dateFrom, date_to: dateTo }),
        fetchBrands(),
      ]);
      setRows(Array.isArray(summaryRes?.rows) ? summaryRes.rows : []);
      setBrands(Array.isArray(brandsRes) ? brandsRes : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
      setRows([]);
      setBrands([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const branchOptions = useMemo(() => {
    const seen = new Set<number>();
    return rows
      .filter((r) => r.branch_id != null && !seen.has(r.branch_id) && (seen.add(r.branch_id), true))
      .map((r) => ({
        id: r.branch_id!,
        name: r.branch_name,
        name_ar: r.branch_name,
        brand: { slug: r.brand_slug ?? "" },
      })) as Branch[];
  }, [rows]);

  /** الفروع المعروضة في القائمة = فقط فروع البراندات المختارة (تتابع براند → فرع) */
  const branchOptionsFiltered = useMemo(() => {
    if (selectedBrands.length === 0) return branchOptions;
    return branchOptions.filter((b) => {
      const slug = (b as { brand?: { slug?: string } }).brand?.slug ?? "";
      return selectedBrands.includes(slug);
    });
  }, [branchOptions, selectedBrands]);

  /** عند تغيير البراندات، إزالة الفروع المختارة التي لم تعد ضمن القائمة */
  useEffect(() => {
    if (selectedBrands.length === 0 || selectedBranches.length === 0) return;
    const validIds = new Set(branchOptionsFiltered.map((b) => b.id));
    setSelectedBranches((prev) => prev.filter((id) => validIds.has(id)));
  }, [selectedBrands, branchOptionsFiltered]);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.brand_name.toLowerCase().includes(q) ||
          r.branch_name.toLowerCase().includes(q) ||
          (r.branch_reference ?? "").toLowerCase().includes(q)
      );
    }
    if (selectedBrands.length > 0) {
      result = result.filter((r) => selectedBrands.includes(r.brand_slug ?? ""));
    }
    if (selectedBranches.length > 0) {
      result = result.filter((r) => r.branch_id != null && selectedBranches.includes(r.branch_id));
    }
    return result;
  }, [rows, searchQuery, selectedBrands, selectedBranches]);

  const totalGross = filteredRows.reduce((s, r) => s + r.gross_sales, 0);
  const grandTotal = useMemo(
    () =>
      filteredRows.reduce(
        (acc, r) => ({
          gross_sales: acc.gross_sales + r.gross_sales,
          tax: acc.tax + r.tax,
          discounts: acc.discounts + r.discounts,
          net_sales: acc.net_sales + r.net_sales,
        }),
        { gross_sales: 0, tax: 0, discounts: 0, net_sales: 0 }
      ),
    [filteredRows]
  );

  const toggleColumn = (key: string) => {
    const next = { ...columnVisibility, [key]: !columnVisibility[key] };
    setColumnVisibility(next);
    saveColumnVisibility(next);
  };

  return (
    <div
      className="flex min-h-screen flex-col px-4 py-6 sm:px-6 lg:px-8"
      style={{ fontFamily: "Inter, Lexend, Tajawal, system-ui, sans-serif" }}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 py-4 sm:px-6 sm:py-6">
        {/* 1️⃣ شريط البحث والفلترة – أعلى الصفحة */}
        <div className="hub-search-bar mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/95 sm:gap-4">
          <h1 className="hidden text-lg font-bold text-slate-800 dark:text-slate-100 sm:block">
            {isRTL ? "لوحة التحكم المركزية" : "Central Dashboard"}
          </h1>
          <UnifiedFilterSelect
            mode="brand"
            items={brands}
            selected={selectedBrands}
            onChange={setSelectedBrands}
            label={t("brand")}
            placeholder={t("all")}
          />
          <UnifiedFilterSelect
            mode="branch"
            items={branchOptionsFiltered}
            selected={selectedBranches}
            onChange={setSelectedBranches}
            label={t("branch")}
            placeholder={t("all")}
          />
          <UltimateDateRangePicker value={dateRange} onChange={setDateRange} />
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 dark:border-slate-600 dark:bg-slate-900/80 sm:min-w-[180px]">
            <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRTL ? "بحث..." : "Search..."}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              title={dark ? (isRTL ? "الوضع النهاري" : "Light mode") : (isRTL ? "الوضع الليلي" : "Dark mode")}
            >
              {dark ? (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* 2️⃣ جدول ملخص المبيعات – المكون الأساسي والأول تحت شريط البحث */}
        <section className="hub-table-container dashboard-card-float relative mb-8 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800/95">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <h2 className="text-base font-semibold text-slate-800 dark:text-white sm:text-lg">
              {isRTL ? "جدول ملخص المبيعات" : "Sales Summary Table"}
            </h2>
            <button
              ref={colFilterBtnRef}
              type="button"
              onClick={() => setColMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              title={isRTL ? "تصفية الأعمدة" : "Filter columns"}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {isRTL ? "تصفية" : "Filter"}
            </button>
          </div>

          <div className="hub-table-scroll overflow-auto" style={{ maxHeight: "min(65vh, 600px)" }}>
            {loading ? (
              <div className="py-12 text-center text-slate-500 dark:text-slate-400">
                {isRTL ? "جاري التحميل..." : "Loading..."}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <p className="text-center text-rose-600 dark:text-rose-400">{error}</p>
                <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                  {isRTL ? "تأكد من تشغيل السيرفر (Backend)" : "Ensure backend is running (port 8000)"}
                </p>
                <button
                  type="button"
                  onClick={loadData}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                >
                  {isRTL ? "إعادة المحاولة" : "Retry"}
                </button>
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="py-12 text-center text-slate-500 dark:text-slate-400">
                {rows.length === 0
                  ? isRTL
                    ? "لا توجد بيانات – اعتمد أياماً من صفحة المراجع المالي"
                    : "No data – Finalize days from Financial Auditor"
                  : isRTL
                    ? "لا توجد نتائج للبحث"
                    : "No results"}
              </div>
            ) : (
              <table className="hub-executive-table hub-sales-table min-w-full text-sm sm:text-base">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-200 bg-slate-100/95 dark:border-slate-700 dark:bg-slate-700/50">
                    {columnVisibility.branch && (
                      <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                        {isRTL ? COLUMN_LABELS.branch.ar : COLUMN_LABELS.branch.en}
                      </th>
                    )}
                    {columnVisibility.branch_reference && (
                      <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                        {isRTL ? COLUMN_LABELS.branch_reference.ar : COLUMN_LABELS.branch_reference.en}
                      </th>
                    )}
                    {columnVisibility.total_sales && (
                      <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                        {isRTL ? COLUMN_LABELS.total_sales.ar : COLUMN_LABELS.total_sales.en}
                      </th>
                    )}
                    {columnVisibility.sales_pct && (
                      <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                        {isRTL ? COLUMN_LABELS.sales_pct.ar : COLUMN_LABELS.sales_pct.en}
                      </th>
                    )}
                    {columnVisibility.net_sales_with_vat && (
                      <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                        {isRTL ? COLUMN_LABELS.net_sales_with_vat.ar : COLUMN_LABELS.net_sales_with_vat.en}
                      </th>
                    )}
                    {columnVisibility.vat && (
                      <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                        {isRTL ? COLUMN_LABELS.vat.ar : COLUMN_LABELS.vat.en}
                      </th>
                    )}
                    {columnVisibility.discount_amount && (
                      <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                        {isRTL ? COLUMN_LABELS.discount_amount.ar : COLUMN_LABELS.discount_amount.en}
                      </th>
                    )}
                    {columnVisibility.total_sales_excl_vat && (
                      <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                        {isRTL ? COLUMN_LABELS.total_sales_excl_vat.ar : COLUMN_LABELS.total_sales_excl_vat.en}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r, i) => {
                    const salesPct = totalGross > 0 ? (r.gross_sales / totalGross) * 100 : 0;
                    return (
                      <tr
                        key={`${r.branch_name}-${r.branch_reference ?? ""}-${i}`}
                        className="border-b border-slate-100 dark:border-slate-700"
                      >
                        {columnVisibility.branch && (
                          <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                            {r.branch_name}
                          </td>
                        )}
                        {columnVisibility.branch_reference && (
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                            {r.branch_reference || "—"}
                          </td>
                        )}
                        {columnVisibility.total_sales && (
                          <td className="hub-amount px-4 py-3 text-right tabular-nums font-medium text-slate-800 dark:text-slate-100">
                            {formatMoney(r.gross_sales)} ر.س
                          </td>
                        )}
                        {columnVisibility.sales_pct && (
                          <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">
                            {salesPct.toFixed(1)}%
                          </td>
                        )}
                        {columnVisibility.net_sales_with_vat && (
                          <td className="hub-amount px-4 py-3 text-right tabular-nums font-medium text-slate-800 dark:text-slate-100">
                            {formatMoney(r.gross_sales)} ر.س
                          </td>
                        )}
                        {columnVisibility.vat && (
                          <td className="hub-amount px-4 py-3 text-right tabular-nums font-medium text-slate-700 dark:text-slate-200">
                            {formatMoney(r.tax)} ر.س
                          </td>
                        )}
                        {columnVisibility.discount_amount && (
                          <td className="hub-amount px-4 py-3 text-right tabular-nums font-medium text-slate-700 dark:text-slate-200">
                            {formatMoney(r.discounts)} ر.س
                          </td>
                        )}
                        {columnVisibility.total_sales_excl_vat && (
                          <td className="hub-amount px-4 py-3 text-right tabular-nums font-semibold text-slate-900 dark:text-white">
                            {formatMoney(r.net_sales)} ر.س
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 z-10">
                  <tr className="border-t-2 border-slate-300 bg-slate-100 font-semibold dark:border-slate-600 dark:bg-slate-700/80">
                    <td
                      colSpan={
                        (columnVisibility.branch ? 1 : 0) +
                        (columnVisibility.branch_reference ? 1 : 0) ||
                        1
                      }
                      className="px-4 py-3 text-right"
                    >
                      {isRTL ? "المجموع" : "Total"}
                    </td>
                    {columnVisibility.total_sales && (
                      <td className="hub-amount px-4 py-3 text-right tabular-nums">
                        {formatMoney(grandTotal.gross_sales)} ر.س
                      </td>
                    )}
                    {columnVisibility.sales_pct && (
                      <td className="px-4 py-3 text-right tabular-nums">100%</td>
                    )}
                    {columnVisibility.net_sales_with_vat && (
                      <td className="hub-amount px-4 py-3 text-right tabular-nums">
                        {formatMoney(grandTotal.gross_sales)} ر.س
                      </td>
                    )}
                    {columnVisibility.vat && (
                      <td className="hub-amount px-4 py-3 text-right tabular-nums">
                        {formatMoney(grandTotal.tax)} ر.س
                      </td>
                    )}
                    {columnVisibility.discount_amount && (
                      <td className="hub-amount px-4 py-3 text-right tabular-nums">
                        {formatMoney(grandTotal.discounts)} ر.س
                      </td>
                    )}
                    {columnVisibility.total_sales_excl_vat && (
                      <td className="hub-amount px-4 py-3 text-right tabular-nums">
                        {formatMoney(grandTotal.net_sales)} ر.س
                      </td>
                    )}
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </section>

        {/* 4️⃣ الأيقونات الستة – تحت الجدول مباشرة */}
        <section className="w-full">
          <h2 className="mb-4 text-base font-semibold text-slate-800 dark:text-white sm:text-lg">
            {isRTL ? "اختر القسم" : "Select a section"}
          </h2>
          <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6">
            {visibleTiles.map((tile, i) => (
              <motion.button
                key={tile.key}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
                onClick={() => navigate(tile.to)}
                className="hub-tile-btn dashboard-card-float flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-5 transition hover:border-emerald-500/50 hover:bg-emerald-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800/80 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-900/20"
              >
                <span className="text-3xl sm:text-4xl">{tile.icon}</span>
                <span className="text-center text-sm font-semibold text-slate-800 dark:text-white sm:text-base">
                  {t(tile.labelKey)}
                </span>
              </motion.button>
            ))}
          </div>
        </section>

        {visibleTiles.length === 0 && (
          <p className="mt-8 text-center text-slate-500 dark:text-slate-400">
            {isRTL ? "لا توجد أقسام متاحة." : "No sections available."}
          </p>
        )}
      </div>

      {/* قائمة تصفية الأعمدة – Popover أنيق بجانب زر التصفية */}
      <AnimatePresence>
        {colMenuOpen && colFilterPosition && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9997] bg-black/20 dark:bg-black/40"
              onClick={() => setColMenuOpen(false)}
              aria-hidden
            />
            {createPortal(
              <motion.div
                ref={colFilterPanelRef}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: "tween", duration: 0.2 }}
                className="fixed z-[9999] w-[260px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
                style={{
                  top: colFilterPosition.top,
                  ...(isRTL ? { right: window.innerWidth - colFilterPosition.right } : { left: colFilterPosition.left }),
                }}
              >
                <div className="border-b border-slate-200 px-3 py-2.5 dark:border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                    {isRTL ? "إظهار الأعمدة" : "Show columns"}
                  </h3>
                </div>
                <div className="dropdown-scrollable max-h-[280px] overflow-y-auto px-1 py-2">
                  {COLUMN_KEYS.map((key) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <input
                        type="checkbox"
                        checked={!!columnVisibility[key]}
                        onChange={() => toggleColumn(key)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-600"
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {isRTL ? COLUMN_LABELS[key].ar : COLUMN_LABELS[key].en}
                      </span>
                    </label>
                  ))}
                </div>
              </motion.div>,
              document.body,
              "hub-column-filter-portal"
            )}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
