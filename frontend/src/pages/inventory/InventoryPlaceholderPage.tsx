/**
 * صفحة placeholder لخيارات نظام المخازن قيد التطوير
 * تُمَكّن ربط النظام بالمشتريات والمبيعات والحسابات
 */
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { Construction, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

/** مفتاح العنوان من المسار */
const PATH_TO_MODULE: Record<string, string> = {
  items: "inv-items",
  classification: "inv-classification",
  warehouses: "inv-warehouses",
  "dispensing-types": "inv-dispensing",
  "opening-balances": "inv-opening",
  "compound-items": "inv-compound",
  sizes: "inv-sizes",
  colors: "inv-colors",
  "storekeeper-types": "inv-storekeeper",
  seasons: "inv-seasons",
  "print-barcode": "inv-print-barcode",
  "multi-barcode": "inv-multi-barcode",
  "adjusted-pricing": "inv-pricing",
  "receipt-issue": "inv-receipt-issue",
  "quantity-adjustment": "inv-qty-adj",
  "price-change": "inv-price-change",
  manufacturing: "inv-manufacturing",
  revaluation: "inv-revaluation",
  "approve-transfers": "inv-approve",
  clearance: "inv-clearance",
  "warehouse-requests": "inv-requests",
  "stocktake-compare": "inv-stocktake",
  "post-transactions": "inv-post",
  "unlink-manufacturing": "inv-unlink",
  "receipt-from-po": "inv-receipt-po",
  "issue-from-so": "inv-issue-so",
  "outbound-transfer": "inv-outbound",
  "inbound-transfer": "inv-inbound",
  "transfer-companies": "inv-transfer-co",
  "dispensing-movement": "inv-disp-mov",
  "transfer-movement": "inv-transfer-mov",
  "review-requests": "inv-review-req",
  clearances: "inv-clearances",
  "inout-movement": "inv-inout",
  "daily-movements": "inv-daily",
  "basic-item-data": "inv-basic-data",
  "review-movements": "inv-review-mov",
  "item-summary": "inv-item-summary",
  "detailed-statement": "inv-detailed",
  "review-item-movements": "inv-review-item",
  "review-item-years": "inv-review-years",
  "inventory-value": "inv-value",
  "sales-movements": "inv-sales-mov",
  "item-balances": "inv-balances",
  "sales-summary": "inv-sales-sum",
  "sales-vs-cost": "inv-sales-cost",
  "item-locations": "inv-locations",
  "item-activity": "inv-activity",
  "movement-summary": "inv-mov-sum",
  chart: "inv-chart",
  "value-by-category": "inv-val-cat",
  "warehouse-summary": "inv-wh-sum",
  "value-by-date": "inv-val-date",
  "movement-details": "inv-mov-details",
  "revenue-cost-comparison": "inv-rev-cost",
  "expired-items": "inv-expired",
  "total-by-category": "inv-total-cat",
  "turnover-ratio": "inv-turnover",
  "reorder-level": "inv-reorder",
  "movement-by-class": "inv-mov-class",
  "stagnation-period": "inv-stagnation",
  "monthly-ops": "inv-monthly",
  "balances-comparative": "inv-bal-comp",
  "inventory-age": "inv-age",
  "inventory-analysis": "inv-analysis",
  "inventory-aggregate": "inv-aggregate",
  "balances-by-group": "inv-bal-group",
  review: "inv-stocktake-review",
  "build-balances": "inv-build",
  "cancel-irregular": "inv-cancel",
  "pull-from-excel": "inv-excel",
};

const MODULE_TITLES: Record<string, { ar: string; en: string }> = {
  "inv-items": { ar: "ملف الأصناف", en: "Items File" },
  "inv-classification": { ar: "ملف التصنيف", en: "Classification File" },
  "inv-warehouses": { ar: "ملف المخازن", en: "Warehouses File" },
  "inv-dispensing": { ar: "أنواع صرف الأصناف", en: "Item Dispensing Types" },
  "inv-opening": { ar: "أرصدة إفتتاحية", en: "Opening Balances" },
  "inv-compound": { ar: "الأصناف المركبة", en: "Compound Items" },
  "inv-sizes": { ar: "تعريف المقاسات", en: "Define Sizes" },
  "inv-colors": { ar: "تعريف الألوان", en: "Define Colors" },
  "inv-storekeeper": { ar: "أنواع طلبات الخازن", en: "Storekeeper Request Types" },
  "inv-seasons": { ar: "تعريف المواسم", en: "Define Seasons" },
  "inv-print-barcode": { ar: "طباعة الباركود للأصناف", en: "Print Barcode for Items" },
  "inv-multi-barcode": { ar: "أصناف متعددة البراكيد", en: "Items with Multiple Barcodes" },
  "inv-pricing": { ar: "تسعيرة الأصناف المعدلة", en: "Adjusted Item Pricing" },
  "inv-receipt-issue": { ar: "سند إستلام / صرف", en: "Receipt / Issue Voucher" },
  "inv-qty-adj": { ar: "سند تسوية كمية", en: "Quantity Adjustment Voucher" },
  "inv-price-change": { ar: "رفع / خفض الأسعار", en: "Price Increase / Decrease" },
  "inv-manufacturing": { ar: "أمر تصنيع", en: "Manufacturing Order" },
  "inv-revaluation": { ar: "إعادة تقييم المخزون", en: "Inventory Revaluation" },
  "inv-approve": { ar: "تعميد التحويلات المخزنية", en: "Approve Stock Transfers" },
  "inv-clearance": { ar: "فسح بضاعة", en: "Clearance of Goods" },
  "inv-requests": { ar: "طلبات المخازن", en: "Warehouse Requests" },
  "inv-stocktake": { ar: "جرد المقارنة", en: "Stocktake Comparison" },
  "inv-post": { ar: "ترحيل الحركات", en: "Post Transactions" },
  "inv-unlink": { ar: "فك أمر تصنيع", en: "Unlink Manufacturing Order" },
  "inv-receipt-po": { ar: "إستلام من طلب شراء", en: "Receipt from Purchase Order" },
  "inv-issue-so": { ar: "صرف من طلب بيع", en: "Issue from Sales Order" },
  "inv-outbound": { ar: "سند تحويل صادر", en: "Outbound Transfer Voucher" },
  "inv-inbound": { ar: "سند تحويل وارد", en: "Inbound Transfer Voucher" },
  "inv-transfer-co": { ar: "سند تحويل صنف - شركات", en: "Item Transfer - Companies" },
  "inv-disp-mov": { ar: "حركة صرف المخازن", en: "Warehouse Dispensing Movement" },
  "inv-transfer-mov": { ar: "حركة التحويلات المخزنية", en: "Stock Transfer Movement" },
  "inv-review-req": { ar: "مراجعة طلبات المخازن", en: "Review Warehouse Requests" },
  "inv-clearances": { ar: "الفسوحات المخزنية", en: "Warehouse Clearances" },
  "inv-inout": { ar: "حركة المخازن وارد / منصرف", en: "Warehouse In/Out Movement" },
  "inv-daily": { ar: "الحركات اليومية", en: "Daily Movements" },
  "inv-basic-data": { ar: "بيانات الأصناف الأساسية", en: "Basic Item Data" },
  "inv-review-mov": { ar: "مراجعة حركات المخازن", en: "Review Warehouse Movements" },
  "inv-item-summary": { ar: "ملخص | تفصيل الصنف", en: "Item Summary / Detail" },
  "inv-detailed": { ar: "كشف تفصيلي للمخازن", en: "Detailed Inventory Statement" },
  "inv-review-item": { ar: "مراجعة حركات الأصناف", en: "Review Item Movements" },
  "inv-review-years": { ar: "مراجعة حركات الأصناف - سنوات", en: "Review Item Movements - Years" },
  "inv-value": { ar: "قيمة المخزون", en: "Inventory Value" },
  "inv-sales-mov": { ar: "حركات المبيعات", en: "Sales Movements" },
  "inv-balances": { ar: "أرصدة الأصناف", en: "Item Balances" },
  "inv-sales-sum": { ar: "ملخص المبيعات", en: "Sales Summary" },
  "inv-sales-cost": { ar: "مقارنة المبيعات بالتكلفة", en: "Sales vs. Cost Comparison" },
  "inv-locations": { ar: "مواقع الأصناف", en: "Item Locations" },
  "inv-activity": { ar: "نشاط الأصناف", en: "Item Activity" },
  "inv-mov-sum": { ar: "ملخص حركة الأصناف - إجمالي", en: "Item Movement Summary - Overall" },
  "inv-chart": { ar: "الرسم البياني", en: "Chart / Graph" },
  "inv-val-cat": { ar: "قيمة المخزون حسب التصنيف", en: "Inventory Value by Category" },
  "inv-wh-sum": { ar: "ملخص حركات المخازن", en: "Summary of Warehouse Movements" },
  "inv-val-date": { ar: "قيمة المخزون حسب التاريخ", en: "Inventory Value by Date" },
  "inv-mov-details": { ar: "تفاصيل حركة المخازن", en: "Details of Warehouse Movement" },
  "inv-rev-cost": { ar: "مقارنة الإيرادات والتكاليف بين فترتين", en: "Revenue & Cost Comparison" },
  "inv-expired": { ar: "الأصناف المنتهية الصلاحية", en: "Expired Items" },
  "inv-total-cat": { ar: "إجمالي المخازن حسب التصنيف", en: "Total Inventory by Category" },
  "inv-turnover": { ar: "نسبة تصريف الأصناف", en: "Item Turnover Ratio" },
  "inv-reorder": { ar: "تقرير حد الطلب للأصناف", en: "Reorder Level Report" },
  "inv-mov-class": { ar: "إجمالي حركة المخازن حسب التصنيف", en: "Movement by Classification" },
  "inv-stagnation": { ar: "فترة الركود للأصناف", en: "Stagnation Period for Items" },
  "inv-monthly": { ar: "ملخص العمليات - شهري", en: "Operations Summary - Monthly" },
  "inv-bal-comp": { ar: "أرصدة الأصناف وارد / منصرف - مقارن", en: "Item Balances - Comparative" },
  "inv-age": { ar: "عمر المخزون", en: "Inventory Age" },
  "inv-analysis": { ar: "تحليل المخزون", en: "Inventory Analysis" },
  "inv-aggregate": { ar: "مجمع المخزون", en: "Inventory Aggregate" },
  "inv-bal-group": { ar: "أرصدة الأصناف حسب مجموعة", en: "Item Balances by Group" },
  "inv-stocktake-review": { ar: "مراجعة الجرد", en: "Stocktake Review" },
  "inv-build": { ar: "بناء الأرصدة المخزنية", en: "Build Inventory Balances" },
  "inv-cancel": { ar: "إلغاء حركة مختلة", en: "Cancel Irregular Movement" },
  "inv-excel": { ar: "سحب من Excel", en: "Pull from Excel" },
};

export default function InventoryPlaceholderPage() {
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
        <div className="inline-flex p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 mb-6">
          <Construction className="h-12 w-12 text-emerald-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">{title}</h1>
        <p className="text-gray-400 text-sm mb-6">
          {isRTL ? "هذا الخيار قيد التطوير وسيكون متاحاً قريباً." : "This feature is under development and will be available soon."}
        </p>
        <Link
          to="/stock-transfers"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {isRTL ? "العودة للنقل بين المخازن" : "Back to Stock Transfers"}
        </Link>
      </div>
    </div>
  );
}
