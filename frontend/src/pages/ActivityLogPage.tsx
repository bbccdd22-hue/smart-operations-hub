import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { fetchActivityLog, type ActivityLogEntry } from "../lib/api";

const ACTION_LABELS: Record<string, string> = {
  login: "تسجيل دخول",
  page_view: "عرض صفحة",
  file_upload: "رفع ملف",
  create: "إنشاء",
  update: "تعديل",
  delete: "حذف",
  export: "تصدير",
};

export default function ActivityLogPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = user?.username === "SAIF";
  const canViewActivityLog = isSuperAdmin || !!user?.permissions?.view_activity_log;
  useEffect(() => {
    if (user && !canViewActivityLog) {
      navigate("/admin-hub", { replace: true });
      return;
    }
  }, [user, canViewActivityLog, navigate]);

  useEffect(() => {
    if (!user || !canViewActivityLog) {
      setLoading(false);
      return;
    }
    fetchActivityLog(500)
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [user, canViewActivityLog]);

  if (!user) return null;
  if (user && !canViewActivityLog) return null; // redirecting
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <div className="mb-6">
        <Link to="/admin-hub" className="text-sm text-white/70 hover:text-white">
          ← {t("adminDashboard")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">سجل الرقابة</h1>
        <p className="mt-1 text-sm text-white/60">
          تسجيل الدخول، الصفحات المعروضة، الملفات المرفوعة
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-card overflow-hidden rounded-2xl"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-right">
                <th className="px-4 py-3 font-medium text-white/90">الوقت</th>
                <th className="px-4 py-3 font-medium text-white/90">المستخدم</th>
                <th className="px-4 py-3 font-medium text-white/90">النوع</th>
                <th className="px-4 py-3 font-medium text-white/90">الصفحة</th>
                <th className="px-4 py-3 font-medium text-white/90">الملف</th>
                <th className="px-4 py-3 font-medium text-white/90">وصف</th>
                <th className="px-4 py-3 font-medium text-white/90">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-white/50">
                    لا توجد سجلات
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-white/5 transition hover:bg-white/5"
                  >
                    <td className="px-4 py-2.5 text-white/70">
                      {log.created_at
                        ? new Date(log.created_at).toLocaleString("ar-SA")
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-white/90">{log.username || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
                        {ACTION_LABELS[log.action_type] ?? log.action_type}
                      </span>
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-2.5 text-white/70">
                      {log.page_path || "—"}
                    </td>
                    <td className="max-w-[120px] truncate px-4 py-2.5 text-white/70">
                      {log.file_name || "—"}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-2.5 text-white/60">
                      {log.description || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-white/50 text-xs">
                      {log.ip_address || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
