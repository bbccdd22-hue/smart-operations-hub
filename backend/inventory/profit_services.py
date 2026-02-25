"""Profit and COGS calculation services.
[Ref: SAIF] Universal Data Mapping – uses same ProductSale.total_sales as analytics.
"""
import re
from datetime import date
from decimal import Decimal
from typing import Any

from django.db.models import Sum

from inventory.models import Ingredient
from inventory.services import explode_recipe_requirements

try:
    from imports.models import ProductSale
except ImportError:
    ProductSale = None

try:
    from analytics.report_data_sources import (
        PRODUCT_SALE_EXCLUDE_SUMMARY,
        CANONICAL_SALES_FIELD,
    )
except ImportError:
    from django.db.models import Q
    PRODUCT_SALE_EXCLUDE_SUMMARY = (
        Q(product_name__icontains="total")
        | Q(product_name__icontains="المجموع")
        | Q(product_sku__icontains="total")
        | Q(product_sku__icontains="المجموع")
    )
    CANONICAL_SALES_FIELD = "total_sales"

_PRODUCT_SALE_EXCLUDE = PRODUCT_SALE_EXCLUDE_SUMMARY

# حدود التحقق: تكلفة وحدة لا تتجاوز 100,000 ر.س (تجنب أرقام الهواتف/أكواد خاطئة)
MAX_REASONABLE_UNIT_COST = Decimal("100000")
# إذا تجاوز مصروف عنصر 50% من إجمالي المبيعات → عزل ومراجعة يدوية
SMART_FILTER_THRESHOLD = Decimal("0.5")


def _sanitize_unit_cost(value: Decimal | None) -> tuple[Decimal, bool]:
    """
    التحقق من تكلفة الوحدة: استبعاد أرقام الهواتف، أرقام تعريف طويلة، آيبان، وقيم غير منطقية.
    Returns (sanitized_cost, was_flagged).
    """
    if value is None:
        return Decimal("0"), False
    try:
        uc = Decimal(str(value))
    except Exception:
        return Decimal("0"), True
    if uc < 0:
        return Decimal("0"), True
    # تكلفة وحدة تفوق حد المعقول (هواتف/أكواد/آيبان خاطئة)
    if uc > MAX_REASONABLE_UNIT_COST:
        return Decimal("0"), True
    # أرقام تشبه الهاتف السعودي: 10-12 رقم تبدأ بـ 05 أو 9665
    s = str(int(uc)) if uc == int(uc) else ""
    if len(s) >= 9 and len(s) <= 12 and re.match(r"^(0?5|9665)\d+$", s):
        return Decimal("0"), True
    # أرقام تعريف طويلة (ID) أو شبيهة بآيبان: 7+ أرقام = مليون فما فوق (غير منطقي لتكلفة وحدة)
    if uc == int(uc) and len(s) >= 7:
        return Decimal("0"), True
    return uc, False


def get_profit_summary(
    branch_ids: list[int] | None,
    date_from: date,
    date_to: date,
    *,
    brand_ids: list[int] | None = None,
) -> dict[str, Any]:
    """
    Calculate Total Sales, COGS, and Gross Profit for date range.
    Sales from ProductSale.total_sales. COGS from exploded recipes × Ingredient.unit_cost.
    """
    total_revenue = Decimal("0")
    total_cogs = Decimal("0")

    if ProductSale is None:
        return {
            "total_sales": "0",
            "total_cogs": "0",
            "gross_profit": "0",
            "ingredients_with_cost": [],
            "flagged_for_review": [],
            "error": "ProductSale not available",
        }

    qs = ProductSale.objects.filter(
        date__gte=date_from,
        date__lte=date_to,
    ).exclude(_PRODUCT_SALE_EXCLUDE)

    if branch_ids:
        qs = qs.filter(branch_id__in=branch_ids)
    elif brand_ids:
        qs = qs.filter(brand_id__in=brand_ids)
    else:
        qs = ProductSale.objects.none()

    # Total revenue – مصدر موحد: ProductSale.total_sales (توحيد التقارير)
    rev_agg = qs.aggregate(s=Sum(CANONICAL_SALES_FIELD))
    total_revenue = Decimal(str(rev_agg["s"] or 0))

    # Build expected_sales: sku -> sum(qty)
    from collections import defaultdict
    sku_to_qty: dict[str, int] = defaultdict(int)
    for row in qs.values("product_sku", "qty"):
        sku = (row.get("product_sku") or "").strip()
        if not sku:
            continue
        try:
            qty = int(float(row.get("qty") or 0))
        except (TypeError, ValueError):
            qty = 0
        if qty > 0:
            sku_to_qty[sku] += qty

    # Explode to ingredients
    requirements = explode_recipe_requirements(dict(sku_to_qty))

    # COGS = sum(ingredient_qty * sanitized_unit_cost) – استبعاد القيم المشبوهة
    ingredients_with_cost = []
    flagged_for_review: list[dict[str, Any]] = []
    validated_cogs = Decimal("0")

    for r in requirements:
        ing = Ingredient.objects.filter(id=r.ingredient_id).first()
        raw_cost = (ing.unit_cost or Decimal("0")) if ing else Decimal("0")
        unit_cost, unit_flagged = _sanitize_unit_cost(raw_cost if ing else None)
        cost = r.qty * unit_cost

        # الفلتر الذكي: مصروف يتجاوز 50% من المبيعات → عزل ومراجعة SAIF
        excluded = False
        if total_revenue > 0 and cost > total_revenue * SMART_FILTER_THRESHOLD:
            excluded = True
            flagged_for_review.append({
                "ingredient_id": r.ingredient_id,
                "ingredient_name": r.ingredient_name,
                "serial_code": r.serial_code or "",
                "qty": str(r.qty),
                "unit_cost": str(raw_cost),
                "cost": str(cost),
                "reason": "exceeds_sales_threshold",
            })
        if unit_flagged and (ing and ing.unit_cost):
            flagged_for_review.append({
                "ingredient_id": r.ingredient_id,
                "ingredient_name": r.ingredient_name,
                "serial_code": r.serial_code or "",
                "qty": str(r.qty),
                "unit_cost": str(raw_cost),
                "cost": str(cost),
                "reason": "invalid_unit_cost",
            })

        if not excluded:
            validated_cogs += cost

        ingredients_with_cost.append({
            "ingredient_id": r.ingredient_id,
            "ingredient_name": r.ingredient_name,
            "serial_code": r.serial_code or "",
            "qty": str(r.qty),
            "unit_cost": str(unit_cost),
            "cost": str(cost),
            "excluded": excluded,
        })

    gross_profit = total_revenue - validated_cogs

    return {
        "total_sales": str(total_revenue),
        "total_cogs": str(validated_cogs),
        "gross_profit": str(gross_profit),
        "ingredients_with_cost": ingredients_with_cost,
        "flagged_for_review": flagged_for_review,
    }
