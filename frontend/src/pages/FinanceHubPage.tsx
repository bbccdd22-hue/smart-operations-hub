/**
 * Financial Management Hub – Folder view of all FIN reports.
 * Route: /finance
 */
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import ReportFolderCard from "../components/ReportFolderCard";
import { FINANCIAL_REPORTS } from "../config/financialReports";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useAuth } from "../contexts/AuthContext";

export default function FinanceHubPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRTL = i18n.language === "ar";
  const isSAIF = user?.username === "SAIF";

  const lastUpdated = format(new Date(), "dd MMM yyyy HH:mm", { locale: isRTL ? ar : undefined });
  const reports = FINANCIAL_REPORTS.filter((r) => !r.saifOnly || isSAIF);

  const handleDownloadPDF = (code: string) => {
    // Placeholder – wire to actual export
    console.log(`Download PDF: ${code}`);
  };

  const handleDownloadExcel = (code: string) => {
    // Placeholder – wire to actual export
    console.log(`Download Excel: ${code}`);
  };

  return (
    <div className="w-full space-y-8">
      <div>
        <div className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t("financialManagement") ?? "Financial Management"}
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
          {isRTL ? "مركز التقارير المالية" : "Financial Reports Hub"}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {isRTL
            ? "تقرير الإيرادات، النفقات، والتدفق النقدي – كل تقرير له رمز فريد"
            : "Revenue, expenses, and cash flow – each report has a unique code"}
        </p>
      </div>

      {/* المراجع المالي – لمراجعة إقفالات الورديات والصور */}
      {(user?.permissions?.perm_financial_auditor || user?.username === "SAIF") && (
        <Link to="/finance/auditor" className="block">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center justify-between gap-4 rounded-2xl border-2 border-sky-500/40 bg-sky-50/50 p-6 transition hover:border-sky-500 hover:bg-sky-50 dark:border-sky-600/40 dark:bg-sky-900/20 dark:hover:border-sky-500 dark:hover:bg-sky-900/30"
          >
            <div>
              <div className="text-sm font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                {isRTL ? "مراجعة شاملة" : "Full Review"}
              </div>
              <h2 className="mt-1 text-xl font-bold text-slate-800 dark:text-white">
                {isRTL ? "المراجع المالي" : "Financial Auditor"}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {isRTL ? "مراجعة إقفالات الورديات، الصور المرفقة، والتعميد – فلترة حسب العلامة التجارية" : "Review shift closings, attachments, posting – filter by brand"}
              </p>
            </div>
            <span className="text-4xl">🔍</span>
          </motion.div>
        </Link>
      )}

      {/* التقارير المالية من إقفال الورديات – Single Source of Truth */}
      <Link
        to="/finance/reports"
        className="block"
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center justify-between gap-4 rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/50 p-6 transition hover:border-emerald-500 hover:bg-emerald-50 dark:border-emerald-600/40 dark:bg-emerald-900/20 dark:hover:border-emerald-500 dark:hover:bg-emerald-900/30"
        >
          <div>
            <div className="text-sm font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              {isRTL ? "مصدر واحد للبيانات" : "Single Source of Truth"}
            </div>
            <h2 className="mt-1 text-xl font-bold text-slate-800 dark:text-white">
              {isRTL ? "التقارير المالية من إقفال الورديات" : "Financial Reports (Shift Closing Data)"}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {isRTL
                ? "تقرير المبيعات اليومية • المقبوضات • عمليات الشبكة • عجز الكاشير • القيد اليومي"
                : "Daily Sales • Cash • Network • Cashier Shortage • Journal Entry"}
            </p>
          </div>
          <span className="text-4xl">📊</span>
        </motion.div>
      </Link>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <motion.div
            key={report.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <ReportFolderCard
              report={report}
              lastUpdated={lastUpdated}
              onDownloadPDF={() => handleDownloadPDF(report.code)}
              onDownloadExcel={() => handleDownloadExcel(report.code)}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
