/**
 * OperationsLayout – Field mode (employee ID A/B)
 * Desktop (≥1024px): horizontal top nav
 * Tablet/iPad (<1024px): hamburger → smooth slide-out drawer
 * Mobile (<640px): hamburger → full-screen drawer
 */
import { useState, useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import AnimatedBackground from "../components/AnimatedBackground";

function BrandLogo({ slug }: { slug?: string | null }) {
  const initial = (slug || "?").charAt(0).toUpperCase();
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-base font-bold text-emerald-600 dark:bg-emerald-500/30 dark:text-emerald-400">
      {initial}
    </div>
  );
}

const DRAWER_WIDTH = 280;

export default function OperationsLayout() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { dark, setDark } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const isRTL = i18n.language === "ar";
  const displayName = user?.display_name || user?.username || "-";
  const employeeId = user?.employee_id || "-";
  const branchName = user?.branch_name || "-";
  const brandSlug = user?.brand_slug;

  /* close drawer on route change */
  const prevPath = useRef(location.pathname);
  useEffect(() => {
    if (prevPath.current !== location.pathname) {
      prevPath.current = location.pathname;
      setDrawerOpen(false);
    }
  }, [location.pathname]);

  /* close drawer on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawerOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const navItems = [
    { to: "/",                  label: t("opsHome"),           icon: "🏠" },
    { to: "/pos",               label: t("posCashier"),        icon: "🖥️" },
    { to: "/employee-self",     label: t("employeeSelfService"), icon: "👤" },
    { to: "/dashboard/heartbeat", label: t("cafeHeartbeat"),   icon: "💚" },
    { to: "/shift-closing",     label: t("opsShiftOps"),       icon: "🕐" },
    { to: "/prep-list",         label: t("opsPrepList"),        icon: "📋" },
    { to: "/stock-transfers",   label: t("stockTransfers"),    icon: "🔄" },
    { to: "/central-kitchen",   label: t("centralKitchen"),    icon: "🍳" },
    { to: "/smart-purchase",    label: t("smartPurchase"),     icon: "🛒" },
    { to: "/profit-dashboard",  label: t("financialDashboard"),icon: "📊" },
    { to: "/waste-tracker",     label: t("wasteEntry"),        icon: "🗑️" },
  ];

  const navLinkActive =
    "bg-emerald-500/20 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-400 font-semibold";
  const navLinkIdle =
    "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-100";

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="relative min-h-screen bg-transparent font-sans text-charcoal antialiased dark:text-slate-100"
    >
      <AnimatedBackground />

      {/* ── Top Header ─────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-[9999] border-b border-slate-200/50 dark:border-white/5"
        style={{
          background: dark ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <div className="mx-auto flex w-full max-w-[1920px] items-center gap-3 px-4 py-2.5">

          {/* Hamburger – tablet/mobile only (< lg) */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-emerald-500/10 hover:text-emerald-600 lg:hidden"
            aria-label="Open navigation"
            style={{ touchAction: "manipulation" }}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Logo + user info */}
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo slug={brandSlug} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold" style={{ color: "var(--shell-text, #1e293b)" }}>
                {displayName}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span>ID: {employeeId}</span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="truncate max-w-[120px]">{branchName}</span>
              </div>
            </div>
          </div>

          {/* Desktop horizontal nav (≥ lg / 1024px) */}
          <nav className="hidden flex-1 items-center gap-1 overflow-x-auto lg:flex" style={{ scrollbarWidth: "none" }}>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition ${isActive ? navLinkActive : navLinkIdle}`
                }
              >
                <span className="me-1.5">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Utility buttons */}
          <div className="ms-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => i18n.changeLanguage(isRTL ? "en" : "ar")}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-slate-500 transition hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
              aria-label="Change language"
            >
              {isRTL ? "EN" : "ع"}
            </button>
            <button
              type="button"
              onClick={() => setDark((d) => !d)}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-emerald-500/10"
              aria-label={dark ? "Light mode" : "Dark mode"}
            >
              {dark ? "☀️" : "🌙"}
            </button>
            <button
              type="button"
              onClick={() => logout()}
              className="hidden h-10 rounded-xl px-3 text-sm text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20 dark:hover:text-rose-400 lg:flex items-center"
            >
              {t("logout")}
            </button>
          </div>
        </div>
      </header>

      {/* ── Tablet/Mobile: Slide-out Drawer ────────────────────────── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[10002] bg-black/50 backdrop-blur-sm lg:hidden"
              onClick={() => setDrawerOpen(false)}
              aria-hidden
            />

            {/* Drawer panel */}
            <motion.aside
              initial={{ x: isRTL ? DRAWER_WIDTH : -DRAWER_WIDTH, opacity: 0.8 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: isRTL ? DRAWER_WIDTH : -DRAWER_WIDTH, opacity: 0.8 }}
              transition={{ type: "tween", duration: 0.28, ease: "easeOut" }}
              className="fixed top-0 z-[10003] flex h-full flex-col shadow-2xl lg:hidden"
              style={{
                width: DRAWER_WIDTH,
                ...(isRTL ? { right: 0 } : { left: 0 }),
                background: dark ? "rgba(15,23,42,0.97)" : "rgba(255,255,255,0.97)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                borderInlineEnd: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.06)",
              }}
            >
              {/* Drawer header */}
              <div className="flex h-14 items-center justify-between border-b border-slate-200/50 px-4 dark:border-white/8">
                <div className="flex items-center gap-3">
                  <BrandLogo slug={brandSlug} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{displayName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">ID: {employeeId}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
                  aria-label="Close menu"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Branch info strip */}
              <div className="border-b border-slate-100 px-4 py-2 dark:border-white/5">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {branchName}
                </div>
              </div>

              {/* Nav items */}
              <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    onClick={() => setDrawerOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                        isActive ? navLinkActive : navLinkIdle
                      }`
                    }
                    style={{ minHeight: 44 }}
                  >
                    <span className="text-base">{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </nav>

              {/* Drawer footer */}
              <div className="flex items-center justify-between gap-2 border-t border-slate-200/50 p-3 dark:border-white/8">
                <button
                  type="button"
                  onClick={() => { i18n.changeLanguage(isRTL ? "en" : "ar"); setDrawerOpen(false); }}
                  className="flex h-11 flex-1 items-center justify-center rounded-xl text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
                >
                  {isRTL ? "EN" : "العربية"}
                </button>
                <button
                  type="button"
                  onClick={() => { setDark((d) => !d); }}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
                  aria-label={dark ? "Light mode" : "Dark mode"}
                >
                  {dark ? "☀️" : "🌙"}
                </button>
                <button
                  type="button"
                  onClick={() => { logout(); setDrawerOpen(false); }}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  {t("logout")}
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main content ───────────────────────────────────────────── */}
      <main className="relative z-10 mx-auto w-full max-w-[1920px] px-4 py-6 pb-10 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
