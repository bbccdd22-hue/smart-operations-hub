"""
Integration: Inventory All Scenarios
======================================
Stock Transfer + Manual Adjustment + Recipe Depletion + Waste

Invariants validated:
  1.  Stock Transfer Departure: source decreases, in-transit increases.
  2.  Stock Transfer Confirm: in-transit decreases, destination increases.
  3.  Full transfer round-trip conserves total stock across all branches.
  4.  Stock Transfer Reject: in-transit returns to source (full restoration).
  5.  Confirming already-confirmed transfer is idempotent.
  6.  Rejecting a confirmed transfer raises ValueError.
  7.  Excel recipe depletion (process_product_sale_depletion) reduces on_hand.
  8.  Depletion skips branches with pos_depletion_enabled=True.
  9.  WasteLog creation records waste correctly.
  10. Stock balance invariant: opening + Σmovements = closing on_hand.
  11. Transfer with zero-qty line is a no-op (skipped safely).
  12. Missing IN_TRANSIT branch raises a clear ValueError.
  13. StockMovement types are correct at each step.
  14. BranchStock is auto-created when missing.
  15. Negative stock is allowed but recorded in errors list.
"""
import datetime
from decimal import Decimal

import pytest

from integration_tests.conftest import get_on_hand, lines_balanced

FIXED_DATE = datetime.date(2025, 3, 15)
TRANSFER_QTY = Decimal("500")


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _make_transfer(from_branch, to_branch, ingredient, qty, user=None):
    from inventory.models import StockTransfer, StockTransferLine
    t = StockTransfer.objects.create(from_branch=from_branch, to_branch=to_branch,
                                      requested_by=user)
    StockTransferLine.objects.create(transfer=t, ingredient=ingredient, qty=qty)
    return t


def _make_excel_upload(brand, branch):
    from imports.models import ExcelUpload, ExcelReportType
    return ExcelUpload.objects.create(
        brand=brand, report_type=ExcelReportType.PRODUCT_SALES, file=""
    )


def _add_product_sale(upload, brand, branch, sku, qty, name="Product"):
    from imports.models import ProductSale
    ProductSale.objects.create(
        upload=upload, brand=brand, branch=branch,
        date=FIXED_DATE, product_sku=sku, product_name=name,
        qty=Decimal(str(qty)), total_sales=Decimal("100"),
    )


# ─── Test 1: Transfer Departure ───────────────────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_transfer_departure_source_decreases_transit_increases(
    main_branch, north_branch, in_transit_branch, ingredients, branch_stock, superuser
):
    from inventory.transfer_services import process_transfer_departure
    from inventory.models import StockMovement, StockMovementType

    ing = ingredients["Espresso Beans"]
    src_before = get_on_hand(main_branch, ing)
    transit_before = get_on_hand(in_transit_branch, ing)

    transfer = _make_transfer(main_branch, north_branch, ing, TRANSFER_QTY, superuser)
    process_transfer_departure(transfer)

    assert get_on_hand(main_branch, ing) == src_before - TRANSFER_QTY
    assert get_on_hand(in_transit_branch, ing) == transit_before + TRANSFER_QTY

    assert StockMovement.objects.filter(
        branch=main_branch, ingredient=ing,
        movement_type=StockMovementType.TRANSFER_OUT
    ).exists()
    assert StockMovement.objects.filter(
        branch=in_transit_branch, ingredient=ing,
        movement_type=StockMovementType.TRANSFER_IN
    ).exists()


# ─── Test 2: Transfer Confirm ─────────────────────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_transfer_confirm_moves_from_transit_to_destination(
    main_branch, north_branch, in_transit_branch, ingredients, branch_stock, superuser
):
    from inventory.transfer_services import confirm_transfer, process_transfer_departure
    from inventory.models import StockMovement, StockMovementType

    ing = ingredients["Espresso Beans"]
    dst_before = get_on_hand(north_branch, ing)

    transfer = _make_transfer(main_branch, north_branch, ing, TRANSFER_QTY, superuser)
    process_transfer_departure(transfer)
    confirm_transfer(transfer, confirmed_by=superuser)

    assert get_on_hand(in_transit_branch, ing) == Decimal("0")
    assert get_on_hand(north_branch, ing) == dst_before + TRANSFER_QTY
    assert StockMovement.objects.filter(
        branch=north_branch, ingredient=ing,
        movement_type=StockMovementType.TRANSFER_IN,
    ).exists()


# ─── Test 3: Total stock conserved across all branches ───────────────────────

@pytest.mark.django_db(transaction=True)
def test_transfer_total_stock_conserved(
    main_branch, north_branch, in_transit_branch, ingredients, branch_stock, superuser
):
    from inventory.transfer_services import confirm_transfer, process_transfer_departure

    ing = ingredients["Espresso Beans"]
    total_before = (
        get_on_hand(main_branch, ing)
        + get_on_hand(north_branch, ing)
        + get_on_hand(in_transit_branch, ing)
    )
    transfer = _make_transfer(main_branch, north_branch, ing, TRANSFER_QTY, superuser)
    process_transfer_departure(transfer)
    confirm_transfer(transfer, confirmed_by=superuser)

    total_after = (
        get_on_hand(main_branch, ing)
        + get_on_hand(north_branch, ing)
        + get_on_hand(in_transit_branch, ing)
    )
    assert total_after == total_before, (
        f"Stock not conserved: before={total_before}, after={total_after}"
    )


# ─── Test 4: Transfer Reject restores source ──────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_transfer_reject_restores_source_stock(
    main_branch, north_branch, in_transit_branch, ingredients, branch_stock, superuser
):
    from inventory.transfer_services import process_transfer_departure, reject_transfer

    ing = ingredients["Whole Milk"]
    src_before = get_on_hand(main_branch, ing)

    transfer = _make_transfer(main_branch, north_branch, ing, Decimal("1000"), superuser)
    process_transfer_departure(transfer)
    assert get_on_hand(main_branch, ing) == src_before - Decimal("1000")

    reject_transfer(transfer, rejected_by=superuser)
    assert get_on_hand(main_branch, ing) == src_before, "Source not restored after rejection"
    assert get_on_hand(in_transit_branch, ing) == Decimal("0")


# ─── Test 5: Confirm is idempotent ───────────────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_transfer_confirm_idempotent(
    main_branch, north_branch, in_transit_branch, ingredients, branch_stock, superuser
):
    from inventory.models import StockMovement
    from inventory.transfer_services import confirm_transfer, process_transfer_departure

    ing = ingredients["Sugar"]
    transfer = _make_transfer(main_branch, north_branch, ing, Decimal("200"), superuser)
    process_transfer_departure(transfer)
    confirm_transfer(transfer, confirmed_by=superuser)
    mv_count = StockMovement.objects.count()

    confirm_transfer(transfer, confirmed_by=superuser)  # second call
    assert StockMovement.objects.count() == mv_count, "Second confirm created extra movements"


# ─── Test 6: Reject confirmed transfer raises error ───────────────────────────

@pytest.mark.django_db(transaction=True)
def test_reject_confirmed_transfer_raises(
    main_branch, north_branch, in_transit_branch, ingredients, branch_stock, superuser
):
    from inventory.transfer_services import confirm_transfer, process_transfer_departure, reject_transfer

    ing = ingredients["Bread Flour"]
    transfer = _make_transfer(main_branch, north_branch, ing, Decimal("300"), superuser)
    process_transfer_departure(transfer)
    confirm_transfer(transfer, confirmed_by=superuser)

    with pytest.raises(ValueError):
        reject_transfer(transfer, rejected_by=superuser)


# ─── Test 7: Excel depletion reduces on_hand ──────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_excel_depletion_reduces_stock(
    main_branch, north_branch, test_brand, ingredients, products, branch_stock
):
    """process_product_sale_depletion reduces on_hand for non-POS branches."""
    from inventory.depletion_services import process_product_sale_depletion

    north_branch.pos_depletion_enabled = False
    north_branch.save(update_fields=["pos_depletion_enabled"])

    ing = ingredients["Espresso Beans"]
    on_hand_before = get_on_hand(north_branch, ing)

    upload = _make_excel_upload(test_brand, north_branch)
    _add_product_sale(upload, test_brand, north_branch, "LATTE-001", 10, "Café Latte")

    result = process_product_sale_depletion(upload)
    assert result["movements_created"] > 0, "No depletion movements created by Excel upload"

    # Latte uses 18g espresso per cup → 10 cups = 180g
    depleted = on_hand_before - get_on_hand(north_branch, ing)
    assert depleted == Decimal("180"), f"Expected 180g depleted, got {depleted}"


# ─── Test 8: Excel depletion skips POS-enabled branch ───────────────────────

@pytest.mark.django_db(transaction=True)
def test_excel_depletion_skips_pos_enabled_branch(
    main_branch, test_brand, ingredients, products, branch_stock
):
    from inventory.depletion_services import process_product_sale_depletion
    from inventory.models import StockMovement

    main_branch.pos_depletion_enabled = True
    main_branch.save(update_fields=["pos_depletion_enabled"])

    mv_before = StockMovement.objects.count()
    upload = _make_excel_upload(test_brand, main_branch)
    _add_product_sale(upload, test_brand, main_branch, "LATTE-001", 5, "Café Latte")

    result = process_product_sale_depletion(upload)
    assert StockMovement.objects.count() == mv_before, (
        "Excel created movements despite POS depletion enabled"
    )
    assert any("skipped" in e.lower() for e in result.get("errors", [])), (
        "Expected skip warning in errors"
    )


# ─── Test 9: WasteLog creation ────────────────────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_waste_log_created_correctly(main_branch, ingredients, superuser):
    """WasteLog must be created with correct branch, ingredient, and quantity."""
    from inventory.models import WasteLog
    ing = ingredients["Whole Milk"]
    waste = WasteLog.objects.create(
        branch=main_branch, ingredient=ing,
        date=FIXED_DATE, actual_usage=Decimal("500"),
        theoretical_usage=Decimal("400"),
        variance=Decimal("25.00"),  # (500-400)/400 * 100
    )
    waste_qty = waste.actual_usage - waste.theoretical_usage
    assert waste_qty == Decimal("100")
    assert waste.branch == main_branch
    assert WasteLog.objects.filter(branch=main_branch, ingredient=ing, date=FIXED_DATE).exists()


# ─── Test 10: Stock balance invariant ────────────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_stock_balance_opening_plus_movements_equals_closing(
    main_branch, ingredients, branch_stock
):
    """on_hand after operations must equal opening + Σ(qty_delta of all movements)."""
    from inventory.models import BranchStock, StockMovement, StockMovementType

    ing = ingredients["Sugar"]
    opening = get_on_hand(main_branch, ing)

    # Simulate a purchase (positive) + depletion (negative)
    StockMovement.objects.create(
        branch=main_branch, ingredient=ing,
        movement_type=StockMovementType.PURCHASE, qty_delta=Decimal("500"),
        reference="test-purchase",
    )
    stock = BranchStock.objects.get(branch=main_branch, ingredient=ing)
    stock.on_hand += Decimal("500")
    stock.save(update_fields=["on_hand"])

    StockMovement.objects.create(
        branch=main_branch, ingredient=ing,
        movement_type=StockMovementType.DEPLETION, qty_delta=Decimal("-200"),
        reference="test-depletion",
    )
    stock.refresh_from_db()
    stock.on_hand -= Decimal("200")
    stock.save(update_fields=["on_hand"])

    # Verify: opening + net movements = current on_hand
    movements = StockMovement.objects.filter(branch=main_branch, ingredient=ing)
    net_movements = sum(m.qty_delta for m in movements)
    calculated_closing = opening + net_movements

    stock.refresh_from_db()
    assert stock.on_hand == calculated_closing, (
        f"Balance invariant violated: "
        f"opening({opening}) + movements({net_movements}) = {calculated_closing} "
        f"≠ actual on_hand({stock.on_hand})"
    )


# ─── Test 11: Transfer with zero-qty line is a no-op ─────────────────────────

@pytest.mark.django_db(transaction=True)
def test_transfer_zero_qty_line_is_noop(
    main_branch, north_branch, in_transit_branch, ingredients, branch_stock, superuser
):
    from inventory.models import StockMovement
    from inventory.transfer_services import process_transfer_departure

    ing = ingredients["Bread Flour"]
    src_before = get_on_hand(main_branch, ing)
    mv_before = StockMovement.objects.count()

    transfer = _make_transfer(main_branch, north_branch, ing, Decimal("0"), superuser)
    process_transfer_departure(transfer)

    assert get_on_hand(main_branch, ing) == src_before, "Zero-qty transfer changed stock"
    assert StockMovement.objects.count() == mv_before, "Zero-qty transfer created movements"


# ─── Test 12: Missing IN_TRANSIT branch raises ValueError ────────────────────

@pytest.mark.django_db(transaction=True)
def test_transfer_missing_in_transit_raises(
    main_branch, north_branch, ingredients, branch_stock, superuser
):
    from org.models import Branch
    from inventory.transfer_services import process_transfer_departure

    Branch.objects.filter(branch_code="IN_TRANSIT").delete()

    ing = ingredients["Sugar"]
    transfer = _make_transfer(main_branch, north_branch, ing, Decimal("100"), superuser)
    with pytest.raises(ValueError, match="قيد النقل"):
        process_transfer_departure(transfer)


# ─── Test 13: StockMovement types are correct throughout transfer ─────────────

@pytest.mark.django_db(transaction=True)
def test_transfer_movement_types_correct(
    main_branch, north_branch, in_transit_branch, ingredients, branch_stock, superuser
):
    from inventory.models import StockMovement, StockMovementType
    from inventory.transfer_services import confirm_transfer, process_transfer_departure

    ing = ingredients["Chicken Breast"]
    transfer = _make_transfer(main_branch, north_branch, ing, Decimal("300"), superuser)
    process_transfer_departure(transfer)
    confirm_transfer(transfer, confirmed_by=superuser)

    # Source: TRANSFER_OUT
    assert StockMovement.objects.filter(
        branch=main_branch, ingredient=ing,
        movement_type=StockMovementType.TRANSFER_OUT
    ).exists()
    # In-transit received: TRANSFER_IN then TRANSFER_OUT
    assert StockMovement.objects.filter(
        branch=in_transit_branch, ingredient=ing,
        movement_type=StockMovementType.TRANSFER_IN
    ).exists()
    assert StockMovement.objects.filter(
        branch=in_transit_branch, ingredient=ing,
        movement_type=StockMovementType.TRANSFER_OUT
    ).exists()
    # Destination: TRANSFER_IN
    assert StockMovement.objects.filter(
        branch=north_branch, ingredient=ing,
        movement_type=StockMovementType.TRANSFER_IN
    ).exists()


# ─── Test 14: BranchStock auto-created when missing ──────────────────────────

@pytest.mark.django_db(transaction=True)
def test_branch_stock_auto_created_on_depletion(
    main_branch, ingredients, products
):
    """Depletion for a branch with no pre-existing BranchStock creates it automatically."""
    from inventory.depletion_services import _get_or_create_branch_stock_locked
    from inventory.models import BranchStock

    ing = ingredients["Sugar"]
    BranchStock.objects.filter(branch=main_branch, ingredient=ing).delete()

    stock = _get_or_create_branch_stock_locked(main_branch.id, ing.id)
    assert stock is not None
    assert stock.on_hand == Decimal("0")
    assert BranchStock.objects.filter(branch=main_branch, ingredient=ing).exists()


# ─── Test 15: Negative stock recorded in errors ───────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_excel_depletion_allows_negative_stock_with_error(
    north_branch, test_brand, ingredients, products, branch_stock
):
    """Depletion beyond on_hand should be allowed but recorded as error."""
    from inventory.depletion_services import process_product_sale_depletion

    north_branch.pos_depletion_enabled = False
    north_branch.save(update_fields=["pos_depletion_enabled"])

    ing = ingredients["Espresso Beans"]
    # Set stock to near zero
    from inventory.models import BranchStock
    stock, _ = BranchStock.objects.get_or_create(branch=north_branch, ingredient=ing,
                                                   defaults={"on_hand": Decimal("0")})
    stock.on_hand = Decimal("5")  # only 5g
    stock.save(update_fields=["on_hand"])

    # Try to sell 100 lattes (18g each = 1800g needed, only 5g available)
    upload = _make_excel_upload(test_brand, north_branch)
    _add_product_sale(upload, test_brand, north_branch, "LATTE-001", 100, "Café Latte")

    result = process_product_sale_depletion(upload)
    assert result["movements_created"] > 0, "Expected movements despite negative stock"
    assert any("سالب" in e or "negative" in e.lower() for e in result.get("errors", [])), (
        "Expected negative stock error in result"
    )
    stock.refresh_from_db()
    assert stock.on_hand < 0, "on_hand should be negative after over-depletion"
