/**
 * طلبات الشراء — Purchase Requests
 * عرض طلبات الشراء الداخلية مع متابعة الحالة (مسودة → مقدم → معتمد → أمر شراء)
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ClipboardList, RefreshCw, Download, Search,
  CheckCircle2, Clock, ThumbsDown, ArrowRightCircle, SendHorizonal,
} from "lucide-react";
import { fetchBrands, fetchBranches, type Brand, type Branch, fetchWithCsrf } from "../../lib/api";

interface PurchaseRequest {
  id: number;
  request_number: string;
  requested_at: string;
  branch_id: number;
  branch_name: string;
  brand_name: string;
  status: "draft" | "submitted" | "approved" | "rejected" | "converted";
  status_display: string;
  requested_by: string;
  lines_count: number;
  estimated_total: string;
  notes: string;
}

const STATUS_META: Record<string, { color: string; icon: React.ElementType; ring: string }> = {
  draft:     { color: "text-gray-400  bg-gray-500/20",      icon: Clock,              ring: "border-gray-500/30" },
  submitted: { color: "text-blue-400  bg-blue-500/20",      icon: SendHorizonal,      ring: "border-blue-500/30" },
  approved:  { color: "text-emerald-400 bg-emerald-500/20", icon: CheckCircle2,       ring: "border-emerald-500/30" },
  rejected:  { color: "text-red-400   bg-red-500/20",       icon: ThumbsDown,         ring: "border-red-500/30" },
  converted: { color: "text-purple-400 bg-purple-500/20",   icon: ArrowRightCircle,   ring: "border-purple-500/30" },
};

const fmt = (v: string | number) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDt = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("ar-SA-u-nu-latn", { dateStyle: "medium", timeStyle: "short" });
};

export default function PurchaseRequestsPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const T = (ar: string, en: string) => (isRTL ? ar : en);

  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
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
      const res = await fetchWithCsrf(`/api/procurement/requests/?${params}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const d = await res.json();
      setRequests(d.requests || []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [brandFilter, branchFilter, statusFilter, dateFrom, dateTo, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetchBrands().then((r) => setBrands(Array.isArray(r) ? r : [])).catch(() => setBrands([]));
    fetchBranches().then((r) => setBranches(Array.isArray(r) ? r : [])).catch(() => setBranches([]));
  }, []);

  const countByStatus = (s: string) => requests.filter((r) => r.status === s).length;

  const exportCSV = () => {
    const headers = [T("رقم الطلب", "Request #"), T("التاريخ", "Date"), T("الفرع", "Branch"), T("طالب بـ", "Requested By"), T("الأصناف", "Lines"), T("التقدير", "Estimated"), T("الحالة", "Status")];
    const rows = requests.map((r) => [r.request_number, fmtDt(r.requested_at), r.branch_name, r.requested_by, r.lines_count, r.estimated_total, r.status_display]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "purchase-requests.csv"; a.click();
  };

  return (
    <div className="min-h-screen bg-[#0e1117] text-white" dir={isRTL ? "rtl" : "ltr"}>
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-[#0e1117] border-b border-white/10 px-4 md:px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30">
              <ClipboardList className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{T("طلبات الشراء", "Purchase Requests")}</h1>
              <p className="text-xs text-gray-400">{T("متابعة طلبات الشراء الداخلية ودورة اعتمادها", "Internal purchase requests & approval workflow")}</p>
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
              placeholder={T("رقم الطلب أو طالب الشراء...", "Request # or requestor...")}
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
            <option value="submitted">{T("مقدم", "Submitted")}</option>
            <option value="approved">{T("معتمد", "Approved")}</option>
            <option value="rejected">{T("مرفوض", "Rejected")}</option>
            <option value="converted">{T("تحول لأمر شراء", "Converted")}</option>
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
        </div>
      </div>

      <div className="px-4 md:px-6 pt-4 space-y-4">
        {/* Status Summary */}
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {[
            { key: "draft",     ar: "مسودة",   en: "Draft" },
            { key: "submitted", ar: "مقدم",     en: "Submitted" },
            { key: "approved",  ar: "معتمد",    en: "Approved" },
            { key: "rejected",  ar: "مرفوض",    en: "Rejected" },
            { key: "converted", ar: "محوّل",    en: "Converted" },
          ].map(({ key, ar, en }) => {
            const meta = STATUS_META[key];
            const Icon = meta.icon;
            return (
              <button key={key} onClick={() => setStatusFilter(statusFilter === key ? "" : key)}
                className={`bg-[#161b27] border ${meta.ring} rounded-xl p-3 text-center transition-all ${statusFilter === key ? "ring-2 ring-white/20 scale-[1.02]" : "hover:border-white/20"}`}>
                <Icon className={`h-5 w-5 mx-auto mb-1 ${meta.color.split(" ")[0]}`} />
                <p className="text-xl font-bold font-mono">{countByStatus(key)}</p>
                <p className="text-xs text-gray-500">{T(ar, en)}</p>
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="bg-[#161b27] border border-white/10 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <RefreshCw className="h-8 w-8 animate-spin text-amber-400" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{T("لا توجد طلبات شراء", "No purchase requests found")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1e2533] text-xs text-gray-400 uppercase">
                    <th className="px-4 py-3 text-start">{T("رقم الطلب", "Request #")}</th>
                    <th className="px-4 py-3 text-start">{T("الوقت", "Date/Time")}</th>
                    <th className="px-4 py-3 text-start">{T("الفرع", "Branch")}</th>
                    <th className="px-4 py-3 text-start">{T("طالب الشراء", "Requestor")}</th>
                    <th className="px-4 py-3 text-center">{T("الأصناف", "Items")}</th>
                    <th className="px-4 py-3 text-end">{T("التقدير التقريبي", "Est. Total")}</th>
                    <th className="px-4 py-3 text-center">{T("الحالة", "Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((pr) => {
                    const meta = STATUS_META[pr.status] || STATUS_META.draft;
                    const Icon = meta.icon;
                    return (
                      <tr key={pr.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-amber-300">{pr.request_number}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{fmtDt(pr.requested_at)}</td>
                        <td className="px-4 py-3">
                          <div className="text-xs">{pr.branch_name}</div>
                          <div className="text-xs text-gray-500">{pr.brand_name}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-300">{pr.requested_by || "—"}</td>
                        <td className="px-4 py-3 text-center font-mono text-gray-300">{pr.lines_count}</td>
                        <td className="px-4 py-3 text-end font-mono text-emerald-400">
                          {parseFloat(pr.estimated_total) > 0 ? fmt(pr.estimated_total) : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${meta.color}`}>
                            <Icon className="h-3 w-3" />{pr.status_display}
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
        <p className="text-xs text-gray-600 pb-4">{T(`إجمالي: ${requests.length} طلب`, `Total: ${requests.length} request(s)`)}</p>
      </div>
    </div>
  );
}
