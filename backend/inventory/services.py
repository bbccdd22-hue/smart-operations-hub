from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from django.db.models import Q

from config.constants import PREP_LIST_SALES_SOURCE, PREP_LIST_UNITS_SOURCE
from inventory.models import BranchStock, FoodicsProduct, Recipe, RecipeLine, Unit


@dataclass(frozen=True)
class IngredientRequirement:
    ingredient_id: int
    ingredient_name: str
    ingredient_name_ar: str
    serial_code: str
    qty: Decimal
    unit_code: str
    display_qty: Decimal | None = None
    display_unit_code: str | None = None
    display_unit_label: str | None = None
    workable_display_ar: str | None = None
    workable_display_en: str | None = None
    workable_qty: str | None = None
    workable_unit_ar: str | None = None
    workable_unit_en: str | None = None
    """Exact required qty in base unit for display (e.g. 1080g)"""
    exact_required: str | None = None
    exact_unit_label: str | None = None


def _round_workable(val: Decimal) -> str:
    """Round UP to whole number. 3.1 -> 4, 3.428 -> 4. No decimals."""
    v = float(val)
    return str(math.ceil(v) if v > 0 else 0)


def _format_exact_qty(val: Decimal) -> str:
    """Format exact quantity: whole numbers as int, else up to 2 decimals."""
    v = float(val)
    if v == int(v):
        return str(int(v))
    return f"{v:.2f}".rstrip("0").rstrip(".")


def calculate_workable_units(
    total_base_qty: Decimal,
    conversion_factor: Decimal,
    package_unit_ar: str,
    package_unit_en: str,
    base_unit_ar: str = "وحدة",
    base_unit_en: str = "units",
) -> dict[str, str]:
    """
    PR1002: Convert raw base quantity to workable units (كرتون، علبة، إلخ).
    Returns bilingual display: full packages + remainder in base units.
    Quantities rounded to whole or max 1 decimal.
    """
    if conversion_factor <= 0:
        q = _round_workable(total_base_qty)
        return {
            "display_ar": f"{q} {base_unit_ar}",
            "display_en": f"{q} {base_unit_en}",
        }
    full = total_base_qty / conversion_factor
    full_packages = int(total_base_qty // conversion_factor)
    remaining_qty = total_base_qty % conversion_factor
    qty_str = _round_workable(full) if remaining_qty == 0 else str(full_packages)
    rem_str = _round_workable(remaining_qty)

    if remaining_qty == 0:
        return {
            "display_ar": f"{qty_str} {package_unit_ar}",
            "display_en": f"{qty_str} {package_unit_en}",
        }
    return {
        "display_ar": f"{qty_str} {package_unit_ar} و {rem_str} {base_unit_ar}",
        "display_en": f"{qty_str} {package_unit_en} and {rem_str} {base_unit_en}",
    }


def _to_base_qty(unit: Unit, qty: Decimal, target_base_unit: Unit) -> Decimal:
    """Convert qty in unit to target_base_unit. E.g. 1 L -> 1000 ML."""
    if unit.id == target_base_unit.id:
        return qty
    if unit.base_unit_id == target_base_unit.id:
        return qty * (unit.factor_to_base or Decimal("1"))
    return qty


def _to_display_unit(base_qty: Decimal, base_unit: Unit) -> tuple[Decimal, str, str]:
    """
    Convert base qty to best display unit (e.g. 10000 ML -> 10 L, or 5600 ML -> 2 Bottles (2.8L)).
    Prefers largest unit where result >= 0.01.
    Returns (display_qty, display_unit_code, display_unit_label) - label from Unit.name_en.
    """
    if base_qty <= 0:
        return base_qty, base_unit.code, base_unit.name_en or base_unit.code
    derived = list(
        Unit.objects.filter(base_unit_id=base_unit.id).order_by("-factor_to_base")
    )
    candidates = derived + [base_unit]
    for u in candidates:
        factor = u.factor_to_base if (u.base_unit_id or u.id == base_unit.id) else Decimal("1")
        if factor <= 0:
            continue
        converted = base_qty / factor
        if converted >= Decimal("0.01"):
            label = u.name_en or u.code
            return converted, u.code, label
    return base_qty, base_unit.code, base_unit.name_en or base_unit.code


def explode_recipe_requirements(expected_sales: dict[str, int]) -> list[IngredientRequirement]:
    """
    Given expected sales as a mapping of Foodics product SKU -> expected count,
    return an aggregated list of raw material requirements.
    Sums (Ingredient Qty * Forecasted Product Qty) for all products, aggregated by ingredient.
    SKU lookup is case-insensitive to match 'sku-0108', 'SKU-0108', etc.
    """
    if not expected_sales:
        return []

    sku_keys = [k.strip() for k in expected_sales.keys() if k and str(k).strip()]
    # Case-insensitive match via foodics_product_id__iexact (product SKU)
    products_by_lower: dict[str, FoodicsProduct] = {}
    if sku_keys:
        q_filters = Q()
        for sk in sku_keys:
            if sk:
                q_filters |= Q(foodics_product_id__iexact=sk)
        for p in FoodicsProduct.objects.filter(recipe__isnull=False).filter(q_filters).select_related("recipe"):
            p_sku = (p.foodics_product_id or "").strip()
            p_key = p_sku.lower()
            products_by_lower[p_key] = p

    agg: dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
    meta: dict[int, tuple[str, Unit]] = {}

    for foodics_product_id, count in expected_sales.items():
        if count <= 0:
            continue
        key = (foodics_product_id or "").strip().lower()
        product = products_by_lower.get(key)
        if not product:
            continue
        recipe = Recipe.objects.filter(product=product).select_related("yield_unit").first()
        if not recipe:
            continue

        # Per-product qty: line.qty is per recipe batch, yield_qty = servings per batch
        yield_qty = recipe.yield_qty if recipe.yield_qty and recipe.yield_qty > 0 else Decimal("1")

        lines = (
            RecipeLine.objects.filter(recipe=recipe)
            .select_related("ingredient", "ingredient__base_unit", "unit")
            .all()
        )
        for line in lines:
            ing = line.ingredient
            base_unit = ing.base_unit
            # CRITICAL: (Ingredient Qty per Product) × (Forecasted Qty) = total required
            qty_per_product = line.qty / yield_qty
            total_for_product = qty_per_product * Decimal(count)
            base_qty = _to_base_qty(line.unit, total_for_product, base_unit)
            agg[line.ingredient_id] += base_qty
            meta[line.ingredient_id] = (
                ing.name_en,
                ing.name_ar or "",
                ing.serial_code or "",
                base_unit,
                ing,
            )

    out: list[IngredientRequirement] = []
    for ingredient_id, base_qty in agg.items():
        ingredient_name, ingredient_name_ar, serial_code, base_unit, ing = meta[ingredient_id]
        display_qty, display_code, display_label = _to_display_unit(base_qty, base_unit)
        workable_ar = workable_en = workable_qty = workable_unit_ar = workable_unit_en = None
        if (
            ing.package_conversion_factor
            and ing.package_conversion_factor > 0
            and (ing.package_name_en or ing.package_name_ar)
        ):
            pkg_ar = ing.package_name_ar or ing.package_name_en or "علبة"
            pkg_en = ing.package_name_en or ing.package_name_ar or "package"
            base_ar = (base_unit.name_ar or base_unit.name_en or "").strip() or "وحدة"
            base_en = (base_unit.name_en or base_unit.name_ar or "").strip() or "units"
            workable = calculate_workable_units(
                base_qty,
                ing.package_conversion_factor,
                pkg_ar,
                pkg_en,
                base_unit_ar=base_ar,
                base_unit_en=base_en,
            )
            workable_ar = workable["display_ar"]
            workable_en = workable["display_en"]
            # Packages needed = ceil(Total Qty / Package Size)
            full = base_qty / ing.package_conversion_factor
            workable_qty = _round_workable(full)
            # Package size label for "1 Box (1500g)" format
            size_qty, size_code, size_label = _to_display_unit(
                ing.package_conversion_factor, base_unit
            )
            size_str = _round_workable(size_qty)
            workable_unit_ar = f"{pkg_ar} ({size_str} {base_ar})".strip()
            workable_unit_en = f"{pkg_en} ({size_str} {base_en})".strip()
        wk_qty = workable_qty or _round_workable(display_qty)
        # Prefer explicit labels when set (e.g. "علبة (2.8 لتر)")
        if ing.workable_unit_label_ar:
            wk_unit_ar = ing.workable_unit_label_ar
            wk_unit_en = ing.workable_unit_label_en or workable_unit_en or (display_label or display_code)
        else:
            wk_unit_ar = workable_unit_ar or (base_unit.name_ar or base_unit.name_en or display_code)
            wk_unit_en = workable_unit_en or (display_label or display_code)
        exact_label = base_unit.name_en or base_unit.name_ar or base_unit.code
        out.append(
            IngredientRequirement(
                ingredient_id=ingredient_id,
                ingredient_name=ingredient_name,
                ingredient_name_ar=ingredient_name_ar,
                serial_code=serial_code,
                qty=base_qty,
                unit_code=base_unit.code,
                display_qty=display_qty,
                display_unit_code=display_code,
                display_unit_label=display_label,
                workable_display_ar=workable_ar,
                workable_display_en=workable_en,
                workable_qty=wk_qty,
                workable_unit_ar=wk_unit_ar,
                workable_unit_en=wk_unit_en,
                exact_required=_format_exact_qty(base_qty),
                exact_unit_label=exact_label,
            )
        )
    out.sort(key=lambda r: (r.ingredient_name, r.unit_code))
    return out


def production_plan_requirements(
    branch_id: int,
    items: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Prep List (PR1002): Explode BOM into ingredient requirements.
    Sales data source: SP1003 (ProductSale). Units source: IU1002 (Unit).
    What-if production plan: items = [ {"product_name": "Burger", "qty": 50} ] or [ {"product_id": 1, "qty": 50} ].
    Returns (ingredients, products_without_recipe) - aggregated ingredients and products that have no recipe linked.
    """
    _ = PREP_LIST_SALES_SOURCE, PREP_LIST_UNITS_SOURCE  # Explicit dependency for PR1002 data sources
    expected_sales: dict[str, int] = {}
    products_without_recipe: list[dict[str, Any]] = []

    def _add_no_recipe(product_name: str, product_sku: str, qty: int) -> None:
        products_without_recipe.append({
            "product_name": product_name or product_sku or "—",
            "product_sku": product_sku or "",
            "qty": qty,
        })

    for it in items:
        qty = int(it.get("qty") or 0)
        if qty <= 0:
            continue
        if "product_id" in it and it["product_id"] is not None:
            continue
        name = (it.get("product_name") or "").strip()
        if not name:
            continue
        prod = FoodicsProduct.objects.filter(name__iexact=name).first()
        if prod and Recipe.objects.filter(product=prod).exists():
            sku = (prod.foodics_product_id or "").strip()
            expected_sales[sku] = expected_sales.get(sku, 0) + qty
        elif prod:
            _add_no_recipe(prod.name, (prod.foodics_product_id or "").strip(), qty)
        else:
            _add_no_recipe(name, "", qty)

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
        for p in FoodicsProduct.objects.filter(id__in=id_to_qty):
            qty = id_to_qty.get(p.id, 0)
            if qty <= 0:
                continue
            if Recipe.objects.filter(product=p).exists():
                sku = (p.foodics_product_id or "").strip()
                expected_sales[sku] = expected_sales.get(sku, 0) + qty
            else:
                _add_no_recipe(p.name, (p.foodics_product_id or "").strip(), qty)

    sku_to_qty: dict[str, int] = {}
    for it in items:
        if it.get("product_id") is not None and it.get("product_id") != "":
            continue
        sku = (it.get("product_sku") or "").strip()
        if not sku:
            continue
        qty = int(it.get("qty") or 0)
        if qty <= 0:
            continue
        sku_to_qty[sku] = sku_to_qty.get(sku, 0) + qty
    if sku_to_qty:
        sku_list = [s.strip() for s in sku_to_qty.keys() if s]
        q_sku = Q()
        for sk in sku_list:
            if sk:
                q_sku |= Q(foodics_product_id__iexact=sk)
        all_products = list(FoodicsProduct.objects.filter(q_sku))
        has_recipe = {p.id for p in FoodicsProduct.objects.filter(recipe__isnull=False).filter(q_sku)}
        by_key: dict[str, FoodicsProduct] = {}
        for p in all_products:
            k = ((p.foodics_product_id or "").strip() or "").lower()
            if k:
                by_key[k] = p
        for req_sku, qty in sku_to_qty.items():
            if qty <= 0:
                continue
            key = req_sku.strip().lower()
            p = by_key.get(key)
            if p and p.id in has_recipe:
                out_sku = (p.foodics_product_id or "").strip()
                expected_sales[out_sku] = expected_sales.get(out_sku, 0) + qty
            elif p:
                _add_no_recipe(p.name, (p.foodics_product_id or "").strip(), qty)
            else:
                _add_no_recipe(req_sku, req_sku, qty)

    requirements = explode_recipe_requirements(expected_sales)

    if not requirements:
        return [], products_without_recipe

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
        item = {
            "ingredient_id": r.ingredient_id,
            "ingredient_name": r.ingredient_name,
            "ingredient_name_ar": r.ingredient_name_ar or "",
            "serial_code": r.serial_code or "",
            "unit_code": r.unit_code,
            "required_qty": str(r.qty),
            "on_hand": str(on_hand),
            "reorder_level": str(reorder),
        }
        if r.display_qty is not None and r.display_unit_code:
            item["display_qty"] = _round_workable(r.display_qty)
            item["display_unit_code"] = r.display_unit_code
            item["display_unit_label"] = r.display_unit_label or r.display_unit_code
        if r.workable_display_ar:
            item["workable_display_ar"] = r.workable_display_ar
        if r.workable_display_en:
            item["workable_display_en"] = r.workable_display_en
        if r.workable_qty:
            item["workable_qty"] = r.workable_qty
        if r.workable_unit_ar:
            item["workable_unit_ar"] = r.workable_unit_ar
        if r.workable_unit_en:
            item["workable_unit_en"] = r.workable_unit_en
        if r.exact_required:
            item["exact_required"] = r.exact_required
        if r.exact_unit_label:
            item["exact_unit_label"] = r.exact_unit_label
        out.append(item)
    return out, products_without_recipe

