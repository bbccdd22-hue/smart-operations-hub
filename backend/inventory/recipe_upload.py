"""
Bulk Excel upload for recipes (Product -> Ingredient mappings).
Template columns: Product | Product SKU | Ingredient | Ingredient Code | Qty | Unit

Product-to-Recipe linking: Match 'Product SKU' from Excel to FoodicsProduct.foodics_product_id
or ProductSale.product_sku. If SKU 'sku-0108' is found, link ingredients to that product (e.g. بودينق الشوكولاته).

Ingredient serial codes: Saved from 'Ingredient Code' / كود المكون column.
"""
from __future__ import annotations

from decimal import Decimal

import pandas as pd

from imports.models import ProductSale
from inventory.models import FoodicsProduct, Ingredient, Recipe, RecipeLine, Unit


def _get_col(df: pd.DataFrame, options: list[str], required: bool = True):
    for name in options:
        if name in df.columns:
            return df[name]
    if required:
        raise ValueError(f"Missing column. Tried: {', '.join(options)}")
    return None


def _resolve_product_by_sku_or_name(sku: str | None, pname: str) -> tuple[FoodicsProduct, bool]:
    """
    Resolve product for BOM: 1) by SKU (FoodicsProduct.foodics_product_id or ProductSale),
    2) fallback by name. Returns (product, created).
    """
    sku_clean = (sku or "").strip() if sku else ""
    if sku_clean:
        prod = FoodicsProduct.objects.filter(foodics_product_id__iexact=sku_clean).first()
        if prod:
            return prod, False
        pn = (
            ProductSale.objects.filter(product_sku__iexact=sku_clean)
            .order_by("-id")
            .values_list("product_name", flat=True)
            .first()
        )
        if pn:
            prod, created = FoodicsProduct.objects.get_or_create(
                foodics_product_id=sku_clean,
                defaults={"name": str(pn)[:255], "is_active": True},
            )
            return prod, created
    pname_clean = (pname or "").strip()
    if not pname_clean:
        raise ValueError("Product name or SKU is required")
    slug = f"bulk-{pname_clean.lower().replace(' ', '-')[:50]}"
    slug = "".join(c for c in slug if c.isalnum() or c == "-") or "bulk-unknown"
    return FoodicsProduct.objects.get_or_create(
        foodics_product_id=slug[:64],
        defaults={"name": pname_clean[:255], "is_active": True},
    )


def parse_recipe_excel(file) -> dict:
    """
    Parse Excel: Product, Product SKU (optional), Ingredient, Ingredient Code (optional), Qty, Unit.
    Product SKU matches FoodicsProduct.foodics_product_id or ProductSale.product_sku.
    Ingredient Code saved as Ingredient.serial_code.
    """
    df = pd.read_excel(file)
    prod_col = _get_col(df, ["Product", "Product Name", "المنتج"])
    sku_col = _get_col(df, ["Product SKU", "SKU", "كود تعريف المنتج", "Product Code"], required=False)
    ing_col = _get_col(df, ["Ingredient", "Raw Material", "المكون"])
    ing_code_col = _get_col(df, ["Ingredient Code", "Serial Code", "كود المكون"], required=False)
    qty_col = _get_col(df, ["Qty", "Quantity", "الكمية"])
    unit_col = _get_col(df, ["Unit", "Unit Code", "الوحدة"])

    created_products = 0
    created_ingredients = 0
    created_lines = 0
    errors = []

    for idx in range(len(df)):
        try:
            pname = str(prod_col.iloc[idx] or "").strip()
            sku_raw = str(sku_col.iloc[idx]).strip() if sku_col is not None else ""
            iname = str(ing_col.iloc[idx] or "").strip()
            ing_code = str(ing_code_col.iloc[idx] or "").strip() if ing_code_col is not None else ""
            qty_val = float(qty_col.iloc[idx] or 0)
            ucode = str(unit_col.iloc[idx] or "").strip().lower() or "pcs"
            if not iname or qty_val <= 0:
                continue
            if not pname and not sku_raw:
                continue
            unit, _ = Unit.objects.get_or_create(
                code=ucode[:16],
                defaults={"name_en": ucode, "name_ar": ""},
            )
            product, p_created = _resolve_product_by_sku_or_name(sku_raw or None, pname)
            if p_created:
                created_products += 1
            lookups = {"name_en": iname}
            defaults = {"base_unit": unit, "is_active": True}
            if ing_code:
                defaults["serial_code"] = ing_code[:64]
            ingredient, i_created = Ingredient.objects.get_or_create(
                name_en=iname,
                defaults=defaults,
            )
            if i_created:
                created_ingredients += 1
            elif ing_code and ingredient.serial_code != ing_code:
                ingredient.serial_code = ing_code[:64]
                ingredient.save(update_fields=["serial_code"])
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
