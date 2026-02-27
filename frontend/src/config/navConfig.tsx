/**
 * Navigation config – Six professional ERP systems
 * 1. مركز العمليات   2. نظام المبيعات   3. نظام المخازن
 * 4. نظام المشتريات  5. نظام الحسابات   6. نظام شؤون الموظفين
 */
import {
  LayoutDashboard,
  Package,
  Wallet,
  Users,
  ClipboardList,
  ShoppingBag,
  ShoppingCart,
  BarChart3,
  Briefcase,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { NavConfig, NavItem } from "../layouts/AppShellLayout";

/* ─── icons ──────────────────────────────────────────────────────────── */
const Ic = {
  /* General */
  dashboard:   <LayoutDashboard className="h-4 w-4" />,
  barChart:    <BarChart3 className="h-4 w-4" />,
  trendUp:     <TrendingUp className="h-4 w-4" />,
  users:       <Users className="h-4 w-4" />,
  briefcase:   <Briefcase className="h-4 w-4" />,

  /* Ops */
  heartbeat: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  activity: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  bell: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538.214 1.055.595 1.43L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  error: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  command: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  settings: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  system: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4m0 0h18" />
    </svg>
  ),

  /* Sales */
  pos: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  shift: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  prepList: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  kitchen: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  forecast: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  profit: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),

  /* Inventory */
  ingredients: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
  itemFile:   <Package className="h-4 w-4" />,
  products:   <ShoppingBag className="h-4 w-4" />,
  transfers: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  ),
  centralKitchen: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  waste: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),

  /* Procurement */
  smartPurchase: <ShoppingCart className="h-4 w-4" />,
  manualForecast: <ClipboardList className="h-4 w-4" />,

  /* Accounting */
  wallet:   <Wallet className="h-4 w-4" />,
  reports:  <BarChart3 className="h-4 w-4" />,
  check: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  upload: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  ),
  cashFlow: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  chart: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
    </svg>
  ),
  audit: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  book: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  adjustments: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  ),
  auditor: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),

  /* HR */
  employee: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

/* ─── permission map ────────────────────────────────────────────────── */
const ROUTE_PERM: Record<string, string> = {
  /* Operations */
  "/":                              "perm_management_reports",
  "/dashboard":                     "perm_management_reports",
  "/executive-dashboard":           "perm_full_system_access",
  "/admin-hub":                     "perm_full_system_access",
  "/admin-hub/command-center":      "perm_full_system_access",
  "/admin-hub/activity-log":        "perm_full_system_access",
  "/admin-hub/notifications":       "perm_management_reports",
  "/admin-hub/error-logs":          "perm_full_system_access",
  "/admin-hub/system-heartbeat":    "perm_full_system_access",
  /* Sales */
  "/pos":                           "perm_shift_closing",
  "/shift-closing":                 "perm_shift_closing",
  "/forecast":                      "perm_order_forecasting",
  "/prep-list":                     "perm_order_forecasting",
  "/kitchen":                       "perm_shift_closing",
  "/dashboard/heartbeat":           "perm_management_reports",
  "/dashboard/reports":             "perm_management_reports",
  "/profit-dashboard":              "perm_management_reports",
  /* Inventory */
  "/ingredients":                   "perm_management_reports",
  "/inventory/manage-ingredients":  "perm_management_reports",
  "/inventory/item-file":           "perm_management_reports",
  "/products":                      "perm_management_reports",
  "/stock-transfers":               "perm_management_reports",
  "/central-kitchen":               "perm_management_reports",
  "/waste-tracker":                 "perm_management_reports",
  /* Procurement */
  "/smart-purchase":                "perm_management_reports",
  "/manual-purchase-forecast":      "perm_management_reports",
  /* Accounting */
  "/finance":                       "perm_financial_reports",
  "/finance/daily-revenue":         "perm_financial_reports",
  "/finance/profit-loss":           "perm_financial_reports",
  "/finance/income-statement":      "perm_financial_reports",
  "/finance/cash-flow":             "perm_financial_reports",
  "/finance/charts-dashboard":      "perm_financial_reports",
  "/finance/opex":                  "perm_financial_reports",
  "/finance/cogs":                  "perm_financial_reports",
  "/finance/net-profit-margin":     "perm_financial_reports",
  "/finance/reports":               "perm_financial_reports",
  "/finance/chart-of-accounts":     "perm_financial_reports",
  "/finance/cost-audit":            "perm_financial_reports",
  "/finance/auditor":               "perm_financial_auditor",
  "/finance/manual-adjustments":    "perm_full_system_access",
  "/finance/balance-upload":        "perm_financial_reports",
  "/reconciliation":                "perm_financial_reports",
  "/upload-center":                 "perm_management_reports",
  /* HR */
  "/employee-self":                 "perm_management_reports",
};

function filterByPermission<T extends { to: string }>(
  items: T[],
  perms: Record<string, boolean>,
  isSAIF: boolean,
): T[] {
  if (isSAIF) return items;
  return items.filter((i) => {
    const perm = ROUTE_PERM[i.to];
    return !perm || !!perms[perm];
  });
}

export type NavGroupConfig = {
  groupLabelKey: string;
  groupIcon: LucideIcon;
  subGroups: { subLabelKey: string; items: NavItem[] }[];
  show: boolean;
};

/* ═══════════════════════════════════════════════════════════════════════
   buildNestedNavConfig — Six professional ERP systems
═══════════════════════════════════════════════════════════════════════ */
export function buildNestedNavConfig(
  t: (k: string) => string,
  opts: {
    isBranchSupervisor: boolean;
    showAdminHub: boolean;
    isOwner: boolean;
    isSuperAdmin?: boolean;
    isExternalAccountant?: boolean;
    isGeneralManager?: boolean;
    permissions?: Record<string, boolean>;
  },
): NavGroupConfig[] {
  const {
    isBranchSupervisor,
    showAdminHub,
    isSuperAdmin = false,
    isExternalAccountant = false,
    permissions = {},
  } = opts;
  const isSAIF = isSuperAdmin;

  /* ─────────────────────────────────────────────────────────────────
     Branch Supervisor – Simplified daily-ops view
  ───────────────────────────────────────────────────────────────── */
  if (isBranchSupervisor) {
    const branchItems = filterByPermission([
      { to: "/",              label: t("homePage"),            icon: Ic.dashboard },
      { to: "/pos",           label: t("posCashier"),          icon: Ic.pos,     primary: true },
      { to: "/shift-closing", label: t("shiftClosing"),        icon: Ic.shift },
      { to: "/prep-list",     label: t("opsPrepList"),         icon: Ic.prepList },
      { to: "/kitchen",       label: t("kitchenDisplay"),      icon: Ic.kitchen },
      { to: "/waste-tracker", label: t("wasteEntry"),          icon: Ic.waste },
      { to: "/employee-self", label: t("employeeSelfService"), icon: Ic.employee },
    ], permissions, isSAIF);
    return [{
      groupLabelKey: "navGroupOperationsHub",
      groupIcon: LayoutDashboard,
      subGroups: [{ subLabelKey: "navSubOpsCenter", items: branchItems }],
      show: branchItems.length > 0,
    }];
  }

  /* ─────────────────────────────────────────────────────────────────
     SYSTEM 1 — مركز العمليات
     Dashboards, admin tools, system monitoring
  ───────────────────────────────────────────────────────────────── */
  const opsMain = filterByPermission([
    { to: "/",                      label: t("homePage"),             icon: Ic.dashboard, primary: true },
    { to: "/executive-dashboard",   label: t("executiveDashboard"),   icon: Ic.command },
    { to: "/admin-hub/command-center", label: t("ownerCommandCenter"), icon: Ic.trendUp },
  ], permissions, isSAIF).filter((i) => {
    if (i.to === "/executive-dashboard" || i.to === "/admin-hub/command-center") return showAdminHub;
    return true;
  });

  const opsAdmin = filterByPermission([
    { to: "/admin-hub",                label: t("adminDashboard"),       icon: Ic.settings },
    { to: "/admin-hub/activity-log",   label: t("activityLog"),          icon: Ic.activity },
    { to: "/admin-hub/notifications",  label: t("notificationsList"),    icon: Ic.bell },
    { to: "/admin-hub/error-logs",     label: t("systemErrorLogs"),      icon: Ic.error },
    { to: "/admin-hub/system-heartbeat", label: t("systemHeartbeat"),    icon: Ic.system },
  ], permissions, isSAIF).filter(() => showAdminHub);

  /* ─────────────────────────────────────────────────────────────────
     SYSTEM 2 — نظام المبيعات
     POS, shift closing, forecasting, analytics
  ───────────────────────────────────────────────────────────────── */
  const salesOps = filterByPermission([
    { to: "/pos",           label: t("posCashier"),   icon: Ic.pos },
    { to: "/shift-closing", label: t("shiftClosing"), icon: Ic.shift },
    { to: "/prep-list",     label: t("opsPrepList"),  icon: Ic.prepList },
    { to: "/kitchen",       label: t("kitchenDisplay"), icon: Ic.kitchen },
  ], permissions, isSAIF);

  const salesDashboards = filterByPermission([
    { to: "/forecast",            label: t("forecast"),           icon: Ic.forecast },
    { to: "/dashboard/heartbeat", label: t("cafeHeartbeat"),      icon: Ic.heartbeat },
    { to: "/dashboard/reports",   label: t("managementReports"),  icon: Ic.barChart },
    { to: "/profit-dashboard",    label: t("profitDashboard"),    icon: Ic.profit },
  ], permissions, isSAIF);

  /* ─────────────────────────────────────────────────────────────────
     SYSTEM 3 — نظام المخازن
     Items, products, stock movements, waste
  ───────────────────────────────────────────────────────────────── */
  const itemsCatalog = filterByPermission([
    { to: "/ingredients",          label: t("recipeInventory"),  icon: Ic.ingredients },
    { to: "/inventory/item-file",  label: t("itemFile"),         icon: Ic.itemFile },
    { to: "/products",             label: t("productsList"),     icon: Ic.products },
  ], permissions, isSAIF);

  const stockMovements = filterByPermission([
    { to: "/stock-transfers",  label: t("stockTransfers"),  icon: Ic.transfers },
    { to: "/central-kitchen",  label: t("centralKitchen"),  icon: Ic.centralKitchen },
    { to: "/waste-tracker",    label: t("wasteEntry"),       icon: Ic.waste },
  ], permissions, isSAIF);

  /* ─────────────────────────────────────────────────────────────────
     SYSTEM 4 — نظام المشتريات
     Purchase suggestions & manual forecasting
  ───────────────────────────────────────────────────────────────── */
  const purchaseItems = filterByPermission([
    { to: "/smart-purchase",           label: t("smartPurchase"),          icon: Ic.smartPurchase },
    { to: "/manual-purchase-forecast", label: t("manualPurchaseForecast"), icon: Ic.manualForecast },
  ], permissions, isSAIF);

  /* ─────────────────────────────────────────────────────────────────
     SYSTEM 5 — نظام الحسابات
     Full accounting: reports, P&L, cash flow, audit, reconciliation
  ───────────────────────────────────────────────────────────────── */
  const finStatements = filterByPermission([
    { to: "/finance",                    label: t("financialHub"),           icon: Ic.wallet },
    { to: "/finance/daily-revenue",      label: t("dailyRevenue"),           icon: Ic.barChart },
    { to: "/finance/profit-loss",        label: t("profitLoss"),             icon: Ic.trendUp },
    { to: "/finance/income-statement",   label: t("incomeStatement"),        icon: Ic.book },
    { to: "/finance/cash-flow",          label: t("cashFlowStatement"),      icon: Ic.cashFlow },
    { to: "/finance/net-profit-margin",  label: t("netProfitMargin"),        icon: Ic.profit },
  ], permissions, isSAIF).filter((i) => !(isBranchSupervisor && i.to === "/finance"));

  const finAnalysis = filterByPermission([
    { to: "/finance/cogs",              label: t("costOfGoodsSold"),         icon: Ic.audit },
    { to: "/finance/opex",              label: t("operationalExpenses"),     icon: Ic.adjustments },
    { to: "/finance/charts-dashboard",  label: t("financialChartsDashboard"), icon: Ic.chart },
    { to: "/finance/cost-audit",        label: t("costAuditCenter"),         icon: Ic.audit },
  ], permissions, isSAIF);

  const finAudit = filterByPermission([
    { to: "/finance/chart-of-accounts",  label: t("chartOfAccounts"),     icon: Ic.book },
    { to: "/finance/auditor",            label: t("financialAuditor"),     icon: Ic.auditor },
    { to: "/finance/manual-adjustments", label: t("manualAdjustments"),   icon: Ic.adjustments },
    { to: "/reconciliation",             label: t("reconciliation"),       icon: Ic.check },
  ], permissions, isSAIF).filter((i) =>
    !(isExternalAccountant && i.to === "/finance/manual-adjustments") &&
    !(i.to === "/finance/manual-adjustments" && !isSAIF)
  );

  const finUploads = filterByPermission([
    { to: "/finance/balance-upload", label: t("balanceUpload"),  icon: Ic.upload },
    { to: "/upload-center",          label: t("uploadCenter"),   icon: Ic.upload },
  ], permissions, isSAIF).filter((i) =>
    !(isExternalAccountant && i.to === "/upload-center")
  );

  /* ─────────────────────────────────────────────────────────────────
     SYSTEM 6 — نظام شؤون الموظفين
  ───────────────────────────────────────────────────────────────── */
  const hrSelf = filterByPermission([
    { to: "/employee-self", label: t("employeeSelfService"), icon: Ic.employee },
  ], permissions, isSAIF);

  /* ─────────────────────────────────────────────────────────────────
     Assemble Groups
  ───────────────────────────────────────────────────────────────── */
  const groups: NavGroupConfig[] = [];

  /* 1 — مركز العمليات */
  const opsSubGroups = [
    { subLabelKey: "navSubOpsCenter", items: opsMain },
    { subLabelKey: "navSubOpsAdmin",  items: opsAdmin },
  ].filter((sg) => sg.items.length > 0);
  if (opsSubGroups.length > 0) {
    groups.push({ groupLabelKey: "navGroupOperationsHub", groupIcon: LayoutDashboard, subGroups: opsSubGroups, show: true });
  }

  /* 2 — نظام المبيعات */
  const salesSubGroups = [
    { subLabelKey: "navSubSalesOps",        items: salesOps },
    { subLabelKey: "navSubSalesDashboards", items: salesDashboards },
  ].filter((sg) => sg.items.length > 0);
  if (salesSubGroups.length > 0) {
    groups.push({ groupLabelKey: "navSystemSales", groupIcon: BarChart3, subGroups: salesSubGroups, show: true });
  }

  /* 3 — نظام المخازن */
  const invSubGroups = [
    { subLabelKey: "navSubItemsCatalog",   items: itemsCatalog },
    { subLabelKey: "navSubStockMovements", items: stockMovements },
  ].filter((sg) => sg.items.length > 0);
  if (invSubGroups.length > 0) {
    groups.push({ groupLabelKey: "navSystemInventory", groupIcon: Package, subGroups: invSubGroups, show: true });
  }

  /* 4 — نظام المشتريات */
  if (purchaseItems.length > 0) {
    groups.push({ groupLabelKey: "navSystemProcurement", groupIcon: ShoppingCart, subGroups: [{ subLabelKey: "navSubPurchaseOrders", items: purchaseItems }], show: true });
  }

  /* 5 — نظام الحسابات */
  const finSubGroups = [
    { subLabelKey: "navSubFinStatements", items: finStatements },
    { subLabelKey: "navSubFinAnalysis",   items: finAnalysis },
    { subLabelKey: "navSubAudit",         items: finAudit },
    { subLabelKey: "navSubAccUploads",    items: finUploads },
  ].filter((sg) => sg.items.length > 0);
  if (finSubGroups.length > 0) {
    groups.push({ groupLabelKey: "navSystemAccounting", groupIcon: Wallet, subGroups: finSubGroups, show: true });
  }

  /* 6 — نظام شؤون الموظفين */
  if (hrSelf.length > 0) {
    groups.push({ groupLabelKey: "navSystemHR", groupIcon: Briefcase, subGroups: [{ subLabelKey: "navSubHRSelf", items: hrSelf }], show: true });
  }

  return groups.filter((g) => g.show);
}

/* ── Flat list for mobile bar ──────────────────────────────────────── */
export function buildMainNavConfig(
  t: (k: string) => string,
  opts: Parameters<typeof buildNestedNavConfig>[1],
): NavConfig[] {
  const groups = buildNestedNavConfig(t, opts);
  const allItems: NavItem[] = [];
  for (const g of groups) {
    for (const sg of g.subGroups) {
      for (const item of sg.items) {
        if (!allItems.some((i) => i.to === item.to)) allItems.push(item);
      }
    }
  }
  const primaryItem = allItems.find((n) => n.primary) ?? allItems[0];
  if (primaryItem && !primaryItem.primary) primaryItem.primary = true;
  return [{ items: allItems, show: allItems.length > 0 }];
}
