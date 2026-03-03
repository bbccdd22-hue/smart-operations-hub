/**
 * مراجعة حركات المشتريات — Procurement Review Movements Report
 * تقرير تفصيلي للمراجعة والتدقيق مع ملخص حسب المورد
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardCheck, RefreshCw, Download, FileText, Package, Receipt, Truck, Users } from "lucide-react";
import { fetchWithCsrf } from "../../lib/api";
import { fetchBrands, fetchBranches, type Brand, type Branch } from "../../lib/api";

interface MovementRow {
  id: number;
  type: "invoice" | "order" | "receipt";
  type_display_ar: string;
  type_display_en: string;
  doc_number: string;
  doc_date: string;
  supplier_id: number;
  supplier_name: string;
  supplier_name_ar: string;
  branch_id: number;
  branch_name: string;
  amount: string;
  status: string;
  status_display: string;
  notes?: string;
}

interface SupplierSummary {
  supplier_id: number;
  supplier_name: string;
  supplier_name_ar: string;
  total: string;
}

const fmt = (v: string) => {
  const n = parseFloat(v);
  if (isNaN(n)) return "0.00";
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function TypeIcon({ type }: { type: string }) {
  if (type === "invoice") return <Receipt className="h-4 w-4 text-emerald-400" />;
  if (type === "order") return <FileText className="h-4 w-4 text-amber-400" />;
  if (type === "receipt") return <Truck className="h-4 w-4 text-blue-400" />;
  return <Package className="h-4 w-4 text-slate-400" />;
}

export default function ProcurementReviewMovementsPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const T = (ar: string, en: string) => (isRTL ? ar : en);

  const [rows, setRows] = useState<MovementRow[]>([]);
  const [summary, setSummary] = useState<SupplierSummary[]>([]);
  const [grandTotal, setGrandTotal] = useState("0");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: number; name: string; name_ar: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [brandFilter, setBrandFilter] = useState<string>("");
  const [branchFilter, setBranchFilter] = useState<string>("");
  const [supplierFilter, setSupplierFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("date_from", dateFrom);
      params.set("date_to", dateTo);
      if (brandFilter) params.set("brand_id", brandFilter);
      if (branchFilter) params.set("branch_id", branchFilter);
      if (supplierFilter) params.set("supplier_id", supplierFilter);
      const res = await fetchWithCsrf(`/api/procurement/reports/review-movements/?${params}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const d = await res.json();
      setRows(d.movements || []);
      setSummary(d.summary_by_supplier || []);
      setGrandTotal(d.grand_total || "0");
    } catch {
      setRows([]);
      setSummary([]);
      setGrandTotal("0");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, brandFilter, branchFilter, supplierFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchBrands().then((r) => setBrands(Array.isArray(r) ? r : [])).catch(() => setBrands([]));
    fetchBranches().then((r) => setBranches(Array.isArray(r) ? r : [])).catch(() => setBranches([]));
    fetchWithCsrf("/api/procurement/suppliers/")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setSuppliers(Array.isArray(d) ? d : d.results || d.suppliers || []))
      .catch(() => setSuppliers([]));
  }, []);

  const exportCSV = () => {
    const headers = [
      T("نوع الحركة", "Movement Type"),
      T("رقم المستند", "Doc #"),
      T("التاريخ", "Date"),
      T("المورد", "Supplier"),
      T("الفرع", "Branch"),
      T("المبلغ", "Amount"),
      T("الحالة", "Status"),
    ];
    const lines = [
      headers,
      ...rows.map((r) => [
        isRTL ? r.type_display_ar : r.type_display_en,
        r.doc_number,
        r.doc_date,
        isRTL ? r.supplier_name_ar || r.supplier_name : r.supplier_name,
        r.branch_name,
        r.amount,
        r.status_display,
      ]),
    ];
    const csv = lines.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `procurement-review-movements-${dateFrom}-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusColor = (status: string) => {
    if (status === "posted" || status === "confirmed" || status === "received") return "text-emerald-400";
    if (status === "draft" || status === "sent") return "text-amber-400";
    if (status === "cancelled" || status === "rejected") return "text-red-400";
    return "text-slate-400";
  };

  return (
    <div className={`min-h-screen bg-[#0e1117] text-slate-200 ${isRTL ? "rtl" : "ltr"}`} dir={isRTL ? "rtl" : "ltr"}>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-800/60">
              <ClipboardCheck className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">
                {T("مراجعة حركات المشتريات", "Procurement Review Movements")}
              </h1>
              <p className="text-slate-400 text-sm">
                {T("تقرير تفصيلي للمراجعة والتدقيق", "Detailed review and audit report")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {T("تحديث", "Refresh")}
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <Download className="h-4 w-4" />
              {T("تصدير CSV", "Export CSV")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-6 p-4 rounded-xl bg-slate-800/40 border border-slate-700/60">
          <div>
            <label className="block text-xs text-slate-400 mb-1">{T("من تاريخ", "From Date")}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">{T("إلى تاريخ", "To Date")}</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">{T("العلامة", "Brand")}</label>
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-200 text-sm"
            >
              <option value="">{T("الكل", "All")}</option>
              {(Array.isArray(brands) ? brands : []).map((b) => (
                <option key={b.id} value={String(b.id)}>{isRTL ? b.name_ar || b.name : b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">{T("الفرع", "Branch")}</label>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-200 text-sm"
            >
              <option value="">{T("الكل", "All")}</option>
              {(Array.isArray(branches) ? branches : []).map((b) => (
                <option key={b.id} value={String(b.id)}>{isRTL ? b.name_ar || b.name : b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">{T("المورد", "Supplier")}</label>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-200 text-sm"
            >
              <option value="">{T("الكل", "All")}</option>
              {(Array.isArray(suppliers) ? suppliers : []).map((s) => (
                <option key={s.id} value={String(s.id)}>{isRTL ? s.name_ar || s.name : s.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          <div className="lg:col-span-1">
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-amber-500" />
                <h3 className="font-medium text-white">{T("ملخص حسب المورد", "Summary by Supplier")}</h3>
              </div>
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {summary.length === 0 && !loading && (
                  <p className="text-slate-500 text-sm">{T("لا توجد بيانات", "No data")}</p>
                )}
                {summary.map((s) => (
                  <div key={s.supplier_id} className="flex justify-between items-center py-2 border-b border-slate-700/40">
                    <span className="text-slate-300 text-sm truncate max-w-[60%]">
                      {isRTL ? s.supplier_name_ar || s.supplier_name : s.supplier_name}
                    </span>
                    <span className="text-emerald-400 font-medium text-sm">{fmt(s.total)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-600">
                <div className="flex justify-between font-semibold text-white">
                  <span>{T("الإجمالي", "Grand Total")}</span>
                  <span className="text-amber-400">{fmt(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-3">
            <div className="rounded-xl border border-slate-700/60 overflow-hidden bg-slate-800/30">
              {loading ? (
                <div className="p-12 text-center text-slate-400">{T("جاري التحميل...", "Loading...")}</div>
              ) : rows.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  {T("لا توجد حركات في الفترة المحددة", "No movements in the selected period")}
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-800/80 z-10">
                      <tr className="border-b border-slate-700/60">
                        <th className="text-left p-3 font-medium text-slate-400">{T("النوع", "Type")}</th>
                        <th className="text-left p-3 font-medium text-slate-400">{T("رقم المستند", "Doc #")}</th>
                        <th className="text-left p-3 font-medium text-slate-400">{T("التاريخ", "Date")}</th>
                        <th className="text-left p-3 font-medium text-slate-400">{T("المورد", "Supplier")}</th>
                        <th className="text-left p-3 font-medium text-slate-400">{T("الفرع", "Branch")}</th>
                        <th className="text-right p-3 font-medium text-slate-400">{T("المبلغ", "Amount")}</th>
                        <th className="text-left p-3 font-medium text-slate-400">{T("الحالة", "Status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={`${r.type}-${r.id}`} className="border-b border-slate-700/40 hover:bg-slate-700/20">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <TypeIcon type={r.type} />
                              <span>{isRTL ? r.type_display_ar : r.type_display_en}</span>
                            </div>
                          </td>
                          <td className="p-3 font-mono text-slate-300">{r.doc_number}</td>
                          <td className="p-3 text-slate-300">{r.doc_date}</td>
                          <td className="p-3 text-slate-300">
                            {isRTL ? r.supplier_name_ar || r.supplier_name : r.supplier_name}
                          </td>
                          <td className="p-3 text-slate-300">{r.branch_name}</td>
                          <td className="p-3 text-right font-medium text-emerald-400">{fmt(r.amount)}</td>
                          <td className="p-3"><span className={statusColor(r.status)}>{r.status_display}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
