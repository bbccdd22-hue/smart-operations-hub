"""
Cafe Heartbeat Dashboard – Live burn rate, sales mix, basket analysis, waste monitor.
"""
from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from django.db.models import Q

from inventory.models import Ingredient, WasteLog
from inventory.services import explode_recipe_requirements

try:
    from imports.models import ProductSale
except ImportError:
    ProductSale = None

_COLD_KEYWORDS = ("آيس", "ice", "iced", "cold", "بارد", "باد", "مثلج", "فريم")


def _is_cold(name: str) -> bool:
    n = (name or "").lower()
    for kw in _COLD_KEYWORDS:
        if kw.lower() in n:
            return True
    return False


def _progress_through_day() -> float:
    """Assume operating hours 6am-10pm (16h). Return 0-1 for current progress."""
    now = datetime.now()
    start = now.replace(hour=6, minute=0, second=0, microsecond=0)
    end = now.replace(hour=22, minute=0, second=0, microsecond=0)
    if now < start:
        return 0.0
    if now > end:
        return 1.0
    elapsed = (now - start).total_seconds()
    total = (end - start).total_seconds()
    return min(1.0, elapsed / total) if total else 0


def get_heartbeat_data(
    branch_ids: list[int] | None,
    dt: date | None = None,
) -> dict[str, Any]:
    if ProductSale is None:
        return _empty_heartbeat("ProductSale not available")

    dt = dt or date.today()
    progress = _progress_through_day()

    qs = ProductSale.objects.filter(date=dt).exclude(
        Q(product_name__icontains="total")
        | Q(product_name__icontains="المجموع")
        | Q(product_sku__icontains="total")
        | Q(product_sku__icontains="المجموع")
    )
    if branch_ids:
        qs = qs.filter(branch_id__in=branch_ids)

    sku_to_qty = defaultdict(int)
    sku_to_sales = defaultdict(lambda: Decimal("0"))
    hot_qty = 0
    cold_qty = 0
    food_revenue = Decimal("0")
    total_revenue = Decimal("0")

    from inventory.models import RecipeLine
    food_sku_ids = set()
    for sku in RecipeLine.objects.filter(
        ingredient__serial_code="RM-020"
    ).values_list("recipe__product__foodics_product_id", flat=True):
        if sku:
            food_sku_ids.add(str(sku).lower())

    for row in qs.values("product_sku", "product_name", "qty", "total_sales"):
        sku = (row.get("product_sku") or "").strip()
        if not sku:
            continue
        qty = int(float(row.get("qty") or 0))
        sales = Decimal(str(row.get("total_sales") or 0))
        sku_to_qty[sku] += qty
        sku_to_sales[sku] += sales
        total_revenue += sales
        if sku.lower() in food_sku_ids:
            food_revenue += sales
        name = ""
        if isinstance(row, dict):
            name = row.get("product_name", "") or ""
        if _is_cold(name or sku):
            cold_qty += qty
        else:
            hot_qty += qty

    requirements = explode_recipe_requirements(dict(sku_to_qty))
    milk_ing = Ingredient.objects.filter(serial_code="RM-001").first()
    beans_ing_ids = list(
        Ingredient.objects.filter(serial_code__in=["RM-002", "RM-003"]).values_list("id", flat=True)
    )

    daily_prep = defaultdict(lambda: Decimal("0"))
    for r in requirements:
        daily_prep[r.ingredient_id] += r.qty

    used_milk = Decimal("0")
    used_beans = Decimal("0")
    for r in requirements:
        factor = Decimal(str(progress))
        used = r.qty * factor
        if r.ingredient_id == (milk_ing.id if milk_ing else -1):
            used_milk += used
        if r.ingredient_id in beans_ing_ids:
            used_beans += used

    prep_milk = daily_prep.get(milk_ing.id, Decimal("0")) if milk_ing else Decimal("0")
    prep_beans = sum(daily_prep.get(i, Decimal("0")) for i in beans_ing_ids)

    def _pct(used: Decimal, prep: Decimal) -> float:
        if prep <= 0:
            return 0.0
        return min(100.0, float(used / prep * 100))

    milk_pct = _pct(used_milk, prep_milk)
    beans_pct = _pct(used_beans, prep_beans)

    hot_total = hot_qty + cold_qty
    hot_pct = (hot_qty / hot_total * 100) if hot_total else 50.0
    cold_pct = (cold_qty / hot_total * 100) if hot_total else 50.0

    food_pct = (float(food_revenue / total_revenue * 100)) if total_revenue > 0 else 0.0

    waste_sar = Decimal("0")
    waste_variance_pct = 0.0
    for wl in WasteLog.objects.filter(date=dt).select_related("ingredient"):
        theo = wl.theoretical_usage or Decimal("0")
        actual = wl.actual_usage or Decimal("0")
        if actual > theo:
            over = actual - theo
            cost = (wl.ingredient.unit_cost or Decimal("0")) * over
            waste_sar += cost
        if theo > 0:
            var = float((actual - theo) / theo * 100)
            waste_variance_pct = max(waste_variance_pct, abs(var))

    waste_tolerance_pct = 5.0
    waste_exceeds = waste_variance_pct > waste_tolerance_pct if waste_variance_pct else False

    return {
        "burn_rate": {
            "milk": {
                "used": str(used_milk),
                "daily_prep": str(prep_milk),
                "pct": round(milk_pct, 1),
                "label": "Milk",
            },
            "beans": {
                "used": str(used_beans),
                "daily_prep": str(prep_beans),
                "pct": round(beans_pct, 1),
                "label": "Beans",
            },
        },
        "sales_mix": {
            "hot_pct": round(hot_pct, 1),
            "cold_pct": round(cold_pct, 1),
            "hot_qty": hot_qty,
            "cold_qty": cold_qty,
        },
        "food_to_coffee_ratio": {
            "pct": round(food_pct, 1),
            "food_revenue": str(food_revenue),
            "total_revenue": str(total_revenue),
        },
        "waste_monitor": {
            "theoretical_waste_sar": str(waste_sar),
            "variance_pct": round(waste_variance_pct, 1),
            "exceeds_tolerance": waste_exceeds,
            "tolerance_pct": waste_tolerance_pct,
        },
        "progress_through_day": round(progress * 100, 1),
        "date": dt.isoformat(),
    }


def _empty_heartbeat(error: str) -> dict[str, Any]:
    return {
        "burn_rate": {"milk": {"used": "0", "daily_prep": "0", "pct": 0, "label": "Milk"}, "beans": {"used": "0", "daily_prep": "0", "pct": 0, "label": "Beans"}},
        "sales_mix": {"hot_pct": 50, "cold_pct": 50, "hot_qty": 0, "cold_qty": 0},
        "food_to_coffee_ratio": {"pct": 0, "food_revenue": "0", "total_revenue": "0"},
        "waste_monitor": {"theoretical_waste_sar": "0", "variance_pct": 0, "exceeds_tolerance": False, "tolerance_pct": 5},
        "progress_through_day": 0,
        "date": date.today().isoformat(),
        "error": error,
    }
