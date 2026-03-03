/** Prep List (PR1002) – Editable production list. Data: SP1003 (ProductSale), IU1002 (Unit). */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { useDateRange } from "../contexts/DateRangeContext";
import ReportDateFilter from "../components/ReportDateFilter";
import {
  fetchBranches,
  fetchPredictForDate,
  fetchProductsWithRecipes,
  fetchProductSalesForPrepList,
  calculateProductionPlan,
  type Branch,
  type ProductWithRecipe,
  type ProductionPlanIngredient,
  type ProductWithoutRecipe,
} from "../lib/api";
import {
  exportPrepListPDF,
  exportPrepListExcel,
  exportDailyPrepListPDF,
  prepItemsToExport,
  type ExportOption,
} from "../lib/prepListExport";

/** Display product: real catalog product or stub from ProductSale. Format: [Code] - [Name] | Qty */
type DisplayProduct = Pick<ProductWithRecipe, "id" | "name"> & {
  foodics_product_id?: string;
  product_sku?: string;
};
type PrepItem = { product: DisplayProduct; qty: number };
type ForecastMethod = "last_week" | "last_month";

export default function PrepListPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const userBranchId = user?.branch_id != null ? Number(user.branch_id) : null;
  const [selectedBranchId, setSelectedBranchId] = useState<number | "">("");
  const branchId = userBranchId ?? (selectedBranchId !== "" ? Number(selectedBranchId) : null);

  const { dateFrom, dateTo } = useDateRange();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [forecastMethod, setForecastMethod] = useState<ForecastMethod>("last_week");
  const [products, setProducts] = useState<ProductWithRecipe[]>([]);
  const [prepItems, setPrepItems] = useState<PrepItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<DisplayProduct | null>(null);
  const [aggregatedIngredients, setAggregatedIngredients] = useState<ProductionPlanIngredient[] | null>(null);
  const [productsWithoutRecipe, setProductsWithoutRecipe] = useState<ProductWithoutRecipe[]>([]);
  const [aggregatedLoading, setAggregatedLoading] = useState(false);
  const [aggregateRefreshKey, setAggregateRefreshKey] = useState(0);
  const [forecastSales, setForecastSales] = useState<number | null>(null);
  const [productsLoading, setProductsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQtyValue, setEditQtyValue] = useState("");
  const [exportPopup, setExportPopup] = useState<{ show: boolean; format: "pdf" | "excel" | null }>({ show: false, format: null });
  const [printListLoading, setPrintListLoading] = useState(false);
  const [noRecipeWarningExpanded, setNoRecipeWarningExpanded] = useState(false);

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const list = await fetchProductsWithRecipes(branchId ?? undefined);
      setProducts(Array.isArray(list) ? list : []);
    } catch {
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    let cancelled = false;
    fetchBranches(user?.brand_slug ?? undefined)
      .then((r) => {
        if (!cancelled) setBranches(Array.isArray(r) ? r : []);
      })
      .catch(() => {
        if (!cancelled) setBranches([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.brand_slug]);

  useEffect(() => {
    let cancelled = false;
    setProductsLoading(true);
    (async () => {
      try {
        const list = await fetchProductsWithRecipes(branchId ?? undefined);
        if (!cancelled) setProducts(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  useEffect(() => {
    let cancelled = false;
    if (branchId) {
      const from = dateFrom <= dateTo ? dateFrom : dateTo;
      fetchPredictForDate({ branchId, date: from })
        .then((r) => {
          if (!cancelled) setForecastSales(r?.predicted_sales ?? null);
        })
        .catch(() => {
          if (!cancelled) setForecastSales(null);
        });
    } else {
      if (!cancelled) setForecastSales(null);
    }
    return () => {
      cancelled = true;
    };
  }, [branchId, dateFrom, dateTo]);

  const [salesDataLoading, setSalesDataLoading] = useState(false);
  const [rawSalesProducts, setRawSalesProducts] = useState<Array<{ product_name: string; product_sku?: string; sales: number; qty?: number }>>([]);
  const [refDateRange, setRefDateRange] = useState<{ dateFrom: string; dateTo: string } | null>(null);
  const fetchRef = useRef(0);

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
  const loadFromSalesData = useCallback(async () => {
    const hasBranch = branchId != null;
    const hasBrand = user?.brand_slug != null;
    if (!hasBranch && !hasBrand) return;

    const reqId = ++fetchRef.current;
    setSalesDataLoading(true);
    setPrepItems([]);

    const from = dateFrom <= dateTo ? dateFrom : dateTo;
    const to = dateFrom <= dateTo ? dateTo : dateFrom;

    const refFrom = forecastMethod === "last_week" ? addDays(from, -7) : addMonths(from, -1);
    const refTo = forecastMethod === "last_week" ? addDays(to, -7) : addMonths(to, -1);

    const chartParams: {
      branch_ids?: number[];
      branch_id?: number | string;
      branch_code?: string;
      branch_name?: string;
      brands?: string[];
    } = {};
    const selBranch = branches.find((b) => b.id === branchId || Number(b.id) === branchId);
    const brandSlug = user?.brand_slug || selBranch?.brand?.slug;
    if (brandSlug) chartParams.brands = [brandSlug];

    if (typeof branchId === "number" && !Number.isNaN(branchId)) chartParams.branch_ids = [branchId];
    else if (branchId != null) chartParams.branch_id = branchId;
    if (selBranch?.branch_code) chartParams.branch_code = selBranch.branch_code;
    if (selBranch?.name_ar || selBranch?.name) chartParams.branch_name = selBranch.name_ar || selBranch.name;

    try {
      const chartRes = await fetchProductSalesForPrepList({
        ...chartParams,
        date_from: refFrom,
        date_to: refTo,
      });
      if (reqId !== fetchRef.current) return;

      const topProducts = chartRes.top_products || [];
      setRawSalesProducts(topProducts);
      setRefDateRange({ dateFrom: refFrom, dateTo: refTo });
    } catch {
      if (reqId !== fetchRef.current) return;
    } finally {
      if (reqId === fetchRef.current) setSalesDataLoading(false);
    }
  }, [branchId, dateFrom, dateTo, forecastMethod, user?.brand_slug, branches]);

  /* [Ref: 2026-02-13] NO auto-fetch: data is fetched ONLY when user clicks Search (بحث) */

  /* [Ref: 2026-02-13] Force render table. product_name fallback when sku missing. Format: [SKU] - [Name] | Qty */
  useEffect(() => {
    if (rawSalesProducts.length === 0) {
      setPrepItems([]);
      return;
    }
    const newItems: PrepItem[] = [];
    for (let i = 0; i < rawSalesProducts.length; i++) {
      const tp = rawSalesProducts[i];
      const rawQty = Math.max(0, Math.round(Number(tp.qty) ?? Number(tp.sales) ?? 0));
      const qtyDisplay = rawQty < 1 ? 1 : rawQty;
      const productName = (tp.product_name || "—").trim() || "—";
      const skuRaw = (tp.product_sku || "").trim();
      const displayName = skuRaw
        ? `${skuRaw} - ${productName} | ${t("prepPredictedQtyBasedOnHistory")}: ${qtyDisplay}`
        : `${productName} | ${t("prepPredictedQtyBasedOnHistory")}: ${qtyDisplay}`;
      const skuLower = skuRaw.toLowerCase();
      const match =
        products.find(
          (p) =>
            ((p.foodics_product_id || p.product_sku) || "").toLowerCase() === skuLower
        ) ??
        products.find(
          (p) =>
            p.name.trim().toLowerCase() === productName.toLowerCase() ||
            productName.toLowerCase().includes(p.name.toLowerCase())
        );
      const product: DisplayProduct = match
        ? { ...match, name: displayName, product_sku: skuRaw || match.foodics_product_id || match.product_sku }
        : { id: -(i + 1), name: displayName, product_sku: skuRaw || undefined };
      newItems.push({ product, qty: qtyDisplay });
    }
    setPrepItems(newItems);
  }, [rawSalesProducts, products, t]);

  const getProductSku = (p: DisplayProduct) =>
    (p.product_sku || (p as { foodics_product_id?: string }).foodics_product_id)?.trim() || "";

  const buildPlanItems = useCallback(
    (items: PrepItem[]) =>
      items
        .filter((i) => i.product.id > 0 || Boolean(getProductSku(i.product)))
        .map((i) =>
          i.product.id > 0
            ? { product_id: i.product.id, product_sku: getProductSku(i.product) || undefined, qty: i.qty }
            : { product_sku: getProductSku(i.product)!, qty: i.qty }
        ),
    []
  );

  const refetchAggregatedIngredients = useCallback(() => {
    setAggregateRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!branchId || prepItems.length === 0) {
      setAggregatedIngredients(null);
      setProductsWithoutRecipe([]);
      return;
    }
    const planItems = buildPlanItems(prepItems);
    if (planItems.length === 0) {
      setAggregatedIngredients(null);
      return;
    }
    setAggregatedLoading(true);
    calculateProductionPlan(branchId, planItems)
      .then((r) => {
        const data = r?.total_ingredients ?? r?.ingredients ?? [];
        setAggregatedIngredients(Array.isArray(data) ? data : []);
        setProductsWithoutRecipe(r?.products_without_recipe ?? []);
      })
      .catch(() => {
        setAggregatedIngredients([]);
        setProductsWithoutRecipe([]);
      })
      .finally(() => setAggregatedLoading(false));
  }, [branchId, prepItems, buildPlanItems, aggregateRefreshKey]);

  // Refetch when tab becomes visible (e.g. user updated ingredients in another tab)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible" && branchId && prepItems.length > 0) {
        setAggregateRefreshKey((k) => k + 1);
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [branchId, prepItems.length]);

  const handleProductSelect = useCallback((item: PrepItem) => {
    setSelectedProduct(item.product);
  }, []);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) &&
        !prepItems.some((i) => i.product.id === p.id)
    );
  }, [products, searchQuery, prepItems]);

  const addToPrepList = useCallback((p: ProductWithRecipe | DisplayProduct, qty = 1) => {
    setPrepItems((prev) => {
      const existing = prev.find((i) => i.product.id === p.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === p.id ? { ...i, qty: i.qty + qty } : i
        );
      }
      return [...prev, { product: p, qty }];
    });
    setSearchQuery("");
  }, []);

  const updatePrepQty = useCallback((productId: number, qty: number) => {
    setPrepItems((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, qty } : i))
    );
    setEditingId(null);
    setEditQtyValue("");
  }, []);

  const handleExport = useCallback(
    async (option: ExportOption, format: "pdf" | "excel") => {
      const itemsExport = prepItemsToExport(prepItems);
      const branchName = branches.find((b) => b.id === branchId || Number(b.id) === branchId)?.name_ar ||
        branches.find((b) => b.id === branchId || Number(b.id) === branchId)?.name || "—";
      const forecastPeriod = `${dateFrom} → ${dateTo}`;
      const createdAt = new Date().toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" });

      let ingredientsData: ProductionPlanIngredient[] | null = null;
      if ((option === "ingredients_only" || option === "full") && branchId) {
        const itemsToPlan = prepItems
          .filter((i) => i.product.id > 0 || Boolean(getProductSku(i.product)))
          .map((i) =>
            i.product.id > 0
              ? { product_id: i.product.id, qty: i.qty }
              : { product_sku: getProductSku(i.product)!, qty: i.qty }
          );
        if (itemsToPlan.length > 0) {
          try {
            const res = await calculateProductionPlan(branchId, itemsToPlan);
            ingredientsData = res?.ingredients ?? null;
          } catch {
            ingredientsData = [];
          }
        }
      }

      const meta = { branchName, forecastPeriod, createdAt };
      if (format === "pdf") {
        exportPrepListPDF(itemsExport, ingredientsData, option, meta);
      } else {
        exportPrepListExcel(itemsExport, ingredientsData, option, meta);
      }
      setExportPopup({ show: false, format: null });
    },
    [prepItems, branchId, branches, dateFrom, dateTo]
  );

  const handlePrintList = useCallback(async () => {
    const branchName =
      branches.find((b) => b.id === branchId || Number(b.id) === branchId)?.name_ar ||
      branches.find((b) => b.id === branchId || Number(b.id) === branchId)?.name ||
      "—";
    const createdAt = new Date().toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" });
    setPrintListLoading(true);
    try {
      await exportDailyPrepListPDF(aggregatedIngredients ?? null, { branchName, createdAt });
    } finally {
      setPrintListLoading(false);
    }
  }, [aggregatedIngredients, branchId, branches]);

  const removeFromPrepList = useCallback((productId: number) => {
    setPrepItems((prev) => prev.filter((i) => i.product.id !== productId));
    if (selectedProduct?.id === productId) {
      setSelectedProduct(null);
    }
  }, [selectedProduct?.id]);

  const startEdit = (item: PrepItem) => {
    setEditingId(item.product.id);
    setEditQtyValue(String(item.qty));
  };

  const commitEdit = (productId: number) => {
    const n = Math.max(0, parseInt(editQtyValue, 10));
    if (Number.isFinite(n)) {
      updatePrepQty(productId, n);
      if (n === 0) removeFromPrepList(productId);
    } else {
      setEditingId(null);
      setEditQtyValue("");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">{t("opsPrepList")}</h1>
        <p className="mt-1 text-sm text-white/60">{t("prepPrepListSub")}</p>
      </div>

      <div className="glass-card rounded-2xl p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {!userBranchId && (
            <label className="block">
              <span className="mb-1 block text-white/70">{t("selectBranch")}</span>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value ? Number(e.target.value) : "")}
                className="glass-input min-h-[44px] w-full rounded-xl px-4 py-3 text-white"
              >
                <option value="">{t("selectBranch")}</option>
                {(Array.isArray(branches) ? branches : []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-white/70">{t("date")}</span>
            <ReportDateFilter />
          </label>
          <label className="block">
            <span className="mb-1 block text-white/70">{t("forecastMethod")}</span>
            <select
              value={forecastMethod}
              onChange={(e) => setForecastMethod(e.target.value as ForecastMethod)}
              className="glass-input min-h-[44px] w-full rounded-xl px-4 py-3 text-white"
            >
              <option value="last_week">{t("forecastMethodLastWeek")}</option>
              <option value="last_month">{t("forecastMethodLastMonth")}</option>
            </select>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <button
              type="button"
              onClick={() => loadFromSalesData()}
              disabled={salesDataLoading || (branchId == null && !user?.brand_slug)}
              className="min-h-[44px] flex-1 rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {salesDataLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {t("prepSearching")}
                </span>
              ) : (
                t("prepSearch")
              )}
            </button>
            <button
              type="button"
              onClick={() => setExportPopup({ show: true, format: "pdf" })}
              disabled={prepItems.length === 0}
              className="min-h-[44px] rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("prepExportPDF")}
            </button>
            <button
              type="button"
              onClick={() => setExportPopup({ show: true, format: "excel" })}
              disabled={prepItems.length === 0}
              className="min-h-[44px] rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("prepExportExcel")}
            </button>
            <button
              type="button"
              onClick={handlePrintList}
              disabled={!aggregatedIngredients?.length || printListLoading}
              className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {printListLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
              )}
              {t("prepPrintList")}
            </button>
          </div>
          {forecastSales != null && (
            <div className="rounded-xl bg-white/5 px-4 py-3">
              <span className="text-sm text-white/70">{t("prepPredictedSales")}:</span>{" "}
              <span className="font-semibold text-white">
                {forecastSales.toLocaleString()} SAR
              </span>
            </div>
          )}
        </div>
        {salesDataLoading && (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <span className="text-sm text-white/60">{t("prepSearching")}</span>
          </div>
        )}
        {rawSalesProducts.length > 0 && refDateRange && (
          <p className="mt-2 text-xs text-white/50">
            {t("prepReferencePeriod")}: {refDateRange.dateFrom} → {refDateRange.dateTo}
          </p>
        )}
      </div>

      {exportPopup.show && exportPopup.format && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setExportPopup({ show: false, format: null })}
        >
          <div
            className="glass-card max-w-sm rounded-2xl p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-4 text-sm font-medium text-white">
              {exportPopup.format === "pdf" ? t("prepExportPDF") : t("prepExportExcel")}
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleExport("products_only", exportPopup.format!)}
                className="flex w-full items-center justify-center rounded-xl bg-white/10 px-4 py-3 text-sm text-white hover:bg-white/20"
              >
                {t("prepExportProductsOnly")}
              </button>
              <button
                type="button"
                onClick={() => handleExport("ingredients_only", exportPopup.format!)}
                className="flex w-full items-center justify-center rounded-xl bg-white/10 px-4 py-3 text-sm text-white hover:bg-white/20"
              >
                {t("prepExportIngredientsOnly")}
              </button>
              <button
                type="button"
                onClick={() => handleExport("full", exportPopup.format!)}
                className="flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-500"
              >
                {t("prepExportFull")}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setExportPopup({ show: false, format: null })}
              className="mt-4 w-full rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/10"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Search & Add Product */}
      <div className="glass-card rounded-2xl p-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-white">{t("prepSearchAddProduct")}</span>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("prepSearchAddProduct")}
              className="glass-input min-h-[44px] w-full rounded-xl px-4 py-3 pr-10 text-white placeholder:text-white/40"
            />
            {productsLoading && (
              <span className="absolute inset-y-0 end-3 flex items-center text-white/50">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              </span>
            )}
          </div>
        </label>
        {searchResults.length > 0 && (
          <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-white/5">
            {searchResults.slice(0, 20).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addToPrepList(p)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-white/90 hover:bg-white/10"
              >
                <span>{p.name}</span>
                <span className="text-emerald-400">+ {t("prepQuantity")}</span>
              </button>
            ))}
          </div>
        )}
        {products.length === 0 && !productsLoading && (
          <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-amber-500/10 p-4">
            <p className="text-sm text-amber-200">{t("opsEmptyMessage")}</p>
            <button
              type="button"
              onClick={loadProducts}
              className="min-h-[44px] shrink-0 rounded-xl bg-amber-600 px-4 py-3 text-sm font-medium text-white hover:bg-amber-700"
            >
              {t("prepRefreshProducts")}
            </button>
          </div>
        )}
      </div>

      <div className="glass-card rounded-2xl p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">{t("prepProductsSelectToSee")}</h2>
          <div className="flex gap-2">
            {products.length === 0 && !productsLoading ? null : (
              <button
                type="button"
                onClick={loadProducts}
                disabled={productsLoading}
                className="text-sm text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
              >
                {t("prepRefreshProducts")}
              </button>
            )}
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Editable Prep List */}
          <div>
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {prepItems.length === 0 ? (
                <p className="rounded-lg bg-white/5 p-4 text-sm text-white/50">
                  {t("prepEmptyListHint")}
                </p>
              ) : (
                prepItems.map((item) => (
                  <div
                    key={item.product.id}
                    className={`flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 ${
                      selectedProduct?.id === item.product.id
                        ? "bg-white/20"
                        : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleProductSelect(item)}
                      className="flex-1 truncate text-left text-sm text-white"
                    >
                      {item.product.name}
                    </button>
                    {editingId === item.product.id ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={editQtyValue}
                          onChange={(e) => setEditQtyValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit(item.product.id);
                            if (e.key === "Escape") {
                              setEditingId(null);
                              setEditQtyValue("");
                            }
                          }}
                          className="w-16 rounded border border-white/20 bg-white/10 px-2 py-1 text-sm text-white"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => commitEdit(item.product.id)}
                          className="rounded p-1.5 text-emerald-400 hover:bg-white/10"
                          aria-label={t("save")}
                        >
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="shrink-0 text-sm font-medium text-white/80">
                          {item.qty}×
                        </span>
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="rounded p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
                          aria-label={t("edit")}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromPrepList(item.product.id)}
                          className="rounded p-1.5 text-red-400 hover:bg-red-500/20"
                          aria-label={t("delete")}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          {/* Total Ingredient Requirements (aggregated across all products) */}
          <div>
            {productsWithoutRecipe.length > 0 && (
              <div className="mb-3 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setNoRecipeWarningExpanded((e) => !e)}
                  className="flex w-full items-center justify-between gap-2 text-start"
                >
                  <span className="text-xs font-medium text-amber-200">{t("prepProductsNoRecipe")}</span>
                  <span className="shrink-0 text-amber-200">
                    {noRecipeWarningExpanded ? (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </span>
                </button>
                {noRecipeWarningExpanded && (
                  <>
                    <ul className="mt-1 list-inside list-disc text-xs text-amber-200/90">
                      {productsWithoutRecipe.map((p, idx) => (
                        <li key={idx}>
                          {p.product_sku ? `${p.product_sku} - ` : ""}{p.product_name} × {p.qty}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1 text-xs text-amber-200/70">{t("prepProductsNoRecipeHint")}</p>
                  </>
                )}
              </div>
            )}
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs text-white/60">{t("prepTotalIngredientRequirements")}</p>
              {prepItems.length > 0 && (
                <button
                  type="button"
                  onClick={refetchAggregatedIngredients}
                  disabled={aggregatedLoading}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-white/10 disabled:opacity-50"
                >
                  {t("prepRefreshTotals")}
                </button>
              )}
            </div>
            {prepItems.length === 0 ? (
              <p className="rounded-lg bg-white/5 p-4 text-sm text-white/60">
                {t("prepEmptyListHint")}
              </p>
            ) : aggregatedLoading ? (
              <div className="flex items-center gap-3 rounded-lg bg-white/5 p-4">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                <span className="text-sm text-white/60">{t("prepSearching")}</span>
              </div>
            ) : aggregatedIngredients && aggregatedIngredients.length > 0 ? (
              <div className="max-h-80 overflow-y-auto" dir="rtl">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="p-2 text-end font-semibold text-white/90 w-10">
                        {t("prepColRowNum")}
                      </th>
                      <th className="p-2 text-end font-semibold text-white/90">
                        {t("prepColSystemCode")}
                      </th>
                      <th className="p-2 text-end font-semibold text-white/90">
                        {t("prepColItemName")}
                      </th>
                      <th className="p-2 text-end font-semibold text-white/90">
                        {t("prepColUnit")}
                      </th>
                      <th className="p-2 text-end font-semibold text-white/90">
                        {t("prepColTotalQty")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggregatedIngredients.map((i, rowIndex) => {
                      const itemName = i.ingredient_name_ar?.trim()
                        ? `${i.ingredient_name} | ${i.ingredient_name_ar}`
                        : i.ingredient_name;
                      const unitStr = i18n.language === "ar"
                        ? (i.workable_unit_ar ?? i.display_unit_label ?? i.unit_code)
                        : (i.workable_unit_en ?? i.display_unit_label ?? i.unit_code);
                      const primaryDisplay = i18n.language === "ar"
                        ? (i.primary_display_ar ?? i.workable_display_ar)
                        : (i.primary_display_en ?? i.workable_display_en);
                      const rawQty = parseFloat(i.workable_qty ?? i.display_qty ?? i.required_qty ?? "0") || 0;
                      const pkgQty = Math.ceil(rawQty).toString();
                      const exactTooltip = i.exact_required && i.exact_unit_label
                        ? `${i.exact_required} ${i.exact_unit_label}`
                        : null;
                      const qtyDisplay = primaryDisplay ?? pkgQty;
                      return (
                        <tr
                          key={i.ingredient_id}
                          className="border-b border-white/10 text-white hover:bg-white/5"
                        >
                          <td className="p-2 text-end text-white/70 w-10">{rowIndex + 1}</td>
                          <td className="p-2 text-end">{i.serial_code ?? "—"}</td>
                          <td className="p-2 text-end">{itemName}</td>
                          <td className="p-2 text-end">{unitStr}</td>
                          <td
                            className="p-2 text-end font-medium"
                            title={exactTooltip ?? undefined}
                          >
                            {qtyDisplay}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg bg-white/5 p-4">
                <p className="mb-3 text-sm text-white/60">{t("prepNoIngredientsForProduct")}</p>
                <button
                  type="button"
                  onClick={refetchAggregatedIngredients}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  {t("prepRefreshTotals")}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Daily Total Ingredients (aggregated across all forecasted products) */}
        {prepItems.length > 0 && (
          <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            {productsWithoutRecipe.length > 0 && (
              <div className="mb-3 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setNoRecipeWarningExpanded((e) => !e)}
                  className="flex w-full items-center justify-between gap-2 text-start"
                >
                  <span className="text-xs font-medium text-amber-200">{t("prepProductsNoRecipe")}</span>
                  <span className="shrink-0 text-amber-200">
                    {noRecipeWarningExpanded ? (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </span>
                </button>
                {noRecipeWarningExpanded && (
                  <>
                    <ul className="mt-1 list-inside list-disc text-xs text-amber-200/90">
                      {productsWithoutRecipe.map((p, idx) => (
                        <li key={idx}>
                          {p.product_sku ? `${p.product_sku} - ` : ""}{p.product_name} × {p.qty}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1 text-xs text-amber-200/70">{t("prepProductsNoRecipeHint")}</p>
                  </>
                )}
              </div>
            )}
            <h3 className="mb-3 text-sm font-semibold text-emerald-200">
              {t("prepDailyTotalIngredients")}
            </h3>
            {aggregatedLoading ? (
              <div className="flex items-center gap-3">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                <span className="text-sm text-white/60">{t("prepSearching")}</span>
              </div>
            ) : aggregatedIngredients && aggregatedIngredients.length > 0 ? (
              <div className="overflow-x-auto" dir="rtl">
                <table className="w-full min-w-[480px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="p-2 text-end font-semibold text-white/90 w-10">
                        {t("prepColRowNum")}
                      </th>
                      <th className="p-2 text-end font-semibold text-white/90">
                        {t("prepColSystemCode")}
                      </th>
                      <th className="p-2 text-end font-semibold text-white/90">
                        {t("prepColItemName")}
                      </th>
                      <th className="p-2 text-end font-semibold text-white/90">
                        {t("prepColUnit")}
                      </th>
                      <th className="p-2 text-end font-semibold text-white/90">
                        {t("prepColTotalQty")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggregatedIngredients.map((i, rowIndex) => {
                      const itemName = i.ingredient_name_ar?.trim()
                        ? `${i.ingredient_name} | ${i.ingredient_name_ar}`
                        : i.ingredient_name;
                      const unitStr = i18n.language === "ar"
                        ? (i.workable_unit_ar ?? i.display_unit_label ?? i.unit_code)
                        : (i.workable_unit_en ?? i.display_unit_label ?? i.unit_code);
                      const primaryDisplay = i18n.language === "ar"
                        ? (i.primary_display_ar ?? i.workable_display_ar)
                        : (i.primary_display_en ?? i.workable_display_en);
                      const rawQty = parseFloat(i.workable_qty ?? i.display_qty ?? i.required_qty ?? "0") || 0;
                      const pkgQty = Math.ceil(rawQty).toString();
                      const exactTooltip = i.exact_required && i.exact_unit_label
                        ? `${i.exact_required} ${i.exact_unit_label}`
                        : null;
                      const qtyDisplay = primaryDisplay ?? pkgQty;
                      return (
                        <tr
                          key={i.ingredient_id}
                          className="border-b border-white/10 text-white hover:bg-white/5"
                        >
                          <td className="p-2 text-end text-white/70 w-10">{rowIndex + 1}</td>
                          <td className="p-2 text-end">{i.serial_code ?? "—"}</td>
                          <td className="p-2 text-end">{itemName}</td>
                          <td className="p-2 text-end">{unitStr}</td>
                          <td
                            className="p-2 text-end font-medium"
                            title={exactTooltip ?? undefined}
                          >
                            {qtyDisplay}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-sm text-white/60">{t("prepNoIngredientsForProduct")}</p>
                <button
                  type="button"
                  onClick={refetchAggregatedIngredients}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  {t("prepRefreshTotals")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
