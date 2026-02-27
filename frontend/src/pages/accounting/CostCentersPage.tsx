/**
 * مراكز التكلفة — Cost Centers
 * عرض وإدارة مراكز التكلفة من شجرة الحسابات.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Layers, RefreshCw, AlertCircle, Search, TrendingUp,
  TrendingDown, DollarSign, Download,
} from "lucide-react";
import { fetchWithCsrf } from "../../lib/api";

interface CostCenter {
  id: number;
  code: string;
  name_ar: string;
  name_en: string;
  level: number;
  statement: string;
  balance: string;
}

const fmt = (v: string) => {
  const n = parseFloat(v);
  if (isNaN(n)) return "—";
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function CostCentersPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const T = (ar: string, en: string) => (isRTL ? ar : en);

  const [data, setData]         = useState<CostCenter[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [searchQ, setSearchQ]   = useState("");
  const [stmtFilter, setStmtFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithCsrf("/api/accounting/cost-centers/");
      if (!res.ok) throw new Error(`${res.status}`);
      const d = await res.json();
      setData(d.cost_centers || []);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = data.filter((c) => {
    const matchSearch = !searchQ || c.code.includes(searchQ) || c.name_ar.includes(searchQ);
    const matchStmt   = stmtFilter === "all" || c.statement === stmtFilter;
    return matchSearch && matchStmt;
  });

  const totalBalance = filtered.reduce((s, c) => s + parseFloat(c.balance), 0);
  const positiveCount = filtered.filter((c) => parseFloat(c.balance) > 0).length;
  const negativeCount = filtered.filter((c) => parseFloat(c.balance) < 0).length;

  const exportCSV = () => {
    const rows = [
      ["الكود", "اسم المركز", "المستوى", "القائمة المالية", "الرصيد"],
      ...filtered.map((c) => [c.code, c.name_ar, c.level, c.statement, c.balance]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "cost-centers.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0e1117] text-white" dir={isRTL ? "rtl" : "ltr"}>

      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0e1117] border-b border-white/10 px-4 md:px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30">
              <Layers className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{T("مراكز التكلفة", "Cost Centers")}</h1>
              <p className="text-xs text-gray-400">{T("الحسابات التحليلية وأرصدتها", "Analytical accounts and their balances")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#161b27] border border-white/10 text-sm text-gray-400 hover:text-white transition-colors">
              <Download className="h-4 w-4" /> {T("تصدير", "Export")}
            </button>
            <button onClick={load} className="p-2 rounded-lg bg-[#161b27] border border-white/10 text-gray-400 hover:text-white transition-colors">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Search + filter */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <input type="text" value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
              placeholder={T("ابحث بالكود أو الاسم...", "Search by code or name...")}
              className="w-full bg-[#161b27] border border-white/10 rounded-lg py-2 px-3 ps-8 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500" />
          </div>
          <select value={stmtFilter} onChange={(e) => setStmtFilter(e.target.value)}
            className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
            <option value="all">{T("جميع القوائم", "All Statements")}</option>
            <option value="المركز المالي">{T("المركز المالي", "Balance Sheet")}</option>
            <option value="قائمة الدخل">{T("قائمة الدخل", "Income Statement")}</option>
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="px-4 md:px-6 pt-4 grid grid-cols-3 gap-3">
        {[
          { label: T("إجمالي المراكز", "Total Centers"), value: filtered.length, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20", unit: "" },
          { label: T("أرصدة موجبة", "Positive Balances"), value: positiveCount, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", unit: "" },
          { label: T("الرصيد الإجمالي", "Total Balance"), value: fmt(String(totalBalance)), color: totalBalance >= 0 ? "text-emerald-400" : "text-red-400", bg: "bg-[#161b27] border-white/10", unit: "" },
        ].map((c) => (
          <div key={c.label} className={`${c.bg} border rounded-xl p-4 text-center`}>
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className={`text-xl font-bold font-mono ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="px-4 md:px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 animate-spin text-cyan-400" />
            <span className="ms-3 text-gray-400">{T("جارٍ التحميل...", "Loading...")}</span>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-400 mb-4">{error}</p>
            <button onClick={load} className="px-5 py-2 bg-cyan-600 text-white rounded-xl text-sm">{T("إعادة المحاولة", "Retry")}</button>
          </div>
        ) : (
          <div className="bg-[#161b27] border border-white/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 500 }}>
                <thead>
                  <tr className="bg-[#1e2533] text-xs text-gray-400 uppercase tracking-wide">
                    <th className="px-4 py-3 text-start">{T("رقم الحساب", "Code")}</th>
                    <th className="px-4 py-3 text-start">{T("مركز التكلفة", "Cost Center")}</th>
                    <th className="px-4 py-3 text-center">{T("المستوى", "Level")}</th>
                    <th className="px-4 py-3 text-center hidden md:table-cell">{T("القائمة", "Statement")}</th>
                    <th className="px-4 py-3 text-end">{T("الرصيد", "Balance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-gray-500">
                        {T("لا توجد نتائج", "No results")}
                      </td>
                    </tr>
                  ) : filtered.map((c) => {
                    const bal = parseFloat(c.balance);
                    return (
                      <tr key={c.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{c.code}</td>
                        <td className="px-4 py-3">
                          <span className="text-white font-medium">{isRTL ? c.name_ar : c.name_en}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs bg-[#1e2533] text-gray-400 px-2 py-0.5 rounded">
                            {T(`م${c.level}`, `L${c.level}`)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          <span className="text-xs text-gray-500">{c.statement}</span>
                        </td>
                        <td className="px-4 py-3 text-end">
                          <div className="flex items-center justify-end gap-1.5">
                            {bal > 0 ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                              : bal < 0 ? <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                              : <DollarSign className="h-3.5 w-3.5 text-gray-500" />}
                            <span className={`font-mono font-semibold ${bal > 0 ? "text-emerald-400" : bal < 0 ? "text-red-400" : "text-gray-500"}`}>
                              {fmt(c.balance)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-white/5 text-xs text-gray-500">
              {T("عرض", "Showing")} {filtered.length} {T("مركز", "centers")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
