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
from inventory.models import BranchStock, Ingredient, IngredientPackage
from inventory.services import explode_recipe_requirements


def _fmt_qty(value: Decimal) -> str:
    rounded = value.quantize(Decimal("0.0001"))
    return format(rounded, "f").rstrip("0").rstrip(".") or "0"


def _get_default_package(ing: Ingredient):
    """
    Returns the best default IngredientPackage to display for this ingredient.
    Priority:
      1. New multi-package system: package with is_default=True and is_active=True
      2. New multi-package system: first active package (fallback)
      3. Legacy single-package fields (package_name_en/ar + conversion_factor)
    Returns None if default_display_unit != "package" or no valid package found.
    """
    if getattr(ing, "default_display_unit", "base") != "package":
        return None

    # ── New multi-package system ───────────────────────────────
    # packages are prefetched via select_related / prefetch_related
    try:
        pkgs = list(ing.packages.filter(is_active=True).order_by("-is_default", "sort_order", "id"))
    except Exception:
        pkgs = []

    if pkgs:
        # prefer the one marked is_default
        for p in pkgs:
            if p.is_default:
                return p
        return pkgs[0]  # fallback to first active

    # ── Legacy single-package fields ──────────────────────────
    if (
        getattr(ing, "package_is_active", True)
        and bool(ing.package_conversion_factor and ing.package_conversion_factor > 0)
        and bool((ing.package_name_en or "").strip() or (ing.package_name_ar or "").strip())
    ):
        # Return a lightweight namespace so callers can treat it uniformly
        class _LegacyPkg:
            name_en = ing.package_name_en or ""
            name_ar = ing.package_name_ar or ""
            conversion_factor = ing.package_conversion_factor
        return _LegacyPkg()

    return None


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

    ingredients_by_id = {
        ing.id: ing
        for ing in Ingredient.objects.filter(pk__in=ingredient_ids)
            .select_related("base_unit")
            .prefetch_related("packages")   # load multi-package data
    }

    # 5. حساب الاقتراح (base qty + preferred display qty حسب default_display_unit)
    buffer_factor = 1 + (safety_buffer_days / max(1, horizon_days))
    out = []
    for r in requirements:
        ing = ingredients_by_id.get(r.ingredient_id)
        if not ing:
            continue
        stock = stock_map.get(r.ingredient_id)
        on_hand = stock.on_hand if stock else Decimal("0")
        required = r.qty * Decimal(str(buffer_factor))
        suggested = max(Decimal("0"), required - on_hand)
        if suggested <= 0:
            continue

        base_unit_code = ing.base_unit.code if ing.base_unit else "pcs"
        base_unit_label = (ing.base_unit.name_en if ing.base_unit else "") or base_unit_code
        base_unit_label_ar = (ing.base_unit.name_ar if ing.base_unit else "") or base_unit_label

        # ── Resolve default package (new or legacy) ────────────
        default_pkg = _get_default_package(ing)
        use_package = default_pkg is not None

        conversion_factor = Decimal(str(default_pkg.conversion_factor)) if use_package else Decimal("1")
        required_display  = required  / conversion_factor
        on_hand_display   = on_hand   / conversion_factor
        suggested_display = suggested / conversion_factor

        if use_package:
            display_unit_code    = (default_pkg.name_en or default_pkg.name_ar or "package").strip() or "package"
            display_unit_label   = (default_pkg.name_en or default_pkg.name_ar or "Package").strip() or "Package"
            display_unit_label_ar = (default_pkg.name_ar or default_pkg.name_en or "عبوة").strip() or "عبوة"
        else:
            display_unit_code    = base_unit_code
            display_unit_label   = base_unit_label
            display_unit_label_ar = base_unit_label_ar

        effective_display_unit = "package" if use_package else "base"

        out.append({
            "ingredient_id": r.ingredient_id,
            "ingredient_name": r.ingredient_name,
            "ingredient_name_ar": r.ingredient_name_ar or "",
            "serial_code": r.serial_code or "",
            # Main display keys
            "unit_code": display_unit_code,
            "required_qty": _fmt_qty(required_display),
            "on_hand": _fmt_qty(on_hand_display),
            "suggested_purchase_qty": _fmt_qty(suggested_display),
            "horizon_days": horizon_days,
            # Base quantities for auditing / math verification
            "base_unit_code": base_unit_code,
            "base_unit_label": base_unit_label,
            "required_base_qty": _fmt_qty(required),
            "on_hand_base_qty": _fmt_qty(on_hand),
            "suggested_purchase_base_qty": _fmt_qty(suggested),
            # Display metadata
            "display_unit_source": effective_display_unit,
            "default_display_unit": getattr(ing, "default_display_unit", "base"),
            "display_unit_code": display_unit_code,
            "display_unit_label": display_unit_label,
            "display_unit_label_ar": display_unit_label_ar,
            "package_conversion_factor": (
                _fmt_qty(Decimal(str(default_pkg.conversion_factor)))
                if use_package
                else None
            ),
        })
    out.sort(key=lambda x: (-float(x["suggested_purchase_base_qty"]), x["ingredient_name"]))
    return out
