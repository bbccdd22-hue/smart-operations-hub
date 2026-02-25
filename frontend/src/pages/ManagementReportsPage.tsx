/**
 * قسم تقارير الإدارة – Multi-Brand Management Reports
 * أ- قوائم الدخل | ب- صافي المبيعات الإجمالي | ج- انحراف المبيعات
 * جميع الفلاتر تحتوي على "اختيار العلامة التجارية"
 */
import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { format, subMonths } from "date-fns";
import {
  fetchBrands,
  fetchBranches,
  fetchDashboardSummary,
  fetchDashboardChartData,
  type Brand,
  type Branch,
} from "../lib/api";
import ResponsiveFinancialTable from "../components/ResponsiveFinancialTable";
import type { FinancialTableColumn } from "../components/ResponsiveFinancialTable";
import UnifiedFilterSelect from "../components/UnifiedFilterSelect";
import UltimateDateRangePicker from "../components/UltimateDateRangePicker";

const REPORTS = [
  { id: "income", labelKey: "incomeStatements", labelAr: "قوائم الدخل", to: "/finance/income-statement" },
  { id: "net_sales", labelKey: "grossNetSales", labelAr: "صافي المبيعات الإجمالي" },
  { id: "sales_variance", labelKey: "salesVarianceReport", labelAr: "انحراف المبيعات" },
] as const;

function sar(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "SAR", minimumFractionDigits: 0 }).format(n);
}

export default function ManagementReportsPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<number | "">("");
  const [dateRange, setDateRange] = useState(() => {
    const to = new Date();
    const from = subMonths(to, 1);
    return { from, to };
  });
  const dateFrom = format(dateRange.from, "yyyy-MM-dd");
  const dateTo = format(dateRange.to, "yyyy-MM-dd");
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof fetchDashboardSummary>> | null>(null);
  const [chartData, setChartData] = useState<Awaited<ReturnType<typeof fetchDashboardChartData>> | null>(null);
  const [prevSummary, setPrevSummary] = useState<Awaited<ReturnType<typeof fetchDashboardSummary>> | null>(null);
  const [prevChartData, setPrevChartData] = useState<Awaited<ReturnType<typeof fetchDashboardChartData>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<"net_sales" | "sales_variance">("net_sales");

  useEffect(() => {
    fetchBrands().then(setBrands);
  }, []);

  useEffect(() => {
    if (!selectedBrand) {
      setBranches([]);
      setSelectedBranchId("");
      return;
    }
    fetchBranches(selectedBrand).then(setBranches);
  }, [selectedBrand]);

  const brandsParam = selectedBrand ? [selectedBrand] : undefined;
  const branchIdsParam = selectedBranchId ? [selectedBranchId] : undefined;
  const prevFrom = format(subMonths(new Date(dateFrom), 1), "yyyy-MM-dd");
  const prevTo = format(subMonths(new Date(dateTo), 1), "yyyy-MM-dd");

  useEffect(() => {
    setLoading(true);
    const chartParams = { date_from: dateFrom, date_to: dateTo, brands: brandsParam, branch_ids: branchIdsParam, report_type: "product_sales", include_all_products: true };
    const prevChartParams = { date_from: prevFrom, date_to: prevTo, brands: brandsParam, branch_ids: branchIdsParam, report_type: "product_sales", include_all_products: true };
    Promise.all([
      fetchDashboardSummary({ date_from: dateFrom, date_to: dateTo, brands: brandsParam, branch_ids: branchIdsParam }),
      fetchDashboardChartData(chartParams),
      fetchDashboardSummary({ date_from: prevFrom, date_to: prevTo, brands: brandsParam, branch_ids: branchIdsParam }),
      fetchDashboardChartData(prevChartParams),
    ])
      .then(([s, c, ps, pc]) => {
        setSummary(s);
        setChartData(c);
        setPrevSummary(ps);
        setPrevChartData(pc);
      })
      .catch(() => {
        setSummary(null);
        setChartData(null);
        setPrevSummary(null);
        setPrevChartData(null);
      })
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, selectedBrand, selectedBranchId]);

  const netSalesTotal = summary?.totals?.system_total_sales ?? summary?.financial_summary?.total_sales ?? 0;
  const prevNetSalesTotal = prevSummary?.totals?.system_total_sales ?? prevSummary?.financial_summary?.total_sales ?? 0;
  const netSalesVariance = netSalesTotal - prevNetSalesTotal;
  const netSalesVariancePct = prevNetSalesTotal > 0 ? (netSalesVariance / prevNetSalesTotal) * 100 : 0;

  const salesVarianceData = useMemo(() => {
    const current = chartData?.top_products ?? [];
    const prev = prevChartData?.top_products ?? [];
    const byKey = new Map<string, { name: string; sku?: string; current: number; previous: number; variance: number; variancePct: number }>();
    for (const p of current) {
      const key = (p.product_sku || p.product_name || "").trim() || p.product_name || "?";
      byKey.set(key, {
        name: p.product_name || key,
        sku: p.product_sku,
        current: p.sales ?? 0,
        previous: 0,
        variance: 0,
        variancePct: 0,
      });
    }
    for (const p of prev) {
      const key = (p.product_sku || p.product_name || "").trim() || p.product_name || "?";
      const existing = byKey.get(key);
      if (existing) {
        existing.previous = p.sales ?? 0;
        existing.variance = existing.current - existing.previous;
        existing.variancePct = existing.previous > 0 ? (existing.variance / existing.previous) * 100 : (existing.current > 0 ? 100 : 0);
      } else {
        byKey.set(key, {
          name: p.product_name || key,
          sku: p.product_sku,
          current: 0,
          previous: p.sales ?? 0,
          variance: -(p.sales ?? 0),
          variancePct: (p.sales ?? 0) > 0 ? -100 : 0,
        });
      }
    }
    return Array.from(byKey.values()).sort((a, b) => b.current - a.current);
  }, [chartData?.top_products, prevChartData?.top_products]);

  const netSalesByBrand = summary?.by_brand ?? [];
  const netSalesColumns: FinancialTableColumn[] = [
    { key: "shift__branch__brand__name", labelEn: "Brand", labelAr: "العلامة التجارية" },
    { key: "system_total_sales", labelEn: "Net Sales", labelAr: "صافي المبيعات", align: "right", render: (v) => <span className="font-semibold tabular-nums">{typeof v === "number" ? sar(v) : "—"}</span> },
    { key: "shifts", labelEn: "Shifts", labelAr: "الورديات", align: "right" },
  ];

  const varianceColumns: FinancialTableColumn[] = [
    { key: "name", labelEn: "Product", labelAr: "المنتج" },
    { key: "current", labelEn: "Current Month", labelAr: "الشهر الحالي", align: "right", render: (v) => <span className="tabular-nums">{typeof v === "number" ? sar(v) : "—"}</span> },
    { key: "previous", labelEn: "Previous Month", labelAr: "الشهر الماضي", align: "right", render: (v) => <span className="tabular-nums">{typeof v === "number" ? sar(v) : "—"}</span> },
    { key: "variance", labelEn: "Variance", labelAr: "الانحراف", align: "right", render: (v) => { const n = typeof v === "number" ? v : 0; return <span className={`tabular-nums font-semibold ${n >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{sar(n)}</span>; } },
    { key: "variancePct", labelEn: "%", labelAr: "%", align: "right", render: (v) => { const n = typeof v === "number" ? v : 0; return <span className={`tabular-nums ${n >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{n >= 0 ? "+" : ""}{n.toFixed(1)}%</span>; } },
  ];

  const netSalesTableData = netSalesByBrand.map((r) => ({
    "shift__branch__brand__name": r.shift__branch__brand__name ?? r.shift__branch__brand__slug ?? "",
    system_total_sales: r.system_total_sales ?? 0,
    shifts: r.shifts ?? 0,
  }));

  return (
    <div className="w-full space-y-6" style={{ fontFamily: "Inter, Lexend, Tajawal, system-ui, sans-serif" }}>
      <div>
        <Link to="/dashboard" className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">
          ← {isRTL ? "العودة للوحة التحكم" : "Back to Dashboard"}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
          {isRTL ? "تقارير الإدارة" : "Management Reports"}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isRTL ? "قوائم الدخل، صافي المبيعات، وانحراف المبيعات – حسب العلامة التجارية أو الكل" : "Income statements, gross net sales, sales variance – by brand or all"}
        </p>
      </div>

      {/* الفلاتر – ثابت في الأعلى */}
      <div className="filter-bar-sticky glass-card flex flex-wrap items-center gap-4 rounded-2xl p-4">
        <UnifiedFilterSelect
          mode="brand"
          items={brands}
          selected={selectedBrand}
          onChange={setSelectedBrand}
          selectionMode="single"
          label={isRTL ? "اختيار العلامة التجارية" : "Select Brand"}
          placeholder={isRTL ? "جميع العلامات" : "All Brands"}
        />
        <UnifiedFilterSelect
          mode="branch"
          items={branches}
          selected={selectedBranchId}
          onChange={setSelectedBranchId}
          selectionMode="single"
          label={isRTL ? "الفرع" : "Branch"}
          placeholder={isRTL ? "كل الفروع" : "All Branches"}
          disabled={!selectedBrand}
        />
        <UltimateDateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* روابط سريعة */}
      <div className="flex flex-wrap gap-2">
        <Link
          to="/finance/income-statement"
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          {isRTL ? "قوائم الدخل" : "Income Statements"}
        </Link>
        <button
          onClick={() => setActiveSection("net_sales")}
          className={`rounded-xl px-4 py-2 text-sm font-medium ${activeSection === "net_sales" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}
        >
          {isRTL ? "صافي المبيعات الإجمالي" : "Gross Net Sales"}
        </button>
        <button
          onClick={() => setActiveSection("sales_variance")}
          className={`rounded-xl px-4 py-2 text-sm font-medium ${activeSection === "sales_variance" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}
        >
          {isRTL ? "انحراف المبيعات" : "Sales Variance"}
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">Loading…</div>
      ) : (
        <>
          {activeSection === "net_sales" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="aqua-glass-card rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">{isRTL ? "صافي المبيعات الإجمالي" : "Gross Net Sales"}</h2>
                <div className="mt-4 flex flex-wrap gap-6">
                  <div>
                    <div className="text-xs text-slate-500">{isRTL ? "الفترة الحالية" : "Current Period"}</div>
                    <div className="text-2xl font-bold text-emerald-600">{sar(netSalesTotal)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">{isRTL ? "الفترة السابقة" : "Previous Period"}</div>
                    <div className="text-xl font-semibold text-slate-600 dark:text-slate-400">{sar(prevNetSalesTotal)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">{isRTL ? "الانحراف" : "Variance"}</div>
                    <div className={`text-xl font-semibold ${netSalesVariance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {netSalesVariance >= 0 ? "+" : ""}{sar(netSalesVariance)} ({netSalesVariancePct >= 0 ? "+" : ""}{netSalesVariancePct.toFixed(1)}%)
                    </div>
                  </div>
                </div>
              </div>
              <ResponsiveFinancialTable
                columns={netSalesColumns}
                data={netSalesTableData}
                emptyMessage={isRTL ? "لا توجد بيانات" : "No data"}
              />
            </motion.div>
          )}

          {activeSection === "sales_variance" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="aqua-glass-card rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">{isRTL ? "انحراف المبيعات – الشهر الحالي vs الماضي" : "Sales Variance – Current vs Previous Month"}</h2>
              <p className="mt-1 text-sm text-slate-500">{isRTL ? "مقارنة أداء المنتجات لكل علامة تجارية" : "Product performance comparison per brand"}</p>
              <div className="mt-4">
                <ResponsiveFinancialTable
                  columns={varianceColumns}
                  data={salesVarianceData}
                  emptyMessage={isRTL ? "لا توجد بيانات منتجات" : "No product data"}
                />
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
