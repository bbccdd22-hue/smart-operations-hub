import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import type { Brand, Branch } from "../lib/api";
import SavedViewsDropdown from "./SavedViewsDropdown";
import GlobalDateRangePicker from "./GlobalDateRangePicker";
import Switch from "./ui/Switch";
import UnifiedFilterSelect from "./UnifiedFilterSelect";
import FilterOptionsPopover from "./FilterOptionsPopover";
import { useProfitVisibility } from "../contexts/ProfitVisibilityContext";

export type DateRange = { from: Date; to: Date };

const REPORT_TYPES = [
  { value: "daily_sales", labelKey: "Daily Totals" },
  { value: "hourly_sales", labelKey: "Hourly Trends" },
  { value: "product_sales", labelKey: "Product Sales" },
  { value: "receipts", labelKey: "Receipts" },
] as const;

function RefreshIcon({ className, spin }: { className?: string; spin?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className ?? ""} ${spin ? "animate-spin" : ""}`}
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 21h5v-5" />
    </svg>
  );
}

type Props = {
  brands: Brand[];
  branches: Branch[];
  selectedBrands: string[];
  selectedBranches: number[];
  selectedReportType: string;
  dateRange: DateRange;
  submittedBranchIds?: number[];
  isSAIF?: boolean;
  refreshing?: boolean;
  onBrandChange: (slugs: string[]) => void;
  onBranchChange: (ids: number[]) => void;
  onReportTypeChange?: (type: string) => void;
  onDateRangeChange: (range: DateRange) => void;
  onRefresh?: () => void;
  onApplySavedView?: (v: {
    brand: string | null;
    brandSlugs?: string[];
    branchIds: number[];
    reportType: string;
    dateRange: DateRange;
  }) => void;
  /** ميزة مقارنة الفترات – SAIF والمدير العام فقط */
  canUseComparison?: boolean;
  comparisonEnabled?: boolean;
  onComparisonChange?: (enabled: boolean) => void;
};

export default function DashboardFilterBar({
  brands,
  branches,
  selectedBrands,
  selectedBranches,
  selectedReportType = "daily_sales",
  dateRange,
  submittedBranchIds = [],
  isSAIF = false,
  refreshing = false,
  onBrandChange,
  onBranchChange,
  onReportTypeChange,
  onDateRangeChange,
  onRefresh,
  onApplySavedView,
  canUseComparison = false,
  comparisonEnabled = false,
  onComparisonChange,
}: Props) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const { showFullFinancial, setShowFullFinancial, canUseProfitVisibility } = useProfitVisibility();

  const formatDate = (d: Date) =>
    format(d, "dd MMM yyyy", { locale: isRTL ? ar : undefined });

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="filter-bar-sticky -mt-2 mb-6"
    >
      <div className="float-card glass-card flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 backdrop-blur-xl">
        {/* Brand multi-select – UnifiedFilterSelect */}
        <UnifiedFilterSelect
          mode="brand"
          items={brands}
          selected={selectedBrands}
          onChange={onBrandChange}
          label={t("brand")}
        />

        {/* Report Type – نفس المكون الموحد */}
        {onReportTypeChange && (
          <FilterOptionsPopover
            options={REPORT_TYPES.map((r) => ({ value: r.value, labelKey: r.labelKey }))}
            value={selectedReportType}
            onChange={onReportTypeChange}
            label={t("filter")}
          />
        )}

        {/* Branch multi-select – UnifiedFilterSelect */}
        <UnifiedFilterSelect
          mode="branch"
          items={branches}
          selected={selectedBranches}
          onChange={onBranchChange}
          label={t("branch")}
          submittedBranchIds={submittedBranchIds}
        />

        {/* Profit Visibility Toggle – SAIF والمدير العام فقط */}
        {canUseProfitVisibility && (
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs font-medium text-slate-600 dark:text-slate-400">
              {t("showFullFinancialAnalysis")}
            </span>
            <Switch
              checked={showFullFinancial}
              onChange={() => setShowFullFinancial(!showFullFinancial)}
              aria-label={t("showFullFinancialAnalysis")}
            />
          </div>
        )}

        {/* Global Date Range Picker – أسلوب فودكس */}
        <GlobalDateRangePicker
          value={dateRange}
          onChange={onDateRangeChange}
          comparisonEnabled={comparisonEnabled}
          onComparisonChange={onComparisonChange}
          canUseComparison={canUseComparison && !!onComparisonChange}
        />

        {/* Refresh Data button [Ref: 141333] */}
        {onRefresh && (
          <motion.button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 rounded-lg border border-[#10B981] bg-[#10B981]/12 px-4 py-2 text-sm font-medium text-[#10B981] transition hover:bg-[#10B981]/20 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <RefreshIcon spin={refreshing} className="shrink-0" />
            <span>{refreshing ? t("loading") : t("refreshData")}</span>
          </motion.button>
        )}

        {/* Saved Views (SAIF only) */}
        {isSAIF && onApplySavedView && (
          <SavedViewsDropdown
            isSAIF
            currentState={{
              brand: selectedBrands[0] ?? null,
              brandSlugs: selectedBrands,
              branchIds: selectedBranches,
              reportType: selectedReportType,
              dateRange,
            }}
            onApplyView={onApplySavedView}
          />
        )}
      </div>
    </motion.div>
  );
}
