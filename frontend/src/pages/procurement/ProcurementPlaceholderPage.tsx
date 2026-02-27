/**
 * صفحة placeholder لخيارات نظام المشتريات قيد التطوير
 */
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { Construction, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

/** مفتاح العنوان من المسار (يدعم مسارات متداخلة مثل reports/daily-movements) */
const PATH_TO_MODULE: Record<string, string> = {
  "purchase-centers": "purchase-centers",
  "purchase-reps": "purchase-reps",
  "invoices": "invoices",
  "orders": "orders",
  "print-barcode": "print-barcode",
  "invoice-from-receipt": "invoice-from-receipt",
  "consignment": "consignment",
  "post-transactions": "post-transactions",
  "daily-movements": "daily-movements",
  "review-movements": "review-movements",
  "by-type": "purchases-by-type",
  "by-category": "purchases-by-category",
  "by-month": "purchases-by-month",
  "invoice-payment": "invoice-payment",
  "order-report": "order-report",
  "reorder-report": "reorder-report",
  "reps-report": "reps-report",
  "receipt-review": "receipt-review",
  "payment-details": "payment-details",
  "check": "check-transactions",
  "cancel": "cancel-irregular",
  "irregular": "irregular-transactions",
};

const MODULE_TITLES: Record<string, { ar: string; en: string }> = {
  "purchase-centers":     { ar: "مراكز الشراء",           en: "Purchase Centers" },
  "purchase-reps":       { ar: "مندوبين المشتروات",      en: "Purchase Representatives" },
  "invoices":            { ar: "فواتير الشراء",          en: "Purchase Invoices" },
  "orders":              { ar: "طلبات الشراء",           en: "Purchase Orders" },
  "print-barcode":       { ar: "طباعة الباركود",         en: "Print Barcode" },
  "invoice-from-receipt": { ar: "فاتورة شراء من إستلام", en: "Purchase Invoice from Receipt" },
  "consignment":         { ar: "شراء تحت التصريف",      en: "Purchase Under Consignment" },
  "post-transactions":   { ar: "ترحيل الحركات",         en: "Post Transactions" },
  "daily-movements":     { ar: "الحركات اليومية",       en: "Daily Movements" },
  "review-movements":    { ar: "مراجعة حركات المشتروات", en: "Review Purchase Movements" },
  "suppliers-summary":   { ar: "ملخص حركات الموردين",   en: "Suppliers Movements Summary" },
  "purchases-by-type":    { ar: "ملخص المشتروات حسب النوع", en: "Purchases Summary by Type" },
  "purchases-by-category": { ar: "ملخص المشتروات حسب التصنيف", en: "Purchases Summary by Category" },
  "purchases-by-month":   { ar: "المشتروات حسب الأشهر",  en: "Purchases by Months" },
  "invoice-payment":     { ar: "سداد فواتير الشراء",     en: "Payment of Purchase Invoices" },
  "order-report":        { ar: "تقرير طلبات الشراء",     en: "Purchase Order Report" },
  "reorder-report":      { ar: "تقرير أعادة طلب الشراء", en: "Re-order Report" },
  "reps-report":         { ar: "تقارير مندوبين المشتروات", en: "Purchase Reps Reports" },
  "receipt-review":      { ar: "مراجعة المشتروات من إستلام", en: "Review Purchases from Receipt" },
  "payment-details":     { ar: "تفاصيل سداد المشتروات", en: "Purchase Payment Details" },
  "check-transactions":  { ar: "فحص حركات المشتريات",   en: "Check Purchase Transactions" },
  "cancel-irregular":    { ar: "إلغاء حركة مختلة",      en: "Cancel Irregular Transaction" },
  "irregular-transactions": { ar: "عرض الحركات المختلة", en: "View Irregular Transactions" },
};

export default function ProcurementPlaceholderPage() {
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
          to="/smart-purchase"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {isRTL ? "العودة للتنبؤ الذكي" : "Back to Smart Purchase"}
        </Link>
      </div>
    </div>
  );
}
