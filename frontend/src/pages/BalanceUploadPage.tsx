/**
 * محرك رفع البيانات المالي – نظام سيف الذكي
 * تحديث أرصدة الحسابات من ملف الإكسل
 */
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { importChartBalances, logActivity } from "../lib/api";
import { parseExcelToBalances } from "../lib/excelParser";

export default function BalanceUploadPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ updated: number; not_found: string[]; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [balances, setBalances] = useState<Record<string, number> | null>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (!/\.(xlsx|xls)$/i.test(file.name)) {
        setError(isRTL ? "يرجى اختيار ملف إكسل (.xlsx أو .xls)" : "Please select an Excel file (.xlsx or .xls)");
        return;
      }
      setError(null);
      setResult(null);
      setLoading(true);
      try {
        const parsed = await parseExcelToBalances(file);
        setBalances(parsed);
        if (Object.keys(parsed).length === 0) {
          setError(isRTL ? "لم يتم العثور على أرصدة في الملف" : "No balances found in file");
          setLoading(false);
          return;
        }
        const res = await importChartBalances(parsed);
        setResult(res);
        logActivity({
          action_type: "file_upload",
          page_path: "/finance/balance-upload",
          file_name: file.name,
          description: `رفع أرصدة الحسابات - ${Object.keys(parsed).length} حساب`,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to process file");
      } finally {
        setLoading(false);
      }
    },
    [isRTL]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  return (
    <div className="w-full space-y-6">
      <div>
        <Link
          to="/finance"
          className="text-sm font-medium text-emerald-500 hover:text-emerald-600 dark:text-emerald-400"
        >
          ← {isRTL ? "العودة للمركز المالي" : "Back to Finance Hub"}
        </Link>
        <div className="mt-1 text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          FIN-007
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
          {isRTL ? "تحديث أرصدة الحسابات" : "Update Account Balances"}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isRTL
            ? "رفع ملف الإكسل لمطابقة المبالغ مع دليل الحسابات وتحديث صافي الأرباح"
            : "Upload Excel to map amounts to chart of accounts and update net profit"}
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl border border-[#00ffcc]/20 shadow-lg"
        style={{
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div className="border-b border-[#00ffcc]/20 bg-[#10b981] px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {isRTL ? "تحديث أرصدة الحسابات (من ملف الإكسل)" : "Update Account Balances (from Excel)"}
          </h2>
        </div>
        <div className="p-6 text-center">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`cursor-pointer rounded-2xl border-2 border-dashed px-6 py-12 transition ${
              dragging ? "border-[#10b981] bg-[#10b981]/10" : "border-[#10b981]/50 bg-[#f9fdfb]/50 dark:bg-white/5"
            }`}
          >
            <svg
              className="mx-auto mb-4 h-16 w-16 text-[#10b981]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="mb-2 font-bold text-slate-700 dark:text-slate-200">
              {isRTL ? "اسحب ملف الإكسل هنا أو اضغط للاختيار" : "Drag Excel file here or click to choose"}
            </p>
            <input
              type="file"
              id="excelFileInput"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileInput}
            />
            <button
              type="button"
              onClick={() => document.getElementById("excelFileInput")?.click()}
              disabled={loading}
              className="rounded-xl bg-[#10b981] px-6 py-2 font-medium text-white transition hover:bg-[#059669] disabled:opacity-50"
            >
              {loading
                ? (isRTL ? "جاري تحليل البيانات ومطابقتها..." : "Analyzing and matching...")
                : isRTL
                  ? "اختيار الملف"
                  : "Choose File"}
            </button>
          </div>

          {result && (
            <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-left">
              <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                {isRTL ? "تم التحديث بنجاح!" : "Updated successfully!"}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {isRTL
                  ? `تم تحديث أرصدة ${result.updated} حساباً وتحديث صافي الأرباح فوراً.`
                  : `Updated balances for ${result.updated} accounts.`}
              </p>
              {result.not_found.length > 0 && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  {isRTL ? "حسابات غير موجودة في الدليل: " : "Codes not in chart: "}
                  {result.not_found.slice(0, 10).join(", ")}
                  {result.not_found.length > 10 && "…"}
                </p>
              )}
              {result.errors.length > 0 && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {result.errors.slice(0, 5).join("; ")}
                </p>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
