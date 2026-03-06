/**
 * صفحة placeholder لخيارات نظام المبيعات قيد التطوير
 */
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { Construction, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

/** مفتاح العنوان من المسار (يدعم مسارات متداخلة مثل reports/daily-movement) */
const PATH_TO_MODULE: Record<string, string> = {
  centers: "sales-centers",
  exitors: "sales-exitors",
  sellers: "sales-sellers",
  plan: "sales-plan",
  networks: "sales-networks",
  "distributors-plan": "distributors-plan",
  groups: "sales-groups",
  invoice: "sales-invoice",
  quote: "sales-quote",
  commissions: "sales-commissions",
  orders: "sales-orders",
  "zakat-approval": "zakat-approval",
  "commissions-settle": "commissions-settle",
  "pending-payment": "pending-payment",
  "invoice-from-disbursement": "invoice-from-disbursement",
  "auto-manufacturing": "auto-manufacturing",
  "post-transactions": "post-transactions",
  "pending-payment-years": "pending-payment-years",
  "daily-movement": "daily-movement",
  "review-movements": "review-movements",
  "with-profit": "with-profit",
  "customers-summary": "customers-summary",
  "by-invoices": "by-invoices",
  "by-type": "by-type",
  "by-category": "by-category",
  "by-month": "by-month",
  "by-type-monthly": "by-type-monthly",
  "invoices-due": "invoices-due",
  "detailed-profits": "detailed-profits",
  "pending-details": "pending-details",
  "cancel-irregular": "cancel-irregular",
  "view-irregular": "view-irregular",
};

const MODULE_TITLES: Record<string, { ar: string; en: string }> = {
  "sales-centers": { ar: "ملف مراكز البيع", en: "Sales Centers File" },
  "sales-exitors": { ar: "ملف المخرجين", en: "Exitors File" },
  "sales-sellers": { ar: "ملف البائعين", en: "Sellers File" },
  "sales-plan": { ar: "خطة المبيعات", en: "Sales Plan" },
  "sales-networks": { ar: "ملف شبكات البيع", en: "Sales Networks File" },
  "distributors-plan": { ar: "خطة الموزعين", en: "Distributors Plan" },
  "sales-groups": { ar: "مجموعات المبيعات", en: "Sales Groups" },
  "sales-invoice": { ar: "فاتورة المبيعات", en: "Sales Invoice" },
  "sales-quote": { ar: "عرض سعر", en: "Price Quote" },
  "sales-commissions": { ar: "صرف عمولات البائعين", en: "Salespersons Commissions Disbursement" },
  "sales-orders": { ar: "طلبات المبيعات", en: "Sales Orders" },
  "zakat-approval": { ar: "اعتماد الزكاة - متعدد", en: "Zakat Approval - Multi" },
  "commissions-settle": { ar: "تسوية عمولات البائعين", en: "Settlement of Salespersons Commissions" },
  "pending-payment": { ar: "سداد الفواتير المعلقة", en: "Payment of Pending Invoices" },
  "invoice-from-disbursement": { ar: "فاتورة مبيعات من صرف", en: "Sales Invoice from Disbursement" },
  "auto-manufacturing": { ar: "أمر تصنيع آلي - متعدد", en: "Automatic Manufacturing Order - Multi" },
  "post-transactions": { ar: "ترحيل الحركات", en: "Post Transactions" },
  "pending-payment-years": { ar: "سداد الفواتير المعلقة - سنوات", en: "Payment of Pending Invoices - Years" },
  "daily-movement": { ar: "الحركة اليومية", en: "Daily Movement" },
  "review-movements": { ar: "مراجعة حركات المبيعات", en: "Review Sales Movements" },
  "with-profit": { ar: "المبيعات مع الربح", en: "Sales with Profit" },
  "customers-summary": { ar: "ملخص حركات العملاء", en: "Customer Activities Summary" },
  "by-invoices": { ar: "ملخص المبيعات حسب الفواتير", en: "Sales Summary by Invoices" },
  "by-type": { ar: "ملخص المبيعات حسب النوع", en: "Sales Summary by Type" },
  "by-category": { ar: "ملخص المبيعات حسب التصنيف", en: "Sales Summary by Category" },
  "by-month": { ar: "المبيعات حسب الأشهر", en: "Sales by Months" },
  "by-type-monthly": { ar: "المبيعات حسب النوع - شهري", en: "Sales by Type - Monthly" },
  "invoices-due": { ar: "الفواتير التي تستحق السداد", en: "Invoices Due for Payment" },
  "detailed-profits": { ar: "أرباح المبيعات مفصلة", en: "Detailed Sales Profits" },
  "pending-details": { ar: "تفاصيل الفواتير المعلقة", en: "Details of Pending Invoices" },
  "cancel-irregular": { ar: "إلغاء حركة مختلة", en: "Cancel Irregular Transaction" },
  "view-irregular": { ar: "عرض الحركات المختلة", en: "View Irregular Transactions" },
};

export default function SalesPlaceholderPage() {
  const { i18n } = useTranslation();
  const params = useParams<{ "*": string }>();
  const path = params["*"] || "";
  const lastSegment = path.split("/").filter(Boolean).pop() || path;
  const moduleKey = PATH_TO_MODULE[lastSegment] ?? (lastSegment || path || "option");
  const isRTL = i18n.language === "ar";
  const t = MODULE_TITLES[moduleKey] || MODULE_TITLES[path] || { ar: path || "خيار", en: path || "Option" };
  const title = isRTL ? t.ar : t.en;

  return (
    <div className="min-h-screen bg-[#0e1117] text-white flex items-center justify-center" dir={isRTL ? "rtl" : "ltr"}>
      <div className="text-center px-6 max-w-md">
        <div className="inline-flex p-4 rounded-2xl bg-amber-500/20 border border-amber-500/30 mb-6">
          <Construction className="h-12 w-12 text-amber-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">{title}</h1>
        <p className="text-gray-400 text-sm mb-6">
          {isRTL ? "هذا الخيار قيد التطوير وسيكون متاحاً قريباً." : "This feature is under development and will be available soon."}
        </p>
        <Link
          to="/pos"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {isRTL ? "العودة لنقطة البيع" : "Back to POS"}
        </Link>
      </div>
    </div>
  );
}
