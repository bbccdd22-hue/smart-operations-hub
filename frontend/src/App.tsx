import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "./contexts/AuthContext";
import { useNotifications } from "./contexts/NotificationContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import AdminHubLayout from "./layouts/AdminHubLayout";
import AppShellLayout from "./layouts/AppShellLayout";
import { buildMainNavConfig, buildNestedNavConfig } from "./config/navConfig";
import DashboardPage from "./pages/DashboardPage";
import ManagementReportsPage from "./pages/ManagementReportsPage";
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
import StockTransfersPage from "./pages/StockTransfersPage";
import CentralKitchenPage from "./pages/CentralKitchenPage";
import SmartPurchasePage from "./pages/SmartPurchasePage";
import ManualPurchaseForecastPage from "./pages/ManualPurchaseForecastPage";
import SuppliersPage from "./pages/suppliers/SuppliersPage";
import SupplierBalancesPage from "./pages/suppliers/SupplierBalancesPage";
import SupplierStatementPage from "./pages/suppliers/SupplierStatementPage";
import SupplierDebtAgingPage from "./pages/suppliers/SupplierDebtAgingPage";
import ProductsPage from "./pages/ProductsPage";
import UsersPage from "./pages/UsersPage";
import UserProfilePage from "./pages/UserProfilePage";
import RolesPage from "./pages/RolesPage";
import NotificationSettingsPage from "./pages/NotificationSettingsPage";
import NotificationsListPage from "./pages/NotificationsListPage";
import SmartUploadPage from "./pages/SmartUploadPage";
import ActivityLogPage from "./pages/ActivityLogPage";
import SystemErrorLogsPage from "./pages/SystemErrorLogsPage";
import SystemHeartbeatPage from "./pages/SystemHeartbeatPage";
import TestDashboardPage from "./pages/TestDashboardPage";
import LoginPage from "./pages/LoginPage";
import HubPage from "./pages/HubPage";
import OperationsLayout from "./layouts/OperationsLayout";
import OperationsDashboardPage from "./pages/OperationsDashboardPage";
import PrepListPage from "./pages/PrepListPage";
import ProfitPage from "./pages/ProfitPage";
import FinanceHubPage from "./pages/FinanceHubPage";
import FinancialReportsPage from "./pages/FinancialReportsPage";
import DailyRevenueReport from "./pages/reports/DailyRevenueReport";
import OperationalExpensesReport from "./pages/reports/OperationalExpensesReport";
import CostOfGoodsSoldReport from "./pages/reports/CostOfGoodsSoldReport";
import NetProfitMarginReport from "./pages/reports/NetProfitMarginReport";
import CashFlowStatementReport from "./pages/reports/CashFlowStatementReport";
import ProfitLossReport from "./pages/reports/ProfitLossReport";
import IncomeStatementPage from "./pages/reports/IncomeStatementPage";
import FinancialAuditorPage from "./pages/FinancialAuditorPage";
import ManualAdjustmentsPage from "./pages/reports/ManualAdjustmentsPage";
import OwnerCommandCenterPage from "./pages/OwnerCommandCenterPage";
import ExecutiveDashboardPage from "./pages/ExecutiveDashboardPage";
import ChartOfAccountsPage from "./pages/ChartOfAccountsPage";
import BalanceUploadPage from "./pages/BalanceUploadPage";
import TrialBalancePage from "./pages/accounting/TrialBalancePage";
import AccountStatementPage from "./pages/accounting/AccountStatementPage";
import JournalEntryPage from "./pages/accounting/JournalEntryPage";
import CostCentersPage from "./pages/accounting/CostCentersPage";
import BanksCashPage from "./pages/accounting/BanksCashPage";
import TaxReportPage from "./pages/accounting/TaxReportPage";
import BudgetPage from "./pages/accounting/BudgetPage";
import WastePage from "./pages/WastePage";
import POSPage from "./pages/POSPage";
import ProcurementPlaceholderPage from "./pages/procurement/ProcurementPlaceholderPage";
import PurchaseInvoicesPage from "./pages/procurement/PurchaseInvoicesPage";
import PurchaseInvoiceForm from "./pages/procurement/PurchaseInvoiceForm";
import PurchaseOrdersPage from "./pages/procurement/PurchaseOrdersPage";
import GoodsReceiptPage from "./pages/procurement/GoodsReceiptPage";
import PurchaseRequestsPage from "./pages/procurement/PurchaseRequestsPage";
import ProcurementDailyMovementsPage from "./pages/procurement/ProcurementDailyMovementsPage";
import ProcurementReviewMovementsPage from "./pages/procurement/ProcurementReviewMovementsPage";
import SalesPlaceholderPage from "./pages/sales/SalesPlaceholderPage";
import SalesDailyReportPage from "./pages/sales/SalesDailyReportPage";
import SalesCashNetworkPage from "./pages/sales/SalesCashNetworkPage";
import InventoryPlaceholderPage from "./pages/inventory/InventoryPlaceholderPage";
import StockBalancePage from "./pages/inventory/StockBalancePage";
import StockMovementsPage from "./pages/inventory/StockMovementsPage";
import KitchenDisplayPage from "./pages/KitchenDisplayPage";
import EmployeeSelfServicePage from "./pages/EmployeeSelfServicePage";
import CafeHeartbeatDashboard from "./pages/CafeHeartbeatDashboard";
import { fetchSystemHealth, type SystemHealthItem } from "./lib/api";
import { DateRangeProvider } from "./contexts/DateRangeContext";
import { ProfitVisibilityProvider } from "./contexts/ProfitVisibilityContext";
import ToastContainer from "./components/ToastContainer";
import ActivityLogger from "./components/ActivityLogger";
import ErrorBoundary from "./components/ErrorBoundary";
import SignupPage from "./pages/SignupPage";
import FoodCostDashboard from "./pages/FoodCostDashboard";
import PosTablesPage from "./pages/PosTablesPage";
import KdsPage from "./pages/KdsPage";
import SupplierPortalLoginPage from "./pages/SupplierPortalLoginPage";
import SupplierPortalDashboardPage from "./pages/SupplierPortalDashboardPage";
import CategoryAnalyticsPage from "./pages/CategoryAnalyticsPage";
import OwnerDashboardVipPage from "./pages/OwnerDashboardVipPage";
import NotificationsDropdown from "./components/NotificationsDropdown";
import OwnerSignatureFooter from "./components/OwnerSignatureFooter";

const ItemFilePage = lazy(() => import("./pages/ItemFilePage"));
const CostAuditCenterPage = lazy(() => import("./pages/reports/CostAuditCenterPage"));
const FinancialChartsDashboard = lazy(() => import("./pages/reports/FinancialChartsDashboard"));

function PageFallback() {
  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      <span className="ml-3 text-white/70">Loading…</span>
    </div>
  );
}

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
  /** SAIF/Owner: دائماً لوحة التحكم الكاملة مع القائمة الجانبية. موظفو الميدان (A/B): وضع التشغيل */
  const isOperationsMode =
    !isSAIF && !isOwner && (/^A\d+$/.test(eid) || /^B\d+$/.test(eid));

  useEffect(() => {
    if (user) fetchSystemHealth().then((r) => setHealth(r.last_uploads));
  }, [user]);
  useEffect(() => {
    if (user && healthOpen && health === null) fetchSystemHealth().then((r) => setHealth(r.last_uploads));
  }, [user, healthOpen, health]);

  const canUseDateComparison = isSAIF || user?.role === "general_manager";
  /** صلاحية رؤية سعر التكلفة – تُحدد من صلاحيات الدور. إن غابت من الاستجابة نرجع للسلوك القديم */
  const canUseProfitVisibility =
    user?.permissions?.view_cost_price === true ||
    (user?.permissions?.view_cost_price === undefined && (isSAIF || isGeneralManager));
  /** المدير العام: افتراضي تشغيلية للخصوصية. SAIF: افتراضي كامل */
  const defaultShowFullFinancial = isSAIF;

  return (
    <>
    <ToastContainer />
    <ActivityLogger />
    <ErrorBoundary onRetry={() => window.location.reload()}>
    <DateRangeProvider canUseComparison={!!canUseDateComparison}>
    <ProfitVisibilityProvider
      canUseProfitVisibility={!!canUseProfitVisibility}
      defaultShowFullFinancial={defaultShowFullFinancial}
      userId={user?.id ?? user?.username}
    >
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      {/* Public — no auth required */}
      <Route path="/kds" element={<KdsPage />} />
      <Route path="/supplier-portal/login" element={<SupplierPortalLoginPage />} />
      <Route path="/supplier-portal/dashboard" element={<SupplierPortalDashboardPage />} />
      <Route path="/hub" element={<ProtectedRoute><Navigate to="/" replace /></ProtectedRoute>} />
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
        <Route path="command-center" element={<OwnerCommandCenterPage />} />
        <Route path="executive-dashboard" element={<ExecutiveDashboardPage />} />
        <Route path="activity-log" element={<ActivityLogPage />} />
        <Route path="error-logs" element={<SystemErrorLogsPage />} />
        <Route path="system-heartbeat" element={<SystemHeartbeatPage />} />
        <Route path="test-dashboard" element={<TestDashboardPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/:id" element={<UserProfilePage />} />
        <Route path="notification-settings" element={<NotificationSettingsPage />} />
        <Route path="notifications" element={<NotificationsListPage />} />
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
          <Route path="pos" element={<POSPage />} />
          <Route path="pos/tables" element={<PosTablesPage />} />
          <Route path="analytics/food-cost" element={<FoodCostDashboard />} />
          <Route path="analytics/categories" element={<CategoryAnalyticsPage />} />
          <Route path="owner-dashboard" element={<OwnerDashboardVipPage />} />
          <Route path="employee-self" element={<EmployeeSelfServicePage />} />
          <Route path="kitchen" element={<KitchenDisplayPage />} />
          <Route path="shift-closing" element={<ShiftClosingPage />} />
          <Route path="prep-list" element={<PrepListPage />} />
          <Route path="dashboard/reports" element={<ManagementReportsPage />} />
          <Route path="dashboard/heartbeat" element={<CafeHeartbeatDashboard />} />
          <Route path="finance" element={<FinanceHubPage />} />
          <Route path="finance/reports" element={<FinancialReportsPage />} />
          <Route path="finance/daily-revenue" element={<DailyRevenueReport />} />
          <Route path="finance/opex" element={<OperationalExpensesReport />} />
          <Route path="finance/cogs" element={<CostOfGoodsSoldReport />} />
          <Route path="finance/net-profit-margin" element={<NetProfitMarginReport />} />
          <Route path="finance/cash-flow" element={<CashFlowStatementReport />} />
          <Route path="finance/profit-loss" element={<ProfitLossReport />} />
          <Route path="finance/income-statement" element={<IncomeStatementPage />} />
          <Route path="finance/cost-audit" element={<Suspense fallback={<PageFallback />}><CostAuditCenterPage /></Suspense>} />
          <Route path="finance/auditor" element={<FinancialAuditorPage />} />
          <Route path="finance/manual-adjustments" element={<ManualAdjustmentsPage />} />
          <Route path="finance/charts-dashboard" element={<Suspense fallback={<PageFallback />}><FinancialChartsDashboard /></Suspense>} />
          <Route path="finance/chart-of-accounts" element={<ChartOfAccountsPage />} />
          <Route path="finance/balance-upload" element={<BalanceUploadPage />} />
          <Route path="profit-dashboard" element={<ProfitPage />} />
          <Route path="waste-tracker" element={<WastePage />} />
          <Route path="upload-center" element={<UploadCenterPage />} />
          <Route path="ingredients" element={<IngredientsPage />} />
          <Route path="inventory/manage-ingredients" element={<ManageIngredientsPage />} />
          <Route path="inventory/item-file" element={<Suspense fallback={<PageFallback />}><ItemFilePage /></Suspense>} />
          <Route path="inventory/stock-balance" element={<StockBalancePage />} />
          <Route path="inventory/stock-movements" element={<StockMovementsPage />} />
          <Route path="inventory/reports/item-balances" element={<StockBalancePage />} />
          <Route path="inventory/reports/daily-movements" element={<StockMovementsPage />} />
          <Route path="inventory/*" element={<InventoryPlaceholderPage />} />
          <Route path="stock-transfers" element={<StockTransfersPage />} />
          <Route path="central-kitchen" element={<CentralKitchenPage />} />
          <Route path="smart-purchase" element={<SmartPurchasePage />} />
          <Route path="manual-purchase-forecast" element={<ManualPurchaseForecastPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="suppliers/balances" element={<SupplierBalancesPage />} />
          <Route path="suppliers/statement/:supplierId" element={<SupplierStatementPage />} />
          <Route path="suppliers/debt-aging" element={<SupplierDebtAgingPage />} />
          <Route path="procurement/invoices" element={<PurchaseInvoicesPage />} />
          <Route path="procurement/invoices/new" element={<PurchaseInvoiceForm />} />
          <Route path="procurement/invoices/:id/edit" element={<PurchaseInvoiceForm />} />
          <Route path="procurement/orders" element={<PurchaseOrdersPage />} />
          <Route path="procurement/goods-receipts" element={<GoodsReceiptPage />} />
          <Route path="procurement/requests" element={<PurchaseRequestsPage />} />
          <Route path="procurement/reports/daily-movements" element={<ProcurementDailyMovementsPage />} />
          <Route path="procurement/reports/review-movements" element={<ProcurementReviewMovementsPage />} />
          <Route path="procurement/*" element={<ProcurementPlaceholderPage />} />
          <Route path="sales/reports/daily-movement" element={<SalesDailyReportPage />} />
          <Route path="sales/reports/review-movements" element={<SalesCashNetworkPage />} />
          <Route path="sales/*" element={<SalesPlaceholderPage />} />
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
                  permissions: user?.permissions ?? {},
                })}
                nestedNavConfig={buildNestedNavConfig(t, {
                  isBranchSupervisor,
                  showAdminHub,
                  isOwner,
                  isSuperAdmin,
                  isExternalAccountant,
                  permissions: user?.permissions ?? {},
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
        <Route path="executive-dashboard" element={<ExecutiveDashboardPage />} />
        <Route path="dashboard/reports" element={<ManagementReportsPage />} />
        <Route path="dashboard/heartbeat" element={<CafeHeartbeatDashboard />} />
        <Route path="forecast" element={<PredictiveDashboardPage />} />
        <Route path="prep-list" element={<PrepListPage />} />
        <Route path="pos" element={<POSPage />} />
        <Route path="pos/tables" element={<PosTablesPage />} />
        <Route path="analytics/food-cost" element={<FoodCostDashboard />} />
        <Route path="analytics/categories" element={<CategoryAnalyticsPage />} />
        <Route path="owner-dashboard" element={<OwnerDashboardVipPage />} />
        <Route path="employee-self" element={<EmployeeSelfServicePage />} />
        <Route path="kitchen" element={<KitchenDisplayPage />} />
        <Route path="shift-closing" element={<ShiftClosingPage />} />
        <Route path="reconciliation" element={<ReconciliationPage />} />
        <Route path="upload-center" element={<UploadCenterPage />} />
        <Route path="ingredients" element={<IngredientsPage />} />
          <Route path="inventory/manage-ingredients" element={<ManageIngredientsPage />} />
          <Route path="inventory/item-file" element={<Suspense fallback={<PageFallback />}><ItemFilePage /></Suspense>} />
          <Route path="inventory/stock-balance" element={<StockBalancePage />} />
          <Route path="inventory/stock-movements" element={<StockMovementsPage />} />
          <Route path="inventory/reports/item-balances" element={<StockBalancePage />} />
          <Route path="inventory/reports/daily-movements" element={<StockMovementsPage />} />
          <Route path="inventory/*" element={<InventoryPlaceholderPage />} />
          <Route path="stock-transfers" element={<StockTransfersPage />} />
          <Route path="central-kitchen" element={<CentralKitchenPage />} />
          <Route path="smart-purchase" element={<SmartPurchasePage />} />
        <Route path="manual-purchase-forecast" element={<ManualPurchaseForecastPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="suppliers/balances" element={<SupplierBalancesPage />} />
        <Route path="suppliers/statement/:supplierId" element={<SupplierStatementPage />} />
        <Route path="suppliers/debt-aging" element={<SupplierDebtAgingPage />} />
        <Route path="procurement/invoices" element={<PurchaseInvoicesPage />} />
        <Route path="procurement/invoices/new" element={<PurchaseInvoiceForm />} />
        <Route path="procurement/invoices/:id/edit" element={<PurchaseInvoiceForm />} />
        <Route path="procurement/orders" element={<PurchaseOrdersPage />} />
        <Route path="procurement/goods-receipts" element={<GoodsReceiptPage />} />
        <Route path="procurement/requests" element={<PurchaseRequestsPage />} />
        <Route path="procurement/reports/daily-movements" element={<ProcurementDailyMovementsPage />} />
        <Route path="procurement/reports/review-movements" element={<ProcurementReviewMovementsPage />} />
        <Route path="procurement/*" element={<ProcurementPlaceholderPage />} />
        <Route path="sales/reports/daily-movement" element={<SalesDailyReportPage />} />
        <Route path="sales/reports/review-movements" element={<SalesCashNetworkPage />} />
        <Route path="sales/*" element={<SalesPlaceholderPage />} />
        <Route path="finance" element={<FinanceHubPage />} />
        <Route path="finance/reports" element={<FinancialReportsPage />} />
        <Route path="finance/daily-revenue" element={<DailyRevenueReport />} />
        <Route path="finance/opex" element={<OperationalExpensesReport />} />
        <Route path="finance/cogs" element={<CostOfGoodsSoldReport />} />
        <Route path="finance/net-profit-margin" element={<NetProfitMarginReport />} />
        <Route path="finance/cash-flow" element={<CashFlowStatementReport />} />
        <Route path="finance/profit-loss" element={<ProfitLossReport />} />
        <Route path="finance/income-statement" element={<IncomeStatementPage />} />
        <Route path="finance/cost-audit" element={<Suspense fallback={<PageFallback />}><CostAuditCenterPage /></Suspense>} />
        <Route path="finance/auditor" element={<FinancialAuditorPage />} />
        <Route path="finance/manual-adjustments" element={<ManualAdjustmentsPage />} />
        <Route path="finance/charts-dashboard" element={<Suspense fallback={<PageFallback />}><FinancialChartsDashboard /></Suspense>} />
        <Route path="finance/chart-of-accounts" element={<ChartOfAccountsPage />} />
        <Route path="finance/balance-upload" element={<BalanceUploadPage />} />
        {/* ── NEW Accounting Pages ── */}
        <Route path="finance/trial-balance"     element={<TrialBalancePage />} />
        <Route path="finance/account-statement" element={<AccountStatementPage />} />
        <Route path="finance/journal-entry"     element={<JournalEntryPage />} />
        <Route path="finance/cost-centers"      element={<CostCentersPage />} />
        <Route path="finance/banks"             element={<BanksCashPage />} />
        <Route path="finance/tax-report"        element={<TaxReportPage />} />
        <Route path="finance/budget"            element={<BudgetPage />} />
        <Route path="finance/receipts"          element={<JournalEntryPage />} />
        <Route path="finance/payments"          element={<JournalEntryPage />} />
        <Route path="finance/consolidated"      element={<FinancialReportsPage />} />
        <Route path="profit-dashboard" element={<ProfitPage />} />
        <Route path="waste-tracker" element={<WastePage />} />
        <Route path="settings" element={<Navigate to="/admin-hub" replace />} />
      </Route>
      )}
    </Routes>
    </ProfitVisibilityProvider>
    </DateRangeProvider>
    </ErrorBoundary>
    </>
  );
}

