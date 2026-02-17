/**
 * Report folder card – [Code], [Title], [Last Updated], [Download PDF/Excel]
 */
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { FinancialReportMeta } from "../config/financialReports";

const ICONS = {
  revenue: (
    <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  opex: (
    <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2h-2m-4-1v8" />
    </svg>
  ),
  cogs: (
    <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
  gauge: (
    <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  cashflow: (
    <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  sitemap: (
    <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
};

type Props = {
  report: FinancialReportMeta;
  lastUpdated?: string;
  onDownloadPDF?: () => void;
  onDownloadExcel?: () => void;
};

export default function ReportFolderCard({
  report,
  lastUpdated,
  onDownloadPDF,
  onDownloadExcel,
}: Props) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const title = isRTL ? report.titleAr : report.titleEn;
  const subtitle = isRTL ? report.subtitleAr : report.subtitleEn;

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className="folder-card flex cursor-pointer flex-col overflow-hidden rounded-[24px] p-5"
    >
      <Link to={report.route} className="flex flex-1 items-center gap-4 outline-none">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
          {ICONS[report.icon]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            {report.code}
          </div>
          <div className="mt-0.5 font-semibold text-slate-800 dark:text-white">{title}</div>
          <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</div>
          {lastUpdated && (
            <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              {isRTL ? "آخر تحديث:" : "Last updated:"} {lastUpdated}
            </div>
          )}
        </div>
        <svg className="h-5 w-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
      <div className="mt-4 flex gap-2 border-t border-slate-200/60 pt-4 dark:border-white/10">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDownloadPDF?.();
          }}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
          title="Download PDF"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          PDF
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDownloadExcel?.();
          }}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
          title="Download Excel"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Excel
        </button>
      </div>
    </motion.div>
  );
}
