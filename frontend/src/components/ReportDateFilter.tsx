/**
 * شريط فلتر التاريخ للتقارير – يستخدم الفترة العالمية
 * لعرض وتعديل الفترة في صفحات التقارير والرقابة
 */
import { useTranslation } from "react-i18next";
import GlobalDateRangePicker from "./GlobalDateRangePicker";
import { useDateRange } from "../contexts/DateRangeContext";

type Props = {
  /** إظهار ميزة المقارنة (SAIF والمدير العام) */
  showComparison?: boolean;
};

export default function ReportDateFilter({ showComparison = false }: Props) {
  const { t } = useTranslation();
  const {
    dateRange,
    setDateRange,
    comparisonEnabled,
    setComparisonEnabled,
    canUseComparison,
  } = useDateRange();

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {t("date")}
      </span>
      <GlobalDateRangePicker
        value={dateRange}
        onChange={setDateRange}
        comparisonEnabled={comparisonEnabled}
        onComparisonChange={setComparisonEnabled}
        canUseComparison={showComparison && canUseComparison}
      />
    </div>
  );
}
