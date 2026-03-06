/**
 * نظام سيف المالي - قائمة الدخل (سويت بريد)
 * الدفعة (1): هيكل البيانات والحسابات التلقائية
 * الدفعة (2): تصميم واجهة قائمة الدخل (CSS & HTML)
 * الدفعة (3): كود بناء الجدول المالي وحساب النسب تلقائياً
 * محرك فلاتر: العلامة التجارية، الفرع، الشهر، مستوى العرض
 * [FIN-009] ربط البيانات بالواجهة – التقرير النهائي
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { useDateRange } from "../../contexts/DateRangeContext";
import ReportDateFilter from "../../components/ReportDateFilter";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { fetchChartAccounts, importChartBalances, logActivity, type ChartAccount } from "../../lib/api";
import { parseExcelToBalancesWithValidation, downloadSaifIncomeTemplate } from "../../lib/excelParser";
import { useNotifications } from "../../contexts/NotificationContext";
import { useOrgs } from "../../contexts/OrgsContext";
import UnifiedFilterSelect from "../../components/UnifiedFilterSelect";
import { getBrandChartCodes } from "../../lib/brandChartMapping";
import { getBrandDisplayName, getBranchDisplayName } from "../../lib/localization";
import { applyParentChildAggregation, validateAggregationMismatches } from "../../lib/chartAggregation";
import {
  loadLayout,
  saveLayout,
  getDisplayColumnOrder,
  getColumnWidth,
  getColumnLabel,
  type TemplateLayout,
} from "../../config/templateTableConfig";
import { TemplateLayoutToolbar } from "../../components/TemplateLayoutToolbar";

function toNum(v: string | number | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}


/** تنسيق الأرقام بالفاصل العشري (مثلاً: 109,622.00) – معالجة القيم الفارغة لضمان عدم حدوث خطأ رياضي */
function formatNumber(num: number | null | undefined): string {
  const n = num == null || Number.isNaN(num) ? 0 : Number(num);
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

/** مسميات المستويات بالعربية – من هيكلة الدليل المحاسبي */
const LEVEL_LABELS_AR: Record<number, string> = {
  1: "المستوى الأول (الأصول/الخصوم)",
  2: "المستوى الثاني (رؤوس الأقلام)",
  3: "المستوى الثالث (الحسابات الرئيسية)",
  4: "المستوى الرابع (الحسابات الفرعية)",
  5: "المستوى الخامس (التفصيل الدقيق)",
};

/** مصدر البراندات والفروع: لوحة الإعدادات فقط (Single Source of Truth) */

/** نظام الخط الأحمر – سقوف الميزانية للمصروفات (حساب → الحد الأقصى) – من الأكواد المخصصة */
const BUDGET_CEILINGS: Record<string, number> = {
  "051010101": 80000,
  "051010102": 80000,
  "051010103": 80000,
  "0510308": 15000,
  "0510314": 5000,
  "0510316": 10000,
  "0510317": 8000,
};

/** بيانات تجريبية (سويت بريد) – تُعرض عند عدم توفر بيانات من API */
const DEMO_INCOME_DATA: {
  revenue: { name: string; name_en: string; code: string; level: number; current: number; previous: number }[];
  expenses: { name: string; name_en: string; code: string; level: number; current: number; previous: number }[];
} = {
  revenue: [
    { name: "مبيعات - الفروع", name_en: "Branch Sales", code: "04101", level: 2, current: 109622, previous: 118686.13 },
    { name: "مبيعات - التطبيقات", name_en: "App Sales", code: "04102", level: 2, current: 6532.2, previous: 0 },
    { name: "مبيعات داخلية", name_en: "Internal Sales", code: "04103", level: 2, current: 107984.5, previous: 84393.5 },
    { name: "خصم ومردودات المبيعات", name_en: "Discounts & Returns", code: "04104", level: 2, current: 0, previous: 1825 },
  ],
  expenses: [
    { name: "مشتريات خامات ومواد", name_en: "Raw Materials", code: "05101", level: 2, current: 67241.4, previous: 60136.5 },
    { name: "مصروف أجور، رواتب - الادارة", name_en: "Salaries - Admin", code: "05103", level: 2, current: 6342.48, previous: 8157 },
  ],
};

interface StatementRow {
  name: string;
  nameEn: string;
  code: string;
  current: number;
  previous: number;
  currentPerc: number;
  prevPerc: number;
  diff: number;
  diffPerc: number;
  level?: string;
}

/** محرك الحسابات التلقائي - النسب المئوية والفروقات */
function calculateStatement(
  revenueItems: { name: string; name_en: string; code: string; level: number; current: number; previous: number }[],
  expenseItems: { name: string; name_en: string; code: string; level: number; current: number; previous: number }[]
) {
  const totalCurrentSales = revenueItems.reduce((s, i) => s + (Number(i.current) || 0), 0);
  const totalPrevSales = revenueItems.reduce((s, i) => s + (Number(i.previous) || 0), 0);

  const processedRevenue: StatementRow[] = revenueItems.map((item) => {
    const curr = Number(item.current) || 0;
    const prev = Number(item.previous) || 0;
    return {
    name: item.name || "",
    nameEn: item.name_en || "",
    code: item.code || "",
    level: LEVEL_LABELS_AR[item.level] || `المستوي ${item.level || 1}`,
    current: curr,
    previous: prev,
    currentPerc: totalCurrentSales !== 0 ? (curr / totalCurrentSales) * 100 : 0,
    prevPerc: totalPrevSales !== 0 ? (prev / totalPrevSales) * 100 : 0,
    diff: curr - prev,
    diffPerc: prev !== 0 ? ((curr - prev) / prev) * 100 : (curr !== 0 ? 100 : 0),
  };
  });

  const processedExpenses: StatementRow[] = expenseItems.map((item) => {
    const curr = Number(item.current) || 0;
    const prev = Number(item.previous) || 0;
    return {
    name: item.name || "",
    nameEn: item.name_en || "",
    code: item.code || "",
    level: LEVEL_LABELS_AR[item.level] || `المستوي ${item.level || 1}`,
    current: curr,
    previous: prev,
    currentPerc: totalCurrentSales !== 0 ? (curr / totalCurrentSales) * 100 : 0,
    prevPerc: totalPrevSales !== 0 ? (prev / totalPrevSales) * 100 : 0,
    diff: curr - prev,
    diffPerc: prev !== 0 ? ((curr - prev) / prev) * 100 : (curr !== 0 ? 100 : 0),
  };});

  const totalCurrentExp = expenseItems.reduce((s, i) => s + (Number(i.current) || 0), 0);
  const totalPrevExp = expenseItems.reduce((s, i) => s + (Number(i.previous) || 0), 0);
  const netCurrent = totalCurrentSales - totalCurrentExp;
  const netPrevious = totalPrevSales - totalPrevExp;

  return {
    processedRevenue,
    processedExpenses,
    totalCurrentSales,
    totalPrevSales,
    totalCurrentExp,
    totalPrevExp,
    netCurrent,
    netPrevious,
  };
}

export default function IncomeStatementPage() {
  const { i18n } = useTranslation();
  const { addToast } = useNotifications() ?? { addToast: () => {} };
  const { brands, branches, branchesByBrand, branchesByBrandId } = useOrgs();
  const orgBrands = Array.isArray(brands) ? brands : [];
  const orgBranches = Array.isArray(branches) ? branches : [];
  const isRTL = i18n.language === "ar";
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBrand, setFilterBrand] = useState<string | "">("");
  const [filterBranch, setFilterBranch] = useState<number | "">("");
  const { dateFrom } = useDateRange();
  const filterDate = dateFrom.slice(0, 7); // YYYY-MM للتوافق
  const [filterLevel, setFilterLevel] = useState<number>(2);
  const levelClamped = Math.min(5, Math.max(1, filterLevel));
  const [isUpdating, setIsUpdating] = useState(false);
  const [uploadInProgress, setUploadInProgress] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [aggregationMismatches, setAggregationMismatches] = useState<Array<{ code: string; name_ar: string; uploadedTotal: number; computedSum: number; diff: number }>>([]);
  const [budgetExceededCodes, setBudgetExceededCodes] = useState<Set<string>>(new Set());
  const [tableLayout, setTableLayout] = useState<TemplateLayout | null>(() =>
    loadLayout("income_statement")
  );
  const TEMPLATE_KEY = "income_statement";
  const displayColumnOrder = getDisplayColumnOrder(TEMPLATE_KEY, tableLayout, []);

  const handleLayoutChange = useCallback((layout: TemplateLayout) => {
    saveLayout(TEMPLATE_KEY, layout);
    setTableLayout(layout);
  }, []);

  const updateDynamicReport = () => {
    setIsUpdating(true);
    setTimeout(() => setIsUpdating(false), 600);
  };

  /** بوابة الرفع الذكية – يشترط تحديد البراند والفرع والفترة أولاً */
  const canUpload = !!filterBrand && filterBranch !== "" && !!filterDate;

  const processUploadFile = useCallback(
    async (file: File) => {
      if (!canUpload) {
        setUploadError(isRTL ? "يُشترط تحديد العلامة التجارية والفرع والفترة أولاً قبل الرفع" : "Please select Brand, Branch, and Period first before upload");
        return;
      }
      if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
        setUploadError(isRTL ? "يرجى اختيار ملف Excel أو CSV" : "Please select Excel or CSV file");
        return;
      }
      setUploadError(null);
      setAggregationMismatches([]);
      setUploadInProgress(true);
      try {
        const [chartAccounts, { balances: parsed, rows, nameErrors }] = await Promise.all([
          fetchChartAccounts(),
          parseExcelToBalancesWithValidation(file, orgBrands.flatMap((b) => {
            const ar = (b.name_ar ?? "").trim();
            const en = (b.name ?? "").trim();
            return [...(ar ? [ar] : []), ...(en ? [en] : [])];
          }), orgBranches.flatMap((b) => {
            const ar = (b.name_ar ?? "").trim();
            const en = (b.name ?? "").trim();
            return [...(ar ? [ar] : []), ...(en ? [en] : [])];
          })),
        ]);
        if (Object.keys(parsed).length === 0) {
          setUploadError(isRTL ? "لم يتم العثور على بيانات في الملف" : "No data found in file");
          return;
        }
        if (nameErrors.length > 0) {
          setUploadError(isRTL ? "أخطاء في المسميات:\n" + nameErrors.slice(0, 5).join("\n") + (nameErrors.length > 5 ? "\n…" : "") : "Name validation errors:\n" + nameErrors.slice(0, 5).join("\n"));
          return;
        }
        const mismatches = validateAggregationMismatches(parsed, chartAccounts);
        if (mismatches.length > 0) {
          setAggregationMismatches(mismatches);
          const msg = mismatches
            .map((m) =>
              isRTL
                ? `تنبيه: يوجد فرق في إجمالي حساب [${m.name_ar}] (${m.code}). المرفوع: ${m.uploadedTotal.toLocaleString()}، المجموع من التفاصيل: ${m.computedSum.toLocaleString()}، يرجى مراجعة المدخلات`
                : `Alert: Mismatch in account [${m.name_ar}] (${m.code}). Uploaded: ${m.uploadedTotal.toLocaleString()}, Sum of details: ${m.computedSum.toLocaleString()}. Please review inputs.`
            )
            .join("\n\n");
          setUploadError(msg);
          return;
        }
        await importChartBalances(parsed, {
          rows: rows?.map((r) => ({ code: r.code, account_name: r.account_name, amount: r.amount, description: r.description })),
          source_file: file?.name,
        });
        logActivity({
          action_type: "file_upload",
          page_path: "/finance/income-statement",
          file_name: file?.name ?? "",
          description: "رفع تقرير قائمة الدخل",
        });
        const updated = await fetchChartAccounts();
        setAccounts(updated);
        /* نظام الخط الأحمر – تنبيه عند تجاوز سقف الميزانية */
        const exceeded = new Set<string>();
        const accountsArr = Array.isArray(updated) ? updated : [];
        for (const a of accountsArr) {
          if (!a?.code?.startsWith("05")) continue;
          let ceiling: number | undefined = BUDGET_CEILINGS[a.code];
          if (ceiling == null) {
            for (let len = a.code.length - 1; len >= 2; len--) {
              const prefix = a.code.slice(0, len);
              if (BUDGET_CEILINGS[prefix] != null) {
                ceiling = BUDGET_CEILINGS[prefix];
                break;
              }
            }
          }
          if (ceiling != null && toNum(a.balance) > ceiling) {
            exceeded.add(a.code);
            addToast(
              isRTL ? "⚠️ تنبيه: تجاوز الميزانية" : "⚠️ Budget Overrun Alert",
              `${a.name_ar || a.name_en} (${a.code}): ${toNum(a.balance).toLocaleString()} > ${ceiling.toLocaleString()} ${isRTL ? "المحدد" : "ceiling"}`
            );
          }
        }
        setBudgetExceededCodes(exceeded);
        setAggregationMismatches([]);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploadInProgress(false);
      }
    },
    [isRTL, canUpload, addToast, orgBrands, orgBranches]
  );

  const currentMonth = format(new Date(), "MMMM yyyy", { locale: isRTL ? ar : undefined });
  const prevMonth = format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), "MMMM yyyy", { locale: isRTL ? ar : undefined });

  useEffect(() => {
    fetchChartAccounts()
      .then((data) => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  }, []);

  const accountsSafe = Array.isArray(accounts) ? accounts : [];

  /** القوائم: العرض بالأسماء العربية، التخزين البرمجي بالمعرفات (لا أكواد رقمية في الواجهة) */
  const selectedBrand = useMemo(
    () => (filterBrand ? orgBrands.find((b) => (b.slug ?? b.brand_code ?? String(b.id)) === filterBrand) : null),
    [orgBrands, filterBrand]
  );
  const selectedBranch = useMemo(
    () => (filterBranch !== "" ? orgBranches.find((b) => b.id === filterBranch) : null),
    [orgBranches, filterBranch]
  );
  const lang = i18n.language;
  const branchesForBrand = useMemo(
    () =>
      filterBrand && selectedBrand
        ? (Array.isArray(branchesByBrandId[selectedBrand.id]) ? branchesByBrandId[selectedBrand.id] : [])
        : orgBranches,
    [filterBrand, selectedBrand, branchesByBrandId, orgBranches]
  );

  useEffect(() => {
    if (filterBrand && !orgBrands.some((b) => (b.slug ?? b.brand_code ?? String(b.id)) === filterBrand)) {
      setFilterBrand("");
    }
    if (!filterBrand) {
      setFilterBranch("");
    } else if (filterBranch !== "" && !branchesForBrand.some((b) => b.id === filterBranch)) {
      setFilterBranch("");
    }
  }, [filterBrand, filterBranch, orgBrands, branchesForBrand]);

  const confirmSelectionText = `${!filterBrand ? (isRTL ? "الكل" : "All") : (selectedBrand ? getBrandDisplayName(selectedBrand, lang) : "")} - ${filterBranch === "" ? (isRTL ? "كافة الفروع" : "All Branches") : (selectedBranch ? getBranchDisplayName(selectedBranch, lang) : "")} - ${isRTL ? "فترة" : "Period"} ${filterDate}`;

  const hasApiData = accountsSafe.some((a) => a?.code?.startsWith("04") || a?.code?.startsWith("05"));
  const matchBrand = (code: string, isRevenue: boolean) => {
    if (!filterBrand) return true;
    if (!selectedBrand) return false;
    const codes = getBrandChartCodes(selectedBrand);
    if (!codes) return false;
    return isRevenue ? code.startsWith(codes.rev) : code.startsWith(codes.exp);
  };
  const matchBranch = (name: string, nameEn: string) => {
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
  };

  const revenueRaw =
    hasApiData
      ? accountsSafe.filter(
          (a) =>
            a?.code?.startsWith("04") &&
            (a?.level ?? 1) <= levelClamped &&
            matchBrand(a?.code ?? "", true) &&
            matchBranch(a?.name_ar ?? "", a?.name_en ?? "")
        )
      : [];
  const expenseRaw =
    hasApiData
      ? accountsSafe.filter(
          (a) =>
            a?.code?.startsWith("05") &&
            (a?.level ?? 1) <= levelClamped &&
            matchBrand(a?.code ?? "", false) &&
            matchBranch(a?.name_ar ?? "", a?.name_en ?? "")
        )
      : [];

  const revenueAggregated = hasApiData ? applyParentChildAggregation(revenueRaw) : [];
  const expenseAggregated = hasApiData ? applyParentChildAggregation(expenseRaw) : [];

  const revenueAccounts = hasApiData
    ? revenueAggregated.map((a) => ({
        name: a.name_ar,
        name_en: a.name_en,
        code: a.code,
        level: a.level,
        current: toNum(a?.balance),
        previous: 0,
      }))
    : DEMO_INCOME_DATA.revenue.filter((r) => r.level <= levelClamped);

  const expenseAccounts = hasApiData
    ? expenseAggregated.map((a) => ({
        name: a.name_ar,
        name_en: a.name_en,
        code: a.code,
        level: a.level,
        current: toNum(a?.balance),
        previous: 0,
      }))
    : DEMO_INCOME_DATA.expenses.filter((e) => e.level <= levelClamped);

  const {
    processedRevenue,
    processedExpenses,
    totalCurrentSales,
    totalPrevSales,
    totalCurrentExp,
    totalPrevExp,
    netCurrent,
    netPrevious,
  } = calculateStatement(revenueAccounts, expenseAccounts);

  const periodLabel = filterDate ? (() => {
    const [y, m] = filterDate.split("-").map(Number);
    const d = new Date(y, m - 1);
    return format(d, "MMMM yyyy", { locale: isRTL ? ar : undefined });
  })() : currentMonth;
  const prevPeriodLabel = filterDate ? (() => {
    const [y, m] = filterDate.split("-").map(Number);
    const d = new Date(y, m - 2);
    return format(d, "MMMM yyyy", { locale: isRTL ? ar : undefined });
  })() : prevMonth;

  const reportTitle = !filterBrand ? (isRTL ? "كافة العلامات" : "All Brands") : (selectedBrand ? getBrandDisplayName(selectedBrand, lang) : "");
  const metadata = {
    branch: filterBranch === "" ? (isRTL ? "كافة الفروع" : "All Branches") : (selectedBranch ? getBranchDisplayName(selectedBranch, lang) : ""),
    currentPeriod: periodLabel,
    previousPeriod: prevPeriodLabel,
    isDemo: !hasApiData,
    reportTitle,
    displayLevel: levelClamped,
    displayLevelLabel: LEVEL_LABELS_AR[levelClamped] || `المستوى ${levelClamped}`,
  };

  const performancePct =
    totalPrevSales !== 0 ? ((totalCurrentSales - totalPrevSales) / totalPrevSales) * 100 : 0;
  const performanceLabel =
    performancePct >= 0
      ? (isRTL ? "أداء إيجابي +" : "Positive +") + performancePct.toFixed(1) + "%"
      : (isRTL ? "أداء سلبي " : "Negative ") + performancePct.toFixed(1) + "%";

  const fmtPerc = (n: number, signed = false) =>
    signed && n > 0 ? `+${n.toFixed(1)}%` : `${n.toFixed(1)}%`;

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
            FIN-009
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
            {isRTL ? "قائمة الدخل" : "Income Statement"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {metadata.branch} · {metadata.currentPeriod}
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

      {/* محرك قوائم الدخل الديناميكي v2.0 – فلاتر ذكية، مستويات، مقارنة شهور، PDF */}
      <div id="financial-center-content" className="no-print">
        <div className="rounded-2xl border border-[#10b981]/30 bg-white dark:bg-slate-800/50 p-4 mb-6 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                {isRTL ? "العلامة التجارية" : "Brand"}
              </label>
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
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                {isRTL ? "الفرع" : "Branch"}
              </label>
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
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                {isRTL ? "المستوى" : "Level"}
              </label>
              <select
                id="levelSelect"
                value={levelClamped}
                onChange={(e) => setFilterLevel(Math.min(5, Math.max(1, Number(e.target.value))))}
                className="w-full rounded-lg border border-[#10b981]/40 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
              >
                <option value={1}>{isRTL ? "المستوى الأول (الأصول/الخصوم)" : "Level 1 (Assets/Liabilities)"}</option>
                <option value={2}>{isRTL ? "المستوى الثاني (رؤوس الأقلام)" : "Level 2 (Section heads)"}</option>
                <option value={3}>{isRTL ? "المستوى الثالث (الحسابات الرئيسية)" : "Level 3 (Main accounts)"}</option>
                <option value={4}>{isRTL ? "المستوى الرابع (الحسابات الفرعية)" : "Level 4 (Sub-accounts)"}</option>
                <option value={5}>{isRTL ? "المستوى الخامس (التفصيل الدقيق)" : "Level 5 (Detailed)"}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                {isRTL ? "الفترة" : "Period"}
              </label>
              <ReportDateFilter showComparison />
            </div>
          <div className="col-span-2 md:col-span-1 flex gap-2">
            <button
              type="button"
              onClick={updateDynamicReport}
              disabled={isUpdating}
              className="flex-1 rounded-lg bg-[#10b981] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#059669] disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {isUpdating ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {isRTL ? "جاري المعالجة..." : "Processing..."}
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {isRTL ? "تحديث التقرير" : "Update Report"}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border-2 border-slate-700 dark:border-slate-500 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              PDF
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* بوابة رفع تقارير قائمة الدخل */}
      <div id="upload-section-container" className="mt-6 print:hidden">
        <div className="overflow-hidden rounded-2xl border-0 shadow-sm">
          <div className="bg-slate-900 px-4 py-3 text-white">
            <h6 className="m-0 flex items-center gap-2 font-semibold">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {isRTL ? "بوابة رفع تقارير قائمة الدخل" : "Income Statement Upload Portal"}
            </h6>
          </div>
          <div className="p-4 bg-white dark:bg-slate-800">
            {/* نموذج الأعمدة المطلوبة */}
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-700/30">
              <p className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                {isRTL ? "الأعمدة المطلوبة:" : "Required columns:"}
              </p>
              <div className="flex flex-wrap gap-1 text-xs">
                <span className="rounded bg-white px-2 py-0.5 font-mono dark:bg-slate-800">{isRTL ? "كود الحساب" : "Code"}</span>
                <span className="rounded bg-white px-2 py-0.5 font-mono dark:bg-slate-800">{isRTL ? "اسم الحساب" : "Name"}</span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 font-mono text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">{isRTL ? "رصيد/المبلغ" : "Balance/Amount"}</span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-500 line-through dark:bg-slate-600 dark:text-slate-400">{isRTL ? "لا: رقم هوية، آيبان" : "No: ID, IBAN"}</span>
              </div>
            </div>
            <div className={`mb-4 rounded-lg border-0 px-4 py-3 ${canUpload ? "text-amber-800 dark:text-amber-200" : "text-red-700 dark:text-red-300"} ${canUpload ? "" : "border-2 border-red-400"}`} style={{ background: canUpload ? "#fff9db" : "#fef2f2" }}>
              <span className="flex items-center gap-2">
                <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {canUpload
                  ? (isRTL ? "سيتم ربط البيانات المرفوعة بـ:" : "Data will be linked to:")
                  : (isRTL ? "يُشترط تحديد العلامة التجارية، الفرع، والفترة أولاً لتفعيل الرفع" : "Select Brand, Branch, and Period first to enable upload")
                }{" "}
                {canUpload && (
                  <span id="confirmSelection" className="font-bold text-slate-900 dark:text-slate-100">
                    {confirmSelectionText}
                  </span>
                )}
              </span>
            </div>

            <div
              role="button"
              tabIndex={canUpload ? 0 : -1}
              onClick={() => canUpload && document.getElementById("excelIncomeUpload")?.click()}
              onDragOver={(e) => { e.preventDefault(); if (canUpload) e.currentTarget.style.background = "#f0fdf4"; }}
              onDragLeave={(e) => { e.preventDefault(); e.currentTarget.style.background = ""; }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.background = "";
                if (canUpload) {
                  const f = e.dataTransfer?.files?.[0];
                  if (f) processUploadFile(f);
                }
              }}
              className={`rounded-xl border-2 border-dashed p-8 text-center transition ${canUpload ? "cursor-pointer border-[#10b981] bg-slate-50 dark:bg-slate-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" : "cursor-not-allowed border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800/50 opacity-75"}`}
            >
              <input
                type="file"
                id="excelIncomeUpload"
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) processUploadFile(f);
                  e.target.value = "";
                }}
              />
              <svg className="mx-auto mb-4 h-14 w-14 text-[#10b981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <h5 className="font-bold text-slate-800 dark:text-slate-200">
                {isRTL ? "اسحب ملف التقرير هنا أو اضغط للرفع" : "Drag report file here or click to upload"}
              </h5>
              <p className="mt-2 text-sm text-slate-500">
                {isRTL ? "تأكد أن الملف يطابق تنسيق (قائمة الدخل) المعتمد" : "Ensure file matches approved Income Statement format"}
              </p>
              <button
                type="button"
                onClick={downloadSaifIncomeTemplate}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#10b981]/50 bg-[#10b981]/10 px-4 py-2 text-sm font-medium text-[#059669] transition hover:bg-[#10b981]/20 dark:text-emerald-400 dark:hover:bg-[#10b981]/30"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.583M12 4h.01M17 4h.01M12 8h.01M17 8h.01" />
                </svg>
                {isRTL ? "تحميل النموذج الفارغ" : "Download Template"}
              </button>
            </div>

            {uploadError && (
              <div className="mt-3 rounded-lg bg-red-100 dark:bg-red-900/30 px-4 py-2 text-sm text-red-700 dark:text-red-300">
                {uploadError}
              </div>
            )}

            {aggregationMismatches.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                <p className="font-semibold">
                  {isRTL ? "تنبيه: يوجد فرق في إجماليات الحسابات التالية، يرجى مراجعة المدخلات." : "Alert: Mismatch between uploaded totals and sum of sub-accounts. Please review inputs."}
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  {aggregationMismatches.map((m) => (
                    <li key={m.code}>
                      {isRTL ? `حساب "${m.name_ar}" (${m.code}): مرفوع ${m.uploadedTotal.toLocaleString()} ≠ مجموع الفرعيّات ${m.computedSum.toLocaleString()}` : `"${m.name_ar}" (${m.code}): uploaded ${m.uploadedTotal.toLocaleString()} ≠ sum ${m.computedSum.toLocaleString()}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {uploadInProgress && (
              <div className="mt-4">
                <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full w-full animate-pulse rounded-full bg-[#10b981]" />
                </div>
                <p className="mt-2 text-center text-sm text-[#10b981]">
                  {isRTL ? "جاري تحليل البيانات ومطابقة الفروع..." : "Analyzing data and matching branches..."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div id="reportOutput">
      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-12 text-center text-slate-400">
          {isRTL ? "جاري التحميل..." : "Loading..."}
        </div>
      ) : (
        <>
        {isUpdating && (
          <div className="mb-4 rounded-xl border border-[#10b981]/30 bg-[#ecfdf5]/70 px-4 py-3 text-center text-sm font-medium text-[#059669]">
            {isRTL ? `جاري استخراج بيانات ${filterBrand ? (selectedBrand ? getBrandDisplayName(selectedBrand, lang) : filterBrand) : "الكل"} لفترة ${filterDate} - مستوى ${filterLevel}` : `Processing ${filterBrand ? (selectedBrand ? getBrandDisplayName(selectedBrand, lang) : filterBrand) : "All"} for ${filterDate} - level ${filterLevel}`}
          </div>
        )}
        <motion.div
          id="income-statement-view"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="saif-income-report"
        >
          <div className="report-container">
            <div className="report-header">
              <div>
                <h2 className="m-0 text-xl font-bold">
                  {isRTL ? "قائمة الدخل" : "Income Statement"} - {metadata.reportTitle}
                </h2>
                <small className="opacity-90">
                  {metadata.currentPeriod} vs {metadata.previousPeriod}
                  {metadata.isDemo && ` (${isRTL ? "وضع تجريبي" : "Demo"})`}
                </small>
              </div>
              <div className="text-left">
                <p className="m-0 font-bold">{metadata.branch}</p>
                <small className="opacity-90">{isRTL ? "المستوى المعروض" : "Display Level"}: {metadata.displayLevelLabel}</small>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="main-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "right", paddingRight: 25 }}>
                    {isRTL ? "اسم الحساب" : "Account Name"}
                  </th>
                  <th style={{ width: "15%" }}>
                    {isRTL ? "مبلغ" : "Amount"} ({metadata.currentPeriod.split(" ")[0]})
                  </th>
                  <th style={{ width: "10%" }}>{isRTL ? "النسبة %" : "Perc %"}</th>
                  <th style={{ width: "15%" }}>
                    {isRTL ? "مبلغ" : "Amount"} ({metadata.previousPeriod.split(" ")[0]})
                  </th>
                  <th style={{ width: "10%" }}>{isRTL ? "النسبة %" : "Perc %"}</th>
                  <th style={{ width: "15%" }}>{isRTL ? "الانحراف (Diff)" : "Diff"}</th>
                  <th style={{ width: "10%" }}>{isRTL ? "التغير %" : "Change %"}</th>
                </tr>
              </thead>
              <tbody>
                {/* قسم الإيرادات المباشرة */}
                <tr className="bg-slate-100 dark:bg-slate-700/30">
                  <td colSpan={7} className="text-end py-2 font-bold text-emerald-700 dark:text-emerald-400">
                    {isRTL ? "قسم الإيرادات المباشرة" : "Direct Revenue Section"}
                  </td>
                </tr>
                {processedRevenue.map((r) => (
                  <tr key={r.code}>
                    <td className="account-name" dir="rtl">
                      {isRTL ? r.name : r.nameEn}
                      <span className="level-label">{r.level}</span>
                    </td>
                    <td>{formatNumber(r.current)}</td>
                    <td><span className="perc-tag">{r.currentPerc.toFixed(1)}%</span></td>
                    <td style={{ color: "#64748b" }}>{formatNumber(r.previous)}</td>
                    <td style={{ color: "#94a3b8", fontSize: "0.85rem" }}>{r.prevPerc.toFixed(1)}%</td>
                    <td className={r.diff >= 0 ? "diff-pos" : "diff-neg"}>{formatNumber(r.diff)}</td>
                    <td className={r.diffPerc >= 0 ? "diff-pos" : "diff-neg"}>{fmtPerc(r.diffPerc, true)}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td className="account-name" style={{ color: "white" }}>
                    {isRTL ? "صافي المبيعات" : "Net Sales"}
                  </td>
                  <td id="total-cur">{formatNumber(totalCurrentSales)}</td>
                  <td>100%</td>
                  <td id="total-prev">{formatNumber(totalPrevSales)}</td>
                  <td>100%</td>
                  <td>{formatNumber(totalCurrentSales - totalPrevSales)}</td>
                  <td>{fmtPerc(performancePct, true)}</td>
                </tr>

                {/* قسم التكاليف والمصاريف */}
                <tr className="bg-slate-100 dark:bg-slate-700/30">
                  <td colSpan={7} className="text-end py-2 font-bold text-red-600 dark:text-red-400">
                    {isRTL ? "قسم التكاليف والمصاريف" : "Costs & Expenses Section"}
                  </td>
                </tr>
                {processedExpenses.map((e) => (
                  <tr key={e.code} className={budgetExceededCodes.has(e.code) ? "bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500" : ""}>
                    <td className="account-name" dir="rtl">
                      {isRTL ? e.name : e.nameEn}
                      <span className="level-label">{e.level}</span>
                    </td>
                    <td>{formatNumber(e.current)}</td>
                    <td><span className="perc-tag">{e.currentPerc.toFixed(1)}%</span></td>
                    <td style={{ color: "#64748b" }}>{formatNumber(e.previous)}</td>
                    <td style={{ color: "#94a3b8", fontSize: "0.85rem" }}>{e.prevPerc.toFixed(1)}%</td>
                    <td className={e.diff >= 0 ? "diff-neg" : "diff-pos"}>{formatNumber(e.diff)}</td>
                    <td className={e.diffPerc >= 0 ? "diff-neg" : "diff-pos"}>{fmtPerc(e.diffPerc, true)}</td>
                  </tr>
                ))}
                <tr className="bg-red-50 dark:bg-red-500/10 border-y-2 border-red-500/30">
                  <td className="account-name font-semibold text-red-700 dark:text-red-300">
                    {isRTL ? "إجمالي المصاريف" : "Total Expenses"}
                  </td>
                  <td className="val-current font-bold text-red-700 dark:text-red-300">
                    {formatNumber(totalCurrentExp)}
                  </td>
                  <td>
                    {totalCurrentSales > 0 ? (
                      <span className="val-perc">{(totalCurrentExp / totalCurrentSales * 100).toFixed(2)}%</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="font-semibold text-slate-600 dark:text-slate-300">{formatNumber(totalPrevExp)}</td>
                  <td className="text-slate-500">—</td>
                  <td className="font-semibold text-red-600 dark:text-red-400">
                    {formatNumber(totalCurrentExp - totalPrevExp)}
                  </td>
                  <td>—</td>
                </tr>

                {/* صافي الربح / Net Profit */}
                <tr className="bg-slate-200 dark:bg-slate-700/60">
                  <td colSpan={2} className="account-name py-3 font-bold text-slate-800 dark:text-slate-100">
                    {isRTL ? "صافي الربح / الخسارة" : "Net Profit / Loss"}
                  </td>
                  <td className="py-3 font-bold">{formatNumber(netCurrent)}</td>
                  <td colSpan={2} className="py-3 text-slate-600 dark:text-slate-400 font-medium">
                    {formatNumber(netPrevious)}
                  </td>
                  <td colSpan={2} className={`py-3 font-bold ${netCurrent - netPrevious >= 0 ? "diff-pos" : "diff-neg"}`}>
                    {formatNumber(netCurrent - netPrevious)}
                  </td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>
        </motion.div>
        </>
      )}
      </div>
    </div>
  );
}
