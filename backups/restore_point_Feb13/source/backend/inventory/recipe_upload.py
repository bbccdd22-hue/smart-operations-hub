"""
Bulk Excel upload for recipes (Product -> Ingredient mappings).
Template columns: Product | Ingredient | Qty | Unit (e.g. g, kg, pcs, ml, l)
"""
from __future__ import annotations

from decimal import Decimal

import pandas as pd

from inventory.models import FoodicsProduct, Ingredient, Recipe, RecipeLine, Unit


def _get_col(df: pd.DataFrame, options: list[str], required: bool = True):
    for name in options:
        if name in df.columns:
            return df[name]
    if required:
        raise ValueError(f"Missing column. Tried: {', '.join(options)}")
    return None


def parse_recipe_excel(file) -> dict:
    """
    Parse Excel: Product, Ingredient, Qty, Unit.
    Creates/updates FoodicsProduct, Ingredient, Unit, Recipe, RecipeLine.
    """
    df = pd.read_excel(file)
    prod_col = _get_col(df, ["Product", "Product Name", "المنتج"])
    ing_col = _get_col(df, ["Ingredient", "Raw Material", "المكون"])
    qty_col = _get_col(df, ["Qty", "Quantity", "الكمية"])
    unit_col = _get_col(df, ["Unit", "Unit Code", "الوحدة"])

    created_products = 0
    created_ingredients = 0
    created_lines = 0
    errors = []

    for idx in range(len(df)):
        try:
            pname = str(prod_col.iloc[idx]).strip()
            iname = str(ing_col.iloc[idx]).strip()
            qty_val = float(qty_col.iloc[idx] or 0)
            ucode = str(unit_col.iloc[idx]).strip().lower() or "pcs"
            if not pname or not iname or qty_val <= 0:
                continue
            unit, _ = Unit.objects.get_or_create(
                code=ucode[:16],
                defaults={"name_en": ucode, "name_ar": ""},
            )
            slug = f"bulk-{pname.lower().replace(' ', '-')[:50]}"
            product, p_created = FoodicsProduct.objects.get_or_create(
                foodics_product_id=slug,
                defaults={"name": pname, "is_active": True},
            )
            if p_created:
                created_products += 1
            ingredient, i_created = Ingredient.objects.get_or_create(
                name_en=iname,
                defaults={"base_unit": unit, "is_active": True},
            )
            if i_created:
                created_ingredients += 1
            recipe, _ = Recipe.objects.get_or_create(
                product=product,
                defaults={"yield_qty": Decimal("1"), "yield_unit": unit},
            )
            _, rl_created = RecipeLine.objects.update_or_create(
                recipe=recipe,
                ingredient=ingredient,
                defaults={"qty": Decimal(str(qty_val)), "unit": unit},
            )
            if rl_created:
                created_lines += 1
        except Exception as e:  # noqa: BLE001
            errors.append({"row": idx + 2, "error": str(e)[:200]})

    return {
        "created_products": created_products,
        "created_ingredients": created_ingredients,
        "created_lines": created_lines,
        "errors": errors[:50],
    }
