"""
Product Catalog Parser for BOM Module [Ref: 132745].
Saif's format: Arabic headers in row 1.
- المنتج -> Product Name
- الوحدة -> Unit (pcs, kg, etc.)
- كود تعريف المنتج -> SKU / Product ID
- السعر غير شامل الضريبة -> Price (Excl. Tax)
"""
from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation

import pandas as pd

from inventory.models import FoodicsProduct, Unit


# Header mapping: Arabic (exact/stripped) -> logical name
PRODUCT_NAME_COLS = ["المنتج", "Product", "Product Name", "product"]
UNIT_COLS = ["الوحدة", "Unit", "Unit Code", "unit"]
SKU_COLS = ["كود تعريف المنتج", "SKU", "Product ID", "product_id", "Product Code"]
PRICE_COLS = ["السعر غير شامل الضريبة", "Price", "Price Excl. Tax", "price"]


def _normalize_header(h: str) -> str:
    """Strip BOM, whitespace, lowercase for matching."""
    if h is None:
        return ""
    return str(h).strip().strip("\ufeff").strip().lower()


def _find_col(df: pd.DataFrame, options: list[str]) -> str | None:
    """Find column by exact or normalized match. Returns actual column name."""
    cols_lower = {_normalize_header(c): c for c in df.columns}
    for opt in options:
        norm = _normalize_header(opt)
        if norm in cols_lower:
            return cols_lower[norm]
        for col_norm, col_actual in cols_lower.items():
            if norm in col_norm or col_norm in norm:
                return col_actual
    return None


def _parse_price(val) -> Decimal | None:
    """
    Strip currency symbols (SAR, ر.س, $, etc.) and convert to Decimal.
    """
    if val is None:
        return None
    if isinstance(val, pd.Series):
        val = val.iloc[0] if len(val) else None
    if val is None:
        return None
    if isinstance(val, (int, float)) and not isinstance(val, bool):
        try:
            return Decimal(str(val))
        except (InvalidOperation, ValueError):
            return None
    s = str(val).strip()
    if not s or s.lower() in ("nan", ""):
        return None
    # Remove currency symbols and thousand separators; keep digits and decimal
    for pattern in [
        r"SAR\s*", r"SR\s*", r"USD\s*", r"\$\s*", r"€\s*", r"£\s*",
        r"ريال\s*", r"ر\.س\s*", r"ر.س\s*",
    ]:
        s = re.sub(pattern, "", s, flags=re.I)
    s = s.replace("،", "").replace(",", "").replace("\u202f", "").replace(" ", "").strip()
    if not s:
        return None
    try:
        return Decimal(s)
    except (InvalidOperation, ValueError):
        return None


def parse_product_catalog_excel(file) -> dict:
    """
    Parse Saif's Product Catalog Excel. header=0 (first row).
    Creates/updates FoodicsProduct (Products = final items sold).
    Ingredients are uploaded separately.
    """
    df = pd.read_excel(file, header=0)
    df.dropna(how="all", inplace=True)
    df.dropna(axis=1, how="all", inplace=True)
    df.reset_index(drop=True, inplace=True)

    cols_list = list(df.columns)
    df.columns = [
        f"{c}_{i}" if cols_list.count(c) > 1 else c
        for i, c in enumerate(cols_list)
    ]

    product_col = _find_col(df, PRODUCT_NAME_COLS)
    unit_col = _find_col(df, UNIT_COLS)
    sku_col = _find_col(df, SKU_COLS)
    price_col = _find_col(df, PRICE_COLS)

    if not product_col:
        raise ValueError("Missing required column: المنتج (Product Name)")

    created = 0
    updated = 0
    skipped = 0
    errors = []

    for idx in range(len(df)):
        try:
            pname_raw = df[product_col].iloc[idx]
            if isinstance(pname_raw, pd.Series):
                pname_raw = pname_raw.iloc[0] if len(pname_raw) else None
            pname = str(pname_raw or "").strip()
            if not pname or pname.lower() in ("nan", ""):
                skipped += 1
                continue

            sku_raw = None
            if sku_col:
                sku_raw = df[sku_col].iloc[idx]
                if isinstance(sku_raw, pd.Series):
                    sku_raw = sku_raw.iloc[0] if len(sku_raw) else None
            sku = str(sku_raw or "").strip() if sku_raw is not None else ""
            if not sku:
                sku = pname[:50].lower().replace(" ", "-").replace("_", "-")
                sku = "".join(c for c in sku if c.isalnum() or c == "-") or f"prod-{idx}"
            sku = sku[:64]

            unit_code = "pcs"
            if unit_col:
                u_raw = df[unit_col].iloc[idx]
                if isinstance(u_raw, pd.Series):
                    u_raw = u_raw.iloc[0] if len(u_raw) else None
                if u_raw is not None and str(u_raw).strip():
                    unit_code = str(u_raw).strip().lower()[:16]

            unit, _ = Unit.objects.get_or_create(
                code=unit_code,
                defaults={"name_en": unit_code, "name_ar": ""},
            )

            price = None
            if price_col:
                price = _parse_price(df[price_col].iloc[idx])

            product, created_flag = FoodicsProduct.objects.update_or_create(
                foodics_product_id=sku,
                defaults={
                    "name": pname[:255],
                    "is_active": True,
                    "sales_unit": unit,
                    "price_excl_tax": price,
                },
            )
            if created_flag:
                created += 1
            else:
                updated += 1

        except Exception as e:
            errors.append({"row": idx + 2, "error": str(e)[:200]})
            if len(errors) >= 50:
                break

    return {
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "total_processed": created + updated,
        "errors": errors[:50],
    }
