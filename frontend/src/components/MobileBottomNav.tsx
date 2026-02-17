import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

type NavItem = { to: string; end: boolean; icon: string; labelKey: string; center?: boolean };

const mobileNavItems: NavItem[] = [
  { to: "/dashboard", end: true, icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", labelKey: "dashboard" },
  { to: "/ingredients", end: false, icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10", labelKey: "recipeInventory" },
  { to: "/", end: true, icon: "M13 10V3L4 14h7v7l9-11h-7z", labelKey: "opsHome", center: true },
  { to: "/profit-dashboard", end: false, icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", labelKey: "financialDashboard" },
  { to: "/admin-hub", end: false, icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z", labelKey: "adminDashboard" },
];

export default function MobileBottomNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const isDashboard = location.pathname === "/" || location.pathname === "/dashboard";

  return (
    <nav
      className="fixed bottom-6 left-4 right-4 z-[9998] flex items-center justify-center gap-1 rounded-[32px] px-2 py-2 md:hidden"
      style={{
        background: "rgba(255, 255, 255, 0.9)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(148, 163, 184, 0.2)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
      }}
    >
      {mobileNavItems.map((item) => {
        const isCenter = "center" in item && item.center;
        const isActive =
          item.to === "/"
            ? isDashboard
            : location.pathname === item.to || (item.to !== "/dashboard" && location.pathname.startsWith(item.to));

        if (isCenter) {
          return (
            <NavLink
              key="center"
              to="/"
              end
              className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/35 transition-all active:scale-95"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
            </NavLink>
          );
        }

        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={`flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 transition ${
              isActive
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
            </svg>
            <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
