/**
 * الخدمة الذاتية للموظف - طلب إجازات، سلف، معاينة الراتب
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  fetchHRSelf,
  fetchHRLeaves,
  fetchHRAdvances,
  createHRLeave,
  createHRAdvance,
  type HRLeaveItem,
  type HRAdvanceItem,
} from "../lib/api";

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
  deducted: "مُخصم",
};

export default function EmployeeSelfServicePage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [profile, setProfile] = useState<{ full_name: string; branch: string | null } | null>(null);
  const [salaryPreview, setSalaryPreview] = useState<{
    gross: number;
    net: number;
    deductions_absence: number;
    deductions_advances: number;
    deductions_penalties: number;
    worked_days: number;
    expected_days: number;
  } | null>(null);
  const [leaves, setLeaves] = useState<HRLeaveItem[]>([]);
  const [advances, setAdvances] = useState<HRAdvanceItem[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);

  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceSubmitting, setAdvanceSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [self, leavesRes, advancesRes] = await Promise.all([
        fetchHRSelf({ month, year }),
        fetchHRLeaves(),
        fetchHRAdvances(),
      ]);
      setProfile(self.profile ?? null);
      setSalaryPreview(self.salary_preview ?? null);
      setLeaves(leavesRes.items);
      setAdvances(advancesRes.items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    load();
  }, [load]);

  const handleLeaveSubmit = async () => {
    if (!leaveStart || !leaveEnd) return;
    setLeaveSubmitting(true);
    try {
      await createHRLeave({ start_date: leaveStart, end_date: leaveEnd, reason: leaveReason });
      setShowLeaveForm(false);
      setLeaveStart("");
      setLeaveEnd("");
      setLeaveReason("");
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLeaveSubmitting(false);
    }
  };

  const handleAdvanceSubmit = async () => {
    const amt = parseFloat(advanceAmount);
    if (isNaN(amt) || amt <= 0) return;
    setAdvanceSubmitting(true);
    try {
      await createHRAdvance({ amount: amt });
      setShowAdvanceForm(false);
      setAdvanceAmount("");
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdvanceSubmitting(false);
    }
  };

  if (loading && !profile) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-slate-500">{isRTL ? "جاري التحميل..." : "Loading..."}</p>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="rounded-xl bg-rose-50 p-4 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400">
        {error}
      </div>
    );
  }

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="space-y-6">
      <h1 className="text-xl font-semibold">
        {isRTL ? "الخدمة الذاتية" : "Employee Self-Service"}
      </h1>

      {profile && (
        <div className="rounded-xl bg-white p-4 shadow dark:bg-slate-800">
          <h2 className="mb-2 font-medium">{profile.full_name}</h2>
          <p className="text-sm text-slate-500">{profile.branch || "-"}</p>
        </div>
      )}

      {/* Salary preview */}
      <div className="rounded-xl bg-white p-4 shadow dark:bg-slate-800">
        <h2 className="mb-3 font-medium">
          {isRTL ? "معاينة الراتب" : "Salary Preview"}
        </h2>
        <div className="mb-3 flex gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value, 10))}
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700"
          >
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        {salaryPreview ? (
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>{isRTL ? "الإجمالي" : "Gross"}</span>
              <span>{salaryPreview.gross.toFixed(2)} ر.س</span>
            </div>
            {salaryPreview.deductions_absence > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>{isRTL ? "خصم غياب" : "Absence"}</span>
                <span>−{salaryPreview.deductions_absence.toFixed(2)} ر.س</span>
              </div>
            )}
            {salaryPreview.deductions_advances > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>{isRTL ? "خصم سلف" : "Advances"}</span>
                <span>−{salaryPreview.deductions_advances.toFixed(2)} ر.س</span>
              </div>
            )}
            {salaryPreview.deductions_penalties > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>{isRTL ? "خصم جزاءات" : "Penalties"}</span>
                <span>−{salaryPreview.deductions_penalties.toFixed(2)} ر.س</span>
              </div>
            )}
            <div className="flex justify-between pt-2 font-bold">
              <span>{isRTL ? "الصافي" : "Net"}</span>
              <span>{salaryPreview.net.toFixed(2)} ر.س</span>
            </div>
            <p className="text-xs text-slate-500">
              {isRTL ? "أيام عمل" : "Worked"}: {salaryPreview.worked_days} / {salaryPreview.expected_days}
            </p>
          </div>
        ) : (
          <p className="text-slate-500">{isRTL ? "لا يوجد عقد نشط" : "No active contract"}</p>
        )}
      </div>

      {/* Leaves */}
      <div className="rounded-xl bg-white p-4 shadow dark:bg-slate-800">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">{isRTL ? "طلبات الإجازة" : "Leave Requests"}</h2>
          <button
            type="button"
            onClick={() => setShowLeaveForm(true)}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm text-white hover:bg-emerald-600"
          >
            {isRTL ? "طلب إجازة" : "New Leave"}
          </button>
        </div>
        {leaves.length === 0 ? (
          <p className="text-sm text-slate-500">{isRTL ? "لا توجد طلبات" : "No requests"}</p>
        ) : (
          <ul className="space-y-2">
            {leaves.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-2 dark:border-slate-600"
              >
                <span className="text-sm">
                  {l.start_date} → {l.end_date}
                  {l.reason && ` (${l.reason})`}
                </span>
                <span className="text-xs text-slate-500">{STATUS_LABELS[l.status] ?? l.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Advances */}
      <div className="rounded-xl bg-white p-4 shadow dark:bg-slate-800">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">{isRTL ? "طلبات السلف" : "Salary Advances"}</h2>
          <button
            type="button"
            onClick={() => setShowAdvanceForm(true)}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm text-white hover:bg-emerald-600"
          >
            {isRTL ? "طلب سلفة" : "New Advance"}
          </button>
        </div>
        {advances.length === 0 ? (
          <p className="text-sm text-slate-500">{isRTL ? "لا توجد طلبات" : "No requests"}</p>
        ) : (
          <ul className="space-y-2">
            {advances.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-2 dark:border-slate-600"
              >
                <span className="text-sm">{a.amount.toFixed(2)} ر.س</span>
                <span className="text-xs text-slate-500">{STATUS_LABELS[a.status] ?? a.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Leave modal */}
      {showLeaveForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowLeaveForm(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-6 dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 font-medium">{isRTL ? "طلب إجازة" : "Request Leave"}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-600">{isRTL ? "من" : "From"}</label>
                <input
                  type="date"
                  value={leaveStart}
                  onChange={(e) => setLeaveStart(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 dark:bg-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600">{isRTL ? "إلى" : "To"}</label>
                <input
                  type="date"
                  value={leaveEnd}
                  onChange={(e) => setLeaveEnd(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 dark:bg-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600">{isRTL ? "السبب" : "Reason"}</label>
                <input
                  type="text"
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 dark:bg-slate-700"
                  placeholder={isRTL ? "اختياري" : "Optional"}
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleLeaveSubmit}
                disabled={leaveSubmitting || !leaveStart || !leaveEnd}
                className="flex-1 rounded-lg bg-emerald-500 py-2 text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                {leaveSubmitting ? "..." : (isRTL ? "إرسال" : "Submit")}
              </button>
              <button
                type="button"
                onClick={() => setShowLeaveForm(false)}
                className="rounded-lg bg-slate-200 px-4 py-2 dark:bg-slate-600"
              >
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Advance modal */}
      {showAdvanceForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowAdvanceForm(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-6 dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 font-medium">{isRTL ? "طلب سلفة" : "Request Advance"}</h3>
            <div>
              <label className="block text-sm text-slate-600">{isRTL ? "المبلغ" : "Amount"}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 dark:bg-slate-700"
                placeholder="0.00"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleAdvanceSubmit}
                disabled={advanceSubmitting || !advanceAmount || parseFloat(advanceAmount) <= 0}
                className="flex-1 rounded-lg bg-emerald-500 py-2 text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                {advanceSubmitting ? "..." : (isRTL ? "إرسال" : "Submit")}
              </button>
              <button
                type="button"
                onClick={() => setShowAdvanceForm(false)}
                className="rounded-lg bg-slate-200 px-4 py-2 dark:bg-slate-600"
              >
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
