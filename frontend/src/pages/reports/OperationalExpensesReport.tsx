/**
 * [FIN-002] Operational Expenses (OPEX) - Labor, rent, utilities.
 */
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import ResponsiveFinancialTable from "../../components/ResponsiveFinancialTable";

function sar(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

const OPEX_DATA = [
  { categoryEn: "Labor", categoryAr: "العمالة", amount: 125000, periodEn: "Monthly", periodAr: "شهرياً" },
  { categoryEn: "Rent", categoryAr: "الإيجار", amount: 85000, periodEn: "Monthly", periodAr: "شهرياً" },
  { categoryEn: "Utilities", categoryAr: "المرافق", amount: 22000, periodEn: "Monthly", periodAr: "شهرياً" },
  { categoryEn: "Maintenance", categoryAr: "الصيانة", amount: 8500, periodEn: "Monthly", periodAr: "شهرياً" },
];

export default function OperationalExpensesReport() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";

  const tableData = OPEX_DATA.map((r) => ({
    category: isRTL ? r.categoryAr : r.categoryEn,
    amount: r.amount,
    period: isRTL ? r.periodAr : r.periodEn,
  }));

  const total = OPEX_DATA.reduce((s, r) => s + r.amount, 0);

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
            FIN-002
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
            {isRTL ? "النفقات التشغيلية" : "Operational Expenses (OPEX)"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isRTL ? "العمالة، الإيجار، وفواتير المرافق" : "Labor, rent, and utility costs"}
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="float-card overflow-hidden rounded-2xl p-6"
      >
        <h2 className="mb-4 text-sm font-semibold text-slate-800 dark:text-white">
          {isRTL ? "تفاصيل النفقات" : "Expense Breakdown"}
        </h2>
        <ResponsiveFinancialTable
          columns={[
            { key: "category", labelEn: "Category", labelAr: "الفئة" },
            {
              key: "amount",
              labelEn: "Amount (SAR)",
              labelAr: "المبلغ (ر.س)",
              align: "right",
              render: (v) => (
                <span className="font-semibold tabular-nums">{typeof v === "number" ? sar(v) : String(v)}</span>
              ),
            },
            { key: "period", labelEn: "Period", labelAr: "الفترة" },
          ]}
          data={tableData}
        />
        <div className="mt-6 border-t border-slate-200/60 pt-4 dark:border-white/10">
          <div className="flex justify-between text-lg font-bold text-emerald-600 dark:text-emerald-400">
            <span>{isRTL ? "إجمالي النفقات" : "Total OPEX"}</span>
            <span className="tabular-nums">{sar(total)}</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
