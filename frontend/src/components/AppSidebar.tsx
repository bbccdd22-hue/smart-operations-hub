import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

const navItems = [
  { to: "/dashboard", end: true, icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", labelKey: "dashboard" },
  { to: "/dashboard/heartbeat", end: false, icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z", labelKey: "cafeHeartbeat" },
  { to: "/forecast", end: false, icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", labelKey: "forecast" },
  { to: "/prep-list", end: false, icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", labelKey: "opsPrepList" },
  { to: "/shift-closing", end: false, icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", labelKey: "shiftClosing" },
  { to: "/upload-center", end: false, icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12", labelKey: "uploadCenter" },
  { to: "/ingredients", end: false, icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10", labelKey: "recipeInventory" },
  { to: "/profit-dashboard", end: false, icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", labelKey: "financialDashboard" },
  { to: "/waste-tracker", end: false, icon: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16", labelKey: "wasteEntry" },
  { to: "/reconciliation", end: false, icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z", labelKey: "reconciliation" },
];

export default function AppSidebar({
  showAdminHub,
  isBranchSupervisor,
}: {
  showAdminHub: boolean;
  isBranchSupervisor: boolean;
}) {
  const { t } = useTranslation();
  const filtered = navItems.filter(
    (n) => (n.to !== "/forecast" && n.to !== "/upload-center") || !isBranchSupervisor
  );
  const adminItem = { to: "/admin-hub", end: false, icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", labelKey: "adminDashboard" };

  return (
    <aside className="hidden w-[72px] shrink-0 flex-col items-center gap-1 border-r border-slate-200/80 bg-slate-50/80 py-4 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/80 lg:flex">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
        <span className="font-bold">S</span>
      </div>
      {filtered.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl transition-all duration-200 ${
              isActive
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/35"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            }`
          }
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
          </svg>
        </NavLink>
      ))}
      {showAdminHub && (
        <NavLink
          to={adminItem.to}
          end={adminItem.end}
          className={({ isActive }) =>
            `mt-2 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl transition-all duration-200 ${
              isActive
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/35"
                : "text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400"
            }`
          }
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={adminItem.icon} />
          </svg>
        </NavLink>
      )}
    </aside>
  );
}
