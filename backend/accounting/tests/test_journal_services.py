"""
Tests for accounting/journal_services.py

Key invariants tested:
  1. Every JournalEntry produced by create_journal_entry_from_shift_closing() is balanced
     (sum of debit lines == sum of credit lines).
  2. The revenue account code is used on the credit side for each payment channel.
  3. The correct cash/bank account code is used on the debit side.
  4. Calling the function with zero amounts returns None (no empty journal entries).
  5. Calling the function twice for the same closing is idempotent (no duplicate entries).
  6. Line amounts exactly match the input amounts.
"""
from decimal import Decimal

import pytest
from django.utils import timezone

from accounting.journal_services import (
    ACCOUNT_MAPPING,
    create_journal_entry_from_shift_closing,
)
from accounting.models import ChartAccount, JournalEntry, JournalEntryLine


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _ensure_chart_accounts():
    """Create the minimal Chart of Accounts rows referenced by ACCOUNT_MAPPING."""
    for label, (code, name_ar) in ACCOUNT_MAPPING.items():
        ChartAccount.objects.get_or_create(
            code=code,
            defaults={
                "name_ar": name_ar,
                "name_en": name_ar,
                "level": 3,
                "account_type": "تحليلي",
                "statement": "المركز المالي",
            },
        )


def _make_closing(branch, user, *, cash=Decimal("0"), network=Decimal("0"),
                  delivery=Decimal("0"), expenses=Decimal("0")):
    """Build a Shift + ShiftClosing with the given amounts. Returns the ShiftClosing."""
    from shifts.models import Shift, ShiftClosing, ShiftStatus, ShiftType

    shift = Shift.objects.create(
        branch=branch,
        status=ShiftStatus.CLOSED,
        shift_type=ShiftType.MORNING,
        opened_at=timezone.now(),
        opened_by=user,
    )
    return ShiftClosing.objects.create(
        shift=shift,
        manual_cash_override=cash if cash else None,
        mada=network,
        expenses_vouchers=expenses,
        hungerstation=delivery,
    )


# ─── Tests: balanced entries ──────────────────────────────────────────────────

@pytest.mark.django_db
def test_cash_only_entry_is_balanced(test_branch, test_user):
    _ensure_chart_accounts()
    closing = _make_closing(test_branch, test_user, cash=Decimal("1000"))
    je = create_journal_entry_from_shift_closing(closing)

    assert je is not None
    lines = JournalEntryLine.objects.filter(journal_entry=je)
    assert sum(l.debit_amount for l in lines) == sum(l.credit_amount for l in lines)


@pytest.mark.django_db
def test_network_only_entry_is_balanced(test_branch, test_user):
    _ensure_chart_accounts()
    closing = _make_closing(test_branch, test_user, network=Decimal("500"))
    je = create_journal_entry_from_shift_closing(closing)

    assert je is not None
    lines = JournalEntryLine.objects.filter(journal_entry=je)
    assert sum(l.debit_amount for l in lines) == sum(l.credit_amount for l in lines)


@pytest.mark.django_db
def test_delivery_entry_is_balanced(test_branch, test_user):
    _ensure_chart_accounts()
    closing = _make_closing(test_branch, test_user, delivery=Decimal("300"))
    je = create_journal_entry_from_shift_closing(closing)

    assert je is not None
    lines = JournalEntryLine.objects.filter(journal_entry=je)
    assert sum(l.debit_amount for l in lines) == sum(l.credit_amount for l in lines)


@pytest.mark.django_db
def test_combined_channels_entry_is_balanced(test_branch, test_user):
    _ensure_chart_accounts()
    closing = _make_closing(
        test_branch, test_user,
        cash=Decimal("800"), network=Decimal("400"),
        delivery=Decimal("200"), expenses=Decimal("50"),
    )
    je = create_journal_entry_from_shift_closing(closing)

    assert je is not None
    lines = JournalEntryLine.objects.filter(journal_entry=je)
    total_debit = sum(l.debit_amount for l in lines)
    total_credit = sum(l.credit_amount for l in lines)
    assert total_debit == total_credit, (
        f"Combined entry not balanced: debit={total_debit}, credit={total_credit}"
    )


# ─── Tests: correct account codes ────────────────────────────────────────────

@pytest.mark.django_db
def test_revenue_code_on_credit_side_for_cash(test_branch, test_user):
    _ensure_chart_accounts()
    closing = _make_closing(test_branch, test_user, cash=Decimal("1000"))
    je = create_journal_entry_from_shift_closing(closing)

    rev_code = ACCOUNT_MAPPING["إيرادات المبيعات"][0]
    credit_codes = [
        l.account_code
        for l in JournalEntryLine.objects.filter(journal_entry=je)
        if l.credit_amount > 0
    ]
    assert rev_code in credit_codes, (
        f"Revenue code {rev_code!r} not on credit side. Credit codes: {credit_codes}"
    )


@pytest.mark.django_db
def test_cash_account_code_on_debit_side(test_branch, test_user):
    _ensure_chart_accounts()
    closing = _make_closing(test_branch, test_user, cash=Decimal("1000"))
    je = create_journal_entry_from_shift_closing(closing)

    cash_code = ACCOUNT_MAPPING["صندوق فرعي"][0]
    debit_codes = [
        l.account_code
        for l in JournalEntryLine.objects.filter(journal_entry=je)
        if l.debit_amount > 0
    ]
    assert cash_code in debit_codes, (
        f"Cash code {cash_code!r} not on debit side. Debit codes: {debit_codes}"
    )


@pytest.mark.django_db
def test_expense_code_on_debit_side(test_branch, test_user):
    _ensure_chart_accounts()
    closing = _make_closing(test_branch, test_user, cash=Decimal("500"), expenses=Decimal("100"))
    je = create_journal_entry_from_shift_closing(closing)

    exp_code = ACCOUNT_MAPPING["مصروفات تشغيلية"][0]
    debit_codes = [
        l.account_code
        for l in JournalEntryLine.objects.filter(journal_entry=je)
        if l.debit_amount > 0
    ]
    assert exp_code in debit_codes, (
        f"Expense code {exp_code!r} not on debit side. Debit codes: {debit_codes}"
    )


# ─── Tests: edge cases ────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_zero_amounts_returns_none(test_branch, test_user):
    _ensure_chart_accounts()
    closing = _make_closing(test_branch, test_user)  # all zeros
    je = create_journal_entry_from_shift_closing(closing)
    assert je is None, "Zero-amount closing should return None"


@pytest.mark.django_db
def test_calling_twice_returns_same_entry(test_branch, test_user):
    _ensure_chart_accounts()
    closing = _make_closing(test_branch, test_user, cash=Decimal("500"))
    je1 = create_journal_entry_from_shift_closing(closing)
    je2 = create_journal_entry_from_shift_closing(closing)

    assert je1 is not None and je2 is not None
    assert je1.pk == je2.pk, "Duplicate journal entries created for same closing"
    assert JournalEntry.objects.filter(shift_closing=closing).count() == 1


@pytest.mark.django_db
def test_line_amounts_match_cash_amount(test_branch, test_user):
    _ensure_chart_accounts()
    cash_amount = Decimal("750")
    closing = _make_closing(test_branch, test_user, cash=cash_amount)
    je = create_journal_entry_from_shift_closing(closing)

    total_debit = sum(
        l.debit_amount
        for l in JournalEntryLine.objects.filter(journal_entry=je)
        if l.debit_amount > 0
    )
    assert total_debit == cash_amount, (
        f"Expected debit total of {cash_amount}, got {total_debit}"
    )
