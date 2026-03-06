/**
 * تقرير النقد والشبكة — Cash & Network Report
 * يعرض تفاصيل النقد (بتحليل العجز/الزيادة) وقيم الشبكة (مدى، فيزا، ماستر)
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Banknote, CreditCard, RefreshCw, Download, Calendar,
  TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { fetchBranches, type Branch, fetchWithCsrf } from "../../lib/api";

interface CashRow {
  branch_id: number;
  branch_name: string;
  date: string;
  manual_cash: string;
  system_cash: string;
  cash_variance: string;
}
interface NetworkRow {
  branch_id: number;
  branch_name: string;
  date: string;
  mada: string;
  visa: string;
  master_card: string;
  system_network: string;
  network_variance: string;
}

const fmt = (v: string | number) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "0.00";
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (d: string) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short", day: "numeric" });
};

const today = () => new Date().toISOString().slice(0, 10);
const weekAgo = () => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); };

export default function SalesCashNetworkPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const T = (ar: string, en: string) => (isRTL ? ar : en);

  const [cashRows, setCashRows] = useState<CashRow[]>([]);
  const [networkRows, setNetworkRows] = useState<NetworkRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"cash" | "network">("cash");
  const [dateFrom, setDateFrom] = useState(weekAgo());
  const [dateTo, setDateTo] = useState(today());
  const [branchFilter, setBranchFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
      if (branchFilter) params.set("branch_ids", branchFilter);
      const res = await fetchWithCsrf(`/api/shifts/financial-reports/?${params}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const d = await res.json();
      setCashRows(d.reports.cash_report || []);
      setNetworkRows(d.reports.network_report || []);
    } catch {
      setCashRows([]);
      setNetworkRows([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, branchFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchBranches().then((r) => setBranches(Array.isArray(r) ? r : [])).catch(() => setBranches([])); }, []);

  const totalCashVariance = cashRows.reduce((s, r) => s + parseFloat(r.cash_variance || "0"), 0);
  const totalNetworkVariance = networkRows.reduce((s, r) => s + parseFloat(r.network_variance || "0"), 0);

  const exportCSV = () => {
    const isCash = tab === "cash";
    const headers = isCash
      ? [T("التاريخ", "Date"), T("الفرع", "Branch"), T("النقد الفعلي", "Manual Cash"), T("نظام الكاشير", "System Cash"), T("الفرق", "Variance")]
      : [T("التاريخ", "Date"), T("الفرع", "Branch"), T("مدى", "Mada"), T("فيزا", "Visa"), T("ماستر", "Master"), T("نظام الكاشير", "System Network"), T("الفرق", "Variance")];
    const data = isCash
      ? cashRows.map((r) => [r.date, r.branch_name, r.manual_cash, r.system_cash, r.cash_variance])
      : networkRows.map((r) => [r.date, r.branch_name, r.mada, r.visa, r.master_card, r.system_network, r.network_variance]);
    const csv = [headers, ...data].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${tab}-report-${dateFrom}.csv`; a.click();
  };

  const VarianceBadge = ({ val }: { val: string }) => {
    const n = parseFloat(val);
    if (Math.abs(n) < 0.01) return <span className="text-gray-400">0.00</span>;
    if (n > 0) return <span className="flex items-center justify-end gap-1 text-emerald-400"><TrendingUp className="h-3 w-3" />{fmt(val)}</span>;
    return <span className="flex items-center justify-end gap-1 text-red-400"><TrendingDown className="h-3 w-3" />{fmt(val)}</span>;
  };

  return (
    <div className="min-h-screen bg-[#0e1117] text-white" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0e1117] border-b border-white/10 px-4 md:px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30">
              {tab === "cash" ? <Banknote className="h-5 w-5 text-amber-400" /> : <CreditCard className="h-5 w-5 text-blue-400" />}
            </div>
            <div>
              <h1 className="text-lg font-bold">{T("تقرير النقد والشبكة", "Cash & Network Report")}</h1>
              <p className="text-xs text-gray-400">{T("تحليل الفروقات بين الكاشير والأنظمة", "Variance analysis between cashier & systems")}</p>
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

        <div className="flex flex-wrap gap-2">
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}
            className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">{T("كل الفروع", "All Branches")}</option>
            {(Array.isArray(branches) ? branches : []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4 text-gray-500 shrink-0" />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
            <span className="text-gray-500 text-xs">→</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 pt-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 bg-[#161b27] border border-white/10 rounded-xl p-1 w-fit">
          <button onClick={() => setTab("cash")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${tab === "cash" ? "bg-[#1e2533] text-amber-400" : "text-gray-400 hover:text-white"}`}>
            <Banknote className="h-4 w-4" />{T("النقد", "Cash")}
          </button>
          <button onClick={() => setTab("network")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${tab === "network" ? "bg-[#1e2533] text-blue-400" : "text-gray-400 hover:text-white"}`}>
            <CreditCard className="h-4 w-4" />{T("الشبكة", "Network")}
          </button>
        </div>

        {/* Variance Summary */}
        <div className="bg-[#161b27] border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 mb-1">{T("إجمالي فروقات", "Total Variance")} {tab === "cash" ? T("النقد", "Cash") : T("الشبكة", "Network")}</p>
              {(() => {
                const val = tab === "cash" ? totalCashVariance : totalNetworkVariance;
                return (
                  <p className={`text-2xl font-bold font-mono ${Math.abs(val) < 0.01 ? "text-gray-400" : val > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {val > 0 ? "+" : ""}{fmt(val)}
                  </p>
                );
              })()}
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">{tab === "cash" ? cashRows.length : networkRows.length} {T("سجل", "records")}</p>
              <p className="text-xs text-gray-500 mt-1">{T("موجب = زيادة | سالب = عجز", "Positive = excess | Negative = shortage")}</p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#161b27] border border-white/10 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <RefreshCw className="h-8 w-8 animate-spin text-amber-400" />
            </div>
          ) : (tab === "cash" ? cashRows : networkRows).length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <Banknote className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{T("لا توجد بيانات في هذه الفترة", "No data for this period")}</p>
            </div>
          ) : tab === "cash" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1e2533] text-xs text-gray-400 uppercase">
                    <th className="px-4 py-3 text-start">{T("التاريخ", "Date")}</th>
                    <th className="px-4 py-3 text-start">{T("الفرع", "Branch")}</th>
                    <th className="px-4 py-3 text-end">{T("النقد الفعلي", "Actual Cash")}</th>
                    <th className="px-4 py-3 text-end">{T("كاشير النظام", "System Cash")}</th>
                    <th className="px-4 py-3 text-end">{T("الفرق", "Variance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {cashRows.map((r, i) => (
                    <tr key={i} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-gray-300 text-xs">{fmtDate(r.date)}</td>
                      <td className="px-4 py-3 font-medium">{r.branch_name}</td>
                      <td className="px-4 py-3 text-end font-mono text-amber-300">{fmt(r.manual_cash)}</td>
                      <td className="px-4 py-3 text-end font-mono text-gray-300">{fmt(r.system_cash)}</td>
                      <td className="px-4 py-3 text-end font-mono"><VarianceBadge val={r.cash_variance} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1e2533] text-xs text-gray-400 uppercase">
                    <th className="px-4 py-3 text-start">{T("التاريخ", "Date")}</th>
                    <th className="px-4 py-3 text-start">{T("الفرع", "Branch")}</th>
                    <th className="px-4 py-3 text-end">{T("مدى", "Mada")}</th>
                    <th className="px-4 py-3 text-end">{T("فيزا", "Visa")}</th>
                    <th className="px-4 py-3 text-end">{T("ماستر", "Master")}</th>
                    <th className="px-4 py-3 text-end">{T("كاشير النظام", "System")}</th>
                    <th className="px-4 py-3 text-end">{T("الفرق", "Variance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {networkRows.map((r, i) => (
                    <tr key={i} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-gray-300 text-xs">{fmtDate(r.date)}</td>
                      <td className="px-4 py-3 font-medium">{r.branch_name}</td>
                      <td className="px-4 py-3 text-end font-mono text-blue-300">{fmt(r.mada)}</td>
                      <td className="px-4 py-3 text-end font-mono text-blue-300">{fmt(r.visa)}</td>
                      <td className="px-4 py-3 text-end font-mono text-blue-300">{fmt(r.master_card)}</td>
                      <td className="px-4 py-3 text-end font-mono text-gray-300">{fmt(r.system_network)}</td>
                      <td className="px-4 py-3 text-end font-mono"><VarianceBadge val={r.network_variance} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
