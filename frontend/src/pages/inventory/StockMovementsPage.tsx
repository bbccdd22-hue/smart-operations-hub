/**
 * حركات المخزون — Stock Movements Report
 * تقرير تفصيلي لجميع حركات المخزون (شراء، استهلاك، تسوية، تحويل)
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity, RefreshCw, Download, Search, Calendar,
  ArrowDown, ArrowUp, ArrowLeftRight,
} from "lucide-react";
import { fetchBrands, fetchBranches, type Brand, type Branch, fetchWithCsrf } from "../../lib/api";

interface MovementRow {
  id: number;
  branch_id: number;
  branch_name: string;
  brand_name: string;
  ingredient_id: number;
  ingredient_name_en: string;
  ingredient_name_ar: string;
  unit_code: string;
  movement_type: string;
  movement_type_ar: string;
  qty_delta: string;
  reference: string;
  created_at: string;
}

const TYPE_META: Record<string, { ar: string; color: string; bg: string; icon: React.ElementType }> = {
  purchase:     { ar: "شراء",          color: "text-blue-400",    bg: "bg-blue-500/15",    icon: ArrowDown },
  adjustment:   { ar: "تسوية",         color: "text-amber-400",   bg: "bg-amber-500/15",   icon: ArrowLeftRight },
  depletion:    { ar: "استهلاك",       color: "text-red-400",     bg: "bg-red-500/15",     icon: ArrowUp },
  transfer_out: { ar: "تحويل صادر",   color: "text-orange-400",  bg: "bg-orange-500/15",  icon: ArrowUp },
  transfer_in:  { ar: "تحويل وارد",   color: "text-emerald-400", bg: "bg-emerald-500/15", icon: ArrowDown },
};

const fmt = (v: string | number, abs = false) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "0";
  const val = abs ? Math.abs(n) : n;
  return val.toLocaleString("ar-SA", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
};

const fmtDt = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("ar-SA-u-nu-latn", { dateStyle: "short", timeStyle: "short" });
};

const today = () => new Date().toISOString().slice(0, 10);
const weekAgo = () => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); };

export default function StockMovementsPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const T = (ar: string, en: string) => (isRTL ? ar : en);

  const [rows, setRows] = useState<MovementRow[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalIn, setTotalIn] = useState("0");
  const [totalOut, setTotalOut] = useState("0");

  const [brandFilter, setBrandFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(weekAgo());
  const [dateTo, setDateTo] = useState(today());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
      if (brandFilter) params.set("brand_id", brandFilter);
      if (branchFilter) params.set("branch_id", branchFilter);
      if (typeFilter) params.set("movement_type", typeFilter);
      if (search) params.set("search", search);
      const res = await fetchWithCsrf(`/api/inventory/stock-movements/?${params}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const d = await res.json();
      setRows(d.rows || []);
      setTotalIn(d.total_in || "0");
      setTotalOut(d.total_out || "0");
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [brandFilter, branchFilter, typeFilter, search, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetchBrands().then((r) => setBrands(Array.isArray(r) ? r : [])).catch(() => setBrands([]));
    fetchBranches().then((r) => setBranches(Array.isArray(r) ? r : [])).catch(() => setBranches([]));
  }, []);

  const exportCSV = () => {
    const headers = [T("الصنف", "Ingredient"), T("الفرع", "Branch"), T("النوع", "Type"), T("الكمية", "Qty"), T("الوحدة", "Unit"), T("المرجع", "Reference"), T("الوقت", "Time")];
    const data = rows.map((r) => [
      isRTL ? r.ingredient_name_ar || r.ingredient_name_en : r.ingredient_name_en,
      r.branch_name, isRTL ? r.movement_type_ar : r.movement_type,
      r.qty_delta, r.unit_code, r.reference, fmtDt(r.created_at),
    ]);
    const csv = [headers, ...data].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `stock-movements-${dateFrom}-to-${dateTo}.csv`; a.click();
  };

  return (
    <div className="min-h-screen bg-[#0e1117] text-white" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0e1117] border-b border-white/10 px-4 md:px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/20 border border-violet-500/30">
              <Activity className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{T("حركات المخزون", "Stock Movements")}</h1>
              <p className="text-xs text-gray-400">{T("جميع حركات المخزون: شراء، استهلاك، تسوية، تحويل", "All stock movements: purchase, depletion, adjustment, transfer")}</p>
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

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <div className="relative col-span-2 md:col-span-1">
            <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={T("بحث بالصنف...", "Search ingredient...")}
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
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">{T("كل الحركات", "All Types")}</option>
            <option value="purchase">{T("شراء", "Purchase")}</option>
            <option value="depletion">{T("استهلاك", "Depletion")}</option>
            <option value="adjustment">{T("تسوية", "Adjustment")}</option>
            <option value="transfer_in">{T("تحويل وارد", "Transfer In")}</option>
            <option value="transfer_out">{T("تحويل صادر", "Transfer Out")}</option>
          </select>
          <div className="flex items-center gap-1 col-span-2 md:col-span-2 lg:col-span-2">
            <Calendar className="h-4 w-4 text-gray-500 shrink-0" />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 bg-[#161b27] border border-white/10 rounded-lg px-2 py-2 text-sm text-white" />
            <span className="text-gray-500 text-xs">→</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 bg-[#161b27] border border-white/10 rounded-lg px-2 py-2 text-sm text-white" />
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 pt-4 space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#161b27] border border-blue-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">{T("إجمالي الوارد", "Total In")}</span>
              <ArrowDown className="h-4 w-4 text-blue-400" />
            </div>
            <p className="text-xl font-bold font-mono text-blue-400">+{fmt(totalIn, true)}</p>
            <p className="text-xs text-gray-500 mt-1">{rows.filter((r) => parseFloat(r.qty_delta) > 0).length} {T("حركة", "movements")}</p>
          </div>
          <div className="bg-[#161b27] border border-red-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">{T("إجمالي الصادر", "Total Out")}</span>
              <ArrowUp className="h-4 w-4 text-red-400" />
            </div>
            <p className="text-xl font-bold font-mono text-red-400">{fmt(totalOut)}</p>
            <p className="text-xs text-gray-500 mt-1">{rows.filter((r) => parseFloat(r.qty_delta) < 0).length} {T("حركة", "movements")}</p>
          </div>
          <div className="bg-[#161b27] border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">{T("إجمالي الحركات", "Total Movements")}</span>
              <Activity className="h-4 w-4 text-gray-500" />
            </div>
            <p className="text-xl font-bold font-mono">{rows.length}</p>
            <p className="text-xs text-gray-500 mt-1">{T("في هذه الفترة", "in this period")}</p>
          </div>
        </div>

        {/* Type filter pills */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(TYPE_META).map(([key, meta]) => {
            const Icon = meta.icon;
            const count = rows.filter((r) => r.movement_type === key).length;
            return (
              <button key={key} onClick={() => setTypeFilter(typeFilter === key ? "" : key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors ${typeFilter === key ? `${meta.bg} ${meta.color} border-current/30` : "bg-[#161b27] border-white/10 text-gray-400 hover:text-white"}`}>
                <Icon className="h-3.5 w-3.5" />
                {isRTL ? meta.ar : key.replace("_", " ")}
                <span className="opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="bg-[#161b27] border border-white/10 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <RefreshCw className="h-8 w-8 animate-spin text-violet-400" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{T("لا توجد حركات في هذه الفترة", "No movements for this period")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1e2533] text-xs text-gray-400 uppercase">
                    <th className="px-4 py-3 text-start">{T("الصنف", "Ingredient")}</th>
                    <th className="px-4 py-3 text-start">{T("الفرع", "Branch")}</th>
                    <th className="px-4 py-3 text-center">{T("نوع الحركة", "Type")}</th>
                    <th className="px-4 py-3 text-end">{T("الكمية", "Quantity")}</th>
                    <th className="px-4 py-3 text-start">{T("المرجع", "Reference")}</th>
                    <th className="px-4 py-3 text-start">{T("التوقيت", "Time")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const qty = parseFloat(r.qty_delta);
                    const meta = TYPE_META[r.movement_type] || { color: "text-gray-400", bg: "bg-gray-500/15", icon: ArrowLeftRight, ar: r.movement_type };
                    const Icon = meta.icon;
                    return (
                      <tr key={r.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium">{isRTL ? r.ingredient_name_ar || r.ingredient_name_en : r.ingredient_name_en}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-[#1e2533] text-gray-400 px-2 py-0.5 rounded">{r.branch_name}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                            <Icon className="h-3 w-3" />
                            {isRTL ? meta.ar : r.movement_type.replace("_", " ")}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-end font-mono font-bold ${qty > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {qty > 0 ? "+" : ""}{fmt(r.qty_delta)} <span className="text-xs text-gray-500 font-normal">{r.unit_code}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 font-mono">{r.reference || "—"}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{fmtDt(r.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-600 pb-4">{T(`إجمالي: ${rows.length} حركة`, `Total: ${rows.length} movement(s)`)}</p>
      </div>
    </div>
  );
}
