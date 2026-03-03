"""
Tests for shifts.models.ShiftClosing — variance computation and journal entry integration.

Key invariants tested:
  1. compute_variances() = (actual - system) for both cash and network.
  2. Positive variance = cashier has more than system expected (excess).
  3. Negative variance = cashier has less (shortage).
  4. manual_cash_total() uses manual_cash_override when set, denominations otherwise.
  5. manual_network_total() = mada + visa + master_card.
  6. denomination_total() correctly multiplies bill counts × face values.
  7. Journal entry from shift closing is always balanced.
  8. Zero-amount closing → no journal entry (None).
"""
from decimal import Decimal

import pytest
from django.utils import timezone

from shifts.models import Shift, ShiftClosing, ShiftStatus, ShiftType


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _make_closing(branch, user, **kwargs):
    """Create Shift + ShiftClosing; kwargs go to ShiftClosing."""
    shift = Shift.objects.create(
        branch=branch,
        status=ShiftStatus.CLOSED,
        shift_type=ShiftType.MORNING,
        opened_at=timezone.now(),
        opened_by=user,
    )
    return ShiftClosing.objects.create(shift=shift, **kwargs)


def _ensure_chart_accounts():
    from accounting.journal_services import ACCOUNT_MAPPING
    from accounting.models import ChartAccount
    for label, (code, name_ar) in ACCOUNT_MAPPING.items():
        ChartAccount.objects.get_or_create(
            code=code,
            defaults={"name_ar": name_ar, "name_en": name_ar, "level": 3,
                      "account_type": "تحليلي", "statement": "المركز المالي"},
        )


# ─── Tests: variance computation ─────────────────────────────────────────────

@pytest.mark.django_db
def test_variance_zero_when_matching(test_branch, test_user):
    closing = _make_closing(
        test_branch, test_user,
        manual_cash_override=Decimal("500"), system_cash=Decimal("500"),
        mada=Decimal("200"), system_network=Decimal("200"),
    )
    v_cash, v_network = closing.compute_variances()
    assert v_cash == Decimal("0")
    assert v_network == Decimal("0")


@pytest.mark.django_db
def test_positive_cash_variance_when_excess(test_branch, test_user):
    closing = _make_closing(
        test_branch, test_user,
        manual_cash_override=Decimal("600"), system_cash=Decimal("500"),
    )
    v_cash, _ = closing.compute_variances()
    assert v_cash == Decimal("100"), f"Expected +100, got {v_cash}"


@pytest.mark.django_db
def test_negative_cash_variance_when_shortage(test_branch, test_user):
    closing = _make_closing(
        test_branch, test_user,
        manual_cash_override=Decimal("400"), system_cash=Decimal("500"),
    )
    v_cash, _ = closing.compute_variances()
    assert v_cash == Decimal("-100"), f"Expected -100, got {v_cash}"


@pytest.mark.django_db
def test_network_variance_uses_card_channels(test_branch, test_user):
    closing = _make_closing(
        test_branch, test_user,
        mada=Decimal("100"), visa=Decimal("150"), master_card=Decimal("50"),
        system_network=Decimal("320"),
    )
    _, v_network = closing.compute_variances()
    # (100 + 150 + 50) - 320 = -20
    assert v_network == Decimal("-20"), f"Expected -20, got {v_network}"


@pytest.mark.django_db
def test_denomination_total_calculation(test_branch, test_user):
    closing = _make_closing(
        test_branch, test_user,
        bills_100=2,   # 200
        bills_50=3,    # 150
        bills_20=1,    # 20
        bills_10=5,    # 50
        bills_5=2,     # 10
        bills_1=3,     # 3
        # total = 433
    )
    assert closing.denomination_total() == Decimal("433"), (
        f"Expected 433, got {closing.denomination_total()}"
    )


@pytest.mark.django_db
def test_manual_cash_override_takes_priority(test_branch, test_user):
    closing = _make_closing(
        test_branch, test_user,
        bills_100=10,                           # 1000 from denominations
        manual_cash_override=Decimal("750"),    # override wins
    )
    assert closing.manual_cash_total() == Decimal("750"), (
        "manual_cash_override should take priority over denomination total"
    )


@pytest.mark.django_db
def test_manual_cash_uses_denominations_without_override(test_branch, test_user):
    closing = _make_closing(
        test_branch, test_user,
        bills_50=4,    # 200
        bills_20=2,    # 40
        manual_cash_override=None,
    )
    assert closing.manual_cash_total() == Decimal("240")


@pytest.mark.django_db
def test_manual_network_total_sums_card_channels(test_branch, test_user):
    closing = _make_closing(
        test_branch, test_user,
        mada=Decimal("100"), visa=Decimal("200"), master_card=Decimal("50"),
    )
    assert closing.manual_network_total() == Decimal("350")


@pytest.mark.django_db
def test_manual_delivery_total_sums_all_channels(test_branch, test_user):
    closing = _make_closing(
        test_branch, test_user,
        hungerstation=Decimal("100"), jahez=Decimal("80"),
        lugmety=Decimal("20"), the_chefz=Decimal("40"), toyou=Decimal("10"),
    )
    assert closing.manual_delivery_total() == Decimal("250")


# ─── Tests: journal entry integration ────────────────────────────────────────

@pytest.mark.django_db
def test_shift_closing_journal_entry_is_balanced(test_branch, test_user):
    from accounting.journal_services import create_journal_entry_from_shift_closing
    from accounting.models import JournalEntryLine
    _ensure_chart_accounts()

    closing = _make_closing(
        test_branch, test_user,
        manual_cash_override=Decimal("900"),
        mada=Decimal("300"),
        hungerstation=Decimal("200"),
        expenses_vouchers=Decimal("75"),
    )
    je = create_journal_entry_from_shift_closing(closing)

    assert je is not None
    lines = JournalEntryLine.objects.filter(journal_entry=je)
    total_debit = sum(l.debit_amount for l in lines)
    total_credit = sum(l.credit_amount for l in lines)
    assert total_debit == total_credit, (
        f"Entry not balanced: debit={total_debit}, credit={total_credit}"
    )


@pytest.mark.django_db
def test_zero_closing_produces_no_journal_entry(test_branch, test_user):
    from accounting.journal_services import create_journal_entry_from_shift_closing
    _ensure_chart_accounts()

    closing = _make_closing(test_branch, test_user)  # all defaults = 0
    je = create_journal_entry_from_shift_closing(closing)
    assert je is None, "Zero-amount closing should return None"


@pytest.mark.django_db
def test_large_variance_does_not_break_entry_balance(test_branch, test_user):
    from accounting.journal_services import create_journal_entry_from_shift_closing
    from accounting.models import JournalEntryLine
    _ensure_chart_accounts()

    closing = _make_closing(
        test_branch, test_user,
        manual_cash_override=Decimal("999999.99"),
        mada=Decimal("500000"),
    )
    je = create_journal_entry_from_shift_closing(closing)

    assert je is not None
    lines = JournalEntryLine.objects.filter(journal_entry=je)
    assert sum(l.debit_amount for l in lines) == sum(l.credit_amount for l in lines)
