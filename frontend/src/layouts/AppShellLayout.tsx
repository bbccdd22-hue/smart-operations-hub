/**
 * AppShellLayout – RealEstate Pro aesthetic
 * Slim translucent sidebar (desktop) + floating mobile bottom bar
 * Soft neumorphism + glassmorphism, 24–32px gutters/radius
 */
import { useState, useRef } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationContext";
import { useTheme } from "../contexts/ThemeContext";
import AnimatedBackground from "../components/AnimatedBackground";
import NotificationsDropdown from "../components/NotificationsDropdown";
import OwnerSignatureFooter from "../components/OwnerSignatureFooter";
import type { SystemHealthItem } from "../lib/api";

const MOBILE_BAR_HEIGHT = 72;
const SIDEBAR_WIDTH = 260; /* Icon + label, accommodates Arabic text clearly */

type NavItem = { to: string; label: string; icon: React.ReactNode; primary?: boolean };
type NavConfig = { items: NavItem[]; show?: boolean };

export default function AppShellLayout({
  navConfig,
  health,
  healthOpen,
  setHealthOpen,
}: {
  navConfig: NavConfig[];
  health: SystemHealthItem[] | null;
  healthOpen: boolean;
  setHealthOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const notifications = useNotifications();
  const { dark, setDark } = useTheme();
  const isRTL = i18n.language === "ar";
  const [notifOpen, setNotifOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const notifAnchorRef = useRef<HTMLButtonElement>(null);

  const allNavItems = navConfig.flatMap((c) => (c.show !== false ? c.items : []));
  const primaryItem = allNavItems.find((n) => n.primary) ?? allNavItems[0];
  const secondaryItems = allNavItems.filter((n) => n !== primaryItem);

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="terminal-theme app-shell-root relative min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-transparent font-sans text-slate-100 antialiased"
    >
      <AnimatedBackground />
      {/* Desktop: Fixed Sidebar – right side (RTL) or left side (LTR); prevents layout shift */}
      <aside
        className="app-shell-sidebar fixed top-0 bottom-0 z-[9996] hidden h-screen flex-col lg:flex"
        style={{
          width: SIDEBAR_WIDTH,
          ...(isRTL ? { right: 0, left: "auto" } : { left: 0, right: "auto" }),
        }}
      >
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-white/5 px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#00ffcc]/20 text-[#00ffcc]">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="truncate text-sm font-semibold text-slate-100">{t("appName")}</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {allNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/" || item.to === "/dashboard"}
              title={item.label}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-[#00ffcc]/15 text-[#00ffcc] shadow-[0_0_0_2px_rgba(0,255,204,0.3)]"
                    : "text-slate-400 hover:bg-white/8 hover:text-slate-200"
                }`
              }
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center [&>svg]:h-5 [&>svg]:w-5">
                {item.icon}
              </span>
              <span className="min-w-0 overflow-hidden text-ellipsis">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-col gap-1 border-t border-white/5 p-3">
          <button
            type="button"
            onClick={() => setDark((d) => !d)}
            className="flex items-center gap-3 rounded-2xl px-4 py-2.5 text-slate-400 hover:bg-white/5"
            title={dark ? "Light mode" : "Dark mode"}
          >
            <span className="text-lg">{dark ? "☀️" : "🌙"}</span>
            <span className="text-sm">{dark ? "Light" : "Dark"}</span>
          </button>
          <button
            type="button"
            onClick={() => i18n.changeLanguage(isRTL ? "en" : "ar")}
            className="flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-100/80 dark:hover:bg-white/5"
          >
            <span className="text-sm font-medium">{isRTL ? "EN" : "AR"}</span>
            <span className="text-xs text-slate-400">{isRTL ? "English" : "العربية"}</span>
          </button>
        </div>
      </aside>

      {/* Slim header – fixed top, subtle blur, Aqua accent */}
      <header
        className="fixed top-0 z-[9997] hidden h-12 lg:block"
        style={{
          ...(isRTL ? { left: 0, right: SIDEBAR_WIDTH, width: `calc(100vw - ${SIDEBAR_WIDTH}px)` } : { left: SIDEBAR_WIDTH, right: 0, width: `calc(100vw - ${SIDEBAR_WIDTH}px)` }),
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(0, 255, 204, 0.2)",
        }}
      >
        <div className="flex h-full w-full items-center justify-between gap-4 px-6">
          {/* Search bar – Emerald accent */}
          <div className="flex flex-1 max-w-md items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur-xl transition focus-within:border-[#00ffcc]/50 focus-within:ring-2 focus-within:ring-[#00ffcc]/20 focus-within:shadow-[0_0_20px_rgba(0,255,204,0.12)]">
            <svg className="h-4 w-4 shrink-0 text-[#00ffcc]/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              placeholder={t("search")}
              className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none"
              aria-label={t("search")}
            />
          </div>

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
              onClick={() => setHealthOpen((o) => !o)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-slate-400 transition hover:bg-[#00ffcc]/10 hover:text-[#00ffcc]"
              title="System health"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  health?.some((u) => u.last_sync) ? "animate-pulse bg-[#00ffcc]" : "bg-amber-400"
                }`}
              />
              <span className="text-sm font-medium">{t("health")}</span>
            </button>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00ffcc] text-sm font-bold text-slate-900 shadow-[0_2px_12px_rgba(0,255,204,0.35)]">
                {(user?.username ?? "U").charAt(0).toUpperCase()}
              </div>
              <div className="hidden text-left sm:block">
                <div className="text-sm font-semibold text-slate-100">{user?.username ?? "—"}</div>
                <div className="text-xs text-[#00ffcc]/80">{user?.role ?? "—"}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="rounded-xl px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-white/10 dark:hover:text-rose-400"
              title={t("logout")}
            >
              {t("logout")}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile / iPad: Pinned compact header – unified deep dark theme */}
      <header
        className="fixed left-0 right-0 top-0 z-[9998] flex h-12 w-full items-center justify-between gap-3 px-4 lg:hidden"
        style={{
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(0, 255, 204, 0.2)",
        }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-[#00ffcc]/10 hover:text-[#00ffcc]"
            aria-label="Open menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#00ffcc]/20 text-[#00ffcc]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-100">{t("appName")}</div>
            <div className="truncate text-[11px] text-slate-400">{user?.username ?? "—"}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            ref={notifAnchorRef}
            type="button"
            onClick={() => setNotifOpen((o) => !o)}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-[#00ffcc]/10 hover:text-[#00ffcc]"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538.214 1.055.595 1.43L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {notifications && notifications.unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#00ffcc] text-[9px] font-bold text-slate-900">
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
          {/* Compact profile bubble */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00ffcc] text-xs font-bold text-slate-900 shadow-[0_2px_6px_rgba(0,255,204,0.35)]">
            {(user?.username ?? "U").charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      {/* Main content – full width mobile; viewport minus fixed sidebar on desktop */}
      <main
        className={`main-content-area relative z-10 flex flex-col overflow-x-hidden overflow-y-auto pb-mobile-nav ${isRTL ? "sidebar-right" : "sidebar-left"}`}
        style={{
          width: "100%",
          maxWidth: "100%",
          minHeight: "100vh",
          padding: "3.5rem 24px 6rem 24px",
        }}
      >
        <div
          className="main-content-inner flex min-h-0 flex-1 flex-col w-full min-w-0 overflow-y-auto overflow-x-hidden pb-content-footer pt-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex min-h-full min-w-0 flex-1 flex-col"
          >
            <Outlet />
          </motion.div>
          <OwnerSignatureFooter />
        </div>
      </main>

      {/* Mobile: Floating bottom bar with center prominent action */}
      <nav
        className="fixed inset-x-0 bottom-0 z-[9999] lg:hidden"
        style={{
          height: MOBILE_BAR_HEIGHT,
          paddingBottom: "env(safe-area-inset-bottom, 0)",
        }}
      >
        <div
          className={`mx-4 mb-4 flex h-full items-center justify-between gap-0 rounded-3xl px-2 ${
            dark
              ? "border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.25),0_0_24px_rgba(16,185,129,0.08)]"
              : "border border-slate-200/40 shadow-[0_4px_24px_rgba(0,0,0,0.08),0_0_24px_rgba(16,185,129,0.06)]"
          }`}
          style={{
            background: dark ? "rgba(15, 23, 42, 0.88)" : "rgba(255, 255, 255, 0.82)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
          }}
        >
          {secondaryItems.slice(0, 2).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-medium transition ${
                  isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"
                }`
              }
            >
              {item.icon}
              <span className="truncate max-w-[60px]">{item.label}</span>
            </NavLink>
          ))}
          {/* Center prominent FAB */}
          <NavLink
            to={primaryItem.to}
            end={primaryItem.to === "/"}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-[0_4px_14px_rgba(16,185,129,0.4)] transition hover:bg-emerald-600 hover:shadow-[0_4px_20px_rgba(16,185,129,0.5)]"
            aria-label={primaryItem.label}
          >
            {primaryItem.icon}
          </NavLink>
          {secondaryItems.slice(2, 4).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-medium transition ${
                  isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"
                }`
              }
            >
              {item.icon}
              <span className="truncate max-w-[60px]">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Mobile / iPad: Slide-out drawer (hamburger menu) */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[10002] bg-black/40 lg:hidden"
              onClick={() => setDrawerOpen(false)}
              aria-hidden
            />
            <motion.aside
              initial={{ x: isRTL ? SIDEBAR_WIDTH : -SIDEBAR_WIDTH }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? SIDEBAR_WIDTH : -SIDEBAR_WIDTH }}
              transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
              className="fixed top-0 z-[10003] flex h-full flex-col bg-white/95 shadow-2xl backdrop-blur-xl dark:bg-slate-900/95 lg:hidden"
              style={{
                width: SIDEBAR_WIDTH,
                ...(isRTL ? { right: 0 } : { left: 0 }),
              }}
            >
              <div className="flex h-14 items-center justify-between border-b border-slate-200/50 px-4 dark:border-white/5">
                <span className="text-sm font-semibold text-charcoal dark:text-slate-100">{t("appName")}</span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                  aria-label="Close menu"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
                {allNavItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/" || item.to === "/dashboard"}
                    onClick={() => setDrawerOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                        isActive
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/8"
                      }`
                    }
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center [&>svg]:h-5 [&>svg]:w-5">
                      {item.icon}
                    </span>
                    <span className="min-w-0 overflow-hidden text-ellipsis">{item.label}</span>
                  </NavLink>
                ))}
              </nav>
              <div className="flex gap-2 border-t border-slate-200/50 p-3 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => { setDark((d) => !d); setDrawerOpen(false); }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm text-slate-600 dark:text-slate-400"
                >
                  {dark ? "☀️" : "🌙"} {dark ? "Light" : "Dark"}
                </button>
                <button
                  type="button"
                  onClick={() => { i18n.changeLanguage(isRTL ? "en" : "ar"); setDrawerOpen(false); }}
                  className="flex flex-1 items-center justify-center rounded-xl py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400"
                >
                  {isRTL ? "EN" : "AR"}
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Health dropdown overlay */}
      <AnimatePresence>
        {healthOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/20 lg:bg-transparent"
            onClick={() => setHealthOpen(false)}
            aria-hidden
          />
        )}
      </AnimatePresence>
      {healthOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="fixed right-4 top-20 z-[10001] w-72 rounded-2xl p-4 lg:right-6 lg:top-20"
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(148, 163, 184, 0.2)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
          }}
        >
          <div className="text-sm font-semibold text-charcoal">Last Excel sync</div>
          {health?.length ? (
            <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
              {health.map((u) => (
                <li key={u.report_type}>
                  <span className="font-medium">{u.label}</span>:{" "}
                  {u.last_sync ? new Date(u.last_sync).toLocaleString() : "Never"}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-slate-500">No uploads yet.</p>
          )}
          <button
            type="button"
            className="mt-3 w-full rounded-xl bg-slate-100 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
            onClick={() => setHealthOpen(false)}
          >
            {t("close")}
          </button>
        </motion.div>
      )}
    </div>
  );
}

export { type NavItem, type NavConfig };
