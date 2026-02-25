/**
 * نظام سيف المالي – لوحة الرسومات البيانية التفاعلية
 * توزيع مبيعات البراندات، كفاءة التشغيل، هيكل التكاليف
 * مرتبطة بالفلاتر العلوية للبيانات الحركية
 * Route: /finance/charts-dashboard
 */
import { useEffect, useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { fetchChartAccounts, type ChartAccount } from "../../lib/api";
import { useDateRange } from "../../contexts/DateRangeContext";
import ReportDateFilter from "../../components/ReportDateFilter";
import UnifiedFilterSelect from "../../components/UnifiedFilterSelect";
import { useOrgs } from "../../contexts/OrgsContext";
import { getBrandChartCodes } from "../../lib/brandChartMapping";
import { getBrandDisplayName, getBranchDisplayName } from "../../lib/localization";
import { applyParentChildAggregation, getLeafAccounts } from "../../lib/chartAggregation";

const EMERALD = "#10b981";
const CHART_COLORS = [EMERALD, "#059669", "#047857", "#10b981", "#34d399", "#6ee7b7"];

function toNum(v: string | number | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

const LEVEL_LABELS_AR: Record<number, string> = {
  1: "المستوى الأول (الأصول/الخصوم)",
  2: "المستوى الثاني (رؤوس الأقلام)",
  3: "المستوى الثالث (الحسابات الرئيسية)",
  4: "المستوى الرابع (الحسابات الفرعية)",
  5: "المستوى الخامس (التفصيل الدقيق)",
};

export default function FinancialChartsDashboard() {
  const { i18n } = useTranslation();
  const { brands: orgBrands, branches: orgBranches, branchesByBrandId } = useOrgs();
  const isRTL = i18n.language === "ar";
  const lang = i18n.language;
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBrand, setFilterBrand] = useState<string | "">("");
  const [filterBranch, setFilterBranch] = useState<number | "">("");
  const [filterLevel, setFilterLevel] = useState<number>(3);
  const { dateFrom } = useDateRange();
  const filterDate = dateFrom.slice(0, 7);

  const accountsSafe = Array.isArray(accounts) ? accounts : [];
  const levelClamped = Math.min(5, Math.max(1, filterLevel));
  const selectedBrand = useMemo(
    () => (filterBrand ? orgBrands.find((b) => (b.slug ?? b.brand_code ?? String(b.id)) === filterBrand) : null),
    [orgBrands, filterBrand]
  );
  const selectedBranch = useMemo(
    () => (filterBranch !== "" ? orgBranches.find((b) => b.id === filterBranch) : null),
    [orgBranches, filterBranch]
  );
  const branchesForBrand = useMemo(
    () =>
      filterBrand && selectedBrand
        ? (branchesByBrandId[selectedBrand.id] ?? [])
        : orgBranches,
    [filterBrand, selectedBrand, branchesByBrandId, orgBranches]
  );
  const matchBrand = useCallback(
    (code: string) => {
      if (!filterBrand) return true;
      if (!selectedBrand) return false;
      const codes = getBrandChartCodes(selectedBrand);
      if (!codes) return false;
      return code.startsWith(codes.rev) || code.startsWith(codes.exp);
    },
    [filterBrand, selectedBrand]
  );
  const matchBranch = useCallback(
    (name: string, nameEn: string) => {
      if (filterBranch === "") return true;
      const n = (name + " " + nameEn).toLowerCase();
      if (selectedBranch) {
        const searchTerms = [
          selectedBranch.name_ar,
          selectedBranch.name,
          selectedBranch.branch_code,
          selectedBranch.code,
        ].filter(Boolean).map((s) => String(s).toLowerCase().trim());
        for (const t of searchTerms) {
          if (t && n.includes(t)) return true;
          const short = t.startsWith("فرع ") ? t.slice(5) : t;
          if (short && n.includes(short)) return true;
        }
      }
      return false;
    },
    [filterBranch, selectedBranch]
  );

  const revenueFiltered = useMemo(
    () =>
      accountsSafe.filter(
        (a) =>
          a?.code?.startsWith("04") &&
          (a?.level ?? 5) <= levelClamped &&
          matchBrand(a.code ?? "") &&
          matchBranch(a?.name_ar ?? "", a?.name_en ?? "")
      ),
    [accountsSafe, filterBrand, filterBranch, levelClamped, matchBrand, matchBranch]
  );
  const expenseFiltered = useMemo(
    () =>
      accountsSafe.filter(
        (a) =>
          a?.code?.startsWith("05") &&
          (a?.level ?? 5) <= levelClamped &&
          matchBrand(a.code ?? "") &&
          matchBranch(a?.name_ar ?? "", a?.name_en ?? "")
      ),
    [accountsSafe, filterBrand, filterBranch, levelClamped, matchBrand, matchBranch]
  );
  const revenueAggregated = useMemo(() => applyParentChildAggregation(revenueFiltered), [revenueFiltered]);
  const expenseAggregated = useMemo(() => applyParentChildAggregation(expenseFiltered), [expenseFiltered]);

  const brandSalesData = useMemo(() => {
    const revByBrand: Record<string, number> = {};
    for (const b of orgBrands) revByBrand[getBrandDisplayName(b, lang)] = 0;
    revenueAggregated.forEach((a) => {
      const code = a.code ?? "";
      for (const brand of orgBrands) {
        const bc = getBrandChartCodes(brand);
        if (bc && code.startsWith(bc.rev)) {
          const key = getBrandDisplayName(brand, lang);
          revByBrand[key] = (revByBrand[key] ?? 0) + toNum(a.balance);
          break;
        }
      }
    });
    return Object.entries(revByBrand).map(([name, value]) => ({ name, value }));
  }, [revenueAggregated, orgBrands, lang]);

  const costStructureData = useMemo(() => {
    const byParent: Record<string, number> = {};
    getLeafAccounts(expenseAggregated).forEach((a) => {
      const key = a.name_ar || a.name_en || a.code;
      byParent[key] = (byParent[key] || 0) + toNum(a.balance);
    });
    return Object.entries(byParent)
      .map(([name, value]) => ({ name: name.length > 25 ? name.slice(0, 22) + "..." : name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [expenseAggregated]);

  const totalRevenue = brandSalesData.reduce((s, d) => s + d.value, 0);
  const totalExpenses = expenseAggregated.reduce((s, a) => s + toNum(a.balance), 0);
  const netProfit = totalRevenue - totalExpenses;
  const efficiencyPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  useEffect(() => {
    fetchChartAccounts()
      .then((data) => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!filterBrand) setFilterBranch("");
    else if (filterBranch !== "" && !branchesForBrand.some((b) => b.id === filterBranch)) setFilterBranch("");
  }, [filterBrand, filterBranch, branchesForBrand]);

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/finance" className="text-sm font-medium text-[#10b981] hover:text-[#059669] dark:text-emerald-400">
            ← {isRTL ? "العودة للمركز المالي" : "Back to Finance Hub"}
          </Link>
          <div className="mt-1 text-xs font-medium uppercase tracking-wider text-[#10b981]">FIN-010</div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
            {isRTL ? "لوحة الرسومات البيانية" : "Financial Charts Dashboard"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isRTL ? "توزيع المبيعات، كفاءة التشغيل، هيكل التكاليف" : "Brand sales, efficiency, cost structure"}
          </p>
        </div>
      </div>

      {/* فلاتر علوية مرتبطة بالرسومات – من لوحة الإعدادات */}
      <div className="rounded-2xl border border-[#10b981]/30 bg-white dark:bg-slate-800/50 p-4 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{isRTL ? "العلامة التجارية" : "Brand"}</label>
            <UnifiedFilterSelect
              mode="brand"
              items={orgBrands}
              selected={filterBrand}
              onChange={setFilterBrand}
              selectionMode="single"
              placeholder={isRTL ? "الكل" : "All"}
              triggerClassName="w-full rounded-lg border border-[#10b981]/40 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{isRTL ? "الفرع" : "Branch"}</label>
            <UnifiedFilterSelect
              mode="branch"
              items={branchesForBrand}
              selected={filterBranch}
              onChange={setFilterBranch}
              selectionMode="single"
              placeholder={isRTL ? "كافة الفروع" : "All Branches"}
              triggerClassName="w-full rounded-lg border border-[#10b981]/40 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
              disabled={!!filterBrand && branchesForBrand.length === 0}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{isRTL ? "المستوى" : "Level"}</label>
            <select
              value={levelClamped}
              onChange={(e) => setFilterLevel(Math.min(5, Math.max(1, Number(e.target.value))))}
              className="w-full rounded-lg border border-[#10b981]/40 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {LEVEL_LABELS_AR[n] || (isRTL ? `المستوى ${n}` : `Level ${n}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{isRTL ? "الفترة" : "Period"}</label>
            <ReportDateFilter showComparison />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-12 text-center text-slate-400">{isRTL ? "جاري التحميل..." : "Loading..."}</div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* توزيع مبيعات البراندات */}
          <div className="rounded-2xl border border-[#10b981]/20 bg-white dark:bg-slate-800/50 p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold text-slate-800 dark:text-white">{isRTL ? "توزيع مبيعات البراندات" : "Brand Sales Distribution"}</h2>
            {brandSalesData.some((d) => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={brandSalesData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(1)}%`}
                  >
                    {brandSalesData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [(v ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 }), isRTL ? "المبلغ" : "Amount"]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-slate-500">{isRTL ? "لا توجد بيانات لعرضها" : "No data to display"}</div>
            )}
          </div>

          {/* كفاءة التشغيل */}
          <div className="rounded-2xl border border-[#10b981]/20 bg-white dark:bg-slate-800/50 p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold text-slate-800 dark:text-white">{isRTL ? "كفاءة التشغيل" : "Operational Efficiency"}</h2>
            <div className="space-y-4">
              <div className="flex justify-between rounded-xl bg-slate-100 dark:bg-slate-700/50 px-4 py-3">
                <span className="text-slate-600 dark:text-slate-400">{isRTL ? "هامش الربح الصافي %" : "Net Profit Margin %"}</span>
                <span className={`font-bold ${efficiencyPct >= 0 ? "text-[#10b981]" : "text-red-500"}`}>{efficiencyPct.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between rounded-xl bg-slate-100 dark:bg-slate-700/50 px-4 py-3">
                <span className="text-slate-600 dark:text-slate-400">{isRTL ? "إجمالي الإيرادات" : "Total Revenue"}</span>
                <span className="font-bold text-[#10b981]">{totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between rounded-xl bg-slate-100 dark:bg-slate-700/50 px-4 py-3">
                <span className="text-slate-600 dark:text-slate-400">{isRTL ? "إجمالي المصاريف" : "Total Expenses"}</span>
                <span className="font-bold text-red-500">{totalExpenses.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between rounded-xl bg-[#10b981]/10 border border-[#10b981]/30 px-4 py-3">
                <span className="text-slate-700 dark:text-slate-300 font-semibold">{isRTL ? "صافي الربح" : "Net Profit"}</span>
                <span className={`font-bold ${netProfit >= 0 ? "text-[#10b981]" : "text-red-500"}`}>{netProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* هيكل التكاليف */}
          <div className="lg:col-span-2 rounded-2xl border border-[#10b981]/20 bg-white dark:bg-slate-800/50 p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold text-slate-800 dark:text-white">{isRTL ? "هيكل التكاليف (أعلى 10 مصروفات)" : "Cost Structure (Top 10 Expenses)"}</h2>
            {costStructureData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={costStructureData} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" tickFormatter={(v) => v.toLocaleString()} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [(v ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 }), isRTL ? "المبلغ" : "Amount"]} />
                  <Bar dataKey="value" fill={EMERALD} radius={[0, 4, 4, 0]} name={isRTL ? "المبلغ" : "Amount"} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-slate-500">{isRTL ? "لا توجد بيانات مصاريف لعرضها" : "No expense data to display"}</div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
