/**
 * أوامر الشراء — Purchase Orders
 * عرض جميع أوامر الشراء مع الفلترة حسب المورد / الفرع / الحالة / التاريخ
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ShoppingCart, RefreshCw, Download, Search,
  CheckCircle, Truck, Clock, XCircle, PackageCheck,
} from "lucide-react";
import { fetchBrands, fetchBranches, type Brand, type Branch, fetchWithCsrf } from "../../lib/api";

interface PurchaseOrder {
  id: number;
  order_number: string;
  order_date: string;
  supplier_id: number;
  supplier_name: string;
  supplier_name_ar: string;
  branch_id: number;
  branch_name: string;
  brand_name: string;
  status: "draft" | "sent" | "partially_received" | "received" | "cancelled";
  status_display: string;
  lines_count: number;
  expected_delivery_date: string | null;
}

const STATUS_META: Record<string, { color: string; icon: React.ElementType }> = {
  draft:              { color: "text-gray-400  bg-gray-500/20",       icon: Clock },
  sent:               { color: "text-blue-400  bg-blue-500/20",       icon: Truck },
  partially_received: { color: "text-amber-400 bg-amber-500/20",      icon: PackageCheck },
  received:           { color: "text-emerald-400 bg-emerald-500/20",  icon: CheckCircle },
  cancelled:          { color: "text-red-400   bg-red-500/20",        icon: XCircle },
};

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short", day: "numeric" });
};

export default function PurchaseOrdersPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const T = (ar: string, en: string) => (isRTL ? ar : en);

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);

  const [brandFilter, setBrandFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (brandFilter) params.set("brand_id", brandFilter);
      if (branchFilter) params.set("branch_id", branchFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (search) params.set("search", search);
      const res = await fetchWithCsrf(`/api/procurement/orders/?${params}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const d = await res.json();
      setOrders(d.orders || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [brandFilter, branchFilter, statusFilter, dateFrom, dateTo, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetchBrands().then((r) => setBrands(Array.isArray(r) ? r : [])).catch(() => setBrands([]));
    fetchBranches().then((r) => setBranches(Array.isArray(r) ? r : [])).catch(() => setBranches([]));
  }, []);

  const countByStatus = (s: string) => orders.filter((o) => o.status === s).length;

  const exportCSV = () => {
    const headers = [T("رقم الأمر", "Order #"), T("التاريخ", "Date"), T("المورد", "Supplier"), T("الفرع", "Branch"), T("الحالة", "Status"), T("تاريخ التسليم", "Delivery")];
    const rows = orders.map((o) => [o.order_number, o.order_date, isRTL ? o.supplier_name_ar || o.supplier_name : o.supplier_name, o.branch_name, o.status_display, o.expected_delivery_date || "—"]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "purchase-orders.csv"; a.click();
  };

  return (
    <div className="min-h-screen bg-[#0e1117] text-white" dir={isRTL ? "rtl" : "ltr"}>
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-[#0e1117] border-b border-white/10 px-4 md:px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30">
              <ShoppingCart className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{T("أوامر الشراء", "Purchase Orders")}</h1>
              <p className="text-xs text-gray-400">{T("متابعة جميع أوامر الشراء الصادرة للموردين", "Track all purchase orders issued to suppliers")}</p>
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
              placeholder={T("رقم الأمر أو المورد...", "Order # or supplier...")}
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
            <option value="sent">{T("مرسل للمورد", "Sent")}</option>
            <option value="partially_received">{T("استلام جزئي", "Partial")}</option>
            <option value="received">{T("مستلم", "Received")}</option>
            <option value="cancelled">{T("ملغي", "Cancelled")}</option>
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
        </div>
      </div>

      <div className="px-4 md:px-6 pt-4 space-y-4">
        {/* Status Summary Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { key: "draft", ar: "مسودة", en: "Draft", color: "border-gray-500/30" },
            { key: "sent", ar: "مرسل", en: "Sent", color: "border-blue-500/30" },
            { key: "partially_received", ar: "جزئي", en: "Partial", color: "border-amber-500/30" },
            { key: "received", ar: "مستلم", en: "Received", color: "border-emerald-500/30" },
            { key: "cancelled", ar: "ملغي", en: "Cancelled", color: "border-red-500/30" },
          ].map(({ key, ar, en, color }) => {
            const meta = STATUS_META[key];
            const Icon = meta.icon;
            return (
              <button key={key} onClick={() => setStatusFilter(statusFilter === key ? "" : key)}
                className={`bg-[#161b27] border ${color} rounded-xl p-3 text-center transition-colors ${statusFilter === key ? "ring-2 ring-white/20" : ""}`}>
                <Icon className={`h-5 w-5 mx-auto mb-1 ${meta.color.split(" ")[0]}`} />
                <p className="text-lg font-bold font-mono">{countByStatus(key)}</p>
                <p className="text-xs text-gray-500">{T(ar, en)}</p>
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="bg-[#161b27] border border-white/10 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <RefreshCw className="h-8 w-8 animate-spin text-purple-400" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{T("لا توجد أوامر شراء", "No purchase orders found")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1e2533] text-xs text-gray-400 uppercase">
                    <th className="px-4 py-3 text-start">{T("رقم الأمر", "Order #")}</th>
                    <th className="px-4 py-3 text-start">{T("تاريخ الأمر", "Order Date")}</th>
                    <th className="px-4 py-3 text-start">{T("المورد", "Supplier")}</th>
                    <th className="px-4 py-3 text-start">{T("الفرع", "Branch")}</th>
                    <th className="px-4 py-3 text-center">{T("الأصناف", "Lines")}</th>
                    <th className="px-4 py-3 text-center">{T("تاريخ التسليم", "Delivery")}</th>
                    <th className="px-4 py-3 text-center">{T("الحالة", "Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((po) => {
                    const meta = STATUS_META[po.status] || STATUS_META.draft;
                    const Icon = meta.icon;
                    return (
                      <tr key={po.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-purple-300">{po.order_number}</td>
                        <td className="px-4 py-3 text-gray-300">{fmtDate(po.order_date)}</td>
                        <td className="px-4 py-3 font-medium">{isRTL ? po.supplier_name_ar || po.supplier_name : po.supplier_name}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-[#1e2533] text-gray-400 px-2 py-0.5 rounded">{po.branch_name}</span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-gray-300">{po.lines_count}</td>
                        <td className="px-4 py-3 text-center text-gray-400 text-xs">{fmtDate(po.expected_delivery_date)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${meta.color}`}>
                            <Icon className="h-3 w-3" />{po.status_display}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-600 pb-4">{T(`إجمالي النتائج: ${orders.length}`, `Total: ${orders.length}`)}</p>
      </div>
    </div>
  );
}
