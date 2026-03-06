/**
 * تقرير المبيعات اليومية — Daily Sales Report
 * يعرض إجماليات المبيعات (نقد، شبكة، توصيل) حسب الفرع والتاريخ
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  TrendingUp, RefreshCw, Download, Calendar,
  BarChart3, CreditCard, Truck, Banknote, Building2,
} from "lucide-react";
import { fetchBrands, fetchBranches, type Brand, type Branch, fetchWithCsrf } from "../../lib/api";

interface DailySalesRow {
  branch_id: number;
  branch_name: string;
  brand_name?: string;
  date: string;
  cash_total: string;
  network_total: string;
  delivery_total: string;
  gross_total: string;
  tax_amount: string;
  net_sales: string;
  shifts_count?: number;
}

interface ReportResponse {
  date_from: string;
  date_to: string;
  period: string;
  reports: {
    daily_sales: DailySalesRow[];
    cash_report?: unknown[];
    network_report?: unknown[];
  };
}

const fmt = (v: string | number) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "0.00";
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (d: string) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
};

const today = () => new Date().toISOString().slice(0, 10);
const weekAgo = () => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); };

export default function SalesDailyReportPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const T = (ar: string, en: string) => (isRTL ? ar : en);

  const [rows, setRows] = useState<DailySalesRow[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(weekAgo());
  const [dateTo, setDateTo] = useState(today());
  const [branchFilter, setBranchFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [groupBy, setGroupBy] = useState<"branch" | "date">("date");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
      if (branchFilter) params.set("branch_ids", branchFilter);
      if (brandFilter) params.set("brand", brandFilter);
      const res = await fetchWithCsrf(`/api/shifts/financial-reports/?${params}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const d: ReportResponse = await res.json();
      setRows(d.reports.daily_sales || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, branchFilter, brandFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetchBrands().then((r) => setBrands(Array.isArray(r) ? r : [])).catch(() => setBrands([]));
    fetchBranches().then((r) => setBranches(Array.isArray(r) ? r : [])).catch(() => setBranches([]));
  }, []);

  const grandTotal = rows.reduce((s, r) => s + parseFloat(r.gross_total || "0"), 0);
  const totalCash = rows.reduce((s, r) => s + parseFloat(r.cash_total || "0"), 0);
  const totalNetwork = rows.reduce((s, r) => s + parseFloat(r.network_total || "0"), 0);
  const totalDelivery = rows.reduce((s, r) => s + parseFloat(r.delivery_total || "0"), 0);
  const totalTax = rows.reduce((s, r) => s + parseFloat(r.tax_amount || "0"), 0);

  // Group rows for display
  const displayRows = groupBy === "branch"
    ? Object.values(
        rows.reduce((acc: Record<string, DailySalesRow & { count: number }>, r) => {
          const key = String(r.branch_id);
          if (!acc[key]) {
            acc[key] = { ...r, gross_total: "0", cash_total: "0", network_total: "0", delivery_total: "0", tax_amount: "0", net_sales: "0", count: 0 };
          }
          acc[key].gross_total = String(parseFloat(acc[key].gross_total) + parseFloat(r.gross_total || "0"));
          acc[key].cash_total = String(parseFloat(acc[key].cash_total) + parseFloat(r.cash_total || "0"));
          acc[key].network_total = String(parseFloat(acc[key].network_total) + parseFloat(r.network_total || "0"));
          acc[key].delivery_total = String(parseFloat(acc[key].delivery_total) + parseFloat(r.delivery_total || "0"));
          acc[key].tax_amount = String(parseFloat(acc[key].tax_amount) + parseFloat(r.tax_amount || "0"));
          acc[key].count += 1;
          return acc;
        }, {})
      )
    : rows;

  const exportCSV = () => {
    const headers = [T("التاريخ", "Date"), T("الفرع", "Branch"), T("النقد", "Cash"), T("الشبكة", "Network"), T("التوصيل", "Delivery"), T("الإجمالي", "Gross"), T("الضريبة", "VAT"), T("الصافي", "Net")];
    const data = rows.map((r) => [r.date, r.branch_name, r.cash_total, r.network_total, r.delivery_total, r.gross_total, r.tax_amount, r.net_sales]);
    const csv = [headers, ...data].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `sales-report-${dateFrom}-to-${dateTo}.csv`; a.click();
  };

  return (
    <div className="min-h-screen bg-[#0e1117] text-white" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0e1117] border-b border-white/10 px-4 md:px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{T("تقرير المبيعات اليومية", "Daily Sales Report")}</h1>
              <p className="text-xs text-gray-400">{T("مبيعات كل فرع مقسمة على النقد والشبكة والتوصيل", "Branch sales split by cash, network & delivery")}</p>
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

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
          <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}
            className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">{T("كل العلامات", "All Brands")}</option>
            {(Array.isArray(brands) ? brands : []).map((b) => <option key={b.id} value={b.slug || String(b.id)}>{b.name}</option>)}
          </select>
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}
            className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">{T("كل الفروع", "All Branches")}</option>
            {(Array.isArray(branches) ? branches : []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <div className="flex items-center gap-1 col-span-2">
            <Calendar className="h-4 w-4 text-gray-500 shrink-0" />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 bg-[#161b27] border border-white/10 rounded-lg px-2 py-2 text-sm text-white" />
            <span className="text-gray-500 text-xs">→</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 bg-[#161b27] border border-white/10 rounded-lg px-2 py-2 text-sm text-white" />
          </div>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as "branch" | "date")}
            className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
            <option value="date">{T("تفصيل يومي", "Daily Detail")}</option>
            <option value="branch">{T("تجميع بالفرع", "By Branch")}</option>
          </select>
        </div>
      </div>

      <div className="px-4 md:px-6 pt-4 space-y-4">
        {/* KPI Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="md:col-span-2 bg-[#161b27] border border-emerald-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">{T("إجمالي المبيعات", "Total Sales")}</span>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-bold font-mono text-emerald-400">{fmt(grandTotal)}</p>
            <p className="text-xs text-gray-500 mt-1">{rows.length} {T("سجل", "records")} | {T("ضريبة:", "VAT:")} {fmt(totalTax)}</p>
          </div>
          {[
            { label: T("نقد", "Cash"), val: totalCash, icon: Banknote, color: "text-amber-400" },
            { label: T("شبكة", "Network"), val: totalNetwork, icon: CreditCard, color: "text-blue-400" },
            { label: T("توصيل", "Delivery"), val: totalDelivery, icon: Truck, color: "text-purple-400" },
          ].map(({ label, val, icon: Icon, color }) => (
            <div key={label} className="bg-[#161b27] border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">{label}</span>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <p className={`text-xl font-bold font-mono ${color}`}>{fmt(val)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {grandTotal > 0 ? ((val / grandTotal) * 100).toFixed(1) : "0"}%
              </p>
            </div>
          ))}
        </div>

        {/* Channels Progress Bar */}
        {grandTotal > 0 && (
          <div className="bg-[#161b27] border border-white/10 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-3">{T("توزيع قنوات الدفع", "Payment Channel Distribution")}</p>
            <div className="flex rounded-full overflow-hidden h-4">
              <div className="bg-amber-400 transition-all" style={{ width: `${(totalCash / grandTotal) * 100}%` }} title={T("نقد", "Cash")} />
              <div className="bg-blue-400 transition-all" style={{ width: `${(totalNetwork / grandTotal) * 100}%` }} title={T("شبكة", "Network")} />
              <div className="bg-purple-400 transition-all" style={{ width: `${(totalDelivery / grandTotal) * 100}%` }} title={T("توصيل", "Delivery")} />
            </div>
            <div className="flex gap-4 mt-2 text-xs text-gray-400">
              <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 me-1" />{T("نقد", "Cash")} {grandTotal > 0 ? ((totalCash / grandTotal) * 100).toFixed(1) : 0}%</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-blue-400 me-1" />{T("شبكة", "Network")} {grandTotal > 0 ? ((totalNetwork / grandTotal) * 100).toFixed(1) : 0}%</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-purple-400 me-1" />{T("توصيل", "Delivery")} {grandTotal > 0 ? ((totalDelivery / grandTotal) * 100).toFixed(1) : 0}%</span>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-[#161b27] border border-white/10 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{T("لا توجد بيانات مبيعات في هذه الفترة", "No sales data for this period")}</p>
              <p className="text-xs mt-1 text-gray-600">{T("تأكد من وجود إقفالات شفت معتمدة", "Check that submitted shift closings exist")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1e2533] text-xs text-gray-400 uppercase">
                    {groupBy === "date" && <th className="px-4 py-3 text-start">{T("التاريخ", "Date")}</th>}
                    <th className="px-4 py-3 text-start">{T("الفرع", "Branch")}</th>
                    <th className="px-4 py-3 text-end">{T("نقد", "Cash")}</th>
                    <th className="px-4 py-3 text-end">{T("شبكة", "Network")}</th>
                    <th className="px-4 py-3 text-end">{T("توصيل", "Delivery")}</th>
                    <th className="px-4 py-3 text-end">{T("الضريبة", "VAT")}</th>
                    <th className="px-4 py-3 text-end font-bold">{T("الإجمالي", "Gross Total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((r, idx) => (
                    <tr key={idx} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                      {groupBy === "date" && (
                        <td className="px-4 py-3 text-gray-300 text-xs">{fmtDate(r.date)}</td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                          <span className="font-medium">{r.branch_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-end font-mono text-amber-300">{fmt(r.cash_total)}</td>
                      <td className="px-4 py-3 text-end font-mono text-blue-300">{fmt(r.network_total)}</td>
                      <td className="px-4 py-3 text-end font-mono text-purple-300">{fmt(r.delivery_total)}</td>
                      <td className="px-4 py-3 text-end font-mono text-gray-400 text-xs">{fmt(r.tax_amount)}</td>
                      <td className="px-4 py-3 text-end font-mono font-bold text-emerald-400">{fmt(r.gross_total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#1e2533] border-t border-white/10 font-bold text-sm">
                    {groupBy === "date" && <td className="px-4 py-3 text-gray-400">{T("الإجمالي", "Total")}</td>}
                    <td className="px-4 py-3 text-gray-400">{displayRows.length} {T("فرع", "branch(es)")}</td>
                    <td className="px-4 py-3 text-end font-mono text-amber-400">{fmt(totalCash)}</td>
                    <td className="px-4 py-3 text-end font-mono text-blue-400">{fmt(totalNetwork)}</td>
                    <td className="px-4 py-3 text-end font-mono text-purple-400">{fmt(totalDelivery)}</td>
                    <td className="px-4 py-3 text-end font-mono text-gray-400">{fmt(totalTax)}</td>
                    <td className="px-4 py-3 text-end font-mono text-emerald-400 text-lg">{fmt(grandTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-600 pb-4">{T("البيانات من إقفالات الشفت المعتمدة فقط", "Data from submitted shift closings only")}</p>
      </div>
    </div>
  );
}
