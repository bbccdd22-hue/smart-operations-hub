/**
 * التقارير المالية – Financial Reporting Engine
 * Single Source of Truth: ShiftClosing data only.
 * 5 reports: Daily Sales | Cash | Network | Cashier Shortage | Journal Entry
 */
import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { format, subDays } from "date-fns";
import {
  fetchShiftFinancialReports,
  exportShiftFinancialReport,
  fetchBrands,
  fetchBranches,
  type ShiftFinancialReportsResponse,
  type Brand,
  type Branch,
} from "../lib/api";
import ResponsiveFinancialTable from "../components/ResponsiveFinancialTable";
import type { FinancialTableColumn } from "../components/ResponsiveFinancialTable";
import UnifiedFilterSelect from "../components/UnifiedFilterSelect";
import FilterOptionsPopover from "../components/FilterOptionsPopover";

const REPORTS = [
  { id: "daily_sales", labelKey: "dailySalesReport", labelAr: "تقرير المبيعات اليومية" },
  { id: "cash_report", labelKey: "cashReport", labelAr: "تقرير المقبوضات" },
  { id: "network_report", labelKey: "networkReport", labelAr: "تقرير عمليات الشبكة" },
  { id: "cashier_shortage", labelKey: "cashierShortageReport", labelAr: "تقرير عجز الكاشير" },
  { id: "journal_entry", labelKey: "journalEntryReport", labelAr: "تقرير القيد اليومي" },
] as const;

const PERIODS = [
  { value: "daily", label: "يومي", labelEn: "Daily" },
  { value: "weekly", label: "أسبوعي", labelEn: "Weekly" },
  { value: "monthly", label: "شهري", labelEn: "Monthly" },
] as const;

function sar(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "SAR", minimumFractionDigits: 2 }).format(n);
}

export default function FinancialReportsPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [data, setData] = useState<ShiftFinancialReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<(typeof REPORTS)[number]["id"]>("daily_sales");
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 6), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<number | "">("");
  const [searchQuery, setSearchQuery] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    fetchBrands().then((r) => setBrands(Array.isArray(r) ? r : [])).catch(() => setBrands([]));
  }, []);

  useEffect(() => {
    if (!selectedBrand) {
      setBranches([]);
      setSelectedBranchId("");
      return;
    }
    fetchBranches(selectedBrand).then((b) => {
      setBranches(Array.isArray(b) ? b : []);
      setSelectedBranchId("");
    });
  }, [selectedBrand]);

  useEffect(() => {
    setLoading(true);
    const today = format(new Date(), "yyyy-MM-dd");
    let from: string;
    let to: string;
    if (period === "daily") {
      from = to = today;
    } else if (period === "weekly") {
      from = format(subDays(new Date(), 6), "yyyy-MM-dd");
      to = today;
    } else {
      from = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");
      to = today;
    }
    setDateFrom(from);
    setDateTo(to);
    fetchShiftFinancialReports({
      date_from: from,
      date_to: to,
      period,
      branch_ids: selectedBranchId ? [selectedBranchId] : undefined,
      brand: selectedBrand || undefined,
    })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [period, selectedBrand, selectedBranchId]);

  const handleExport = async (fmt: "xlsx" | "pdf") => {
    setExporting(fmt);
    try {
      const blob = await exportShiftFinancialReport({
        report_type: activeReport,
        format: fmt,
        date_from: dateFrom,
        date_to: dateTo,
        period,
        branch_ids: selectedBranchId ? [selectedBranchId] : undefined,
        brand: selectedBrand || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report_${activeReport}_${dateFrom}_${dateTo}.${fmt === "xlsx" ? "xlsx" : "pdf"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Error
    } finally {
      setExporting(null);
    }
  };

  const reportData = useMemo(() => {
    if (!data) return [];
    const raw = data.reports[activeReport] || [];
    if (!searchQuery.trim()) return raw;
    const q = searchQuery.toLowerCase();
    return raw.filter((row) =>
      Object.values(row).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [data, activeReport, searchQuery]);

  const columns: Record<string, FinancialTableColumn[]> = {
    daily_sales: [
      { key: "branch_name", labelEn: "Branch", labelAr: "الفرع" },
      { key: "date", labelEn: "Date", labelAr: "التاريخ" },
      {
        key: "sales",
        labelEn: "Sales",
        labelAr: "المبيعات",
        align: "right",
        render: (v) => <span className="font-semibold tabular-nums">{typeof v === "number" ? sar(v) : "—"}</span>,
      },
      {
        key: "tax",
        labelEn: "Tax (15%)",
        labelAr: "الضريبة",
        align: "right",
        render: (v) => <span className="tabular-nums">{typeof v === "number" ? sar(v) : "—"}</span>,
      },
      {
        key: "total_sales",
        labelEn: "Total",
        labelAr: "الإجمالي",
        align: "right",
        render: (v) => <span className="font-bold tabular-nums text-emerald-600">{typeof v === "number" ? sar(v) : "—"}</span>,
      },
    ],
    cash_report: [
      { key: "branch_name", labelEn: "Branch", labelAr: "الفرع" },
      { key: "date", labelEn: "Date", labelAr: "التاريخ" },
      {
        key: "actual_cash",
        labelEn: "Actual Cash",
        labelAr: "النقد الفعلي",
        align: "right",
        render: (v) => <span className="font-semibold tabular-nums">{typeof v === "number" ? sar(v) : "—"}</span>,
      },
      {
        key: "system_cash",
        labelEn: "Expected (System)",
        labelAr: "المتوقع",
        align: "right",
        render: (v) => <span className="tabular-nums">{typeof v === "number" ? sar(v) : "—"}</span>,
      },
      {
        key: "variance",
        labelEn: "Variance",
        labelAr: "الفرق",
        align: "right",
        render: (v) => {
          const n = typeof v === "number" ? v : 0;
          return (
            <span className={`font-semibold tabular-nums ${n < 0 ? "text-rose-600" : n > 0 ? "text-emerald-600" : ""}`}>
              {sar(n)}
            </span>
          );
        },
      },
    ],
    network_report: [
      { key: "branch_name", labelEn: "Branch", labelAr: "الفرع" },
      { key: "date", labelEn: "Date", labelAr: "التاريخ" },
      { key: "mada", labelEn: "MADA", labelAr: "مدى", align: "right", render: (v) => <span className="tabular-nums">{typeof v === "number" ? sar(v) : "—"}</span> },
      { key: "visa", labelEn: "VISA", labelAr: "فيزا", align: "right", render: (v) => <span className="tabular-nums">{typeof v === "number" ? sar(v) : "—"}</span> },
      { key: "master_card", labelEn: "Master", labelAr: "ماستر", align: "right", render: (v) => <span className="tabular-nums">{typeof v === "number" ? sar(v) : "—"}</span> },
      {
        key: "network_total",
        labelEn: "Network Total",
        labelAr: "إجمالي الشبكة",
        align: "right",
        render: (v) => <span className="font-semibold tabular-nums">{typeof v === "number" ? sar(v) : "—"}</span>,
      },
      {
        key: "system_network",
        labelEn: "System",
        labelAr: "النظام",
        align: "right",
        render: (v) => <span className="tabular-nums">{typeof v === "number" ? sar(v) : "—"}</span>,
      },
      {
        key: "variance",
        labelEn: "Variance",
        labelAr: "الفرق",
        align: "right",
        render: (v) => {
          const n = typeof v === "number" ? v : 0;
          return <span className={`tabular-nums ${n !== 0 ? "font-semibold" : ""} ${n < 0 ? "text-rose-600" : n > 0 ? "text-emerald-600" : ""}`}>{sar(n)}</span>;
        },
      },
    ],
    cashier_shortage: [
      { key: "date", labelEn: "Date", labelAr: "التاريخ" },
      { key: "branch_name", labelEn: "Branch", labelAr: "الفرع" },
      { key: "shift_type", labelEn: "Shift", labelAr: "الوردية" },
      { key: "employee_name", labelEn: "Employee", labelAr: "الموظف" },
      {
        key: "expected_amount",
        labelEn: "Expected",
        labelAr: "المتوقع",
        align: "right",
        render: (v) => <span className="tabular-nums">{typeof v === "number" ? sar(v) : "—"}</span>,
      },
      {
        key: "actual_amount",
        labelEn: "Actual",
        labelAr: "الفعلي",
        align: "right",
        render: (v) => <span className="font-semibold tabular-nums">{typeof v === "number" ? sar(v) : "—"}</span>,
      },
      {
        key: "variance",
        labelEn: "Shortage/Surplus",
        labelAr: "العجز/الزيادة",
        align: "right",
        render: (v) => {
          const n = typeof v === "number" ? v : 0;
          return (
            <span className={`font-semibold tabular-nums ${n < 0 ? "text-rose-600" : n > 0 ? "text-emerald-600" : ""}`}>
              {sar(n)}
            </span>
          );
        },
      },
    ],
    journal_entry: [
      { key: "date", labelEn: "Date", labelAr: "التاريخ" },
      { key: "description", labelEn: "Description", labelAr: "الوصف" },
      { key: "debit_account", labelEn: "Debit", labelAr: "حساب مدين" },
      { key: "credit_account", labelEn: "Credit", labelAr: "حساب دائن" },
      {
        key: "debit_amount",
        labelEn: "Debit Amt",
        labelAr: "مبلغ مدين",
        align: "right",
        render: (v) => <span className="tabular-nums">{typeof v === "number" && v > 0 ? sar(v) : "—"}</span>,
      },
      {
        key: "credit_amount",
        labelEn: "Credit Amt",
        labelAr: "مبلغ دائن",
        align: "right",
        render: (v) => <span className="tabular-nums">{typeof v === "number" && v > 0 ? sar(v) : "—"}</span>,
      },
    ],
  };

  return (
    <div className="w-full space-y-6" style={{ fontFamily: "Inter, Lexend, Tajawal, system-ui, sans-serif" }}>
      <div>
        <Link to="/finance" className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">
          ← {isRTL ? "العودة للمركز المالي" : "Back to Finance Hub"}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
          {isRTL ? "التقارير المالية" : "Financial Reports"}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isRTL ? "جميع البيانات من إغلاق الورديات – مصدر واحد للبيانات" : "All data from shift closings – single source of truth"}
        </p>
      </div>

      {/* Filters – ثابت في الأعلى */}
      <div className="filter-bar-sticky glass-card flex flex-wrap items-center gap-4 rounded-2xl p-4">
        <FilterOptionsPopover
          options={PERIODS.map((p) => ({ value: p.value, label: isRTL ? p.label : p.labelEn }))}
          value={period}
          onChange={(v) => setPeriod(v as typeof period)}
          label={isRTL ? "الفترة" : "Period"}
        />
        <UnifiedFilterSelect
          mode="brand"
          items={brands}
          selected={selectedBrand}
          onChange={setSelectedBrand}
          selectionMode="single"
          label={isRTL ? "العلامة" : "Brand"}
          placeholder={isRTL ? "الكل" : "All"}
        />
        <UnifiedFilterSelect
          mode="branch"
          items={branches}
          selected={selectedBranchId}
          onChange={setSelectedBranchId}
          selectionMode="single"
          label={isRTL ? "الفرع" : "Branch"}
          placeholder={isRTL ? "الكل" : "All"}
          disabled={!selectedBrand}
        />
        <div className="flex flex-1 items-center gap-2">
          <span className="text-xs font-medium text-slate-500">{isRTL ? "بحث" : "Search"}</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isRTL ? "ابحث في النتائج..." : "Search results..."}
            className="glass-input flex-1 rounded-xl px-3 py-2 text-sm outline-none"
          />
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex flex-wrap gap-2">
        {REPORTS.map((r) => (
          <button
            key={r.id}
            onClick={() => setActiveReport(r.id)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              activeReport === r.id
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
            }`}
          >
            {isRTL ? r.labelAr : t(r.labelKey)}
          </button>
        ))}
      </div>

      {/* Export Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleExport("xlsx")}
          disabled={exporting !== null || loading}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {exporting === "xlsx" ? "…" : "Export Excel"}
        </button>
        <button
          onClick={() => handleExport("pdf")}
          disabled={exporting !== null || loading}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
        >
          {exporting === "pdf" ? "…" : "Export PDF"}
        </button>
      </div>

      {/* Table */}
      <motion.div
        key={activeReport}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="aqua-glass-card overflow-hidden rounded-2xl p-4 sm:p-6"
      >
        {loading ? (
          <div className="py-12 text-center text-slate-500">Loading…</div>
        ) : (
          <ResponsiveFinancialTable
            columns={columns[activeReport] || []}
            data={reportData}
            emptyMessage={isRTL ? "لا توجد بيانات" : "No data"}
          />
        )}
      </motion.div>
    </div>
  );
}
