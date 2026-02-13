import { useState, useRef } from "react";
import { Link, Outlet } from "react-router-dom";
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
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="relative min-h-screen bg-transparent font-['Inter',Tajawal,sans-serif]"
    >
      <AnimatedBackground />
      <header className={`overflow-visible ${dark ? "glass-panel sticky top-0 z-[9999] border-0" : "header-white sticky top-0 z-[9999] rounded-b-xl"}`}>
        <div className="mx-auto flex w-full max-w-[1920px] flex-wrap items-center justify-between gap-2 overflow-visible px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="glass-btn flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/90 hover:text-white"
            >
              <span className={isRTL ? "rotate-180" : ""}>←</span>
              {t("backToOperations")}
            </Link>
            <div className="h-6 w-px bg-white/20" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-white">{t("appName")}</div>
              <div className="text-xs text-white/60">
                {t("adminDashboard")}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                ref={notifAnchorRef}
                type="button"
                onClick={() => setNotifOpen((o) => !o)}
                className="relative rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white"
                title={t("notifications")}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538.214 1.055.595 1.43L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {notifications && notifications.unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
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
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00b074] text-sm font-bold text-white">
              {(user?.username ?? "U").charAt(0).toUpperCase()}
            </div>
            <div className="hidden min-w-0 sm:block text-xs text-white/80">
              <span className="font-semibold">{user?.username ?? "—"}</span>
              <span className="mx-1 text-white/40">|</span>
              <span className="text-white/60">
                {user?.email || "—"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => i18n.changeLanguage(isRTL ? "en" : "ar")}
              className="glass-btn rounded-lg px-3 py-2 text-white/80 hover:text-white"
            >
              {isRTL ? "EN" : "AR"}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="glass-btn rounded-lg px-3 py-2 text-white/80 hover:text-white"
            >
              {dark ? "☀️" : "🌙"}
            </button>
            <button
              type="button"
              onClick={() => logout()}
              className="glass-btn rounded-lg px-3 py-2 text-white/80 hover:text-white"
              title={t("logout")}
            >
              {t("logout")}
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-[1920px] px-4 py-6 pb-20 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      <OwnerSignatureFooter />
    </div>
  );
}
