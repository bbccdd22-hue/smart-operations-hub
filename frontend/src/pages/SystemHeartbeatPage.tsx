/**
 * نبض النظام – حالة المهام الخلفية للمالك (سيف).
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { fetchSystemHeartbeat, type SystemHeartbeatTask } from "../lib/api";

const TASK_LABELS: Record<string, string> = {
  daily_reconciliation: "تقرير المطابقة اليومي",
  stale_transfer_check: "التحقق من التحويلات العالقة",
};

export default function SystemHeartbeatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<{ tasks: SystemHeartbeatTask[]; checked_at: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSAIF = user?.username === "SAIF";

  const load = useCallback(async () => {
    if (!user || !isSAIF) return;
    setLoading(true);
    setError(null);
    try {
      const d = await fetchSystemHeartbeat();
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [user, isSAIF]);

  useEffect(() => {
    if (user && !isSAIF) navigate("/admin-hub", { replace: true });
  }, [user, isSAIF, navigate]);

  useEffect(() => {
    if (user && isSAIF) load();
  }, [load, user, isSAIF]);

  if (!user || !isSAIF) return null;

  if (loading && !data) {
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
            ← لوحة الإدارة
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-white">نبض النظام</h1>
          <p className="mt-1 text-sm text-white/60">
            حالة المهام الخلفية (المطابقة، التحويلات العالقة) – تأكد من عمل المراقب الآلي
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
        >
          تحديث
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-rose-500/20 px-4 py-3 text-rose-200">{error}</div>
      )}

      <div className="space-y-4">
        {(Array.isArray(data?.tasks) ? data.tasks : []).length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
            لم تُشغّل أي مهمة بعد. شغّل المطابقة: <code>python manage.py run_daily_reconciliation</code>
          </div>
        ) : (
          (Array.isArray(data?.tasks) ? data.tasks : []).map((t) => (
            <div
              key={t.task_name}
              className={`rounded-2xl border p-6 ${
                t.is_stale
                  ? "border-amber-500/40 bg-amber-500/10"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-white">
                    {TASK_LABELS[t.task_name] ?? t.task_name}
                  </h3>
                  <p className="mt-1 text-sm text-white/60">
                    آخر تشغيل: {t.last_run_at ? new Date(t.last_run_at).toLocaleString("ar-SA") : "—"}
                  </p>
                  {t.last_message && (
                    <p className="mt-1 text-sm text-white/70">{t.last_message}</p>
                  )}
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${
                    t.last_status === "ok"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : t.last_status === "error"
                        ? "bg-rose-500/20 text-rose-400"
                        : t.last_status === "warning"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-white/10 text-white/60"
                  }`}
                >
                  {t.is_stale ? "غير نشط (>24 ساعة)" : t.last_status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
      <p className="mt-6 text-xs text-white/40">
        آخر تحقق: {data?.checked_at ? new Date(data.checked_at).toLocaleString("ar-SA") : "—"}
      </p>
    </div>
  );
}
