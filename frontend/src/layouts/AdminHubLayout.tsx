/**
 * AdminHubLayout – RealEstate Pro aesthetic
 * Glass header + floating layout with 24–32px gutters
 */
import { useState, useRef } from "react";
import { Link, Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationContext";
import { useTheme } from "../contexts/ThemeContext";
import AnimatedBackground from "../components/AnimatedBackground";
import NotificationsDropdown from "../components/NotificationsDropdown";
import OwnerSignatureFooter from "../components/OwnerSignatureFooter";

export default function AdminHubLayout() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const notifications = useNotifications();
  const { dark, toggleTheme } = useTheme();
  const isRTL = i18n.language === "ar";
  const [notifOpen, setNotifOpen] = useState(false);
  const notifAnchorRef = useRef<HTMLButtonElement>(null);

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="relative min-h-screen bg-transparent font-sans text-charcoal antialiased dark:text-slate-100">
      <AnimatedBackground />
      <header
        className="relative sticky top-0 z-[9999] h-12"
        style={{
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(0, 255, 204, 0.2)",
        }}
      >
        <div className="mx-auto flex h-full w-full max-w-[1920px] items-center justify-between gap-4 px-6 sm:px-8">
          {/* Top left: User name (SAIF) + org email */}
          <div className="flex min-w-0 items-center gap-4">
            <Link
              to="/"
              className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-slate-100"
            >
              <span className={isRTL ? "rotate-180" : ""}>←</span>
              {t("backToOperations")}
            </Link>
            <div className="h-5 w-px shrink-0 bg-white/20" />
            <div className="hidden min-w-0 truncate sm:block">
              <div className="truncate text-sm font-semibold text-slate-100">{user?.username ?? "—"}</div>
              <div className="truncate text-xs text-slate-400">{user?.email || "—"}</div>
            </div>
          </div>

          {/* Center: Smart Operations Center logo */}
          <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#00ffcc]/20 text-[#00ffcc]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-100">{t("appName")}</span>
            </div>
            <span className="text-[10px] text-slate-400">{t("adminDashboard")}</span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                ref={notifAnchorRef}
                type="button"
                onClick={() => setNotifOpen((o) => !o)}
                className="relative rounded-xl p-2.5 text-slate-400 transition hover:bg-[#00ffcc]/10 hover:text-[#00ffcc]"
                title={t("notifications")}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538.214 1.055.595 1.43L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {notifications && notifications.unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#00ffcc] text-[10px] font-bold text-slate-900">
                    {notifications.unreadCount > 9 ? "9+" : notifications.unreadCount}
                  </span>
                )}
              </button>
              <NotificationsDropdown
                open={notifOpen}
                onClose={() => setNotifOpen(false)}
                anchorRef={notifAnchorRef}
                notifications={notifications?.notifications ?? []}
                unreadCount={notifications?.unreadCount ?? 0}
                markAsRead={notifications?.markAsRead ?? (async () => {})}
              />
            </div>
            <button
              type="button"
              onClick={() => i18n.changeLanguage(isRTL ? "en" : "ar")}
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
            >
              {isRTL ? "EN" : "AR"}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-xl px-3 py-2 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
            >
              {dark ? "☀️" : "🌙"}
            </button>
            <button
              type="button"
              onClick={() => logout()}
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-white/10 hover:text-rose-400"
              title={t("logout")}
            >
              {t("logout")}
            </button>
          </div>
        </div>
      </header>

      <main className="pb-content-footer relative z-10 mx-auto w-full max-w-[1920px] px-6 py-6 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <Outlet />
        </motion.div>
        <OwnerSignatureFooter />
      </main>
    </div>
  );
}
