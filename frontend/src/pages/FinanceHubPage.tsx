/**
 * Financial Management Hub – Folder view of all FIN reports.
 * Route: /finance
 */
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import ReportFolderCard from "../components/ReportFolderCard";
import { FINANCIAL_REPORTS } from "../config/financialReports";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function FinanceHubPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";

  const lastUpdated = format(new Date(), "dd MMM yyyy HH:mm", { locale: isRTL ? ar : undefined });

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

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FINANCIAL_REPORTS.map((report) => (
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
