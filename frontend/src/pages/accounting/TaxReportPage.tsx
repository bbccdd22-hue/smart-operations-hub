/**
 * الإقرار الضريبي — Tax Report
 * تقرير ضريبة القيمة المضافة (VAT) من بيانات المبيعات والمشتريات.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Receipt, RefreshCw, AlertCircle, Download, Printer,
  TrendingUp, TrendingDown, DollarSign, Calendar,
} from "lucide-react";
import { fetchWithCsrf } from "../../lib/api";

interface TaxSummary {
  period: string;
  sales_excl_tax: number;
  sales_tax: number;
  purchase_excl_tax: number;
  purchase_tax: number;
  net_tax: number;
  status: "payable" | "refundable" | "zero";
}

const fmt = (n: number) =>
  n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TAX_RATE = 0.15;

export default function TaxReportPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const T = (ar: string, en: string) => (isRTL ? ar : en);

  const today = new Date().toISOString().slice(0, 10);
  const quarter = (() => {
    const m = new Date().getMonth();
    const q = Math.floor(m / 3);
    const y = new Date().getFullYear();
    const starts = [`${y}-01-01`, `${y}-04-01`, `${y}-07-01`, `${y}-10-01`];
    const ends   = [`${y}-03-31`, `${y}-06-30`, `${y}-09-30`, `${y}-12-31`];
    return { from: starts[q], to: ends[q] };
  })();

  const [fromDate, setFromDate] = useState(quarter.from);
  const [toDate, setToDate]     = useState(quarter.to);
  const [summary, setSummary]   = useState<TaxSummary | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      /* Use daily reconciliation endpoint as proxy for sales data */
      const qs = new URLSearchParams({ from_date: fromDate, to_date: toDate }).toString();
      /* Try to get journal entries for VAT calculation */
      const res = await fetchWithCsrf(`/api/accounting/journal-entries/?from_date=${fromDate}&to_date=${toDate}&page_size=200`);
      if (!res.ok) throw new Error(`${res.status}`);
      const d = await res.json();

      /* Calculate VAT from journal entries — look for VAT/ضريبة accounts */
      let salesTax = 0, purchaseTax = 0, salesExcl = 0, purchaseExcl = 0;

      for (const entry of (d.entries || [])) {
        for (const line of (entry.lines || [])) {
          const name = (line.account_name || "").toLowerCase();
          const isVatSales    = /ضريبة.*مبيعات|vat.*sales|output.*vat/.test(name);
          const isVatPurchase = /ضريبة.*مشتريات|vat.*purchase|input.*vat/.test(name);
          const isSales       = /إيراد|مبيعات|revenue|sales/.test(name);
          const isPurchase    = /مشتريات|تكلفة|cost|purchase/.test(name);

          if (isVatSales)    salesTax    += parseFloat(line.credit || 0);
          if (isVatPurchase) purchaseTax += parseFloat(line.debit || 0);
          if (isSales)       salesExcl   += parseFloat(line.credit || 0);
          if (isPurchase)    purchaseExcl += parseFloat(line.debit || 0);
        }
      }

      /* If no VAT entries found, estimate from sales */
      if (salesTax === 0 && salesExcl > 0) salesTax = salesExcl * TAX_RATE;

      const net = salesTax - purchaseTax;
      setSummary({
        period: `${fromDate} — ${toDate}`,
        sales_excl_tax:   salesExcl,
        sales_tax:        salesTax,
        purchase_excl_tax:purchaseExcl,
        purchase_tax:     purchaseTax,
        net_tax:          net,
        status: net > 0.01 ? "payable" : net < -0.01 ? "refundable" : "zero",
      });
    } catch (e: unknown) {
      setError((e as Error).message || "فشل تحميل بيانات الضريبة");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-[#0e1117] text-white" dir={isRTL ? "rtl" : "ltr"}>
      <style>{`@media print { .no-print{display:none!important} }`}</style>

      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0e1117] border-b border-white/10 px-4 md:px-6 py-4 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/30">
              <Receipt className="h-5 w-5 text-rose-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{T("الإقرار الضريبي", "Tax Report")}</h1>
              <p className="text-xs text-gray-400">{T("تقرير ضريبة القيمة المضافة (VAT 15%)", "VAT Report (15%)")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 no-print">
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#161b27] border border-white/10 text-sm text-gray-400 hover:text-white transition-colors">
              <Printer className="h-4 w-4" /> {T("طباعة", "Print")}
            </button>
            <button onClick={load} className="p-2 rounded-lg bg-[#161b27] border border-white/10 text-gray-400 hover:text-white transition-colors">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Period filter */}
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-400 mb-1">{T("من تاريخ", "From")}</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{T("إلى تاريخ", "To")}</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500" />
          </div>
          {/* Quick period buttons */}
          <div className="flex gap-1.5">
            {["Q1", "Q2", "Q3", "Q4"].map((q, i) => {
              const y = new Date().getFullYear();
              const starts = [`${y}-01-01`, `${y}-04-01`, `${y}-07-01`, `${y}-10-01`];
              const ends   = [`${y}-03-31`, `${y}-06-30`, `${y}-09-30`, `${y}-12-31`];
              return (
                <button key={q} onClick={() => { setFromDate(starts[i]); setToDate(ends[i]); }}
                  className="px-3 py-2 rounded-lg bg-[#161b27] border border-white/10 text-xs text-gray-400 hover:text-white transition-colors">
                  {T(`ر${i+1}`, q)}
                </button>
              );
            })}
          </div>
          <button onClick={load}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium rounded-lg transition-colors">
            {T("عرض التقرير", "Generate")}
          </button>
        </div>
      </div>

      <div className="px-4 md:px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 animate-spin text-rose-400" />
            <span className="ms-3 text-gray-400">{T("جارٍ الحساب...", "Calculating...")}</span>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-400 mb-4">{error}</p>
            <button onClick={load} className="px-5 py-2 bg-rose-600 text-white rounded-xl text-sm">{T("إعادة المحاولة", "Retry")}</button>
          </div>
        ) : summary ? (
          <div className="space-y-6">

            {/* Status badge */}
            <div className={`flex items-center justify-between p-4 rounded-2xl border ${
              summary.status === "payable"
                ? "bg-red-500/10 border-red-500/20"
                : summary.status === "refundable"
                ? "bg-emerald-500/10 border-emerald-500/20"
                : "bg-gray-500/10 border-gray-500/20"
            }`}>
              <div>
                <p className="text-xs text-gray-400 mb-1">{T("الفترة الضريبية", "Tax Period")}</p>
                <p className="text-sm font-semibold text-white">{summary.period}</p>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-bold font-mono ${
                  summary.status === "payable" ? "text-red-400" : summary.status === "refundable" ? "text-emerald-400" : "text-gray-400"
                }`}>{fmt(summary.net_tax)}</p>
                <p className={`text-xs mt-0.5 ${
                  summary.status === "payable" ? "text-red-400" : summary.status === "refundable" ? "text-emerald-400" : "text-gray-500"
                }`}>
                  {summary.status === "payable" ? T("ضريبة مستحقة الدفع", "Tax Payable")
                    : summary.status === "refundable" ? T("ضريبة قابلة للاسترداد", "Tax Refundable")
                    : T("لا توجد ضريبة", "No Tax")}
                </p>
              </div>
            </div>

            {/* Sales section */}
            <div className="bg-[#161b27] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <h2 className="font-semibold text-sm text-emerald-400">{T("الضريبة على المبيعات (ضريبة مخرجات)", "Output VAT (Sales)")}</h2>
              </div>
              <div className="p-5 space-y-3">
                {[
                  { label: T("المبيعات قبل الضريبة", "Sales excl. tax"),  value: summary.sales_excl_tax  },
                  { label: T("ضريبة المبيعات (15%)", "Sales Tax (15%)"),   value: summary.sales_tax,  highlight: true },
                ].map(({ label, value, highlight }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <p className="text-sm text-gray-300">{label}</p>
                    <p className={`font-mono font-bold ${highlight ? "text-emerald-400 text-base" : "text-white"}`}>{fmt(value)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Purchases section */}
            <div className="bg-[#161b27] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 bg-blue-500/10 border-b border-blue-500/20 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-blue-400" />
                <h2 className="font-semibold text-sm text-blue-400">{T("الضريبة على المشتريات (ضريبة مدخلات)", "Input VAT (Purchases)")}</h2>
              </div>
              <div className="p-5 space-y-3">
                {[
                  { label: T("المشتريات قبل الضريبة", "Purchases excl. tax"), value: summary.purchase_excl_tax },
                  { label: T("ضريبة المشتريات (15%)", "Purchase Tax (15%)"),   value: summary.purchase_tax, highlight: true },
                ].map(({ label, value, highlight }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <p className="text-sm text-gray-300">{label}</p>
                    <p className={`font-mono font-bold ${highlight ? "text-blue-400 text-base" : "text-white"}`}>{fmt(value)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Net tax */}
            <div className={`border rounded-2xl p-5 ${
              summary.status === "payable"
                ? "bg-red-500/10 border-red-500/20"
                : summary.status === "refundable"
                ? "bg-emerald-500/10 border-emerald-500/20"
                : "bg-gray-500/10 border-gray-500/20"
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white mb-1">
                    {T("صافي الضريبة المستحقة", "Net Tax Due")}
                  </p>
                  <p className="text-xs text-gray-400">
                    {T("ضريبة المبيعات - ضريبة المشتريات", "Output VAT − Input VAT")}
                  </p>
                </div>
                <p className={`text-3xl font-bold font-mono ${
                  summary.status === "payable" ? "text-red-400"
                    : summary.status === "refundable" ? "text-emerald-400"
                    : "text-gray-400"
                }`}>{fmt(summary.net_tax)}</p>
              </div>
            </div>

            {/* Info note */}
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-400">
              <Receipt className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>{T(
                "يحسب هذا التقرير الضريبة من القيود المحاسبية المدخلة في النظام. للحصول على تقرير ضريبي دقيق، تأكد من إدخال جميع القيود الضريبية في قيد اليومية.",
                "This report calculates tax from journal entries in the system. For accurate tax reporting, ensure all tax entries are properly recorded in the journal."
              )}</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
