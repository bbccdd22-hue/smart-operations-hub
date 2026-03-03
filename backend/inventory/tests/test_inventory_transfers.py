"""
Tests for inventory/transfer_services.py

The transfer lifecycle is:
  Departure → stock leaves source branch, enters IN_TRANSIT branch.
  Confirm  → stock leaves IN_TRANSIT, enters destination branch.
  Reject   → stock leaves IN_TRANSIT, returns to source branch.

Key invariants:
  1. After departure: source decremented, in-transit incremented.
  2. After confirm: in-transit decremented, destination incremented.
  3. After reject: in-transit decremented, source restored.
  4. StockMovement records created for every step with correct types.
  5. Confirming an already-confirmed transfer is idempotent.
  6. Rejecting a non-pending transfer raises ValueError.
  7. Transfer with zero-qty lines is effectively a no-op (skip).
  8. Missing in-transit branch raises a clear ValueError.
"""
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _make_in_transit_branch(brand, city):
    """Create the required IN_TRANSIT pseudo-branch."""
    from org.models import Branch
    b, _ = Branch.objects.get_or_create(
        branch_code="IN_TRANSIT",
        defaults={
            "brand": brand,
            "city": city,
            "name": "In Transit",
            "is_active": True,
        },
    )
    return b


def _make_branch(name, brand, city):
    from org.models import Branch
    b, _ = Branch.objects.get_or_create(
        name=name,
        defaults={"brand": brand, "city": city, "is_active": True},
    )
    return b


def _make_unit(code="kg"):
    from inventory.models import Unit
    u, _ = Unit.objects.get_or_create(code=code, defaults={"name_en": code, "name_ar": code})
    return u


def _make_ingredient(name, unit=None):
    from inventory.models import Ingredient
    unit = unit or _make_unit()
    ing, _ = Ingredient.objects.get_or_create(name_en=name, defaults={"base_unit": unit})
    return ing


def _set_stock(branch, ingredient, on_hand):
    from inventory.models import BranchStock
    stock, created = BranchStock.objects.get_or_create(
        branch=branch, ingredient=ingredient, defaults={"on_hand": on_hand}
    )
    if not created:
        stock.on_hand = on_hand
        stock.save(update_fields=["on_hand"])
    return stock


def _get_stock(branch, ingredient):
    from inventory.models import BranchStock
    try:
        return BranchStock.objects.get(branch=branch, ingredient=ingredient).on_hand
    except BranchStock.DoesNotExist:
        return Decimal("0")


def _make_transfer(from_branch, to_branch, ingredient, qty, user=None):
    from inventory.models import StockTransfer, StockTransferLine
    transfer = StockTransfer.objects.create(
        from_branch=from_branch,
        to_branch=to_branch,
        requested_by=user,
    )
    StockTransferLine.objects.create(transfer=transfer, ingredient=ingredient, qty=qty)
    return transfer


# ─── Tests: departure ─────────────────────────────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_departure_decrements_source_increments_transit(test_brand, test_city, test_user):
    from inventory.transfer_services import process_transfer_departure
    from inventory.models import StockMovement, StockMovementType

    transit = _make_in_transit_branch(test_brand, test_city)
    src = _make_branch("Src-A", test_brand, test_city)
    dst = _make_branch("Dst-A", test_brand, test_city)
    ing = _make_ingredient("Rice-T1")
    _set_stock(src, ing, Decimal("100"))
    _set_stock(transit, ing, Decimal("0"))

    transfer = _make_transfer(src, dst, ing, Decimal("30"), user=test_user)
    process_transfer_departure(transfer)

    assert _get_stock(src, ing) == Decimal("70"), "Source should be reduced by transfer qty"
    assert _get_stock(transit, ing) == Decimal("30"), "In-transit should receive the qty"

    # Check StockMovement types
    out_mv = StockMovement.objects.filter(
        branch=src, ingredient=ing, movement_type=StockMovementType.TRANSFER_OUT
    )
    in_mv = StockMovement.objects.filter(
        branch=transit, ingredient=ing, movement_type=StockMovementType.TRANSFER_IN
    )
    assert out_mv.exists(), "TRANSFER_OUT movement missing from source"
    assert in_mv.exists(), "TRANSFER_IN movement missing at in-transit"


# ─── Tests: confirm ───────────────────────────────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_confirm_moves_stock_from_transit_to_destination(test_brand, test_city, test_user):
    from inventory.transfer_services import confirm_transfer, process_transfer_departure
    from inventory.models import StockMovement, StockMovementType

    transit = _make_in_transit_branch(test_brand, test_city)
    src = _make_branch("Src-B", test_brand, test_city)
    dst = _make_branch("Dst-B", test_brand, test_city)
    ing = _make_ingredient("Flour-T2")
    _set_stock(src, ing, Decimal("200"))
    _set_stock(transit, ing, Decimal("0"))
    _set_stock(dst, ing, Decimal("50"))

    transfer = _make_transfer(src, dst, ing, Decimal("60"), user=test_user)
    process_transfer_departure(transfer)
    confirm_transfer(transfer, confirmed_by=test_user)

    assert _get_stock(transit, ing) == Decimal("0"), "In-transit should be zero after confirm"
    assert _get_stock(dst, ing) == Decimal("110"), "Destination should receive the qty (50+60)"

    dst_in = StockMovement.objects.filter(
        branch=dst, ingredient=ing, movement_type=StockMovementType.TRANSFER_IN
    )
    assert dst_in.exists(), "TRANSFER_IN movement missing at destination"


@pytest.mark.django_db(transaction=True)
def test_confirm_is_idempotent(test_brand, test_city, test_user):
    """Confirming an already-confirmed transfer must be a no-op."""
    from inventory.transfer_services import confirm_transfer, process_transfer_departure
    from inventory.models import StockMovement

    transit = _make_in_transit_branch(test_brand, test_city)
    src = _make_branch("Src-C", test_brand, test_city)
    dst = _make_branch("Dst-C", test_brand, test_city)
    ing = _make_ingredient("Sugar-T3")
    _set_stock(src, ing, Decimal("100"))

    transfer = _make_transfer(src, dst, ing, Decimal("20"), user=test_user)
    process_transfer_departure(transfer)

    movements_before = StockMovement.objects.count()
    confirm_transfer(transfer, confirmed_by=test_user)
    movements_after_first = StockMovement.objects.count()

    confirm_transfer(transfer, confirmed_by=test_user)  # second call
    movements_after_second = StockMovement.objects.count()

    assert movements_after_second == movements_after_first, (
        "Second confirm created extra movements (not idempotent)"
    )


# ─── Tests: reject ────────────────────────────────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_reject_returns_stock_to_source(test_brand, test_city, test_user):
    from inventory.transfer_services import process_transfer_departure, reject_transfer

    transit = _make_in_transit_branch(test_brand, test_city)
    src = _make_branch("Src-D", test_brand, test_city)
    dst = _make_branch("Dst-D", test_brand, test_city)
    ing = _make_ingredient("Salt-T4")
    _set_stock(src, ing, Decimal("80"))
    _set_stock(transit, ing, Decimal("0"))

    transfer = _make_transfer(src, dst, ing, Decimal("25"), user=test_user)
    process_transfer_departure(transfer)

    assert _get_stock(src, ing) == Decimal("55")  # after departure
    reject_transfer(transfer, rejected_by=test_user)

    assert _get_stock(src, ing) == Decimal("80"), "Stock should be restored after rejection"
    assert _get_stock(transit, ing) == Decimal("0"), "Transit stock should be zero after rejection"


@pytest.mark.django_db(transaction=True)
def test_reject_non_pending_raises_error(test_brand, test_city, test_user):
    """Rejecting a transfer that is not PENDING must raise ValueError."""
    from inventory.transfer_services import (
        confirm_transfer, process_transfer_departure, reject_transfer
    )
    transit = _make_in_transit_branch(test_brand, test_city)
    src = _make_branch("Src-E", test_brand, test_city)
    dst = _make_branch("Dst-E", test_brand, test_city)
    ing = _make_ingredient("Oil-T5")
    _set_stock(src, ing, Decimal("50"))

    transfer = _make_transfer(src, dst, ing, Decimal("10"), user=test_user)
    process_transfer_departure(transfer)
    confirm_transfer(transfer, confirmed_by=test_user)

    with pytest.raises(ValueError, match="لا يمكن رفض"):
        reject_transfer(transfer, rejected_by=test_user)


# ─── Tests: missing in-transit branch ────────────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_departure_raises_if_no_in_transit_branch(test_brand, test_city, test_user):
    """If IN_TRANSIT branch doesn't exist, departure must raise ValueError."""
    from org.models import Branch
    from inventory.transfer_services import process_transfer_departure

    # Ensure IN_TRANSIT does not exist
    Branch.objects.filter(branch_code="IN_TRANSIT").delete()

    src = _make_branch("Src-F", test_brand, test_city)
    dst = _make_branch("Dst-F", test_brand, test_city)
    ing = _make_ingredient("Yeast-T6")
    _set_stock(src, ing, Decimal("50"))

    transfer = _make_transfer(src, dst, ing, Decimal("10"), user=test_user)
    with pytest.raises(ValueError, match="قيد النقل"):
        process_transfer_departure(transfer)


# ─── Tests: full round-trip stock conservation ────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_full_transfer_stock_conserved(test_brand, test_city, test_user):
    """
    After departure + confirmation, total stock (src + dst + transit) must be conserved.
    """
    from inventory.transfer_services import confirm_transfer, process_transfer_departure

    transit = _make_in_transit_branch(test_brand, test_city)
    src = _make_branch("Src-G", test_brand, test_city)
    dst = _make_branch("Dst-G", test_brand, test_city)
    ing = _make_ingredient("Butter-T7")
    initial_src = Decimal("100")
    initial_dst = Decimal("20")
    _set_stock(src, ing, initial_src)
    _set_stock(transit, ing, Decimal("0"))
    _set_stock(dst, ing, initial_dst)

    qty = Decimal("35")
    transfer = _make_transfer(src, dst, ing, qty, user=test_user)
    process_transfer_departure(transfer)
    confirm_transfer(transfer, confirmed_by=test_user)

    total = _get_stock(src, ing) + _get_stock(transit, ing) + _get_stock(dst, ing)
    expected = initial_src + initial_dst
    assert total == expected, (
        f"Stock not conserved after transfer: total={total}, expected={expected}"
    )
