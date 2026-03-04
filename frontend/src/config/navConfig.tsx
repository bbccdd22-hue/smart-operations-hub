/**
 * Navigation config – Six Professional ERP Systems (Interconnected)
 *
 * 1. مركز العمليات     — Control hub, system monitoring, org settings
 * 2. نظام المبيعات     — POS, shifts, forecasting, sales reports
 * 3. نظام المخازن      — Items catalog, stock movements, inventory analysis
 * 4. نظام المشتريات    — Smart & manual purchase planning, materials mgmt
 * 5. نظام الحسابات     — Full accounting: P&L, cash flow, audit, tax, uploads
 * 6. نظام شؤون الموظفين — Employee portal, staff mgmt, shifts, branch config
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
  Building2,
  type LucideIcon,
} from "lucide-react";
import type { NavConfig, NavItem } from "../layouts/AppShellLayout";

/* ─── icon helpers ─────────────────────────────────────────────────── */
const svg = (d: string | string[], extra?: string) => (
  <svg className={`h-4 w-4 ${extra ?? ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    {(Array.isArray(d) ? d : [d]).map((path, i) => (
      <path key={i} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    ))}
    </svg>
);

const Ic = {
  /* ── General ───────────────────────────────────────────────────── */
  dashboard:   <LayoutDashboard className="h-4 w-4" />,
  barChart:    <BarChart3 className="h-4 w-4" />,
  trendUp:     <TrendingUp className="h-4 w-4" />,
  users:       <Users className="h-4 w-4" />,
  briefcase:   <Briefcase className="h-4 w-4" />,

  /* ── Operations ────────────────────────────────────────────────── */
  heartbeat:   svg("M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"),
  activity:    svg("M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"),
  bell:        svg("M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538.214 1.055.595 1.43L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"),
  bellSettings:svg(["M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z", "M15 12a3 3 0 11-6 0 3 3 0 016 0z"]),
  error:       svg("M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"),
  command:     svg("M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"),
  settings:    svg(["M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z", "M15 12a3 3 0 11-6 0 3 3 0 016 0z"]),
  system:      svg("M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4m0 0h18"),

  /* ── Org / settings extras ─────────────────────────────────────── */
  building:    svg("M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 00-1-1h-2a1 1 0 00-1 1v5m4 0H9"),
  tag:         svg("M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"),
  code:        svg("M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"),
  sliders:     svg("M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"),

  /* ── Sales ─────────────────────────────────────────────────────── */
  pos:         svg("M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"),
  shift:       svg("M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"),
  prepList:    svg("M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"),
  kitchen:     svg(["M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"]),
  forecast:    svg("M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"),
  profit:      svg("M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"),
  salesReport: svg(["M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"]),

  /* ── Inventory ─────────────────────────────────────────────────── */
  ingredients: svg("M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"),
  itemFile:    <Package className="h-4 w-4" />,
  products:    <ShoppingBag className="h-4 w-4" />,
  transfers:   svg("M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"),
  centralKitchen: svg(["M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"]),
  waste:       svg("M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"),
  stockValue:  svg(["M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"]),

  /* ── Procurement ───────────────────────────────────────────────── */
  smartPurchase:  <ShoppingCart className="h-4 w-4" />,
  manualForecast: <ClipboardList className="h-4 w-4" />,
  clipboardList:  <ClipboardList className="h-4 w-4" />,
  supplier:    svg(["M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"]),
  purchaseOrder: svg(["M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"]),

  /* ── Accounting ────────────────────────────────────────────────── */
  wallet:      <Wallet className="h-4 w-4" />,
  reports:     <BarChart3 className="h-4 w-4" />,
  check:       svg("M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"),
  upload:      svg("M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"),
  cashFlow:    svg(["M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"]),
  chart:       svg(["M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z", "M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"]),
  audit:       svg(["M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"]),
  book:        svg(["M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"]),
  adjustments: svg("M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"),
  auditor:     svg("M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"),
  receipt:     svg(["M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"]),
  card:        svg(["M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"]),
  income:      svg("M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"),
  netProfit:   svg("M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"),
  /* ── NEW Accounting icons ─────────────────────────────────────── */
  scale:       svg(["M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"]),
  bank:        svg(["M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"]),
  layers:      svg(["M12 2l10 6.5v7L12 22 2 15.5v-7L12 2z", "M12 22V9", "M22 8.5L12 15 2 8.5"]),
  target:      svg(["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"]),
  pencil:      svg("M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"),
  bookOpen:    svg(["M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"]),

  /* ── HR ────────────────────────────────────────────────────────── */
  employee:    svg("M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"),
  shield:      svg("M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"),
  calendar:    svg(["M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"]),
  userGroup:   svg("M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"),
  clock:       svg(["M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"]),
  performance: svg("M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"),
  selfService: svg("M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0M19.5 6.5l-15 15"),
  idCard:      svg(["M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"]),
};

/* ─── permission map ────────────────────────────────────────────────── */
const ROUTE_PERM: Record<string, string> = {
  /* ── Operations ─────────────────────────────────────────────────── */
  "/":                                   "perm_management_reports",
  "/dashboard":                          "perm_management_reports",
  "/executive-dashboard":                "perm_full_system_access",
  "/admin-hub":                          "perm_full_system_access",
  "/admin-hub/command-center":           "perm_full_system_access",
  "/admin-hub/activity-log":             "perm_full_system_access",
  "/admin-hub/notifications":            "perm_management_reports",
  "/admin-hub/notification-settings":    "perm_full_system_access",
  "/admin-hub/error-logs":               "perm_full_system_access",
  "/admin-hub/system-heartbeat":         "perm_full_system_access",
  "/admin-hub/test-dashboard":          "perm_full_system_access",
  "/admin-hub/system-customizer":       "perm_full_system_access",
  "/admin-hub/system-options":           "perm_full_system_access",
  "/admin-hub/system-codes":             "perm_full_system_access",
  /* ── Sales ──────────────────────────────────────────────────────── */
  "/pos":                                "perm_shift_closing",
  "/shift-closing":                      "perm_shift_closing",
  "/forecast":                           "perm_order_forecasting",
  "/prep-list":                          "perm_order_forecasting",
  "/kitchen":                            "perm_shift_closing",
  "/dashboard/heartbeat":                "perm_management_reports",
  "/dashboard/reports":                  "perm_management_reports",
  "/analytics/sales-summary":            "perm_management_reports",
  "/profit-dashboard":                   "perm_management_reports",
  "/finance/daily-revenue":              "perm_financial_reports",
  /* ── Inventory ──────────────────────────────────────────────────── */
  "/ingredients":                        "perm_management_reports",
  "/inventory/manage-ingredients":       "perm_management_reports",
  "/inventory/item-file":                "perm_management_reports",
  "/inventory/stock-balance":            "perm_management_reports",
  "/inventory/stock-movements":          "perm_management_reports",
  "/inventory/reports/item-balances":    "perm_management_reports",
  "/inventory/reports/daily-movements":  "perm_management_reports",
  "/products":                           "perm_management_reports",
  "/stock-transfers":                    "perm_management_reports",
  "/central-kitchen":                    "perm_management_reports",
  "/waste-tracker":                      "perm_management_reports",
  "/finance/cost-audit":                 "perm_financial_reports",
  "/finance/cogs":                       "perm_financial_reports",
  /* ── Procurement ────────────────────────────────────────────────── */
  "/smart-purchase":                     "perm_management_reports",
  "/manual-purchase-forecast":           "perm_management_reports",
  "/suppliers":                          "perm_management_reports",
  "/suppliers/balances":                 "perm_management_reports",
  "/suppliers/debt-aging":               "perm_management_reports",
  "/upload-center":                      "perm_management_reports",
  /* ── Accounting ─────────────────────────────────────────────────── */
  "/finance":                            "perm_financial_reports",
  "/finance/profit-loss":                "perm_financial_reports",
  "/finance/income-statement":           "perm_financial_reports",
  "/finance/cash-flow":                  "perm_financial_reports",
  "/finance/net-profit-margin":          "perm_financial_reports",
  "/finance/opex":                       "perm_financial_reports",
  "/finance/charts-dashboard":           "perm_financial_reports",
  "/finance/chart-of-accounts":          "perm_financial_reports",
  "/finance/trial-balance":              "perm_financial_reports",
  "/finance/account-statement":          "perm_financial_reports",
  "/finance/journal-entry":             "perm_financial_reports",
  "/finance/cost-centers":              "perm_financial_reports",
  "/finance/banks":                     "perm_financial_reports",
  "/finance/budget":                    "perm_financial_reports",
  "/finance/tax-report":               "perm_financial_reports",
  "/finance/receipts":                  "perm_financial_reports",
  "/finance/payments":                  "perm_financial_reports",
  "/finance/consolidated":              "perm_financial_reports",
  "/finance/auditor":                    "perm_financial_auditor",
  "/finance/manual-adjustments":         "perm_full_system_access",
  "/finance/balance-upload":             "perm_financial_reports",
  "/reconciliation":                     "perm_financial_reports",
  "/admin-hub/taxes":                    "perm_full_system_access",
  "/admin-hub/payment-methods":          "perm_full_system_access",
  "/admin-hub/smart-upload":             "perm_upload_files",
  /* ── HR ──────────────────────────────────────────────────────────── */
  "/employee-self":                      "perm_management_reports",
  "/admin-hub/users":                    "perm_full_system_access",
  "/admin-hub/roles":                    "perm_full_system_access",
  "/admin-hub/branches":                 "perm_full_system_access",
  "/admin-hub/brands":                   "perm_full_system_access",
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
   buildNestedNavConfig — Six professional interconnected ERP systems
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
     Branch Supervisor — Simplified daily-ops view
  ───────────────────────────────────────────────────────────────── */
  if (isBranchSupervisor) {
    const branchItems = filterByPermission([
      { to: "/",              label: t("homePage"),            icon: Ic.dashboard },
      { to: "/pos",           label: t("posCashier"),          icon: Ic.pos, primary: true },
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

  /* ═════════════════════════════════════════════════════════════════
     SYSTEM 1 — مركز العمليات
     Control hub, system monitoring, organisation settings
  ═════════════════════════════════════════════════════════════════ */

  /* 1a — لوحات التحكم والتحليل */
  const opsDashboards = filterByPermission([
    { to: "/",                         label: t("homePage"),           icon: Ic.dashboard, primary: true },
    { to: "/executive-dashboard",      label: t("executiveDashboard"), icon: Ic.command },
    { to: "/admin-hub/command-center", label: t("ownerCommandCenter"), icon: Ic.trendUp },
  ], permissions, isSAIF).filter((i) => {
    if (i.to !== "/") return showAdminHub;
    return true;
  });

  /* 1b — إدارة النظام */
  const opsAdmin = filterByPermission([
    { to: "/admin-hub",                      label: t("adminDashboard"),        icon: Ic.settings },
    { to: "/admin-hub/activity-log",         label: t("activityLog"),           icon: Ic.activity },
    { to: "/admin-hub/notifications",        label: t("notificationsList"),     icon: Ic.bell },
    { to: "/admin-hub/notification-settings",label: t("notificationSettings"),  icon: Ic.bellSettings },
    { to: "/admin-hub/error-logs",           label: t("systemErrorLogs"),       icon: Ic.error },
    { to: "/admin-hub/system-heartbeat",     label: t("systemHeartbeat"),       icon: Ic.system },
    { to: "/admin-hub/system-customizer",    label: t("systemCustomizer"),      icon: Ic.sliders },
    { to: "/admin-hub/test-dashboard",       label: "Test Dashboard",           icon: Ic.analytics },
  ], permissions, isSAIF).filter(() => showAdminHub);

  /* 1c — إعدادات وتنظيم المنشأة */
  const opsOrg = filterByPermission([
    { to: "/admin-hub/system-options", label: t("systemOptions"), icon: Ic.sliders },
    { to: "/admin-hub/system-codes",   label: t("systemCodes"),   icon: Ic.code },
  ], permissions, isSAIF).filter(() => showAdminHub);

  /* ═════════════════════════════════════════════════════════════════
     SYSTEM 2 — نظام المبيعات (Professional Sales ERP)
     الملفات الرئيسية | الحركات | التقارير | الأدوات المساعدة
  ═════════════════════════════════════════════════════════════════ */

  /* 2a — الملفات الرئيسية (قريباً) */
  const salesMasterFiles = filterByPermission([], permissions, isSAIF);

  /* 2b — الحركات (قريباً) */
  const salesTransactions = filterByPermission([], permissions, isSAIF);

  /* 2c — التنبؤ والتخطيط */
  const salesForecasting = filterByPermission([
    { to: "/forecast",            label: t("predictiveDashboard"), icon: Ic.forecast },
    { to: "/dashboard/heartbeat", label: t("cafeHeartbeat"),       icon: Ic.heartbeat },
  ], permissions, isSAIF);

  /* 2d — التقارير (خيارات مفعّلة فقط) */
  const salesReports = filterByPermission([
    { to: "/sales/reports/daily-movement",    label: t("salesDailyMovement"),    icon: Ic.calendar },
    { to: "/sales/reports/review-movements",   label: t("salesReviewMovements"),  icon: Ic.audit },
    { to: "/analytics/sales-summary",         label: t("salesSummary"),           icon: Ic.barChart },
    { to: "/dashboard/reports",   label: t("managementReports"),   icon: Ic.salesReport },
    { to: "/profit-dashboard",   label: t("profitDashboard"),     icon: Ic.profit },
    { to: "/finance/daily-revenue", label: t("dailyRevenue"),     icon: Ic.barChart },
  ], permissions, isSAIF);

  /* 2e — الأدوات المساعدة (قريباً) */
  const salesHelperTools = filterByPermission([], permissions, isSAIF);

  /* legacy — الكاشير */
  const salesCashier = filterByPermission([
    { to: "/pos",           label: t("posCashier"),    icon: Ic.pos },
    { to: "/shift-closing", label: t("shiftClosing"),  icon: Ic.shift },
    { to: "/prep-list",     label: t("opsPrepList"),   icon: Ic.prepList },
    { to: "/kitchen",       label: t("kitchenDisplay"),icon: Ic.kitchen },
  ], permissions, isSAIF);

  /* ═════════════════════════════════════════════════════════════════
     SYSTEM 3 — نظام المخازن (Professional Inventory/Warehouse ERP)
     الملفات الرئيسية | الحركات | التقارير | الجرد | الأدوات المساعدة
  ═════════════════════════════════════════════════════════════════ */

  /* 3a — الملفات الرئيسية (خيارات مفعّلة فقط) */
  const invMasterFiles = filterByPermission([
    { to: "/inventory/item-file",        label: t("itemFile"),                icon: Ic.itemFile },
    { to: "/ingredients",               label: t("recipeInventory"),         icon: Ic.ingredients },
    { to: "/products",                  label: t("productsList"),            icon: Ic.products },
    { to: "/inventory/manage-ingredients", label: t("manageIngredients"), icon: Ic.ingredients },
  ], permissions, isSAIF);

  /* 3b — الحركات (خيارات مفعّلة فقط) */
  const invTransactions = filterByPermission([
    { to: "/stock-transfers",           label: t("invItemTransfer"),         icon: Ic.transfers },
    { to: "/central-kitchen",           label: t("centralKitchen"),         icon: Ic.centralKitchen },
    { to: "/waste-tracker",             label: t("wasteEntry"),              icon: Ic.waste },
    { to: "/inventory/stock-balance",   label: t("invItemBalances"),        icon: Ic.wallet },
    { to: "/inventory/stock-movements", label: t("invDailyMovements"),      icon: Ic.calendar },
  ], permissions, isSAIF);

  /* 3c — التقارير (خيارات مفعّلة فقط) */
  const invReports = filterByPermission([
    { to: "/inventory/reports/daily-movements", label: t("invDailyMovements"), icon: Ic.calendar },
    { to: "/inventory/reports/item-balances", label: t("invItemBalances"), icon: Ic.wallet },
    { to: "/finance/cost-audit",       label: t("costAuditCenter"),        icon: Ic.audit },
    { to: "/finance/cogs",             label: t("costOfGoodsSold"),         icon: Ic.stockValue },
  ], permissions, isSAIF);

  /* 3d — الجرد (قريباً) */
  const invStocktake = filterByPermission([], permissions, isSAIF);

  /* 3e — الأدوات المساعدة (قريباً) */
  const invHelperTools = filterByPermission([], permissions, isSAIF);


  /* ═════════════════════════════════════════════════════════════════
     SYSTEM 4 — نظام المشتريات (Professional Procurement ERP)
     الملفات الرئيسية | الحركات | التقارير | الأدوات المساعدة
  ═════════════════════════════════════════════════════════════════ */

  /* 4a — الملفات الرئيسية (قريباً) */
  const procMasterFiles = filterByPermission([], permissions, isSAIF);

  /* 4b — الحركات (خيارات مفعّلة فقط) */
  const procTransactions = filterByPermission([
    { to: "/procurement/invoices",         label: t("purchaseInvoices"),    icon: Ic.receipt },
    { to: "/procurement/invoices/new",     label: t("newPurchaseInvoice"),   icon: Ic.receipt },
    { to: "/procurement/orders",           label: t("purchaseOrders"),      icon: Ic.purchaseOrder },
    { to: "/procurement/goods-receipts",   label: t("goodsReceipts"),       icon: Ic.receipt },
    { to: "/procurement/requests",         label: t("purchaseRequests"),    icon: Ic.clipboardList },
    { to: "/smart-purchase",               label: t("smartPurchase"),      icon: Ic.smartPurchase },
    { to: "/manual-purchase-forecast",     label: t("manualPurchaseForecast"), icon: Ic.manualForecast },
    { to: "/stock-transfers",              label: t("stockTransfers"),      icon: Ic.transfers },
    { to: "/central-kitchen",              label: t("centralKitchen"),      icon: Ic.centralKitchen },
    { to: "/upload-center",               label: t("uploadCenter"),        icon: Ic.upload },
  ], permissions, isSAIF);

  /* 4c — التقارير (خيارات مفعّلة فقط) */
  const procReports = filterByPermission([
    { to: "/procurement/reports/daily-movements",  label: t("procDailyMovements"),    icon: Ic.calendar },
    { to: "/procurement/reports/review-movements", label: t("procReviewMovements"), icon: Ic.audit },
    { to: "/suppliers/balances",                    label: t("procSuppliersSummary"), icon: Ic.wallet },
  ], permissions, isSAIF);

  /* 4d — الأدوات المساعدة (قريباً) */
  const procHelperTools = filterByPermission([], permissions, isSAIF);

  /* legacy aliases for backward compatibility */
  const procPlanning  = [];
  const procMaterials = filterByPermission([
    { to: "/stock-transfers",  label: t("stockTransfers"),  icon: Ic.transfers },
    { to: "/central-kitchen",  label: t("centralKitchen"),  icon: Ic.supplier },
    { to: "/waste-tracker",    label: t("wasteEntry"),      icon: Ic.waste },
    { to: "/upload-center",   label: t("uploadCenter"),     icon: Ic.upload },
  ], permissions, isSAIF);

  /* ═════════════════════════════════════════════════════════════════
     SYSTEM 4c — نظام الموردين (Suppliers System)
     الملفات الرئيسية + التقارير
  ═════════════════════════════════════════════════════════════════ */

  const suppMasterFiles = filterByPermission([
    { to: "/suppliers",         label: t("suppliersEntry"),    icon: Ic.supplier },
  ], permissions, isSAIF);

  const suppReports = filterByPermission([
    { to: "/suppliers/balances",   label: t("supplierBalances"),   icon: Ic.wallet },
    { to: "/suppliers/debt-aging", label: t("supplierDebtAging"), icon: Ic.clock },
  ], permissions, isSAIF);

  /* ═════════════════════════════════════════════════════════════════
     SYSTEM 5 — نظام الحسابات (Professional Accounting ERP)
     Structured like real accounting software:
     A. الملفات الرئيسية  B. إدخال الحركات  C. التقارير
     D. المطابقة والتدقيق  E. رفع البيانات
  ═════════════════════════════════════════════════════════════════ */

  /* 5A — الملفات الرئيسية (Master Files) */
  const finMasterFiles = filterByPermission([
    { to: "/finance/chart-of-accounts", label: t("chartOfAccounts"),      icon: Ic.book },
    { to: "/finance/cost-centers",      label: t("costCenters"),           icon: Ic.layers },
    { to: "/finance/banks",             label: t("banksCash"),             icon: Ic.bank },
    { to: "/finance/budget",            label: t("budgetPlanning"),        icon: Ic.target },
    { to: "/finance/balance-upload",    label: t("openingBalances"),       icon: Ic.upload },
  ], permissions, isSAIF);

  /* 5B — إدخال الحركات (Transactions Entry) */
  const finTransactions = filterByPermission([
    { to: "/finance/journal-entry",     label: t("journalEntry"),          icon: Ic.pencil },
    { to: "/finance/receipts",          label: t("cashReceipts"),          icon: Ic.receipt },
    { to: "/finance/payments",          label: t("cashPayments"),          icon: Ic.card },
    { to: "/reconciliation",            label: t("bankReconciliation"),    icon: Ic.check },
    { to: "/finance/manual-adjustments",label: t("closingEntries"),        icon: Ic.adjustments },
  ], permissions, isSAIF).filter((i) =>
    !(i.to === "/finance/manual-adjustments" && !isSAIF)
  );

  /* 5C — التقارير (Reports) */
  const finReports = filterByPermission([
    { to: "/finance/trial-balance",     label: t("trialBalance"),          icon: Ic.scale },
    { to: "/finance/account-statement", label: t("accountStatement"),      icon: Ic.bookOpen },
    { to: "/finance/income-statement",  label: t("incomeStatement"),       icon: Ic.book },
    { to: "/finance/profit-loss",       label: t("profitLoss"),            icon: Ic.trendUp },
    { to: "/finance/cash-flow",         label: t("cashFlowStatement"),     icon: Ic.cashFlow },
    { to: "/finance/net-profit-margin", label: t("netProfitMargin"),       icon: Ic.netProfit },
    { to: "/finance/charts-dashboard",  label: t("financialChartsDashboard"), icon: Ic.chart },
    { to: "/finance/daily-revenue",     label: t("dailyRevenue"),          icon: Ic.calendar },
    { to: "/finance/tax-report",        label: t("taxReport"),             icon: Ic.receipt },
  ], permissions, isSAIF);

  /* 5D — التحليل والتدقيق (Analysis & Audit) */
  const finAuditAnalysis = filterByPermission([
    { to: "/profit-dashboard",          label: t("profitDashboard"),       icon: Ic.profit },
    { to: "/finance/cogs",              label: t("costOfGoodsSold"),       icon: Ic.audit },
    { to: "/finance/opex",              label: t("operationalExpenses"),   icon: Ic.adjustments },
    { to: "/finance/cost-audit",        label: t("costAuditCenter"),       icon: Ic.salesReport },
    { to: "/finance/auditor",           label: t("financialAuditor"),      icon: Ic.auditor },
    { to: "/finance/consolidated",      label: t("consolidatedStatements"),icon: Ic.wallet },
  ], permissions, isSAIF);

  /* 5E — رفع البيانات (Data Uploads) */
  const finUploads = filterByPermission([
    { to: "/upload-center",          label: t("uploadCenter"),          icon: Ic.upload },
    { to: "/admin-hub/smart-upload", label: t("smartDataUpload"),       icon: Ic.trendUp },
    { to: "/admin-hub/taxes",        label: t("taxSettings"),           icon: Ic.receipt },
    { to: "/admin-hub/payment-methods",label: t("paymentMethods"),      icon: Ic.card },
  ], permissions, isSAIF).filter((i) =>
    !(isExternalAccountant && i.to === "/admin-hub/smart-upload") &&
    !(["admin-hub/taxes", "/admin-hub/payment-methods"].some((s) => i.to.includes(s)) && !showAdminHub)
  );

  /* backward compatibility aliases */
  const finStatements  = finReports;
  const finAnalysis    = finAuditAnalysis;
  const finAudit       = finMasterFiles;
  const finTaxes: typeof finUploads = [];

  /* ═════════════════════════════════════════════════════════════════
     SYSTEM 6 — نظام شؤون الموظفين
     Employee portal, staff management, shifts, branch/org config
  ═════════════════════════════════════════════════════════════════ */

  /* 6a — بوابة الموظف */
  const hrPortal = filterByPermission([
    { to: "/employee-self", label: t("employeeSelfService"), icon: Ic.selfService },
  ], permissions, isSAIF);

  /* 6b — إدارة الكوادر البشرية */
  const hrStaff = filterByPermission([
    { to: "/admin-hub/users",  label: t("employeeDirectory"), icon: Ic.idCard },
    { to: "/admin-hub/roles",  label: t("rolesPermissions"),  icon: Ic.shield },
  ], permissions, isSAIF).filter(() => showAdminHub);

  /* 6c — الورديات وجداول العمل (cross-link with Sales) */
  const hrShifts = filterByPermission([
    { to: "/shift-closing",    label: t("shiftRecords"),           icon: Ic.clock },
    { to: "/dashboard/reports",label: t("shiftPerformanceReports"),icon: Ic.performance },
    { to: "/prep-list",        label: t("opsPrepList"),             icon: Ic.prepList },
  ], permissions, isSAIF);

  /* 6d — إعدادات وتنظيم المنشأة */
  const hrOrg = filterByPermission([
    { to: "/admin-hub/branches", label: t("branchManagement"), icon: Ic.building },
    { to: "/admin-hub/brands",   label: t("brandManagement"),  icon: Ic.tag },
    { to: "/admin-hub",          label: t("adminDashboard"),   icon: Ic.settings },
  ], permissions, isSAIF).filter(() => showAdminHub);

  /* ─────────────────────────────────────────────────────────────────
     Assemble final groups
  ───────────────────────────────────────────────────────────────── */
  const groups: NavGroupConfig[] = [];

  /* 1 — مركز العمليات */
  const opsSubGroups = [
    { subLabelKey: "navSubOpsDashboards", items: opsDashboards },
    { subLabelKey: "navSubOpsAdmin",      items: opsAdmin },
    { subLabelKey: "navSubOpsOrg",        items: opsOrg },
  ].filter((sg) => sg.items.length > 0);
  if (opsSubGroups.length > 0) {
    groups.push({ groupLabelKey: "navGroupOperationsHub", groupIcon: LayoutDashboard, subGroups: opsSubGroups, show: true });
  }

  /* 2 — نظام المبيعات */
  const salesSubGroups = [
    { subLabelKey: "navSubSalesMaster",   items: salesMasterFiles },
    { subLabelKey: "navSubSalesTransactions", items: salesTransactions },
    { subLabelKey: "navSubSalesCashier",  items: salesCashier },
    { subLabelKey: "navSubSalesForecasting", items: salesForecasting },
    { subLabelKey: "navSubSalesReports",   items: salesReports },
    { subLabelKey: "navSubSalesTools",     items: salesHelperTools },
  ].filter((sg) => sg.items.length > 0);
  if (salesSubGroups.length > 0) {
    groups.push({ groupLabelKey: "navSystemSales", groupIcon: BarChart3, subGroups: salesSubGroups, show: true });
  }

  /* 3 — نظام المخازن */
  const invSubGroups = [
    { subLabelKey: "navSubInvMaster",    items: invMasterFiles },
    { subLabelKey: "navSubInvTransactions", items: invTransactions },
    { subLabelKey: "navSubInvReports",   items: invReports },
    { subLabelKey: "navSubInvStocktake", items: invStocktake },
    { subLabelKey: "navSubInvTools",     items: invHelperTools },
  ].filter((sg) => sg.items.length > 0);
  if (invSubGroups.length > 0) {
    groups.push({ groupLabelKey: "navSystemInventory", groupIcon: Package, subGroups: invSubGroups, show: true });
  }

  /* 4 — نظام المشتريات */
  const procSubGroups = [
    { subLabelKey: "navSubProcMaster",   items: procMasterFiles },
    { subLabelKey: "navSubProcTransactions", items: procTransactions },
    { subLabelKey: "navSubProcReports",   items: procReports },
    { subLabelKey: "navSubProcTools",    items: procHelperTools },
    { subLabelKey: "navSubProcMaterials", items: procMaterials },
  ].filter((sg) => sg.items.length > 0);
  if (procSubGroups.length > 0) {
    groups.push({ groupLabelKey: "navSystemProcurement", groupIcon: ShoppingCart, subGroups: procSubGroups, show: true });
  }

  /* 4s — نظام الموردين */
  const suppSubGroups = [
    { subLabelKey: "navSubSuppMaster",  items: suppMasterFiles },
    { subLabelKey: "navSubSuppReports", items: suppReports },
  ].filter((sg) => sg.items.length > 0);
  if (suppSubGroups.length > 0) {
    groups.push({ groupLabelKey: "navSystemSuppliers", groupIcon: Building2, subGroups: suppSubGroups, show: true });
  }

  /* 5 — نظام الحسابات */
  const finSubGroups = [
    { subLabelKey: "navSubAccMasterFiles",   items: finMasterFiles },
    { subLabelKey: "navSubAccTransactions",  items: finTransactions },
    { subLabelKey: "navSubAccReports",       items: finReports },
    { subLabelKey: "navSubAccAudit",         items: finAuditAnalysis },
    { subLabelKey: "navSubAccUploads",       items: finUploads },
  ].filter((sg) => sg.items.length > 0);
  if (finSubGroups.length > 0) {
    groups.push({ groupLabelKey: "navSystemAccounting", groupIcon: Wallet, subGroups: finSubGroups, show: true });
  }

  /* 6 — نظام شؤون الموظفين */
  const hrSubGroups = [
    { subLabelKey: "navSubHRPortal",  items: hrPortal },
    { subLabelKey: "navSubHRStaff",   items: hrStaff },
    { subLabelKey: "navSubHRShifts",  items: hrShifts },
    { subLabelKey: "navSubHROrg",     items: hrOrg },
  ].filter((sg) => sg.items.length > 0);
  if (hrSubGroups.length > 0) {
    groups.push({ groupLabelKey: "navSystemHR", groupIcon: Briefcase, subGroups: hrSubGroups, show: true });
  }

  return groups.filter((g) => g.show);
}

/* ── Flat list for mobile bottom bar ──────────────────────────────── */
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
