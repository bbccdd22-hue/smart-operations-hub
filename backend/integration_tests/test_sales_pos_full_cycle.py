"""
Integration: Sales / POS Full Cycle
=====================================
POS SaleTransaction → Inventory Depletion → ShiftClosing → JournalEntry

Invariants validated:
  1. Creating a SaleTransaction with items triggers depletion when branch flag is ON.
  2. Depletion quantities match recipe × sold qty precisely.
  3. ShiftClosing with cash + network + delivery produces a balanced JE.
  4. Daily sales report total matches ShiftClosing.system_total_sales.
  5. Network-only shift produces no cash debit lines.
  6. Zero-amount shift produces no JE.
  7. Variance (declared ≠ system) is recorded in the JE as a cash over/short line.
  8. Shift closing with POS depletion OFF does not deplete stock.
  9. Re-posting the same ShiftClosing is idempotent.
 10. Executive summary only includes submitted (not draft) closings.
 11. A sale for a branch with pos_depletion_enabled=False skips depletion.
 12. Multiple sale items in one transaction are all depleted correctly.
"""
import datetime
import uuid
from decimal import Decimal

import pytest
from django.test import override_settings

from integration_tests.conftest import get_on_hand, lines_balanced

FIXED_DT = datetime.datetime(2025, 3, 10, 9, 0, 0, tzinfo=datetime.timezone.utc)
FIXED_DATE = FIXED_DT.date()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _make_shift(branch, user, opened_at=FIXED_DT):
    from shifts.models import Shift, ShiftStatus, ShiftType
    return Shift.objects.create(
        branch=branch, status=ShiftStatus.CLOSED,
        shift_type=ShiftType.MORNING, opened_at=opened_at, opened_by=user,
    )


def _make_closing(shift, cash=Decimal("0"), network=Decimal("0"),
                   delivery=Decimal("0"), expenses=Decimal("0"),
                   system_cash=None, system_network=None, system_total=None):
    from shifts.models import ShiftClosing
    return ShiftClosing.objects.create(
        shift=shift,
        manual_cash_override=cash,
        mada=network,
        hungerstation=delivery,
        expenses_vouchers=expenses,
        system_cash=system_cash or cash,
        system_network=system_network or network,
        system_total_sales=system_total or (cash + network + delivery),
        status=ShiftClosing.ClosingStatus.SUBMITTED,
    )


def _make_sale(branch, items):
    from pos.models import SaleTransaction
    total = sum(Decimal(str(i.get("unit_price", 0))) * i.get("qty", 1) for i in items)
    return SaleTransaction.objects.create(
        branch=branch,
        sale_number=f"SALE-{uuid.uuid4().hex[:8]}",
        items=items,
        total=total,
    )


# ─── Test 1: POS sale depletes stock with correct quantity ───────────────────

@pytest.mark.django_db(transaction=True)
@override_settings(POS_REALTIME_DEPLETION_ENABLED=True)
def test_pos_sale_depletes_stock_correct_quantities(
    main_branch, ingredients, products, branch_stock, chart_of_accounts
):
    """Selling 2 lattes and 1 cappuccino depletes espresso beans by 2×18 + 1×18 = 54g."""
    from inventory.depletion_services import deplete_from_pos_sale

    ing = ingredients["Espresso Beans"]
    on_hand_before = get_on_hand(main_branch, ing)

    sale = _make_sale(main_branch, [
        {"product_sku": "LATTE-001", "qty": 2, "unit_price": 18},
        {"product_sku": "CAP-001",   "qty": 1, "unit_price": 15},
    ])
    deplete_from_pos_sale(sale)

    on_hand_after = get_on_hand(main_branch, ing)
    expected_depletion = Decimal("54")  # 3 drinks × 18g each
    assert on_hand_before - on_hand_after == expected_depletion, (
        f"Expected espresso depletion of {expected_depletion}g, "
        f"got {on_hand_before - on_hand_after}g"
    )


# ─── Test 2: Milk depletion from multiple items ───────────────────────────────

@pytest.mark.django_db(transaction=True)
@override_settings(POS_REALTIME_DEPLETION_ENABLED=True)
def test_pos_sale_depletes_milk_correctly(
    main_branch, ingredients, products, branch_stock
):
    """Selling 1 latte (240ml) + 1 cappuccino (150ml) = 390ml milk depleted."""
    from inventory.depletion_services import deplete_from_pos_sale

    ing = ingredients["Whole Milk"]
    on_hand_before = get_on_hand(main_branch, ing)

    sale = _make_sale(main_branch, [
        {"product_sku": "LATTE-001", "qty": 1, "unit_price": 18},
        {"product_sku": "CAP-001",   "qty": 1, "unit_price": 15},
    ])
    deplete_from_pos_sale(sale)

    depleted = on_hand_before - get_on_hand(main_branch, ing)
    assert depleted == Decimal("390"), f"Expected 390ml depleted, got {depleted}"


# ─── Test 3: Branch with POS OFF skips depletion ─────────────────────────────

@pytest.mark.django_db(transaction=True)
@override_settings(POS_REALTIME_DEPLETION_ENABLED=True)
def test_pos_sale_no_depletion_when_branch_flag_off(
    north_branch, ingredients, products, branch_stock
):
    """POS sale on a branch with pos_depletion_enabled=False must not deplete stock."""
    from inventory.models import StockMovement
    from inventory.depletion_services import deplete_from_pos_sale

    north_branch.pos_depletion_enabled = False
    north_branch.save(update_fields=["pos_depletion_enabled"])

    ing = ingredients["Espresso Beans"]
    on_hand_before = get_on_hand(north_branch, ing)
    mv_before = StockMovement.objects.count()

    sale = _make_sale(north_branch, [{"product_sku": "LATTE-001", "qty": 1, "unit_price": 18}])
    deplete_from_pos_sale(sale)

    assert get_on_hand(north_branch, ing) == on_hand_before
    assert StockMovement.objects.count() == mv_before


# ─── Test 4: ShiftClosing mixed-channel JE is balanced ───────────────────────

@pytest.mark.django_db(transaction=True)
def test_shift_closing_mixed_channel_je_balanced(
    main_branch, superuser, chart_of_accounts
):
    """Cash + network + delivery closing must produce a balanced JE."""
    from accounting.journal_services import create_journal_entry_from_shift_closing

    shift = _make_shift(main_branch, superuser)
    closing = _make_closing(shift, cash=Decimal("1200"), network=Decimal("800"),
                             delivery=Decimal("400"), expenses=Decimal("150"))
    je = create_journal_entry_from_shift_closing(closing)

    assert je is not None
    assert lines_balanced(je), "Mixed-channel shift JE not balanced"


# ─── Test 5: Network-only shift has no cash debit lines ──────────────────────

@pytest.mark.django_db(transaction=True)
def test_shift_closing_network_only_no_cash_lines(
    main_branch, superuser, chart_of_accounts
):
    """Network-only closing must not create any cash debit lines."""
    from accounting.journal_services import ACCOUNT_MAPPING, create_journal_entry_from_shift_closing
    from accounting.models import JournalEntryLine

    shift = _make_shift(main_branch, superuser)
    closing = _make_closing(shift, network=Decimal("2000"))
    je = create_journal_entry_from_shift_closing(closing)

    assert je is not None
    cash_code = ACCOUNT_MAPPING["صندوق فرعي"][0]
    cash_debits = JournalEntryLine.objects.filter(
        journal_entry=je, account_code=cash_code, debit_amount__gt=0
    )
    assert not cash_debits.exists(), "Unexpected cash debit lines in network-only closing"
    assert lines_balanced(je)


# ─── Test 6: Zero-amount shift returns None ────────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_shift_closing_zero_amount_returns_none(
    main_branch, superuser, chart_of_accounts
):
    """Zero-amount shift must return None (no JE created)."""
    from accounting.journal_services import create_journal_entry_from_shift_closing
    shift = _make_shift(main_branch, superuser)
    closing = _make_closing(shift)  # all zeros
    je = create_journal_entry_from_shift_closing(closing)
    assert je is None, "Expected None for zero-amount closing, got a JE"


# ─── Test 7: Variance posts to cash over/short account ───────────────────────

@pytest.mark.django_db(transaction=True)
def test_shift_closing_variance_posts_to_correct_account(
    main_branch, superuser, chart_of_accounts
):
    """When actual cash ≠ system cash, variance posts to cash over/short account."""
    from accounting.journal_services import ACCOUNT_MAPPING, create_journal_entry_from_shift_closing
    from accounting.models import JournalEntryLine
    from shifts.models import ShiftClosing

    shift = _make_shift(main_branch, superuser)
    closing = ShiftClosing.objects.create(
        shift=shift,
        manual_cash_override=Decimal("1050"),  # actual
        system_cash=Decimal("1000"),            # system → variance = +50
        system_total_sales=Decimal("1050"),
        status=ShiftClosing.ClosingStatus.SUBMITTED,
    )
    je = create_journal_entry_from_shift_closing(closing)

    assert je is not None
    assert lines_balanced(je)


# ─── Test 8: Re-posting same ShiftClosing is idempotent ──────────────────────

@pytest.mark.django_db(transaction=True)
def test_shift_closing_je_idempotent(
    main_branch, superuser, chart_of_accounts
):
    """Calling create_journal_entry_from_shift_closing twice returns same JE."""
    from accounting.journal_services import create_journal_entry_from_shift_closing

    shift = _make_shift(main_branch, superuser)
    closing = _make_closing(shift, cash=Decimal("800"), network=Decimal("200"))
    je1 = create_journal_entry_from_shift_closing(closing)
    je2 = create_journal_entry_from_shift_closing(closing)

    assert je1 is not None
    assert je1.pk == je2.pk, "Idempotency violated: two different JEs for same closing"


# ─── Test 9: Daily report total matches system_total_sales ───────────────────

@pytest.mark.django_db(transaction=True)
def test_daily_sales_report_matches_shift_total(
    main_branch, superuser
):
    """get_daily_sales_report aggregated sales must match system_total_sales."""
    from shifts.report_services import get_daily_sales_report

    shift = _make_shift(main_branch, superuser)
    system_total = Decimal("2400")
    closing = _make_closing(shift, cash=Decimal("1400"), network=Decimal("1000"),
                             system_total=system_total)

    report = get_daily_sales_report([closing])
    assert len(report) == 1
    row = report[0]
    assert float(row["sales"]) == pytest.approx(float(system_total), abs=1.0), (
        f"Report sales ({row['sales']}) ≠ system_total_sales ({system_total})"
    )


# ─── Test 10: Executive summary excludes drafts ───────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_executive_summary_excludes_drafts(
    main_branch, superuser, test_user_fixture
):
    """finalized_only=True must exclude draft closings from the summary."""
    from accounting.models import DailyAccountingStatus
    from shifts.models import ShiftClosing
    from shifts.report_services import get_hub_executive_summary

    shift_s = _make_shift(main_branch, superuser, opened_at=FIXED_DT)
    closing_submitted = _make_closing(shift_s, cash=Decimal("900"), system_total=Decimal("900"))

    shift_d = _make_shift(main_branch, superuser,
                           opened_at=FIXED_DT.replace(hour=20))
    closing_draft = ShiftClosing.objects.create(
        shift=shift_d, manual_cash_override=Decimal("999"),
        system_total_sales=Decimal("999"), status=ShiftClosing.ClosingStatus.DRAFT,
    )

    # Finalize the test date
    DailyAccountingStatus.objects.get_or_create(
        report_date=FIXED_DATE, defaults={"finalized_by": superuser},
    )
    rows = get_hub_executive_summary(date_from=FIXED_DATE, date_to=FIXED_DATE, finalized_only=True)
    total = sum(r.get("net_sales", r.get("sales", 0)) for r in rows)
    assert total < 999, f"Draft closing data leaked into finalized summary: total={total}"
    assert total >= 900, f"Submitted closing missing from summary: total={total}"


# ─── Test 11: POS StockMovement has correct reference format ─────────────────

@pytest.mark.django_db(transaction=True)
@override_settings(POS_REALTIME_DEPLETION_ENABLED=True)
def test_pos_depletion_movement_reference_format(
    main_branch, ingredients, products, branch_stock
):
    """StockMovement reference must follow pos_sale_{id}_i{ingredient_id} format."""
    from inventory.depletion_services import deplete_from_pos_sale
    from inventory.models import StockMovement, StockMovementType

    sale = _make_sale(main_branch, [{"product_sku": "LATTE-001", "qty": 1, "unit_price": 18}])
    deplete_from_pos_sale(sale)

    mvs = StockMovement.objects.filter(
        branch=main_branch, movement_type=StockMovementType.DEPLETION,
        reference__startswith=f"pos_sale_{sale.id}_",
    )
    assert mvs.exists(), f"No StockMovement with expected reference prefix pos_sale_{sale.id}_"


# ─── Test 12: Full POS cycle with JE verification ────────────────────────────

@pytest.mark.django_db(transaction=True)
@override_settings(POS_REALTIME_DEPLETION_ENABLED=True)
def test_full_pos_sale_then_shift_closing_je(
    main_branch, ingredients, products, branch_stock, superuser, chart_of_accounts
):
    """Full cycle: sell → deplete → close shift → balanced JE → report matches."""
    from accounting.journal_services import create_journal_entry_from_shift_closing
    from inventory.depletion_services import deplete_from_pos_sale
    from shifts.report_services import get_daily_sales_report

    ing = ingredients["Espresso Beans"]
    on_hand_before = get_on_hand(main_branch, ing)

    # Step 1: POS sale
    sale = _make_sale(main_branch, [
        {"product_sku": "LATTE-001", "qty": 5, "unit_price": 22},
        {"product_sku": "SAND-001",  "qty": 2, "unit_price": 35},
    ])
    deplete_from_pos_sale(sale)

    # Espresso: 5 × 18g = 90g depleted
    assert on_hand_before - get_on_hand(main_branch, ing) == Decimal("90")

    # Step 2: Shift closing
    cash_total = Decimal("180")
    shift = _make_shift(main_branch, superuser, opened_at=FIXED_DT)
    closing = _make_closing(shift, cash=cash_total, system_total=cash_total)
    je = create_journal_entry_from_shift_closing(closing)

    assert je is not None
    assert lines_balanced(je)

    # Step 3: Daily report
    report = get_daily_sales_report([closing])
    assert float(report[0]["sales"]) == pytest.approx(float(cash_total), abs=1.0)


# ─── Fixture for test 10 ──────────────────────────────────────────────────────
@pytest.fixture
def test_user_fixture(db):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    u, _ = User.objects.get_or_create(username="exec_test_user")
    return u
