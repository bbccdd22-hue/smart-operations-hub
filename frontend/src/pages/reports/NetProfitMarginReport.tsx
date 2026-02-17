/**
 * [FIN-004] Net Profit Margin - Gauge chart showing profit percentage.
 */
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const PROFIT_PCT = 18.5;

export default function NetProfitMarginReport() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            to="/finance"
            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
          >
            ← {isRTL ? "العودة للمركز المالي" : "Back to Finance Hub"}
          </Link>
          <div className="mt-1 text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            FIN-004
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
            {isRTL ? "هامش الربح الصافي" : "Net Profit Margin"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isRTL ? "نسبة الربح بعد جميع الخصومات" : "Profit percentage after all deductions"}
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="float-card overflow-hidden rounded-2xl p-6"
      >
        <h2 className="mb-4 text-sm font-semibold text-slate-800 dark:text-white">
          {isRTL ? "مؤشر الربحية" : "Profitability Gauge"}
        </h2>
        <div className="flex flex-col items-center py-8">
          <div className="relative h-48 w-48">
            <svg viewBox="0 0 100 80" className="w-full">
              <path
                d="M10 70 A 40 40 0 0 1 90 70"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                strokeLinecap="round"
                className="text-slate-200 dark:text-slate-700"
              />
              <path
                d="M10 70 A 40 40 0 0 1 90 70"
                fill="none"
                stroke="#10B981"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${(PROFIT_PCT / 100) * 125.6} 125.6`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center pt-8">
              <span className="text-4xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {PROFIT_PCT}%
              </span>
            </div>
          </div>
          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {isRTL ? "النسبة الحالية من الربح الصافي" : "Current net profit percentage"}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
