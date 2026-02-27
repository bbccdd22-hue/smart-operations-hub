/**
 * أعمار الديون للموردين — Supplier Debt Aging
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Clock, RefreshCw, Download, Calendar, AlertTriangle,
} from "lucide-react";
import { fetchWithCsrf } from "../../lib/api";
import { fetchBrands, type Brand } from "../../lib/api";

interface AgingItem {
  supplier_id: number;
  supplier_name: string;
  invoice_number: string;
  invoice_date: string;
  amount: string;
  age_days: number;
}

interface Bucket {
  key: string;
  label: string;
  total: string;
  count: number;
  items: AgingItem[];
}

interface AgingData {
  as_of_date: string;
  buckets: Bucket[];
  grand_total: string;
}

const fmt = (v: string) => {
  const n = parseFloat(v);
  if (isNaN(n)) return "0.00";
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const BUCKET_COLORS: Record<string, string> = {
  "0_30": "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  "31_60": "bg-amber-500/10 border-amber-500/20 text-amber-400",
  "61_90": "bg-orange-500/10 border-orange-500/20 text-orange-400",
  "90_plus": "bg-red-500/10 border-red-500/20 text-red-400",
};

export default function SupplierDebtAgingPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const T = (ar: string, en: string) => (isRTL ? ar : en);

  const today = new Date().toISOString().slice(0, 10);

  const [data, setData] = useState<AgingData | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [brandFilter, setBrandFilter] = useState<string>("");
  const [asOfDate, setAsOfDate] = useState(today);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (brandFilter) params.set("brand_id", brandFilter);
      params.set("as_of_date", asOfDate);
      const res = await fetchWithCsrf(`/api/procurement/suppliers/debt-aging/?${params}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const d = await res.json();
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [brandFilter, asOfDate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetchBrands().then(setBrands).catch(() => {});
  }, []);

  const exportCSV = () => {
    if (!data) return;
    const lines: string[][] = [[T("الفترة", "Bucket"), T("المورد", "Supplier"), T("الفاتورة", "Invoice"), T("التاريخ", "Date"), T("العمر (يوم)", "Age"), T("المبلغ", "Amount")]];
    for (const b of data.buckets) {
      for (const it of b.items) {
        lines.push([b.label, it.supplier_name, it.invoice_number, it.invoice_date, String(it.age_days), it.amount]);
      }
    }
    const csv = lines.map((l) => l.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `supplier-debt-aging-${asOfDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0e1117] text-white" dir={isRTL ? "rtl" : "ltr"}>
      <div className="sticky top-0 z-10 bg-[#0e1117] border-b border-white/10 px-4 md:px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/30">
              <Clock className="h-5 w-5 text-rose-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{T("أعمار الديون للموردين", "Supplier Debt Aging")}</h1>
              <p className="text-xs text-gray-400">{T("تصنيف الاستحقاقات حسب عمر الفاتورة", "AP aging by invoice age")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} disabled={!data} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#161b27] border border-white/10 text-sm text-gray-400 hover:text-white disabled:opacity-50">
              <Download className="h-4 w-4" /> {T("تصدير", "Export")}
            </button>
            <button onClick={load} className="p-2 rounded-lg bg-[#161b27] border border-white/10 text-gray-400 hover:text-white">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">{T("اعتباراً من", "As of")}</label>
            <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)}
              className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
          <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}
            className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white self-end">
            <option value="">{T("كل العلامات", "All Brands")}</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="px-4 md:px-6 py-4 space-y-4">
        {data && (
          <div className="flex items-center justify-between p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-400" />
              <span className="text-sm text-gray-300">{T("إجمالي الاستحقاقات", "Total Payables")} ({data.as_of_date})</span>
            </div>
            <span className="text-2xl font-bold font-mono text-rose-400">{fmt(data.grand_total)}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 animate-spin text-rose-400" />
          </div>
        ) : data ? (
          data.buckets.map((b) => (
            <div key={b.key} className={`bg-[#161b27] border rounded-xl overflow-hidden ${BUCKET_COLORS[b.key] ? `border-current/20` : "border-white/10"}`}>
              <button
                className="w-full px-5 py-4 flex items-center justify-between text-start hover:bg-white/3 transition-colors"
                onClick={() => setExpanded(expanded === b.key ? null : b.key)}
              >
                <div className="flex items-center gap-3">
                  <span className={`font-semibold ${b.key === "90_plus" ? "text-red-400" : b.key === "61_90" ? "text-orange-400" : b.key === "31_60" ? "text-amber-400" : "text-emerald-400"}`}>
                    {b.label}
                  </span>
                  <span className="text-xs text-gray-500">({b.count} {T("فاتورة", "invoice(s)")})</span>
                </div>
                <span className="font-mono font-bold">{fmt(b.total)}</span>
              </button>
              {expanded === b.key && b.items.length > 0 && (
                <div className="border-t border-white/10 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 bg-[#1e2533]">
                        <th className="px-4 py-2 text-start">{T("المورد", "Supplier")}</th>
                        <th className="px-4 py-2 text-start">{T("الفاتورة", "Invoice")}</th>
                        <th className="px-4 py-2 text-start">{T("التاريخ", "Date")}</th>
                        <th className="px-4 py-2 text-center">{T("العمر", "Age")}</th>
                        <th className="px-4 py-2 text-end">{T("المبلغ", "Amount")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.items.map((it) => (
                        <tr key={`${it.supplier_id}-${it.invoice_number}`} className="border-t border-white/5 hover:bg-white/5">
                          <td className="px-4 py-2">{it.supplier_name}</td>
                          <td className="px-4 py-2 font-mono text-xs">{it.invoice_number}</td>
                          <td className="px-4 py-2">{it.invoice_date}</td>
                          <td className="px-4 py-2 text-center font-mono">{it.age_days} {T("يوم", "d")}</td>
                          <td className="px-4 py-2 text-end font-mono text-emerald-400">{fmt(it.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))
        ) : !loading ? (
          <div className="text-center py-16 text-gray-500">
            <Clock className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p>{T("لا توجد بيانات", "No data")}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
