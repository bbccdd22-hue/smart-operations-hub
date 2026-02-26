/**
 * محرك توقعات الطلبات الذكي – Order Forecasting Engine
 * يعتمد على مقارنة مبيعات فترة مستقبلية بفترة سابقة (أسبوع، شهر) حسب العلامة التجارية
 * الربط بالمكونات: تحويل المبيعات المتوقعة إلى كميات مواد خام عبر قائمة الإنتاج
 */
import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ar } from "date-fns/locale";
import {
  fetchForecast,
  fetchBranches,
  fetchBrands,
  fetchPurchaseSuggestions,
  type ForecastDay,
  type Branch,
  type Brand,
  type PurchaseSuggestion,
} from "../lib/api";
import UnifiedFilterSelect from "../components/UnifiedFilterSelect";

function sar(n: number, locale?: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(n);
}

/** Confidence: narrower (upper-lower)/predicted = higher confidence. Returns 0-100. */
function computeConfidence(days: ForecastDay[]): number {
  if (!days.length) return 0;
  let sum = 0;
  let count = 0;
  for (const d of days) {
    if (d.predicted_sales > 0) {
      const span = (d.upper - d.lower) / d.predicted_sales;
      sum += Math.max(0, 100 - span * 100);
      count++;
    }
  }
  return count > 0 ? Math.round(sum / count) : 0;
}

/** Days with predicted sales in top 25% get "Action Needed" (uses 30-day pool when available) */
function isHighVolume(day: ForecastDay, sevenDay: ForecastDay[], thirtyDay: ForecastDay[]): boolean {
  const pool = thirtyDay.length ? thirtyDay : sevenDay;
  if (!pool.length || day.predicted_sales <= 0) return false;
  const sorted = [...pool].sort((a, b) => b.predicted_sales - a.predicted_sales);
  const idx = Math.min(Math.floor(sorted.length * 0.25), sorted.length - 1);
  const threshold = sorted[idx]?.predicted_sales ?? 0;
  return day.predicted_sales >= threshold;
}

export default function PredictiveDashboardPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [forecast, setForecast] = useState<{
    next_7_days: ForecastDay[];
    next_30_days: ForecastDay[];
    warnings: Array<{ message?: string }>;
  } | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [branchId, setBranchId] = useState<number | "">("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [purchaseSuggestions, setPurchaseSuggestions] = useState<PurchaseSuggestion[]>([]);
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  useEffect(() => {
    fetchBrands().then(setBrands);
  }, []);

  useEffect(() => {
    if (!selectedBrand) {
      setBranches([]);
      setBranchId("");
      return;
    }
    fetchBranches(selectedBrand).then((b) => {
      setBranches(b);
      setBranchId("");
    });
  }, [selectedBrand]);

  useEffect(() => {
    const brandObj = brands.find((b) => b.slug === selectedBrand);
    fetchForecast({
      branchId: branchId === "" ? undefined : branchId,
      brandId: brandObj?.id,
    }).then(setForecast);
  }, [branchId, selectedBrand, brands]);

  useEffect(() => {
    if (branchId === "") {
      setPurchaseSuggestions([]);
      return;
    }
    let cancelled = false;
    setPurchaseLoading(true);
    fetchPurchaseSuggestions({
      branch_id: branchId,
      horizon_days: 7,
      lookback_days: 90,
    })
      .then((res) => {
        if (!cancelled) setPurchaseSuggestions((res.suggestions ?? []).slice(0, 6));
      })
      .catch(() => {
        if (!cancelled) setPurchaseSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setPurchaseLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  const metrics = useMemo(() => {
    const days30 = forecast?.next_30_days ?? [];
    const total = days30.reduce((s, d) => s + d.predicted_sales, 0);
    const peak = days30.length ? days30.reduce((a, b) => (a.predicted_sales >= b.predicted_sales ? a : b), days30[0]) : null;
    const confidence = computeConfidence(days30);
    return { total, peak, confidence };
  }, [forecast?.next_30_days]);

  const chartData = useMemo(() => {
    const days = forecast?.next_30_days ?? [];
    return days.map((d) => ({
      ...d,
      date: d.date,
      value: d.predicted_sales,
      label: format(parseISO(d.date), "dd MMM", { locale: isRTL ? ar : undefined }),
    }));
  }, [forecast?.next_30_days, isRTL]);

  return (
    <div className="space-y-4">
      {/* Compact header with branch filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-800 dark:text-white">
            {t("predictiveDashboard")}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {t("forecastSubtitle")}
          </p>
        </div>
        <UnifiedFilterSelect
          mode="brand"
          items={brands}
          selected={selectedBrand}
          onChange={setSelectedBrand}
          selectionMode="single"
          label={isRTL ? "العلامة التجارية" : "Brand"}
          placeholder={isRTL ? "اختيار العلامة التجارية" : "Select Brand"}
        />
        <UnifiedFilterSelect
          mode="branch"
          items={branches}
          selected={branchId}
          onChange={setBranchId}
          selectionMode="single"
          label={t("branch")}
          placeholder={`${t("all")} ${t("branch")}`}
          disabled={!selectedBrand}
        />
        {branchId && (
          <Link
            to="/prep-list"
            className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            {isRTL ? "تحويل إلى قائمة الإنتاج" : "To Production List"}
          </Link>
        )}
      </div>

      {forecast?.warnings?.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          {forecast.warnings.map((w, i) => (
            <div key={i}>{w.message ?? "Data gap or missing history."}</div>
          ))}
        </div>
      ) : null}

      {/* Top metrics: 3 summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/80">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t("monthlyForecastTotal")}
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {sar(metrics.total, i18n.language)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/80">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t("peakDayPrediction")}
          </div>
          <div className="mt-1 font-sans text-lg font-semibold text-slate-800 dark:text-white">
            {metrics.peak
              ? format(parseISO(metrics.peak.date), "EEE, d MMM", { locale: isRTL ? ar : undefined })
              : "—"}
          </div>
          {metrics.peak && (
            <div className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">
              {sar(metrics.peak.predicted_sales, i18n.language)}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/80">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t("confidenceScore")}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-sky-500 dark:text-sky-400">
              {metrics.confidence}%
            </span>
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
            {t("basedOnHistorical")}
          </div>
        </div>
      </div>

      {/* Main layout: Line chart (left) | Next 7 Days sidebar (right) */}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* 30-day line chart */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/90">
          <div className="border-b border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100/50 px-5 py-3 dark:border-slate-700 dark:from-slate-800/80 dark:to-slate-900/50">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {t("salesTrend30")}
            </h2>
          </div>
          <div className="relative p-4">
            <div
              className="absolute inset-0 rounded-b-2xl bg-gradient-to-b from-emerald-500/5 to-transparent dark:from-emerald-500/10"
              aria-hidden
            />
            <div className="relative" style={{ height: 320 }}>
              {chartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="predictiveGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.3)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "rgb(100 116 139)" }}
                      tickLine={false}
                      axisLine={{ stroke: "rgb(148 163 184 / 0.3)" }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "rgb(100 116 139)" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: "12px",
                        borderRadius: "10px",
                        border: "1px solid rgb(148 163 184 / 0.3)",
                        backgroundColor: "rgb(30 41 59)",
                        color: "white",
                      }}
                      formatter={(value: number | undefined) => [value != null ? sar(value, i18n.language) : "", t("sales")]}
                      labelFormatter={(label) => label}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="rgb(16 185 129)"
                      strokeWidth={2.5}
                      fill="url(#predictiveGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                  {t("noForecastData")}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Next 7 Days sidebar */}
        <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/90">
          <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-2 dark:border-slate-700 dark:bg-slate-800/50">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {t("next7Days")}
            </h2>
          </div>
          <div className="max-h-[320px] overflow-y-auto p-4">
            {forecast?.next_7_days?.length ? (
              <div className="space-y-2">
                {forecast.next_7_days.map((d) => {
                  const highVol = isHighVolume(d, forecast.next_7_days, forecast.next_30_days ?? []);
                  return (
                    <div
                      key={d.date}
                      className="flex flex-col gap-0.5 rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-700"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-sm font-medium text-slate-700 dark:text-slate-200"
                          style={{ fontFeatureSettings: "tnum" }}
                        >
                          {format(parseISO(d.date), "EEE d MMM", { locale: isRTL ? ar : undefined })}
                        </span>
                        <span className="font-mono text-sm tabular-nums text-slate-600 dark:text-slate-300">
                          {sar(d.predicted_sales, i18n.language)}
                        </span>
                      </div>
                      {highVol && (
                        <span className="inline-flex w-fit items-center rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                          {t("actionNeeded")}: {t("prepExtraMilk")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                {t("noForecastData")}
              </div>
            )}
          </div>
        </section>
      </div>

      {branchId !== "" && (
        <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/90">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-2 dark:border-slate-700 dark:bg-slate-800/50">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {isRTL ? "ملخص التنبؤ الذكي للشراء (7 أيام)" : "Smart Purchase Snapshot (7 days)"}
            </h2>
            <Link
              to="/smart-purchase"
              className="text-xs font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
            >
              {isRTL ? "عرض كامل" : "Open full report"}
            </Link>
          </div>
          <div className="p-4">
            {purchaseLoading ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {isRTL ? "جاري تحميل اقتراحات الشراء..." : "Loading purchase suggestions..."}
              </div>
            ) : purchaseSuggestions.length === 0 ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {isRTL ? "لا توجد اقتراحات شراء حالياً لهذا الفرع" : "No purchase suggestions for this branch"}
              </div>
            ) : (
              <div className="space-y-2">
                {purchaseSuggestions.map((s) => (
                  <div
                    key={`${s.ingredient_id}-${s.serial_code}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-700"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                        {isRTL && s.ingredient_name_ar ? s.ingredient_name_ar : s.ingredient_name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {s.display_unit_source === "package"
                          ? (isRTL ? "الوحدة الافتراضية: عبوة" : "Default unit: Package")
                          : (isRTL ? "الوحدة الافتراضية: أساسية" : "Default unit: Base")}
                      </div>
                    </div>
                    <div className="text-right font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {s.suggested_purchase_qty} {s.unit_code}
                      {s.display_unit_source === "package" && s.suggested_purchase_base_qty && s.base_unit_code && (
                        <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
                          {isRTL ? "الأساس: " : "Base: "}
                          {s.suggested_purchase_base_qty} {s.base_unit_code}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
