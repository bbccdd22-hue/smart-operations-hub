/**
 * محرك تقرير الأرباح والخسائر - نظام سيف المالي
 * [FIN-008] تحليل الـ 240 حساباً واستخراج الخلاصة المالية
 * Revenue (04) - Expenses (05) = Net Profit
 * فلاتر: العلامة، الفرع، المستوى من لوحة الإعدادات
 */
import { useEffect, useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { fetchChartAccounts, type ChartAccount } from "../../lib/api";
import { useOrgs } from "../../contexts/OrgsContext";
import { getBrandChartCodes } from "../../lib/brandChartMapping";
import { getBrandDisplayName, getBranchDisplayName } from "../../lib/localization";
import { applyParentChildAggregation } from "../../lib/chartAggregation";

function toNum(v: string | number | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

function formatAmount(n: number, isRTL: boolean): string {
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return isRTL ? `${s} ر.س` : `SAR ${s}`;
}

export default function ProfitLossReport() {
  const { i18n } = useTranslation();
  const { brands: orgBrands, branches: orgBranches, branchesByBrandId } = useOrgs();
  const isRTL = i18n.language === "ar";
  const lang = i18n.language;
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBrand, setFilterBrand] = useState<string | number>("all");
  const [filterBranch, setFilterBranch] = useState<string | number>("all");
  const [filterLevel, setFilterLevel] = useState<number>(5);
  const levelClamped = Math.min(5, Math.max(1, filterLevel));

  useEffect(() => {
    fetchChartAccounts()
      .then(setAccounts)
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  }, []);

  const selectedBrand = useMemo(
    () => (filterBrand !== "all" && typeof filterBrand === "number" ? orgBrands.find((b) => b.id === filterBrand) : null),
    [orgBrands, filterBrand]
  );
  const selectedBranch = useMemo(
    () => (filterBranch !== "all" && typeof filterBranch === "number" ? orgBranches.find((b) => b.id === filterBranch) : null),
    [orgBranches, filterBranch]
  );
  const brandOptions = useMemo(
    () => orgBrands.map((b) => ({ id: b.id, label: getBrandDisplayName(b, lang) })).sort((a, b) => a.label.localeCompare(b.label, "ar")),
    [orgBrands, lang]
  );
  const branchesForBrand = useMemo(
    () => (filterBrand !== "all" && typeof filterBrand === "number" ? (branchesByBrandId[filterBrand] ?? []) : orgBranches),
    [filterBrand, branchesByBrandId, orgBranches]
  );
  const branchOptions = useMemo(
    () => branchesForBrand.map((b) => ({ id: b.id, label: getBranchDisplayName(b, lang) })).sort((a, b) => a.label.localeCompare(b.label, "ar")),
    [branchesForBrand, lang]
  );
  const matchBrand = useCallback(
    (code: string) => {
      if (filterBrand === "all") return true;
      if (!selectedBrand) return false;
      const codes = getBrandChartCodes(selectedBrand);
      if (!codes) return false;
      return code.startsWith(codes.rev) || code.startsWith(codes.exp);
    },
    [filterBrand, selectedBrand]
  );
  const matchBranch = useCallback(
    (name: string, nameEn: string) => {
      if (filterBranch === "all") return true;
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
      if (typeof filterBranch === "string") {
        const br = filterBranch.toLowerCase();
        const brShort = br.startsWith("فرع ") ? br.slice(5) : br;
        return n.includes(br) || n.includes(brShort);
      }
      return false;
    },
    [filterBranch, selectedBranch]
  );

  const accountsSafe = Array.isArray(accounts) ? accounts : [];
  const revenueRaw = accountsSafe.filter(
    (a) => a.code?.startsWith("04") && (a.level ?? 5) <= levelClamped && matchBrand(a.code ?? "") && matchBranch(a?.name_ar ?? "", a?.name_en ?? "")
  );
  const expenseRaw = accountsSafe.filter(
    (a) => a.code?.startsWith("05") && (a.level ?? 5) <= levelClamped && matchBrand(a.code ?? "") && matchBranch(a?.name_ar ?? "", a?.name_en ?? "")
  );
  const revenueAccounts = applyParentChildAggregation(revenueRaw);
  const expenseAccounts = applyParentChildAggregation(expenseRaw);

  useEffect(() => {
    if (filterBrand !== "all" && typeof filterBrand === "number" && !orgBrands.some((b) => b.id === filterBrand)) setFilterBrand("all");
    if (filterBrand === "all") setFilterBranch("all");
    else if (filterBranch !== "all" && typeof filterBranch === "number" && !branchOptions.some((b) => b.id === filterBranch)) setFilterBranch("all");
  }, [filterBrand, filterBranch, orgBrands, branchOptions]);

  const totalRevenue = revenueAccounts.reduce((s, a) => s + toNum(a.balance), 0);
  const totalExpenses = expenseAccounts.reduce((s, a) => s + toNum(a.balance), 0);
  const netProfit = totalRevenue - totalExpenses;

  const expenseRows = expenseAccounts
    .filter((a) => toNum(a.balance) !== 0)
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((a) => ({
      ...a,
      amount: toNum(a.balance),
      pctOfRevenue: totalRevenue > 0 ? (toNum(a.balance) / totalRevenue) * 100 : 0,
    }));

  return (
    <div className="w-full space-y-6 print:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 print:flex-col print:items-start">
        <div>
          <Link
            to="/finance"
            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 print:hidden"
          >
            ← {isRTL ? "العودة للمركز المالي" : "Back to Finance Hub"}
          </Link>
          <div className="mt-1 text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            FIN-008
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
            {isRTL ? "تقرير الأرباح والخسائر" : "Profit & Loss Report"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isRTL
              ? "تحليل الإيرادات والمصاريف من دليل الحسابات"
              : "Revenue and expense analysis from chart of accounts"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl border border-[#00ffcc]/40 bg-white/5 px-4 py-2 text-sm font-medium text-[#00ffcc] transition hover:bg-[#00ffcc]/10 print:hidden"
        >
          {isRTL ? "🖨️ طباعة التقرير" : "🖨️ Print Report"}
        </button>
      </div>

      {/* فلاتر من لوحة الإعدادات */}
      <div className="rounded-2xl border border-[#10b981]/30 bg-white dark:bg-slate-800/50 p-4 mb-6 shadow-sm print:hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{isRTL ? "العلامة التجارية" : "Brand"}</label>
            <select
              value={String(filterBrand)}
              onChange={(e) => setFilterBrand(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="w-full rounded-lg border border-[#10b981]/40 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
            >
              <option value="all">{isRTL ? "الكل" : "All"}</option>
              {brandOptions.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{isRTL ? "الفرع" : "Branch"}</label>
            <select
              value={String(filterBranch)}
              onChange={(e) => setFilterBranch(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="w-full rounded-lg border border-[#10b981]/40 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
            >
              <option value="all">{isRTL ? "كافة الفروع" : "All Branches"}</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
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
                  {isRTL ? (n === 1 ? "المستوى الأول (الأصول/الخصوم)" : n === 2 ? "المستوى الثاني (رؤوس الأقلام)" : n === 3 ? "المستوى الثالث (الحسابات الرئيسية)" : n === 4 ? "المستوى الرابع (الحسابات الفرعية)" : "المستوى الخامس (التفصيل الدقيق)") : `Level ${n}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-12 text-center text-slate-400">
          {isRTL ? "جاري التحميل..." : "Loading..."}
        </div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-4 sm:grid-cols-3"
          >
            <div className="overflow-hidden rounded-xl border-0 bg-[#10b981] p-4 shadow-sm">
              <div className="flex justify-between items-center">
                <div>
                  <p className="mb-1 text-sm opacity-90">
                    {isRTL ? "إجمالي الإيرادات (04)" : "Total Revenue (04)"}
                  </p>
                  <h3 className="text-xl font-bold text-white" id="total-revenue">
                    {formatAmount(totalRevenue, isRTL)}
                  </h3>
                </div>
                <svg
                  className="h-10 w-10 opacity-50"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z" />
                </svg>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border-0 bg-red-600 p-4 shadow-sm">
              <div className="flex justify-between items-center">
                <div>
                  <p className="mb-1 text-sm opacity-90">
                    {isRTL ? "إجمالي المصاريف (05)" : "Total Expenses (05)"}
                  </p>
                  <h3 className="text-xl font-bold text-white" id="total-expenses">
                    {formatAmount(totalExpenses, isRTL)}
                  </h3>
                </div>
                <svg
                  className="h-10 w-10 opacity-50"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 14H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                </svg>
              </div>
            </div>

            <div
              className={`overflow-hidden rounded-xl border-0 p-4 shadow-sm ${
                netProfit >= 0 ? "bg-blue-600" : "bg-slate-700"
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="mb-1 text-sm opacity-90">
                    {isRTL ? "صافي الربح / الخسارة" : "Net Profit / Loss"}
                  </p>
                  <h3 className="text-xl font-bold text-white" id="net-profit">
                    {formatAmount(netProfit, isRTL)}
                  </h3>
                </div>
                <svg
                  className="h-10 w-10 opacity-50"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" />
                </svg>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="overflow-hidden rounded-2xl border border-[#00ffcc]/20 shadow-sm"
            style={{ background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(10px)" }}
          >
            <div className="flex flex-wrap justify-between items-center border-b border-white/10 bg-white/5 px-6 py-3">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-100">
                <svg className="h-5 w-5 text-[#00ffcc]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {isRTL ? "تحليل المصاريف التشغيلية" : "Operating Expenses Analysis"}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {isRTL ? "رقم الحساب" : "Account Code"}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {isRTL ? "البيان (الحساب التحليلي)" : "Description"}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {isRTL ? "المبلغ" : "Amount"}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {isRTL ? "النسبة من الإيراد" : "% of Revenue"}
                    </th>
                  </tr>
                </thead>
                <tbody id="p-l-details">
                  {expenseRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        {isRTL ? "لا توجد مصاريف مسجلة. قم برفع الأرصدة من الإكسل أولاً." : "No expenses recorded. Upload balances from Excel first."}
                      </td>
                    </tr>
                  ) : (
                    expenseRows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-white/5 transition hover:bg-white/5"
                      >
                        <td className="px-4 py-3 font-mono text-sm text-slate-300">{row.code}</td>
                        <td className="px-4 py-3 text-slate-200" dir="rtl">
                          {isRTL ? row.name_ar : row.name_en}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-200">
                          {row.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} ر.س
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400">
                          {row.pctOfRevenue.toFixed(1)}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white; }
          .dark { --tw-bg-opacity: 1; }
        }
      `}</style>
    </div>
  );
}
