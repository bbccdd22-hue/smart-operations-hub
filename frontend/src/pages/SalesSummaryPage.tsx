/**
 * Sales Summary Report — Oracle legacy style (SALES view).
 * ملخص المبيعات حسب الفرع والمنتج (من ProductSale).
 * Supports URL params: from_date, to_date, branch_id (e.g. from Executive Dashboard drill-down).
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BarChart3, RefreshCw, TrendingUp } from "lucide-react";
import { fetchWithCsrf, API_BASE } from "../lib/api";

interface BranchRow {
  branch_id: number;
  branch_name: string;
  branch_name_ar: string;
  amount: number;
}
interface ProductRow {
  product_name: string;
  product_sku: string;
  amount: number;
}
interface SalesSummaryData {
  from_date: string;
  to_date: string;
  total_sales: number;
  by_branch: BranchRow[];
  by_product: ProductRow[];
}

export default function SalesSummaryPage() {
  const { i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const isRTL = i18n.language === "ar";
  const T = (ar: string, en: string) => (isRTL ? ar : en);

  const [fromDate, setFromDate] = useState(() => {
    const fromUrl = searchParams.get("from_date");
    if (fromUrl) return fromUrl;
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => {
    const toUrl = searchParams.get("to_date");
    if (toUrl) return toUrl;
    return new Date().toISOString().slice(0, 10);
  });
  const [branchIdParam, setBranchIdParam] = useState(() => searchParams.get("branch_id") ?? "");
  const [groupBy, setGroupBy] = useState<"branch" | "product">("branch");
  const [data, setData] = useState<SalesSummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        from_date: fromDate,
        to_date: toDate,
        group_by: groupBy,
      });
      if (branchIdParam.trim()) qs.set("branch_id", branchIdParam.trim());
      const res = await fetchWithCsrf(`${API_BASE}/dashboard/sales-summary/?${qs.toString()}`);
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setData(json);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fromUrl = searchParams.get("from_date");
    const toUrl = searchParams.get("to_date");
    const branchUrl = searchParams.get("branch_id");
    if (fromUrl) setFromDate(fromUrl);
    if (toUrl) setToDate(toUrl);
    if (branchUrl !== null) setBranchIdParam(branchUrl ?? "");
  }, [searchParams]);

  useEffect(() => {
    load();
  }, [fromDate, toDate, groupBy, branchIdParam]);

  const fmt = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="min-h-screen bg-[#0e1117] text-white p-4 md:p-6" dir={isRTL ? "rtl" : "ltr"}>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/30">
              <BarChart3 className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{T("ملخص المبيعات", "Sales Summary")}</h1>
              <p className="text-sm text-gray-400">{T("حسب الفرع والمنتج — مرجع Oracle SALES", "By branch & product — Oracle SALES style")}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
            <span className="text-gray-500">–</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as "branch" | "product")}
              className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
              <option value="branch">{T("حسب الفرع", "By branch")}</option>
              <option value="product">{T("حسب المنتج", "By product")}</option>
            </select>
            <button type="button" onClick={load} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {T("تحديث", "Refresh")}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-2xl bg-[#161b27] border border-white/10">
                <p className="text-xs text-gray-500 mb-1">{T("من", "From")} / {T("إلى", "To")}</p>
                <p className="text-sm font-medium text-white">{data.from_date} – {data.to_date}</p>
              </div>
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-amber-400" />
                <div>
                  <p className="text-xs text-amber-400/80">{T("إجمالي المبيعات", "Total Sales")}</p>
                  <p className="text-xl font-bold text-amber-400">{fmt(data.total_sales)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-[#161b27] border border-white/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 bg-[#1e2533]/50">
                <h2 className="font-semibold text-white">
                  {groupBy === "branch" ? T("المبيعات حسب الفرع", "Sales by Branch") : T("المبيعات حسب المنتج", "Sales by Product")}
                </h2>
              </div>
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                {groupBy === "branch" && data.by_branch.length > 0 && (
                  <table className="w-full text-sm">
                    <thead className="bg-[#1e2533] text-gray-400 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-start font-medium">#</th>
                        <th className="px-4 py-3 text-start font-medium">{T("الفرع", "Branch")}</th>
                        <th className="px-4 py-3 text-end font-medium">{T("المبلغ", "Amount")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {data.by_branch.map((row, i) => (
                        <tr key={row.branch_id} className="hover:bg-white/[0.02]">
                          <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                          <td className="px-4 py-2 text-white">{(isRTL ? row.branch_name_ar : row.branch_name) || row.branch_name}</td>
                          <td className="px-4 py-2 text-end font-mono text-amber-400">{fmt(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {groupBy === "product" && data.by_product.length > 0 && (
                  <table className="w-full text-sm">
                    <thead className="bg-[#1e2533] text-gray-400 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-start font-medium">#</th>
                        <th className="px-4 py-3 text-start font-medium">{T("المنتج", "Product")}</th>
                        <th className="px-4 py-3 text-end font-medium">{T("المبلغ", "Amount")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {data.by_product.map((row, i) => (
                        <tr key={`${row.product_sku}-${i}`} className="hover:bg-white/[0.02]">
                          <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                          <td className="px-4 py-2 text-white">{row.product_name || row.product_sku || "—"}</td>
                          <td className="px-4 py-2 text-end font-mono text-amber-400">{fmt(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {((groupBy === "branch" && data.by_branch.length === 0) || (groupBy === "product" && data.by_product.length === 0)) && (
                  <div className="p-12 text-center text-gray-500">
                    {T("لا توجد بيانات في الفترة المحددة", "No data for the selected period")}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
