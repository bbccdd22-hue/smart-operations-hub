import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { subDays, parseISO, format } from "date-fns";
import { useDateRange } from "../contexts/DateRangeContext";
import { useProfitVisibility } from "../contexts/ProfitVisibilityContext";
import {
  fetchDashboardSummary,
  fetchDashboardChartData,
  fetchDashboardInsights,
  fetchProfitSummary,
  fetchBrands,
  fetchBranches,
  fetchSubmittedBranches,
  fetchSavedViews,
  type DashboardSummary,
  type DashboardChartData,
  type Brand,
} from "../lib/api";
import { FIXED_BRANDS } from "../config/brands";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationContext";
import DashboardFilterBar, { type DateRange } from "../components/DashboardFilterBar";
import KPICard, { sar } from "../components/KPICard";
import SalesVsForecastChart from "../components/SalesVsForecastChart";
import RevenueSplitChart from "../components/RevenueSplitChart";
import TopProductsChart from "../components/TopProductsChart";
import BranchPerformanceDonutChart from "../components/BranchPerformanceDonutChart";
import SalesVsQuantityChart from "../components/SalesVsQuantityChart";

const DEFAULT_RANGE: DateRange = {
  from: new Date(),
  to: new Date(),
};

const FILTER_STORAGE_KEY = "smart-ops-global-filters";

function loadFilterPrefs(): Partial<{
  brands: string[];
  branches: number[];
  reportType: string;
  dateFrom: string;
  dateTo: string;
}> {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      brands: Array.isArray(parsed.brands) ? parsed.brands : undefined,
      branches: Array.isArray(parsed.branches) ? parsed.branches : undefined,
      reportType: typeof parsed.reportType === "string" ? parsed.reportType : undefined,
      dateFrom: typeof parsed.dateFrom === "string" ? parsed.dateFrom : undefined,
      dateTo: typeof parsed.dateTo === "string" ? parsed.dateTo : undefined,
    };
  } catch {
    return {};
  }
}

function saveFilterPrefs(prefs: {
  brands: string[];
  branches: number[];
  reportType: string;
  dateFrom: string;
  dateTo: string;
}) {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

/** Filter out junk branches (Main, Branch) - Excel fallback rows; Arabic equivalents */
const JUNK_BRANCH_NAMES = ["main", "branch"];
const JUNK_BRANCH_NAMES_AR = ["الرئيسي", "الفرع", "رئيسي", "فرع"]; // Arabic equivalents
const JUNK_BRANCH_CODES = ["main", "branch"];

function filterJunkBranches<T extends { name?: string; name_ar?: string; code?: string }>(items: T[]): T[] {
  return items.filter((b) => {
    const name = (b.name || "").toLowerCase().trim();
    const nameAr = (b.name_ar || "").trim();
    const code = (b.code || "").toLowerCase().trim();
    if (JUNK_BRANCH_NAMES.includes(name)) return false;
    if (JUNK_BRANCH_CODES.includes(code)) return false;
    if (JUNK_BRANCH_NAMES_AR.some((j) => nameAr === j)) return false;
    if (code.endsWith("-main")) return false;
    return true;
  });
}

/** Merge API brands with FIXED_BRANDS - all fixed brands always visible. Use API data when exists. */
function mergeBrandsWithFixed(apiBrands: Brand[]): Brand[] {
  const bySlug = new Map(apiBrands.map((b) => [b.slug.toLowerCase(), b]));
  return FIXED_BRANDS.map((fb) => {
    const api = bySlug.get(fb.slug.toLowerCase());
    return api ?? { id: -1, name: fb.name, slug: fb.slug };
  });
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

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const notifications = useNotifications();
  const isSAIF = user?.username === "SAIF" && user?.role === "owner";
  const defaultViewLoaded = useRef(false);

  const [brandsRaw, setBrandsRaw] = useState<Awaited<ReturnType<typeof fetchBrands>>>([]);
  const [branchesRaw, setBranchesRaw] = useState<Awaited<ReturnType<typeof fetchBranches>>>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<number[]>([]);
  const brands = useMemo(() => mergeBrandsWithFixed(brandsRaw), [brandsRaw]);
  const branches = useMemo(() => filterJunkBranches(branchesRaw), [branchesRaw]);
  const [selectedReportType, setSelectedReportType] = useState<string>("daily_sales");
  const {
    dateRange,
    setDateRange,
    dateFrom,
    dateTo,
    comparisonEnabled,
    setComparisonEnabled,
    canUseComparison,
    compDateFrom,
    compDateTo,
  } = useDateRange();
  const {
    showFullFinancial,
    setShowFullFinancial,
    canUseProfitVisibility,
  } = useProfitVisibility();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [chartData, setChartData] = useState<DashboardChartData | null>(null);
  const [prevSummary, setPrevSummary] = useState<DashboardSummary | null>(null);
  const [prevChartData, setPrevChartData] = useState<DashboardChartData | null>(null);
  const [insights, setInsights] = useState<Awaited<ReturnType<typeof fetchDashboardInsights>>["insights"]>([]);
  const [submittedBranchIds, setSubmittedBranchIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deliveryViewMode, setDeliveryViewMode] = useState<"total" | "detailed">("total");
  const [profitSummary, setProfitSummary] = useState<Awaited<ReturnType<typeof fetchProfitSummary>> | null>(null);
  /** لا تُجلب البيانات ولا تظهر إلا بعد اختيار العلامة واضغط تحديث البيانات */
  const [dataRequested, setDataRequested] = useState(false);

  useEffect(() => {
    fetchBrands().then(setBrandsRaw);
  }, []);

  /** تحميل آخر الفلاتر من localStorage (الذاكرة الذكية) */
  const filterPrefsLoaded = useRef(false);
  useEffect(() => {
    if (filterPrefsLoaded.current) return;
    filterPrefsLoaded.current = true;
    const prefs = loadFilterPrefs();
    if (prefs.branches?.length) pendingBranchIdsRef.current = prefs.branches;
    if (prefs.brands?.length) setSelectedBrands(prefs.brands);
    if (prefs.reportType) setSelectedReportType(prefs.reportType);
    if (prefs.dateFrom && prefs.dateTo) {
      try {
        const from = parseISO(prefs.dateFrom);
        const to = parseISO(prefs.dateTo);
        if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
          setDateRange({ from, to });
        }
      } catch {
        /* ignore */
      }
    }
  }, [setDateRange]);

  /** حفظ الفلاتر في localStorage عند أي تغيير */
  useEffect(() => {
    saveFilterPrefs({
      brands: selectedBrands,
      branches: selectedBranches,
      reportType: selectedReportType,
      dateFrom: format(dateRange.from, "yyyy-MM-dd"),
      dateTo: format(dateRange.to, "yyyy-MM-dd"),
    });
  }, [selectedBrands, selectedBranches, selectedReportType, dateRange]);

  const pendingBranchIdsRef = useRef<number[] | null>(null);

  useEffect(() => {
    fetchBranches(
      selectedBrands[0],
      selectedBrands.length > 0 ? selectedBrands : undefined
    ).then((brs) => {
      setBranchesRaw(brs);
      if (pendingBranchIdsRef.current) {
        const ids = pendingBranchIdsRef.current;
        setSelectedBranches(ids.filter((id) => brs.some((b) => b.id === id)));
        pendingBranchIdsRef.current = null;
      } else {
        setSelectedBranches([]);
      }
    });
  }, [selectedBrands.join(",")]);

  const handleRefresh = useCallback(() => {
    if (selectedBrands.length === 0) {
      notifications?.addToast(t("selectBrandFirst"));
      return;
    }
    setDataRequested(true);
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
  }, [selectedBrands.length, notifications, t]);

  useEffect(() => {
    const onDataUpdated = () => handleRefresh();
    window.addEventListener("smart-ops-dashboard-refresh", onDataUpdated);
    return () => window.removeEventListener("smart-ops-dashboard-refresh", onDataUpdated);
  }, [handleRefresh]);

  const handleApplySavedView = (v: {
    brand: string | null;
    brandSlugs?: string[];
    branchIds: number[];
    reportType: string;
    dateRange: DateRange;
  }) => {
    setSelectedBrands(v.brandSlugs ?? (v.brand ? [v.brand] : []));
    pendingBranchIdsRef.current = v.branchIds;
    setSelectedReportType(v.reportType);
    setDateRange(v.dateRange);
  };

  useEffect(() => {
    if (!isSAIF || defaultViewLoaded.current) return;
    defaultViewLoaded.current = true;
    fetchSavedViews().then((views) => {
      const def = views.find((v) => v.is_default);
      if (def) {
        setSelectedBrands(def.brand_slug ? [def.brand_slug] : []);
        setSelectedBranches(def.branch_ids ?? []);
        setSelectedReportType(def.report_type || "daily_sales");
        setDateRange(daysToDateRange(def.date_range_days));
      }
    });
  }, [isSAIF]);

  useEffect(() => {
    fetchSubmittedBranches(dateTo).then((r) => setSubmittedBranchIds(r.branch_ids ?? []));
  }, [dateTo]);

  /** جلب ملخص الربح عند تفعيل الرؤية المالية الكاملة */
  useEffect(() => {
    if (!showFullFinancial || !canUseProfitVisibility) {
      setProfitSummary(null);
      return;
    }
    let mounted = true;
    fetchProfitSummary({
      date_from: dateFrom,
      date_to: dateTo,
      brands: selectedBrands.length ? selectedBrands : undefined,
      branch_ids: selectedBranches.length ? selectedBranches : undefined,
    })
      .then((s) => {
        if (mounted) setProfitSummary(s);
      })
      .catch(() => {
        if (mounted) setProfitSummary(null);
      });
    return () => {
      mounted = false;
    };
  }, [showFullFinancial, canUseProfitVisibility, dateFrom, dateTo, selectedBrands, selectedBranches]);

  /** إعادة حساب صافي الربح – مسح cache وجلب من المصدر */
  const handleRecalculateProfit = useCallback(async () => {
    try {
      const s = await fetchProfitSummary({
        date_from: dateFrom,
        date_to: dateTo,
        brands: selectedBrands.length ? selectedBrands : undefined,
        branch_ids: selectedBranches.length ? selectedBranches : undefined,
        bypassCache: true,
      });
      setProfitSummary(s);
      notifications?.addToast(t("recalculateSuccess"));
    } catch {
      setProfitSummary(null);
    }
  }, [dateFrom, dateTo, selectedBrands, selectedBranches, notifications, t]);

  /* Fetch on: refresh, brand, report type, date range, branch selection [Ref: 141317] – لا يُجلب إلا بعد dataRequested */
  useEffect(() => {
    if (!dataRequested) {
      setRefreshing(false);
      return;
    }
    let mounted = true;
    setError(null);
    setRefreshing(true);
    const baseParams = {
      brands: selectedBrands.length ? selectedBrands : undefined,
      branch_ids: selectedBranches.length ? selectedBranches : undefined,
      report_type: selectedReportType,
    };
    const fetchCurrent = Promise.all([
      fetchDashboardSummary({ ...baseParams, date_from: dateFrom, date_to: dateTo }),
      fetchDashboardChartData({ ...baseParams, date_from: dateFrom, date_to: dateTo }),
      fetchDashboardInsights({ brands: selectedBrands.length ? selectedBrands : undefined }),
    ]);
    const fetchPrev =
      comparisonEnabled && compDateFrom && compDateTo && canUseComparison
        ? Promise.all([
            fetchDashboardSummary({ ...baseParams, date_from: compDateFrom, date_to: compDateTo }),
            fetchDashboardChartData({ ...baseParams, date_from: compDateFrom, date_to: compDateTo }),
          ])
        : Promise.all([null, null]);
    Promise.all([fetchCurrent, fetchPrev])
      .then(([[s, c, i], [ps, pc]]) => {
        if (mounted) {
          setSummary(s);
          setChartData(c);
          setInsights(i.insights ?? []);
          setPrevSummary(ps ?? null);
          setPrevChartData(pc ?? null);
        }
      })
      .catch(() => {
        if (mounted) setError("Unable to load dashboard data.");
      })
      .finally(() => {
        if (mounted) setRefreshing(false);
      });
    return () => {
      mounted = false;
    };
  }, [dataRequested, refreshKey, selectedBrands, selectedReportType, dateFrom, dateTo, selectedBranches, comparisonEnabled, compDateFrom, compDateTo, canUseComparison]);

  const netSales = summary?.totals?.system_total_sales ?? 0;
  const financial = summary?.financial_summary;
  /** Net Sales for display: prefer financial_summary.total_sales (payments report) when available, else system_total_sales */
  const displayNetSales = financial?.total_sales ?? netSales;
  const ordersCount = summary?.totals?.orders_count ?? 0;
  const shiftsCount = summary?.totals?.shifts_count ?? 0;
  const totalVariance = summary?.totals?.total_variance ?? 0;
  // [Ref: 866466] Use backend avg_check when available, else compute: Total Sales / Orders
  const avgCheck =
    summary?.totals?.avg_check ??
    (ordersCount && netSales ? netSales / ordersCount : shiftsCount && netSales ? netSales / shiftsCount : 0);

  /** مقارنة الفترات: قيم الفترة السابقة */
  const prevFinancial = prevSummary?.financial_summary;
  const prevNetSales = prevFinancial?.total_sales ?? prevSummary?.totals?.system_total_sales ?? 0;
  const prevOrdersCount = prevSummary?.totals?.orders_count ?? 0;
  const prevShiftsCount = prevSummary?.totals?.shifts_count ?? 0;
  const prevAvgCheck =
    prevSummary?.totals?.avg_check ??
    (prevOrdersCount && prevNetSales ? prevNetSales / prevOrdersCount : prevShiftsCount && prevNetSales ? prevNetSales / prevShiftsCount : 0);
  const prevActiveBranches = prevSummary?.totals?.active_branches ?? 0;

  const sparklineSales = useMemo(
    () => (chartData?.daily_series ?? []).map((d) => d.sales),
    [chartData]
  );

  const hasNoData =
    !error &&
    (summary?.by_brand ?? []).length === 0 &&
    (netSales === 0 || netSales == null) &&
    (summary?.totals?.shifts_count ?? 0) === 0;

  return (
    <div
      className="dashboard-viewport flex w-full max-w-full flex-col gap-1.5 overflow-x-hidden md:gap-2"
      style={{ width: "100%", margin: "0 auto", minHeight: 0 }}
    >
      <div className="shrink-0">
        <DashboardFilterBar
        brands={brands}
        branches={branches}
        selectedBrands={selectedBrands}
        selectedBranches={selectedBranches}
        selectedReportType={selectedReportType}
        dateRange={dateRange}
        submittedBranchIds={submittedBranchIds}
        isSAIF={isSAIF}
        refreshing={refreshing}
        onBrandChange={(slugs) => {
          pendingBranchIdsRef.current = null;
          setSelectedBrands(slugs);
        }}
        onBranchChange={setSelectedBranches}
        onReportTypeChange={setSelectedReportType}
        onDateRangeChange={setDateRange}
        onRefresh={handleRefresh}
        onApplySavedView={handleApplySavedView}
        canUseComparison={canUseComparison}
        comparisonEnabled={comparisonEnabled}
        onComparisonChange={setComparisonEnabled}
        />
      </div>

      {!dataRequested && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-1 items-center justify-center float-card rounded-2xl px-6 py-8 text-center"
        >
          <div>
            <div className="text-4xl">📊</div>
            <h3 className="mt-3 text-lg font-semibold [color:var(--glass-text)]">{t("dashboard")}</h3>
            <p className="mt-2 text-sm [color:var(--glass-text-muted)]">{t("dashboardSelectBrandHint")}</p>
          </div>
        </motion.div>
      )}

      {dataRequested && error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="shrink-0 float-card rounded-2xl border-amber-200 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:text-amber-200"
        >
          {error}
        </motion.div>
      )}

      {dataRequested && hasNoData && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-1 items-center justify-center float-card rounded-2xl px-6 py-8 text-center"
        >
          <div>
            <div className="text-4xl">📊</div>
            <h3 className="mt-3 text-lg font-semibold [color:var(--glass-text)]">{t("dashboard")}</h3>
            <p className="mt-2 text-sm [color:var(--glass-text-muted)]">{t("noDataForSelection")}</p>
            <p className="mt-1 text-xs [color:var(--glass-text-subtle)]">{t("noDataHint")}</p>
          </div>
        </motion.div>
      )}

      {/* Main content: overflow-y auto on data only; header/footer remain visible */}
      {dataRequested && !hasNoData && (
        <div className="dashboard-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overflow-x-hidden md:gap-2" style={{ width: "100%", margin: "0 auto" }}>
          <div className="dashboard-data flex min-h-0 flex-1 flex-col gap-1.5 md:gap-2">
      {/* Metrics block: Financial Summary + KPI (locked ~20% min-height) */}
      <div className="dashboard-metrics flex flex-col gap-1.5 md:gap-2">
      {/* Financial Summary - Payments Report ONLY [Ref: 86561c, 873374, 874561] – يُخفى في الوضع التشغيلي */}
      <AnimatePresence mode="wait">
      {financial && showFullFinancial && (
        <motion.section
          key="financial-summary"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="w-full shrink-0"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
            <h2 className="text-xs font-semibold text-slate-300">{t("financialSummary")}</h2>
            <div className="flex gap-1 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] p-0.5">
              <button
                type="button"
                onClick={() => setDeliveryViewMode("total")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  deliveryViewMode === "total"
                    ? "bg-[#00ffcc] text-slate-900"
                    : "[color:var(--glass-text-muted)] hover:[color:var(--glass-text)]"
                }`}
              >
                {t("totalView")}
              </button>
              <button
                type="button"
                onClick={() => setDeliveryViewMode("detailed")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  deliveryViewMode === "detailed"
                    ? "bg-[#00ffcc] text-slate-900"
                    : "[color:var(--glass-text-muted)] hover:[color:var(--glass-text)]"
                }`}
              >
                {t("detailedBranchView")}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-2">
            {deliveryViewMode === "total" ? (
              <>
                <div className="float-card flex flex-col rounded-2xl p-3 sm:min-h-[60px]">
                  <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    {t("foodicsCash")}
                  </div>
                  <div className="metric-glow mt-2 text-xl font-bold text-slate-100">
                    {sar(financial?.cash_foodics ?? 0)}
                  </div>
                </div>
                <div className="float-card flex flex-col rounded-2xl p-3 sm:min-h-[60px]">
                  <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    {t("span")}
                  </div>
                  <div className="metric-glow mt-2 text-xl font-bold text-slate-100">
                    {sar(financial?.span ?? 0)}
                  </div>
                </div>
                <div className="float-card flex flex-col rounded-2xl p-3 sm:min-h-[60px]">
                  <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    {t("netSalesLabel")}
                  </div>
                  <div className="metric-glow mt-2 text-xl font-bold text-slate-100">
                    {sar(financial?.total_sales ?? netSales)}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="float-card flex flex-col rounded-2xl p-3 sm:min-h-[60px]">
                  <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    {t("foodicsCash")}
                  </div>
                  <div className="metric-glow mt-2 text-xl font-bold text-slate-100">
                    {sar(financial?.cash_foodics ?? 0)}
                  </div>
                  {(financial?.cash_foodics_breakdown ?? []).length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-[var(--glass-border)] pt-2">
                      {(financial?.cash_foodics_breakdown ?? []).map((b) => (
                        <div
                          key={`cash-${b.branch_id}`}
                          className="flex justify-between text-xs [color:var(--glass-text-muted)]"
                        >
                          <span className="truncate">{b.branch_name || "—"}</span>
                          <span className="ml-2 shrink-0 font-medium [color:var(--glass-text)]">{sar(b.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="float-card flex flex-col rounded-2xl p-3 sm:min-h-[60px]">
                  <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    {t("span")}
                  </div>
                  <div className="metric-glow mt-2 text-xl font-bold text-slate-100">
                    {sar(financial?.span ?? 0)}
                  </div>
                  {(financial?.span_breakdown ?? []).length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-[var(--glass-border)] pt-2">
                      {(financial?.span_breakdown ?? []).map((b) => (
                        <div
                          key={`span-${b.branch_id}`}
                          className="flex justify-between text-xs [color:var(--glass-text-muted)]"
                        >
                          <span className="truncate">{b.branch_name || "—"}</span>
                          <span className="ml-2 shrink-0 font-medium [color:var(--glass-text)]">{sar(b.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="float-card flex flex-col rounded-2xl p-3 sm:min-h-[60px]">
                  <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    {t("netSalesLabel")}
                  </div>
                  <div className="metric-glow mt-2 text-xl font-bold text-slate-100">
                    {sar(financial?.total_sales ?? netSales)}
                  </div>
                  {(financial?.total_sales_breakdown ?? []).length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-[var(--glass-border)] pt-2">
                      {(financial?.total_sales_breakdown ?? []).map((b) => (
                        <div
                          key={`sales-${b.branch_id}`}
                          className="flex justify-between text-xs [color:var(--glass-text-muted)]"
                        >
                          <span className="truncate">{b.branch_name || "—"}</span>
                          <span className="ml-2 shrink-0 font-medium [color:var(--glass-text)]">{sar(b.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
            {deliveryViewMode === "total" ? (
              <div className="float-card flex flex-col rounded-2xl p-3 sm:min-h-[60px]">
                <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  {t("deliveryApps")}
                </div>
                <div className="metric-glow mt-2 text-xl font-bold text-slate-100">
                  {sar(financial?.delivery_apps ?? 0)}
                </div>
              </div>
            ) : (
              (financial?.delivery_apps_breakdown ?? []).map((app) => (
                <div
                  key={app.app_name}
                  className="float-card flex flex-col rounded-2xl p-3 sm:min-h-[60px]"
                >
                  <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    {app.app_name}
                  </div>
                  <div className="metric-glow mt-2 text-xl font-bold text-slate-100">
                    {sar(app.total)}
                  </div>
                  {(app.by_branch ?? []).length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-[var(--glass-border)] pt-2">
                      {(app.by_branch ?? []).map((b) => (
                        <div
                          key={`${app.app_name}-${b.branch_id}`}
                          className="flex justify-between text-xs [color:var(--glass-text-muted)]"
                        >
                          <span className="truncate">{b.branch_name || "—"}</span>
                          <span className="ml-2 shrink-0 font-medium [color:var(--glass-text)]">{sar(b.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          {deliveryViewMode === "detailed" &&
            (financial?.delivery_apps_breakdown ?? []).length === 0 &&
            (financial?.delivery_apps ?? 0) > 0 && (
              <div className="float-card mt-3 rounded-2xl p-4">
                <div className="text-xs font-medium [color:var(--glass-text-muted)]">{t("deliveryApps")}</div>
                <div className="mt-2 text-xl font-bold [color:var(--glass-text)]">
                  {sar(financial?.delivery_apps ?? 0)}
                </div>
              </div>
            )}
        </motion.section>
      )}
      </AnimatePresence>

      {/* بطاقات الربح عند الرؤية المالية الكاملة */}
      <AnimatePresence mode="wait">
      {showFullFinancial && canUseProfitVisibility && profitSummary && (
        <motion.section
          key="profit-cards"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3"
        >
          <div className="float-card flex flex-col rounded-2xl p-3">
            <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
              {t("operatingCosts") ?? "Operating Costs"}
            </div>
            <div className="metric-glow mt-2 text-xl font-bold text-slate-100">
              {sar(parseFloat(profitSummary.total_cogs ?? "0"))}
            </div>
          </div>
          <div className="float-card flex flex-col rounded-2xl p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                {t("netProfit")}
              </span>
              <button
                type="button"
                onClick={handleRecalculateProfit}
                title={t("recalculate")}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-[#00ffcc]"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            <div className={`metric-glow mt-2 text-xl font-bold ${
              parseFloat(profitSummary.gross_profit ?? "0") >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}>
              {sar(parseFloat(profitSummary.gross_profit ?? "0"))}
            </div>
          </div>
          <div className="float-card flex flex-col rounded-2xl p-3">
            <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
              {t("netIncome") ?? "Net Income"}
            </div>
            <div className="metric-glow mt-2 text-xl font-bold text-slate-100">
              {sar(parseFloat(profitSummary.total_sales ?? "0"))}
            </div>
          </div>
        </motion.section>
      )}
      </AnimatePresence>

      {/* تنبيه SAIF: مصاريف معلّقة لمراجعة يدوية */}
      {isSAIF && profitSummary?.flagged_for_review && profitSummary.flagged_for_review.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="shrink-0 rounded-2xl border border-amber-500/50 bg-amber-500/10 px-4 py-3"
        >
          <h3 className="text-sm font-semibold text-amber-200">
            {t("expensesFlaggedForReview")}
          </h3>
          <p className="mt-1 text-xs text-amber-200/90">
            {t("expensesFlaggedForReviewDesc")}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-amber-100">
            {profitSummary.flagged_for_review.slice(0, 5).map((f, i) => (
              <li key={i}>
                {f.ingredient_name} ({f.serial_code}): {f.cost} ر.س – {f.reason === "invalid_unit_cost" ? "تكلفة غير صالحة" : "تجاوز نسبة المبيعات"}
              </li>
            ))}
            {profitSummary.flagged_for_review.length > 5 && (
              <li className="text-amber-300">+{profitSummary.flagged_for_review.length - 5} أخرى</li>
            )}
          </ul>
        </motion.div>
      )}

      {/* KPI Cards */}
      <div className="grid shrink-0 grid-cols-2 gap-1.5 md:grid-cols-4 md:gap-2 [&>*]:min-h-[56px] md:[&>*]:min-h-[60px]">
        <KPICard
          label={t("netSalesLabel")}
          value={displayNetSales}
          formatter={(n) => new Intl.NumberFormat(i18n.language || undefined, { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(n)}
          sparklineData={sparklineSales}
          trend={sparklineSales.length > 1 && sparklineSales[0] < sparklineSales[sparklineSales.length - 1] ? "up" : "neutral"}
          delay={0}
          previousValue={comparisonEnabled && canUseComparison ? prevNetSales : undefined}
        />
        <KPICard
          label={t("orderCount")}
          value={ordersCount}
          formatter={(n) => (n ? n.toLocaleString() : "—")}
          sparklineData={[]}
          delay={0.05}
          hint={ordersCount === 0 ? t("orderCountHint") : undefined}
          previousValue={comparisonEnabled && canUseComparison ? prevOrdersCount : undefined}
        />
        <KPICard
          label={t("averageOrder")}
          value={avgCheck}
          formatter={(n) => (n ? sar(n) : "—")}
          delay={0.1}
          hint={avgCheck === 0 ? t("averageOrderHint") : undefined}
          previousValue={comparisonEnabled && canUseComparison ? prevAvgCheck : undefined}
        />
        <KPICard
          label={t("activeBranches")}
          value={summary?.totals?.active_branches ?? 0}
          formatter={(n) => (n ? n.toLocaleString() : "—")}
          delay={0.15}
          previousValue={comparisonEnabled && canUseComparison ? prevActiveBranches : undefined}
        />
      </div>
      </div>
      {/* end dashboard-metrics */}

      {/* Charts Row – Sales vs AI Forecast + Revenue Distribution (locked 40% min) */}
      <div className={`dashboard-charts grid shrink-0 grid-cols-1 gap-2 md:grid-cols-2 md:gap-3 ${showFullFinancial ? "lg:grid-cols-3" : "lg:grid-cols-1"}`}>
        <div className={`min-w-0 md:col-span-2 ${showFullFinancial ? "lg:col-span-2" : "lg:col-span-1"}`}>
          <SalesVsForecastChart
            data={chartData?.daily_series ?? []}
            previousSeries={comparisonEnabled && canUseComparison ? prevChartData?.daily_series ?? [] : undefined}
            height={280}
            showFooter={isSAIF}
            variant="white"
          />
        </div>
        <AnimatePresence mode="wait">
          {showFullFinancial && (
            <motion.div
              key="revenue-split"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="min-w-0 flex flex-col"
            >
              <RevenueSplitChart
                data={chartData?.revenue_split ?? []}
                height={280}
                showFooter={isSAIF}
                variant="white"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Product Analytics Charts */}
      <div className="grid min-h-0 shrink-0 grid-cols-1 gap-1.5 md:grid-cols-2 md:gap-2 lg:grid-cols-3">
        <TopProductsChart
          data={chartData?.top_products ?? []}
          height={220}
          showFooter={isSAIF}
          variant="white"
        />
        <BranchPerformanceDonutChart
          data={chartData?.branch_performance ?? []}
          height={220}
          showFooter={isSAIF}
          variant="white"
        />
        <SalesVsQuantityChart
          data={chartData?.sales_vs_qty_trend ?? []}
          height={220}
          showFooter={isSAIF}
          variant="white"
        />
      </div>

      {/* Alerts & Brand Table */}
      <div className="grid min-h-0 shrink-0 grid-cols-1 gap-1.5 md:grid-cols-2 md:gap-2">
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="float-card rounded-xl p-3"
        >
          <h2 className="text-xs font-semibold text-slate-300">{t("brandPerformance")}</h2>
          <div className="mt-2 overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-xs text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left">{t("brand")}</th>
                  <th className="px-3 py-2 text-right">{t("sales")}</th>
                  <th className="px-3 py-2 text-right">{t("shifts")}</th>
                </tr>
              </thead>
              <tbody>
                {(summary?.by_brand ?? []).length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center [color:var(--glass-text-muted)]" colSpan={3}>
                      {t("noDataYet")}
                    </td>
                  </tr>
                ) : (
                  (summary?.by_brand ?? []).map((r) => (
                    <tr key={r.shift__branch__brand__slug} className="table-row-hover border-t border-white/5 transition-colors">
                      <td className="px-3 py-2 text-slate-200">{r.shift__branch__brand__name}</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-100">{sar(r.system_total_sales)}</td>
                      <td className="px-3 py-2 text-right text-slate-200">{r.shifts}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="float-card rounded-xl p-3"
        >
          <h2 className="text-xs font-semibold text-slate-300">{t("alerts")}</h2>
          <div className="mt-2 space-y-2">
            <div className="rounded-lg border [border-color:var(--glass-border)] [background:var(--glass-bg)] p-2">
              <div className="text-xs font-medium [color:var(--glass-text-muted)]">{t("cashVariance")}</div>
              {(summary?.alerts?.variance_cash ?? []).length === 0 ? (
                <div className="mt-2 text-sm [color:var(--glass-text-muted)]">{t("noAlerts")}</div>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {(summary?.alerts?.variance_cash ?? []).slice(0, 6).map((a) => (
                    <li key={`${a.shift__branch__id}-${a.variance_cash}`} className="flex justify-between">
                      <span className="[color:var(--glass-text-muted)]">
                        {a.shift__branch__brand__name} — {a.shift__branch__name}
                      </span>
                      <span className="font-medium [color:var(--glass-text)]">{sar(a.variance_cash)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border [border-color:var(--glass-border)] [background:var(--glass-bg)] p-2">
              <div className="text-xs font-medium [color:var(--glass-text-muted)]">{t("lowStock")}</div>
              {(summary?.alerts?.low_stock ?? []).length === 0 ? (
                <div className="mt-2 text-sm [color:var(--glass-text-muted)]">{t("noAlerts")}</div>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {(summary?.alerts?.low_stock ?? []).slice(0, 6).map((s) => (
                    <li key={`${s.branch_id}-${s.ingredient}`} className="flex justify-between">
                      <span className="[color:var(--glass-text-muted)]">
                        {s.branch} — {s.ingredient}
                      </span>
                      <span className="[color:var(--glass-text-muted)]">
                        {s.on_hand} / {s.reorder_level}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </motion.section>
      </div>

            {/* Insights & Dashboard – footer at bottom, above slim footer */}
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2 shrink-0 space-y-1.5 border-t border-white/5 pt-2"
            >
              {insights.length > 0 && (
                <div className="float-card rounded-lg p-2">
                  <h2 className="text-[11px] font-semibold [color:var(--glass-text)]">{t("insights")}</h2>
                  <div className="mt-1.5 grid gap-1.5 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3">
                    {insights.map((ins, i) => {
                      const title = ins.title_key ? t(ins.title_key) : (ins as { title?: string }).title || "";
                      const msg = ins.message_key
                        ? t(ins.message_key, ins.params || {})
                        : (ins as { message?: string }).message || "";
                      return (
                        <div
                          key={i}
                          className={`float-card rounded-xl px-4 py-3 text-sm ${
                            ins.type === "success"
                              ? "border-[#00ffcc]/30"
                              : ins.type === "alert"
                                ? "border-rose-400/30"
                                : ins.type === "warning"
                                  ? "border-amber-400/30"
                                  : "border-white/10"
                          }`}
                        >
                          <div className="font-semibold [color:var(--glass-text)]">{title}</div>
                          <div className="mt-1 text-xs [color:var(--glass-text-muted)]">
                            {msg || (ins.title_key === "insightZeroVarianceNone" ? t("insightZeroVarianceNoneMsg") : "")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between py-0.5 text-[10px] [color:var(--glass-text-muted)]">
                <span>{t("dashboard")}</span>
                <span>{t("appName")}</span>
              </div>
            </motion.section>
          </div>
        </div>
      )}
    </div>
  );
}
