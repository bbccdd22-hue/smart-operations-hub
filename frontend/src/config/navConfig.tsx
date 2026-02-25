/**
 * Navigation config – Nested groups with Lucide icons
 * Operations Hub | Inventory & Supply | Finance & Auditing | Self-Service
 */
import {
  LayoutDashboard,
  Package,
  TrendingUp,
  Wallet,
  FileCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavConfig, NavItem } from "../layouts/AppShellLayout";

/** SVG icons for leaf items (kept for compatibility) */
const icons = {
  dashboard: <LayoutDashboard className="h-5 w-5" />,
  heartbeat: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  forecast: <TrendingUp className="h-5 w-5" />,
  prepList: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  shiftClosing: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  upload: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  ),
  ingredients: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
  financial: <Wallet className="h-5 w-5" />,
  waste: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  reconciliation: <FileCheck className="h-5 w-5" />,
  admin: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  pos: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  employeeSelf: <Users className="h-5 w-5" />,
  stockTransfers: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  ),
  centralKitchen: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  smartPurchase: <TrendingUp className="h-5 w-5" />,
  itemFile: <Package className="h-5 w-5" />,
};

/** Route to permission key */
const ROUTE_PERM: Record<string, string> = {
  "/shift-closing": "perm_shift_closing",
  "/finance": "perm_financial_reports",
  "/admin-hub": "perm_full_system_access",
  "/executive-dashboard": "perm_full_system_access",
  "/forecast": "perm_order_forecasting",
  "/prep-list": "perm_order_forecasting",
  "/": "perm_management_reports",
  "/dashboard": "perm_management_reports",
  "/dashboard/reports": "perm_management_reports",
  "/finance/auditor": "perm_financial_auditor",
  "/dashboard/heartbeat": "perm_management_reports",
  "/upload-center": "perm_management_reports",
  "/ingredients": "perm_management_reports",
  "/inventory/manage-ingredients": "perm_management_reports",
  "/inventory/item-file": "perm_management_reports",
  "/waste-tracker": "perm_management_reports",
  "/reconciliation": "perm_financial_reports",
  "/stock-transfers": "perm_management_reports",
  "/pos": "perm_shift_closing",
  "/employee-self": "perm_management_reports",
  "/central-kitchen": "perm_management_reports",
  "/smart-purchase": "perm_management_reports",
};

function filterByPermission<T extends { to: string }>(items: T[], perms: Record<string, boolean>, isSAIF: boolean): T[] {
  if (isSAIF) return items;
  return items.filter((i) => {
    const perm = ROUTE_PERM[i.to];
    return !perm || !!perms[perm];
  });
}

export type NavGroupConfig = {
  groupLabelKey: string;
  groupIcon: LucideIcon;
  subGroups: {
    subLabelKey: string;
    items: NavItem[];
  }[];
  show: boolean;
};

export function buildNestedNavConfig(t: (k: string) => string, opts: {
  isBranchSupervisor: boolean;
  showAdminHub: boolean;
  isOwner: boolean;
  isSuperAdmin?: boolean;
  isExternalAccountant?: boolean;
  isGeneralManager?: boolean;
  permissions?: Record<string, boolean>;
}): NavGroupConfig[] {
  const {
    isBranchSupervisor,
    showAdminHub,
    isSuperAdmin = false,
    isExternalAccountant = false,
    permissions = {},
  } = opts;
  const isSAIF = opts.isSuperAdmin ?? false;

  const dashboardItems = filterByPermission(
    [
      { to: "/", label: t("homePage"), icon: icons.dashboard, primary: !isBranchSupervisor },
      ...(showAdminHub
        ? [
            { to: "/executive-dashboard", label: t("executiveDashboard"), icon: icons.admin, primary: false } as NavItem,
            { to: "/admin-hub", label: t("adminDashboard"), icon: icons.admin, primary: false } as NavItem,
          ]
        : []),
    ],
    permissions,
    isSAIF
  );

  const salesItems = filterByPermission(
    [
      { to: "/pos", label: t("posCashier"), icon: icons.pos },
      { to: "/shift-closing", label: t("shiftClosing"), icon: icons.shiftClosing },
      { to: "/forecast", label: t("forecast"), icon: icons.forecast },
    ],
    permissions,
    isSAIF
  );

  const itemsManagementItems = filterByPermission(
    [
      { to: "/ingredients", label: t("recipeInventory"), icon: icons.ingredients },
      { to: "/inventory/item-file", label: t("itemFile") ?? "Item File", icon: icons.itemFile },
      { to: "/prep-list", label: t("opsPrepList"), icon: icons.prepList, primary: isBranchSupervisor },
    ],
    permissions,
    isSAIF
  );

  const inventoryMovementsItems = filterByPermission(
    [
      { to: "/stock-transfers", label: t("stockTransfers"), icon: icons.stockTransfers },
      { to: "/central-kitchen", label: t("centralKitchen"), icon: icons.centralKitchen },
      { to: "/smart-purchase", label: t("smartPurchase"), icon: icons.smartPurchase },
      { to: "/waste-tracker", label: t("wasteEntry"), icon: icons.waste },
    ],
    permissions,
    isSAIF
  ).filter((i) => !(isBranchSupervisor && ["/stock-transfers", "/central-kitchen", "/smart-purchase"].includes(i.to)));

  const financialReportsItems = filterByPermission(
    [
      { to: "/finance", label: t("financialHub") ?? "Finance Hub", icon: icons.financial },
      { to: "/dashboard/reports", label: t("managementReports"), icon: icons.dashboard },
    ],
    permissions,
    isSAIF
  ).filter((i) => !(isBranchSupervisor && i.to === "/finance"));

  const auditingItems = filterByPermission(
    [
      { to: "/reconciliation", label: t("reconciliation"), icon: icons.reconciliation },
      { to: "/upload-center", label: t("uploadCenter"), icon: icons.upload },
    ],
    permissions,
    isSAIF
  ).filter((i) => !(isExternalAccountant && i.to === "/upload-center"));

  const selfServiceItems = filterByPermission(
    [
      { to: "/employee-self", label: t("employeeSelfService"), icon: icons.employeeSelf },
      { to: "/dashboard/heartbeat", label: t("cafeHeartbeat"), icon: icons.heartbeat },
    ],
    permissions,
    isSAIF
  );

  const opsItemsBranchOnly = filterByPermission(
    [
      { to: "/", label: t("homePage"), icon: icons.dashboard },
      { to: "/pos", label: t("posCashier"), icon: icons.pos, primary: true },
      { to: "/employee-self", label: t("employeeSelfService"), icon: icons.employeeSelf },
      { to: "/prep-list", label: t("opsPrepList"), icon: icons.prepList },
      { to: "/shift-closing", label: t("shiftClosing"), icon: icons.shiftClosing },
      { to: "/waste-tracker", label: t("wasteEntry"), icon: icons.waste },
    ],
    permissions,
    isSAIF
  );

  const groups: NavGroupConfig[] = [];

  if (isBranchSupervisor) {
    groups.push({
      groupLabelKey: "navGroupOperationsHub",
      groupIcon: LayoutDashboard,
      subGroups: [{ subLabelKey: "navGroupOperationsHub", items: opsItemsBranchOnly }],
      show: opsItemsBranchOnly.length > 0,
    });
  } else {
    groups.push({
      groupLabelKey: "navGroupOperationsHub",
      groupIcon: LayoutDashboard,
      subGroups: [
        { subLabelKey: "navGroupDashboard", items: dashboardItems },
        { subLabelKey: "navGroupSalesManagement", items: salesItems },
      ],
      show: dashboardItems.length > 0 || salesItems.length > 0,
    });

    const invSubGroups = [
      { subLabelKey: "navGroupItemsManagement", items: itemsManagementItems },
      { subLabelKey: "navGroupInventoryMovements", items: inventoryMovementsItems },
    ].filter((sg) => sg.items.length > 0);

    if (invSubGroups.length > 0) {
      groups.push({
        groupLabelKey: "navGroupInventorySupply",
        groupIcon: Package,
        subGroups: invSubGroups,
        show: true,
      });
    }

    const finSubGroups = [
      { subLabelKey: "navGroupFinancialReports", items: financialReportsItems },
      { subLabelKey: "navGroupAuditingReconciliation", items: auditingItems },
    ].filter((sg) => sg.items.length > 0);

    if (finSubGroups.length > 0) {
      groups.push({
        groupLabelKey: "navGroupFinanceAuditing",
        groupIcon: Wallet,
        subGroups: finSubGroups,
        show: true,
      });
    }

    if (selfServiceItems.length > 0) {
      groups.push({
        groupLabelKey: "navGroupSelfService",
        groupIcon: Users,
        subGroups: [{ subLabelKey: "navGroupSelfService", items: selfServiceItems }],
        show: true,
      });
    }
  }

  return groups.filter((g) => g.show);
}

/** Flat list of all items for mobile bar & backwards compatibility */
export function buildMainNavConfig(t: (k: string) => string, opts: Parameters<typeof buildNestedNavConfig>[1]): NavConfig[] {
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
  if (primaryItem && !primaryItem.primary) {
    primaryItem.primary = true;
  }
  return [{ items: allItems, show: allItems.length > 0 }];
}
