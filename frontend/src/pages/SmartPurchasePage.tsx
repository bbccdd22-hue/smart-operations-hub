/**
 * التنبؤ الذكي للشراء – اقتراح كميات الشراء بناءً على استهلاك الكاشير
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  Download,
  Printer,
  Filter,
  Package2,
  ArrowUpDown,
  ShoppingCart,
  AlertTriangle,
} from "lucide-react";
import { fetchPurchaseSuggestions, fetchBranches } from "../lib/api";
import type { Branch, PurchaseSuggestion } from "../lib/api";

type SortKey = "name" | "required" | "onHand" | "purchase";
type SortDir = "asc" | "desc";
type UnitFilter = "all" | "base" | "package";

export default function SmartPurchasePage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<number | "">("");
  const [horizonDays, setHorizonDays] = useState(7);
  const [suggestions, setSuggestions] = useState<PurchaseSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [unitFilter, setUnitFilter] = useState<UnitFilter>("all");
  const [hideZero, setHideZero] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchBranches()
      .then((b) => setBranches(b))
      .catch(() => setBranches([]));
  }, []);

  const load = useCallback(async () => {
    if (branchId === "") return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPurchaseSuggestions({
        branch_id: branchId as number,
        horizon_days: horizonDays,
        lookback_days: 90,
      });
      setSuggestions(res.suggestions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [branchId, horizonDays]);

  const branchName = branches.find((b) => b.id === branchId)?.name ?? "";

  const filtered = useMemo(() => {
    let list = suggestions;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.ingredient_name.toLowerCase().includes(q) ||
          (s.ingredient_name_ar || "").includes(searchQuery.trim()) ||
          (s.serial_code || "").toLowerCase().includes(q),
      );
    }
    if (unitFilter !== "all") {
      list = list.filter((s) => (s.display_unit_source || "base") === unitFilter);
    }
    if (hideZero) {
      list = list.filter((s) => parseFloat(s.suggested_purchase_qty) > 0);
    }
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = (isRTL ? (a.ingredient_name_ar || a.ingredient_name) : a.ingredient_name)
            .localeCompare(isRTL ? (b.ingredient_name_ar || b.ingredient_name) : b.ingredient_name);
          break;
        case "required":
          cmp = parseFloat(a.required_qty) - parseFloat(b.required_qty);
          break;
        case "onHand":
          cmp = parseFloat(a.on_hand) - parseFloat(b.on_hand);
          break;
        case "purchase":
          cmp = parseFloat(a.suggested_purchase_qty) - parseFloat(b.suggested_purchase_qty);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [suggestions, searchQuery, unitFilter, hideZero, sortKey, sortDir, isRTL]);

  const totalItems = filtered.length;
  const needPurchase = filtered.filter((s) => parseFloat(s.suggested_purchase_qty) > 0).length;
  const urgent = filtered.filter(
    (s) => parseFloat(s.on_hand) <= 0 && parseFloat(s.required_qty) > 0,
  ).length;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortIcon = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : "";

  const handlePrint = () => window.print();

  const handleDownloadPDF = () => {
    import("jspdf").then(({ default: jsPDF }) => {
      import("jspdf-autotable").then(({ default: autoTable }) => {
        const doc = new jsPDF({ orientation: "landscape" });
        const title = isRTL
          ? `التنبؤ الذكي للشراء - ${branchName} - ${horizonDays} أيام`
          : `Smart Purchase - ${branchName} - ${horizonDays} days`;
        doc.setFontSize(14);
        doc.text(title, 14, 18);
        doc.setFontSize(9);
        doc.text(new Date().toLocaleDateString(), 14, 24);

        const head = [["#", "Serial", "Ingredient", "Unit", "Required", "On Hand", "Purchase Qty"]];
        const body = filtered.map((s, i) => [
          i + 1,
          s.serial_code || "-",
          s.ingredient_name,
          s.unit_code,
          s.required_qty,
          s.on_hand,
          s.suggested_purchase_qty,
        ]);

        autoTable(doc, {
          head,
          body,
          startY: 28,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [16, 185, 129] },
        });

        doc.save(`smart-purchase-${branchName}-${horizonDays}d.pdf`);
      });
    });
  };

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="mx-auto max-w-7xl space-y-5 p-3 sm:p-4 md:p-6 print:p-0">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-emerald-500" />
            {isRTL ? "التنبؤ الذكي للشراء" : "Smart Purchase Forecast"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isRTL
              ? "اقتراح كميات الشراء بناءً على استهلاك الكاشير"
              : "Purchase quantity suggestions based on POS consumption"}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-end gap-3 sm:gap-4">
          <div className="flex-1 min-w-[180px]">
            <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
              {isRTL ? "الفرع" : "Branch"}
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
              className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            >
              <option value="">{isRTL ? "— اختر الفرع —" : "— Select Branch —"}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[130px]">
            <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
              {isRTL ? "أيام التنبؤ" : "Forecast Days"}
            </label>
            <select
              value={horizonDays}
              onChange={(e) => setHorizonDays(Number(e.target.value))}
              className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            >
              {[3, 7, 14, 30].map((d) => (
                <option key={d} value={d}>{d} {isRTL ? "يوم" : "days"}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={branchId === "" || loading}
            className="min-h-[44px] rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                {isRTL ? "جاري التحميل..." : "Loading..."}
              </span>
            ) : (
              isRTL ? "عرض الاقتراحات" : "Get Suggestions"
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {suggestions.length > 0 && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 dark:border-slate-700 dark:bg-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">{isRTL ? "إجمالي الأصناف" : "Total Items"}</p>
              <p className="mt-1 text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">{totalItems}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
              <p className="text-xs text-emerald-600 dark:text-emerald-400">{isRTL ? "يحتاج شراء" : "Need Purchase"}</p>
              <p className="mt-1 text-xl sm:text-2xl font-bold text-emerald-700 dark:text-emerald-300">{needPurchase}</p>
            </div>
            <div className="col-span-2 sm:col-span-1 rounded-xl border border-amber-200 bg-amber-50 p-3 sm:p-4 dark:border-amber-800 dark:bg-amber-900/20">
              <p className="text-xs text-amber-600 dark:text-amber-400">{isRTL ? "عاجل (رصيد صفر)" : "Urgent (Zero Stock)"}</p>
              <p className="mt-1 text-xl sm:text-2xl font-bold text-amber-700 dark:text-amber-300">{urgent}</p>
            </div>
          </div>

          {/* Filter & Actions Bar */}
          <div className="flex flex-col md:flex-row flex-wrap items-stretch md:items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4 dark:border-slate-700 dark:bg-slate-800">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 ${isRTL ? "right-3" : "left-3"}`} />
              <input
                type="text"
                placeholder={isRTL ? "بحث بالاسم أو الكود..." : "Search by name or code..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full min-h-[44px] rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"}`}
              />
            </div>

            {/* Unit Filter */}
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 p-1 dark:border-slate-600">
              <Filter className="h-4 w-4 text-slate-400 mx-1" />
              {(["all", "base", "package"] as UnitFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setUnitFilter(f)}
                  className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    unitFilter === f
                      ? "bg-emerald-500 text-white"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  {f === "all" ? (isRTL ? "الكل" : "All")
                    : f === "base" ? (isRTL ? "أساسية" : "Base")
                    : (isRTL ? "عبوة" : "Package")}
                </button>
              ))}
            </div>

            {/* Hide Zero */}
            <label className="flex items-center gap-2 cursor-pointer min-h-[44px] px-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={hideZero}
                onChange={(e) => setHideZero(e.target.checked)}
                className="h-4 w-4 rounded accent-emerald-500"
              />
              {isRTL ? "إخفاء الأصفار" : "Hide zeros"}
            </label>

            {/* Divider */}
            <div className="hidden md:block h-8 w-px bg-slate-200 dark:bg-slate-600" />

            {/* Export Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPDF}
                className="flex items-center gap-1.5 min-h-[44px] rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition"
              >
                <Download className="h-4 w-4" />
                PDF
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 min-h-[44px] rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition"
              >
                <Printer className="h-4 w-4" />
                {isRTL ? "طباعة" : "Print"}
              </button>
            </div>
          </div>

          {/* Table */}
          <div ref={tableRef} className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 print:border-none print:shadow-none">
            <table className={`w-full text-sm ${isRTL ? "text-right" : "text-left"}`} style={{ minWidth: 640 }}>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
                  <th className="px-3 sm:px-4 py-3 w-10 text-center font-medium text-slate-500 dark:text-slate-400">#</th>
                  <th className="px-3 sm:px-4 py-3 font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {isRTL ? "الكود" : "Code"}
                  </th>
                  <th
                    className="px-3 sm:px-4 py-3 font-medium text-slate-500 dark:text-slate-400 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort("name")}
                  >
                    <span className="inline-flex items-center gap-1">
                      {isRTL ? "المكوّن" : "Ingredient"}
                      <ArrowUpDown className="h-3 w-3" />
                      {sortIcon("name")}
                    </span>
                  </th>
                  <th className="px-3 sm:px-4 py-3 font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {isRTL ? "الوحدة" : "Unit"}
                  </th>
                  <th
                    className="px-3 sm:px-4 py-3 font-medium text-slate-500 dark:text-slate-400 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort("required")}
                  >
                    <span className="inline-flex items-center gap-1">
                      {isRTL ? "المطلوب" : "Required"}
                      <ArrowUpDown className="h-3 w-3" />
                      {sortIcon("required")}
                    </span>
                  </th>
                  <th
                    className="px-3 sm:px-4 py-3 font-medium text-slate-500 dark:text-slate-400 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort("onHand")}
                  >
                    <span className="inline-flex items-center gap-1">
                      {isRTL ? "الرصيد" : "On Hand"}
                      <ArrowUpDown className="h-3 w-3" />
                      {sortIcon("onHand")}
                    </span>
                  </th>
                  <th
                    className="px-3 sm:px-4 py-3 font-medium text-slate-500 dark:text-slate-400 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort("purchase")}
                  >
                    <span className="inline-flex items-center gap-1">
                      {isRTL ? "كمية الشراء" : "Purchase Qty"}
                      <ArrowUpDown className="h-3 w-3" />
                      {sortIcon("purchase")}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => {
                  const purchaseQty = parseFloat(s.suggested_purchase_qty);
                  const onHand = parseFloat(s.on_hand);
                  const isUrgent = onHand <= 0 && parseFloat(s.required_qty) > 0;
                  return (
                    <tr
                      key={s.ingredient_id}
                      className={`border-b border-slate-100 dark:border-slate-700/50 transition ${
                        isUrgent
                          ? "bg-amber-50/50 dark:bg-amber-900/10"
                          : purchaseQty > 0
                            ? "hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <td className="px-3 sm:px-4 py-3 text-center text-xs text-slate-400">{i + 1}</td>
                      <td className="px-3 sm:px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {s.serial_code || "—"}
                      </td>
                      <td className="px-3 sm:px-4 py-3">
                        <div className="font-medium text-slate-800 dark:text-white">
                          {isRTL && s.ingredient_name_ar ? s.ingredient_name_ar : s.ingredient_name}
                        </div>
                        {isRTL && s.ingredient_name_ar && (
                          <div className="text-xs text-slate-400 mt-0.5">{s.ingredient_name}</div>
                        )}
                        {isUrgent && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="h-3 w-3" />
                            {isRTL ? "عاجل" : "Urgent"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-xs">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                          (s.display_unit_source || "base") === "package"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                        }`}>
                          {(s.display_unit_source || "base") === "package" && <Package2 className="h-3 w-3" />}
                          {s.unit_code}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 font-mono text-sm">
                        {parseFloat(s.required_qty).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className={`px-3 sm:px-4 py-3 font-mono text-sm ${onHand <= 0 ? "text-red-500 font-semibold" : ""}`}>
                        {onHand.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 sm:px-4 py-3">
                        {purchaseQty > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 font-mono text-sm font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            <ShoppingCart className="h-3.5 w-3.5" />
                            {purchaseQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div className="py-12 text-center text-slate-400 dark:text-slate-500">
                {searchQuery
                  ? (isRTL ? "لا توجد نتائج تطابق البحث" : "No results match your search")
                  : (isRTL ? "لا توجد بيانات" : "No data")}
              </div>
            )}
          </div>

          {/* Footer */}
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
            {isRTL
              ? `${branchName} · تنبؤ ${horizonDays} يوم · ${filtered.length} صنف`
              : `${branchName} · ${horizonDays}-day forecast · ${filtered.length} items`}
          </p>
        </>
      )}

      {!loading && branchId !== "" && suggestions.length === 0 && !error && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center dark:border-slate-700 dark:bg-slate-800">
          <ShoppingCart className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            {isRTL
              ? "لا توجد اقتراحات – تأكد من رفع مبيعات المنتجات (Product Sales) للفرع"
              : "No suggestions – ensure Product Sales data is uploaded for this branch"}
          </p>
        </div>
      )}
    </div>
  );
}
