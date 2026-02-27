/**
 * أرصدة الموردين — Supplier Balances
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Wallet, RefreshCw, Download, Search, TrendingUp } from "lucide-react";
import { fetchWithCsrf } from "../../lib/api";
import { fetchBrands, fetchBranches, type Brand, type Branch } from "../../lib/api";

interface BalanceRow {
  supplier_id: number;
  supplier_name: string;
  supplier_name_ar: string;
  brand_name: string;
  balance: string;
  invoices_count: number;
}

const fmt = (v: string) => {
  const n = parseFloat(v);
  if (isNaN(n)) return "0.00";
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function SupplierBalancesPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const T = (ar: string, en: string) => (isRTL ? ar : en);

  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [brandFilter, setBrandFilter] = useState<string>("");
  const [branchFilter, setBranchFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (brandFilter) params.set("brand_id", brandFilter);
      if (branchFilter) params.set("branch_id", branchFilter);
      const res = await fetchWithCsrf(`/api/procurement/suppliers/balances/?${params}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const d = await res.json();
      setRows(d.suppliers || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [brandFilter, branchFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetchBrands().then(setBrands).catch(() => {});
    fetchBranches().then(setBranches).catch(() => {});
  }, []);

  const filtered = search
    ? rows.filter((r) =>
        r.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
        (r.supplier_name_ar || "").includes(search)
      )
    : rows;

  const total = filtered.reduce((s, r) => s + parseFloat(r.balance), 0);

  const exportCSV = () => {
    const lines = [
      [T("المورد", "Supplier"), T("العلامة", "Brand"), T("الرصيد", "Balance"), T("عدد الفواتير", "Invoices")],
      ...filtered.map((r) => [isRTL ? r.supplier_name_ar || r.supplier_name : r.supplier_name, r.brand_name, r.balance, String(r.invoices_count)]),
    ];
    const csv = lines.map((l) => l.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "supplier-balances.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0e1117] text-white" dir={isRTL ? "rtl" : "ltr"}>
      <div className="sticky top-0 z-10 bg-[#0e1117] border-b border-white/10 px-4 md:px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
              <Wallet className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{T("أرصدة الموردين", "Supplier Balances")}</h1>
              <p className="text-xs text-gray-400">{T("استحقاقات الموردين حسب الفواتير المرحّلة", "Supplier AP from posted invoices")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#161b27] border border-white/10 text-sm text-gray-400 hover:text-white">
              <Download className="h-4 w-4" /> {T("تصدير", "Export")}
            </button>
            <button onClick={load} className="p-2 rounded-lg bg-[#161b27] border border-white/10 text-gray-400 hover:text-white">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={T("ابحث بالمورد...", "Search supplier...")}
              className="w-full bg-[#161b27] border border-white/10 rounded-lg py-2 px-3 ps-8 text-sm text-white" />
          </div>
          <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}
            className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">{T("كل العلامات", "All Brands")}</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}
            className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">{T("كل الفروع", "All Branches")}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="px-4 md:px-6 pt-4">
        <div className="bg-[#161b27] border border-white/10 rounded-xl p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            <span className="text-sm text-gray-400">{T("إجمالي الاستحقاقات", "Total Payables")}</span>
          </div>
          <span className="text-2xl font-bold font-mono text-emerald-400">{fmt(String(total))}</span>
        </div>

        <div className="bg-[#161b27] border border-white/10 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="h-6 w-6 animate-spin text-emerald-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Wallet className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>{T("لا توجد أرصدة", "No balances")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1e2533] text-xs text-gray-400 uppercase">
                    <th className="px-4 py-3 text-start">{T("المورد", "Supplier")}</th>
                    <th className="px-4 py-3 text-start">{T("العلامة", "Brand")}</th>
                    <th className="px-4 py-3 text-center">{T("عدد الفواتير", "Invoices")}</th>
                    <th className="px-4 py-3 text-end">{T("الرصيد", "Balance")}</th>
                    <th className="px-4 py-3 text-center w-20">{T("كشف", "Statement")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.supplier_id} className="border-t border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 font-medium">{isRTL ? r.supplier_name_ar || r.supplier_name : r.supplier_name}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-[#1e2533] text-gray-400 px-2 py-0.5 rounded">{r.brand_name}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-gray-400">{r.invoices_count}</td>
                      <td className="px-4 py-3 text-end font-mono text-emerald-400 font-semibold">{fmt(r.balance)}</td>
                      <td className="px-4 py-3 text-center">
                        <Link to={`/suppliers/statement/${r.supplier_id}`} className="text-blue-400 hover:text-blue-300 text-xs">
                          {T("كشف حساب", "Statement")}
                        </Link>
                      </td>
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
