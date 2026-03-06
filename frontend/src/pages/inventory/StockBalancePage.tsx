/**
 * أرصدة المخزون — Stock Balance Report
 * عرض الكميات الحالية لكل صنف في كل فرع مع تنبيه الحد الأدنى
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Boxes, RefreshCw, Download, Search,
  AlertTriangle, TrendingUp, Filter, BarChart3,
} from "lucide-react";
import { fetchBrands, fetchBranches, type Brand, type Branch, fetchWithCsrf } from "../../lib/api";

interface StockRow {
  id: number;
  branch_id: number;
  branch_name: string;
  brand_name: string;
  ingredient_id: number;
  ingredient_name_en: string;
  ingredient_name_ar: string;
  unit_code: string;
  on_hand: string;
  reorder_level: string;
  unit_cost: string | null;
  value: string | null;
  is_low_stock: boolean;
}

const fmt = (v: string | number | null | undefined, decimals = 2) => {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  return n.toLocaleString("ar-SA", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

export default function StockBalancePage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const T = (ar: string, en: string) => (isRTL ? ar : en);

  const [rows, setRows] = useState<StockRow[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalValue, setTotalValue] = useState("0");

  const [brandFilter, setBrandFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (brandFilter) params.set("brand_id", brandFilter);
      if (branchFilter) params.set("branch_id", branchFilter);
      if (search) params.set("search", search);
      if (lowStockOnly) params.set("low_stock_only", "1");
      const res = await fetchWithCsrf(`/api/inventory/stock-balance/?${params}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const d = await res.json();
      setRows(d.rows || []);
      setTotalValue(d.total_value || "0");
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [brandFilter, branchFilter, search, lowStockOnly]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetchBrands().then((r) => setBrands(Array.isArray(r) ? r : [])).catch(() => setBrands([]));
    fetchBranches().then((r) => setBranches(Array.isArray(r) ? r : [])).catch(() => setBranches([]));
  }, []);

  const lowCount = rows.filter((r) => r.is_low_stock).length;

  const exportCSV = () => {
    const headers = [
      T("الصنف", "Ingredient"), T("الفرع", "Branch"), T("العلامة", "Brand"),
      T("الكمية", "On Hand"), T("الوحدة", "Unit"), T("حد الإعادة", "Reorder"),
      T("سعر الوحدة", "Unit Cost"), T("القيمة", "Value"), T("حالة", "Status"),
    ];
    const data = rows.map((r) => [
      isRTL ? r.ingredient_name_ar || r.ingredient_name_en : r.ingredient_name_en,
      r.branch_name, r.brand_name,
      r.on_hand, r.unit_code, r.reorder_level,
      r.unit_cost ?? "—", r.value ?? "—",
      r.is_low_stock ? T("مخزون منخفض", "Low Stock") : T("طبيعي", "OK"),
    ]);
    const csv = [headers, ...data].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "stock-balance.csv"; a.click();
  };

  return (
    <div className="min-h-screen bg-[#0e1117] text-white" dir={isRTL ? "rtl" : "ltr"}>
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-[#0e1117] border-b border-white/10 px-4 md:px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30">
              <Boxes className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{T("أرصدة المخزون", "Stock Balance")}</h1>
              <p className="text-xs text-gray-400">{T("الكميات الحالية لكل صنف حسب الفرع مع تنبيهات الحد الأدنى", "Current stock levels per ingredient & branch with reorder alerts")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#161b27] border border-white/10 text-sm text-gray-400 hover:text-white transition-colors">
              <Download className="h-4 w-4" /> {T("تصدير", "Export")}
            </button>
            <button onClick={load}
              className="p-2 rounded-lg bg-[#161b27] border border-white/10 text-gray-400 hover:text-white transition-colors">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={T("بحث باسم الصنف...", "Search ingredient...")}
              className="w-full bg-[#161b27] border border-white/10 rounded-lg py-2 px-3 ps-8 text-sm text-white" />
          </div>
          <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}
            className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">{T("كل العلامات", "All Brands")}</option>
            {(Array.isArray(brands) ? brands : []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}
            className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">{T("كل الفروع", "All Branches")}</option>
            {(Array.isArray(branches) ? branches : []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${lowStockOnly ? "bg-red-500/20 border-red-500/40 text-red-400" : "bg-[#161b27] border-white/10 text-gray-400 hover:text-white"}`}>
            <AlertTriangle className="h-4 w-4" />
            {T("مخزون منخفض", "Low Stock Only")}
            {lowCount > 0 && <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{lowCount}</span>}
          </button>
        </div>
      </div>

      <div className="px-4 md:px-6 pt-4 space-y-4">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-[#161b27] border border-cyan-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">{T("إجمالي قيمة المخزون", "Total Stock Value")}</span>
              <TrendingUp className="h-4 w-4 text-cyan-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-cyan-400">{fmt(totalValue)}</p>
            <p className="text-xs text-gray-500 mt-1">{rows.length} {T("صنف", "item(s)")}</p>
          </div>
          <div className="bg-[#161b27] border border-red-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">{T("أصناف دون الحد الأدنى", "Below Reorder Level")}</span>
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-red-400">{lowCount}</p>
            <p className="text-xs text-gray-500 mt-1">{T("تحتاج إعادة طلب", "need reorder")}</p>
          </div>
          <div className="bg-[#161b27] border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">{T("إجمالي السجلات", "Total Records")}</span>
              <Filter className="h-4 w-4 text-gray-500" />
            </div>
            <p className="text-2xl font-bold font-mono">{rows.length}</p>
            <p className="text-xs text-gray-500 mt-1">{T("صنف × فرع", "ingredient × branch")}</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#161b27] border border-white/10 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <Boxes className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{T("لا توجد سجلات مخزون", "No stock records found")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1e2533] text-xs text-gray-400 uppercase">
                    <th className="px-4 py-3 text-start">{T("الصنف", "Ingredient")}</th>
                    <th className="px-4 py-3 text-start">{T("الفرع", "Branch")}</th>
                    <th className="px-4 py-3 text-end">{T("الكمية المتاحة", "On Hand")}</th>
                    <th className="px-4 py-3 text-end">{T("حد الإعادة", "Reorder")}</th>
                    <th className="px-4 py-3 text-end">{T("سعر الوحدة", "Unit Cost")}</th>
                    <th className="px-4 py-3 text-end">{T("القيمة", "Value")}</th>
                    <th className="px-4 py-3 text-center">{T("الحالة", "Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}
                      className={`border-t border-white/5 transition-colors ${r.is_low_stock ? "bg-red-950/20 hover:bg-red-950/30" : "hover:bg-white/5"}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{isRTL ? r.ingredient_name_ar || r.ingredient_name_en : r.ingredient_name_en}</div>
                        {isRTL && r.ingredient_name_ar && r.ingredient_name_ar !== r.ingredient_name_en && (
                          <div className="text-xs text-gray-500">{r.ingredient_name_en}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">{r.branch_name}</div>
                        <div className="text-xs text-gray-500">{r.brand_name}</div>
                      </td>
                      <td className="px-4 py-3 text-end font-mono font-semibold">
                        <span className={r.is_low_stock ? "text-red-400" : "text-white"}>
                          {fmt(r.on_hand, 3)} <span className="text-xs text-gray-500">{r.unit_code}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-end font-mono text-gray-400">
                        {parseFloat(r.reorder_level) > 0 ? `${fmt(r.reorder_level, 3)} ${r.unit_code}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-end font-mono text-gray-300">
                        {r.unit_cost ? fmt(r.unit_cost) : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-end font-mono font-bold text-emerald-400">
                        {r.value ? fmt(r.value) : <span className="text-gray-600 font-normal">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.is_low_stock ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="h-3 w-3" />{T("منخفض", "Low")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">
                            <BarChart3 className="h-3 w-3" />{T("طبيعي", "OK")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-600 pb-4">
          {T(`إجمالي: ${rows.length} سجل`, `Total: ${rows.length} record(s)`)}
        </p>
      </div>
    </div>
  );
}
