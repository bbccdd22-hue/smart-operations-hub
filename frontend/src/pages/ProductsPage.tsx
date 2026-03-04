/**
 * قائمة المنتجات + ملف المنتج (مع تحرير الوصفة والتكاليف)
 * Supports URL param: search (e.g. from Executive Dashboard category drill-down).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ShoppingBag, Search, X, BookOpen, CheckCircle2,
  Package2, Tag, Clock, BarChart3, Layers, AlertCircle,
  Printer, RefreshCw, SlidersHorizontal, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, DollarSign,
  Info, Edit2, Save, Trash2, Plus, Check, XCircle, Camera, Link2,
} from "lucide-react";
import {
  fetchProductsList, fetchProductDetail,
  addRecipeLine, updateRecipeLine, deleteRecipeLine, updateIngredientCost,
  fetchIngredients, fetchInventoryUnits,
} from "../lib/api";
import {
  getProductTheme, getCustomImages, saveCustomImage, deleteCustomImage,
} from "../lib/productThemes";
import type {
  ProductSummary, ProductDetail, ProductRecipeLine,
  ManageIngredient, InventoryUnit,
} from "../lib/api";

/* ─── types ────────────────────────────────────────────────────────────── */
interface EditLine {
  id: number;
  ingredient_id: number;
  ingredient_name: string;
  ingredient_name_ar: string;
  serial_code: string;
  qty: string;
  unit_code: string;
  unit_label: string;
  unit_label_ar: string;
  unit_cost: string;
  _deleted?: boolean;
  _dirty?: boolean;
  _cost_dirty?: boolean;
}

/* ─── helpers ─────────────────────────────────────────────────────────── */
const fmtPrice = (v: string | null) => {
  if (!v) return "—";
  const n = parseFloat(v);
  return isNaN(n) ? "—" : n.toFixed(2);
};
const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ar-EG", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch { return iso; }
};

/* ─── ProductThumbnail ─────────────────────────────────────────────── */
function ProductThumbnail({
  img,
  size = 40,
}: {
  img: { url: string; emoji: string; gradient: string };
  size?: number;
}) {
  const [err, setErr] = useState(false);
  return (
    <div
      className="relative flex-shrink-0 overflow-hidden rounded-xl"
      style={{ width: size, height: size }}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${img.gradient}`} />
      {img.url && !err && (
        <img
          src={img.url}
          alt=""
          onError={() => setErr(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <div className="absolute inset-0 flex items-center justify-center text-base select-none">
        {(!img.url || err) && img.emoji}
      </div>
    </div>
  );
}

/* ─── component ───────────────────────────────────────────────────────── */
export default function ProductsPage() {
  const { t: _t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isRTL = i18n.language === "ar";
  const T = useCallback((ar: string, en: string) => (isRTL ? ar : en), [isRTL]);

  /* list state */
  const [products, setProducts]         = useState<ProductSummary[]>([]);
  const [loadingList, setLoadingList]   = useState(false);
  const [listError, setListError]       = useState<string | null>(null);
  const [searchQ, setSearchQ]           = useState(() => searchParams.get("search") ?? "");
  const [debouncedQ, setDebouncedQ]     = useState(() => searchParams.get("search") ?? "");
  const [filterActive, setFilterActive] = useState<"all" | "true" | "false">("all");
  const [filterRecipe, setFilterRecipe] = useState<"all" | "yes" | "no">("all");
  const [sortField, setSortField]       = useState<"name" | "price" | "cost" | "recipe">("name");
  const [sortDir, setSortDir]           = useState<"asc" | "desc">("asc");
  const [showFilters, setShowFilters]   = useState(false);

  /* detail modal state */
  const [panelOpen, setPanelOpen]         = useState(false);
  const [selectedId, setSelectedId]       = useState<number | null>(null);
  const [detail, setDetail]               = useState<ProductDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError]     = useState<string | null>(null);

  /* ── edit mode state ── */
  const [editMode, setEditMode]           = useState(false);
  const [editLines, setEditLines]         = useState<EditLine[]>([]);
  const [saving, setSaving]               = useState(false);
  const [saveError, setSaveError]         = useState<string | null>(null);

  /* product image state */
  const [customImages, setCustomImages]   = useState<Record<number, string>>(() => getCustomImages());
  const [imgEditOpen, setImgEditOpen]     = useState(false);
  const [imgEditUrl, setImgEditUrl]       = useState("");
  const [imgEditId, setImgEditId]         = useState<number | null>(null);

  /* add-ingredient form state */
  const [addIngSearch, setAddIngSearch]   = useState("");
  const [addIngResults, setAddIngResults] = useState<ManageIngredient[]>([]);
  const [allIngredients, setAllIngredients] = useState<ManageIngredient[]>([]);
  const [allUnits, setAllUnits]           = useState<InventoryUnit[]>([]);
  const [addIngSelected, setAddIngSelected] = useState<ManageIngredient | null>(null);
  const [addIngQty, setAddIngQty]         = useState("");
  const [addIngUnit, setAddIngUnit]       = useState("");
  const [addIngLoading, setAddIngLoading] = useState(false);
  const ingSearchRef                      = useRef<HTMLInputElement>(null);

  /* debounce search */
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(searchQ), 350);
    return () => clearTimeout(timer);
  }, [searchQ]);

  /* Sync search from URL (e.g. drill-down from Executive Dashboard) */
  useEffect(() => {
    const q = searchParams.get("search") ?? "";
    setSearchQ(q);
    setDebouncedQ(q);
  }, [searchParams]);

  /* ingredient search filtering */
  useEffect(() => {
    if (!addIngSearch.trim()) { setAddIngResults([]); return; }
    const q = addIngSearch.toLowerCase();
    setAddIngResults(
      allIngredients
        .filter((i) =>
          i.name_ar.toLowerCase().includes(q) ||
          i.name_en.toLowerCase().includes(q) ||
          (i.serial_code || "").toLowerCase().includes(q)
        )
        .slice(0, 10)
    );
  }, [addIngSearch, allIngredients]);

  /* load products list */
  const loadProducts = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    const timeoutId = setTimeout(() => {
      setLoadingList(false);
      setListError("انتهت مهلة التحميل — اضغط 'إعادة المحاولة'");
    }, 8000);
    try {
      const res = await fetchProductsList({
        q: debouncedQ || undefined,
        active: filterActive !== "all" ? filterActive : undefined,
      });
      clearTimeout(timeoutId);
      setProducts(res.products);
    } catch (e: unknown) {
      clearTimeout(timeoutId);
      setListError((e as Error).message || "فشل تحميل المنتجات");
    } finally {
      clearTimeout(timeoutId);
      setLoadingList(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, filterActive]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  /* load product detail */
  const reloadDetail = useCallback((id: number) => {
    setLoadingDetail(true);
    setDetailError(null);
    setDetail(null);
    fetchProductDetail(id)
      .then((d) => { setDetail(d); })
      .catch((e: unknown) => { setDetailError((e as Error).message || "فشل التحميل"); })
      .finally(() => { setLoadingDetail(false); });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    reloadDetail(selectedId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const openPanel = (id: number) => {
    setSelectedId(id);
    setPanelOpen(true);
    setEditMode(false);
    setSaveError(null);
  };
  const closePanel = () => {
    setPanelOpen(false);
    setSelectedId(null);
    setEditMode(false);
    setSaveError(null);
  };

  /* close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closePanel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* enter edit mode — clone lines, load ingredients+units */
  const enterEditMode = useCallback(async () => {
    if (!detail?.recipe) return;
    setEditMode(true);
    setSaveError(null);
    setAddIngSearch("");
    setAddIngSelected(null);
    setAddIngQty("");
    setAddIngUnit("");

    const cloned: EditLine[] = detail.recipe.lines.map((l) => ({
      id: l.id,
      ingredient_id: l.ingredient_id,
      ingredient_name: l.ingredient_name,
      ingredient_name_ar: l.ingredient_name_ar,
      serial_code: l.serial_code,
      qty: l.qty,
      unit_code: l.unit_code,
      unit_label: l.unit_label,
      unit_label_ar: l.unit_label_ar,
      unit_cost: l.unit_cost ?? "",
    }));
    setEditLines(cloned);

    if (allIngredients.length === 0) {
      const [ings, units] = await Promise.all([fetchIngredients(), fetchInventoryUnits()]);
      setAllIngredients(ings);
      setAllUnits(units);
    }
  }, [detail, allIngredients.length]);

  /* cancel edit */
  const cancelEdit = () => {
    setEditMode(false);
    setSaveError(null);
    setAddIngSearch("");
    setAddIngSelected(null);
  };

  /* save all edits */
  const saveEdits = async () => {
    if (!selectedId) return;
    setSaving(true);
    setSaveError(null);
    try {
      for (const line of editLines) {
        if (line._deleted) {
          await deleteRecipeLine(selectedId, line.id);
        } else if (line._dirty) {
          await updateRecipeLine(selectedId, line.id, {
            qty: parseFloat(line.qty),
            unit_code: line.unit_code,
          });
        }
        if (!line._deleted && line._cost_dirty && line.unit_cost !== "") {
          await updateIngredientCost(
            line.ingredient_id,
            line.unit_cost === "" ? null : parseFloat(line.unit_cost)
          );
        }
      }
      setEditMode(false);
      reloadDetail(selectedId);
      loadProducts();
    } catch (e: unknown) {
      setSaveError((e as Error).message || "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  /* add new ingredient to recipe */
  const addNewLine = async () => {
    if (!selectedId || !addIngSelected || !addIngQty || !addIngUnit) return;
    setAddIngLoading(true);
    setSaveError(null);
    try {
      await addRecipeLine(selectedId, {
        ingredient_id: addIngSelected.id,
        qty: parseFloat(addIngQty),
        unit_code: addIngUnit,
      });
      setAddIngSelected(null);
      setAddIngSearch("");
      setAddIngQty("");
      setAddIngUnit("");
      reloadDetail(selectedId);
      // refresh editLines from new detail
      setEditMode(false);
    } catch (e: unknown) {
      setSaveError((e as Error).message || "فشل إضافة المكوّن");
    } finally {
      setAddIngLoading(false);
    }
  };

  /* mutate editLines helpers */
  const setLineQty = (id: number, v: string) =>
    setEditLines((prev) => prev.map((l) => l.id === id ? { ...l, qty: v, _dirty: true } : l));
  const setLineCost = (id: number, v: string) =>
    setEditLines((prev) => prev.map((l) => l.id === id ? { ...l, unit_cost: v, _cost_dirty: true } : l));
  const setLineUnit = (id: number, v: string) => {
    const unit = allUnits.find((u) => u.code === v);
    setEditLines((prev) => prev.map((l) =>
      l.id === id ? { ...l, unit_code: v, unit_label: unit?.name_en ?? v, unit_label_ar: unit?.name_ar ?? v, _dirty: true } : l
    ));
  };
  const markDeleted = (id: number) =>
    setEditLines((prev) => prev.map((l) => l.id === id ? { ...l, _deleted: true } : l));
  const unmarkDeleted = (id: number) =>
    setEditLines((prev) => prev.map((l) => l.id === id ? { ...l, _deleted: false } : l));

  /* ── image helpers ── */
  const openImgEdit = (productId: number) => {
    setImgEditId(productId);
    setImgEditUrl(customImages[productId] || "");
    setImgEditOpen(true);
  };
  const applyImgEdit = () => {
    if (imgEditId == null) return;
    saveCustomImage(imgEditId, imgEditUrl);
    setCustomImages(getCustomImages());
    setImgEditOpen(false);
    // notify POS page if open in same tab
    window.dispatchEvent(new Event("storage"));
  };
  const clearImg = (productId: number) => {
    deleteCustomImage(productId);
    setCustomImages(getCustomImages());
    window.dispatchEvent(new Event("storage"));
    setImgEditOpen(false);
  };
  const getProductImage = (p: { id: number; name: string }): { url: string; emoji: string; gradient: string } => {
    const theme = getProductTheme(p.name || "");
    return {
      url: customImages[p.id] || theme.imageUrl,
      emoji: theme.emoji,
      gradient: theme.gradientFallback,
    };
  };

  /* filtered + sorted list */
  const displayed = useMemo(() => {
    let rows = [...products];
    if (filterRecipe === "yes") rows = rows.filter((p) => p.has_recipe);
    if (filterRecipe === "no")  rows = rows.filter((p) => !p.has_recipe);
    rows.sort((a, b) => {
      let diff = 0;
      if (sortField === "name")   diff = a.name.localeCompare(b.name);
      if (sortField === "price")  diff = parseFloat(a.price_excl_tax || "0") - parseFloat(b.price_excl_tax || "0");
      if (sortField === "cost")   diff = parseFloat(a.total_cost || "0") - parseFloat(b.total_cost || "0");
      if (sortField === "recipe") diff = a.recipe_lines_count - b.recipe_lines_count;
      return sortDir === "asc" ? diff : -diff;
    });
    return rows;
  }, [products, filterRecipe, sortField, sortDir]);

  const stats = useMemo(() => ({
    total: products.length,
    active: products.filter((p) => p.is_active).length,
    withRecipe: products.filter((p) => p.has_recipe).length,
  }), [products]);

  const toggleSort = (field: "name" | "price" | "cost" | "recipe") => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };
  const SortIcon = ({ field }: { field: "name" | "price" | "cost" | "recipe" }) =>
    sortField !== field ? null
      : sortDir === "asc" ? <ChevronUp className="h-3 w-3 inline ms-0.5" />
      : <ChevronDown className="h-3 w-3 inline ms-0.5" />;

  /* active lines for rendering (non-deleted) */
  const activeLines = editLines.filter((l) => !l._deleted);
  const deletedLines = editLines.filter((l) => l._deleted);

  /* ─── render ─────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#0e1117] text-white" dir={isRTL ? "rtl" : "ltr"}>
      <style>{`@media print { .no-print{display:none!important} }`}</style>

      {/* ── Page Header ── */}
      <div className="sticky top-0 z-10 bg-[#0e1117] border-b border-white/10 px-4 md:px-6 py-4 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/20 border border-violet-500/30">
              <ShoppingBag className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{T("قائمة المنتجات", "Products")}</h1>
              <p className="text-xs text-gray-400">{T("المنتجات المباعة + وصفاتها", "Sold items with their recipes")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs bg-violet-500/20 text-violet-400 border border-violet-500/30 px-2.5 py-1 rounded-full">
              {stats.total} {T("منتج", "products")}
            </span>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full">
              {stats.active} {T("نشط", "active")}
            </span>
            <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-full">
              {stats.withRecipe} {T("لها وصفة", "with recipe")}
            </span>
          </div>
        </div>

        {/* Search + controls */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder={T("ابحث باسم المنتج أو الكود...", "Search by name or SKU...")}
              className="w-full bg-[#161b27] border border-white/10 rounded-lg py-2 px-3 ps-8 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
            />
            {searchQ && (
              <button onClick={() => setSearchQ("")} className="absolute end-2 top-2 text-gray-500 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
              showFilters
                ? "bg-violet-500/20 border-violet-500/40 text-violet-400"
                : "bg-[#161b27] border-white/10 text-gray-400 hover:text-white"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {T("تصفية", "Filter")}
          </button>

          <button
            onClick={loadProducts}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#161b27] border border-white/10 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loadingList ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{T("تحديث", "Refresh")}</span>
          </button>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="mt-2 bg-[#161b27] border border-white/10 rounded-xl p-3 flex flex-wrap gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1.5">{T("الحالة", "Status")}</p>
              <div className="flex gap-1.5">
                {(["all", "true", "false"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setFilterActive(v)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      filterActive === v
                        ? "bg-violet-500/20 border-violet-500/40 text-violet-400"
                        : "border-white/10 text-gray-400 hover:text-white"
                    }`}
                  >
                    {v === "all" ? T("الكل", "All") : v === "true" ? T("نشط", "Active") : T("متوقف", "Inactive")}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1.5">{T("الوصفة", "Recipe")}</p>
              <div className="flex gap-1.5">
                {(["all", "yes", "no"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setFilterRecipe(v)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      filterRecipe === v
                        ? "bg-blue-500/20 border-blue-500/40 text-blue-400"
                        : "border-white/10 text-gray-400 hover:text-white"
                    }`}
                  >
                    {v === "all" ? T("الكل", "All") : v === "yes" ? T("لها وصفة", "Has recipe") : T("بدون وصفة", "No recipe")}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1.5">{T("ترتيب", "Sort")}</p>
              <div className="flex gap-1.5">
                {([
                  { v: "name", ar: "الاسم", en: "Name" },
                  { v: "price", ar: "قيمة بيع", en: "Sell Price" },
                  { v: "cost", ar: "قيمة تكلفة", en: "Cost" },
                  { v: "recipe", ar: "المكونات", en: "Recipe" },
                ] as const).map(({ v, ar, en }) => (
                  <button
                    key={v}
                    onClick={() => toggleSort(v)}
                    className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1 transition-colors ${
                      sortField === v
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                        : "border-white/10 text-gray-400 hover:text-white"
                    }`}
                  >
                    {T(ar, en)} <SortIcon field={v} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Products Table ── */}
      <div className="px-4 md:px-6 py-4">
        {loadingList ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 animate-spin text-violet-400" />
            <span className="ms-3 text-gray-400">{T("جارٍ التحميل...", "Loading...")}</span>
          </div>
        ) : listError ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
              <p className="text-red-400 mb-4">{listError}</p>
              <button
                onClick={() => { setListError(null); loadProducts(); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors mx-auto"
              >
                <RefreshCw className="h-4 w-4" />
                {T("إعادة المحاولة", "Retry")}
              </button>
            </div>
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <ShoppingBag className="h-10 w-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">
                {searchQ ? T("لا توجد نتائج", "No results found") : T("لا توجد منتجات", "No products")}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-[#161b27] border border-white/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: "560px" }}>
                <thead>
                    <tr className="bg-[#1e2533] text-xs text-gray-400 uppercase tracking-wide">
                      <th className="px-4 py-3 text-start w-8">#</th>
                      <th className="px-2 py-3 w-12">{T("صورة", "")}</th>
                      <th className="px-4 py-3 text-start cursor-pointer hover:text-white select-none" onClick={() => toggleSort("name")}>
                        {T("اسم المنتج", "Product Name")} <SortIcon field="name" />
                      </th>
                      <th className="px-4 py-3 text-center">{T("الكود", "SKU")}</th>
                      <th className="px-4 py-3 text-center cursor-pointer hover:text-white select-none" onClick={() => toggleSort("price")}>
                        {T("قيمة بيع", "Selling Price")} <SortIcon field="price" />
                      </th>
                      <th className="px-4 py-3 text-center cursor-pointer hover:text-white select-none" onClick={() => toggleSort("cost")}>
                        {T("قيمة تكلفة", "Cost")} <SortIcon field="cost" />
                      </th>
                      <th className="px-4 py-3 text-center">{T("الحالة", "Status")}</th>
                      <th className="px-4 py-3 text-center cursor-pointer hover:text-white select-none" onClick={() => toggleSort("recipe")}>
                        {T("الوصفة", "Recipe")} <SortIcon field="recipe" />
                      </th>
                      <th className="px-4 py-3 text-center w-20">{T("ملف", "File")}</th>
                    </tr>
                </thead>
                <tbody>
                  {displayed.map((p, idx) => (
                    <tr
                      key={p.id}
                      className={`border-t border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${
                        selectedId === p.id ? "bg-violet-500/10" : ""
                      }`}
                      onClick={() => openPanel(p.id)}
                    >
                      <td className="px-4 py-3 text-xs text-gray-600">{idx + 1}</td>
                      <td className="px-2 py-2">
                        <ProductThumbnail img={getProductImage(p)} size={40} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-white">{p.name}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-mono text-xs bg-[#1e2533] text-gray-400 px-2 py-0.5 rounded">{p.sku}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-white font-semibold">{fmtPrice(p.price_excl_tax)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.total_cost ? (
                          <span className="text-orange-400 font-semibold">{fmtPrice(p.total_cost)}</span>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                          p.is_active
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : "bg-gray-500/15 text-gray-500 border-gray-500/30"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${p.is_active ? "bg-emerald-400" : "bg-gray-500"}`} />
                          {p.is_active ? T("نشط", "Active") : T("متوقف", "Inactive")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.has_recipe ? (
                          <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                            {p.recipe_lines_count} {T("مكون", "items")}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => { e.stopPropagation(); openPanel(p.id); }}>
                        <button className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 px-2 py-1 rounded-lg hover:bg-violet-500/15 transition-colors border border-violet-500/20">
                          {T("عرض", "View")}
                          {isRTL
                            ? <ChevronLeft className="h-3 w-3" />
                            : <ChevronRight className="h-3 w-3" />
                          }
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t border-white/5 text-xs text-gray-500 flex items-center justify-between">
              <span>{T("عرض", "Showing")} {displayed.length} {T("من", "of")} {products.length} {T("منتج", "products")}</span>
              {(filterRecipe !== "all" || filterActive !== "all" || searchQ) && (
                <button
                  onClick={() => { setFilterRecipe("all"); setFilterActive("all"); setSearchQ(""); }}
                  className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                >
                  <X className="h-3 w-3" />
                  {T("مسح الفلاتر", "Clear filters")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          CENTERED MODAL — ملف المنتج
      ══════════════════════════════════════════════════════ */}
      {/* ══ IMAGE EDIT MODAL ══ */}
      {imgEditOpen && imgEditId != null && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] no-print"
            onClick={() => setImgEditOpen(false)}
          />
          <div className="fixed inset-0 z-[61] flex items-center justify-center p-4 no-print">
            <div
              className="relative w-full max-w-md bg-[#111827] border border-white/15 rounded-2xl shadow-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-violet-400" />
                  <h3 className="font-bold text-white">{T("تغيير صورة المنتج", "Change Product Image")}</h3>
                </div>
                <button
                  onClick={() => setImgEditOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Preview */}
              {(() => {
                const previewImg = imgEditUrl.trim() || getProductTheme(
                  products.find(p => p.id === imgEditId)?.name || ""
                ).imageUrl;
                return previewImg ? (
                  <div className="relative w-full rounded-xl overflow-hidden mb-4" style={{ height: 140 }}>
                    <img
                      src={previewImg}
                      alt="preview"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0"; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <span className="absolute bottom-2 start-3 text-xs text-white/60">{T("معاينة", "Preview")}</span>
                  </div>
                ) : null;
              })()}

              {/* URL input */}
              <label className="block text-xs text-gray-400 mb-1.5 flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                {T("رابط الصورة (URL)", "Image URL")}
              </label>
              <input
                type="url"
                value={imgEditUrl}
                onChange={(e) => setImgEditUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full bg-[#1e2533] border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 mb-4"
              />

              <p className="text-xs text-gray-500 mb-4 flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-400" />
                {T(
                  "الصورة محفوظة في المتصفح فقط. الصور تُعرض تلقائياً بناءً على اسم المنتج — أدخل رابطاً مخصصاً لتغييرها.",
                  "Image is saved locally in your browser. Images are auto-assigned by product name — enter a custom URL to override."
                )}
              </p>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => { if (imgEditId) clearImg(imgEditId); }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 text-sm font-medium transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  {T("حذف الصورة المخصصة", "Reset to Auto")}
                </button>
                <button
                  onClick={applyImgEdit}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
                >
                  <Save className="h-4 w-4" />
                  {T("حفظ", "Save")}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {panelOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-40 no-print"
            onClick={() => !editMode && closePanel()}
          />

          {/* Modal */}
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print"
            onClick={(e) => { if (e.target === e.currentTarget && !editMode) closePanel(); }}
          >
            <div
              className="relative w-full max-w-2xl max-h-[92vh] bg-[#111827] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-violet-500/20 border border-violet-500/30">
                    <ShoppingBag className="h-5 w-5 text-violet-400" />
                  </div>
                  <div>
                    {detail ? (
                      <>
                        <h2 className="font-bold text-white text-base">{detail.name}</h2>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">#{detail.sku}</p>
                      </>
                    ) : (
                      <h2 className="font-bold text-white">{T("ملف المنتج", "Product File")}</h2>
                    )}
                  </div>
                </div>
                {!editMode && (
                  <button
                    onClick={closePanel}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5">
                {loadingDetail ? (
                  <div className="flex items-center justify-center py-20">
                    <RefreshCw className="h-6 w-6 animate-spin text-violet-400" />
                  </div>
                ) : detailError ? (
                  <div className="text-center py-16">
                    <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                    <p className="text-red-400 text-sm">{detailError}</p>
                  </div>
                ) : detail ? (
                  <div id="product-detail-print" className="space-y-5">

                    {/* ── Product Hero Image ── */}
                    {(() => {
                      const img = getProductImage({ id: detail.id, name: detail.name });
                      return (
                        <div className="relative w-full rounded-xl overflow-hidden" style={{ height: 180 }}>
                          {/* Background */}
                          {img.url ? (
                            <img
                              src={img.url}
                              alt={detail.name}
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : null}
                          <div className={`absolute inset-0 bg-gradient-to-br ${img.gradient} ${img.url ? "opacity-40" : "opacity-100"}`} />
                          {/* Dark scrim bottom */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                          {/* Emoji badge */}
                          <div className="absolute top-3 end-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-black/40 text-2xl backdrop-blur-sm">
                            {img.emoji}
                          </div>

                          {/* Product name on image */}
                          <div className="absolute bottom-3 start-4 end-16">
                            <p className="text-white font-bold text-base leading-tight drop-shadow-lg line-clamp-2">
                              {detail.name}
                            </p>
                            {detail.sku && (
                              <p className="text-white/60 text-xs font-mono mt-0.5">#{detail.sku}</p>
                            )}
                          </div>

                          {/* Edit image button */}
                          <button
                            onClick={() => openImgEdit(detail.id)}
                            className="absolute bottom-3 end-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/50 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/70 transition-colors text-xs border border-white/20"
                            title={T("تغيير الصورة", "Change image")}
                          >
                            <Camera className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })()}

                    {/* Info cards */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#1e2533] rounded-xl p-3 border border-white/10">
                        <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                          <Tag className="h-3 w-3" /> {T("السعر", "Price")}
                        </p>
                        <p className="text-xl font-bold text-white">{fmtPrice(detail.price_excl_tax)}</p>
                        {detail.price_excl_tax && (
                          <p className="text-xs text-gray-500 mt-0.5">{T("بدون ضريبة", "excl. tax")}</p>
                        )}
                      </div>

                      <div className="bg-[#1e2533] rounded-xl p-3 border border-white/10">
                        <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> {T("الحالة", "Status")}
                        </p>
                        <div className={`flex items-center gap-1.5 mt-1 ${detail.is_active ? "text-emerald-400" : "text-gray-500"}`}>
                          <span className={`w-2.5 h-2.5 rounded-full ${detail.is_active ? "bg-emerald-400" : "bg-gray-600"}`} />
                          <span className="text-sm font-semibold">
                            {detail.is_active ? T("نشط", "Active") : T("متوقف", "Inactive")}
                          </span>
                        </div>
                      </div>

                      <div className="bg-[#1e2533] rounded-xl p-3 border border-white/10">
                        <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                          <Package2 className="h-3 w-3" /> {T("وحدة البيع", "Sales Unit")}
                        </p>
                        <p className="text-sm font-semibold text-white mt-1">{detail.sales_unit || "—"}</p>
                      </div>

                      <div className="bg-[#1e2533] rounded-xl p-3 border border-white/10">
                        <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                          <BookOpen className="h-3 w-3" /> {T("الوصفة", "Recipe")}
                        </p>
                        {detail.recipe ? (
                          <div className="flex items-center gap-1 mt-1 text-blue-400">
                            <Layers className="h-3.5 w-3.5" />
                            <span className="text-sm font-semibold">
                              {detail.recipe.lines_count} {T("مكون", "ingredients")}
                            </span>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 mt-1">{T("لا توجد وصفة", "No recipe")}</p>
                        )}
                      </div>
                    </div>

                    {/* Timestamps */}
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {T("أُضيف:", "Added:")} {fmtDate(detail.created_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {T("آخر تحديث:", "Updated:")} {fmtDate(detail.updated_at)}
                      </span>
                    </div>

                    {/* Cost Summary Cards */}
                    {!editMode && detail.recipe?.has_cost_data && (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-[#1e2533] border border-orange-500/20 rounded-xl p-3 text-center">
                          <p className="text-xs text-gray-400 flex items-center justify-center gap-1 mb-1">
                            <DollarSign className="h-3 w-3 text-orange-400" />
                            {T("تكلفة الإنتاج", "Cost")}
                          </p>
                          <p className="text-base font-bold text-orange-400">
                            {parseFloat(detail.recipe.total_cost ?? "0").toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-600">{T("ريال", "SAR")}</p>
                        </div>

                        {detail.recipe.profit_amount && detail.price_excl_tax && (
                          <div className={`bg-[#1e2533] rounded-xl p-3 text-center border ${
                            parseFloat(detail.recipe.profit_amount) >= 0
                              ? "border-emerald-500/20" : "border-red-500/20"
                          }`}>
                            <p className="text-xs text-gray-400 flex items-center justify-center gap-1 mb-1">
                              {parseFloat(detail.recipe.profit_amount) >= 0
                                ? <TrendingUp className="h-3 w-3 text-emerald-400" />
                                : <TrendingDown className="h-3 w-3 text-red-400" />}
                              {T("الربح", "Profit")}
                            </p>
                            <p className={`text-base font-bold ${parseFloat(detail.recipe.profit_amount) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {parseFloat(detail.recipe.profit_amount).toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-600">{T("ريال", "SAR")}</p>
                          </div>
                        )}

                        {detail.recipe.profit_margin && detail.price_excl_tax && (
                          <div className={`bg-[#1e2533] rounded-xl p-3 text-center border ${
                            parseFloat(detail.recipe.profit_margin) >= 50 ? "border-emerald-500/20"
                              : parseFloat(detail.recipe.profit_margin) >= 25 ? "border-amber-500/20"
                              : "border-red-500/20"
                          }`}>
                            <p className="text-xs text-gray-400 flex items-center justify-center gap-1 mb-1">
                              <BarChart3 className="h-3 w-3 text-blue-400" />
                              {T("هامش الربح", "Margin")}
                            </p>
                            <p className={`text-base font-bold ${
                              parseFloat(detail.recipe.profit_margin) >= 50 ? "text-emerald-400"
                                : parseFloat(detail.recipe.profit_margin) >= 25 ? "text-amber-400"
                                : "text-red-400"
                            }`}>
                              {parseFloat(detail.recipe.profit_margin).toFixed(1)}%
                            </p>
                            <p className="text-xs text-gray-600">{T("من السعر", "of price")}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* No cost notice */}
                    {!editMode && detail.recipe && !detail.recipe.has_cost_data && (
                      <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5 text-xs text-amber-400">
                        <Info className="h-3.5 w-3.5 flex-shrink-0" />
                        {T(
                          "لا تتوفر تكاليف الأصناف — يمكنك تعديل تكلفة الوحدة من زر 'تعديل الوصفة'",
                          "No ingredient costs set — use 'Edit Recipe' to add unit costs"
                        )}
                      </div>
                    )}

                    {/* Save error */}
                    {saveError && (
                      <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-xs text-red-400">
                        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                        {saveError}
                      </div>
                    )}

                    {/* ══ RECIPE SECTION ══ */}
                    {detail.recipe ? (
                      <div className="bg-[#1e2533] border border-white/10 rounded-xl overflow-hidden">

                        {/* Recipe header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-blue-400" />
                            <h3 className="font-semibold text-sm">{T("وصفة المنتج", "Product Recipe")}</h3>
                            <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                              {editMode ? activeLines.length : detail.recipe.lines_count} {T("مكون", "ingredients")}
                            </span>
                            {editMode && (
                              <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Edit2 className="h-3 w-3" /> {T("وضع التعديل", "Edit Mode")}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <BarChart3 className="h-3.5 w-3.5" />
                            {T("الناتج:", "Yield:")}
                            <span className="text-white font-semibold ms-1">
                              {detail.recipe.yield_qty} {detail.recipe.yield_unit}
                            </span>
                          </div>
                        </div>

                        {/* ── VIEW MODE table ── */}
                        {!editMode && (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-[#161b27] text-xs text-gray-500 uppercase">
                                <th className="px-4 py-2 text-start">#</th>
                                <th className="px-4 py-2 text-start">{T("المادة الخام", "Ingredient")}</th>
                                <th className="px-4 py-2 text-center">{T("الكمية", "Qty")}</th>
                                <th className="px-4 py-2 text-center">{T("الوحدة", "Unit")}</th>
                                {detail.recipe.has_cost_data && (
                                  <th className="px-4 py-2 text-center">{T("التكلفة", "Cost")}</th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {detail.recipe.lines.map((line: ProductRecipeLine, idx: number) => (
                                <tr key={line.id} className="border-t border-white/5 hover:bg-white/5">
                                  <td className="px-4 py-2.5 text-xs text-gray-600">{idx + 1}</td>
                                  <td className="px-4 py-2.5">
                                    <div className="font-medium text-white text-sm">
                                      {isRTL ? (line.ingredient_name_ar || line.ingredient_name) : line.ingredient_name}
                                    </div>
                                    {line.serial_code && <div className="text-xs text-gray-500">{line.serial_code}</div>}
                                  </td>
                                  <td className="px-4 py-2.5 text-center font-semibold text-white">{line.qty}</td>
                                  <td className="px-4 py-2.5 text-center">
                                    <span className="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded border border-violet-500/30">
                                      {isRTL ? (line.unit_label_ar || line.unit_label || line.unit_code) : (line.unit_label || line.unit_code)}
                                    </span>
                                  </td>
                                  {detail.recipe!.has_cost_data && (
                                    <td className="px-4 py-2.5 text-center text-xs">
                                      {line.line_cost
                                        ? <span className="text-orange-400 font-semibold">{parseFloat(line.line_cost).toFixed(3)}</span>
                                        : <span className="text-gray-600">—</span>}
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                            {detail.recipe.has_cost_data && (
                              <tfoot>
                                <tr className="bg-[#161b27] border-t border-white/10 text-xs font-semibold">
                                  <td colSpan={4} className="px-4 py-2.5 text-gray-400 text-end">
                                    {T("إجمالي تكلفة الإنتاج:", "Total production cost:")}
                                  </td>
                                  <td className="px-4 py-2.5 text-center text-orange-400">
                                    {parseFloat(detail.recipe.total_cost ?? "0").toFixed(3)}
                                  </td>
                                </tr>
                              </tfoot>
                            )}
                          </table>
                        )}

                        {/* ── EDIT MODE table ── */}
                        {editMode && (
                          <div>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-[#161b27] text-xs text-gray-500 uppercase">
                                  <th className="px-3 py-2 text-start">{T("الصنف", "Ingredient")}</th>
                                  <th className="px-3 py-2 text-center w-24">{T("الكمية", "Qty")}</th>
                                  <th className="px-3 py-2 text-center w-24">{T("الوحدة", "Unit")}</th>
                                  <th className="px-3 py-2 text-center w-24">{T("تكلفة/وحدة", "Cost/Unit")}</th>
                                  <th className="px-3 py-2 text-center w-16">{T("حذف", "Del")}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {activeLines.map((line) => (
                                  <tr key={line.id} className="border-t border-white/5 hover:bg-white/5">
                                    <td className="px-3 py-2">
                                      <div className="font-medium text-white text-sm">
                                        {isRTL ? (line.ingredient_name_ar || line.ingredient_name) : line.ingredient_name}
                                      </div>
                                      {line.serial_code && <div className="text-xs text-gray-500">{line.serial_code}</div>}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={line.qty}
                                        onChange={(e) => setLineQty(line.id, e.target.value)}
                                        className="w-20 bg-[#0e1117] border border-white/20 rounded-lg px-2 py-1 text-sm text-white text-center focus:outline-none focus:border-violet-500"
                                      />
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      {allUnits.length > 0 ? (
                                        <select
                                          value={line.unit_code}
                                          onChange={(e) => setLineUnit(line.id, e.target.value)}
                                          className="bg-[#0e1117] border border-white/20 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-violet-500"
                                        >
                                          {allUnits.map((u) => (
                                            <option key={u.code} value={u.code}>
                                              {isRTL ? (u.name_ar || u.name_en) : u.name_en}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <span className="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded border border-violet-500/30">
                                          {isRTL ? (line.unit_label_ar || line.unit_label || line.unit_code) : (line.unit_label || line.unit_code)}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        placeholder="—"
                                        value={line.unit_cost}
                                        onChange={(e) => setLineCost(line.id, e.target.value)}
                                        className="w-20 bg-[#0e1117] border border-white/20 rounded-lg px-2 py-1 text-sm text-white text-center focus:outline-none focus:border-amber-500"
                                        title={T("تكلفة وحدة الصنف (تحديثها يؤثر على جميع المنتجات)", "Ingredient unit cost (affects all products)")}
                                      />
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <button
                                        onClick={() => markDeleted(line.id)}
                                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                                        title={T("حذف", "Delete")}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            {/* Deleted lines preview */}
                            {deletedLines.length > 0 && (
                              <div className="px-3 py-2 border-t border-white/5">
                                <p className="text-xs text-gray-500 mb-1.5">{T("محذوف (قابل للاستعادة):", "Marked for deletion:")}</p>
                                {deletedLines.map((line) => (
                                  <div key={line.id} className="flex items-center justify-between py-1 opacity-50">
                                    <span className="text-xs text-red-400 line-through">
                                      {isRTL ? (line.ingredient_name_ar || line.ingredient_name) : line.ingredient_name}
                                    </span>
                                    <button
                                      onClick={() => unmarkDeleted(line.id)}
                                      className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                                    >
                                      <XCircle className="h-3 w-3" />
                                      {T("استعادة", "Restore")}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Cost notice */}
                            <div className="px-3 py-2 border-t border-white/5">
                              <p className="text-xs text-amber-400/70 flex items-center gap-1">
                                <Info className="h-3 w-3 flex-shrink-0" />
                                {T(
                                  "تعديل تكلفة الوحدة سيؤثر على هذا الصنف في جميع المنتجات الأخرى أيضاً",
                                  "Editing unit cost will affect this ingredient across all products"
                                )}
                              </p>
                            </div>

                            {/* ── Add ingredient form ── */}
                            <div className="border-t border-dashed border-white/15 px-3 py-3 bg-[#161b27]/50">
                              <p className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1">
                                <Plus className="h-3.5 w-3.5 text-emerald-400" />
                                {T("إضافة صنف جديد للوصفة", "Add New Ingredient")}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {/* Ingredient search */}
                                <div className="relative flex-1 min-w-[180px]">
                                  <input
                                    ref={ingSearchRef}
                                    type="text"
                                    value={addIngSearch}
                                    onChange={(e) => {
                                      setAddIngSearch(e.target.value);
                                      setAddIngSelected(null);
                                    }}
                                    placeholder={T("ابحث عن صنف...", "Search ingredient...")}
                                    className="w-full bg-[#0e1117] border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                                  />
                                  {addIngSelected && (
                                    <span className="absolute end-2 top-1.5">
                                      <Check className="h-4 w-4 text-emerald-400" />
                                    </span>
                                  )}
                                  {addIngResults.length > 0 && !addIngSelected && (
                                    <div className="absolute top-full mt-1 w-full bg-[#1e2533] border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden max-h-48 overflow-y-auto">
                                      {addIngResults.map((ing) => (
                                        <button
                                          key={ing.id}
                                          className="w-full text-start px-3 py-2 hover:bg-white/5 transition-colors"
                                          onClick={() => {
                                            setAddIngSelected(ing);
                                            setAddIngSearch(isRTL ? (ing.name_ar || ing.name_en) : ing.name_en);
                                            setAddIngUnit(ing.base_unit_code || "");
                                            setAddIngResults([]);
                                          }}
                                        >
                                          <div className="text-sm text-white">
                                            {isRTL ? (ing.name_ar || ing.name_en) : ing.name_en}
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            {ing.serial_code} · {isRTL ? (ing.base_unit_name_ar || ing.base_unit_code) : ing.base_unit_code}
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Qty */}
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={addIngQty}
                                  onChange={(e) => setAddIngQty(e.target.value)}
                                  placeholder={T("الكمية", "Qty")}
                                  className="w-24 bg-[#0e1117] border border-white/20 rounded-lg px-2 py-1.5 text-sm text-white text-center placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                                />

                                {/* Unit */}
                                {allUnits.length > 0 && (
                                  <select
                                    value={addIngUnit}
                                    onChange={(e) => setAddIngUnit(e.target.value)}
                                    className="bg-[#0e1117] border border-white/20 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                                  >
                                    <option value="">{T("الوحدة", "Unit")}</option>
                                    {allUnits.map((u) => (
                                      <option key={u.code} value={u.code}>
                                        {isRTL ? (u.name_ar || u.name_en) : u.name_en}
                                      </option>
                                    ))}
                                  </select>
                                )}

                                {/* Add button */}
                                <button
                                  onClick={addNewLine}
                                  disabled={!addIngSelected || !addIngQty || !addIngUnit || addIngLoading}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                                >
                                  {addIngLoading
                                    ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                    : <Plus className="h-3.5 w-3.5" />
                                  }
                                  {T("إضافة", "Add")}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* No recipe — show add-ingredient option in edit mode too */
                      <div className="bg-[#1e2533] border border-dashed border-white/15 rounded-xl p-8 text-center">
                        <BookOpen className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                        <p className="text-gray-400 font-medium">{T("لا توجد وصفة لهذا المنتج", "No recipe for this product")}</p>
                        <p className="text-gray-600 text-sm mt-1">
                          {T("يمكنك البدء بإضافة المكونات عبر زر 'تعديل الوصفة'", "Use 'Edit Recipe' button below to start adding ingredients")}
                        </p>
                      </div>
                    )}

                  </div>
                ) : null}
              </div>

              {/* Footer */}
              {detail && (
                <div className="flex-shrink-0 px-5 py-3 border-t border-white/10 flex justify-between items-center gap-3">
                  {!editMode ? (
                    <>
                      <button
                        onClick={() => window.print()}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1e2533] border border-white/10 text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        <Printer className="h-4 w-4" />
                        {T("طباعة ملف المنتج", "Print Product File")}
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={enterEditMode}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-sm font-medium text-white transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                          {T("تعديل الوصفة", "Edit Recipe")}
                        </button>
                        <button
                          onClick={closePanel}
                          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium transition-colors"
                        >
                          {T("إغلاق", "Close")}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={cancelEdit}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1e2533] border border-white/10 text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        <X className="h-4 w-4" />
                        {T("إلغاء", "Cancel")}
                      </button>
                      <button
                        onClick={saveEdits}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 text-sm font-semibold text-white transition-colors"
                      >
                        {saving
                          ? <RefreshCw className="h-4 w-4 animate-spin" />
                          : <Save className="h-4 w-4" />
                        }
                        {saving ? T("جارٍ الحفظ...", "Saving...") : T("حفظ التعديلات", "Save Changes")}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
