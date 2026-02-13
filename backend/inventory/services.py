from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from inventory.models import BranchStock, FoodicsProduct, RecipeLine


@dataclass(frozen=True)
class IngredientRequirement:
    ingredient_id: int
    ingredient_name: str
    qty: Decimal
    unit_code: str


def explode_recipe_requirements(expected_sales: dict[str, int]) -> list[IngredientRequirement]:
    """
    Given expected sales as a mapping of Foodics product_id -> expected count,
    return an aggregated list of raw material requirements.

    Notes:
    - Assumes 1 "sale unit" corresponds to the recipe yield unit (default yield=1).
    - Modifiers can be added later by extending FoodicsProduct + recipe mapping.
    """
    if not expected_sales:
        return []

    products = {
        p.foodics_product_id: p
        for p in FoodicsProduct.objects.filter(foodics_product_id__in=expected_sales.keys()).select_related("recipe")
    }

    # Aggregate by ingredient + unit
    agg: dict[tuple[int, str], Decimal] = defaultdict(lambda: Decimal("0"))
    meta: dict[tuple[int, str], tuple[str, str]] = {}

    for foodics_product_id, count in expected_sales.items():
        if count <= 0:
            continue
        product = products.get(foodics_product_id)
        if not product or not hasattr(product, "recipe"):
            continue

        lines = (
            RecipeLine.objects.filter(recipe=product.recipe)
            .select_related("ingredient", "unit")
            .all()
        )
        for line in lines:
            key = (line.ingredient_id, line.unit.code)
            agg[key] += (line.qty * Decimal(count))
            meta[key] = (line.ingredient.name_en, line.unit.code)

    out: list[IngredientRequirement] = []
    for (ingredient_id, unit_code), qty in agg.items():
        ingredient_name, unit_code = meta[(ingredient_id, unit_code)]
        out.append(
            IngredientRequirement(
                ingredient_id=ingredient_id,
                ingredient_name=ingredient_name,
                qty=qty,
                unit_code=unit_code,
            )
        )
    out.sort(key=lambda r: (r.ingredient_name, r.unit_code))
    return out


def production_plan_requirements(
    branch_id: int,
    items: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    What-if production plan: items = [ {"product_name": "Burger", "qty": 50} ] or [ {"product_id": 1, "qty": 50} ].
    Returns aggregated ingredients with required_qty, on_hand, reorder_level for the branch.
    """
    expected_sales: dict[str, int] = {}

    for it in items:
        qty = int(it.get("qty") or 0)
        if qty <= 0:
            continue
        if "product_id" in it and it["product_id"] is not None:
            continue  # handled below via id_to_qty
        name = (it.get("product_name") or "").strip()
        if not name:
            continue
        # Resolve by name (case-insensitive)
        prod = FoodicsProduct.objects.filter(name__iexact=name).select_related("recipe").first()
        if prod and hasattr(prod, "recipe"):
            expected_sales[prod.foodics_product_id] = expected_sales.get(prod.foodics_product_id, 0) + qty

    id_to_qty: dict[int, int] = {}
    for it in items:
        pid = it.get("product_id")
        if pid is None:
            continue
        try:
            pid = int(pid)
            id_to_qty[pid] = id_to_qty.get(pid, 0) + int(it.get("qty") or 0)
        except (TypeError, ValueError):
            continue
    if id_to_qty:
        for p in FoodicsProduct.objects.filter(id__in=id_to_qty).select_related("recipe"):
            if hasattr(p, "recipe"):
                qty = id_to_qty.get(p.id, 0)
                if qty > 0:
                    expected_sales[p.foodics_product_id] = expected_sales.get(p.foodics_product_id, 0) + qty

    requirements = explode_recipe_requirements(expected_sales)
    if not requirements:
        return []

    ingredient_ids = [r.ingredient_id for r in requirements]
    stock_by_ingredient = {
        s.ingredient_id: {"on_hand": s.on_hand, "reorder_level": s.reorder_level}
        for s in BranchStock.objects.filter(branch_id=branch_id, ingredient_id__in=ingredient_ids)
    }

    out = []
    for r in requirements:
        st = stock_by_ingredient.get(r.ingredient_id, {})
        on_hand = st.get("on_hand") or Decimal("0")
        reorder = st.get("reorder_level") or Decimal("0")
        out.append({
            "ingredient_id": r.ingredient_id,
            "ingredient_name": r.ingredient_name,
            "unit_code": r.unit_code,
            "required_qty": str(r.qty),
            "on_hand": str(on_hand),
            "reorder_level": str(reorder),
        })
    return out

