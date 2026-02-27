/**
 * ميزان المراجعة — Trial Balance
 * يعرض جميع الحسابات مع مجموع المدين والدائن والرصيد.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Scale, RefreshCw, AlertCircle, Download, Printer,
  ChevronRight, ChevronLeft, Filter, Check, X,
} from "lucide-react";
import { fetchWithCsrf } from "../../lib/api";

/* ─── types ────────────────────────────────────────────────────────────── */
interface TrialRow {
  id: number;
  code: string;
  name_ar: string;
  name_en: string;
  level: number;
  account_type: string;
  statement: string;
  debit: string;
  credit: string;
  balance: string;
  is_parent: boolean;
}
interface TrialData {
  rows: TrialRow[];
  grand_debit: string;
  grand_credit: string;
  difference: string;
  is_balanced: boolean;
  from_date: string | null;
  to_date: string | null;
}

/* ─── helpers ─────────────────────────────────────────────────────────── */
const fmt = (v: string) => {
  const n = parseFloat(v);
  if (isNaN(n)) return "—";
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

async function fetchTrialBalance(params: Record<string, string>): Promise<TrialData> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetchWithCsrf(`/api/accounting/trial-balance/${qs ? "?" + qs : ""}`);
  if (!res.ok) throw new Error(`فشل تحميل ميزان المراجعة (${res.status})`);
  return res.json();
}

/* ─── component ───────────────────────────────────────────────────────── */
export default function TrialBalancePage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const T = (ar: string, en: string) => (isRTL ? ar : en);

  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + "01";

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate]     = useState("");
  const [levelMax, setLevelMax] = useState("5");
  const [stmt, setStmt]         = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const [data, setData]       = useState<TrialData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { level: levelMax };
      if (fromDate) params.from_date = fromDate;
      if (toDate)   params.to_date   = toDate;
      if (stmt !== "all") params.statement = stmt;
      const d = await fetchTrialBalance(params);
      setData(d);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, levelMax, stmt]);

  useEffect(() => { load(); }, [load]);

  /* indentation helpers */
  const indent = (level: number) => (level - 1) * 16;

  /* export to CSV */
  const exportCSV = () => {
    if (!data) return;
    const rows = [
      ["الكود", "اسم الحساب", "المستوى", "مدين", "دائن", "الرصيد"],
      ...data.rows.map((r) => [r.code, r.name_ar, r.level, r.debit, r.credit, r.balance]),
      ["", "الإجمالي", "", data.grand_debit, data.grand_credit, ""],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `trial-balance-${today}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0e1117] text-white" dir={isRTL ? "rtl" : "ltr"}>
      <style>{`@media print { .no-print{display:none!important} }`}</style>

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-[#0e1117] border-b border-white/10 px-4 md:px-6 py-4 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
              <Scale className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{T("ميزان المراجعة", "Trial Balance")}</h1>
              <p className="text-xs text-gray-400">{T("مجموع المدين والدائن لجميع الحسابات", "Total debits and credits for all accounts")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap no-print">
            {data && (
              <span className={`text-xs px-3 py-1.5 rounded-full border font-medium ${
                data.is_balanced
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-red-500/15 text-red-400 border-red-500/30"
              }`}>
                {data.is_balanced ? T("✓ القيد متوازن", "✓ Balanced") : T("✗ غير متوازن", "✗ Unbalanced")}
              </span>
            )}
            <button onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${showFilters ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-[#161b27] border-white/10 text-gray-400 hover:text-white"}`}>
              <Filter className="h-4 w-4" /> {T("فلتر", "Filter")}
            </button>
            <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#161b27] border border-white/10 text-sm text-gray-400 hover:text-white transition-colors">
              <Download className="h-4 w-4" /> {T("تصدير", "Export")}
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#161b27] border border-white/10 text-sm text-gray-400 hover:text-white transition-colors">
              <Printer className="h-4 w-4" /> {T("طباعة", "Print")}
            </button>
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#161b27] border border-white/10 text-sm text-gray-400 hover:text-white transition-colors">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-[#161b27] border border-white/10 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">{T("من تاريخ", "From Date")}</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="w-full bg-[#0e1117] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{T("إلى تاريخ", "To Date")}</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                className="w-full bg-[#0e1117] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{T("المستوى الأقصى", "Max Level")}</label>
              <select value={levelMax} onChange={(e) => setLevelMax(e.target.value)}
                className="w-full bg-[#0e1117] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500">
                {[1,2,3,4,5].map((l) => (
                  <option key={l} value={l}>{T(`المستوى ${l}`, `Level ${l}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{T("القائمة المالية", "Statement")}</label>
              <select value={stmt} onChange={(e) => setStmt(e.target.value)}
                className="w-full bg-[#0e1117] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500">
                <option value="all">{T("الكل", "All")}</option>
                <option value="المركز المالي">{T("المركز المالي", "Balance Sheet")}</option>
                <option value="قائمة الدخل">{T("قائمة الدخل", "Income Statement")}</option>
              </select>
            </div>
            <div className="flex items-end gap-2 col-span-2 md:col-span-4">
              <button onClick={load} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors">
                {T("تطبيق", "Apply")}
              </button>
              <button onClick={() => { setFromDate(""); setToDate(""); setLevelMax("5"); setStmt("all"); }}
                className="px-4 py-2 bg-[#0e1117] border border-white/10 text-gray-400 hover:text-white text-sm rounded-lg transition-colors">
                {T("مسح", "Clear")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Totals cards ── */}
      {data && (
        <div className="px-4 md:px-6 pt-4 grid grid-cols-3 gap-3 no-print">
          {[
            { label: T("إجمالي المدين", "Total Debit"),   value: fmt(data.grand_debit),  color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20" },
            { label: T("إجمالي الدائن", "Total Credit"),  value: fmt(data.grand_credit), color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
            { label: T("الفرق", "Difference"),             value: fmt(data.difference),   color: data.is_balanced ? "text-emerald-400" : "text-red-400",
              bg: data.is_balanced ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20" },
          ].map((c) => (
            <div key={c.label} className={`${c.bg} border rounded-xl p-4 text-center`}>
              <p className="text-xs text-gray-400 mb-1">{c.label}</p>
              <p className={`text-xl font-bold font-mono ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Table ── */}
      <div className="px-4 md:px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 animate-spin text-emerald-400" />
            <span className="ms-3 text-gray-400">{T("جارٍ التحميل...", "Loading...")}</span>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-400 mb-4">{error}</p>
            <button onClick={load} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium">
              {T("إعادة المحاولة", "Retry")}
            </button>
          </div>
        ) : data ? (
          <div className="bg-[#161b27] border border-white/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 640 }}>
                <thead>
                  <tr className="bg-[#1e2533] text-xs text-gray-400 uppercase tracking-wide">
                    <th className="px-4 py-3 text-start w-32">{T("رقم الحساب", "Code")}</th>
                    <th className="px-4 py-3 text-start">{T("اسم الحساب", "Account Name")}</th>
                    <th className="px-4 py-3 text-center hidden md:table-cell">{T("المستوى", "Level")}</th>
                    <th className="px-4 py-3 text-end">{T("مدين", "Debit")}</th>
                    <th className="px-4 py-3 text-end">{T("دائن", "Credit")}</th>
                    <th className="px-4 py-3 text-end">{T("الرصيد", "Balance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr
                      key={row.id}
                      className={`border-t border-white/5 hover:bg-white/5 transition-colors ${row.is_parent ? "bg-white/3 font-semibold" : ""}`}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{row.code}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`${row.is_parent ? "text-white font-semibold" : "text-gray-200"}`}
                          style={{ paddingInlineStart: indent(row.level) }}
                        >
                          {isRTL ? row.name_ar : row.name_en}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center hidden md:table-cell">
                        <span className="text-xs bg-[#1e2533] text-gray-400 px-2 py-0.5 rounded">
                          {T(`م${row.level}`, `L${row.level}`)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-end font-mono">
                        {parseFloat(row.debit) > 0
                          ? <span className="text-blue-400">{fmt(row.debit)}</span>
                          : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-end font-mono">
                        {parseFloat(row.credit) > 0
                          ? <span className="text-purple-400">{fmt(row.credit)}</span>
                          : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-end font-mono">
                        <span className={parseFloat(row.balance) >= 0 ? "text-emerald-400" : "text-red-400"}>
                          {fmt(row.balance)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#1e2533] border-t-2 border-white/20 text-sm font-bold">
                    <td colSpan={3} className="px-4 py-3 text-gray-300">{T("الإجمالي العام", "Grand Total")}</td>
                    <td className="px-4 py-3 text-end text-blue-400 font-mono">{fmt(data.grand_debit)}</td>
                    <td className="px-4 py-3 text-end text-purple-400 font-mono">{fmt(data.grand_credit)}</td>
                    <td className="px-4 py-3 text-end">
                      <span className={data.is_balanced ? "text-emerald-400" : "text-red-400"}>
                        {data.is_balanced ? T("✓ متوازن", "✓ Balanced") : fmt(data.difference)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
