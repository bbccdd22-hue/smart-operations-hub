"""
Tests for inventory/depletion_services.py

Key invariants tested:
  1. Recipe explosion creates DEPLETION StockMovements with negative qty_delta.
  2. BranchStock.on_hand is reduced by exactly (recipe_qty × units_sold).
  3. Calling with the same upload twice is a no-op (idempotency).
  4. Negative stock is allowed and reported in errors[] (current intended behavior).
  5. Products with no recipe produce zero movements (graceful skip).
  6. BranchStock is auto-created when missing (select_for_update path).
"""
from decimal import Decimal

import pytest


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _make_unit(code="g"):
    from inventory.models import Unit
    unit, _ = Unit.objects.get_or_create(code=code, defaults={"name_en": code, "name_ar": code})
    return unit


def _make_ingredient(name, unit=None):
    from inventory.models import Ingredient
    unit = unit or _make_unit("g")
    ing, _ = Ingredient.objects.get_or_create(name_en=name, defaults={"base_unit": unit})
    return ing


def _make_product(sku, name="Product"):
    from inventory.models import FoodicsProduct
    prod, _ = FoodicsProduct.objects.get_or_create(
        foodics_product_id=sku, defaults={"name": name}
    )
    return prod


def _make_recipe(product, ingredient, qty=Decimal("100")):
    from inventory.models import Recipe, RecipeLine
    unit = ingredient.base_unit
    recipe, _ = Recipe.objects.get_or_create(
        product=product, defaults={"yield_qty": Decimal("1"), "yield_unit": unit}
    )
    RecipeLine.objects.get_or_create(
        recipe=recipe, ingredient=ingredient, defaults={"qty": qty, "unit": unit}
    )
    return recipe


def _set_stock(branch, ingredient, on_hand):
    from inventory.models import BranchStock
    stock, created = BranchStock.objects.get_or_create(
        branch=branch, ingredient=ingredient, defaults={"on_hand": on_hand}
    )
    if not created:
        stock.on_hand = on_hand
        stock.save(update_fields=["on_hand"])
    return stock


def _make_upload(brand, branch):
    """Create a minimal ExcelUpload (no real file needed for tests)."""
    import datetime
    from django.core.files.base import ContentFile
    from imports.models import ExcelUpload, ExcelReportType
    upload = ExcelUpload.objects.create(
        report_type=ExcelReportType.PRODUCT_SALES,
        file=ContentFile(b"x", name="test.xlsx"),
        brand=brand,
        branch=branch,
        report_date_from=datetime.date.today(),
        report_date_to=datetime.date.today(),
    )
    return upload


def _add_sale_row(upload, sku, qty):
    """Add a ProductSale row linked to the upload."""
    import datetime
    from imports.models import ProductSale
    ProductSale.objects.create(
        brand=upload.brand,
        branch=upload.branch,
        date=upload.report_date_from or datetime.date.today(),
        product_name=sku,
        product_sku=sku,
        qty=Decimal(str(qty)),
        total_sales=Decimal("0"),
        upload=upload,
    )


# ─── Tests ────────────────────────────────────────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_depletion_creates_stock_movement(test_branch, test_brand):
    from inventory.depletion_services import process_product_sale_depletion
    from inventory.models import StockMovement, StockMovementType

    ing = _make_ingredient("Tomato-Test")
    prod = _make_product("SKU-TOM1", "Tomato Burger")
    _make_recipe(prod, ing, qty=Decimal("50"))
    _set_stock(test_branch, ing, Decimal("1000"))

    upload = _make_upload(test_brand, test_branch)
    _add_sale_row(upload, "SKU-TOM1", qty=2)

    result = process_product_sale_depletion(upload)

    assert result["movements_created"] >= 1, (
        f"Expected ≥1 movement, got {result['movements_created']}"
    )
    movement = StockMovement.objects.filter(
        ingredient=ing, branch=test_branch,
        movement_type=StockMovementType.DEPLETION,
    ).first()
    assert movement is not None, "No StockMovement row created"
    assert movement.qty_delta < 0, (
        f"Depletion qty_delta should be negative, got {movement.qty_delta}"
    )


@pytest.mark.django_db(transaction=True)
def test_depletion_reduces_on_hand_correctly(test_branch, test_brand):
    from inventory.depletion_services import process_product_sale_depletion
    from inventory.models import BranchStock

    ing = _make_ingredient("Cheese-Test")
    prod = _make_product("SKU-CHZ2", "Cheese Burger")
    qty_per_unit = Decimal("80")
    units_sold = 3
    starting = Decimal("500")
    _make_recipe(prod, ing, qty=qty_per_unit)
    _set_stock(test_branch, ing, starting)

    upload = _make_upload(test_brand, test_branch)
    _add_sale_row(upload, "SKU-CHZ2", qty=units_sold)

    process_product_sale_depletion(upload)

    stock = BranchStock.objects.get(branch=test_branch, ingredient=ing)
    expected = starting - (qty_per_unit * units_sold)
    assert stock.on_hand == expected, (
        f"Expected on_hand={expected}, got {stock.on_hand}"
    )


@pytest.mark.django_db(transaction=True)
def test_depletion_is_idempotent(test_branch, test_brand):
    from inventory.depletion_services import process_product_sale_depletion
    from inventory.models import BranchStock

    ing = _make_ingredient("Lettuce-Test")
    prod = _make_product("SKU-LET3", "Lettuce Wrap")
    qty_per_unit = Decimal("30")
    units_sold = 2
    starting = Decimal("300")
    _make_recipe(prod, ing, qty=qty_per_unit)
    _set_stock(test_branch, ing, starting)

    upload = _make_upload(test_brand, test_branch)
    _add_sale_row(upload, "SKU-LET3", qty=units_sold)

    result1 = process_product_sale_depletion(upload)
    result2 = process_product_sale_depletion(upload)

    assert result1["movements_created"] >= 1
    assert result2["movements_created"] == 0, (
        "Second call should be a no-op (Already processed)"
    )

    # Stock should be reduced only once
    stock = BranchStock.objects.get(branch=test_branch, ingredient=ing)
    expected = starting - (qty_per_unit * units_sold)
    assert stock.on_hand == expected, (
        f"Double-depletion: expected {expected}, got {stock.on_hand}"
    )


@pytest.mark.django_db(transaction=True)
def test_depletion_allows_negative_stock_and_reports_error(test_branch, test_brand):
    """
    When stock goes negative, the system allows it (current behavior) but
    includes an error entry in the returned dict.
    """
    from inventory.depletion_services import process_product_sale_depletion
    from inventory.models import BranchStock

    ing = _make_ingredient("Oil-Test")
    prod = _make_product("SKU-OIL4", "Deep Fry")
    _make_recipe(prod, ing, qty=Decimal("200"))
    _set_stock(test_branch, ing, Decimal("100"))  # not enough for 1 unit × 200g

    upload = _make_upload(test_brand, test_branch)
    _add_sale_row(upload, "SKU-OIL4", qty=1)

    result = process_product_sale_depletion(upload)

    stock = BranchStock.objects.get(branch=test_branch, ingredient=ing)
    assert stock.on_hand < 0, "Expected negative stock (system allows it with warning)"
    assert len(result["errors"]) >= 1, (
        f"Expected error entry for negative stock, got: {result['errors']}"
    )


@pytest.mark.django_db(transaction=True)
def test_no_recipe_means_zero_movements(test_branch, test_brand):
    """Products with no recipe produce zero movements (graceful skip)."""
    from inventory.depletion_services import process_product_sale_depletion

    _make_product("SKU-NORECIPE5", "Mystery Product")
    # No Recipe created

    upload = _make_upload(test_brand, test_branch)
    _add_sale_row(upload, "SKU-NORECIPE5", qty=5)

    result = process_product_sale_depletion(upload)
    assert result["movements_created"] == 0, (
        f"Expected 0 movements for product with no recipe, got {result['movements_created']}"
    )


@pytest.mark.django_db(transaction=True)
def test_branch_stock_auto_created_when_missing(test_branch, test_brand):
    """
    BranchStock must be auto-created (with on_hand=0) if it doesn't exist
    before the depletion runs (tests the select_for_update auto-create path).
    """
    from inventory.depletion_services import process_product_sale_depletion
    from inventory.models import BranchStock

    ing = _make_ingredient("Butter-Test")
    prod = _make_product("SKU-BUT6", "Butter Toast")
    _make_recipe(prod, ing, qty=Decimal("10"))
    # Intentionally do NOT create BranchStock

    upload = _make_upload(test_brand, test_branch)
    _add_sale_row(upload, "SKU-BUT6", qty=1)

    process_product_sale_depletion(upload)

    assert BranchStock.objects.filter(branch=test_branch, ingredient=ing).exists(), (
        "BranchStock was not auto-created during depletion"
    )
