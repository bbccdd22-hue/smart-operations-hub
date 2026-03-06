/**
 * فواتير الشراء — Purchase Invoices
 * عرض + فلترة + تصدير جميع فواتير المشتريات المرتبطة بالموردين
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  FileText, RefreshCw, Download, Search, CheckCircle,
  Clock, Filter, TrendingUp, TrendingDown, Edit, Send,
} from "lucide-react";
import {
  fetchBrands,
  fetchBranches,
  listPurchaseInvoices,
  postPurchaseInvoice,
  type Brand,
  type Branch,
  type PurchaseInvoiceListItem,
} from "../../lib/api";

const fmt = (v: string | number) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "0.00";
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (d: string) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", {
    year: "numeric", month: "short", day: "numeric",
  });
};

export default function PurchaseInvoicesPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const isRTL = i18n.language === "ar";
  const T = (ar: string, en: string) => (isRTL ? ar : en);

  const [invoices, setInvoices] = useState<PurchaseInvoiceListItem[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [postingId, setPostingId] = useState<number | null>(null);

  const [brandFilter, setBrandFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await listPurchaseInvoices({
        brand_id: brandFilter || undefined,
        branch_id: branchFilter || undefined,
        status: statusFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        search: search || undefined,
      });
      setInvoices(d.invoices || []);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [brandFilter, branchFilter, statusFilter, dateFrom, dateTo, search]);

  const handlePost = useCallback(async (id: number) => {
    setPostingId(id);
    try {
      await postPurchaseInvoice(id);
      await load();
    } catch {
      // error could be shown via toast/state
    } finally {
      setPostingId(null);
    }
  }, [load]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetchBrands().then((r) => setBrands(Array.isArray(r) ? r : [])).catch(() => setBrands([]));
    fetchBranches().then((r) => setBranches(Array.isArray(r) ? r : [])).catch(() => setBranches([]));
  }, []);

  const totalPosted = invoices.filter((i) => i.status === "posted").reduce((s, i) => s + parseFloat(i.total_amount || "0"), 0);
  const totalDraft = invoices.filter((i) => i.status === "draft").reduce((s, i) => s + parseFloat(i.total_amount || "0"), 0);

  const exportCSV = () => {
    const headers = [
      T("رقم الفاتورة", "Invoice #"),
      T("التاريخ", "Date"),
      T("المورد", "Supplier"),
      T("الفرع", "Branch"),
      T("المبلغ", "Amount"),
      T("الحالة", "Status"),
    ];
    const rows = invoices.map((i) => [
      i.invoice_number,
      i.invoice_date,
      isRTL ? i.supplier_name_ar || i.supplier_name : i.supplier_name,
      i.branch_name,
      i.total_amount,
      i.status_display || (i.status === "posted" ? T("مرحّل", "Posted") : T("مسودة", "Draft")),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `purchase-invoices-${dateFrom || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0e1117] text-white" dir={isRTL ? "rtl" : "ltr"}>
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-[#0e1117] border-b border-white/10 px-4 md:px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/20 border border-blue-500/30">
              <FileText className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{T("فواتير الشراء", "Purchase Invoices")}</h1>
              <p className="text-xs text-gray-400">
                {T("عرض وفلترة جميع فواتير المشتريات من الموردين", "View & filter all supplier purchase invoices")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/procurement/invoices/new")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"
            >
              <FileText className="h-4 w-4" /> {T("فاتورة جديدة", "New invoice")}
            </button>
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#161b27] border border-white/10 text-sm text-gray-400 hover:text-white transition-colors">
              <Download className="h-4 w-4" /> {T("تصدير CSV", "Export CSV")}
            </button>
            <button onClick={load}
              className="p-2 rounded-lg bg-[#161b27] border border-white/10 text-gray-400 hover:text-white transition-colors">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <div className="relative col-span-2 md:col-span-1">
            <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={T("بحث برقم الفاتورة أو المورد...", "Invoice # or supplier...")}
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
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">{T("كل الحالات", "All Statuses")}</option>
            <option value="draft">{T("مسودة", "Draft")}</option>
            <option value="posted">{T("مرحّل", "Posted")}</option>
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
        </div>
      </div>

      <div className="px-4 md:px-6 pt-4 space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-[#161b27] border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">{T("إجمالي الفواتير", "Total Invoices")}</span>
              <Filter className="h-4 w-4 text-gray-500" />
            </div>
            <p className="text-2xl font-bold font-mono">{invoices.length}</p>
          </div>
          <div className="bg-[#161b27] border border-blue-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">{T("مرحّل", "Posted")}</span>
              <TrendingUp className="h-4 w-4 text-blue-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-blue-400">{fmt(totalPosted)}</p>
            <p className="text-xs text-gray-500 mt-1">{invoices.filter((i) => i.status === "posted").length} {T("فاتورة", "invoice(s)")}</p>
          </div>
          <div className="bg-[#161b27] border border-amber-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">{T("مسودة", "Draft")}</span>
              <TrendingDown className="h-4 w-4 text-amber-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-amber-400">{fmt(totalDraft)}</p>
            <p className="text-xs text-gray-500 mt-1">{invoices.filter((i) => i.status === "draft").length} {T("فاتورة", "invoice(s)")}</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#161b27] border border-white/10 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{T("لا توجد فواتير للعرض", "No invoices found")}</p>
              <p className="text-xs mt-1">{T("تأكد من الفلاتر أو الفترة الزمنية", "Check filters or date range")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1e2533] text-xs text-gray-400 uppercase">
                    <th className="px-4 py-3 text-start">{T("رقم الفاتورة", "Invoice #")}</th>
                    <th className="px-4 py-3 text-start">{T("التاريخ", "Date")}</th>
                    <th className="px-4 py-3 text-start">{T("المورد", "Supplier")}</th>
                    <th className="px-4 py-3 text-start">{T("الفرع", "Branch")}</th>
                    <th className="px-4 py-3 text-end">{T("المبلغ", "Amount")}</th>
                    <th className="px-4 py-3 text-center">{T("الحالة", "Status")}</th>
                    <th className="px-4 py-3 text-center">{T("إجراءات", "Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-blue-300">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-gray-300">{fmtDate(inv.invoice_date)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{isRTL ? inv.supplier_name_ar || inv.supplier_name : inv.supplier_name}</div>
                        {isRTL && inv.supplier_name && inv.supplier_name_ar && inv.supplier_name !== inv.supplier_name_ar && (
                          <div className="text-xs text-gray-500">{inv.supplier_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-[#1e2533] text-gray-400 px-2 py-0.5 rounded">{inv.branch_name}</span>
                      </td>
                      <td className="px-4 py-3 text-end font-mono font-bold text-emerald-400">{fmt(inv.total_amount)}</td>
                      <td className="px-4 py-3 text-center">
                        {inv.status === "posted" ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                            <CheckCircle className="h-3 w-3" />{T("مرحّل", "Posted")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                            <Clock className="h-3 w-3" />{T("مسودة", "Draft")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/procurement/invoices/${inv.id}/edit`)}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#1e2533] border border-white/10 text-gray-300 hover:text-white text-xs"
                          >
                            <Edit className="h-3.5 w-3.5" /> {T("عرض/تعديل", "View/Edit")}
                          </button>
                          {inv.status === "draft" && (
                            <button
                              type="button"
                              onClick={() => handlePost(inv.id)}
                              disabled={postingId === inv.id}
                              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 text-xs disabled:opacity-50"
                            >
                              {postingId === inv.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                              {T("ترحيل", "Post")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-600 pb-4">{T(`إجمالي النتائج: ${invoices.length} فاتورة`, `Total: ${invoices.length} invoice(s)`)}</p>
      </div>
    </div>
  );
}
