/**
 * Financial Report Controller – Unique IDs prevent data collision.
 */
export type FinancialReportId = "FIN-001" | "FIN-002" | "FIN-003" | "FIN-004" | "FIN-005" | "FIN-006" | "FIN-007" | "FIN-008" | "FIN-009" | "FIN-010";

export interface FinancialReportMeta {
  id: FinancialReportId;
  code: string;
  titleEn: string;
  titleAr: string;
  subtitleEn: string;
  subtitleAr: string;
  route: string;
  icon: "revenue" | "opex" | "cogs" | "gauge" | "cashflow" | "sitemap";
}

export const FINANCIAL_REPORTS: FinancialReportMeta[] = [
  {
    id: "FIN-001",
    code: "FIN-001",
    titleEn: "Daily Revenue Report",
    titleAr: "تقرير الإيرادات اليومية",
    subtitleEn: "Net sales, tax, and discount breakdown",
    subtitleAr: "صافي المبيعات، الضريبة، وتفصيل الخصومات",
    route: "/finance/daily-revenue",
    icon: "revenue",
  },
  {
    id: "FIN-002",
    code: "FIN-002",
    titleEn: "Operational Expenses (OPEX)",
    titleAr: "النفقات التشغيلية",
    subtitleEn: "Labor, rent, and utility costs",
    subtitleAr: "العمالة، الإيجار، وفواتير المرافق",
    route: "/finance/opex",
    icon: "opex",
  },
  {
    id: "FIN-003",
    code: "FIN-003",
    titleEn: "Cost of Goods Sold (COGS)",
    titleAr: "تكلفة البضاعة المباعة",
    subtitleEn: "Automated from recipe ingredients and stock usage",
    subtitleAr: "محسوبة آلياً من الوصفات واستخدام المخزون",
    route: "/finance/cogs",
    icon: "cogs",
  },
  {
    id: "FIN-004",
    code: "FIN-004",
    titleEn: "Net Profit Margin",
    titleAr: "هامش الربح الصافي",
    subtitleEn: "Profit percentage after all deductions",
    subtitleAr: "نسبة الربح بعد جميع الخصومات",
    route: "/finance/net-profit-margin",
    icon: "gauge",
  },
  {
    id: "FIN-005",
    code: "FIN-005",
    titleEn: "Cash Flow Statement",
    titleAr: "بيان التدفق النقدي",
    subtitleEn: "Money-in vs money-out",
    subtitleAr: "التدفق الداخل مقابل الخارج",
    route: "/finance/cash-flow",
    icon: "cashflow",
  },
  {
    id: "FIN-006",
    code: "FIN-006",
    titleEn: "Chart of Accounts",
    titleAr: "دليل الشجرة المحاسبية",
    subtitleEn: "Official Saif chart – Levels 1–5",
    subtitleAr: "نظام سيف المالي – المستويات 1–5",
    route: "/finance/chart-of-accounts",
    icon: "sitemap",
  },
  {
    id: "FIN-007",
    code: "FIN-007",
    titleEn: "Update Account Balances",
    titleAr: "تحديث أرصدة الحسابات",
    subtitleEn: "Import balances from Excel file",
    subtitleAr: "رفع أرصدة من ملف الإكسل",
    route: "/finance/balance-upload",
    icon: "revenue",
  },
  {
    id: "FIN-008",
    code: "FIN-008",
    titleEn: "Profit & Loss Report",
    titleAr: "تقرير الأرباح والخسائر",
    subtitleEn: "Revenue, expenses, and net profit from chart",
    subtitleAr: "تحليل الإيرادات والمصاريف من دليل الحسابات",
    route: "/finance/profit-loss",
    icon: "gauge",
  },
  {
    id: "FIN-009",
    code: "FIN-009",
    titleEn: "Income Statement",
    titleAr: "قائمة الدخل",
    subtitleEn: "Current vs previous period with variances",
    subtitleAr: "الفترة الحالية والسابقة مع الفروقات والنسب",
    route: "/finance/income-statement",
    icon: "revenue",
  },
  {
    id: "FIN-010",
    code: "FIN-010",
    titleEn: "Financial Charts Dashboard",
    titleAr: "لوحة الرسومات البيانية",
    subtitleEn: "Brand sales, operational efficiency, cost structure",
    subtitleAr: "توزيع مبيعات البراندات، كفاءة التشغيل، هيكل التكاليف",
    route: "/finance/charts-dashboard",
    icon: "gauge",
  },
];

export function getReportByCode(code: string): FinancialReportMeta | undefined {
  return FINANCIAL_REPORTS.find((r) => r.code === code);
}

export function getReportByRoute(route: string): FinancialReportMeta | undefined {
  return FINANCIAL_REPORTS.find((r) => r.route === route);
}
