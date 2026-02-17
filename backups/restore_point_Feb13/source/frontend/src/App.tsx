import { useEffect, useState, useRef } from "react";
import { NavLink, Route, Routes, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "./contexts/AuthContext";
import { useNotifications } from "./contexts/NotificationContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import AdminHubLayout from "./layouts/AdminHubLayout";
import DashboardPage from "./pages/DashboardPage";
import AdminHubPage from "./pages/AdminHubPage";
import BranchesPage from "./pages/BranchesPage";
import BrandsPage from "./pages/BrandsPage";
import TaxesPage from "./pages/TaxesPage";
import PaymentMethodsPage from "./pages/PaymentMethodsPage";
import ShiftClosingPage from "./pages/ShiftClosingPage";
import UploadCenterPage from "./pages/UploadCenterPage";
import IngredientsPage from "./pages/IngredientsPage";
import PredictiveDashboardPage from "./pages/PredictiveDashboardPage";
import ProductionPlannerPage from "./pages/ProductionPlannerPage";
import ReconciliationPage from "./pages/ReconciliationPage";
import SettingsPage from "./pages/SettingsPage";
import UsersPage from "./pages/UsersPage";
import UserProfilePage from "./pages/UserProfilePage";
import RolesPage from "./pages/RolesPage";
import NotificationSettingsPage from "./pages/NotificationSettingsPage";
import SmartUploadPage from "./pages/SmartUploadPage";
import LoginPage from "./pages/LoginPage";
import { fetchSystemHealth, type SystemHealthItem } from "./lib/api";
import { useTheme } from "./contexts/ThemeContext";
import AnimatedBackground from "./components/AnimatedBackground";
import ToastContainer from "./components/ToastContainer";
import NotificationsDropdown from "./components/NotificationsDropdown";
import OwnerSignatureFooter from "./components/OwnerSignatureFooter";

function classNames(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function App() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { dark, setDark } = useTheme();
  const isRTL = i18n.language === "ar";
  const [healthOpen, setHealthOpen] = useState(false);
  const [health, setHealth] = useState<SystemHealthItem[] | null>(null);

  const isBranchSupervisor = user?.role === "branch_supervisor";
  const isOwner = user?.role === "owner";
  const isSAIF = user?.username?.toLowerCase() === "saif";
  const showAdminHub = isOwner && isSAIF;

  useEffect(() => {
    fetchSystemHealth().then((r) => setHealth(r.last_uploads));
  }, []);
  useEffect(() => {
    if (healthOpen && health === null) fetchSystemHealth().then((r) => setHealth(r.last_uploads));
  }, [healthOpen, health]);

  const navClass = (isActive: boolean) =>
    classNames(
      "rounded-lg px-3 py-2 transition",
      dark
        ? isActive ? "glass-btn text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
        : isActive ? "bg-[#7C3AED] text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
    );

  return (
    <>
    <ToastContainer />
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin-hub"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminHubLayout />
            </AdminRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminHubPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/:id" element={<UserProfilePage />} />
        <Route path="notification-settings" element={<NotificationSettingsPage />} />
        <Route path="smart-upload" element={<SmartUploadPage />} />
        <Route path="roles" element={<RolesPage />} />
        <Route path="branches" element={<BranchesPage />} />
        <Route path="brands" element={<BrandsPage />} />
        <Route path="taxes" element={<TaxesPage />} />
        <Route path="payment-methods" element={<PaymentMethodsPage />} />
      </Route>
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout
              navClass={navClass}
              isRTL={isRTL}
              t={t}
              dark={dark}
              setDark={setDark}
              i18n={i18n}
              healthOpen={healthOpen}
              setHealthOpen={setHealthOpen}
              health={health}
              isBranchSupervisor={isBranchSupervisor}
              isOwner={isOwner}
              showAdminHub={showAdminHub}
              user={user}
            />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="forecast" element={<PredictiveDashboardPage />} />
        <Route path="production-planner" element={<ProductionPlannerPage />} />
        <Route path="shift-closing" element={<ShiftClosingPage />} />
        <Route path="reconciliation" element={<ReconciliationPage />} />
        <Route path="upload-center" element={<UploadCenterPage />} />
        <Route path="ingredients" element={<IngredientsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/users" element={<UsersPage />} />
        <Route path="settings/roles" element={<RolesPage />} />
      </Route>
    </Routes>
    </>
  );
}

function AppLayout({
  navClass,
  isRTL,
  t,
  dark,
  setDark,
  i18n,
  healthOpen,
  setHealthOpen,
  health,
  isBranchSupervisor,
  isOwner,
  showAdminHub,
  user,
}: {
  navClass: (a: boolean) => string;
  isRTL: boolean;
  t: (k: string) => string;
  dark: boolean;
  setDark: React.Dispatch<React.SetStateAction<boolean>>;
  i18n: { changeLanguage: (l: string) => void };
  healthOpen: boolean;
  setHealthOpen: React.Dispatch<React.SetStateAction<boolean>>;
  health: SystemHealthItem[] | null;
  isBranchSupervisor: boolean;
  isOwner: boolean;
  showAdminHub: boolean;
  user: { username: string; email?: string; role: string } | null;
}) {
  const { logout } = useAuth();
  const notifications = useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifAnchorRef = useRef<HTMLButtonElement>(null);

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="relative min-h-screen bg-transparent">
      <AnimatedBackground />
      <header className={`overflow-visible ${dark ? "glass-panel sticky top-0 z-[9999] border-0" : "header-white sticky top-0 z-[9999] rounded-b-xl"}`}>
        <div className="mx-auto flex w-full max-w-[1920px] flex-wrap items-center justify-between gap-2 overflow-visible px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/10" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-white">{t("appName")}</div>
              <div className="text-xs text-white/60">
                {user?.role === "owner"
                ? t("owner")
                : user?.role === "brand_manager"
                  ? t("brandManager")
                  : t("branchSupervisor")}
              </div>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            {(showAdminHub || isOwner) && (
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
            )}
            <div className="glass-btn flex items-center gap-2 rounded-lg px-3 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00b074] text-sm font-bold text-white">
                {(user?.username ?? "U").charAt(0).toUpperCase()}
              </div>
              <div className="hidden min-w-0 sm:block text-xs text-white/80">
                <span className="font-semibold">{user?.username ?? "—"}</span>
                <span className="mx-1 text-white/40">|</span>
                <span className="text-white/60">{user?.email || "—"}</span>
              </div>
            </div>
            <NavLink to="/dashboard" className={({ isActive }) => navClass(isActive)} end>
              {t("dashboard")}
            </NavLink>
            {!isBranchSupervisor && (
            <NavLink to="/forecast" className={({ isActive }) => navClass(isActive)}>
              {t("forecast")}
            </NavLink>
            )}
            <NavLink to="/production-planner" className={({ isActive }) => navClass(isActive)}>
              {t("productionPlanner")}
            </NavLink>
            <NavLink to="/shift-closing" className={({ isActive }) => navClass(isActive)}>
              {t("shiftClosing")}
            </NavLink>
            {!isBranchSupervisor && (
              <NavLink to="/upload-center" className={({ isActive }) => navClass(isActive)}>
                {t("uploadCenter")}
              </NavLink>
            )}
            <NavLink to="/ingredients" className={({ isActive }) => navClass(isActive)}>
              {t("recipeInventory")}
            </NavLink>
            <NavLink to="/reconciliation" className={({ isActive }) => navClass(isActive)}>
              {t("reconciliation")}
            </NavLink>
            {showAdminHub && (
              <>
                <NavLink
                  to="/admin-hub"
                  className={({ isActive }) =>
                    classNames(
                      "rounded-lg px-3 py-2 font-medium transition",
                      isActive
                        ? "bg-[#00b074] text-white"
                        : "glass-btn text-emerald-300 hover:text-emerald-200"
                    )
                  }
                >
                  {t("adminDashboard")}
                </NavLink>
                <NavLink to="/settings" className={({ isActive }) => navClass(isActive)}>
                  {t("settings")}
                </NavLink>
              </>
            )}
            {isOwner && !showAdminHub && (
              <NavLink to="/settings" className={({ isActive }) => navClass(isActive)}>
                {t("settings")}
              </NavLink>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setHealthOpen((o) => !o)}
                className="glass-btn flex items-center gap-2 rounded-lg px-3 py-2 text-white/80 hover:text-white"
                title="System health / Last Excel sync"
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    health?.some((u) => u.last_sync)
                      ? "animate-pulse bg-emerald-500"
                      : "bg-amber-400"
                  }`}
                />
                {t("health")}
              </button>
              {healthOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-72 rounded-xl p-3 shadow-xl"
                  style={{
                    zIndex: 9999,
                    backdropFilter: "blur(15px)",
                    WebkitBackdropFilter: "blur(15px)",
                    backgroundColor: "rgba(18, 18, 24, 0.88)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <div className="text-xs font-semibold text-white/90">Last Excel sync</div>
                  {health?.length ? (
                    <ul className="mt-2 space-y-1.5 text-xs text-white/70">
                      {health.map((u) => (
                        <li key={u.report_type}>
                          <span className="font-medium">{u.label}</span>:{" "}
                          {u.last_sync ? new Date(u.last_sync).toLocaleString() : "Never"}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-white/50">No uploads yet.</p>
                  )}
                  <button
                    type="button"
                    className="glass-btn mt-2 w-full rounded-lg py-1 text-xs text-white/80"
                    onClick={() => setHealthOpen(false)}
                  >
                    {t("close")}
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setDark((d) => !d)}
              className="glass-btn rounded-lg px-3 py-2 text-white/80 hover:text-white"
              title={dark ? "Light mode" : "Dark mode"}
            >
              {dark ? "☀️" : "🌙"}
            </button>
            <button
              type="button"
              onClick={() => i18n.changeLanguage(isRTL ? "en" : "ar")}
              className="glass-btn rounded-lg px-3 py-2 text-white/80 hover:text-white"
            >
              {isRTL ? "EN" : "AR"}
            </button>
            <button
              type="button"
              onClick={() => logout()}
              className="glass-btn rounded-lg px-3 py-2 text-white/80 hover:text-white"
              title={t("logout")}
            >
              {t("logout")}
            </button>
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-[1920px] px-4 py-6 font-['Inter',Tajawal,sans-serif] pb-20 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      <OwnerSignatureFooter />
    </div>
  );
}

