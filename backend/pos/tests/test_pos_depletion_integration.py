"""
Integration tests for POS → inventory depletion linkage.

Tests the full path:
  SaleTransaction saved → signal fires → deplete_from_pos_sale() called →
  StockMovement created → BranchStock.on_hand decremented.

Also tests:
  - Branch with pos_depletion_enabled=False → no depletion.
  - Global flag POS_REALTIME_DEPLETION_ENABLED=False → no depletion even if branch opt-in.
  - Sale with no recipe → returns warning, no crash.
  - Excel depletion skips POS-enabled branches (double-depletion guard).
"""
import uuid
from decimal import Decimal

import pytest
from django.test import override_settings


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _make_unit(code="g"):
    from inventory.models import Unit
    u, _ = Unit.objects.get_or_create(code=code, defaults={"name_en": code, "name_ar": code})
    return u


def _make_ingredient(name, unit=None):
    from inventory.models import Ingredient
    unit = unit or _make_unit()
    ing, _ = Ingredient.objects.get_or_create(name_en=name, defaults={"base_unit": unit})
    return ing


def _make_product(sku, name="Test Product"):
    """FoodicsProduct — the SKU is foodics_product_id."""
    from inventory.models import FoodicsProduct
    prod, _ = FoodicsProduct.objects.get_or_create(
        foodics_product_id=sku, defaults={"name": name}
    )
    return prod


def _make_recipe(product, ingredient, qty):
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


def _get_on_hand(branch, ingredient):
    from inventory.models import BranchStock
    try:
        return BranchStock.objects.get(branch=branch, ingredient=ingredient).on_hand
    except BranchStock.DoesNotExist:
        return Decimal("0")


def _make_sale(branch, items, enabled_flag=True):
    """Create a SaleTransaction for the given branch."""
    from pos.models import SaleTransaction
    return SaleTransaction.objects.create(
        branch=branch,
        sale_number=f"SALE-{uuid.uuid4().hex[:8]}",
        items=items,
        total=Decimal("100.00"),
    )


# ─── Tests: deplete_from_pos_sale() directly ──────────────────────────────────

@pytest.mark.django_db(transaction=True)
@override_settings(POS_REALTIME_DEPLETION_ENABLED=True)
def test_deplete_from_pos_sale_reduces_stock(test_branch, test_brand):
    """A POS sale with a recipe depletes stock correctly."""
    from inventory.depletion_services import deplete_from_pos_sale
    from inventory.models import StockMovement, StockMovementType

    test_branch.pos_depletion_enabled = True
    test_branch.save(update_fields=["pos_depletion_enabled"])

    ing = _make_ingredient("POS-Ingredient-1")
    prod = _make_product("POS-SKU-001")
    _make_recipe(prod, ing, qty=Decimal("0.2"))
    _set_stock(test_branch, ing, Decimal("10"))

    sale = _make_sale(test_branch, [{"product_sku": "POS-SKU-001", "qty": 3}])
    warnings = deplete_from_pos_sale(sale)

    # Stock should decrease: 10 - (3 * 0.2) = 9.4
    assert _get_on_hand(test_branch, ing) == Decimal("9.4"), (
        f"Expected on_hand=9.4, got {_get_on_hand(test_branch, ing)}"
    )
    depletion_mvs = StockMovement.objects.filter(
        branch=test_branch, ingredient=ing,
        movement_type=StockMovementType.DEPLETION,
        reference__startswith=f"pos_sale_{sale.id}_",
    )
    assert depletion_mvs.exists(), "StockMovement not created for POS sale depletion"
    # No negative-stock warnings expected (10 > 0.6)
    assert not [w for w in warnings if "negative" in w.lower()]


@pytest.mark.django_db(transaction=True)
@override_settings(POS_REALTIME_DEPLETION_ENABLED=True)
def test_deplete_from_pos_sale_disabled_branch_no_depletion(test_branch):
    """Branch with pos_depletion_enabled=False → depletion is skipped."""
    from inventory.depletion_services import deplete_from_pos_sale
    from inventory.models import StockMovement

    test_branch.pos_depletion_enabled = False
    test_branch.save(update_fields=["pos_depletion_enabled"])

    ing = _make_ingredient("POS-Ingredient-2")
    prod = _make_product("POS-SKU-002")
    _make_recipe(prod, ing, qty=Decimal("1"))
    _set_stock(test_branch, ing, Decimal("50"))
    movements_before = StockMovement.objects.count()

    sale = _make_sale(test_branch, [{"product_sku": "POS-SKU-002", "qty": 2}])
    warnings = deplete_from_pos_sale(sale)

    assert StockMovement.objects.count() == movements_before, (
        "Movements created despite pos_depletion_enabled=False"
    )
    assert _get_on_hand(test_branch, ing) == Decimal("50"), "Stock changed despite disabled branch"


@pytest.mark.django_db(transaction=True)
@override_settings(POS_REALTIME_DEPLETION_ENABLED=False)
def test_deplete_from_pos_sale_global_flag_off_no_depletion(test_branch):
    """Global POS_REALTIME_DEPLETION_ENABLED=False → no depletion regardless of branch flag."""
    from inventory.depletion_services import deplete_from_pos_sale
    from inventory.models import StockMovement

    test_branch.pos_depletion_enabled = True
    test_branch.save(update_fields=["pos_depletion_enabled"])

    ing = _make_ingredient("POS-Ingredient-3")
    prod = _make_product("POS-SKU-003")
    _make_recipe(prod, ing, qty=Decimal("1"))
    _set_stock(test_branch, ing, Decimal("20"))
    movements_before = StockMovement.objects.count()

    sale = _make_sale(test_branch, [{"product_sku": "POS-SKU-003", "qty": 1}])
    deplete_from_pos_sale(sale)

    assert StockMovement.objects.count() == movements_before, (
        "Movements created despite global POS_REALTIME_DEPLETION_ENABLED=False"
    )


@pytest.mark.django_db(transaction=True)
@override_settings(POS_REALTIME_DEPLETION_ENABLED=True)
def test_deplete_from_pos_sale_no_recipe_returns_warning(test_branch):
    """A sale for a product with no recipe returns a warning without crashing."""
    from inventory.depletion_services import deplete_from_pos_sale

    test_branch.pos_depletion_enabled = True
    test_branch.save(update_fields=["pos_depletion_enabled"])

    # No recipe created for this SKU
    _make_product("NO-RECIPE-SKU")

    sale = _make_sale(test_branch, [{"product_sku": "NO-RECIPE-SKU", "qty": 1}])
    warnings = deplete_from_pos_sale(sale)

    assert isinstance(warnings, list), "Expected list of warnings"
    assert any("no recipe" in w.lower() for w in warnings), (
        f"Expected 'no recipe' warning, got: {warnings}"
    )


@pytest.mark.django_db(transaction=True)
@override_settings(POS_REALTIME_DEPLETION_ENABLED=True)
def test_deplete_from_pos_sale_is_idempotent(test_branch):
    """Calling deplete_from_pos_sale twice for the same sale creates no extra movements."""
    from inventory.depletion_services import deplete_from_pos_sale
    from inventory.models import StockMovement

    test_branch.pos_depletion_enabled = True
    test_branch.save(update_fields=["pos_depletion_enabled"])

    ing = _make_ingredient("POS-Ingredient-4")
    prod = _make_product("POS-SKU-004")
    _make_recipe(prod, ing, qty=Decimal("0.5"))
    _set_stock(test_branch, ing, Decimal("100"))

    sale = _make_sale(test_branch, [{"product_sku": "POS-SKU-004", "qty": 2}])
    deplete_from_pos_sale(sale)
    movements_after_first = StockMovement.objects.count()
    on_hand_after_first = _get_on_hand(test_branch, ing)

    deplete_from_pos_sale(sale)  # second call — should be no-op
    assert StockMovement.objects.count() == movements_after_first, (
        "Second depletion call created extra movements (not idempotent)"
    )
    assert _get_on_hand(test_branch, ing) == on_hand_after_first, (
        "Second depletion call changed on_hand (not idempotent)"
    )


# ─── Tests: Double-depletion guard in Excel path ──────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_excel_depletion_skips_pos_enabled_branch(test_branch, test_brand):
    """
    process_product_sale_depletion() must skip branches with pos_depletion_enabled=True
    to avoid double-counting when POS depletion is also running.
    """
    from inventory.depletion_services import process_product_sale_depletion
    from inventory.models import StockMovement

    test_branch.pos_depletion_enabled = True
    test_branch.save(update_fields=["pos_depletion_enabled"])

    ing = _make_ingredient("Excel-Ingredient-1")
    prod = _make_product("EXCEL-SKU-001")
    _make_recipe(prod, ing, qty=Decimal("1"))
    _set_stock(test_branch, ing, Decimal("50"))

    # Create a minimal upload + ProductSale
    from imports.models import ExcelUpload, ExcelReportType, ProductSale
    upload = ExcelUpload.objects.create(
        brand=test_brand, report_type=ExcelReportType.PRODUCT_SALES, file=""
    )
    ProductSale.objects.create(
        upload=upload,
        brand=test_brand,
        branch=test_branch,
        date="2025-01-10",
        product_sku="EXCEL-SKU-001",
        product_name="Test Product",
        qty=5,
        total_sales=Decimal("100"),
    )

    movements_before = StockMovement.objects.count()
    result = process_product_sale_depletion(upload)

    assert StockMovement.objects.count() == movements_before, (
        "Excel depletion created movements despite pos_depletion_enabled=True on the branch"
    )
    assert any("skipped" in e.lower() for e in result.get("errors", [])), (
        f"Expected a 'skipped' message in result errors. Got: {result['errors']}"
    )


@pytest.mark.django_db(transaction=True)
def test_excel_depletion_runs_for_non_pos_branch(test_branch, test_brand):
    """
    process_product_sale_depletion() must still run for branches without POS depletion.
    """
    from inventory.depletion_services import process_product_sale_depletion
    from inventory.models import StockMovement, StockMovementType

    test_branch.pos_depletion_enabled = False
    test_branch.save(update_fields=["pos_depletion_enabled"])

    ing = _make_ingredient("Excel-Ingredient-2")
    prod = _make_product("EXCEL-SKU-002")
    _make_recipe(prod, ing, qty=Decimal("1"))
    _set_stock(test_branch, ing, Decimal("50"))

    from imports.models import ExcelUpload, ExcelReportType, ProductSale
    upload = ExcelUpload.objects.create(
        brand=test_brand, report_type=ExcelReportType.PRODUCT_SALES, file=""
    )
    ProductSale.objects.create(
        upload=upload,
        brand=test_brand,
        branch=test_branch,
        date="2025-01-11",
        product_sku="EXCEL-SKU-002",
        product_name="Test Product",
        qty=3,
        total_sales=Decimal("60"),
    )

    result = process_product_sale_depletion(upload)

    # Depletion movements should be created
    depletion_mvs = StockMovement.objects.filter(
        branch=test_branch, ingredient=ing,
        movement_type=StockMovementType.DEPLETION,
    )
    assert depletion_mvs.exists(), (
        "Excel depletion should run for branches with pos_depletion_enabled=False"
    )
    assert _get_on_hand(test_branch, ing) == Decimal("47"), (
        f"Expected on_hand=47 (50 - 3), got {_get_on_hand(test_branch, ing)}"
    )
