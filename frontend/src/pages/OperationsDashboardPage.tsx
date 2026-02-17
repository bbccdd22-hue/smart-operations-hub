/**
 * Operations Mode Dashboard [Ref: 2026-02-13].
 * Mobile-first: 44px touch targets, optimized for ZeroTier. Localized (EN/AR).
 * Sales Forecast: date range, Compare to Last Month/Week, no-data message + Upload Report.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import {
  fetchForecast,
  fetchProductsWithRecipes,
  fetchDashboardChartDataWithFallback,
  calculateProductionPlan,
  lookupSystemCash,
  submitShiftClosing,
  type ForecastDay,
  type ProductWithRecipe,
  type ProductionPlanIngredient,
} from "../lib/api";

function num(v: string) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function addDays(s: string, days: number): string {
  const d = new Date(s + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonths(s: string, months: number): string {
  const d = new Date(s + "T12:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

type ForecastMethod = "last_month" | "last_week";

export default function OperationsDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  // Align with Main Dashboard: use branch_ids when numeric, branch_id for branch_code (e.g. A01)
  const branchIdRaw = user?.branch_id;
  const branchId =
    branchIdRaw != null
      ? (typeof branchIdRaw === "number" ? branchIdRaw : Number(branchIdRaw))
      : null;
  const branchIdParam = branchId != null && !Number.isNaN(branchId) ? branchId : (branchIdRaw ?? null);
  const branchIdsForChart = branchId != null && !Number.isNaN(branchId) ? [branchId] : undefined;

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [forecastMethod, setForecastMethod] = useState<ForecastMethod>("last_week");
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [cash, setCash] = useState<number>(0);
  const [network, setNetwork] = useState<number>(0);
  const [apps, setApps] = useState<number>(0);
  const [products, setProducts] = useState<ProductWithRecipe[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithRecipe | null>(null);
  const [ingredients, setIngredients] = useState<ProductionPlanIngredient[] | null>(null);
  const [selectedPeriodSales, setSelectedPeriodSales] = useState<number | null>(null);
  const [comparisonPeriodSales, setComparisonPeriodSales] = useState<number | null>(null);
  const [comparisonProducts, setComparisonProducts] = useState<Array<{ product_name: string; qty: number }>>([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setDataLoading(true);

    const load = async () => {
      try {
        const [forecastRes, productsRes] = await Promise.all([
          branchId ? fetchForecast(branchId) : Promise.resolve({ next_7_days: [] as ForecastDay[] }),
          fetchProductsWithRecipes(branchId ?? undefined),
        ]);
        if (mounted) {
          setForecast(forecastRes?.next_7_days || []);
          setProducts(Array.isArray(productsRes) ? productsRes : []);
        }
      } catch {
        if (mounted) {
          setForecast([]);
          setProducts([]);
        }
      } finally {
        if (mounted) setDataLoading(false);
        }
    };
    load();
    return () => { mounted = false; };
  }, [branchId]);

  // Re-fetch immediately when forecast method (طريقة التوقع) changes. Uses ProductSale only—no AI.
  useEffect(() => {
    if (!branchIdParam) {
      setSelectedPeriodSales(null);
      setComparisonPeriodSales(null);
      setComparisonProducts([]);
      return;
    }
    const from = dateFrom <= dateTo ? dateFrom : dateTo;
    const to = dateFrom <= dateTo ? dateTo : dateFrom;
    setForecastLoading(true);
    setComparisonProducts([]);
    const compFrom = forecastMethod === "last_week" ? addDays(from, -7) : addMonths(from, -1);
    const compTo = forecastMethod === "last_week" ? addDays(to, -7) : addMonths(to, -1);
    let mounted = true;

    const chartParams = branchIdsForChart
      ? { branch_ids: branchIdsForChart, brands: user?.brand_slug ? [user.brand_slug] : undefined }
      : { branch_id: branchIdParam };

    Promise.all([
      fetchDashboardChartDataWithFallback({
        ...chartParams,
        date_from: from,
        date_to: to,
        include_all_products: true,
      }),
      fetchDashboardChartDataWithFallback({
        ...chartParams,
        date_from: compFrom,
        date_to: compTo,
        include_all_products: true,
      }),
    ])
      .then(([sel, comp]) => {
        if (!mounted) return;
        const selTotal = (sel.daily_series || []).reduce((a, d) => a + (d.sales || 0), 0);
        const compTotal = (comp.daily_series || []).reduce((a, d) => a + (d.sales || 0), 0);
        setSelectedPeriodSales(selTotal);
        setComparisonPeriodSales(compTotal);
        const rawProducts =
          (comp.top_products && comp.top_products.length > 0 ? comp.top_products : null) ??
          (sel.top_products && sel.top_products.length > 0 ? sel.top_products : []);
        const compProducts = (Array.isArray(rawProducts) ? rawProducts : [])
          .filter((p) => (p.product_name?.trim?.() || "").length > 0)
          .map((p) => ({
            product_name: p.product_name || "—",
            qty: Math.max(1, Math.round(Number(p.qty) ?? Number(p.sales) ?? 1)),
          }));
        setComparisonProducts(compProducts);
        console.log("Comparison Data Found:", compProducts, "raw:", rawProducts);
      })
      .catch(() => {
        if (mounted) {
          setSelectedPeriodSales(null);
          setComparisonPeriodSales(null);
          setComparisonProducts([]);
        }
      })
      .finally(() => {
        if (mounted) setForecastLoading(false);
      });
    return () => { mounted = false; };
  }, [branchIdParam, dateFrom, dateTo, forecastMethod]);

  useEffect(() => {
    if (!branchId || !dateFrom) {
      setCash(0);
      return;
    }
    lookupSystemCash(branchId, dateFrom)
      .then(setCash)
      .catch(() => setCash(0));
  }, [branchId, dateFrom]);

  const handleProductSelect = useCallback(
    async (p: ProductWithRecipe) => {
      setSelectedProduct(p);
      if (!branchId) return;
      try {
        const res = await calculateProductionPlan(branchId, [{ product_id: p.id, qty: 1 }]);
        setIngredients(res.ingredients);
      } catch {
        setIngredients([]);
      }
    },
    [branchId]
  );

  const handleSubmitShift = async () => {
    if (!branchId) return;
    const deliveryTotal = apps;
    const systemTotal = (Number(cash) || 0) + (Number(network) || 0) + deliveryTotal;
    setSubmitting(true);
    try {
      await submitShiftClosing({
        branch_id: branchId,
        date: dateFrom,
        shift_type: "morning",
        notes: "",
        submit: true,
        bills_500: 0,
        bills_200: 0,
        bills_100: 0,
        bills_50: 0,
        bills_20: 0,
        bills_10: 0,
        bills_5: 0,
        bills_1: 0,
        mada: 0,
        visa: 0,
        master_card: 0,
        hungerstation: Number(apps) || 0,
        jahez: 0,
        lugmety: 0,
        the_chefz: 0,
        toyou: 0,
        expenses_vouchers: 0,
        staff_drinks: 0,
        opening_petty_cash: 0,
        system_cash: Number(cash) || 0,
        system_network: Number(network) || 0,
        system_delivery: deliveryTotal,
        system_total_sales: systemTotal,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const hasData = forecast.length > 0 || products.length > 0 || selectedPeriodSales != null || comparisonPeriodSales != null;
  const showEmptyState = !dataLoading && !hasData;

  const forecastHasNoData =
    !forecastLoading &&
    branchIdParam &&
    selectedPeriodSales === 0 &&
    comparisonPeriodSales === 0;
  const forecastHasData = selectedPeriodSales != null && comparisonPeriodSales != null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">{t("opsDashboard")}</h1>
        <p className="mt-1 text-sm text-white/60">{t("opsDashboardSub")}</p>
      </div>

      {!branchIdParam && (
        <div className="glass-card rounded-2xl border-amber-500/30 bg-amber-500/10 p-6">
          <p className="text-amber-200">{t("opsNoBranch")}</p>
        </div>
      )}

      {dataLoading && (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-2xl bg-white/5 py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-sm text-white/60">{t("loading")}</p>
        </div>
      )}

      {showEmptyState && branchIdParam && (
        <div className="glass-card rounded-2xl p-8 text-center">
          <p className="text-white/70">{t("opsEmptyMessage")}</p>
          <p className="mt-2 text-sm text-white/50">{t("opsEmptyHint")}</p>
        </div>
      )}

      {/* Shift Closure Card */}
      <section className="glass-card rounded-2xl p-4">
        <h2 className="mb-4 text-sm font-semibold text-white">{t("opsShiftClosure")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block text-sm">
            <span className="mb-1 block text-white/70">{t("opsDate")}</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="glass-input min-h-[44px] w-full rounded-xl px-4 py-3 text-white"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-white/70">{t("opsCash")}</span>
            <input
              type="number"
              inputMode="decimal"
              value={cash || ""}
              onChange={(e) => setCash(num(e.target.value))}
              className="glass-input min-h-[44px] w-full rounded-xl px-4 py-3 text-white"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-white/70">{t("opsNetwork")}</span>
            <input
              type="number"
              inputMode="decimal"
              value={network || ""}
              onChange={(e) => setNetwork(num(e.target.value))}
              className="glass-input min-h-[44px] w-full rounded-xl px-4 py-3 text-white"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-white/70">{t("opsApps")}</span>
            <input
              type="number"
              inputMode="decimal"
              value={apps || ""}
              onChange={(e) => setApps(num(e.target.value))}
              className="glass-input min-h-[44px] w-full rounded-xl px-4 py-3 text-white"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleSubmitShift}
              disabled={submitting}
              className="min-h-[44px] w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? t("opsSaving") : t("opsSubmit")}
            </button>
          </div>
        </div>
      </section>

      {/* Sales Forecasting – Date Range + Compare to Last Month/Week */}
      <section className="glass-card rounded-2xl p-4">
        <h2 className="mb-4 text-sm font-semibold text-white">{t("opsSalesForecast")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm text-white/70">{t("forecastDateRangeStart")}</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="glass-input min-h-[44px] w-full rounded-xl px-4 py-3 text-white"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-white/70">{t("forecastDateRangeEnd")}</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="glass-input min-h-[44px] w-full rounded-xl px-4 py-3 text-white"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-white/70">{t("forecastMethod")}</span>
            <select
              value={forecastMethod}
              onChange={(e) => setForecastMethod(e.target.value as ForecastMethod)}
              className="glass-input min-h-[44px] w-full rounded-xl px-4 py-3 text-white"
            >
              <option value="last_week">{t("forecastMethodLastWeek")}</option>
              <option value="last_month">{t("forecastMethodLastMonth")}</option>
            </select>
          </label>
        </div>
        {forecastLoading && (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <span className="text-sm text-white/60">{t("loading")}</span>
          </div>
        )}
        {forecastHasNoData && !forecastLoading && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-amber-200">{t("forecastNoProductSalesForPeriod")}</p>
            <Link
              to="/upload-center"
              className="min-h-[44px] shrink-0 rounded-xl bg-amber-600 px-4 py-3 text-center text-sm font-medium text-white hover:bg-amber-700"
            >
              {t("forecastUploadReport")}
            </Link>
          </div>
        )}
        {forecastHasData && !forecastLoading && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-white/5 p-4">
              <p className="text-xs text-white/60">{t("forecastSelectedPeriodSales")}</p>
              <div className="mt-1 text-2xl font-bold text-white">
                {(selectedPeriodSales ?? 0).toLocaleString()} SAR
              </div>
            </div>
            <div className="rounded-xl bg-white/5 p-4">
              <p className="text-xs text-white/60">{t("forecastComparisonPeriodSales")}</p>
              <div className="mt-1 text-2xl font-bold text-white">
                {(comparisonPeriodSales ?? 0).toLocaleString()} SAR
              </div>
            </div>
          </div>
        )}
        {forecast.length > 0 && (
          <div className="mt-4 space-y-2">
            {forecast.slice(0, 5).map((d) => (
              <div
                key={d.date}
                className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"
              >
                <span className="text-white/80">{d.date}</span>
                <span className="font-medium text-white">{d.predicted_sales?.toLocaleString() ?? "—"} SAR</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Prep List – Date range, Forecast method, Predicted sales + Products & Ingredients */}
      <section className="glass-card rounded-2xl p-4">
        <h2 className="mb-4 text-sm font-semibold text-white">{t("opsPrepListTitle")}</h2>
        <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm text-white/70">{t("forecastDateRangeStart")}</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="glass-input min-h-[44px] w-full rounded-xl px-4 py-3 text-white"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-white/70">{t("forecastDateRangeEnd")}</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="glass-input min-h-[44px] w-full rounded-xl px-4 py-3 text-white"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-white/70">{t("forecastMethod")}</span>
            <select
              value={forecastMethod}
              onChange={(e) => setForecastMethod(e.target.value as ForecastMethod)}
              className="glass-input min-h-[44px] w-full rounded-xl px-4 py-3 text-white"
            >
              <option value="last_week">{t("forecastMethodLastWeek")}</option>
              <option value="last_month">{t("forecastMethodLastMonth")}</option>
            </select>
          </label>
        </div>
        {forecastLoading && (
          <div className="mb-4 flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <span className="text-sm text-white/60">{t("loading")}</span>
          </div>
        )}
        {forecastHasNoData && !forecastLoading && branchIdParam && (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-amber-200">{t("forecastNoProductSalesForPeriod")}</p>
            <Link
              to="/upload-center"
              className="min-h-[44px] shrink-0 rounded-xl bg-amber-600 px-4 py-3 text-center text-sm font-medium text-white hover:bg-amber-700"
            >
              {t("forecastUploadReport")}
            </Link>
          </div>
        )}
        {forecastHasData && !forecastLoading && (
          <div className="mb-4 rounded-xl bg-white/5 p-4">
            <p className="text-xs text-white/60">{t("prepPredictedSales")}</p>
            <div className="mt-1 text-2xl font-bold text-white">
              {(selectedPeriodSales ?? 0).toLocaleString()} SAR
            </div>
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs text-white/60">{t("opsSelectProductHint")}</p>
            {comparisonProducts.length > 0 ? (
              <div className="max-h-64 overflow-y-auto rounded-lg border border-white/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="px-3 py-2 text-start font-medium text-white/80">{t("name")}</th>
                      <th className="px-3 py-2 text-end font-medium text-white/80">{t("prepPredictedQty")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonProducts.map((item, idx) => {
                      const catalogMatch = products.find(
                        (p) =>
                          p.name.trim().toLowerCase() === (item.product_name || "").trim().toLowerCase() ||
                          (item.product_name || "").toLowerCase().includes(p.name.toLowerCase())
                      );
                      return (
                        <tr
                          key={`${item.product_name}-${idx}`}
                          className={`border-b border-white/5 ${
                            catalogMatch && selectedProduct?.id === catalogMatch.id ? "bg-white/20" : "hover:bg-white/5"
                          }`}
                        >
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => catalogMatch && handleProductSelect(catalogMatch)}
                              className={`min-h-[44px] w-full text-start ${
                                catalogMatch ? "cursor-pointer text-white hover:underline" : "cursor-default text-white/60"
                              }`}
                            >
                              {item.product_name}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-end tabular-nums text-white">{item.qty}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProductSelect(p)}
                    className={`min-h-[44px] w-full rounded-lg px-4 py-3 text-start text-sm transition ${
                      selectedProduct?.id === p.id
                        ? "bg-white/20 text-white"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs text-white/60">{t("opsIngredientExplosion")}</p>
            {selectedProduct ? (
              ingredients && ingredients.length > 0 ? (
                <div className="space-y-2">
                  {ingredients.map((i) => {
                    const unitLabel = i.display_unit_label ?? i.display_unit_code;
                    const qtyNum = i.display_qty != null ? parseFloat(i.display_qty) : NaN;
                    const label =
                      unitLabel && Number.isFinite(qtyNum) && qtyNum >= 2
                        ? (unitLabel || "").replace(/\bBottle\b/, "Bottles")
                        : unitLabel;
                    const amountDisplay =
                      i.display_qty != null && label
                        ? `${i.display_qty} ${label}`
                        : `${i.required_qty} ${i.unit_code}`;
                    const namePart =
                      i.ingredient_name_ar?.trim()
                        ? `${i.ingredient_name} | ${i.ingredient_name_ar}`
                        : i.ingredient_name;
                    const rmCode = i.serial_code?.trim() || "";
                    const rowLabel = rmCode ? `${rmCode} - ${namePart} : ${amountDisplay}` : `${namePart} : ${amountDisplay}`;
                    return (
                      <div
                        key={i.ingredient_id}
                        className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white"
                      >
                        <span className="font-medium">{rowLabel}</span>
                        <span className="ml-2 text-white/70">
                          · {t("opsOnHand")}: {i.on_hand}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-lg bg-white/5 p-4 text-sm text-white/60">{t("opsNoIngredients")}</p>
              )
            ) : (
              <p className="rounded-lg bg-white/5 p-4 text-sm text-white/60">{t("opsSelectProduct")}</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
