/**
 * OperationsLayout – Field mode (employee ID A/B)
 * Glass header + floating mobile bottom bar, touch targets ≥44px
 */
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import AnimatedBackground from "../components/AnimatedBackground";

function BrandLogo({ slug }: { slug?: string | null }) {
  const initial = (slug || "?").charAt(0).toUpperCase();
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-lg font-bold text-emerald-600 dark:bg-emerald-500/30 dark:text-emerald-400">
      {initial}
    </div>
  );
}

const navLinkClass = (isActive: boolean) =>
  "block min-h-[44px] min-w-[44px] rounded-2xl px-4 py-3 text-sm font-medium transition " +
  (isActive
    ? "bg-emerald-500/20 text-emerald-600 shadow-[0_0_0_2px_rgba(16,185,129,0.3)] dark:bg-emerald-500/25 dark:text-emerald-400"
    : "text-slate-600 hover:bg-slate-100 hover:text-charcoal dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200");

export default function OperationsLayout() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { dark, setDark } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const isRTL = i18n.language === "ar";
  const displayName = user?.display_name || user?.username || "-";
  const employeeId = user?.employee_id || "-";
  const branchName = user?.branch_name || "-";
  const brandSlug = user?.brand_slug;

  const navItems = [
    { to: "/", label: t("opsHome"), end: true },
    { to: "/pos", label: t("posCashier"), end: false },
    { to: "/employee-self", label: t("employeeSelfService"), end: false },
    { to: "/dashboard/heartbeat", label: t("cafeHeartbeat"), end: false },
    { to: "/shift-closing", label: t("opsShiftOps"), end: false },
    { to: "/prep-list", label: t("opsPrepList"), end: false },
    { to: "/stock-transfers", label: t("stockTransfers"), end: false },
    { to: "/central-kitchen", label: t("centralKitchen"), end: false },
    { to: "/smart-purchase", label: t("smartPurchase"), end: false },
    { to: "/profit-dashboard", label: t("financialDashboard"), end: false },
    { to: "/waste-tracker", label: t("wasteEntry"), end: false },
  ];

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="relative min-h-screen bg-transparent font-sans text-charcoal antialiased dark:text-slate-100">
      <AnimatedBackground />
      <header
        className="sticky top-0 z-[9999] border-b border-slate-200/50 dark:border-white/5 dark:bg-slate-900/90"
        style={{
          background: "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <div className="mx-auto flex w-full max-w-[1920px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <BrandLogo slug={brandSlug} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-charcoal dark:text-slate-100">{displayName}</div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>ID: {employeeId}</span>
                <span className="hidden text-slate-400 sm:inline">|</span>
                <span className="truncate">{branchName}</span>
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-100 hover:text-charcoal dark:hover:bg-white/10 dark:hover:text-slate-200 sm:hidden"
              aria-label="Toggle menu"
            >
              {menuOpen ? "✕" : "☰"}
            </button>
            <div
              className={`fixed inset-x-4 top-[60px] z-[9998] flex flex-col gap-1 rounded-2xl p-4 sm:static sm:flex sm:flex-row sm:gap-2 sm:rounded-none sm:p-0 ${
                menuOpen ? "flex" : "hidden sm:flex"
              }`}
              style={
                menuOpen
                  ? {
                      background: "rgba(255, 255, 255, 0.95)",
                      backdropFilter: "blur(20px)",
                      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
                      border: "1px solid rgba(148, 163, 184, 0.2)",
                    }
                  : undefined
              }
            >
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => navLinkClass(isActive)}
                >
                  {item.label}
                </NavLink>
              ))}
              <div className="my-1 border-t border-slate-200 sm:hidden" />
              <button
                type="button"
                onClick={() => i18n.changeLanguage(isRTL ? "en" : "ar")}
                className="min-h-[44px] min-w-[44px] rounded-2xl px-3 py-2 text-start text-sm text-slate-500 hover:bg-slate-100 sm:text-center dark:hover:bg-white/10 dark:hover:text-slate-200"
              >
                {isRTL ? "EN" : "ع"}
              </button>
              <button
                type="button"
                onClick={() => setDark((d) => !d)}
                className="min-h-[44px] min-w-[44px] rounded-2xl px-3 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 dark:hover:text-slate-200"
              >
                {dark ? "☀️" : "🌙"}
              </button>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); logout(); }}
                className="min-h-[44px] rounded-2xl px-4 py-3 text-start text-sm text-slate-500 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-white/10 dark:hover:text-rose-400"
              >
                {t("logout")}
              </button>
            </div>
          </nav>
        </div>
      </header>
      <main className="relative z-10 mx-auto w-full max-w-[1920px] px-4 py-6 pb-24 sm:px-6">
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
