/**
 * سجل أخطاء النظام – للمالك (سيف) لمراجعة الأعطال.
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { fetchSystemErrorLogs, resolveSystemErrorLog, type SystemErrorLogEntry } from "../lib/api";

const ERROR_TYPE_LABELS: Record<string, string> = {
  depletion_failed: "فشل خصم المخزون",
  upload_failed: "فشل رفع ملف",
  transfer_failed: "فشل التحويل",
  other: "أخرى",
};

export default function SystemErrorLogsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<SystemErrorLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterResolved, setFilterResolved] = useState<boolean | null>(null);

  const isSAIF = user?.username === "SAIF";

  useEffect(() => {
    if (user && !isSAIF) {
      navigate("/admin-hub", { replace: true });
      return;
    }
  }, [user, isSAIF, navigate]);

  const loadLogs = useCallback(() => {
    if (!user || !isSAIF) return;
    fetchSystemErrorLogs(200, filterResolved !== null ? { resolved: filterResolved } : undefined)
      .then((r) => setLogs(Array.isArray(r) ? r : []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [user, isSAIF, filterResolved]);

  useEffect(() => {
    if (!user || !isSAIF) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadLogs();
  }, [loadLogs, user, isSAIF]);

  const handleResolve = async (uuid: string) => {
    try {
      await resolveSystemErrorLog(uuid);
      setLogs((prev) => prev.map((l) => ((l.uuid ?? String(l.id)) === uuid ? { ...l, resolved: true } : l)));
    } catch {
      // ignore
    }
  };

  if (!user) return null;
  if (user && !isSAIF) return null;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/admin-hub" className="text-sm text-white/70 hover:text-white">
            ← {t("adminDashboard")}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-white">سجل أخطاء النظام</h1>
          <p className="mt-1 text-sm text-white/60">
            فشل الخصم، رفع الملفات، التحويلات – للمراجعة لاحقاً
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFilterResolved(null)}
            className={`rounded-lg px-3 py-2 text-sm ${filterResolved === null ? "bg-emerald-500/30 text-emerald-400" : "bg-white/10 text-white/70 hover:bg-white/15"}`}
          >
            الكل
          </button>
          <button
            type="button"
            onClick={() => setFilterResolved(false)}
            className={`rounded-lg px-3 py-2 text-sm ${filterResolved === false ? "bg-amber-500/30 text-amber-400" : "bg-white/10 text-white/70 hover:bg-white/15"}`}
          >
            غير مُعالجة
          </button>
          <button
            type="button"
            onClick={() => setFilterResolved(true)}
            className={`rounded-lg px-3 py-2 text-sm ${filterResolved === true ? "bg-emerald-500/30 text-emerald-400" : "bg-white/10 text-white/70 hover:bg-white/15"}`}
          >
            مُعالجة
          </button>
          <button
            type="button"
            onClick={() => { setLoading(true); loadLogs(); }}
            className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/15"
          >
            تحديث
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
        <table className="min-w-[700px] w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5 text-right">
              <th className="px-4 py-3 font-medium text-white/90">الوقت</th>
              <th className="px-4 py-3 font-medium text-white/90">النوع</th>
              <th className="px-4 py-3 font-medium text-white/90">الرسالة</th>
              <th className="px-4 py-3 font-medium text-white/90">المستخدم</th>
              <th className="px-4 py-3 font-medium text-white/90">الحالة</th>
              <th className="px-4 py-3 font-medium text-white/90">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-white/50">
                  لا توجد أخطاء مسجّلة
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr
                  key={log.id}
                  className={`border-b border-white/5 transition hover:bg-white/5 ${log.resolved ? "opacity-60" : ""}`}
                >
                  <td className="px-4 py-2.5 text-white/70">
                    {log.created_at ? new Date(log.created_at).toLocaleString("ar-SA") : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs text-rose-400">
                      {ERROR_TYPE_LABELS[log.error_type] ?? log.error_type}
                    </span>
                  </td>
                  <td className="max-w-[300px] truncate px-4 py-2.5 text-white/80" title={log.message}>
                    {log.message || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-white/70">{log.username || "—"}</td>
                  <td className="px-4 py-2.5">
                    {log.resolved ? (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
                        مُعالج
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
                        مفتوح
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {!log.resolved && (
                      <button
                        type="button"
                        onClick={() => handleResolve(log.uuid ?? String(log.id))}
                        className="rounded-lg bg-emerald-600/80 px-2 py-1 text-xs text-white hover:bg-emerald-600"
                      >
                        تعليم كمُعالج
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {logs.some((l) => l.traceback) && (
        <details className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm text-white/70">عرض التفاصيل التقنية (Traceback)</summary>
          <div className="mt-3 space-y-4">
            {logs.filter((l) => l.traceback).map((log) => (
              <div key={log.id} className="rounded-lg bg-black/20 p-3 font-mono text-xs text-white/80">
                <div className="mb-2 font-sans text-amber-400">#{log.id} – {log.error_type}</div>
                <pre className="whitespace-pre-wrap break-all">{log.traceback}</pre>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
