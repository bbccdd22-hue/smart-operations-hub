import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { format, subDays, startOfMonth } from "date-fns";
import {
  fetchDashboardSummary,
  fetchDashboardChartData,
  fetchDashboardInsights,
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
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSAIF = user?.username?.toLowerCase() === "saif" && user?.role === "owner";
  const defaultViewLoaded = useRef(false);

  const [brandsRaw, setBrandsRaw] = useState<Awaited<ReturnType<typeof fetchBrands>>>([]);
  const [branchesRaw, setBranchesRaw] = useState<Awaited<ReturnType<typeof fetchBranches>>>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<number[]>([]);
  const brands = useMemo(() => mergeBrandsWithFixed(brandsRaw), [brandsRaw]);
  const branches = useMemo(() => filterJunkBranches(branchesRaw), [branchesRaw]);
  const [selectedReportType, setSelectedReportType] = useState<string>("daily_sales");
  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_RANGE);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [chartData, setChartData] = useState<DashboardChartData | null>(null);
  const [insights, setInsights] = useState<Awaited<ReturnType<typeof fetchDashboardInsights>>["insights"]>([]);
  const [submittedBranchIds, setSubmittedBranchIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deliveryViewMode, setDeliveryViewMode] = useState<"total" | "detailed">("total");

  const dateFrom = format(dateRange.from, "yyyy-MM-dd");
  const dateTo = format(dateRange.to, "yyyy-MM-dd");

  useEffect(() => {
    fetchBrands().then(setBrandsRaw);
  }, []);

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
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
  }, []);

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

  /* Fetch on: refresh, brand, report type, date range, branch selection [Ref: 141317] */
  useEffect(() => {
    let mounted = true;
    setError(null);
    setRefreshing(true);
    Promise.all([
      fetchDashboardSummary({
        brands: selectedBrands.length ? selectedBrands : undefined,
        branch_ids: selectedBranches.length ? selectedBranches : undefined,
        date_from: dateFrom,
        date_to: dateTo,
        report_type: selectedReportType,
      }),
      fetchDashboardChartData({
        brands: selectedBrands.length ? selectedBrands : undefined,
        branch_ids: selectedBranches.length ? selectedBranches : undefined,
        date_from: dateFrom,
        date_to: dateTo,
        report_type: selectedReportType,
      }),
      fetchDashboardInsights({
        brands: selectedBrands.length ? selectedBrands : undefined,
      }),
    ])
      .then(([s, c, i]) => {
        if (mounted) {
          setSummary(s);
          setChartData(c);
          setInsights(i.insights ?? []);
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
  }, [refreshKey, selectedBrands, selectedReportType, dateFrom, dateTo, selectedBranches]);

  const netSales = summary?.totals?.system_total_sales ?? 0;
  const ordersCount = summary?.totals?.orders_count ?? 0;
  const shiftsCount = summary?.totals?.shifts_count ?? 0;
  const totalVariance = summary?.totals?.total_variance ?? 0;
  // [Ref: 866466] Use backend avg_check when available, else compute: Total Sales / Orders
  const avgCheck =
    summary?.totals?.avg_check ??
    (ordersCount && netSales ? netSales / ordersCount : shiftsCount && netSales ? netSales / shiftsCount : 0);

  const sparklineSales = useMemo(
    () => (chartData?.daily_series ?? []).map((d) => d.sales),
    [chartData]
  );

  const hasNoData =
    !error &&
    (summary?.by_brand ?? []).length === 0 &&
    (netSales === 0 || netSales == null) &&
    (summary?.totals?.shifts_count ?? 0) === 0;

  const financial = summary?.financial_summary;

  return (
    <div className="min-h-[calc(100vh-8rem)] w-full space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-sm [color:var(--glass-text-muted)]">{t("dashboard")}</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight [color:var(--glass-text)]">
            {t("appName")}
          </h1>
        </div>
      </div>

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
      />

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="page-card rounded-2xl border-amber-200 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:text-amber-200"
        >
          {error}
        </motion.div>
      )}

      {hasNoData && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="page-card rounded-2xl px-6 py-8 text-center"
        >
          <div className="text-4xl">📊</div>
          <h3 className="mt-3 text-lg font-semibold [color:var(--glass-text)]">{t("dashboard")}</h3>
          <p className="mt-2 text-sm [color:var(--glass-text-muted)]">{t("noDataForSelection")}</p>
          <p className="mt-1 text-xs [color:var(--glass-text-subtle)]">{t("noDataHint")}</p>
        </motion.div>
      )}

      {/* Insights Section */}
      {insights.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="page-card rounded-xl p-5"
        >
          <h2 className="text-sm font-semibold [color:var(--glass-text)]">{t("insights")}</h2>
          <p className="mt-0.5 text-xs [color:var(--glass-text-muted)]">{t("insightsSubtitle")}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {insights.map((ins, i) => {
              const title = ins.title_key ? t(ins.title_key) : (ins as { title?: string }).title || "";
              const msg = ins.message_key
                ? t(ins.message_key, ins.params || {})
                : (ins as { message?: string }).message || "";
              return (
                <div
                  key={i}
                  className={`page-card rounded-xl px-4 py-3 text-sm ${
                    ins.type === "success"
                      ? "border-emerald-200"
                      : ins.type === "alert"
                        ? "border-rose-200"
                        : ins.type === "warning"
                          ? "border-amber-200"
                          : "border-slate-200"
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
        </motion.section>
      )}

      {/* Financial Summary - Payments Report ONLY [Ref: 86561c, 873374, 874561] */}
      {financial && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold [color:var(--glass-text)]">{t("financialSummary")}</h2>
            <div className="flex gap-1 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] p-0.5">
              <button
                type="button"
                onClick={() => setDeliveryViewMode("total")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  deliveryViewMode === "total"
                    ? "bg-[#7C3AED] text-white"
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
                    ? "bg-[#7C3AED] text-white"
                    : "[color:var(--glass-text-muted)] hover:[color:var(--glass-text)]"
                }`}
              >
                {t("detailedBranchView")}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {deliveryViewMode === "total" ? (
              <>
                <div className="page-card flex flex-col rounded-2xl p-4 sm:min-h-[100px]">
                  <div className="text-xs font-medium uppercase tracking-wider [color:var(--glass-text-muted)]">
                    {t("foodicsCash")}
                  </div>
                  <div className="mt-2 text-xl font-bold [color:var(--glass-text)]">
                    {sar(financial?.cash_foodics ?? 0)}
                  </div>
                </div>
                <div className="page-card flex flex-col rounded-2xl p-4 sm:min-h-[100px]">
                  <div className="text-xs font-medium uppercase tracking-wider [color:var(--glass-text-muted)]">
                    {t("span")}
                  </div>
                  <div className="mt-2 text-xl font-bold [color:var(--glass-text)]">
                    {sar(financial?.span ?? 0)}
                  </div>
                </div>
                <div className="page-card flex flex-col rounded-2xl p-4 sm:min-h-[100px]">
                  <div className="text-xs font-medium uppercase tracking-wider [color:var(--glass-text-muted)]">
                    {t("netSalesLabel")}
                  </div>
                  <div className="mt-2 text-xl font-bold [color:var(--glass-text)]">
                    {sar(financial?.total_sales ?? netSales)}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="page-card flex flex-col rounded-2xl p-4 sm:min-h-[100px]">
                  <div className="text-xs font-medium uppercase tracking-wider [color:var(--glass-text-muted)]">
                    {t("foodicsCash")}
                  </div>
                  <div className="mt-2 text-xl font-bold [color:var(--glass-text)]">
                    {sar(financial?.cash_foodics ?? 0)}
                  </div>
                  {(financial?.cash_foodics_breakdown ?? []).length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-[var(--glass-border)] pt-2">
                      {financial.cash_foodics_breakdown.map((b) => (
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
                <div className="page-card flex flex-col rounded-2xl p-4 sm:min-h-[100px]">
                  <div className="text-xs font-medium uppercase tracking-wider [color:var(--glass-text-muted)]">
                    {t("span")}
                  </div>
                  <div className="mt-2 text-xl font-bold [color:var(--glass-text)]">
                    {sar(financial?.span ?? 0)}
                  </div>
                  {(financial?.span_breakdown ?? []).length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-[var(--glass-border)] pt-2">
                      {financial.span_breakdown!.map((b) => (
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
                <div className="page-card flex flex-col rounded-2xl p-4 sm:min-h-[100px]">
                  <div className="text-xs font-medium uppercase tracking-wider [color:var(--glass-text-muted)]">
                    {t("netSalesLabel")}
                  </div>
                  <div className="mt-2 text-xl font-bold [color:var(--glass-text)]">
                    {sar(financial?.total_sales ?? netSales)}
                  </div>
                  {(financial?.total_sales_breakdown ?? []).length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-[var(--glass-border)] pt-2">
                      {financial.total_sales_breakdown!.map((b) => (
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
              <div className="page-card flex flex-col rounded-2xl p-4 sm:min-h-[100px]">
                <div className="text-xs font-medium uppercase tracking-wider [color:var(--glass-text-muted)]">
                  {t("deliveryApps")}
                </div>
                <div className="mt-2 text-xl font-bold [color:var(--glass-text)]">
                  {sar(financial?.delivery_apps ?? 0)}
                </div>
              </div>
            ) : (
              (financial?.delivery_apps_breakdown ?? []).map((app) => (
                <div
                  key={app.app_name}
                  className="page-card flex flex-col rounded-2xl p-4 sm:min-h-[100px]"
                >
                  <div className="text-xs font-medium uppercase tracking-wider [color:var(--glass-text-muted)]">
                    {app.app_name}
                  </div>
                  <div className="mt-2 text-xl font-bold [color:var(--glass-text)]">
                    {sar(app.total)}
                  </div>
                  {app.by_branch.length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-[var(--glass-border)] pt-2">
                      {app.by_branch.map((b) => (
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
              <div className="page-card mt-3 rounded-2xl p-4">
                <div className="text-xs font-medium [color:var(--glass-text-muted)]">{t("deliveryApps")}</div>
                <div className="mt-2 text-xl font-bold [color:var(--glass-text)]">
                  {sar(financial?.delivery_apps ?? 0)}
                </div>
              </div>
            )}
        </motion.section>
      )}

      {/* KPI Cards - Total Sales first, symmetrical grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-h-[120px]">
        <KPICard
          label={t("totalSales")}
          value={netSales}
          formatter={(n) => sar(n)}
          sparklineData={sparklineSales}
          trend={sparklineSales.length > 1 && sparklineSales[0] < sparklineSales[sparklineSales.length - 1] ? "up" : "neutral"}
          delay={0}
        />
        <KPICard
          label={t("orderCount")}
          value={ordersCount}
          formatter={(n) => (n ? n.toLocaleString() : "—")}
          sparklineData={[]}
          delay={0.05}
          hint={ordersCount === 0 ? t("orderCountHint") : undefined}
        />
        <KPICard
          label={t("averageOrder")}
          value={avgCheck}
          formatter={(n) => (n ? sar(n) : "—")}
          delay={0.1}
          hint={avgCheck === 0 ? t("averageOrderHint") : undefined}
        />
        <KPICard
          label={t("activeBranches")}
          value={summary?.totals?.active_branches ?? 0}
          formatter={(n) => (n ? n.toLocaleString() : "—")}
          delay={0.15}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SalesVsForecastChart
            data={chartData?.daily_series ?? []}
            height={320}
            showFooter={isSAIF}
            variant="white"
          />
        </div>
        <div>
          <RevenueSplitChart
            data={chartData?.revenue_split ?? []}
            height={320}
            showFooter={isSAIF}
            variant="white"
          />
        </div>
      </div>

      {/* Product Analytics Charts - Top 5, Branch Donut, Sales vs Qty */}
      <div className="grid gap-6 lg:grid-cols-3">
        <TopProductsChart
          data={chartData?.top_products ?? []}
          height={280}
          showFooter={isSAIF}
          variant="white"
        />
        <BranchPerformanceDonutChart
          data={chartData?.branch_performance ?? []}
          height={280}
          showFooter={isSAIF}
          variant="white"
        />
        <SalesVsQuantityChart
          data={chartData?.sales_vs_qty_trend ?? []}
          height={280}
          showFooter={isSAIF}
          variant="white"
        />
      </div>

      {/* Alerts & Brand Table */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="page-card rounded-xl p-5"
        >
          <h2 className="text-sm font-semibold [color:var(--glass-text)]">{t("brandPerformance")}</h2>
          <div className="mt-4 overflow-hidden rounded-xl border-[var(--glass-border)]">
            <table className="w-full text-sm">
              <thead className="[background:var(--glass-bg)] text-xs [color:var(--glass-text-muted)]">
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
                    <tr key={r.shift__branch__brand__slug} className="border-t [border-color:var(--glass-border-subtle)]">
                      <td className="px-3 py-2 [color:var(--glass-text)]">{r.shift__branch__brand__name}</td>
                      <td className="px-3 py-2 text-right [color:var(--glass-text)]">{sar(r.system_total_sales)}</td>
                      <td className="px-3 py-2 text-right [color:var(--glass-text)]">{r.shifts}</td>
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
          className="page-card rounded-xl p-5"
        >
          <h2 className="text-sm font-semibold [color:var(--glass-text)]">{t("alerts")}</h2>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border [border-color:var(--glass-border)] [background:var(--glass-bg)] p-3">
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

            <div className="rounded-xl border [border-color:var(--glass-border)] [background:var(--glass-bg)] p-3">
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
    </div>
  );
}
