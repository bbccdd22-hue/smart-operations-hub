"""
التنبؤ الذكي للشراء – اقتراح كميات الشراء بناءً على استهلاك الكاشير.
يستخدم: تنبؤ المبيعات (DailySale/ProductSale) → تفكيك الوصفات → مقارنة بالرصيد.
"""
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from django.db.models import Sum
from django.db.models import Q

from imports.models import ProductSale
from inventory.models import BranchStock, Ingredient
from inventory.services import explode_recipe_requirements


def get_purchase_suggestions(
    branch_id: int,
    brand_id: int | None = None,
    horizon_days: int = 7,
    lookback_days: int = 90,
    safety_buffer_days: float = 3.0,
) -> list[dict[str, Any]]:
    """
    اقتراح كميات الشراء لكل مكوّن:
    - تنبؤ مبيعات المنتجات للأيام horizon_days القادمة (من ProductSale التاريخي + forecasting)
    - تفكيك الوصفات للحصول على المكوّنات المطلوبة
    - مقارنة بالرصيد الحالي → الاقتراح = المطلوب - الرصيد + buffer
    """
    today = date.today()
    sku_to_qty: dict[str, Decimal] = {}

    # 1. تجميع استهلاك تاريخي من ProductSale (أخر lookback_days)
    min_date = today - timedelta(days=lookback_days)
    historical = (
        ProductSale.objects.filter(
            branch_id=branch_id,
            date__gte=min_date,
            date__lte=today,
        )
        .exclude(
            Q(product_name__icontains="total")
            | Q(product_name__icontains="المجموع")
            | Q(product_sku__icontains="total")
        )
        .values("product_sku")
        .annotate(total_qty=Sum("qty"))
    )

    # متوسط يومي لكل SKU
    days_span = max(1, (today - min_date).days)
    for r in historical:
        sku = (r.get("product_sku") or "").strip()
        if not sku:
            continue
        total = float(r.get("total_qty") or 0)
        avg_per_day = total / days_span
        # تطبيق على horizon
        sku_to_qty[sku] = Decimal(str(round(avg_per_day * horizon_days, 2)))

    # 2. إذا وُجد تنبؤ يومي (predict_sales_for_date) يمكن استخدامه لدقة أعلى
    # حالياً نعتمد على المتوسط التاريخي للمنتجات
    # تحويل sku_to_qty من Decimal إلى int لأن explode_recipe_requirements تتوقع int
    expected_sales = {k: int(v) for k, v in sku_to_qty.items() if v > 0}

    if not expected_sales:
        return []

    # 3. تفكيك الوصفات
    requirements = explode_recipe_requirements(expected_sales)
    if not requirements:
        return []

    # 4. الرصيد الحالي
    ingredient_ids = [r.ingredient_id for r in requirements]
    stock_map = {
        s.ingredient_id: s
        for s in BranchStock.objects.filter(
            branch_id=branch_id, ingredient_id__in=ingredient_ids
        )
    }

    # 5. حساب الاقتراح
    buffer_factor = 1 + (safety_buffer_days / max(1, horizon_days))
    out = []
    for r in requirements:
        stock = stock_map.get(r.ingredient_id)
        on_hand = stock.on_hand if stock else Decimal("0")
        required = r.qty * Decimal(str(buffer_factor))
        suggested = max(Decimal("0"), required - on_hand)
        if suggested <= 0:
            continue
        ing = Ingredient.objects.filter(pk=r.ingredient_id).select_related("base_unit").first()
        if not ing:
            continue
        unit_code = ing.base_unit.code if ing.base_unit else "pcs"
        out.append({
            "ingredient_id": r.ingredient_id,
            "ingredient_name": r.ingredient_name,
            "ingredient_name_ar": r.ingredient_name_ar or "",
            "serial_code": r.serial_code or "",
            "unit_code": unit_code,
            "required_qty": str(round(r.qty, 4)),
            "on_hand": str(on_hand),
            "suggested_purchase_qty": str(round(suggested, 4)),
            "horizon_days": horizon_days,
        })
    out.sort(key=lambda x: (-float(x["suggested_purchase_qty"]), x["ingredient_name"]))
    return out
