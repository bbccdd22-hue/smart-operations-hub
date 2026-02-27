/**
 * كشف حساب مورد — Supplier Account Statement
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, Link } from "react-router-dom";
import { FileText, RefreshCw, Download, Printer, ArrowLeft } from "lucide-react";
import { fetchWithCsrf } from "../../lib/api";

interface Transaction {
  id: number;
  date: string;
  invoice_number: string;
  description: string;
  branch: string;
  amount: string;
  status: string;
  balance: string;
}

interface StatementData {
  supplier_id: number;
  supplier_name: string;
  supplier_name_ar: string;
  from_date: string | null;
  to_date: string | null;
  transactions: Transaction[];
  total_amount: string;
  closing_balance: string;
}

const fmt = (v: string) => {
  const n = parseFloat(v);
  if (isNaN(n)) return "0.00";
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function SupplierStatementPage() {
  const { supplierId } = useParams<{ supplierId: string }>();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const T = (ar: string, en: string) => (isRTL ? ar : en);

  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + "01";

  const [data, setData] = useState<StatementData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);

  const load = useCallback(async () => {
    if (!supplierId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);
      const res = await fetchWithCsrf(`/api/procurement/suppliers/${supplierId}/statement/?${params}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error(isRTL ? "المورد غير موجود" : "Supplier not found");
        throw new Error(`${res.status}`);
      }
      const d = await res.json();
      setData(d);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [supplierId, fromDate, toDate, isRTL]);

  useEffect(() => { load(); }, [load]);

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      [T("التاريخ", "Date"), T("رقم الفاتورة", "Invoice"), T("الفرع", "Branch"), T("المبلغ", "Amount"), T("الرصيد", "Balance")],
      ...data.transactions.map((t) => [t.date, t.invoice_number, t.branch, t.amount, t.balance]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `supplier-${supplierId}-statement.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0e1117] text-white" dir={isRTL ? "rtl" : "ltr"}>
      <style>{`@media print { .no-print{display:none!important} }`}</style>

      <div className="sticky top-0 z-10 bg-[#0e1117] border-b border-white/10 px-4 md:px-6 py-4 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <Link to="/suppliers/balances" className="p-2 rounded-lg bg-[#161b27] border border-white/10 text-gray-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="p-2 rounded-xl bg-blue-500/20 border border-blue-500/30">
              <FileText className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{T("كشف حساب مورد", "Supplier Statement")}</h1>
              <p className="text-xs text-gray-400">{data ? `${data.supplier_name_ar || data.supplier_name}` : supplierId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <>
                <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#161b27] border border-white/10 text-sm text-gray-400 hover:text-white">
                  <Download className="h-4 w-4" /> {T("تصدير", "Export")}
                </button>
                <button onClick={() => window.print()} className="p-2 rounded-lg bg-[#161b27] border border-white/10 text-gray-400 hover:text-white">
                  <Printer className="h-4 w-4" />
                </button>
              </>
            )}
            <button onClick={load} className="p-2 rounded-lg bg-[#161b27] border border-white/10 text-gray-400 hover:text-white">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs text-gray-400 mb-1">{T("من", "From")}</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{T("إلى", "To")}</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
          <button onClick={load} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg">
            {T("عرض", "View")}
          </button>
        </div>
      </div>

      <div className="px-4 md:px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-400" />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-red-400 mb-4">{error}</p>
            <Link to="/suppliers/balances" className="text-blue-400 hover:underline">{T("العودة للأرصدة", "Back to Balances")}</Link>
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 no-print">
              <div className="bg-[#161b27] border border-white/10 rounded-xl p-4">
                <p className="text-xs text-gray-400">{T("إجمالي الفواتير", "Total Invoices")}</p>
                <p className="text-xl font-bold font-mono text-blue-400">{fmt(data.total_amount)}</p>
              </div>
              <div className="bg-[#161b27] border border-white/10 rounded-xl p-4">
                <p className="text-xs text-gray-400">{T("الرصيد الختامي", "Closing Balance")}</p>
                <p className="text-xl font-bold font-mono text-emerald-400">{fmt(data.closing_balance)}</p>
              </div>
            </div>

            <div className="bg-[#161b27] border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1e2533] text-xs text-gray-400 uppercase">
                    <th className="px-4 py-3 text-start">{T("التاريخ", "Date")}</th>
                    <th className="px-4 py-3 text-start">{T("رقم الفاتورة", "Invoice")}</th>
                    <th className="px-4 py-3 text-start hidden md:table-cell">{T("الفرع", "Branch")}</th>
                    <th className="px-4 py-3 text-end">{T("المبلغ", "Amount")}</th>
                    <th className="px-4 py-3 text-end">{T("الرصيد", "Balance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-gray-500">{T("لا توجد حركات", "No transactions")}</td>
                    </tr>
                  ) : (
                    data.transactions.map((t) => (
                      <tr key={t.id} className="border-t border-white/5">
                        <td className="px-4 py-2.5 font-mono text-xs">{t.date}</td>
                        <td className="px-4 py-2.5">{t.invoice_number}</td>
                        <td className="px-4 py-2.5 hidden md:table-cell text-gray-400">{t.branch || "—"}</td>
                        <td className="px-4 py-2.5 text-end font-mono text-emerald-400">{fmt(t.amount)}</td>
                        <td className="px-4 py-2.5 text-end font-mono text-white">{fmt(t.balance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {data.transactions.length > 0 && (
                  <tfoot>
                    <tr className="bg-[#1e2533] border-t-2 border-white/20 font-semibold">
                      <td colSpan={4} className="px-4 py-3 text-gray-300">{T("الرصيد الختامي", "Closing Balance")}</td>
                      <td className="px-4 py-3 text-end text-emerald-400 font-mono">{fmt(data.closing_balance)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
