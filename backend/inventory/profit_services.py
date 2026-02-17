"""Profit and COGS calculation services."""
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


from django.db.models import Q

_PRODUCT_SALE_EXCLUDE = (
    Q(product_name__icontains="total")
    | Q(product_name__icontains="المجموع")
    | Q(product_sku__icontains="total")
    | Q(product_sku__icontains="المجموع")
)


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

    # Total revenue
    rev_agg = qs.aggregate(s=Sum("total_sales"))
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

    # COGS = sum(ingredient_qty * unit_cost)
    ingredients_with_cost = []
    for r in requirements:
        ing = Ingredient.objects.filter(id=r.ingredient_id).first()
        unit_cost = (ing.unit_cost or Decimal("0")) if ing else Decimal("0")
        cost = r.qty * unit_cost
        total_cogs += cost
        ingredients_with_cost.append({
            "ingredient_id": r.ingredient_id,
            "ingredient_name": r.ingredient_name,
            "serial_code": r.serial_code or "",
            "qty": str(r.qty),
            "unit_cost": str(unit_cost),
            "cost": str(cost),
        })

    gross_profit = total_revenue - total_cogs

    return {
        "total_sales": str(total_revenue),
        "total_cogs": str(total_cogs),
        "gross_profit": str(gross_profit),
        "ingredients_with_cost": ingredients_with_cost,
    }
