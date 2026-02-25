/**
 * وحدة التسويات المحاسبية – SAIF فقط
 * إجراء تسوية يدوية لإصلاح الأرقام الوهمية في ميزان المراجعة
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  fetchChartAccounts,
  createManualAdjustment,
  fetchManualAdjustmentLog,
  type ChartAccount,
  type ManualAdjustmentLogEntry,
} from "../../lib/api";

export default function ManualAdjustmentsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRTL = i18n.language === "ar";
  const isSAIF = user?.username === "SAIF";

  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [log, setLog] = useState<ManualAdjustmentLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    account_id: "",
    amount: "",
    entry_type: "credit" as "debit" | "credit",
    reason: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accts, { adjustments }] = await Promise.all([
        fetchChartAccounts(),
        fetchManualAdjustmentLog(),
      ]);
      setAccounts(accts.filter((a) => a.is_active));
      setLog(adjustments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSAIF) loadData();
  }, [isSAIF, loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSAIF) return;
    const accountId = form.account_id ? parseInt(form.account_id, 10) : 0;
    const amount = parseFloat(form.amount);
    if (!accountId || isNaN(amount) || amount <= 0) {
      setError(isRTL ? "يرجى اختيار الحساب وإدخال مبلغ موجب" : "Please select account and enter positive amount");
      return;
    }
    if (!form.reason.trim()) {
      setError(isRTL ? "سبب التسوية مطلوب" : "Reason is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await createManualAdjustment({
        account_id: accountId,
        amount,
        entry_type: form.entry_type,
        reason: form.reason.trim(),
      });
      setSuccess(isRTL ? "تم تطبيق التسوية بنجاح – انعكست على صافي الربح وميزان المراجعة" : "Adjustment applied successfully – reflected in net profit and trial balance");
      setForm({ account_id: "", amount: "", entry_type: "credit", reason: "" });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isSAIF) {
    return <Navigate to="/finance" replace />;
  }

  return (
    <div className="w-full space-y-8">
      <div>
        <Link
          to="/finance"
          className="text-sm font-medium text-emerald-500 hover:text-emerald-600 dark:text-emerald-400"
        >
          ← {isRTL ? "العودة للمركز المالي" : "Back to Finance Hub"}
        </Link>
        <div className="mt-1 text-xs font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
          SAIF ONLY
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
          {isRTL ? "إجراء تسوية محاسبية" : "Manual Accounting Adjustment"}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isRTL
            ? "إصلاح الأرقام الوهمية في ميزان المراجعة – التأثير اللحظي على صافي الربح"
            : "Fix phantom numbers in trial balance – immediate impact on net profit"}
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {success}
        </div>
      )}

      {/* نموذج إدخال القيد */}
      <form onSubmit={handleSubmit} className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-white">
          {isRTL ? "واجهة إدخال القيد" : "Entry Form"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              {isRTL ? "الحساب المتأثر" : "Affected Account"} *
            </label>
            <select
              value={form.account_id}
              onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              required
            >
              <option value="">
                {isRTL ? "اختر الحساب..." : "Select account..."}
              </option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} – {isRTL ? a.name_ar : a.name_en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              {isRTL ? "المبلغ (ر.س)" : "Amount (SAR)"} *
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder={isRTL ? "مثال: 136000000" : "e.g. 136000000"}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              {isRTL ? "نوع العملية" : "Operation Type"} *
            </label>
            <select
              value={form.entry_type}
              onChange={(e) =>
                setForm((f) => ({ ...f, entry_type: e.target.value as "debit" | "credit" }))
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            >
              <option value="debit">{isRTL ? "مدين" : "Debit"}</option>
              <option value="credit">{isRTL ? "دائن" : "Credit"}</option>
            </select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {form.entry_type === "credit"
                ? isRTL
                  ? "دائن = تخفيض المصروف (يرفع صافي الربح)"
                  : "Credit = reduce expense (increases net profit)"
                : isRTL
                  ? "مدين = زيادة المصروف"
                  : "Debit = increase expense"}
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              {isRTL ? "سبب التسوية" : "Reason"} *
            </label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder={
                isRTL
                  ? "مثال: تصحيح خطأ تقني في ترحيل البيانات"
                  : "e.g. Correction of technical data migration error"
              }
              rows={2}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              required
            />
          </div>
        </div>
        <div className="mt-4">
          <button
            type="submit"
            disabled={submitting || loading}
            className="rounded-xl bg-amber-600 px-6 py-2 font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            {submitting
              ? isRTL
                ? "جاري الحفظ..."
                : "Saving..."
              : isRTL
                ? "حفظ التسوية"
                : "Save Adjustment"}
          </button>
        </div>
      </form>

      {/* سجل التسويات */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/80">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
            {isRTL ? "سجل التسويات (لا يُحذف)" : "Adjustment Log (non-deletable)"}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isRTL
              ? "كل تسوية تُسجَّل مع التاريخ، المبلغ قبل/بعد، ومن قام بها"
              : "Every adjustment is recorded with date, before/after amounts, and performer"}
          </p>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="px-4 py-8 text-center text-slate-500">{isRTL ? "جاري التحميل..." : "Loading..."}</div>
          ) : log.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-500">
              {isRTL ? "لا توجد تسويات مسجلة" : "No adjustments recorded"}
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/80 dark:border-slate-700 dark:bg-slate-700/50">
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                    {isRTL ? "التاريخ" : "Date"}
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                    {isRTL ? "الحساب" : "Account"}
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                    {isRTL ? "نوع" : "Type"}
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                    {isRTL ? "المبلغ" : "Amount"}
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                    {isRTL ? "قبل" : "Before"}
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                    {isRTL ? "بعد" : "After"}
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                    {isRTL ? "السبب" : "Reason"}
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                    {isRTL ? "قام بها" : "Performed by"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {log.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 dark:border-slate-700">
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                      {a.created_at ? new Date(a.created_at).toLocaleString(isRTL ? "ar-SA" : "en") : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span className="font-mono text-slate-800 dark:text-white">{a.account_code}</span>
                      <br />
                      <span className="text-xs text-slate-500">{a.account_name}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          a.entry_type === "credit"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                        }`}
                      >
                        {a.entry_type === "credit" ? (isRTL ? "دائن" : "Credit") : (isRTL ? "مدين" : "Debit")}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono font-medium">
                      {parseFloat(a.amount).toLocaleString("ar-SA")} ر.س
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                      {parseFloat(a.balance_before).toLocaleString("ar-SA")}
                    </td>
                    <td className="px-4 py-2 font-medium text-slate-800 dark:text-white">
                      {parseFloat(a.balance_after).toLocaleString("ar-SA")}
                    </td>
                    <td className="px-4 py-2 max-w-[200px] truncate text-slate-600 dark:text-slate-400">
                      {a.reason || "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">{a.performed_by || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
