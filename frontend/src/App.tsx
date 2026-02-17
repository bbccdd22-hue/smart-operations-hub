import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "./contexts/AuthContext";
import { useNotifications } from "./contexts/NotificationContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import AdminHubLayout from "./layouts/AdminHubLayout";
import AppShellLayout from "./layouts/AppShellLayout";
import { buildMainNavConfig } from "./config/navConfig";
import DashboardPage from "./pages/DashboardPage";
import AdminHubPage from "./pages/AdminHubPage";
import BranchesPage from "./pages/BranchesPage";
import BrandsPage from "./pages/BrandsPage";
import TaxesPage from "./pages/TaxesPage";
import PaymentMethodsPage from "./pages/PaymentMethodsPage";
import SystemOptionsPage from "./pages/SystemOptionsPage";
import ShiftClosingPage from "./pages/ShiftClosingPage";
import UploadCenterPage from "./pages/UploadCenterPage";
import IngredientsPage from "./pages/IngredientsPage";
import PredictiveDashboardPage from "./pages/PredictiveDashboardPage";
import ReconciliationPage from "./pages/ReconciliationPage";
import SystemSettingsPage from "./pages/SystemSettingsPage";
import ManageIngredientsPage from "./pages/ManageIngredientsPage";
import UsersPage from "./pages/UsersPage";
import UserProfilePage from "./pages/UserProfilePage";
import RolesPage from "./pages/RolesPage";
import NotificationSettingsPage from "./pages/NotificationSettingsPage";
import SmartUploadPage from "./pages/SmartUploadPage";
import ActivityLogPage from "./pages/ActivityLogPage";
import LoginPage from "./pages/LoginPage";
import OperationsLayout from "./layouts/OperationsLayout";
import OperationsDashboardPage from "./pages/OperationsDashboardPage";
import PrepListPage from "./pages/PrepListPage";
import ProfitPage from "./pages/ProfitPage";
import FinanceHubPage from "./pages/FinanceHubPage";
import DailyRevenueReport from "./pages/reports/DailyRevenueReport";
import OperationalExpensesReport from "./pages/reports/OperationalExpensesReport";
import CostOfGoodsSoldReport from "./pages/reports/CostOfGoodsSoldReport";
import NetProfitMarginReport from "./pages/reports/NetProfitMarginReport";
import CashFlowStatementReport from "./pages/reports/CashFlowStatementReport";
import ProfitLossReport from "./pages/reports/ProfitLossReport";
import IncomeStatementPage from "./pages/reports/IncomeStatementPage";
import FinancialChartsDashboard from "./pages/reports/FinancialChartsDashboard";
import ChartOfAccountsPage from "./pages/ChartOfAccountsPage";
import BalanceUploadPage from "./pages/BalanceUploadPage";
import WastePage from "./pages/WastePage";
import CafeHeartbeatDashboard from "./pages/CafeHeartbeatDashboard";
import { fetchSystemHealth, type SystemHealthItem } from "./lib/api";
import ToastContainer from "./components/ToastContainer";
import ActivityLogger from "./components/ActivityLogger";
import NotificationsDropdown from "./components/NotificationsDropdown";
import OwnerSignatureFooter from "./components/OwnerSignatureFooter";

export default function App() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRTL = i18n.language === "ar";
  const [healthOpen, setHealthOpen] = useState(false);
  const [health, setHealth] = useState<SystemHealthItem[] | null>(null);

  const isBranchSupervisor = user?.role === "branch_supervisor";
  const isOwner = user?.role === "owner";
  const isGeneralManager = user?.role === "general_manager";
  const isExternalAccountant = user?.role === "external_accountant";
  const isSAIF = user?.username === "SAIF";
  const isSuperAdmin = isSAIF;
  const showAdminHub = isSAIF || isOwner || isGeneralManager;
  const eid = (user?.employee_id || "").toUpperCase();
  const isOperationsMode = /^A\d+$/.test(eid) || /^B\d+$/.test(eid); // single-letter A or B only [Ref: 2026-02-13]

  useEffect(() => {
    fetchSystemHealth().then((r) => setHealth(r.last_uploads));
  }, []);
  useEffect(() => {
    if (healthOpen && health === null) fetchSystemHealth().then((r) => setHealth(r.last_uploads));
  }, [healthOpen, health]);

  return (
    <>
    <ToastContainer />
    <ActivityLogger />
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
        <Route path="activity-log" element={<ActivityLogPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/:id" element={<UserProfilePage />} />
        <Route path="notification-settings" element={<NotificationSettingsPage />} />
        <Route path="smart-upload" element={<SmartUploadPage />} />
        <Route path="roles" element={<RolesPage />} />
        <Route path="branches" element={<BranchesPage />} />
        <Route path="brands" element={<BrandsPage />} />
        <Route path="taxes" element={<TaxesPage />} />
        <Route path="payment-methods" element={<PaymentMethodsPage />} />
        <Route path="system-options" element={<SystemOptionsPage />} />
        <Route path="system-codes" element={<SystemSettingsPage />} />
      </Route>
      {isOperationsMode ? (
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <OperationsLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<OperationsDashboardPage />} />
          <Route path="shift-closing" element={<ShiftClosingPage />} />
          <Route path="prep-list" element={<PrepListPage />} />
          <Route path="dashboard/heartbeat" element={<CafeHeartbeatDashboard />} />
          <Route path="finance" element={<FinanceHubPage />} />
          <Route path="finance/daily-revenue" element={<DailyRevenueReport />} />
          <Route path="finance/opex" element={<OperationalExpensesReport />} />
          <Route path="finance/cogs" element={<CostOfGoodsSoldReport />} />
          <Route path="finance/net-profit-margin" element={<NetProfitMarginReport />} />
          <Route path="finance/cash-flow" element={<CashFlowStatementReport />} />
          <Route path="finance/profit-loss" element={<ProfitLossReport />} />
          <Route path="finance/income-statement" element={<IncomeStatementPage />} />
          <Route path="finance/charts-dashboard" element={<FinancialChartsDashboard />} />
          <Route path="finance/chart-of-accounts" element={<ChartOfAccountsPage />} />
          <Route path="finance/balance-upload" element={<BalanceUploadPage />} />
          <Route path="profit-dashboard" element={<ProfitPage />} />
          <Route path="waste-tracker" element={<WastePage />} />
          <Route path="upload-center" element={<UploadCenterPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      ) : (
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShellLayout
                navConfig={buildMainNavConfig(t, {
                  isBranchSupervisor,
                  showAdminHub,
                  isOwner,
                  isSuperAdmin,
                  isExternalAccountant,
                  isGeneralManager,
                })}
                health={health}
                healthOpen={healthOpen}
                setHealthOpen={setHealthOpen}
              />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="dashboard/heartbeat" element={<CafeHeartbeatDashboard />} />
        <Route path="forecast" element={<PredictiveDashboardPage />} />
        <Route path="prep-list" element={<PrepListPage />} />
        <Route path="shift-closing" element={<ShiftClosingPage />} />
        <Route path="reconciliation" element={<ReconciliationPage />} />
        <Route path="upload-center" element={<UploadCenterPage />} />
        <Route path="ingredients" element={<IngredientsPage />} />
        <Route path="inventory/manage-ingredients" element={<ManageIngredientsPage />} />
        <Route path="finance" element={<FinanceHubPage />} />
        <Route path="finance/daily-revenue" element={<DailyRevenueReport />} />
        <Route path="finance/opex" element={<OperationalExpensesReport />} />
        <Route path="finance/cogs" element={<CostOfGoodsSoldReport />} />
        <Route path="finance/net-profit-margin" element={<NetProfitMarginReport />} />
        <Route path="finance/cash-flow" element={<CashFlowStatementReport />} />
        <Route path="finance/profit-loss" element={<ProfitLossReport />} />
        <Route path="finance/income-statement" element={<IncomeStatementPage />} />
        <Route path="finance/charts-dashboard" element={<FinancialChartsDashboard />} />
        <Route path="finance/chart-of-accounts" element={<ChartOfAccountsPage />} />
        <Route path="finance/balance-upload" element={<BalanceUploadPage />} />
        <Route path="profit-dashboard" element={<ProfitPage />} />
        <Route path="waste-tracker" element={<WastePage />} />
        <Route path="settings" element={<Navigate to="/admin-hub" replace />} />
      </Route>
      )}
    </Routes>
    </>
  );
}

