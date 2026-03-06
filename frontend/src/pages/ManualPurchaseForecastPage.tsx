/**
 * التنبؤ اليدوي للمشتريات – Manual Purchase Forecast
 * يتيح للمستخدم إدخال المنتجات المتوقع بيعها يدوياً
 * ثم يعرض تقريراً بالمواد الخام اللازمة ومقترحات الشراء
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ClipboardList, Search, Plus, Trash2, Building2,
  AlertTriangle, CheckCircle2, ShoppingCart,
  Printer, FileDown, RefreshCw, X, Package2,
  ChevronUp, ChevronDown, ChevronsUpDown, XCircle,
  Loader2,
} from "lucide-react";
import {
  fetchBranches,
  searchFoodicsProducts,
  fetchManualPurchaseForecast,
} from "../lib/api";
import type {
  Branch,
  FoodicsProductItem,
  ManualForecastIngredient,
} from "../lib/api";

/* ─── helpers ────────────────────────────────────────────── */
const n = (v: string | number | undefined) =>
  v != null && v !== "" ? parseFloat(String(v)) : 0;

type Urgency = "urgent" | "low" | "ok";
function getUrgency(row: ManualForecastIngredient): Urgency {
  const sugg = n(row.suggested_purchase_qty);
  if (sugg <= 0) return "ok";
  const onHand = n(row.on_hand);
  const required = n(row.required_qty);
  if (required > 0 && onHand / required < 0.25) return "urgent";
  return "low";
}

type SortField = "name" | "required" | "on_hand" | "suggested";
type SortDir = "asc" | "desc";

interface ManualProduct {
  id: string;
  sku: string;
  name: string;
  qty: number;
}

/* ─── component ────────────────────────────────────────────── */
export default function ManualPurchaseForecastPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const T = (ar: string, en: string) => (isRTL ? ar : en);

  /* ── state ── */
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<number | "">("");

  // Product search
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<FoodicsProductItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Manual product list
  const [products, setProducts] = useState<ManualProduct[]>([]);

  // Forecast results
  const [ingredients, setIngredients] = useState<ManualForecastIngredient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Filters + sort
  const [filterText, setFilterText] = useState("");
  const [filterUrgency, setFilterUrgency] = useState<"all" | Urgency>("all");
  const [sortField, setSortField] = useState<SortField>("suggested");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  /* ── load branches ── */
  useEffect(() => {
    fetchBranches()
      .then((bs) => setBranches(Array.isArray(bs) ? bs : []))
      .catch(() => setBranches([]));
  }, []);

  /* ── product search debounce ── */
  useEffect(() => {
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await searchFoodicsProducts(searchQ);
        setSearchResults(results);
        setShowDropdown(results.length > 0);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQ]);

  /* ── close dropdown on outside click ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── add product from dropdown ── */
  const handleSelectProduct = useCallback((p: FoodicsProductItem) => {
    setProducts((prev) => {
      const existing = prev.find((x) => x.sku === p.sku);
      if (existing) {
        return prev.map((x) => x.sku === p.sku ? { ...x, qty: x.qty + 1 } : x);
      }
      return [...prev, { id: String(Date.now()), sku: p.sku, name: p.name, qty: 1 }];
    });
    setSearchQ("");
    setShowDropdown(false);
  }, []);

  const handleRemoveProduct = useCallback((id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleQtyChange = useCallback((id: string, qty: number) => {
    setProducts((prev) =>
      prev.map((p) => p.id === id ? { ...p, qty: Math.max(1, qty) } : p)
    );
  }, []);

  /* ── calculate forecast ── */
  const handleCalculate = useCallback(async () => {
    if (!branchId) { setError(T("اختر الفرع أولاً", "Please select a branch first")); return; }
    if (products.length === 0) { setError(T("أضف منتجاً واحداً على الأقل", "Add at least one product")); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchManualPurchaseForecast({
        branch_id: Number(branchId),
        products: products.map((p) => ({ sku: p.sku, qty: p.qty })),
      });
      setIngredients(result.ingredients);
      setHasLoaded(true);
    } catch (e: unknown) {
      setError((e as Error).message || T("فشل الحساب", "Calculation failed"));
    } finally {
      setLoading(false);
    }
  }, [branchId, products, T]);

  /* ── sort + filter ── */
  const processed = useMemo(() => {
    let rows = ingredients.map((r) => ({
      ...r,
      _urgency: getUrgency(r),
    }));

    if (filterText) {
      const q = filterText.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.ingredient_name.toLowerCase().includes(q) ||
          r.ingredient_name_ar.toLowerCase().includes(q) ||
          r.serial_code.toLowerCase().includes(q)
      );
    }
    if (filterUrgency !== "all") {
      rows = rows.filter((r) => r._urgency === filterUrgency);
    }

    rows.sort((a, b) => {
      let diff = 0;
      if (sortField === "name") diff = a.ingredient_name.localeCompare(b.ingredient_name);
      else if (sortField === "required") diff = n(a.required_qty) - n(b.required_qty);
      else if (sortField === "on_hand") diff = n(a.on_hand) - n(b.on_hand);
      else if (sortField === "suggested") diff = n(a.suggested_purchase_qty) - n(b.suggested_purchase_qty);
      return sortDir === "asc" ? diff : -diff;
    });

    return rows;
  }, [ingredients, filterText, filterUrgency, sortField, sortDir]);

  const stats = useMemo(() => ({
    urgent: processed.filter((r) => r._urgency === "urgent").length,
    low: processed.filter((r) => r._urgency === "low").length,
    ok: processed.filter((r) => r._urgency === "ok").length,
    total: processed.length,
  }), [processed]);

  /* ── sort header helper ── */
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 text-teal-400" />
      : <ChevronDown className="h-3 w-3 text-teal-400" />;
  };
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  /* ── urgency styling ── */
  const urgencyBadge = (u: Urgency) => {
    if (u === "urgent") return "bg-red-500/20 text-red-400 border border-red-500/30";
    if (u === "low") return "bg-amber-500/20 text-amber-400 border border-amber-500/30";
    return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
  };
  const urgencyLabel = (u: Urgency) => {
    if (u === "urgent") return T("عاجل", "Urgent");
    if (u === "low") return T("منخفض", "Low");
    return T("كافٍ", "OK");
  };

  /* ── print ── */
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = () => window.print();

  /* ── PDF ── */
  const handlePDF = async () => {
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { default: jsPDF } = await import("jspdf");
      const el = printRef.current;
      if (!el) return;
      const canvas = await html2canvas(el, { scale: 2, useCORS: true });
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, w, h);
      pdf.save(`manual-forecast-${Date.now()}.pdf`);
    } catch {
      window.print();
    }
  };

  /* ─────────────────────────────── render ────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#0e1117] text-white p-4 md:p-6" dir={isRTL ? "rtl" : "ltr"}>

      {/* ── Print stylesheet ── */}
      <style>{`
        @media print {
          body > *:not(#manual-forecast-print) { display: none !important; }
          #manual-forecast-print { display: block !important; }
          .no-print { display: none !important; }
          .print-table th, .print-table td { font-size: 11px; padding: 4px 6px; }
        }
      `}</style>

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 mb-6 no-print">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30">
            <ClipboardList className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              {T("إنشاء تنبؤ يدوي للمشتريات", "Manual Purchase Forecast")}
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {T(
                "أضف المنتجات المتوقع بيعها واحسب احتياجات المواد الخام",
                "Add expected sales products and calculate raw material needs"
              )}
            </p>
          </div>
        </div>

        {/* Action buttons (only shown when results exist) */}
        {hasLoaded && ingredients.length > 0 && (
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm transition-colors"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">{T("طباعة", "Print")}</span>
            </button>
            <button
              onClick={handlePDF}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm transition-colors"
            >
              <FileDown className="h-4 w-4" />
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Top Panel: Branch + Product Input ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 no-print">

        {/* Branch selector */}
        <div className="bg-[#161b27] border border-white/10 rounded-xl p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
            <Building2 className="h-4 w-4 text-indigo-400" />
            {T("اختر الفرع", "Select Branch")}
          </label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
            className="w-full bg-[#1e2533] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">{T("-- اختر الفرع --", "-- Select Branch --")}</option>
            {(Array.isArray(branches) ? branches : []).map((b) => (
              <option key={b.id} value={b.id}>
                {isRTL ? (b.name_ar || b.name) : (b.name || b.name_ar)}
              </option>
            ))}
          </select>
        </div>

        {/* Product search */}
        <div className="bg-[#161b27] border border-white/10 rounded-xl p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
            <Search className="h-4 w-4 text-indigo-400" />
            {T("ابحث عن منتج لإضافته", "Search & Add Products")}
          </label>
          <div className="relative" ref={searchRef}>
            <div className="relative">
              <input
                type="text"
                value={searchQ}
                onChange={(e) => { setSearchQ(e.target.value); setShowDropdown(true); }}
                onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
                placeholder={T("اسم المنتج أو الكود...", "Product name or SKU...")}
                className="w-full bg-[#1e2533] border border-white/10 rounded-lg px-3 py-2.5 ps-9 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
              {searchLoading
                ? <Loader2 className="absolute start-2.5 top-2.5 h-4 w-4 text-gray-400 animate-spin" />
                : <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-gray-500" />
              }
              {searchQ && (
                <button
                  onClick={() => { setSearchQ(""); setShowDropdown(false); }}
                  className="absolute end-2.5 top-2.5 text-gray-500 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {/* Dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-50 top-full mt-1 w-full bg-[#1e2533] border border-white/15 rounded-xl shadow-2xl max-h-56 overflow-y-auto">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    onMouseDown={() => handleSelectProduct(p)}
                    className="w-full text-start px-4 py-2.5 hover:bg-indigo-500/20 transition-colors text-sm border-b border-white/5 last:border-0"
                  >
                    <span className="font-medium text-white">{p.name}</span>
                    <span className="text-gray-500 text-xs ms-2">#{p.sku}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Products List ── */}
      {products.length > 0 && (
        <div className="bg-[#161b27] border border-white/10 rounded-xl p-4 mb-4 no-print">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Package2 className="h-4 w-4 text-indigo-400" />
              {T("المنتجات المضافة", "Added Products")}
              <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2 py-0.5 rounded-full border border-indigo-500/30">
                {products.length}
              </span>
            </h2>
            <button
              onClick={() => setProducts([])}
              className="text-xs text-gray-500 hover:text-red-400 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              {T("مسح الكل", "Clear All")}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {products.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 bg-[#1e2533] rounded-lg px-3 py-2 border border-white/5"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{p.name}</p>
                  <p className="text-xs text-gray-500">#{p.sku}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleQtyChange(p.id, p.qty - 1)}
                    className="w-6 h-6 flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-colors"
                  >−</button>
                  <input
                    type="number"
                    min={1}
                    value={p.qty}
                    onChange={(e) => handleQtyChange(p.id, Number(e.target.value))}
                    className="w-14 text-center bg-[#161b27] border border-white/10 rounded text-sm text-white py-0.5 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={() => handleQtyChange(p.id, p.qty + 1)}
                    className="w-6 h-6 flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-colors"
                  >+</button>
                  <button
                    onClick={() => handleRemoveProduct(p.id)}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Calculate button */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleCalculate}
              disabled={loading || !branchId}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm transition-colors shadow-lg shadow-indigo-500/20"
            >
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <ShoppingCart className="h-4 w-4" />
              }
              {loading
                ? T("جارٍ الحساب...", "Calculating...")
                : T("احسب احتياجات الشراء", "Calculate Purchase Needs")
              }
            </button>
          </div>
        </div>
      )}

      {/* Empty state – no products added yet */}
      {products.length === 0 && !hasLoaded && (
        <div className="bg-[#161b27] border border-dashed border-white/15 rounded-xl p-10 text-center mb-4 no-print">
          <ClipboardList className="h-10 w-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">
            {T("ابحث عن المنتجات وأضفها لحساب احتياجات الشراء", "Search and add products to calculate purchase needs")}
          </p>
          <p className="text-gray-600 text-sm mt-1">
            {T("استخدم خانة البحث أعلاه للبحث بالاسم أو الكود", "Use the search box above to find products by name or SKU")}
          </p>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm mb-4 flex items-center gap-2 no-print">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ms-auto hover:text-red-300">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Results ── */}
      {hasLoaded && (
        <div id="manual-forecast-print" ref={printRef}>

          {/* Stats bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 no-print">
            {[
              { label: T("إجمالي المواد", "Total Items"), value: stats.total, color: "blue", icon: <Package2 className="h-4 w-4" /> },
              { label: T("عاجل", "Urgent"), value: stats.urgent, color: "red", icon: <AlertTriangle className="h-4 w-4" /> },
              { label: T("منخفض", "Low Stock"), value: stats.low, color: "amber", icon: <ShoppingCart className="h-4 w-4" /> },
              { label: T("كافٍ", "Sufficient"), value: stats.ok, color: "green", icon: <CheckCircle2 className="h-4 w-4" /> },
            ].map(({ label, value, color, icon }) => (
              <div
                key={label}
                className={`bg-[#161b27] border rounded-xl p-3 flex items-center gap-3 border-${color}-500/20`}
              >
                <div className={`p-2 rounded-lg bg-${color}-500/20 text-${color}-400`}>{icon}</div>
                <div>
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className={`text-xl font-bold text-${color}-400`}>{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Filter bar */}
          {ingredients.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4 no-print">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder={T("بحث في المواد...", "Search ingredients...")}
                  className="w-full bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 ps-8 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <select
                value={filterUrgency}
                onChange={(e) => setFilterUrgency(e.target.value as typeof filterUrgency)}
                className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="all">{T("كل الأوضاع", "All Statuses")}</option>
                <option value="urgent">{T("عاجل فقط", "Urgent Only")}</option>
                <option value="low">{T("منخفض فقط", "Low Only")}</option>
                <option value="ok">{T("كافٍ فقط", "Sufficient Only")}</option>
              </select>
              <button
                onClick={() => { setFilterText(""); setFilterUrgency("all"); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#161b27] border border-white/10 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {T("إعادة ضبط", "Reset")}
              </button>
            </div>
          )}

          {ingredients.length === 0 ? (
            <div className="bg-[#161b27] border border-white/10 rounded-xl p-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
              <p className="text-gray-300 font-medium">
                {T("لا توجد مواد خام مطلوبة لهذه المنتجات", "No raw materials required for these products")}
              </p>
              <p className="text-gray-500 text-sm mt-1">
                {T("قد لا تكون الوصفات مرتبطة بهذه المنتجات", "Recipes may not be linked to these products")}
              </p>
            </div>
          ) : (
            <div className="bg-[#161b27] border border-white/10 rounded-xl overflow-hidden">
              {/* Print header */}
              <div className="hidden print:block p-4 border-b border-white/10">
                <h2 className="text-lg font-bold">{T("تقرير التنبؤ اليدوي للمشتريات", "Manual Purchase Forecast Report")}</h2>
                <p className="text-sm text-gray-400 mt-1">
                  {T("المنتجات المدخلة:", "Entered Products:")} {products.map((p) => `${p.name} ×${p.qty}`).join(", ")}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="print-table w-full" style={{ minWidth: "700px" }}>
                  <thead>
                    <tr className="bg-[#1e2533] text-xs text-gray-400 uppercase tracking-wide">
                      <th className="px-4 py-3 text-start">#</th>
                      <th
                        className="px-4 py-3 text-start cursor-pointer hover:text-white select-none"
                        onClick={() => toggleSort("name")}
                      >
                        <span className="flex items-center gap-1">
                          {T("المادة الخام", "Ingredient")}
                          <SortIcon field="name" />
                        </span>
                      </th>
                      <th className="px-4 py-3 text-center">
                        {T("الوضع", "Status")}
                      </th>
                      <th
                        className="px-4 py-3 text-center cursor-pointer hover:text-white select-none"
                        onClick={() => toggleSort("required")}
                      >
                        <span className="flex items-center justify-center gap-1">
                          {T("الكمية المطلوبة", "Required")}
                          <SortIcon field="required" />
                        </span>
                      </th>
                      <th
                        className="px-4 py-3 text-center cursor-pointer hover:text-white select-none"
                        onClick={() => toggleSort("on_hand")}
                      >
                        <span className="flex items-center justify-center gap-1">
                          {T("الرصيد الحالي", "On Hand")}
                          <SortIcon field="on_hand" />
                        </span>
                      </th>
                      <th
                        className="px-4 py-3 text-center cursor-pointer hover:text-white select-none"
                        onClick={() => toggleSort("suggested")}
                      >
                        <span className="flex items-center justify-center gap-1">
                          {T("اقتراح الشراء", "Purchase Suggestion")}
                          <SortIcon field="suggested" />
                        </span>
                      </th>
                      <th className="px-4 py-3 text-center">{T("الوحدة", "Unit")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processed.map((row, idx) => {
                      const sugg = n(row.suggested_purchase_qty);
                      return (
                        <tr
                          key={row.ingredient_id}
                          className={`border-t border-white/5 transition-colors hover:bg-white/5 ${
                            row._urgency === "urgent" ? "bg-red-500/5" :
                            row._urgency === "low" ? "bg-amber-500/5" : ""
                          }`}
                        >
                          <td className="px-4 py-3 text-xs text-gray-500">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-white text-sm">
                              {isRTL ? (row.ingredient_name_ar || row.ingredient_name) : row.ingredient_name}
                            </div>
                            {row.serial_code && (
                              <div className="text-xs text-gray-500 mt-0.5">{row.serial_code}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${urgencyBadge(row._urgency)}`}>
                              {urgencyLabel(row._urgency)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-sm font-semibold text-blue-400">
                                {row.required_qty}
                              </span>
                              <span className="text-xs text-gray-500">
                                {isRTL ? (row.unit_label_ar || row.unit_code) : (row.unit_label || row.unit_code)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`text-sm font-semibold ${
                                n(row.on_hand) === 0
                                  ? "text-red-400"
                                  : n(row.on_hand) < n(row.required_qty)
                                    ? "text-amber-400"
                                    : "text-emerald-400"
                              }`}>
                                {row.on_hand}
                              </span>
                              <span className="text-xs text-gray-500">
                                {isRTL ? (row.unit_label_ar || row.unit_code) : (row.unit_label || row.unit_code)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {sugg > 0 ? (
                              <div className="inline-flex flex-col items-center gap-0.5">
                                <span className="text-sm font-bold text-white bg-indigo-500/20 border border-indigo-500/30 px-3 py-1 rounded-lg">
                                  {row.suggested_purchase_qty}
                                </span>
                                <span className="text-xs font-medium text-indigo-300">
                                  {isRTL ? (row.unit_label_ar || row.unit_code) : (row.unit_label || row.unit_code)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-emerald-400 flex items-center justify-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {T("لا حاجة", "None")}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs bg-slate-700 text-gray-300 px-2 py-1 rounded">
                              {isRTL ? (row.unit_label_ar || row.unit_code) : (row.unit_label || row.unit_code)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#1e2533] border-t border-white/10 text-xs text-gray-400">
                      <td colSpan={2} className="px-4 py-3 font-semibold">
                        {T("الإجمالي", "Total")}:{" "}
                        <span className="text-white">{processed.length}</span>{" "}
                        {T("مادة", "items")}
                      </td>
                      <td />
                      <td className="px-4 py-3 text-center font-semibold text-blue-400">
                        {processed.reduce((s, r) => s + n(r.required_qty), 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-emerald-400">
                        {processed.reduce((s, r) => s + n(r.on_hand), 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-indigo-400">
                        {processed.reduce((s, r) => s + n(r.suggested_purchase_qty), 0).toFixed(2)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
