"""
Universal Data Mapping – مصدر موحد لبيانات التقارير.
[Ref: SAIF] جميع تقارير المبيعات والدخل والصافي تسحب من نفس العنوان البرمجي.

Canonical field: ProductSale.total_sales (صافي المبيعات)
Fallback order: ProductSale → DailySale.total_sales → ShiftClosing.system_total_sales
"""
from django.db.models import Q, Sum

# Field name used across all reports for net sales
CANONICAL_SALES_FIELD = "total_sales"

# Model/field mapping for documentation
CANONICAL_SOURCE = {
    "primary": ("imports.ProductSale", "total_sales"),
    "fallback_1": ("imports.DailySale", "total_sales"),
    "fallback_2": ("shifts.ShiftClosing", "system_total_sales"),
}

# Exclude summary/total rows when aggregating ProductSale
PRODUCT_SALE_EXCLUDE_SUMMARY = (
    Q(product_name__icontains="total")
    | Q(product_name__icontains="المجموع")
    | Q(product_name__icontains="مجموع")
    | Q(product_name__icontains="subtotal")
    | Q(product_name__icontains="الإجمالي")
    | Q(product_name__icontains="إجمالي")
    | Q(product_name__icontains="اجمالي")
    | Q(product_sku__icontains="total")
    | Q(product_sku__icontains="المجموع")
    | Q(branch__name__icontains="total")
    | Q(branch__name__icontains="المجموع")
    | Q(branch__name__icontains="مجموع")
    | Q(branch__brand__name__icontains="total")
    | Q(branch__brand__name__icontains="المجموع")
)
