/**
 * صفحة قائمة التنبيهات – عرض جميع التنبيهات مع إمكانية تعليمها كمقروءة
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { fetchAdminNotifications, type AdminNotificationItem } from "../lib/api";
import { useNotifications } from "../contexts/NotificationContext";

function formatTimeAgo(iso: string, isRTL: boolean): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (isRTL) {
      if (diffMins < 1) return "الآن";
      if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
      if (diffHours < 24) return `منذ ${diffHours} ساعة`;
      if (diffDays < 7) return `منذ ${diffDays} يوم`;
    } else {
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
    }
    return d.toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return "";
  }
}

export default function NotificationsListPage() {
  const { t, i18n } = useTranslation();
  const notificationsContext = useNotifications();
  const markAsRead = notificationsContext?.markAsRead;
  const refresh = notificationsContext?.refresh;
  const isRTL = i18n.language === "ar";

  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchAdminNotifications(50);
      setNotifications(list);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAll = async () => {
    if (notifications.length === 0 || marking || !markAsRead) return;
    setMarking(true);
    try {
      await markAsRead(notifications.map((n) => n.id));
      setNotifications([]);
      refresh?.();
    } catch {
      // Toast from context
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)]" style={{ fontFamily: "Inter, Lexend, Tajawal, system-ui, sans-serif" }}>
      <div className="mb-6">
        <Link
          to="/admin-hub"
          className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
        >
          ← {isRTL ? "العودة للوحة الإدارة" : "Back to Admin"}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
          {isRTL ? "جميع التنبيهات" : t("notifications")}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isRTL ? "قائمة بجميع التنبيهات غير المقروءة" : "All unread notifications"}
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="aqua-glass-card rounded-2xl p-12 text-center text-slate-500 dark:text-slate-400">
          <div className="text-4xl">🔔</div>
          <p className="mt-4 text-lg font-medium">
            {isRTL ? "لا توجد تنبيهات" : "No notifications"}
          </p>
          <p className="mt-1 text-sm">
            {isRTL ? "جميع التنبيهات معلمة كمقروءة" : "All notifications have been marked as read"}
          </p>
          <Link
            to="/admin-hub/notification-settings"
            className="mt-4 inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
          >
            {t("notificationSettings")}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {notifications.length} {isRTL ? "تنبيه" : "notification(s)"}
            </span>
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={marking}
              className="min-h-[44px] touch-manipulation rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
              style={{ touchAction: "manipulation" }}
            >
              {marking ? (isRTL ? "جاري..." : "Marking...") : t("markAllAsRead")}
            </button>
          </div>

          {notifications.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="aqua-glass-card flex gap-4 rounded-2xl p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538.214 1.055.595 1.43L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-800 dark:text-white">{n.title}</div>
                {n.message && (
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{n.message}</div>
                )}
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-500">
                  {formatTimeAgo(n.created_at, isRTL)}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <Link
          to="/admin-hub/notification-settings"
          className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
        >
          {t("notificationSettings")} →
        </Link>
      </div>
    </div>
  );
}
